"""공통으로 사용할 사용자 권한 정의 모듈."""
from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework.permissions import BasePermission

User = get_user_model()

class IsApprovedStaff(BasePermission):
    """
    승인된 직원만 접근하도록 강제하는 커스텀 권한 클래스.

    # 초보 개발자 설명:
    # DRF는 permission 클래스를 ``permission_classes`` 속성에 넣어두면
    # 요청마다 자동으로 실행한다. ``True``를 반환하면 통과, ``False``면
    # 403 Forbidden 응답을 만든다. message 속성은 실패 시 보여줄 안내문이다.

    권한 레이어 분리:
    일반 로그인 여부: IsAuthenticated
    승인 상태 강제: IsApprovedStaff
    관리자 전용: IsSuperAdminUser
    → 역할/승인/인증을 역할별 클래스로 조합하는 방식이 유지보수에 유리.

    세션 잔존 리스크 대비: 승인 해제 후에도 세션이 살아 있을 수 있는 상황을 IsApprovedStaff로 차단 → 안전.
    """

    message = "승인된 직원만 이 기능을 사용할 수 있습니다."

    def has_permission(self, request, view):
        """뷰 단위 권한 체크."""
        user = request.user

        return bool(
            user
            and user.is_authenticated
            and getattr(user, "is_approved", False)
        )

    def has_object_permission(self, request, view, obj):
        """객체 권한 검사도 동일 규칙 적용."""
        return self.has_permission(request, view)


class IsSuperAdminUser(IsApprovedStaff):
    """
    총괄담당자 전용 권한.

    # 초보 개발자 설명:
    # 상속을 사용하면 ``승인 여부`` 검사 로직을 중복 작성하지 않아도 된다.
    # ``super().has_permission`` 호출 후 직급(role)만 추가로 확인한다.
    """
    message = "총괄담당자만 수행할 수 있는 작업입니다."

    def has_permission(self, request, view):
        """먼저 승인 여부 검사 후 직급 확인."""
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