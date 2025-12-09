"""공통으로 사용하는 접근 제한 모듈."""
from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.permissions import BasePermission

User = get_user_model()


class IsApprovedStaff(BasePermission):
    """
    승인된 직원만 접근하도록 강제하는 커스텀 권한.

    - DEMO_MODE가 켜져 있으면 무조건 통과해 데모 환경에서 로그인 없이 사용 가능.
    """

    message = "승인된 직원만 기능을 사용할 수 있습니다."

    def has_permission(self, request, view):
        """뷰 레벨 권한 체크."""
        if getattr(settings, "DEMO_MODE", False):
            return True

        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "is_approved", False)
        )

    def has_object_permission(self, request, view, obj):
        """객체 권한 검토도 동일 로직 적용."""
        return self.has_permission(request, view)


class IsSuperAdminUser(IsApprovedStaff):
    """
    총괄담당자만 사용 가능한 권한.
    """

    message = "총괄담당자만 수행할 수 있는 작업입니다."

    def has_permission(self, request, view):
        """로그인/승인 검증 + 직급 확인."""
        if getattr(settings, "DEMO_MODE", False):
            return True

        user = request.user
        return bool(
            super().has_permission(request, view)
            and getattr(user, "role", None) == "super_admin"
        )

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)


__all__ = [
    "IsApprovedStaff",
    "IsSuperAdminUser",
]
