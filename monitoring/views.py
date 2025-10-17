"""모니터링 관련 DRF ViewSet 구현."""

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from trips.models import Trip
from users.permissions import IsApprovedStaff

from .models import MonitoringAlert
from .serializers import (
    DemoGenerationSerializer,
    MonitoringAlertSerializer,
    ParticipantLatestSerializer,
    HealthSnapshotSerializer,
    LocationSnapshotSerializer,
)
from .services import get_participant_statuses


class TripMonitoringViewSet(viewsets.ViewSet):
    """특정 여행에 대한 모니터링 데이터를 제공한다."""

    permission_classes = [permissions.IsAuthenticated, IsApprovedStaff]

    def get_trip(self, pk: int) -> Trip:
        """중복 코드를 줄이기 위한 Trip 조회 헬퍼."""

        return get_object_or_404(Trip, pk=pk)

    @extend_schema(
        summary="참가자 최신 건강/위치 상태",
        description="여행 참가자별 가장 최근의 HealthSnapshot과 LocationSnapshot을 반환합니다.",
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
            payload.append(
                {
                    "participant_id": status_obj.participant.id,
                    "traveler_name": status_obj.participant.traveler.full_name_kr,
                    "trip_id": status_obj.participant.trip_id,
                    "health": health_data,
                    "location": location_data,
                }
            )

        serializer = ParticipantLatestSerializer(payload, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="경고 이력 조회",
        description="최근 생성된 모니터링 경고를 시간순으로 반환합니다.",
        responses={200: MonitoringAlertSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="alerts")
    def alerts(self, request, pk=None):
        trip = self.get_trip(pk)
        alerts = (
            MonitoringAlert.objects.filter(participant__trip=trip)
            .select_related("participant__traveler")
            .order_by("-created_at")[:100]
        )
        serializer = MonitoringAlertSerializer(alerts, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="데모 데이터 생성",
        description="프런트엔드 없이도 API 호출만으로 더미 스냅샷을 만들 수 있는 보조 액션.",
        request=DemoGenerationSerializer,
        responses={201: None},
    )
    @action(detail=True, methods=["post"], url_path="generate-demo")
    def generate_demo(self, request, pk=None):
        trip = self.get_trip(pk)
        serializer = DemoGenerationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        created = serializer.generate(trip)
        return Response(
            {
                "created": created,
                "message": f"{created}개의 스냅샷을 생성했습니다.",
            },
            status=status.HTTP_201_CREATED,
        )

    # 향후 개선 계획:
    # - latest/alerts 응답에 pagination을 적용하면 참가자 수가 많아져도 응답이 가벼워집니다.
    # - WebSocket/SSE 연동 시에는 여기에서 채널 그룹에 메시지를 발송하도록 확장합니다.