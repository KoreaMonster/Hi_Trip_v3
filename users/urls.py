"""users 앱 URL 패턴.

Phase 1에서 ViewSet/APIView 구조로 전환하면서 라우팅 방식을 router 기반으로 정리했습니다.
"""

from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import LoginAPIView, LogoutAPIView, ProfileAPIView, TravelerViewSet, UserViewSet

# 초보 개발자 가이드:
# - DefaultRouter는 등록된 ViewSet에 대해 자동으로 URL을 생성합니다.
# - /staff/ → list/create, /staff/{pk}/ → retrieve/update/destroy
router = DefaultRouter()
router.register("staff", UserViewSet, basename="staff")
router.register("travelers", TravelerViewSet, basename="traveler")

urlpatterns = [
    # 기존 /register/ 엔드포인트를 유지하면서 내부적으로 ViewSet의 create를 호출합니다.
    path("register/", UserViewSet.as_view({"post": "create"}), name="register"),
    path("login/", LoginAPIView.as_view(), name="login"),
    path("logout/", LogoutAPIView.as_view(), name="logout"),
    path("profile/", ProfileAPIView.as_view(), name="profile"),
]

# ViewSet 기반 URL을 추가합니다.
urlpatterns += router.urls