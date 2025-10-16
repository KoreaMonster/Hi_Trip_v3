"""Schedules 전용 Permission 클래스.

`IsTripCoordinator`는 "승인된 담당자 혹은 총괄 관리자"만 특정 여행(trip)의
일정을 다룰 수 있도록 제한합니다. users 앱에서 정의한 `IsApprovedStaff`와 함께 사용하면
세션이 살아 있는 동안 승인 상태가 변경되어도 즉시 접근을 차단할 수 있습니다.
"""

from typing import Optional

from django.shortcuts import get_object_or_404
from rest_framework.permissions import BasePermission

from trips.models import Trip


class IsTripCoordinator(BasePermission):
    """특정 여행의 일정/세부 리소스를 담당하는 사용자만 허용합니다.

    사용 시점 정리:
    - 목록/생성(list/create): URL에서 전달받은 ``trip_pk``를 기준으로 권한을 판별합니다.
    - 객체 단위 권한(retrieve/update/destroy): 해당 객체의 ``trip``을 활용합니다.

    허용 조건:
    1. 총괄 관리자(`role == 'super_admin'`)
    2. 여행 담당자(`role == 'manager'`)이면서, 해당 여행의 ``manager``와 일치
    """

    message = "이 여행에 접근할 권한이 없습니다. 담당자 승인 여부를 확인하세요."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False

        # super_admin은 별도 검증 없이 통과 (IsApprovedStaff에서 승인 여부 검사)
        if getattr(user, "role", None) == "super_admin":
            return True

        # manager인지 먼저 확인하고, 이후 여행 담당자인지 검증합니다.
        if getattr(user, "role", None) != "manager":
            return False

        trip = self._extract_trip_from_view(view)
        if trip is None:
            # View가 특정 여행에 속하지 않는다면 이 permission은 의미가 없으므로 True 반환
            return True

        return trip.manager_id == user.id

    def has_object_permission(self, request, view, obj) -> bool:
        """단일 객체에 접근할 때도 동일한 규칙을 한 번 더 확인합니다."""

        user = request.user
        if getattr(user, "role", None) == "super_admin":
            return True
        if getattr(user, "role", None) != "manager":
            return False

        trip = getattr(obj, "trip", None)
        if trip is None:
            trip = self._extract_trip_from_view(view)
        return trip is not None and trip.manager_id == user.id

    # ------------------------------------------------------------------
    # 내부 헬퍼
    # ------------------------------------------------------------------
    def _extract_trip_from_view(self, view) -> Optional[Trip]:
        """ViewSet에서 ``trip_pk`` 정보를 꺼내 Trip 인스턴스를 조회합니다."""

        trip_pk = getattr(view, "kwargs", {}).get("trip_pk")
        if trip_pk is None:
            return None

        # `get_object_or_404`는 존재하지 않을 경우 404를 발생시켜 DRF가 적절히 처리합니다.
        return get_object_or_404(Trip, pk=trip_pk)