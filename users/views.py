"""사용자 관련 API 엔드포인트 모음."""

from __future__ import annotations

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.sessions.models import Session
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsApprovedStaff, IsSuperAdminUser
from .serializers import LoginSerializer, UserDetailSerializer, UserSerialization

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    """직원(User) 리소스에 대한 CRUD와 승인 기능을 제공하는 ViewSet."""

    # 초보 개발자 가이드:
    # - ViewSet은 list/create/retrieve/update/destroy를 하나의 클래스에서 관리합니다.
    # - self.action 값에 따라 어떤 HTTP 메서드가 호출됐는지 구분할 수 있습니다.

    queryset = User.objects.all().order_by("id")
    serializer_class = UserDetailSerializer

    def get_serializer_class(self):
        """액션별로 다른 Serializer를 사용해 입력/출력 포맷을 분리합니다."""

        if self.action == "create":
            # 회원가입 요청은 UserSerialization을 사용해 비밀번호 유효성 검사를 수행합니다.
            return UserSerialization
        return UserDetailSerializer

    def get_permissions(self):
        """액션별 권한 정책을 명시적으로 선언."""

        if self.action == "create":
            # 회원가입은 로그인하지 않은 직원도 접근할 수 있도록 개방합니다.
            permission_classes = [AllowAny]
        elif self.action in {"list", "retrieve"}:
            # 직원 목록/상세 조회는 승인된 총괄담당자만 수행하게 제한합니다.
            permission_classes = [IsAuthenticated, IsSuperAdminUser]
        else:
            # update/destroy/approve 등은 총괄담당자 전용입니다.
            permission_classes = [IsAuthenticated, IsSuperAdminUser]
        return [permission() for permission in permission_classes]

    @extend_schema(
        summary="직원 회원가입",
        request=UserSerialization,
        responses={status.HTTP_201_CREATED: UserDetailSerializer},
        description="새로운 직원 계정을 생성합니다. 승인 전까지는 로그인할 수 없습니다.",
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        """serializer.save() 호출 시 실행되어 사용자 생성을 담당."""

        # DRF는 serializer.save()를 호출할 때 이 메서드를 자동으로 호출합니다.
        serializer.save()

    @extend_schema(
        summary="직원 계정 승인",
        responses={status.HTTP_200_OK: UserDetailSerializer},
        description=(
            "총괄담당자가 특정 직원을 승인합니다."
            " 승인 후에는 로그인 및 다른 API 접근이 가능해집니다."
        ),
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="approve",
        permission_classes=[IsAuthenticated, IsSuperAdminUser],
    )
    def approve(self, request, pk=None):
        """총괄담당자가 개별 직원을 승인 상태로 전환."""

        user_to_approve = self.get_object()

        if user_to_approve.is_approved:
            return Response(
                {
                    "message": f"{user_to_approve.username} 님은 이미 승인된 사용자입니다.",
                    "user": UserDetailSerializer(user_to_approve).data,
                }
            )

        user_to_approve.is_approved = True
        user_to_approve.save(update_fields=["is_approved"])

        return Response(
            {
                "message": f"{user_to_approve.username} 님을 승인했습니다.",
                "user": UserDetailSerializer(user_to_approve).data,
            }
        )


class LoginAPIView(APIView):
    """세션 기반 로그인을 담당하는 APIView."""

    permission_classes = [AllowAny]

    @extend_schema(
        summary="직원 로그인",
        request=LoginSerializer,
        responses={status.HTTP_200_OK: UserDetailSerializer},
        description=(
            "세션을 생성해 사용자를 로그인 처리합니다."
            " 동일 계정의 기존 세션은 모두 종료해 동시 로그인을 방지합니다."
        ),
    )
    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = authenticate(
            request,
            username=serializer.validated_data["username"],
            password=serializer.validated_data["password"],
        )

        if not user:
            return Response(
                {"error": "아이디 또는 비밀번호가 올바르지 않습니다."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_approved:
            return Response(
                {"error": "아직 승인되지 않은 계정입니다."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # 초보 개발자 가이드: Session.objects.all()을 순회하면서
        # 현재 로그인하려는 사용자의 기존 세션을 찾아 삭제합니다.
        # 이렇게 하면 한 계정으로 여러 위치에서 동시에 로그인할 수 없습니다.
        for session in Session.objects.iterator():
            session_data = session.get_decoded()
            if session_data.get("_auth_user_id") == str(user.id):
                session.delete()

        login(request, user)
        return Response(UserDetailSerializer(user).data)


class LogoutAPIView(APIView):
    """현재 세션을 종료하는 APIView."""

    # 승인된 직원만 로그아웃 API를 호출할 수 있도록 double-check 합니다.
    permission_classes = [IsAuthenticated, IsApprovedStaff]

    @extend_schema(
        summary="직원 로그아웃",
        responses={
            status.HTTP_200_OK: {"type": "object", "properties": {"message": {"type": "string"}}}
        },
    )
    def post(self, request, *args, **kwargs):
        # Django의 logout 함수는 세션 데이터를 모두 삭제하고 sessionid 쿠키를 무효화합니다.
        logout(request)
        return Response({"message": "로그아웃되었습니다."})


class ProfileAPIView(APIView):
    """로그인한 직원의 정보를 반환하는 APIView."""

    # 세션이 유효하고, 승인된 직원만이 자신의 프로필을 열람할 수 있게 제한합니다.
    permission_classes = [IsAuthenticated, IsApprovedStaff]

    @extend_schema(summary="내 프로필 조회", responses={status.HTTP_200_OK: UserDetailSerializer})
    def get(self, request, *args, **kwargs):
        # request.user에는 세션 인증을 거친 사용자 객체가 자동으로 채워집니다.
        return Response(UserDetailSerializer(request.user).data)
