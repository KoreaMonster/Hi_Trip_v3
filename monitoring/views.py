"""모니터링 관련 DRF ViewSet 구현."""

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from trips.models import Trip
from users.permissions import IsApprovedStaff

from .models import MonitoringAlert
from .serializers import (
    DemoGenerationSerializer,
    HealthCheckSerializer,
    MonitoringAlertSerializer,
    ParticipantLatestSerializer,
    HealthSnapshotSerializer,
    LocationSnapshotSerializer,
)
from .services import get_participant_statuses


# ✅ 간단한 함수 기반 뷰 (추천)
@extend_schema(
    methods=["GET"],
    summary="서비스 헬스 체크",
    description="로드 밸런서 및 모니터링 도구에서 사용되는 상태 확인 엔드포인트.",
    request=None,
    responses={status.HTTP_200_OK: HealthCheckSerializer},
)
@extend_schema(
    methods=["HEAD"],
    request=None,
    responses={status.HTTP_204_NO_CONTENT: None},
)
@api_view(["GET", "HEAD"])
@permission_classes([permissions.AllowAny])
def health_check(request):
    """
    로드밸런서 및 외부 모니터링 툴을 위한 헬스 체크.

    - GET: JSON 응답 반환
    - HEAD: 204 No Content 반환 (부하분산기용)
    """
    if request.method == 'HEAD':
        return Response(status=status.HTTP_204_NO_CONTENT)

    return Response({
        'status': 'ok',
        'message': 'Backend is running',
        'service': 'Hi Trip API'
    }, status=status.HTTP_200_OK)


class TripMonitoringViewSet(viewsets.ViewSet):
    """특정 여행에 대한 모니터링 데이터를 제공한다."""

    permission_classes = [permissions.IsAuthenticated, IsApprovedStaff]
    trip_id_parameter = OpenApiParameter(
        name="id",
        type=OpenApiTypes.INT,
        location=OpenApiParameter.PATH,
        description="모니터링할 여행의 ID (정수).",
    )

    def get_trip(self, pk: int) -> Trip:
        """중복 코드를 줄이기 위한 Trip 조회 헬퍼."""
        return get_object_or_404(Trip, pk=pk)

    @extend_schema(
        summary="참가자 최신 건강/위치 상태",
        description="여행 참가자별 가장 최근의 HealthSnapshot과 LocationSnapshot을 반환합니다.",
        parameters=[trip_id_parameter],
        responses={200: ParticipantLatestSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="latest")
    def latest(self, request, pk=None):
        trip = self.get_trip(pk)
        statuses = get_participant_statuses(trip)

        payload = []
        for status_obj in statuses:
            health_data = (
                HealthSnapshotSerializer(status_obj.health).data
                if status_obj.health
                else None
            )
            location_data = (
                LocationSnapshotSerializer(status_obj.location).data
                if status_obj.location
                else None
            )

            participant = status_obj.participant
            traveler = participant.traveler

            payload.append(
                {
                    "participant_id": participant.id,
                    "traveler_name": traveler.full_name_kr,
                    "trip_id": participant.trip_id,
                    "health": health_data,
                    "location": location_data,
                }
            )

        serializer = ParticipantLatestSerializer(payload, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="여행 알림 목록",
        description="특정 여행에 대한 모니터링 알림 목록을 조회합니다.",
        parameters=[trip_id_parameter],
        responses={200: MonitoringAlertSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="alerts")
    def alerts(self, request, pk=None):
        trip = self.get_trip(pk)
        alerts = (
            MonitoringAlert.objects.filter(participant__trip=trip)
            .select_related("participant", "participant__traveler")
            .order_by("-created_at")
        )
        serializer = MonitoringAlertSerializer(alerts, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)