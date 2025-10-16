# from rest_framework import status
# from rest_framework.decorators import api_view
# from rest_framework.response import Response
# from django.contrib.auth import authenticate, login, logout
# from django.contrib.sessions.models import Session
# from drf_spectacular.utils import extend_schema
# from .serializers import UserSerialization, UserDetailSerializer, LoginSerializer
# from rest_framework.permissions import IsAuthenticated
# from rest_framework.decorators import permission_classes
# from django.contrib.auth import get_user_model
#
# # Phase 1 안내:
# #   - 현재는 함수형 뷰이지만 다음 단계에서 ViewSet/APIView로 전환한다.
# #   - 이번 커밋에서는 Serializer 분리 및 권한 설계를 위한 주석/설명을 추가해
# #     초보 개발자가 전환 이유를 이해할 수 있도록 돕는다.
# @extend_schema(
#     request=UserSerialization,
#     responses={201: UserDetailSerializer},
#     description="직원 회원가입"
# )
# @api_view(['POST'])
# def register(request):
#     """
#     직원 회원가입 API
#     POST /api/auth/register/
#
#     요청 예시:
#     {
#         "username": "staff01",
#         "password": "password123",
#         "email": "staff@hitrip.com",
#         "phone": "010-1234-5678"
#     }
#     """
#     # 1. 요청 데이터를 Serializer로 검증
#     serializer = UserSerialization(data=request.data)
#
#     if serializer.is_valid():
#         # 2. 검증 통과 시 사용자 생성 (비밀번호 자동 해싱)
#         user = serializer.save()
#
#         # 3. 생성된 사용자 정보 반환 (비밀번호 제외)
#         return Response(
#             UserDetailSerializer(user).data,
#             status=status.HTTP_201_CREATED
#         )
#
#     # 4. 검증 실패 시 에러 메시지 반환
#     return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
#
#
# @extend_schema(
#     request=LoginSerializer,
#     responses={200: UserDetailSerializer},
#     description="직원 로그인 (Session 생성 및 동시 로그인 차단)"
# )
# @api_view(['POST'])
# def login_view(request):
#     """
#     로그인 API
#     POST /api/auth/login/
#
#     기능:
#     - 동일 아이디로 다른 곳에서 로그인 시 기존 세션 자동 삭제
#     - 협업 계획서 요구사항: "동일계정에 대한 동시 로그인 시 차단"
#
#     요청 예시:
#     {
#         "username": "staff01",
#         "password": "password123"
#     }
#     """
#     # 1. 로그인 데이터 검증
#     serializer = LoginSerializer(data=request.data)
#
    # if serializer.is_valid():
    #     # 2. username과 password로 사용자 인증
    #     user = authenticate(
    #         request,
    #         username=serializer.validated_data['username'],
    #         password=serializer.validated_data['password']
    #     )
    #
    #     if user:
    #         # [수정된 부분] 사용자가 승인되었는지 확인합니다.
    #         if not user.is_approved:
    #             return Response(
    #                 {'error': '아직 승인되지 않은 계정입니다.'},
    #                 status=status.HTTP_403_FORBIDDEN  # 403 Forbidden: 권한 없음
    #             )
    #         # 3. 동일 계정의 기존 세션 모두 삭제 (동시 로그인 차단)
    #         # 모든 세션을 순회하며 해당 사용자의 세션 찾아서 삭제
    #         for session in Session.objects.all():
    #             session_data = session.get_decoded()
    #             # 세션에 저장된 user_id가 현재 로그인하는 user의 id와 같으면
    #             if session_data.get('_auth_user_id') == str(user.id):
    #                 session.delete()  # 기존 세션 삭제 (기존 접속 강제 로그아웃) -> 삭제한다는 언급이 있으면 좋을듯
    #                 """
    #                 # 사용자에게 확인 후 차단 (프론트엔드 연동)
    #                 return Response({
    #                     'error': '다른 곳에서 로그인 중입니다. 기존 세션을 종료하고 로그인하시겠습니까?',
    #                     'existing_session': True
    #                 })
    #                 """
    #
    #
    #         # 4. 새로운 세션 생성 (새 접속만 유효)
    #         login(request, user)
