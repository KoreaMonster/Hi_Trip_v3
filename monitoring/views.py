"""모니터링 관련 DRF ViewSet 구현."""

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from trips.models import Trip, TripParticipant
from users.permissions import IsApprovedStaff

from .models import MonitoringAlert
from .serializers import (
    DemoGenerationResultSerializer,
    DemoGenerationSerializer,
    HealthCheckSerializer,
    MonitoringAlertSerializer,
    ParticipantLatestSerializer,
    ParticipantHistorySerializer,
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

    @extend_schema(
        summary="데모 모니터링 데이터 생성",
        description="선택한 여행 참가자들에 대한 더미 측정 데이터를 생성해 모니터링 화면을 시연할 수 있도록 합니다.",
        request=DemoGenerationSerializer,
        responses={200: DemoGenerationResultSerializer},
    )
    @action(detail=True, methods=["post"], url_path="generate-demo")
    def generate_demo(self, request, pk=None):
        trip = self.get_trip(pk)
        serializer = DemoGenerationSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)

        created = serializer.generate(trip)
        response = DemoGenerationResultSerializer(
            {
                "created_records": created,
                "minutes": serializer.validated_data["minutes"],
                "interval_seconds": serializer.validated_data["interval"],
            }
        )
        return Response(response.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="참가자 측정 이력",
        description="특정 참가자의 건강·위치 측정 이력을 최근 순으로 조회합니다.",
        parameters=[
            trip_id_parameter,
            OpenApiParameter(
                name="participant_id",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.PATH,
                description="조회할 참가자 ID",
            ),
            OpenApiParameter(
                name="limit",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description="가져올 최대 측정 개수(기본 120, 최대 240)",
                required=False,
            ),
        ],
        responses={200: ParticipantHistorySerializer},
    )
    @action(
        detail=True,
        methods=["get"],
        url_path="participants/(?P<participant_id>[^/.]+)/history",
    )
    def participant_history(self, request, pk=None, participant_id=None):
        trip = self.get_trip(pk)
        participant = get_object_or_404(
            TripParticipant.objects.select_related("traveler"),
            pk=participant_id,
            trip=trip,
        )

        try:
            limit = int(request.query_params.get("limit", 120))
        except (TypeError, ValueError):
            limit = 120
        limit = max(1, min(limit, 240))

        health_qs = list(
            participant.health_snapshots.order_by("-measured_at")[:limit]
        )
        location_qs = list(
            participant.location_snapshots.order_by("-measured_at")[:limit]
        )

        health_qs.reverse()
        location_qs.reverse()

        payload = {
            "participant_id": participant.id,
            "traveler_name": participant.traveler.full_name_kr,
            "trip_id": participant.trip_id,
            "health": HealthSnapshotSerializer(health_qs, many=True).data,
            "location": LocationSnapshotSerializer(location_qs, many=True).data,
        }

        serializer = ParticipantHistorySerializer(payload)
        return Response(serializer.data, status=status.HTTP_200_OK)