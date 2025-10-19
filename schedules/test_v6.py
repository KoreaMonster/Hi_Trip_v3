"""Schedules v6 테스트 모음.

- Google Places 기반 추천/대체 API와 일정 재배치 기능을 현실적인 시나리오로 검증합니다.
- 각 테스트는 실패 시 디버깅이 쉽도록 요약 메시지와 주요 파라미터를 함께 제공합니다.
- 요구사항에 맞춰 예시 데이터는 리스트(dict) 형태로 구성하며, 총 100개의 경우를 다룹니다.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta
from typing import Dict, List, Optional, Tuple

import pytest
import sys
import types

# ---------------------------------------------------------------------------
# requests 모듈 스텁: 테스트 환경에서 실제 HTTP 호출이 일어나지 않도록 합니다.
# ---------------------------------------------------------------------------
if "requests" not in sys.modules:
    requests_stub = types.ModuleType("requests")

    class _RequestsStubException(Exception):
        """실제 네트워크 호출을 방지하기 위한 예외 클래스"""

    def _not_implemented(*args, **kwargs):
        raise _RequestsStubException("테스트 스텁 요청: 실제 HTTP 호출은 수행되지 않습니다.")

    urllib3_module = types.ModuleType("urllib3")
    collections_module = types.ModuleType("_collections")
    adapters_module = types.ModuleType("adapters")

    class _HTTPHeaderDict(dict):
        """rest_framework.test 모듈이 기대하는 헤더 컨테이너 스텁"""

    class _HTTPAdapter:  # 최소한의 어댑터 스텁
        def __init__(self, *args, **kwargs):
            pass

    collections_module.HTTPHeaderDict = _HTTPHeaderDict
    urllib3_module._collections = collections_module
    adapters_module.HTTPAdapter = _HTTPAdapter
    requests_stub.packages = types.SimpleNamespace(urllib3=urllib3_module)
    requests_stub.adapters = adapters_module

    class _Session:  # RequestsClient에서 상속할 세션 스텁
        def __init__(self, *args, **kwargs):
            pass

        def request(self, *args, **kwargs):
            raise _RequestsStubException("requests.Session 스텁은 실제 요청을 수행하지 않습니다.")

    requests_stub.Session = _Session
    requests_stub.get = _not_implemented
    requests_stub.post = _not_implemented
    requests_stub.RequestException = _RequestsStubException
    sys.modules["requests"] = requests_stub

from django.urls import reverse
from rest_framework.test import APIClient

from schedules.constants import FIXED_RECOMMENDATION_PLACE_TYPES
from schedules.models import Place, Schedule
from schedules.services.google_maps import GeocodeResult, GooglePlace, RouteDuration


LOGGER = logging.getLogger("tests.schedules.v6")


# ---------------------------------------------------------------------------
# 고정 추천용 도시 데이터
# ---------------------------------------------------------------------------
_CITY_SAMPLES = [
    {
        "slug": "seoul_central",
        "city": "서울",
        "address": "서울특별시 중구 세종대로 110",
        "latitude": 37.5665,
        "longitude": 126.9780,
        "coordinate_variations": [
            (37.5655, 126.9772, "서울광장 스케이트장"),
        ],
        "poi_names": ["광화문 광장", "서울시립미술관", "덕수궁"],
        "primary_type": "tourist_attraction",
    },
    {
        "slug": "busan_harbor",
        "city": "부산",
        "address": "부산광역시 중구 중앙대로 26",
        "latitude": 35.1796,
        "longitude": 129.0756,
        "coordinate_variations": [
            (35.1781, 129.0725, "부산역 광장"),
        ],
        "poi_names": ["용두산공원", "광복동 패션거리", "부산타워"],
        "primary_type": "tourist_attraction",
    },
    {
        "slug": "jeju_coast",
        "city": "제주",
        "address": "제주특별자치도 제주시 중앙로 217",
        "latitude": 33.5000,
        "longitude": 126.5310,
        "coordinate_variations": [
            (33.4985, 126.5332, "동문시장 입구"),
        ],
        "poi_names": ["제주 동문시장", "용두암", "삼성혈"],
        "primary_type": "tourist_attraction",
    },
    {
        "slug": "incheon_port",
        "city": "인천",
        "address": "인천광역시 중구 제물량로 238",
        "latitude": 37.4738,
        "longitude": 126.6169,
        "coordinate_variations": [
            (37.4749, 126.6195, "차이나타운 중앙로"),
        ],
        "poi_names": ["월미문화의거리", "자유공원", "짜장면박물관"],
        "primary_type": "tourist_attraction",
    },
    {
        "slug": "daegu_market",
        "city": "대구",
        "address": "대구광역시 중구 달구벌대로 2099",
        "latitude": 35.8694,
        "longitude": 128.5930,
        "coordinate_variations": [
            (35.8681, 128.5960, "서문시장 동문"),
        ],
        "poi_names": ["서문시장", "근대골목", "약령시"],
        "primary_type": "tourist_attraction",
    },
    {
        "slug": "gwangju_culture",
        "city": "광주",
        "address": "광주광역시 동구 문화전당로 38",
        "latitude": 35.1461,
        "longitude": 126.9195,
        "coordinate_variations": [
            (35.1450, 126.9215, "아시아문화전당 북문"),
        ],
        "poi_names": ["국립아시아문화전당", "충장로 거리", "펭귄마을"],
        "primary_type": "art_gallery",
    },
    {
        "slug": "daejeon_science",
        "city": "대전",
        "address": "대전광역시 유성구 대덕대로 480",
        "latitude": 36.3743,
        "longitude": 127.3845,
        "coordinate_variations": [
            (36.3732, 127.3819, "엑스포다리 전망대"),
        ],
        "poi_names": ["국립중앙과학관", "엑스포과학공원", "한빛탑"],
        "primary_type": "museum",
    },
    {
        "slug": "suwon_fortress",
        "city": "수원",
        "address": "경기도 수원시 팔달구 팔달로 21",
        "latitude": 37.2859,
        "longitude": 127.0190,
        "coordinate_variations": [
            (37.2819, 127.0142, "화홍문"),
        ],
        "poi_names": ["화성행궁", "팔달문 시장", "수원화성박물관"],
        "primary_type": "tourist_attraction",
    },
    {
        "slug": "jeonju_hanok",
        "city": "전주",
        "address": "전라북도 전주시 완산구 기린대로 99",
        "latitude": 35.8150,
        "longitude": 127.1531,
        "coordinate_variations": [
            (35.8140, 127.1580, "전주한옥마을 공영주차장"),
        ],
        "poi_names": ["전주한옥마을", "경기전", "오목대"],
        "primary_type": "tourist_attraction",
    },
    {
        "slug": "gangneung_coffee",
        "city": "강릉",
        "address": "강원특별자치도 강릉시 창해로 17",
        "latitude": 37.7724,
        "longitude": 128.9485,
        "coordinate_variations": [
            (37.7709, 128.9432, "안목해변 커피거리"),
        ],
        "poi_names": ["안목해변", "강릉커피박물관", "경포호"],
        "primary_type": "cafe",
    },
]

def _build_poi_samples(city: Dict[str, object], variant_index: int, anchor_label: Optional[str]) -> List[Dict[str, object]]:
    """도시 정보를 바탕으로 추천 응답에 사용할 장소 샘플을 생성합니다."""

    base_lat = city["latitude"] + 0.001 * variant_index
    base_lon = city["longitude"] + 0.0015 * variant_index
    samples: List[Dict[str, object]] = []
    poi_names = city["poi_names"]
    for idx in range(6):
        name_suffix = anchor_label or f"추천 코스 {idx + 1}"
        samples.append(
            {
                "place_id_suffix": f"{city['slug']}_{variant_index}_{idx}",
                "name": f"{poi_names[idx % len(poi_names)]} - {name_suffix}",
                "latitude": round(base_lat + idx * 0.0003, 6),
                "longitude": round(base_lon + idx * 0.0004, 6),
                "types": [city["primary_type"], "point_of_interest"],
                "rating": round(4.1 + 0.1 * ((variant_index + idx) % 4), 1),
                "user_ratings_total": 480 + idx * 90 + variant_index * 40,
                "photo_reference": None if idx % 2 else f"{city['slug']}_photo_{variant_index}_{idx}",
            }
        )
    return samples


def _build_fixed_request_cases() -> List[Dict[str, object]]:
    cases: List[Dict[str, object]] = []
    for city in _CITY_SAMPLES:
        geocode_result = {
            "formatted_address": f"대한민국 {city['city']}",
            "latitude": city["latitude"],
            "longitude": city["longitude"],
            "place_id": f"geo-{city['slug']}",
        }
        cases.append(
            {
                "id": f"{city['slug']}_address",
                "payload": {"address": city["address"]},
                "expect_geocode": True,
                "geocode_result": geocode_result,
                "poi_samples": _build_poi_samples(city, 0, anchor_label="중심 코스"),
                "debug": {
                    "city": city["city"],
                    "mode": "address",
                    "address": city["address"],
                },
            }
        )

        coord_lat, coord_lon, coord_label = city["coordinate_variations"][0]
        cases.append(
            {
                "id": f"{city['slug']}_coordinates",
                "payload": {"latitude": coord_lat, "longitude": coord_lon},
                "expect_geocode": False,
                "geocode_result": geocode_result,
                "poi_samples": _build_poi_samples(city, 1, anchor_label=coord_label),
                "debug": {
                    "city": city["city"],
                    "mode": "coordinates",
                    "latitude": coord_lat,
                    "longitude": coord_lon,
                    "landmark": coord_label,
                },
            }
        )
    return cases


FIXED_REQUEST_CASES = _build_fixed_request_cases()
assert len(FIXED_REQUEST_CASES) == 20


# ---------------------------------------------------------------------------
# 대체 장소 추천 시나리오 (40건 생성)
# ---------------------------------------------------------------------------
_ALTERNATIVE_BASE_SCENARIOS = [
    {
        "id_prefix": "seoul_museum",
        "travel_mode": "DRIVE",
        "previous": "place_seoul_prev",
        "next": "place_seoul_next",
        "unavailable": {
            "name": "서울 역사 박물관",
            "latitude": 37.5704,
            "longitude": 126.9696,
            "types": ["museum", "point_of_interest"],
            "rating": 4.5,
            "user_ratings_total": 980,
        },
        "candidates": [
            {
                "place_id_suffix": "design_plaza",
                "name": "DDP 디자인 박물관",
                "latitude": 37.5663,
                "longitude": 127.0091,
                "rating": 4.6,
                "user_ratings_total": 1500,
            },
            {
                "place_id_suffix": "sema",
                "name": "서울시립미술관",
                "latitude": 37.5643,
                "longitude": 126.9737,
                "rating": 4.4,
                "user_ratings_total": 760,
            },
            {
                "place_id_suffix": "national_museum",
                "name": "국립중앙박물관",
                "latitude": 37.5230,
                "longitude": 126.9804,
                "rating": 4.7,
                "user_ratings_total": 2120,
            },
        ],
        "base_seconds": 2100,
        "candidate_base_deltas": [240, -180, 360],
        "variants": [
            {"suffix": "weekday", "base_adjust": 0, "extra_candidate_deltas": [60, 30, -120]},
            {"suffix": "rainy_day", "base_adjust": 240, "extra_candidate_deltas": [120, 90, 0]},
            {"suffix": "festival", "base_adjust": 420, "extra_candidate_deltas": [-60, 240, 180]},
            {"suffix": "night", "base_adjust": -180, "extra_candidate_deltas": [90, -120, -240]},
            {"suffix": "holiday", "base_adjust": 300, "extra_candidate_deltas": [150, 60, -180]},
        ],
    },
    {
        "id_prefix": "busan_cafe",
        "travel_mode": "WALK",
        "previous": "place_busan_prev",
        "next": "place_busan_next",
        "unavailable": {
            "name": "남포동 로스터리",
            "latitude": 35.0984,
            "longitude": 129.0304,
            "types": ["cafe", "food"],
            "rating": 4.3,
            "user_ratings_total": 420,
        },
        "candidates": [
            {
                "place_id_suffix": "jagalchi",
                "name": "자갈치 전망 카페",
                "latitude": 35.0971,
                "longitude": 129.0309,
                "rating": 4.5,
                "user_ratings_total": 310,
            },
            {
                "place_id_suffix": "yeongdo",
                "name": "영도 브루어리 카페",
                "latitude": 35.0901,
                "longitude": 129.0402,
                "rating": 4.7,
                "user_ratings_total": 510,
            },
        ],
        "base_seconds": 900,
        "candidate_base_deltas": [120, -150],
        "variants": [
            {"suffix": "sunny", "base_adjust": 0, "extra_candidate_deltas": [60, -90]},
            {"suffix": "rain", "base_adjust": 240, "extra_candidate_deltas": [120, 30]},
            {"suffix": "weekend", "base_adjust": 180, "extra_candidate_deltas": [30, -30]},
            {"suffix": "late_night", "base_adjust": -120, "extra_candidate_deltas": [90, -180]},
            {"suffix": "holiday", "base_adjust": 300, "extra_candidate_deltas": [150, 0]},
        ],
    },
    {
        "id_prefix": "jeju_outdoor",
        "travel_mode": "DRIVE",
        "previous": "place_jeju_prev",
        "next": "place_jeju_next",
        "unavailable": {
            "name": "용두암 전망대",
            "latitude": 33.5163,
            "longitude": 126.5178,
            "types": ["park", "tourist_attraction"],
            "rating": 4.4,
            "user_ratings_total": 670,
        },
        "candidates": [
            {
                "place_id_suffix": "sarabong",
                "name": "사라봉 둘레길",
                "latitude": 33.5210,
                "longitude": 126.5412,
                "rating": 4.6,
                "user_ratings_total": 420,
            },
            {
                "place_id_suffix": "hamdeok",
                "name": "함덕해수욕장",
                "latitude": 33.5430,
                "longitude": 126.6720,
                "rating": 4.7,
                "user_ratings_total": 1890,
            },
            {
                "place_id_suffix": "snoopy",
                "name": "스누피가든",
                "latitude": 33.4644,
                "longitude": 126.9137,
                "rating": 4.5,
                "user_ratings_total": 1250,
            },
        ],
        "base_seconds": 2400,
        "candidate_base_deltas": [180, -300, 420],
        "variants": [
            {"suffix": "clear_day", "base_adjust": 0, "extra_candidate_deltas": [60, -120, 150]},
            {"suffix": "windy", "base_adjust": 360, "extra_candidate_deltas": [180, 60, -180]},
            {"suffix": "sunset", "base_adjust": 120, "extra_candidate_deltas": [-30, -210, 90]},
            {"suffix": "rain", "base_adjust": 540, "extra_candidate_deltas": [210, 180, 0]},
            {"suffix": "festival", "base_adjust": 300, "extra_candidate_deltas": [120, -60, -240]},
        ],
    },
    {
        "id_prefix": "incheon_history",
        "travel_mode": "TRANSIT",
        "previous": "place_incheon_prev",
        "next": "place_incheon_next",
        "unavailable": {
            "name": "짜장면 박물관",
            "latitude": 37.4751,
            "longitude": 126.6175,
            "types": ["museum", "point_of_interest"],
            "rating": 4.2,
            "user_ratings_total": 520,
        },
        "candidates": [
            {
                "place_id_suffix": "culture_street",
                "name": "차이나타운 문화거리",
                "latitude": 37.4742,
                "longitude": 126.6191,
                "rating": 4.3,
                "user_ratings_total": 950,
            },
            {
                "place_id_suffix": "wolmi_theme",
                "name": "월미문화의거리",
                "latitude": 37.4720,
                "longitude": 126.6040,
                "rating": 4.1,
                "user_ratings_total": 760,
            },
        ],
        "base_seconds": 1500,
        "candidate_base_deltas": [120, -90],
        "variants": [
            {"suffix": "weekday", "base_adjust": 0, "extra_candidate_deltas": [60, -30]},
            {"suffix": "weekend", "base_adjust": 210, "extra_candidate_deltas": [120, 30]},
            {"suffix": "holiday", "base_adjust": 420, "extra_candidate_deltas": [90, -60]},
            {"suffix": "rain", "base_adjust": 300, "extra_candidate_deltas": [30, -120]},
            {"suffix": "late", "base_adjust": -150, "extra_candidate_deltas": [0, -210]},
        ],
    },
    {
        "id_prefix": "daegu_food",
        "travel_mode": "DRIVE",
        "previous": "place_daegu_prev",
        "next": "place_daegu_next",
        "unavailable": {
            "name": "교동시장 분식",
            "latitude": 35.8732,
            "longitude": 128.5974,
            "types": ["restaurant", "food"],
            "rating": 4.5,
            "user_ratings_total": 680,
        },
        "candidates": [
            {
                "place_id_suffix": "seomun_gukbap",
                "name": "서문시장 국밥골목",
                "latitude": 35.8712,
                "longitude": 128.5869,
                "rating": 4.6,
                "user_ratings_total": 830,
            },
            {
                "place_id_suffix": "modern_street",
                "name": "근대골목 카페",
                "latitude": 35.8724,
                "longitude": 128.5938,
                "rating": 4.4,
                "user_ratings_total": 410,
            },
            {
                "place_id_suffix": "yangnyeongsi",
                "name": "약령시 약차원",
                "latitude": 35.8699,
                "longitude": 128.5942,
                "rating": 4.3,
                "user_ratings_total": 290,
            },
        ],
        "base_seconds": 1800,
        "candidate_base_deltas": [150, -120, 210],
        "variants": [
            {"suffix": "lunch", "base_adjust": 0, "extra_candidate_deltas": [60, -90, 120]},
            {"suffix": "dinner", "base_adjust": 240, "extra_candidate_deltas": [120, -60, 30]},
            {"suffix": "rain", "base_adjust": 300, "extra_candidate_deltas": [90, 0, -180]},
            {"suffix": "festival", "base_adjust": 420, "extra_candidate_deltas": [180, 60, -210]},
            {"suffix": "late_night", "base_adjust": -180, "extra_candidate_deltas": [30, -150, -240]},
        ],
    },
    {
        "id_prefix": "gwangju_art",
        "travel_mode": "TRANSIT",
        "previous": "place_gwangju_prev",
        "next": "place_gwangju_next",
        "unavailable": {
            "name": "광주 문화전당",
            "latitude": 35.1465,
            "longitude": 126.9199,
            "types": ["art_gallery", "point_of_interest"],
            "rating": 4.6,
            "user_ratings_total": 1120,
        },
        "candidates": [
            {
                "place_id_suffix": "penguin_village",
                "name": "펭귄마을 갤러리",
                "latitude": 35.1418,
                "longitude": 126.9211,
                "rating": 4.7,
                "user_ratings_total": 620,
            },
            {
                "place_id_suffix": "jungang_street",
                "name": "충장로 거리 아트샵",
                "latitude": 35.1476,
                "longitude": 126.9139,
                "rating": 4.3,
                "user_ratings_total": 480,
            },
        ],
        "base_seconds": 1320,
        "candidate_base_deltas": [180, -150],
        "variants": [
            {"suffix": "weekday", "base_adjust": 0, "extra_candidate_deltas": [30, -30]},
            {"suffix": "weekend", "base_adjust": 210, "extra_candidate_deltas": [120, 60]},
            {"suffix": "night", "base_adjust": -180, "extra_candidate_deltas": [60, -180]},
            {"suffix": "rain", "base_adjust": 300, "extra_candidate_deltas": [90, -60]},
            {"suffix": "holiday", "base_adjust": 420, "extra_candidate_deltas": [150, 0]},
        ],
    },
    {
        "id_prefix": "suwon_history",
        "travel_mode": "DRIVE",
        "previous": "place_suwon_prev",
        "next": "place_suwon_next",
        "unavailable": {
            "name": "화성행궁 야간투어",
            "latitude": 37.2816,
            "longitude": 127.0151,
            "types": ["tourist_attraction", "point_of_interest"],
            "rating": 4.8,
            "user_ratings_total": 1570,
        },
        "candidates": [
            {
                "place_id_suffix": "paldal_market",
                "name": "팔달문 야시장",
                "latitude": 37.2804,
                "longitude": 127.0136,
                "rating": 4.5,
                "user_ratings_total": 840,
            },
            {
                "place_id_suffix": "hwaseong_museum",
                "name": "수원화성박물관",
                "latitude": 37.2852,
                "longitude": 127.0139,
                "rating": 4.4,
                "user_ratings_total": 620,
            },
        ],
        "base_seconds": 1620,
        "candidate_base_deltas": [180, -120],
        "variants": [
            {"suffix": "weekday", "base_adjust": 0, "extra_candidate_deltas": [90, -60]},
            {"suffix": "weekend", "base_adjust": 210, "extra_candidate_deltas": [150, 0]},
            {"suffix": "holiday", "base_adjust": 360, "extra_candidate_deltas": [120, -90]},
            {"suffix": "rain", "base_adjust": 420, "extra_candidate_deltas": [180, -30]},
            {"suffix": "late", "base_adjust": -180, "extra_candidate_deltas": [60, -150]},
        ],
    },
    {
        "id_prefix": "jeonju_food",
        "travel_mode": "WALK",
        "previous": "place_jeonju_prev",
        "next": "place_jeonju_next",
        "unavailable": {
            "name": "한옥마을 비빔밥집",
            "latitude": 35.8162,
            "longitude": 127.1524,
            "types": ["restaurant", "food"],
            "rating": 4.6,
            "user_ratings_total": 890,
        },
        "candidates": [
            {
                "place_id_suffix": "street_food",
                "name": "전주 길거리 간식존",
                "latitude": 35.8168,
                "longitude": 127.1541,
                "rating": 4.4,
                "user_ratings_total": 540,
            },
            {
                "place_id_suffix": "hanok_cafe",
                "name": "한옥 감성 찻집",
                "latitude": 35.8154,
                "longitude": 127.1563,
                "rating": 4.7,
                "user_ratings_total": 460,
            },
            {
                "place_id_suffix": "makgeolli",
                "name": "막걸리 골목",
                "latitude": 35.8181,
                "longitude": 127.1499,
                "rating": 4.5,
                "user_ratings_total": 610,
            },
        ],
        "base_seconds": 1020,
        "candidate_base_deltas": [120, -90, 210],
        "variants": [
            {"suffix": "lunch", "base_adjust": 0, "extra_candidate_deltas": [60, -30, 120]},
            {"suffix": "dinner", "base_adjust": 210, "extra_candidate_deltas": [150, 0, 60]},
            {"suffix": "rain", "base_adjust": 330, "extra_candidate_deltas": [90, 30, -150]},
            {"suffix": "festival", "base_adjust": 420, "extra_candidate_deltas": [210, 60, -180]},
            {"suffix": "late_night", "base_adjust": -120, "extra_candidate_deltas": [30, -120, -240]},
        ],
    },
]

def _build_alternative_cases() -> List[Dict[str, object]]:
    cases: List[Dict[str, object]] = []
    for base in _ALTERNATIVE_BASE_SCENARIOS:
        unavailable_id = f"{base['id_prefix']}_closed"
        base_unavailable = dict(base["unavailable"])
        base_unavailable["place_id"] = unavailable_id

        for variant_index, variant in enumerate(base["variants"], start=1):
            case_id = f"{base['id_prefix']}_{variant['suffix']}"
            base_duration = base["base_seconds"] + variant["base_adjust"]
            route_seconds = {"base": base_duration}
            candidate_list: List[Dict[str, object]] = []
            for idx, candidate in enumerate(base["candidates"]):
                candidate_delta = (
                    base["candidate_base_deltas"][idx]
                    + variant["extra_candidate_deltas"][idx]
                )
                candidate_id = f"{base['id_prefix']}_alt_{idx + 1}_{variant_index}"
                candidate_list.append(
                    {
                        "place_id": candidate_id,
                        "name": candidate["name"],
                        "latitude": candidate["latitude"],
                        "longitude": candidate["longitude"],
                        "rating": candidate["rating"],
                        "user_ratings_total": candidate["user_ratings_total"],
                    }
                )
                route_seconds[candidate_id] = base_duration + candidate_delta

            cases.append(
                {
                    "id": case_id,
                    "request": {
                        "previous_place_id": base["previous"],
                        "unavailable_place_id": unavailable_id,
                        "next_place_id": base["next"],
                        "travel_mode": base["travel_mode"],
                    },
                    "unavailable": base_unavailable,
                    "candidates": candidate_list,
                    "route_seconds": route_seconds,
                    "debug": {
                        "scenario": case_id,
                        "base_duration": base_duration,
                        "travel_mode": base["travel_mode"],
                    },
                }
            )
    assert len(cases) == 40
    return cases


ALTERNATIVE_CASES = _build_alternative_cases()


# ---------------------------------------------------------------------------
# 일정 재배치 시나리오 (40건 생성)
# ---------------------------------------------------------------------------
_REBALANCE_BASE_SCENARIOS = [
    {
        "id_prefix": "seoul_history",
        "places": [
            {
                "code": "alpha",
                "name": "경복궁",
                "google_place_id": "seoul_history_alpha",
                "activity_minutes": 90,
                "start_time": time(9, 0),
                "end_time": time(10, 30),
            },
            {
                "code": "beta",
                "name": "북촌한옥마을",
                "google_place_id": "seoul_history_beta",
                "activity_minutes": 60,
                "start_time": time(10, 40),
                "end_time": time(11, 40),
            },
            {
                "code": "gamma",
                "name": "광장시장",
                "google_place_id": "seoul_history_gamma",
                "activity_minutes": 75,
                "start_time": time(12, 0),
                "end_time": time(13, 15),
            },
        ],
        "variants": [
            {
                "suffix": "reverse_flow",
                "new_order": ["gamma", "alpha", "beta"],
                "route_pairs": [
                    (("gamma", "alpha"), 600),
                    (("alpha", "beta"), 900),
                ],
            },
            {
                "suffix": "evening_shift",
                "day_start_time": time(10, 0),
                "new_order": ["beta", "alpha", "gamma"],
                "route_pairs": [
                    (("beta", "alpha"), 420),
                    (("alpha", "gamma"), 780),
                ],
            },
            {
                "suffix": "market_first",
                "new_order": ["alpha", "gamma", "beta"],
                "route_pairs": [
                    (("alpha", "gamma"), 540),
                    (("gamma", "beta"), 600),
                ],
            },
            {
                "suffix": "tight_schedule",
                "new_order": ["beta", "gamma", "alpha"],
                "route_pairs": [
                    (("beta", "gamma"), 300),
                    (("gamma", "alpha"), 660),
                ],
            },
            {
                "suffix": "lazy_morning",
                "day_start_time": time(11, 0),
                "new_order": ["alpha", "beta", "gamma"],
                "route_pairs": [
                    (("alpha", "beta"), 360),
                    (("beta", "gamma"), 420),
                ],
            },
        ],
    },
    {
        "id_prefix": "busan_maritime",
        "places": [
            {
                "code": "pier",
                "name": "부산항 전망대",
                "google_place_id": "busan_maritime_pier",
                "activity_minutes": 45,
                "start_time": time(9, 30),
                "end_time": time(10, 15),
            },
            {
                "code": "museum",
                "name": "국립해양박물관",
                "google_place_id": "busan_maritime_museum",
                "activity_minutes": 70,
                "start_time": time(10, 30),
                "end_time": time(11, 40),
            },
            {
                "code": "bridge",
                "name": "영도대교 야경",
                "google_place_id": "busan_maritime_bridge",
                "activity_minutes": 60,
                "start_time": time(19, 0),
                "end_time": time(20, 0),
            },
            {
                "code": "market",
                "name": "자갈치 시장",
                "google_place_id": "busan_maritime_market",
                "activity_minutes": 80,
                "start_time": time(17, 0),
                "end_time": time(18, 20),
            },
        ],
        "variants": [
            {
                "suffix": "sunset_route",
                "new_order": ["pier", "museum", "market", "bridge"],
                "route_pairs": [
                    (("pier", "museum"), 420),
                    (("museum", "market"), 900),
                    (("market", "bridge"), 600),
                ],
            },
            {
                "suffix": "market_first",
                "new_order": ["market", "pier", "museum", "bridge"],
                "route_pairs": [
                    (("market", "pier"), 780),
                    (("pier", "museum"), 360),
                    (("museum", "bridge"), 840),
                ],
            },
            {
                "suffix": "night_focus",
                "day_start_time": time(14, 0),
                "new_order": ["museum", "market", "bridge", "pier"],
                "route_pairs": [
                    (("museum", "market"), 600),
                    (("market", "bridge"), 540),
                    (("bridge", "pier"), 900),
                ],
            },
            {
                "suffix": "harbor_loop",
                "new_order": ["pier", "bridge", "market", "museum"],
                "route_pairs": [
                    (("pier", "bridge"), 660),
                    (("bridge", "market"), 420),
                    (("market", "museum"), 720),
                ],
            },
            {
                "suffix": "compact",
                "new_order": ["museum", "pier", "market", "bridge"],
                "route_pairs": [
                    (("museum", "pier"), 300),
                    (("pier", "market"), 840),
                    (("market", "bridge"), 360),
                ],
            },
        ],
    },
    {
        "id_prefix": "jeju_nature",
        "places": [
            {
                "code": "sunrise",
                "name": "성산일출봉",
                "google_place_id": "jeju_nature_sunrise",
                "activity_minutes": 80,
                "start_time": time(5, 30),
                "end_time": time(6, 50),
            },
            {
                "code": "cafe",
                "name": "섭지코지 카페",
                "google_place_id": "jeju_nature_cafe",
                "activity_minutes": 50,
                "start_time": time(7, 10),
                "end_time": time(8, 0),
            },
            {
                "code": "trail",
                "name": "비자림 숲길",
                "google_place_id": "jeju_nature_trail",
                "activity_minutes": 90,
                "start_time": time(9, 0),
                "end_time": time(10, 30),
            },
        ],
        "variants": [
            {
                "suffix": "reverse",
                "new_order": ["trail", "cafe", "sunrise"],
                "route_pairs": [
                    (("trail", "cafe"), 720),
                    (("cafe", "sunrise"), 540),
                ],
            },
            {
                "suffix": "lazy_day",
                "day_start_time": time(8, 30),
                "new_order": ["cafe", "sunrise", "trail"],
                "route_pairs": [
                    (("cafe", "sunrise"), 480),
                    (("sunrise", "trail"), 780),
                ],
            },
            {
                "suffix": "original",
                "new_order": ["sunrise", "cafe", "trail"],
                "route_pairs": [
                    (("sunrise", "cafe"), 360),
                    (("cafe", "trail"), 600),
                ],
            },
            {
                "suffix": "cafe_last",
                "new_order": ["sunrise", "trail", "cafe"],
                "route_pairs": [
                    (("sunrise", "trail"), 840),
                    (("trail", "cafe"), 420),
                ],
            },
            {
                "suffix": "storm_plan",
                "new_order": ["cafe", "trail", "sunrise"],
                "route_pairs": [
                    (("cafe", "trail"), 900),
                    (("trail", "sunrise"), 540),
                ],
            },
        ],
    },
    {
        "id_prefix": "incheon_family",
        "places": [
            {
                "code": "aquarium",
                "name": "아쿠아플라넷 인천",
                "google_place_id": "incheon_family_aquarium",
                "activity_minutes": 100,
                "start_time": time(10, 0),
                "end_time": time(11, 40),
            },
            {
                "code": "park",
                "name": "송도센트럴파크",
                "google_place_id": "incheon_family_park",
                "activity_minutes": 80,
                "start_time": time(12, 0),
                "end_time": time(13, 20),
            },
            {
                "code": "mall",
                "name": "NC 큐브 커낼워크",
                "google_place_id": "incheon_family_mall",
                "activity_minutes": 90,
                "start_time": time(13, 40),
                "end_time": time(15, 10),
            },
            {
                "code": "observation",
                "name": "G타워 전망대",
                "google_place_id": "incheon_family_observation",
                "activity_minutes": 45,
                "start_time": time(15, 30),
                "end_time": time(16, 15),
            },
        ],
        "variants": [
            {
                "suffix": "park_first",
                "new_order": ["park", "aquarium", "mall", "observation"],
                "route_pairs": [
                    (("park", "aquarium"), 300),
                    (("aquarium", "mall"), 480),
                    (("mall", "observation"), 240),
                ],
            },
            {
                "suffix": "mall_last",
                "day_start_time": time(9, 30),
                "new_order": ["aquarium", "observation", "park", "mall"],
                "route_pairs": [
                    (("aquarium", "observation"), 420),
                    (("observation", "park"), 360),
                    (("park", "mall"), 240),
                ],
            },
            {
                "suffix": "shopping_focus",
                "new_order": ["mall", "aquarium", "park", "observation"],
                "route_pairs": [
                    (("mall", "aquarium"), 450),
                    (("aquarium", "park"), 300),
                    (("park", "observation"), 360),
                ],
            },
            {
                "suffix": "evening_view",
                "new_order": ["observation", "mall", "park", "aquarium"],
                "route_pairs": [
                    (("observation", "mall"), 210),
                    (("mall", "park"), 270),
                    (("park", "aquarium"), 390),
                ],
            },
            {
                "suffix": "aquarium_first",
                "new_order": ["aquarium", "park", "mall", "observation"],
                "route_pairs": [
                    (("aquarium", "park"), 330),
                    (("park", "mall"), 180),
                    (("mall", "observation"), 300),
                ],
            },
        ],
    },
    {
        "id_prefix": "daegu_history",
        "places": [
            {
                "code": "cathedral",
                "name": "계산성당",
                "google_place_id": "daegu_history_cathedral",
                "activity_minutes": 40,
                "start_time": time(9, 0),
                "end_time": time(9, 40),
            },
            {
                "code": "market",
                "name": "서문시장",
                "google_place_id": "daegu_history_market",
                "activity_minutes": 90,
                "start_time": time(10, 0),
                "end_time": time(11, 30),
            },
            {
                "code": "alley",
                "name": "근대골목",
                "google_place_id": "daegu_history_alley",
                "activity_minutes": 60,
                "start_time": time(12, 0),
                "end_time": time(13, 0),
            },
        ],
        "variants": [
            {
                "suffix": "market_first",
                "new_order": ["market", "cathedral", "alley"],
                "route_pairs": [
                    (("market", "cathedral"), 480),
                    (("cathedral", "alley"), 360),
                ],
            },
            {
                "suffix": "alley_first",
                "new_order": ["alley", "market", "cathedral"],
                "route_pairs": [
                    (("alley", "market"), 540),
                    (("market", "cathedral"), 420),
                ],
            },
            {
                "suffix": "morning_church",
                "day_start_time": time(8, 30),
                "new_order": ["cathedral", "alley", "market"],
                "route_pairs": [
                    (("cathedral", "alley"), 300),
                    (("alley", "market"), 480),
                ],
            },
            {
                "suffix": "evening_market",
                "new_order": ["cathedral", "market", "alley"],
                "route_pairs": [
                    (("cathedral", "market"), 360),
                    (("market", "alley"), 420),
                ],
            },
            {
                "suffix": "night_walk",
                "new_order": ["alley", "cathedral", "market"],
                "route_pairs": [
                    (("alley", "cathedral"), 600),
                    (("cathedral", "market"), 330),
                ],
            },
        ],
    },
    {
        "id_prefix": "gwangju_artday",
        "places": [
            {
                "code": "culture_center",
                "name": "국립아시아문화전당",
                "google_place_id": "gwangju_artday_culture_center",
                "activity_minutes": 120,
                "start_time": time(10, 0),
                "end_time": time(12, 0),
            },
            {
                "code": "street",
                "name": "충장로 문화의 거리",
                "google_place_id": "gwangju_artday_street",
                "activity_minutes": 70,
                "start_time": time(12, 30),
                "end_time": time(13, 40),
            },
            {
                "code": "village",
                "name": "양림동 펭귄마을",
                "google_place_id": "gwangju_artday_village",
                "activity_minutes": 80,
                "start_time": time(14, 0),
                "end_time": time(15, 20),
            },
            {
                "code": "museum",
                "name": "광주시립미술관",
                "google_place_id": "gwangju_artday_museum",
                "activity_minutes": 90,
                "start_time": time(16, 0),
                "end_time": time(17, 30),
            },
        ],
        "variants": [
            {
                "suffix": "museum_first",
                "new_order": ["museum", "culture_center", "street", "village"],
                "route_pairs": [
                    (("museum", "culture_center"), 540),
                    (("culture_center", "street"), 240),
                    (("street", "village"), 300),
                ],
            },
            {
                "suffix": "street_first",
                "new_order": ["street", "village", "culture_center", "museum"],
                "route_pairs": [
                    (("street", "village"), 210),
                    (("village", "culture_center"), 270),
                    (("culture_center", "museum"), 540),
                ],
            },
            {
                "suffix": "culture_first",
                "day_start_time": time(9, 30),
                "new_order": ["culture_center", "museum", "village", "street"],
                "route_pairs": [
                    (("culture_center", "museum"), 480),
                    (("museum", "village"), 330),
                    (("village", "street"), 180),
                ],
            },
            {
                "suffix": "village_last",
                "new_order": ["culture_center", "street", "museum", "village"],
                "route_pairs": [
                    (("culture_center", "street"), 210),
                    (("street", "museum"), 300),
                    (("museum", "village"), 360),
                ],
            },
            {
                "suffix": "compact",
                "new_order": ["street", "culture_center", "museum", "village"],
                "route_pairs": [
                    (("street", "culture_center"), 180),
                    (("culture_center", "museum"), 420),
                    (("museum", "village"), 300),
                ],
            },
        ],
    },
    {
        "id_prefix": "jeonju_culture",
        "places": [
            {
                "code": "gallery",
                "name": "전주미술관",
                "google_place_id": "jeonju_culture_gallery",
                "activity_minutes": 60,
                "start_time": time(9, 30),
                "end_time": time(10, 30),
            },
            {
                "code": "hanok",
                "name": "전주한옥마을",
                "google_place_id": "jeonju_culture_hanok",
                "activity_minutes": 90,
                "start_time": time(11, 0),
                "end_time": time(12, 30),
            },
            {
                "code": "bibimbap",
                "name": "비빔밥 체험관",
                "google_place_id": "jeonju_culture_bibimbap",
                "activity_minutes": 60,
                "start_time": time(13, 0),
                "end_time": time(14, 0),
            },
            {
                "code": "market",
                "name": "남부시장 야시장",
                "google_place_id": "jeonju_culture_market",
                "activity_minutes": 120,
                "start_time": time(18, 0),
                "end_time": time(20, 0),
            },
        ],
        "variants": [
            {
                "suffix": "hanok_first",
                "new_order": ["hanok", "gallery", "bibimbap", "market"],
                "route_pairs": [
                    (("hanok", "gallery"), 420),
                    (("gallery", "bibimbap"), 360),
                    (("bibimbap", "market"), 900),
                ],
            },
            {
                "suffix": "gallery_start",
                "new_order": ["gallery", "bibimbap", "hanok", "market"],
                "route_pairs": [
                    (("gallery", "bibimbap"), 300),
                    (("bibimbap", "hanok"), 480),
                    (("hanok", "market"), 840),
                ],
            },
            {
                "suffix": "evening_focus",
                "day_start_time": time(13, 0),
                "new_order": ["bibimbap", "hanok", "market", "gallery"],
                "route_pairs": [
                    (("bibimbap", "hanok"), 420),
                    (("hanok", "market"), 780),
                    (("market", "gallery"), 960),
                ],
            },
            {
                "suffix": "market_first",
                "new_order": ["market", "hanok", "gallery", "bibimbap"],
                "route_pairs": [
                    (("market", "hanok"), 720),
                    (("hanok", "gallery"), 360),
                    (("gallery", "bibimbap"), 300),
                ],
            },
            {
                "suffix": "relaxed",
                "new_order": ["gallery", "hanok", "market", "bibimbap"],
                "route_pairs": [
                    (("gallery", "hanok"), 420),
                    (("hanok", "market"), 780),
                    (("market", "bibimbap"), 600),
                ],
            },
        ],
    },
    {
        "id_prefix": "gangneung_coastday",
        "places": [
            {
                "code": "coffee",
                "name": "안목해변 카페거리",
                "google_place_id": "gangneung_coastday_coffee",
                "activity_minutes": 45,
                "start_time": time(9, 0),
                "end_time": time(9, 45),
            },
            {
                "code": "lake",
                "name": "경포호 산책",
                "google_place_id": "gangneung_coastday_lake",
                "activity_minutes": 70,
                "start_time": time(10, 0),
                "end_time": time(11, 10),
            },
            {
                "code": "museum",
                "name": "오죽헌",
                "google_place_id": "gangneung_coastday_museum",
                "activity_minutes": 80,
                "start_time": time(11, 40),
                "end_time": time(13, 0),
            },
            {
                "code": "sunset",
                "name": "정동진 일출전망대",
                "google_place_id": "gangneung_coastday_sunset",
                "activity_minutes": 90,
                "start_time": time(16, 30),
                "end_time": time(18, 0),
            },
        ],
        "variants": [
            {
                "suffix": "sunset_last",
                "new_order": ["coffee", "lake", "museum", "sunset"],
                "route_pairs": [
                    (("coffee", "lake"), 420),
                    (("lake", "museum"), 600),
                    (("museum", "sunset"), 1500),
                ],
            },
            {
                "suffix": "lake_first",
                "new_order": ["lake", "coffee", "museum", "sunset"],
                "route_pairs": [
                    (("lake", "coffee"), 300),
                    (("coffee", "museum"), 720),
                    (("museum", "sunset"), 1500),
                ],
            },
            {
                "suffix": "museum_focus",
                "day_start_time": time(11, 0),
                "new_order": ["museum", "coffee", "lake", "sunset"],
                "route_pairs": [
                    (("museum", "coffee"), 780),
                    (("coffee", "lake"), 420),
                    (("lake", "sunset"), 1320),
                ],
            },
            {
                "suffix": "sunrise_option",
                "day_start_time": time(6, 0),
                "new_order": ["sunset", "coffee", "lake", "museum"],
                "route_pairs": [
                    (("sunset", "coffee"), 1200),
                    (("coffee", "lake"), 420),
                    (("lake", "museum"), 600),
                ],
            },
            {
                "suffix": "compact_day",
                "new_order": ["coffee", "museum", "lake", "sunset"],
                "route_pairs": [
                    (("coffee", "museum"), 660),
                    (("museum", "lake"), 540),
                    (("lake", "sunset"), 1380),
                ],
            },
        ],
    },
]

def _format_duration_text(seconds: int) -> str:
    """ViewSet과 동일한 규칙으로 이동 시간을 문자열로 변환합니다."""

    if seconds <= 0:
        return "0분"
    minutes, _ = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    if hours and minutes:
        return f"{hours}시간 {minutes}분"
    if hours:
        return f"{hours}시간"
    return f"{minutes}분"


def _simulate_rebalance(
    places: List[Dict[str, object]],
    new_order_codes: List[str],
    route_seconds: Dict[Tuple[str, str], int],
    explicit_start: Optional[time],
) -> Tuple[Dict[str, Dict[str, object]], List[Dict[str, object]]]:
    """ViewSet 로직과 동일한 규칙으로 재배치 결과를 예측합니다."""

    code_map = {item["code"]: item for item in places}
    if explicit_start:
        start_clock = explicit_start
    else:
        start_clock = min(item["start_time"] for item in places)

    current_dt = datetime.combine(date.today(), start_clock)
    expected_schedules: Dict[str, Dict[str, object]] = {}
    segments: List[Dict[str, object]] = []

    for index, code in enumerate(new_order_codes):
        place_info = code_map[code]
        activity_minutes = place_info["activity_minutes"]
        start_time = current_dt.time()
        end_dt = current_dt + timedelta(minutes=activity_minutes)
        end_time = end_dt.time()

        expected_schedules[code] = {
            "order": index + 1,
            "start_time": start_time.strftime("%H:%M:%S"),
            "end_time": end_time.strftime("%H:%M:%S"),
            "duration_minutes": activity_minutes,
        }

        if index < len(new_order_codes) - 1:
            next_code = new_order_codes[index + 1]
            origin_id = code_map[code]["google_place_id"]
            destination_id = code_map[next_code]["google_place_id"]
            leg_seconds = route_seconds.get((origin_id, destination_id), 0)
            segments.append(
                {
                    "from_code": code,
                    "to_code": next_code,
                    "duration_seconds": leg_seconds,
                    "duration_text": _format_duration_text(leg_seconds),
                }
            )
            current_dt = end_dt + timedelta(seconds=leg_seconds)
        else:
            current_dt = end_dt

    return expected_schedules, segments


def _build_rebalance_scenarios() -> List[Dict[str, object]]:
    scenarios: List[Dict[str, object]] = []
    for base in _REBALANCE_BASE_SCENARIOS:
        places = [dict(item) for item in base["places"]]
        code_to_place_id = {item["code"]: item["google_place_id"] for item in places}

        for variant in base["variants"]:
            route_seconds: Dict[Tuple[str, str], int] = {}
            for (origin_code, dest_code), seconds in variant["route_pairs"]:
                route_seconds[(code_to_place_id[origin_code], code_to_place_id[dest_code])] = seconds

            expected_schedules, segments = _simulate_rebalance(
                places,
                variant["new_order"],
                route_seconds,
                variant.get("day_start_time"),
            )

            start_reference = variant.get("day_start_time") or min(p["start_time"] for p in places)

            scenarios.append(
                {
                    "id": f"{base['id_prefix']}_{variant['suffix']}",
                    "places": places,
                    "new_order_codes": variant["new_order"],
                    "route_seconds": route_seconds,
                    "expected": {
                        "schedules": expected_schedules,
                        "segments": segments,
                    },
                    "day_start_time": variant.get("day_start_time"),
                    "debug": {
                        "scenario": base["id_prefix"],
                        "variant": variant["suffix"],
                        "start_time": start_reference.strftime("%H:%M"),
                        "order": variant["new_order"],
                    },
                }
            )
    assert len(scenarios) == 40
    return scenarios


REBALANCE_SCENARIOS = _build_rebalance_scenarios()


@pytest.fixture
def api_client(manager_user):
    """승인된 담당자 계정을 인증한 APIClient를 제공합니다."""

    client = APIClient()
    client.force_authenticate(user=manager_user)
    return client


# ---------------------------------------------------------------------------
# 테스트 본문
# ---------------------------------------------------------------------------
@pytest.mark.django_db
@pytest.mark.parametrize("case", FIXED_REQUEST_CASES, ids=lambda c: c["id"])
def test_fixed_top_recommendations(case, api_client, monkeypatch):
    """고정 5카테고리 추천이 20건의 현실적 시나리오에서 기대값을 반환하는지 확인합니다."""

    debug_header = f"[고정추천::{case['id']}]"
    geocode_calls: List[str] = []
    expected_geocode = case.get("geocode_result")

    def fake_geocode(address: str) -> GeocodeResult:
        geocode_calls.append(address)
        if expected_geocode is None:
            pytest.fail(f"{debug_header} 주소 입력이 아닌데 geocode가 호출되었습니다.")
        return GeocodeResult(**expected_geocode)

    monkeypatch.setattr("schedules.views.geocode_address", fake_geocode)

    fetch_calls: List[Dict[str, object]] = []
    poi_samples = case["poi_samples"]

    def fake_fetch_nearby_places(latitude, longitude, place_type, radius):
        fetch_calls.append(
            {
                "place_type": place_type,
                "latitude": round(latitude, 6),
                "longitude": round(longitude, 6),
                "radius": radius,
            }
        )
        results: List[GooglePlace] = []
        for sample in poi_samples:
            raw_photos = []
            if sample["photo_reference"]:
                raw_photos.append({"photo_reference": sample["photo_reference"]})
            results.append(
                GooglePlace(
                    place_id=f"{place_type}_{sample['place_id_suffix']}",
                    name=sample["name"],
                    latitude=sample["latitude"],
                    longitude=sample["longitude"],
                    types=[place_type] + sample["types"],
                    rating=sample["rating"],
                    user_ratings_total=sample["user_ratings_total"],
                    raw={"photos": raw_photos},
                )
            )
        return results

    monkeypatch.setattr("schedules.views.fetch_nearby_places", fake_fetch_nearby_places)

    url = reverse("place-recommendation-fixed-top")
    response = api_client.post(url, case["payload"], format="json")

    assert response.status_code == 200, f"{debug_header} 응답 코드가 200이 아닙니다: {response.status_code}"
    payload = response.json()

    assert len(payload["categories"]) == len(FIXED_RECOMMENDATION_PLACE_TYPES), (
        f"{debug_header} 카테고리 수가 예상과 다릅니다."
    )
    assert len(fetch_calls) == len(FIXED_RECOMMENDATION_PLACE_TYPES), (
        f"{debug_header} Nearby Search 호출 횟수가 부족합니다: {fetch_calls}"
    )

    first_category = payload["categories"][0]
    first_place = first_category["places"][0]
    assert first_place["name"].split(" - ")[0] == poi_samples[0]["name"].split(" - ")[0], (
        f"{debug_header} 첫 장소명이 샘플 데이터와 다릅니다: {first_place['name']}"
    )
    assert Place.objects.filter(google_place_id=first_place["place_id"]).exists(), (
        f"{debug_header} 추천 결과가 DB에 저장되지 않았습니다."
    )

    if case["expect_geocode"]:
        assert geocode_calls == [case["payload"]["address"]], (
            f"{debug_header} 지오코딩 호출 기록이 예상과 다릅니다: {geocode_calls}"
        )
        assert payload["base_location"]["resolved_address"], (
            f"{debug_header} 지오코딩 주소가 응답에 포함되어야 합니다."
        )
    else:
        assert geocode_calls == [], f"{debug_header} 위경도 입력인데 geocode가 호출되었습니다."
        assert payload["base_location"]["latitude"] == pytest.approx(case["payload"]["latitude"])
        assert payload["base_location"]["longitude"] == pytest.approx(case["payload"]["longitude"])


@pytest.mark.django_db
@pytest.mark.parametrize("case", ALTERNATIVE_CASES, ids=lambda c: c["id"])
def test_alternative_recommendations(case, api_client, monkeypatch):
    """ΔETA 기준 정렬과 후보 저장이 40가지 실제 시나리오에서 일관된지 확인합니다."""

    debug_header = f"[대체추천::{case['id']}]"

    def fake_fetch_place_details(place_id: str) -> GooglePlace:
        unavailable = case["unavailable"]
        return GooglePlace(
            place_id=place_id,
            name=unavailable["name"],
            latitude=unavailable["latitude"],
            longitude=unavailable["longitude"],
            types=unavailable["types"],
            rating=unavailable["rating"],
            user_ratings_total=unavailable["user_ratings_total"],
            raw={},
        )

    monkeypatch.setattr("schedules.views.fetch_place_details", fake_fetch_place_details)

    candidates = case["candidates"]

    def fake_fetch_nearby_places(latitude, longitude, place_type, radius):
        nearby = [
            GooglePlace(
                place_id=case["request"]["unavailable_place_id"],
                name="중복 장소",
                latitude=latitude,
                longitude=longitude,
                types=[place_type, "point_of_interest"],
                rating=4.0,
                user_ratings_total=500,
                raw={},
            )
        ]
        for candidate in candidates:
            nearby.append(
                GooglePlace(
                    place_id=candidate["place_id"],
                    name=candidate["name"],
                    latitude=candidate["latitude"],
                    longitude=candidate["longitude"],
                    types=[place_type, "point_of_interest"],
                    rating=candidate["rating"],
                    user_ratings_total=candidate["user_ratings_total"],
                    raw={},
                )
            )
        return nearby

    monkeypatch.setattr("schedules.views.fetch_nearby_places", fake_fetch_nearby_places)

    route_seconds = case["route_seconds"]

    def fake_compute_route_duration(origin, destination, intermediates=None, travel_mode=None):
        if intermediates:
            place_id = intermediates[0].get("placeId")
            if place_id == case["request"]["unavailable_place_id"]:
                seconds = route_seconds["base"]
            else:
                seconds = route_seconds[place_id]
        else:
            seconds = 0
        return RouteDuration(seconds=seconds, distance_meters=1000, raw={"seconds": seconds})

    monkeypatch.setattr("schedules.views.compute_route_duration", fake_compute_route_duration)

    url = reverse("place-recommendation-alternatives")
    response = api_client.post(url, case["request"], format="json")

    assert response.status_code == 200, f"{debug_header} 응답 코드가 200이 아닙니다: {response.status_code}"
    payload = response.json()

    base_duration = route_seconds["base"]
    expected_order = sorted(
        [key for key in route_seconds.keys() if key != "base"],
        key=lambda pid: route_seconds[pid] - base_duration,
    )

    assert payload["base_route"]["original_duration_seconds"] == base_duration, (
        f"{debug_header} 기본 경로 시간이 예상과 다릅니다."
    )

    alternatives = payload["alternatives"]
    returned_ids = [item["place"]["place_id"] for item in alternatives]
    assert returned_ids == expected_order, (
        f"{debug_header} ΔETA 정렬 순서가 잘못되었습니다. 기대: {expected_order}, 실제: {returned_ids}"
    )

    for item in alternatives:
        candidate_id = item["place"]["place_id"]
        delta = route_seconds[candidate_id] - base_duration
        assert item["delta_seconds"] == delta, (
            f"{debug_header} ΔETA 값이 일치하지 않습니다: {candidate_id}"
        )
        if delta == 0:
            assert item["delta_text"] in {"0분", "±0분"}, (
                f"{debug_header} ΔETA 텍스트가 0분 표현 규칙과 다릅니다: {item['delta_text']}"
            )
        else:
            expected_sign = "+" if delta > 0 else "-"
            assert item["delta_text"].startswith(expected_sign), (
                f"{debug_header} ΔETA 텍스트 부호가 맞지 않습니다: {item['delta_text']}"
            )
        assert Place.objects.filter(google_place_id=candidate_id).exists(), (
            f"{debug_header} 후보 {candidate_id} 가 DB에 저장되지 않았습니다."
        )


@pytest.mark.django_db
@pytest.mark.parametrize("scenario", REBALANCE_SCENARIOS, ids=lambda c: c["id"])
def test_rebalance_day_updates_schedule_times(scenario, api_client, trip_factory, place_category, monkeypatch):
    """40건의 일정 재배치 시나리오에서 시작/종료 시각과 이동 요약이 일관된지 확인합니다."""

    debug_header = f"[재배치::{scenario['id']}]"
    trip = trip_factory(destination="대한민국", title="재배치 테스트")

    place_map: Dict[str, Place] = {}
    schedule_map: Dict[str, Schedule] = {}
    for index, place_info in enumerate(scenario["places"], start=1):
        place = Place.objects.create(
            name=place_info["name"],
            category=place_category,
            google_place_id=place_info["google_place_id"],
            activity_time=timedelta(minutes=place_info["activity_minutes"]),
        )
        place_map[place_info["code"]] = place

        schedule = Schedule.objects.create(
            trip=trip,
            day_number=1,
            order=index * 10,
            place=place,
            start_time=place_info["start_time"],
            end_time=place_info["end_time"],
        )
        schedule_map[place_info["code"]] = schedule

    def fake_compute_route_duration(origin, destination, intermediates=None, travel_mode=None):
        origin_id = origin.get("placeId")
        destination_id = destination.get("placeId")
        seconds = scenario["route_seconds"].get((origin_id, destination_id), 0)
        return RouteDuration(seconds=seconds, distance_meters=4000, raw={"origin": origin_id, "dest": destination_id})

    monkeypatch.setattr("schedules.views.compute_route_duration", fake_compute_route_duration)

    new_order_ids = [schedule_map[code].id for code in scenario["new_order_codes"]]
    url = reverse("trip-schedule-rebalance-day", kwargs={"trip_pk": trip.id})
    payload = {
        "day_number": 1,
        "schedule_ids": new_order_ids,
        "travel_mode": "DRIVE",
    }
    if scenario.get("day_start_time"):
        payload["day_start_time"] = scenario["day_start_time"].strftime("%H:%M:%S")

    response = api_client.post(url, payload, format="json")

    assert response.status_code == 200, f"{debug_header} 응답 코드가 200이 아닙니다: {response.status_code}"
    payload = response.json()

    returned_orders = [item["order"] for item in payload["schedules"]]
    assert returned_orders == list(range(1, len(new_order_ids) + 1)), (
        f"{debug_header} 일정 order 값이 1부터 순차적으로 부여되지 않았습니다."
    )

    expected = scenario["expected"]
    for schedule_data in payload["schedules"]:
        code = next(code for code, schedule in schedule_map.items() if schedule.id == schedule_data["id"])
        expected_schedule = expected["schedules"][code]
        assert schedule_data["start_time"] == expected_schedule["start_time"], (
            f"{debug_header} 시작 시간이 다릅니다: {code}"
        )
        assert schedule_data["end_time"] == expected_schedule["end_time"], (
            f"{debug_header} 종료 시간이 다릅니다: {code}"
        )
        db_schedule = Schedule.objects.get(id=schedule_data["id"])
        assert db_schedule.duration_minutes == expected_schedule["duration_minutes"], (
            f"{debug_header} duration_minutes가 기대값과 다릅니다: {code}"
        )

    travel_segments = payload["travel_segments"]
    assert len(travel_segments) == len(expected["segments"]), (
        f"{debug_header} 이동 구간 개수가 다릅니다."
    )
    for actual_segment, expected_segment in zip(travel_segments, expected["segments"]):
        assert actual_segment["duration_seconds"] == expected_segment["duration_seconds"], (
            f"{debug_header} 이동 시간 초 단위가 다릅니다: {actual_segment}"
        )
        assert actual_segment["duration_text"] == expected_segment["duration_text"], (
            f"{debug_header} 이동 시간 텍스트가 다릅니다: {actual_segment}"
        )
