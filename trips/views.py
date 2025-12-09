"""trips 앱의 REST API ViewSet 모음."""

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import IsApprovedStaff, IsSuperAdminUser

from .models import Trip, TripParticipant
from .serializers import (
    AssignManagerSerializer,
    TripDetailSerializer,
    TripParticipantSerializer,
    TripSerializer,
)


@extend_schema_view(
    list=extend_schema(tags=["여행"]),
    retrieve=extend_schema(tags=["여행"]),
    create=extend_schema(tags=["여행"]),
    update=extend_schema(tags=["여행"]),
    partial_update=extend_schema(tags=["여행"]),
    destroy=extend_schema(tags=["여행"]),
)
class TripViewSet(viewsets.ModelViewSet):
    """여행 CRUD와 관리자 전용 부가 액션을 담당한다."""

    serializer_class = TripSerializer
    permission_classes = [IsAuthenticated, IsApprovedStaff]
    queryset = Trip.objects.select_related("manager").prefetch_related(
        "participants__traveler"
    )

    def get_queryset(self):
        """로그인한 사용자의 역할에 따라 조회 가능한 여행을 제한한다."""

        qs = super().get_queryset()
        # 총괄담당자(super_admin)는 모든 여행을 조회할 수 있다.
        if self.request.user.role == "super_admin":
            return qs

        # 담당자는 자신이 담당한 여행만 볼 수 있도록 필터링한다.
        return qs.filter(manager=self.request.user)

    def get_serializer_class(self):
        """상세 조회 시에는 참가자 정보를 포함한 Serializer를 사용한다."""

        if self.action == "retrieve":
            return TripDetailSerializer
        return super().get_serializer_class()

    def perform_create(self, serializer):
        """여행 생성 시 기본 담당자를 지정한다.

        - 담당자(role=manager)가 직접 생성하면 자동으로 자신을 담당자로 설정한다.
        - 총괄담당자가 생성할 경우에는 요청 본문에서 명시한 담당자를 유지한다.
        """

        manager = serializer.validated_data.get("manager")
        if manager is None and self.request.user.role == "manager":
            serializer.save(manager=self.request.user)
        else:
            serializer.save()

    @extend_schema(
        summary="여행 담당자 배정",
        description="총괄담당자가 특정 여행에 담당자를 지정합니다.",
        request=AssignManagerSerializer,
        responses={200: TripSerializer},
    )
    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticated, IsSuperAdminUser],
        url_path="assign-manager",
    )
    def assign_manager(self, request, pk=None):
        """총괄담당자 전용 담당자 배정 액션."""

        trip = self.get_object()
        serializer = AssignManagerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.update_trip(trip)
        return Response(self.get_serializer(trip).data)


@extend_schema_view(
    list=extend_schema(tags=["참가자"]),
    create=extend_schema(tags=["참가자"]),
)
class TripParticipantViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """특정 여행에 속한 참가자 목록을 조회한다."""

    serializer_class = TripParticipantSerializer
    permission_classes = [IsAuthenticated, IsApprovedStaff]

    def get_trip(self) -> Trip:
        """NestedRouter가 전달한 trip_pk로 여행을 조회한다.

        drf-spectacular가 스키마를 생성할 때는 `swagger_fake_view` 플래그가
        True로 설정되고 `kwargs`에 `trip_pk`가 존재하지 않는다. 이때는 DB
        조회를 건너뛰어 경고를 방지한다.
        """

        if getattr(self, "swagger_fake_view", False):
            return Trip()

        if not hasattr(self, "_trip_cache"):
            trip_pk = self.kwargs.get("trip_pk")
            self._trip_cache = get_object_or_404(Trip, pk=trip_pk)
        return self._trip_cache

    def get_queryset(self):
        """요청한 여행에 속한 참가자만 반환한다."""

        if getattr(self, "swagger_fake_view", False):
            return TripParticipant.objects.none()

        trip_pk = self.kwargs.get("trip_pk")
        return TripParticipant.objects.filter(trip_id=trip_pk).select_related("traveler")

    def get_serializer_context(self):
        """Serializer가 trip 정보를 활용할 수 있도록 context를 확장한다."""

        context = super().get_serializer_context()
        if not getattr(self, "swagger_fake_view", False) and "trip_pk" in self.kwargs:
            context["trip"] = self.get_trip()
        return context

    TRIP_PK_PARAMETER = OpenApiParameter(
        name="trip_pk",
        type=OpenApiTypes.INT,
        location=OpenApiParameter.PATH,
        description="상위 여행의 ID (정수).",
    )

    @extend_schema(
        summary="여행 참가자 목록",
        description="특정 여행의 모든 참가자를 반환합니다.",
        parameters=[TRIP_PK_PARAMETER],
        responses={200: TripParticipantSerializer(many=True)},
    )
    def list(self, request, *args, **kwargs):  # type: ignore[override]
        return super().list(request, *args, **kwargs)

    @extend_schema(
        summary="초대코드로 여행 참가",
        description="기존 join_trip API를 대체하는 엔드포인트입니다.",
        parameters=[TRIP_PK_PARAMETER],
        responses={201: TripParticipantSerializer},
    )
    def create(self, request, *args, **kwargs):  # type: ignore[override]
        """참가자를 생성한 뒤 기존 API와 유사한 메시지를 반환한다."""

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        participant = serializer.save()
        headers = self.get_success_headers(serializer.data)

        message = (
            f"{participant.traveler.full_name_kr}님이 "
            f"{participant.trip.title}에 참가했습니다."
        )
        data = {
            "message": message,
            "participant": TripParticipantSerializer(
                participant, context=self.get_serializer_context()
            ).data,
        }
        return Response(data, status=status.HTTP_201_CREATED, headers=headers)
