"""monitoring 앱의 라우터 설정."""

from rest_framework.routers import DefaultRouter

from .views import TripMonitoringViewSet

router = DefaultRouter()
router.register(r"monitoring/trips", TripMonitoringViewSet, basename="monitoring-trip")

urlpatterns = router.urls