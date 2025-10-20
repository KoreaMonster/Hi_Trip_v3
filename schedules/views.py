"""Schedules 앱의 REST API 구현.

함수형 뷰(FBV)를 모두 DRF ViewSet으로 치환하여
권한/검증/라우팅을 클래스 기반 패턴으로 일관되게 정리했습니다.
각 클래스/메서드에 한국어 주석을 충분히 추가해 초보 개발자도 흐름을 따라올 수 있도록 배려합니다.
"""
import logging
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, extend_schema_view

from trips.models import Trip
from users.permissions import IsApprovedStaff

from .models import (
    CoordinatorRole,
    OptionalExpense,
    Place,
    PlaceCategory,
    PlaceCoordinator,
    Schedule,
)
from .permissions import IsTripCoordinator
from .serializers import (
    AlternativePlaceRequestSerializer,
    CoordinatorRoleSerializer,
    ExpenseSelectionSerializer,
    FixedRecommendationRequestSerializer,
    OptionalExpenseSerializer,
    PlaceCategorySerializer,
    PlaceCoordinatorSerializer,
    PlaceSerializer,
    ScheduleSerializer,
    ScheduleRebalanceRequestSerializer,
)
from .constants import FIXED_RECOMMENDATION_PLACE_TYPES
from .services import (
    GoogleMapsError,
    GooglePlace,
    build_location_payload,
    build_place_id_payload,
    compute_route_duration,
    fetch_nearby_places,
    fetch_place_details,
    geocode_address,
)
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiTypes,
    extend_schema,
    extend_schema_view,
)

logger = logging.getLogger(__name__)

PLACE_PK_PARAMETER = OpenApiParameter(
    name="place_pk",
    type=OpenApiTypes.INT,
    location=OpenApiParameter.PATH,
    description="상위 장소의 ID (정수).",
)
# ============================================================================
# 공통 믹스인: Nested Router에서 전달된 PK를 안전하게 조회
# ============================================================================
class TripLookupMixin:
    """`/trips/<trip_pk>/...` 형태의 URL에서 Trip 객체를 꺼내는 도우미.

    ViewSet마다 동일한 로직을 반복하지 않기 위해 별도 믹스인으로 분리했습니다.
    """

    trip_lookup_url_kwarg = "trip_pk"
    _cached_trip = None

    def get_trip(self) -> Trip:
        """URL로 전달된 trip_pk를 이용해 Trip을 한번만 조회합니다."""

        if self._cached_trip is None:
            trip_pk = self.kwargs.get(self.trip_lookup_url_kwarg)
            self._cached_trip = get_object_or_404(
                Trip.objects.select_related("manager"), pk=trip_pk
            )
        return self._cached_trip

class PlaceLookupMixin:
    """`/places/<place_pk>/...` 경로에서 Place 객체를 조회하는 믹스인."""

    place_lookup_url_kwarg = "place_pk"
    _cached_place = None

    def get_place(self) -> Place:
        if self._cached_place is None:
            place_pk = self.kwargs.get(self.place_lookup_url_kwarg)
            self._cached_place = get_object_or_404(
                Place.objects.select_related("category"), pk=place_pk
            )
        return self._cached_place


