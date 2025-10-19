"""모니터링 앱 URL 라우팅."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import TripMonitoringViewSet, health_check

# ViewSet 라우터 설정
router = DefaultRouter()
router.register(r"monitoring/trips", TripMonitoringViewSet, basename="monitoring-trip")

app_name = 'monitoring'

urlpatterns = [
    # ✅ 헬스체크 엔드포인트 (인증 불필요)
    path("health/", health_check, name="health-check"),

    # ViewSet 라우트들
    path("", include(router.urls)),
]