#
#             # 5. 로그인 성공 - 사용자 정보 반환
#             return Response(UserDetailSerializer(user).data)
#
#         # 6. 인증 실패 (아이디 또는 비밀번호 오류)
#         return Response(
#             {'error': '아이디 또는 비밀번호가 올바르지 않습니다.'},
#             status=status.HTTP_401_UNAUTHORIZED
#         )
#
#     # 7. 데이터 검증 실패
#     return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
#
#
# @extend_schema(
#     request=None,  # 이 API는 요청 본문(body)이 없다고 명시적으로 알려줍니다.
#     responses={200: {'type': 'object', 'properties': {'message': {'type': 'string'}}}},
#     description="로그아웃 (Session 종료)"
# )
# @api_view(['POST'])
# def logout_view(request):
#     """
#     로그아웃 API
#     POST /api/auth/logout/
#
#     현재 사용자의 세션을 삭제합니다.
#     """
#     # 1. Django의 logout 함수 호출
#     #    - 현재 세션 데이터 삭제
#     #    - 클라이언트의 sessionid 쿠키 무효화
#     logout(request)
#
#     # 2. 성공 메시지 반환
#     return Response({'message': '로그아웃되었습니다.'})
#
#
# @extend_schema(
#     responses={200: UserDetailSerializer},
#     description="로그인한 직원 정보 조회"
# )
# @api_view(['GET'])
# @permission_classes([IsAuthenticated]) # 프로필 조회는 로그인한 사용자만 가능하도록 권한 추가
# def profile(request):
#     """
#     프로필 조회 API
#     GET /api/auth/profile/
#
#     로그인한 사용자의 정보를 반환합니다.
#     세션 쿠키로 자동 인증됩니다.
#     """
#     # 1. 세션으로 인증 여부 확인
#     #    Django가 자동으로 쿠키의 sessionid를 확인하고
#     #    request.user에 사용자 객체를 할당함
#
#     # 2. 로그인된 경우 - 사용자 정보 반환
#     return Response(UserDetailSerializer(request.user).data)
#
#
# @extend_schema(
#     request={'application/json': {'type': 'object', 'properties': {'user_id': {'type': 'integer'}}}},
#     responses={200: {'type': 'object', 'properties': {'message': {'type': 'string'}}}},
#     description="총괄담당자가 담당자를 승인"
# )
# @api_view(['POST'])
# @permission_classes([IsAuthenticated])  # 승인 API는 반드시 로그인한 사용자만 접근 가능
# def approve_user(request):
#     """
#     담당자 승인 API
#     POST /api/auth/approve/
#
#     총괄담당자만 실행 가능.
#     담당자의 is_approved를 True로 변경합니다.
#
#     요청 예시:
#     {
#         "user_id": 3
#     }
#     """
#     User = get_user_model()
#
#     # 1. 현재 로그인한 사용자가 총괄담당자인지 확인
#     if request.user.role != 'super_admin':
#         return Response(
#             {'error': '총괄담당자만 승인할 수 있습니다.'},
#             status=status.HTTP_403_FORBIDDEN
#         )
#
#     # 2. 승인할 사용자 ID 받기
#     user_id = request.data.get('user_id')
#     if not user_id:
#         return Response(
#             {'error': 'user_id를 입력해주세요.'},
#             status=status.HTTP_400_BAD_REQUEST
#         )
#
#     # 3. 해당 사용자 찾기
#     try:
#         user_to_approve = User.objects.get(id=user_id)
#     except User.DoesNotExist:
#         return Response(
#             {'error': '해당 사용자를 찾을 수 없습니다.'},
#             status=status.HTTP_404_NOT_FOUND
#         )
#
#     # 4. 이미 승인된 사용자인지 확인
#     if user_to_approve.is_approved:
#         return Response(
#             {'message': f'{user_to_approve.username} 님은 이미 승인된 사용자입니다.'}
#         )
#
#     # 5. 승인 처리
#     user_to_approve.is_approved = True
#     user_to_approve.save()
#
#     return Response({
#         'message': f'{user_to_approve.username} 님을 승인했습니다.',
#         'user': UserDetailSerializer(user_to_approve).data
#     })
#
#
"""사용자 관련 API 엔드포인트 모음."""
from __future__ import annotations

from logging import raiseExceptions

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.sessions.models import Session
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

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
            username = serializer.validated_data["username"],
            password = serializer.validated_data["password"],
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
        # 메모리 효율성이 떨어지지만 일당 이렇게 진행하고 대규모일때 수정하도록
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

