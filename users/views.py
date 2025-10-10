from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.contrib.auth import authenticate, login, logout
from django.contrib.sessions.models import Session
from drf_spectacular.utils import extend_schema
from .serializers import UserSerialization, LoginSerializer


@extend_schema(
    request=UserSerialization,
    responses={201: UserSerialization},
    description="직원 회원가입"
)
@api_view(['POST'])
def register(request):
    """
    직원 회원가입 API
    POST /api/auth/register/

    요청 예시:
    {
        "username": "staff01",
        "password": "password123",
        "email": "staff@hitrip.com",
        "phone": "010-1234-5678"
    }
    """
    # 1. 요청 데이터를 Serializer로 검증
    serializer = UserSerialization(data=request.data)

    if serializer.is_valid():
        # 2. 검증 통과 시 사용자 생성 (비밀번호 자동 해싱)
        user = serializer.save()

        # 3. 생성된 사용자 정보 반환 (비밀번호 제외)
        return Response(
            UserSerialization(user).data,
            status=status.HTTP_201_CREATED
        )

    # 4. 검증 실패 시 에러 메시지 반환
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    request=LoginSerializer,
    responses={200: UserSerialization},
    description="직원 로그인 (Session 생성 및 동시 로그인 차단)"
)
@api_view(['POST'])
def login_view(request):
    """
    로그인 API
    POST /api/auth/login/

    기능:
    - 동일 아이디로 다른 곳에서 로그인 시 기존 세션 자동 삭제
    - 협업 계획서 요구사항: "동일계정에 대한 동시 로그인 시 차단"

    요청 예시:
    {
        "username": "staff01",
        "password": "password123"
    }
    """
    # 1. 로그인 데이터 검증
    serializer = LoginSerializer(data=request.data)

    if serializer.is_valid():
        # 2. username과 password로 사용자 인증
        user = authenticate(
            request,
            username=serializer.validated_data['username'],
            password=serializer.validated_data['password']
        )

        if user:
            # 3. 동일 계정의 기존 세션 모두 삭제 (동시 로그인 차단)
            # 모든 세션을 순회하며 해당 사용자의 세션 찾아서 삭제
            for session in Session.objects.all():
                session_data = session.get_decoded()
                # 세션에 저장된 user_id가 현재 로그인하는 user의 id와 같으면
                if session_data.get('_auth_user_id') == str(user.id):
                    session.delete()  # 기존 세션 삭제 (기존 접속 강제 로그아웃) -> 삭제한다는 언급이 있으면 좋을듯
                    """
                    # 사용자에게 확인 후 차단 (프론트엔드 연동)
                    return Response({
                        'error': '다른 곳에서 로그인 중입니다. 기존 세션을 종료하고 로그인하시겠습니까?',
                        'existing_session': True
                    })
                    """


            # 4. 새로운 세션 생성 (새 접속만 유효)
            login(request, user)

            # 5. 로그인 성공 - 사용자 정보 반환
            return Response(UserSerialization(user).data)

        # 6. 인증 실패 (아이디 또는 비밀번호 오류)
        return Response(
            {'error': '아이디 또는 비밀번호가 올바르지 않습니다.'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    # 7. 데이터 검증 실패
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    responses={200: {'type': 'object', 'properties': {'message': {'type': 'string'}}}},
    description="로그아웃 (Session 종료)"
)
@api_view(['POST'])
def logout_view(request):
    """
    로그아웃 API
    POST /api/auth/logout/

    현재 사용자의 세션을 삭제합니다.
    """
    # 1. Django의 logout 함수 호출
    #    - 현재 세션 데이터 삭제
    #    - 클라이언트의 sessionid 쿠키 무효화
    logout(request)

    # 2. 성공 메시지 반환
    return Response({'message': '로그아웃되었습니다.'})


@extend_schema(
    responses={200: UserSerialization},
    description="로그인한 직원 정보 조회"
)
@api_view(['GET'])
def profile(request):
    """
    프로필 조회 API
    GET /api/auth/profile/

    로그인한 사용자의 정보를 반환합니다.
    세션 쿠키로 자동 인증됩니다.
    """
    # 1. 세션으로 인증 여부 확인
    #    Django가 자동으로 쿠키의 sessionid를 확인하고
    #    request.user에 사용자 객체를 할당함
    if request.user.is_authenticated:
        # 2. 로그인된 경우 - 사용자 정보 반환
        return Response(UserSerialization(request.user).data)

    # 3. 로그인되지 않은 경우 - 에러 반환
    return Response(
        {'error': '로그인이 필요합니다.'},
        status=status.HTTP_401_UNAUTHORIZED
    )