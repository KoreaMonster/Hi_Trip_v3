"""Google Maps 관련 API 호출을 담당하는 모듈.

- 초보 개발자도 흐름을 이해할 수 있도록 최대한 직관적인 함수/주석을 제공합니다.
- 모든 함수는 GoogleApiCache 모델을 사용해 응답을 DB에 저장하고, 동일 요청 시 재사용합니다.
- Google API는 쿼터 제한이 엄격하므로 캐시를 먼저 확인하고, 만료되었을 때만 실제 요청을 보냅니다.
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Dict, List, Optional, Sequence

import requests
from django.conf import settings
from django.utils import timezone

from schedules.models import GoogleApiCache

logger = logging.getLogger(__name__)

# Google Maps 각 서비스의 엔드포인트를 한 곳에 모아두면 유지보수가 쉽습니다.
GEOCODING_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json"
PLACES_NEARBY_ENDPOINT = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
PLACE_DETAILS_ENDPOINT = "https://maps.googleapis.com/maps/api/place/details/json"
ROUTES_COMPUTE_ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes"
ROUTE_MATRIX_ENDPOINT = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix"

# 서비스별 기본 캐시 시간(초). 프로젝트 요구사항에 맞춰 필요시 조정합니다.
GEOCODING_CACHE_SECONDS = 60 * 60 * 24  # 24시간 유지
PLACES_CACHE_SECONDS = 60 * 60 * 12     # 12시간 유지
PLACE_DETAILS_CACHE_SECONDS = 60 * 60 * 24
ROUTES_CACHE_SECONDS = 60 * 15          # 경로 정보는 교통 상황이 자주 바뀌므로 15분만 유지
ROUTE_MATRIX_CACHE_SECONDS = 60 * 15

# Google Routes API는 FieldMask를 반드시 지정해야 하며,
# duration(총 소요 시간)과 distanceMeters(총 거리)만 받으면 충분하므로 이렇게 고정합니다.
ROUTES_FIELD_MASK = "routes.duration,routes.distanceMeters"
ROUTE_MATRIX_FIELD_MASK = "originIndex,destinationIndex,duration,distanceMeters"


class GoogleMapsError(Exception):
    """Google API 호출 중 발생한 예외를 의미하는 간단한 커스텀 예외"""


@dataclass
class GeocodeResult:
    """Geocoding API의 핵심 정보를 구조화한 자료형"""

    formatted_address: str
    latitude: float
    longitude: float
    place_id: Optional[str]


@dataclass
class GooglePlace:
    """Places Nearby 또는 Place Details에서 얻은 장소 정보를 표현"""

    place_id: str
    name: str
    latitude: float
    longitude: float
    types: List[str]
    rating: Optional[float]
    user_ratings_total: int
    raw: Dict[str, Any]


@dataclass
class RouteDuration:
    """ComputeRoutes 응답에서 총 이동 시간/거리만 추린 자료형"""

    seconds: int
    distance_meters: Optional[int]
    raw: Dict[str, Any]

    @property
    def duration_text(self) -> str:
        """초 단위 값을 사람이 읽기 쉬운 문자열(예: '25분')로 변환"""
        minutes, _ = divmod(self.seconds, 60)
        hours, minutes = divmod(minutes, 60)
        if hours > 0:
            return f"{hours}시간 {minutes}분" if minutes else f"{hours}시간"
        return f"{minutes}분"


@dataclass
class RouteMatrixElement:
    """ComputeRouteMatrix에서 한 쌍(origin→destination)의 결과를 담는 자료형"""

    origin_index: int
    destination_index: int
    duration_seconds: int
    distance_meters: Optional[int]
    raw: Dict[str, Any]


def _require_api_key() -> str:
    """환경 변수에서 API 키를 읽고, 없으면 친절한 예외를 발생시킵니다."""

    api_key = getattr(settings, "GOOGLE_MAPS_API_KEY", "")
    if not api_key:
        raise GoogleMapsError(
            "GOOGLE_MAPS_API_KEY가 설정되어 있지 않습니다. .env 파일을 확인해주세요."
        )
    return api_key


def _build_request_hash(payload: Dict[str, Any]) -> str:
    """요청 파라미터를 문자열로 직렬화한 뒤 SHA-256 해시를 계산합니다."""

    normalized = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _load_cache(service_name: str, request_payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """캐시가 존재하고 아직 유효하면 JSON 응답을 반환합니다."""

    request_hash = _build_request_hash(request_payload)
    try:
        cache = GoogleApiCache.objects.get(service_name=service_name, request_hash=request_hash)
    except GoogleApiCache.DoesNotExist:
        return None

    if cache.is_expired:
        # 만료된 캐시는 바로 삭제해 두면 불필요한 용량을 줄일 수 있습니다.
        cache.delete()
        return None
    return cache.response_data


def _save_cache(
    service_name: str,
    request_payload: Dict[str, Any],
    response_data: Dict[str, Any],
    ttl_seconds: int,
) -> None:
    """API 응답을 캐시에 저장합니다."""

    request_hash = _build_request_hash(request_payload)
    expires_at = timezone.now() + timedelta(seconds=ttl_seconds)
    GoogleApiCache.objects.update_or_create(
        service_name=service_name,
        request_hash=request_hash,
        defaults={
            "response_data": response_data,
            "expires_at": expires_at,
        },
    )


def _perform_get(
    service_name: str,
    url: str,
    params: Dict[str, Any],
    ttl_seconds: int,
    timeout: int = 5,
) -> Dict[str, Any]:
    """GET 요청을 수행하기 전에 캐시를 확인하고, 필요 시 실제 API 호출을 수행합니다."""

    cached = _load_cache(service_name, params)
    if cached is not None:
        logger.debug("%s 캐시 적중: params=%s", service_name, params)
        return cached

    api_key = _require_api_key()
    params_with_key = {**params, "key": api_key}

    try:
        response = requests.get(url, params=params_with_key, timeout=timeout)
    except requests.RequestException as exc:
        raise GoogleMapsError(f"{service_name} 호출 중 네트워크 오류가 발생했습니다: {exc}") from exc

    if response.status_code != 200:
        raise GoogleMapsError(
            f"{service_name} 호출이 실패했습니다. status={response.status_code}, body={response.text}"
        )

    data = response.json()

    # Google API는 status 필드를 통해 세부 에러를 제공하므로 확인합니다.
    if data.get("status") not in (None, "OK", "ZERO_RESULTS"):
        raise GoogleMapsError(f"{service_name} 호출 실패: {data.get('status')} / {data.get('error_message')}")

    _save_cache(service_name, params, data, ttl_seconds)
    return data


def _perform_post(
    service_name: str,
    url: str,
    json_payload: Dict[str, Any],
    ttl_seconds: int,
    field_mask: Optional[str] = None,
    timeout: int = 5,
) -> Dict[str, Any]:
    """POST 요청을 수행하기 전에 캐시를 확인하고, 동일 요청은 캐시 결과를 반환합니다."""

    cached = _load_cache(service_name, json_payload)
    if cached is not None:
        logger.debug("%s 캐시 적중: payload=%s", service_name, json_payload)
        return cached

    api_key = _require_api_key()

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
    }
    if field_mask:
        headers["X-Goog-FieldMask"] = field_mask

    try:
        response = requests.post(url, json=json_payload, headers=headers, timeout=timeout)
    except requests.RequestException as exc:
        raise GoogleMapsError(f"{service_name} 호출 중 네트워크 오류가 발생했습니다: {exc}") from exc

    if response.status_code != 200:
        raise GoogleMapsError(
            f"{service_name} 호출이 실패했습니다. status={response.status_code}, body={response.text}"
        )

    data = response.json()
    if "error" in data:
        raise GoogleMapsError(f"{service_name} 호출 실패: {data['error']}")
    _save_cache(service_name, json_payload, data, ttl_seconds)
    return data


def geocode_address(address: str, language: str = "ko") -> GeocodeResult:
    """주소 문자열을 위도/경도로 변환합니다."""

    params = {
        "address": address,
        "language": language,
    }
    data = _perform_get("geocoding", GEOCODING_ENDPOINT, params, GEOCODING_CACHE_SECONDS)

    results = data.get("results", [])
    if not results:
        raise GoogleMapsError("Geocoding 결과가 없습니다. 주소를 다시 확인해주세요.")

    first = results[0]
    location = first["geometry"]["location"]
    return GeocodeResult(
        formatted_address=first.get("formatted_address", address),
        latitude=location.get("lat"),
        longitude=location.get("lng"),
        place_id=first.get("place_id"),
    )


def fetch_nearby_places(
    *,
    latitude: float,
    longitude: float,
    place_type: str,
    radius: int = 1000,
    language: str = "ko",
) -> List[GooglePlace]:
    """Places Nearby Search API를 호출하여 주변 장소 목록을 반환합니다."""

    params = {
        "location": f"{latitude},{longitude}",
        "radius": radius,
        "type": place_type,
        "language": language,
    }
    data = _perform_get("places_nearby", PLACES_NEARBY_ENDPOINT, params, PLACES_CACHE_SECONDS)

    places: List[GooglePlace] = []
    for place in data.get("results", []):
        geometry = place.get("geometry", {}).get("location", {})
        places.append(
            GooglePlace(
                place_id=place.get("place_id", ""),
                name=place.get("name", ""),
                latitude=geometry.get("lat", 0.0),
                longitude=geometry.get("lng", 0.0),
                types=place.get("types", []),
                rating=place.get("rating"),
                user_ratings_total=place.get("user_ratings_total", 0),
                raw=place,
            )
        )
    return places


def fetch_place_details(place_id: str, language: str = "ko") -> GooglePlace:
    """Place Details API에서 장소의 상세 정보를 받아옵니다."""

    params = {
        "place_id": place_id,
        "language": language,
        # types, geometry, rating 등을 한번에 받아두면 후속 기능 구현이 편리합니다.
        "fields": "place_id,name,geometry,types,rating,user_ratings_total,formatted_address",
    }
    data = _perform_get("place_details", PLACE_DETAILS_ENDPOINT, params, PLACE_DETAILS_CACHE_SECONDS)

    result = data.get("result")
    if not result:
        raise GoogleMapsError("Place Details 응답에 result가 없습니다.")

    geometry = result.get("geometry", {}).get("location", {})
    return GooglePlace(
        place_id=result.get("place_id", place_id),
        name=result.get("name", ""),
        latitude=geometry.get("lat", 0.0),
        longitude=geometry.get("lng", 0.0),
        types=result.get("types", []),
        rating=result.get("rating"),
        user_ratings_total=result.get("user_ratings_total", 0),
        raw=result,
    )


def compute_route_duration(
    *,
    origin: Dict[str, Any],
    destination: Dict[str, Any],
    intermediates: Optional[Sequence[Dict[str, Any]]] = None,
    travel_mode: str = "DRIVE",
) -> RouteDuration:
    """Routes API(ComputeRoutes)를 호출하여 총 이동 시간을 계산합니다."""

    body: Dict[str, Any] = {
        "origin": origin,
        "destination": destination,
        "travelMode": travel_mode,
    }
    if intermediates:
        body["intermediates"] = list(intermediates)

    data = _perform_post(
        "routes_compute",
        ROUTES_COMPUTE_ENDPOINT,
        body,
        ROUTES_CACHE_SECONDS,
        field_mask=ROUTES_FIELD_MASK,
    )

    routes = data.get("routes", [])
    if not routes:
        raise GoogleMapsError("Routes API에서 경로를 찾지 못했습니다.")

    route = routes[0]
    duration_str = route.get("duration", "0s")
    seconds = _parse_duration_seconds(duration_str)
    distance = route.get("distanceMeters")
    return RouteDuration(seconds=seconds, distance_meters=distance, raw=route)


def compute_route_matrix(
    *,
    origins: Sequence[Dict[str, Any]],
    destinations: Sequence[Dict[str, Any]],
    travel_mode: str = "DRIVE",
) -> List[RouteMatrixElement]:
    """Routes API(ComputeRouteMatrix)를 호출하여 다건 경로의 이동 시간을 한번에 계산합니다."""

    body: Dict[str, Any] = {
        "origins": list(origins),
        "destinations": list(destinations),
        "travelMode": travel_mode,
    }

    data = _perform_post(
        "routes_matrix",
        ROUTE_MATRIX_ENDPOINT,
        body,
        ROUTE_MATRIX_CACHE_SECONDS,
        field_mask=ROUTE_MATRIX_FIELD_MASK,
        timeout=10,  # 행렬 계산은 시간이 조금 더 걸릴 수 있어 여유를 둡니다.
    )

    elements: List[RouteMatrixElement] = []
    for element in data:
        duration_str = element.get("duration", "0s")
        seconds = _parse_duration_seconds(duration_str)
        elements.append(
            RouteMatrixElement(
                origin_index=element.get("originIndex", 0),
                destination_index=element.get("destinationIndex", 0),
                duration_seconds=seconds,
                distance_meters=element.get("distanceMeters"),
                raw=element,
            )
        )
    return elements


def _parse_duration_seconds(duration: str) -> int:
    """Routes API가 ISO 8601 형식으로 제공하는 duration 문자열을 초 단위 정수로 변환"""

    # 예시: "123s" 또는 "3600s" 형태만 사용되므로 단순 파싱으로 충분합니다.
    if not duration:
        return 0
    if duration.endswith("s"):
        try:
            return int(duration[:-1])
        except ValueError:
            logger.warning("duration 파싱 실패: %s", duration)
            return 0
    # 혹시 모를 다른 포맷 대비
    logger.warning("알 수 없는 duration 포맷: %s", duration)
    return 0


def build_place_id_payload(place_id: str) -> Dict[str, str]:
    """Routes API에서 요구하는 placeId 포맷을 손쉽게 만들기 위한 보조 함수"""

    return {"placeId": place_id}


def build_location_payload(latitude: float, longitude: float) -> Dict[str, Dict[str, float]]:
    """위도/경도를 그대로 사용할 때의 payload를 만들어 줍니다."""

    return {"location": {"latLng": {"latitude": latitude, "longitude": longitude}}}


__all__ = [
    "GoogleMapsError",
    "GeocodeResult",
    "GooglePlace",
    "RouteDuration",
    "RouteMatrixElement",
    "geocode_address",
    "fetch_nearby_places",
    "fetch_place_details",
    "compute_route_duration",
    "compute_route_matrix",
    "build_place_id_payload",
    "build_location_payload",
]