# ============================================================================
# Schedule ViewSet: 여행별 일정 CRUD + 권한 관리
# ============================================================================
@extend_schema_view(
    list=extend_schema(summary="특정 여행의 일정 목록 조회"),
    create=extend_schema(summary="특정 여행에 새 일정을 추가"),
    retrieve=extend_schema(summary="단일 일정 상세 조회"),
    update=extend_schema(summary="일정 전체 수정"),
    partial_update=extend_schema(summary="일정 부분 수정"),
    destroy=extend_schema(summary="일정 삭제"),
)
class ScheduleViewSet(TripLookupMixin, viewsets.ModelViewSet):
    """Trip 하위의 Schedule을 담당하는 ViewSet.

    - 권한: 로그인한 승인 직원 + 해당 여행 담당자만 접근 가능하도록 `IsTripCoordinator` 적용.
    - 검증: Serializer가 `unique_together` 및 `clean()`을 책임지므로 ViewSet은 HTTP 흐름에 집중합니다.
    - URL 구조: `/trips/<trip_pk>/schedules/` (Nested Router가 자동 생성)
    """

    DEFAULT_DAY_START = time(9, 0)
    DEFAULT_VISIT_MINUTES = 30

    serializer_class = ScheduleSerializer
    permission_classes = [IsAuthenticated, IsApprovedStaff, IsTripCoordinator]

    def get_queryset(self):
        trip_pk = self.kwargs.get(self.trip_lookup_url_kwarg)
        return (
            Schedule.objects.select_related("trip", "trip__manager", "place")
            .filter(trip_id=trip_pk)
            .order_by("day_number", "order", "start_time")
        )


    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["trip"] = self.get_trip()
        return context

    # ---- CRUD hook -----------------------------------------------------
    def perform_create(self, serializer):
        """create() 직전에 호출되어 trip FK를 강제로 주입합니다."""

        serializer.save(trip=self.get_trip())

    def perform_update(self, serializer):
        """update() 시에도 trip 변경을 차단하기 위해 동일한 트립을 주입합니다."""

        serializer.save(trip=self.get_trip())

    # ---- Custom Actions -------------------------------------------------
    @extend_schema(
        summary="하루 일정 자동 시간 재배치",
        request=ScheduleRebalanceRequestSerializer,
        responses={200: ScheduleSerializer(many=True)},
    )
    @action(detail=False, methods=["post"], url_path="rebalance-day")
    def rebalance_day(self, request, *args, **kwargs):
        """Drag&Drop 이후 하루 일정을 자동으로 다시 배치합니다.

        1. 요청으로 전달된 Schedule ID 순서를 신뢰하여 `order` 값을 새로 지정합니다.
        2. 각 일정의 체류 시간(Place.activity_time → 기존 duration → 기본값)을 기준으로
           `start_time`과 `end_time`을 다시 계산합니다.
        3. 인접한 일정 사이의 이동 시간은 Google Routes API로 계산하되,
           좌표/Place ID가 없는 경우에는 0분으로 간주합니다.
        4. 모든 계산이 끝나면 최신 Schedule 목록과 이동 요약 정보를 반환합니다.
        """

        serializer = ScheduleRebalanceRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        params = serializer.validated_data

        trip = self.get_trip()
        day_number = params["day_number"]
        schedule_ids = params["schedule_ids"]

        # ---- 1) 대상 일정 조회 및 유효성 검증 ---------------------------------
        day_schedules = list(
            self.get_queryset()
            .select_related("place", "place__category")
            .filter(day_number=day_number)
        )

        if not day_schedules:
            return Response(
                {
                    "detail": "해당 일차에 등록된 일정이 없습니다.",
                    "day_number": day_number,
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if len(day_schedules) != len(schedule_ids):
            return Response(
                {
                    "detail": "schedule_ids에는 해당 일차의 모든 일정을 포함해야 합니다.",
                    "provided": schedule_ids,
                    "expected_ids": [schedule.id for schedule in day_schedules],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        schedule_map = {schedule.id: schedule for schedule in day_schedules}
        try:
            ordered_schedules = [schedule_map[schedule_id] for schedule_id in schedule_ids]
        except KeyError as missing_id:
            return Response(
                {
                    "detail": "요청에 포함된 일정이 존재하지 않습니다.",
                    "missing_schedule_id": missing_id.args[0],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---- 2) 하루 시작 기준 시각 계산 --------------------------------------
        start_time = params.get("day_start_time")
        resolved_start_time = self._resolve_day_start_time(day_schedules, start_time)
        base_datetime = datetime.combine(timezone.localdate(), resolved_start_time)

        # ---- 3) 이동 시간(ΔT) 사전 계산 ----------------------------------------
        travel_mode = params["travel_mode"]
        travel_seconds = self._calculate_travel_seconds(ordered_schedules, travel_mode)

        # ---- 4) 실제 일정 업데이트 ---------------------------------------------
        updated_schedules = []
        travel_segments = []
        current_datetime = base_datetime

        with transaction.atomic():
            for index, schedule in enumerate(ordered_schedules):
                visit_minutes = self._get_visit_minutes(schedule)
                visit_delta = timedelta(minutes=visit_minutes)

                schedule.order = index + 1
                schedule.start_time = current_datetime.time()
                schedule.end_time = (current_datetime + visit_delta).time()
                schedule.save(
                    update_fields=[
                        "order",
                        "start_time",
                        "end_time",
                        # duration_minutes를 포함해야 Schedule.save()에서 계산한 값이 DB에 반영됩니다.
                        "duration_minutes",
                        "updated_at",
                    ]
                )
                schedule.refresh_from_db(fields=["duration_minutes", "start_time", "end_time"])

                updated_schedules.append(schedule)

                # 다음 일정 이동 시간을 위해 현재 시각을 갱신합니다.
                if index < len(travel_seconds):
                    leg_seconds = travel_seconds[index]
                    travel_segments.append(
                        {
                            "from_schedule_id": schedule.id,
                            "to_schedule_id": ordered_schedules[index + 1].id,
                            "duration_seconds": leg_seconds,
                            "duration_text": self._format_duration_text(leg_seconds),
                        }
                    )
                    current_datetime = (
                            current_datetime
                            + visit_delta
                            + timedelta(seconds=leg_seconds)
                    )
                else:
                    current_datetime = current_datetime + visit_delta

        response_serializer = ScheduleSerializer(
            updated_schedules,
            many=True,
            context=self.get_serializer_context(),
        )

        return Response(
            {
                "trip_id": trip.id,
                "day_number": day_number,
                "travel_mode": travel_mode,
                "resolved_day_start": resolved_start_time.strftime("%H:%M"),
                "rebalanced_at": timezone.now().isoformat(),
                "travel_segments": travel_segments,
                "schedules": response_serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    # ------------------------------------------------------------------
    # Helper methods for schedule rebalance
    # ------------------------------------------------------------------
    def _resolve_day_start_time(self, schedules, explicit_time):
        """하루 시작 시각을 결정합니다.

        - 사용자가 직접 지정한 시간이 있다면 이를 우선합니다.
        - 그렇지 않다면 해당 일차의 가장 이른 start_time을 사용합니다.
        - 모든 일정에 시간이 비어 있다면 오전 9시(기본값)를 적용합니다.
        """

        if explicit_time:
            return explicit_time

        existing_times = [schedule.start_time for schedule in schedules if schedule.start_time]
        if existing_times:
            return min(existing_times)

        return self.DEFAULT_DAY_START

    def _get_visit_minutes(self, schedule: Schedule) -> int:
        """각 일정의 체류 시간(분)을 계산합니다."""

        place = schedule.place
        if place and place.activity_time:
            total_seconds = int(place.activity_time.total_seconds())
            minutes = max(total_seconds // 60, self.DEFAULT_VISIT_MINUTES)
            return minutes

        if schedule.duration_minutes:
            return max(schedule.duration_minutes, self.DEFAULT_VISIT_MINUTES)

        return self.DEFAULT_VISIT_MINUTES

    def _calculate_travel_seconds(self, schedules, travel_mode):
        """인접한 일정 간 이동 시간을 초 단위로 반환합니다."""

        travel_seconds = []

        for current, nxt in zip(schedules, schedules[1:]):
            origin = self._build_route_waypoint(current)
            destination = self._build_route_waypoint(nxt)

            if not origin or not destination:
                # 좌표/Place ID가 없는 경우에는 이동 시간을 계산할 수 없어 0초로 간주합니다.
                travel_seconds.append(0)
                continue

            try:
                route = compute_route_duration(
                    origin=origin,
                    destination=destination,
                    travel_mode=travel_mode,
                )
            except GoogleMapsError as exc:
                logger.warning(
                    "Routes API 호출 실패로 이동 시간을 0초로 처리합니다: %s", exc
                )
                travel_seconds.append(0)
            else:
                travel_seconds.append(route.seconds)

        return travel_seconds

    def _build_route_waypoint(self, schedule: Schedule):
        """Routes API 호출에 사용할 waypoint payload를 생성합니다."""

        place = schedule.place
        if not place:
            return None

        if place.google_place_id:
            return build_place_id_payload(place.google_place_id)

        if place.latitude is not None and place.longitude is not None:
            return build_location_payload(float(place.latitude), float(place.longitude))

        return None

    @staticmethod
    def _format_duration_text(seconds: int) -> str:
        """초 단위 값을 'H시간 M분' 형식으로 가공합니다."""

        if seconds <= 0:
            return "0분"

        minutes, _ = divmod(seconds, 60)
        hours, minutes = divmod(minutes, 60)

        if hours and minutes:
            return f"{hours}시간 {minutes}분"
        if hours:
            return f"{hours}시간"
        return f"{minutes}분"

# ============================================================================
# Place ViewSet: 장소 CRUD
# ============================================================================
@extend_schema_view(
    list=extend_schema(summary="장소 목록 조회"),
    create=extend_schema(summary="새 장소 등록"),
    retrieve=extend_schema(summary="장소 상세 정보"),
    update=extend_schema(summary="장소 전체 수정"),
    partial_update=extend_schema(summary="장소 부분 수정"),
    destroy=extend_schema(summary="장소 삭제"),
)
class PlaceViewSet(viewsets.ModelViewSet):
    """Place CRUD를 담당하는 ViewSet.

    기존 함수형 뷰는 GET/POST만 제공했지만, ModelViewSet으로 확장해 PUT/PATCH/DELETE까지 지원합니다.
    승인된 직원만 접근하도록 `IsApprovedStaff`를 적용했습니다.
    """

    queryset = Place.objects.select_related("category").all()
    serializer_class = PlaceSerializer
    permission_classes = [IsAuthenticated, IsApprovedStaff]

# ============================================================================
# PlaceRecommendation ViewSet: Google Places 기반 추천 API
# ============================================================================
@extend_schema_view(
    fixed_top=extend_schema(
        summary="고정 5개 카테고리의 상위 장소 추천",
        request=FixedRecommendationRequestSerializer,
    )
)
class PlaceRecommendationViewSet(viewsets.ViewSet):
    """Google Places API를 활용한 추천 기능을 담당하는 보조 ViewSet."""

    permission_classes = [IsAuthenticated, IsApprovedStaff]

    # 고정 추천에 사용할 탐색 반경(미터). 요구사항에서 10km로 제시했으므로 상수로 명시합니다.
    RECOMMENDATION_RADIUS_METERS = 10_000
    MAX_RESULTS_PER_CATEGORY = 6
    # 대체 장소 탐색은 1km 반경에서 3~5개의 후보를 제시해야 하므로 별도 상수를 둡니다.
    ALTERNATIVE_RADIUS_METERS = 1_000
    MAX_ALTERNATIVE_RESULTS = 5

    @extend_schema(
        summary="고정된 카테고리 5종에 대한 추천 목록 생성",
        request=FixedRecommendationRequestSerializer,
        responses={
            200: None,
            400: None,
            502: None,
        },
    )
    @action(detail=False, methods=["post"], url_path="fixed-top")
    def fixed_top(self, request, *args, **kwargs):
        """여행 중심 좌표를 기준으로 고정된 5개 카테고리를 검색합니다."""

        serializer = FixedRecommendationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        params = serializer.validated_data

        # ---- 1) 주소를 전달받았다면 Geocoding API로 위경도를 계산합니다. ----
        address = params.get("address")
        latitude = params.get("latitude")
        longitude = params.get("longitude")
        resolved_address = None

        if address:
            try:
                geocode = geocode_address(address)
            except GoogleMapsError as exc:
                # 외부 API 에러는 502(Bad Gateway)로 전달하여 클라이언트가 재시도 여부를 판단할 수 있게 합니다.
                return Response(
                    {"detail": str(exc)},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            latitude = geocode.latitude
            longitude = geocode.longitude
            resolved_address = geocode.formatted_address

        if latitude is None or longitude is None:
            # 이 상황은 Serializer 검증을 통과했지만 주소 변환에 실패했을 때만 발생합니다.
            return Response(
                {"detail": "위치 정보를 확인할 수 없습니다. 주소를 다시 확인해주세요."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---- 2) 고정된 카테고리 목록을 순회하며 Places API 결과를 수집합니다. ----
        category_results = []
        for place_type in FIXED_RECOMMENDATION_PLACE_TYPES:
            try:
                places = fetch_nearby_places(
                    latitude=latitude,
                    longitude=longitude,
                    place_type=place_type,
                    radius=self.RECOMMENDATION_RADIUS_METERS,
                )
            except GoogleMapsError as exc:
                return Response(
                    {
                        "detail": str(exc),
                        "failed_category": place_type,
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            shortlisted = []
            for place in places[: self.MAX_RESULTS_PER_CATEGORY]:
                # 추천 결과도 Place 테이블에 저장해 두면 이후 재요청 시 DB에서 곧바로 재사용할 수 있습니다.
                self._sync_place_metadata(place)
                # Places API 응답의 첫 번째 사진을 가져옵니다. 없으면 None을 그대로 유지합니다.
                photo_reference = None
                photos = place.raw.get("photos") if place.raw else None
                if photos:
                    first_photo = photos[0]
                    photo_reference = first_photo.get("photo_reference")

                shortlisted.append(
                    {
                        "place_id": place.place_id,
                        "name": place.name,
                        "rating": place.rating,
                        "user_ratings_total": place.user_ratings_total,
                        "types": place.types,
                        "location": {
                            "latitude": place.latitude,
                            "longitude": place.longitude,
                        },
                        "photo_reference": photo_reference,
                    }
                )

            category_results.append(
                {
                    "category": place_type,
                    "places": shortlisted,
                }
            )

        response_payload = {
            "base_location": {
                "latitude": latitude,
                "longitude": longitude,
                "input_address": address,
                "resolved_address": resolved_address or address,
            },
            "categories": category_results,
            "generated_at": timezone.now().isoformat(),
        }

        return Response(response_payload, status=status.HTTP_200_OK)

    # ------------------------------------------------------------------
    # 2) 대체 장소 추천 (ΔETA 최소)
    # ------------------------------------------------------------------
    @extend_schema(
        summary="동일 카테고리 내 대체 장소 추천",
        request=AlternativePlaceRequestSerializer,
        responses={200: None, 400: None, 502: None},
    )
    @action(detail=False, methods=["post"], url_path="alternatives")
    def alternatives(self, request, *args, **kwargs):
        """이전(A)·현재(X)·다음(Y) 장소를 입력받아 ΔETA가 가장 적은 후보를 반환합니다."""

        serializer = AlternativePlaceRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        params = serializer.validated_data

        # ---- 1) 방문 불가 장소(X)의 상세 정보를 확보합니다. ----
        try:
            unavailable_place = fetch_place_details(params["unavailable_place_id"])
        except GoogleMapsError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        # DB에 동일한 Google Place ID가 있다면 위경도/동기화 시간을 갱신해 둡니다.
        self._sync_place_metadata(unavailable_place)

        primary_type = self._select_primary_type(unavailable_place.types)
        if not primary_type:
            return Response(
                {
                    "detail": "해당 장소의 카테고리 정보를 확인할 수 없어 대체 추천을 진행할 수 없습니다.",
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # ---- 2) 동일 카테고리 + 1km 반경 후보를 조회합니다. ----
        try:
            nearby_places = fetch_nearby_places(
                latitude=unavailable_place.latitude,
                longitude=unavailable_place.longitude,
                place_type=primary_type,
                radius=self.ALTERNATIVE_RADIUS_METERS,
            )
        except GoogleMapsError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "failed_step": "nearby_search",
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # 자기 자신(X)과 Place ID가 동일한 항목은 제거합니다.
        candidates = [
            place for place in nearby_places if place.place_id != unavailable_place.place_id
        ]

        if not candidates:
            return Response(
                {
                    "base_route": self._build_base_route_payload(
                        params, unavailable_place, None
                    ),
                    "alternatives": [],
                    "searched_category": primary_type,
                    "generated_at": timezone.now().isoformat(),
                    "detail": "반경 1km 내에서 대체 후보를 찾지 못했습니다.",
                },
                status=status.HTTP_200_OK,
            )

        # ---- 3) 원본 경로(A→X→Y) 이동 시간을 구합니다. ----
        try:
            original_route = compute_route_duration(
                origin=build_place_id_payload(params["previous_place_id"]),
                destination=build_place_id_payload(params["next_place_id"]),
                intermediates=[build_place_id_payload(unavailable_place.place_id)],
                travel_mode=params["travel_mode"],
            )
        except GoogleMapsError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "failed_step": "original_route",
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        alternative_payloads = []
        # 후보가 많을 경우 상위 5개만 평가합니다.
        for candidate in candidates[: self.MAX_ALTERNATIVE_RESULTS * 2]:
            # 후보 중 위경도 등이 누락된 경우가 있으므로 방어적으로 처리합니다.
            if not candidate.place_id:
                continue

            try:
                candidate_route = compute_route_duration(
                    origin=build_place_id_payload(params["previous_place_id"]),
                    destination=build_place_id_payload(params["next_place_id"]),
                    intermediates=[build_place_id_payload(candidate.place_id)],
                    travel_mode=params["travel_mode"],
                )
            except GoogleMapsError as exc:
                # 개별 후보에서만 실패하면 다음 후보를 이어서 평가합니다.
                logger.warning(
                    "Routes API 실패로 후보를 건너뜀: place_id=%s error=%s",
                    candidate.place_id,
                    exc,
                )
                continue

            # 후보 정보도 Place 테이블에 저장해 두면 추후 재사용이 편해집니다.
            self._sync_place_metadata(candidate)

            delta_seconds = candidate_route.seconds - original_route.seconds
            alternative_payloads.append(
                {
                    "place": {
                        "place_id": candidate.place_id,
                        "name": candidate.name,
                        "rating": candidate.rating or 0.0,
                        "user_ratings_total": candidate.user_ratings_total,
                        "types": candidate.types,
                        "location": {
                            "latitude": candidate.latitude,
                            "longitude": candidate.longitude,
                        },
                    },
                    "total_duration_seconds": candidate_route.seconds,
                    "total_duration_text": candidate_route.duration_text,
                    "delta_seconds": delta_seconds,
                    "delta_text": self._format_delta(delta_seconds),
                }
            )

            if len(alternative_payloads) >= self.MAX_ALTERNATIVE_RESULTS:
                break

        alternative_payloads.sort(key=lambda item: item["delta_seconds"])

        response_payload = {
            "base_route": self._build_base_route_payload(
                params, unavailable_place, original_route
            ),
            "alternatives": alternative_payloads,
            "searched_category": primary_type,
            "generated_at": timezone.now().isoformat(),
        }

        return Response(response_payload, status=status.HTTP_200_OK)

    # ------------------------------------------------------------------
    # Helper methods
    # ------------------------------------------------------------------
    def _build_base_route_payload(self, params, unavailable_place, route):
        """응답 공통 영역(원본 경로 정보)을 생성합니다."""

        payload = {
            "previous_place_id": params["previous_place_id"],
            "unavailable_place": {
                "place_id": unavailable_place.place_id,
                "name": unavailable_place.name,
                "types": unavailable_place.types,
                "location": {
                    "latitude": unavailable_place.latitude,
                    "longitude": unavailable_place.longitude,
                },
            },
            "next_place_id": params["next_place_id"],
        }

        if route is not None:
            payload.update(
                {
                    "original_duration_seconds": route.seconds,
                    "original_duration_text": route.duration_text,
                }
            )

        return payload

    @staticmethod
    def _select_primary_type(types):
        """Google Places 타입 목록에서 대표 타입을 선정합니다."""

        if not types:
            return None

        # 너무 포괄적인 타입(point_of_interest 등)은 제외하고, 더 구체적인 값을 선택합니다.
        excluded = {
            "point_of_interest",
            "establishment",
            "premise",
            "food",
        }
        for value in types:
            if value not in excluded:
                return value
        # 모두 제외 대상이라면 첫 번째 값을 그대로 사용합니다.
        return types[0]

    @staticmethod
    def _format_delta(delta_seconds: int) -> str:
        """ΔETA 값을 사람이 이해하기 쉬운 문자열로 변환합니다."""

        if delta_seconds == 0:
            return "±0분"

        sign = "+" if delta_seconds > 0 else "-"
        seconds = abs(delta_seconds)
        minutes, _ = divmod(seconds, 60)
        hours, minutes = divmod(minutes, 60)

        if hours > 0:
            if minutes > 0:
                text = f"{hours}시간 {minutes}분"
            else:
                text = f"{hours}시간"
        else:
            text = f"{minutes}분"

        return f"{sign}{text}"

    def _sync_place_metadata(self, google_place: GooglePlace):
        """Places API 결과를 로컬 Place 모델에 기록하거나 갱신합니다."""

        if not google_place.place_id:
            # place_id가 없으면 후속 연동이 불가능하므로 조용히 종료합니다.
            return

        place = Place.objects.filter(google_place_id=google_place.place_id).first()

        formatted_address = None
        if getattr(google_place, "raw", None):
            formatted_address = (
                    google_place.raw.get("formatted_address")
                    or google_place.raw.get("vicinity")
            )

        if place is None:
            # 기존 Place가 없다면 최소한의 정보로 신규 레코드를 만들어 둡니다.
            place = Place(
                name=google_place.name or "이름 미상 장소",
                google_place_id=google_place.place_id,
            )
            if formatted_address:
                place.address = formatted_address

            if google_place.latitude is not None:
                place.latitude = Decimal(str(google_place.latitude))
            if google_place.longitude is not None:
                place.longitude = Decimal(str(google_place.longitude))

            place.google_synced_at = timezone.now()
            place.save()
            return

        fields_to_update = []

        if not place.google_place_id:
            place.google_place_id = google_place.place_id
            fields_to_update.append("google_place_id")

        if formatted_address and place.address != formatted_address:
            place.address = formatted_address
            fields_to_update.append("address")

        if google_place.latitude is not None:
            new_lat = Decimal(str(google_place.latitude))
            if place.latitude != new_lat:
                place.latitude = new_lat
                fields_to_update.append("latitude")

        if google_place.longitude is not None:
            new_lng = Decimal(str(google_place.longitude))
            if place.longitude != new_lng:
                place.longitude = new_lng
                fields_to_update.append("longitude")

        place.google_synced_at = timezone.now()
        fields_to_update.append("google_synced_at")

        if fields_to_update:
            place.save(update_fields=fields_to_update)


# ============================================================================
# OptionalExpense ViewSet: 장소별 선택 지출
# ============================================================================
@extend_schema_view(
    list=extend_schema(summary="장소별 선택 지출 목록", parameters=[PLACE_PK_PARAMETER]),
    create=extend_schema(summary="새 선택 지출 등록", parameters=[PLACE_PK_PARAMETER]),
    retrieve=extend_schema(summary="선택 지출 상세", parameters=[PLACE_PK_PARAMETER]),
    update=extend_schema(summary="선택 지출 전체 수정", parameters=[PLACE_PK_PARAMETER]),
    partial_update=extend_schema(summary="선택 지출 부분 수정", parameters=[PLACE_PK_PARAMETER]),
    destroy=extend_schema(summary="선택 지출 삭제", parameters=[PLACE_PK_PARAMETER]),
)
class OptionalExpenseViewSet(PlaceLookupMixin, viewsets.ModelViewSet):
    """OptionalExpense CRUD + 비용 합산 액션을 제공."""

    serializer_class = OptionalExpenseSerializer
    permission_classes = [IsAuthenticated, IsApprovedStaff]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return OptionalExpense.objects.none()

        place = self.get_place()
        return OptionalExpense.objects.filter(place=place).order_by("display_order", "id")

    def perform_create(self, serializer):
        serializer.save(place=self.get_place())

    def perform_update(self, serializer):
        serializer.save(place=self.get_place())

    @extend_schema(
        summary="선택 지출 합계 계산",
        request=ExpenseSelectionSerializer,
        parameters=[PLACE_PK_PARAMETER],
    )
    @action(detail=False, methods=["post"], url_path="calculate")
    def calculate(self, request, *args, **kwargs):
        """선택한 OptionalExpense ID 목록을 받아 총액을 계산합니다."""

        serializer = ExpenseSelectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = OptionalExpense.calculate_selected_total(serializer.validated_data["expense_ids"])
        return Response(result, status=status.HTTP_200_OK)

# ============================================================================
# PlaceCoordinator ViewSet: 장소 담당자 관리
# ============================================================================
@extend_schema_view(
    list=extend_schema(summary="장소별 담당자 목록", parameters=[PLACE_PK_PARAMETER]),
    create=extend_schema(summary="담당자 추가", parameters=[PLACE_PK_PARAMETER]),
    retrieve=extend_schema(summary="담당자 상세", parameters=[PLACE_PK_PARAMETER]),
    update=extend_schema(summary="담당자 정보 수정", parameters=[PLACE_PK_PARAMETER]),
    partial_update=extend_schema(summary="담당자 정보 부분 수정", parameters=[PLACE_PK_PARAMETER]),
    destroy=extend_schema(summary="담당자 삭제", parameters=[PLACE_PK_PARAMETER]),
)
class PlaceCoordinatorViewSet(PlaceLookupMixin, viewsets.ModelViewSet):
    """Place에 연결된 담당자 정보를 CRUD로 관리합니다."""

    serializer_class = PlaceCoordinatorSerializer
    permission_classes = [IsAuthenticated, IsApprovedStaff]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return PlaceCoordinator.objects.none()

        place = self.get_place()
        return (
            PlaceCoordinator.objects.select_related("place", "role")
            .filter(place=place)
            .order_by("id")
        )

    def perform_create(self, serializer):
        serializer.save(place=self.get_place())

    def perform_update(self, serializer):
        serializer.save(place=self.get_place())

# ============================================================================
# ReadOnly ViewSet: 장소 카테고리 / 담당자 역할
# ============================================================================
class PlaceCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """장소 카테고리 목록을 조회만 할 수 있도록 ReadOnly ViewSet으로 구성."""

    queryset = PlaceCategory.objects.order_by("name")
    serializer_class = PlaceCategorySerializer
    permission_classes = [IsAuthenticated, IsApprovedStaff]

class CoordinatorRoleViewSet(viewsets.ReadOnlyModelViewSet):
    """담당자 역할(Role) 목록을 조회만 허용."""

    queryset = CoordinatorRole.objects.order_by("name")
    serializer_class = CoordinatorRoleSerializer
    permission_classes = [IsAuthenticated, IsApprovedStaff]
