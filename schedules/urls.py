"""Schedules 앱의 라우터 구성.

ViewSet 구조에 맞춰 DRF Router + Nested Router를 사용합니다.
"""

from rest_framework.routers import DefaultRouter
from rest_framework_nested.routers import NestedSimpleRouter

from trips.urls import router as trips_router

from .views import (
    CoordinatorRoleViewSet,
    OptionalExpenseViewSet,
    PlaceCategoryViewSet,
    PlaceCoordinatorViewSet,
    PlaceRecommendationViewSet,
    PlaceViewSet,
    PlaceSummaryCardViewSet,
    ScheduleViewSet,
)

# 기본 Router: 장소/카테고리/담당자 역할 등 독립 리소스를 등록합니다.
router = DefaultRouter()
router.register("places", PlaceViewSet, basename="place")
router.register("categories", PlaceCategoryViewSet, basename="place-category")
router.register("coordinator-roles", CoordinatorRoleViewSet, basename="coordinator-role")
router.register(
    "place-recommendations",
    PlaceRecommendationViewSet,
    basename="place-recommendation",
)

# 장소 하위 리소스(선택 지출, 담당자)를 위한 Nested Router
place_router = NestedSimpleRouter(router, r"places", lookup="place")
place_router.register("expenses", OptionalExpenseViewSet, basename="place-expense")
place_router.register("coordinators", PlaceCoordinatorViewSet, basename="place-coordinator")
place_router.register("summary-card", PlaceSummaryCardViewSet, basename="place-summary-card")

# 여행 하위 일정 라우터: trips 앱에서 사용 중인 router를 재활용합니다.
trip_schedule_router = NestedSimpleRouter(trips_router, r"trips", lookup="trip")
trip_schedule_router.register("schedules", ScheduleViewSet, basename="trip-schedule")

urlpatterns = router.urls + place_router.urls + trip_schedule_router.urls
