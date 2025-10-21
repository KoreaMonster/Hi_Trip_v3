"""trips 앱의 라우터 설정."""

from rest_framework.routers import DefaultRouter
from rest_framework_nested.routers import NestedSimpleRouter

from .views import ParticipantOverviewViewSet, TripParticipantViewSet, TripViewSet

router = DefaultRouter()
router.register("trips", TripViewSet, basename="trip")
router.register("participants-overview", ParticipantOverviewViewSet, basename="participant-overview")

trip_router = NestedSimpleRouter(router, r"trips", lookup="trip")
trip_router.register(
    r"participants",
    TripParticipantViewSet,
    basename="trip-participants",
)

urlpatterns = router.urls + trip_router.urls
