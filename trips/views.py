from http.client import responses

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiParameter
from django.shortcuts import get_object_or_404

from .models import Trip, TripParticipant
from .serializers import TripSerializer, TripDetailSerializer, TripParticipantSerializer
from users.models import Traveler, User


#여행 목록을 조회
@extend_schema(
    summary= "여행 목록 조회",
    description= """
    로그인한 직원의 여행 목록을 반환합니다.
    - 총괄담장자: 모든 여행을 조회할 수 있음.
    - 담당자: 자신이 담당하는 여행만 조회 가능
    """,
    responses={200, TripSerializer(many=True)}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_trips(request):
    """
    여행 목록 조회
    GET /api/tirps
    """
    #1. 승인된 직원만 조회 가능
    if not request.user.is_approved:
        return Response(
            {"error":"승인되지 않은 직원입니다."},
            status = status.HTTP_403_FORBIDDEN
        )

    #2. 역할에 따라 다른 목록을 반환
    if request.user.role == "super_admin":
        # 총괄관리자는 모든 여행 목록
        trips = Trip.objects.all()
    else:
        #담당자는 자신이 담당하는 여행만
        trips = Trip.objects.filter(manager=request.user)

    serializer = TripSerializer(trips, many=True)

    return Response(serializer.data)

# 새로운 여행을 생성
@extend_schema(
    summary="여행 생성",
    description="새로운 여행을 생성합니다. 초대코드는 자동 생성됩니다.",
    request=TripSerializer,
    responses={201: TripSerializer}
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_trip(request):
    """
    여행 생성 API
    POST /api/trips/

    요청 예시:
    {
        "title": "제주도 힐링 여행",
        "destination": "제주도",
        "start_date": "2025-11-01",
        "end_date": "2025-11-03"
    }
    """
    #1. 승인된 담당자만 생성 가능
    if not request.user.is_approved:
        return Response(
            {'error':'승인되지 않은 담당자입니다.'},
            status=status.HTTP_403_FORBIDDEN
        )

    #2. 데이터 검증
    serializer = TripSerializer(data=request.data)

    if serializer.is_valid():
        #저장
        trip = serializer.save()

        return Response(
            TripSerializer(trip).data,
            status=status.HTTP_201_CREATED
        )
    #데이터 검증을 실패함
    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST
    )


#여행 상세 조회
@extend_schema(
    summary="여행 상세 조회",
    description="특정 여행의 상세 정보를 조회합니다. 참가자 목록 포함.",
    responses={200: TripDetailSerializer}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def trip_detail(request, trip_id):
    """
    여행 상세 조회 API
    GET /api/trips/{trip_id}/
    """
    #승인된 직원인지 확인
    if not request.user.is_approved:
        return Response(
            {'error':'승인되지 않은 직원입니다.'},
            status=status.HTTP_403_FORBIDDEN
        )

    #해당 여행을 찾기
    trip = get_object_or_404(Trip, id=trip_id)

    #해당 여행이 담당자의 여행인지 확인
    if request.user.role == 'manager' and trip.manager != request.user:
        return Response(
            {'error':'해당 여행에 접속 권한이 없습니다.'},
            status=status.HTTP_403_FORBIDDEN
        )

    #권한이 있어서 상세 정보를 변환해야함
    serializer = TripDetailSerializer(trip)

    return Response(serializer.data)

'''''
#초대코드를 보내서 참가

# ==================== 4. 초대코드로 참가 ====================
@extend_schema(
    summary="초대코드로 여행 참가",
    description="초대코드를 사용해 여행에 참가자를 등록합니다.",
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'invite_code': {'type': 'string', 'example': 'A3K9P2M1'},
                'traveler_id': {'type': 'integer', 'example': 3}
            },
            'required': ['invite_code', 'traveler_id']
        }
    },
    responses={201: TripParticipantSerializer}
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_trip(request):
    """
    초대코드로 여행 참가 API
    POST /api/trips/join/

    요청 예시:
    {
        "invite_code": "A3K9P2M1",
        "traveler_id": 3
    }
    """
    # 1. 승인된 직원만 등록 가능
    if not request.user.is_approved:
        return Response(
            {'error': '승인되지 않은 직원입니다.'},
            status=status.HTTP_403_FORBIDDEN
        )

    # 2. 요청 데이터 받기
    invite_code = request.data.get('invite_code')
    traveler_id = request.data.get('traveler_id')

    if not invite_code or not traveler_id:
        return Response(
            {'error': 'invite_code와 traveler_id가 필요합니다.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 3. 여행 찾기
    try:
        trip = Trip.objects.get(invite_code=invite_code)
    except Trip.DoesNotExist:
        return Response(
            {'error': '유효하지 않은 초대코드입니다.'},
            status=status.HTTP_404_NOT_FOUND
        )

    # 4. 참가자 찾기
    try:
        traveler = Traveler.objects.get(id=traveler_id)
    except Traveler.DoesNotExist:
        return Response(
            {'error': '존재하지 않는 참가자입니다.'},
            status=status.HTTP_404_NOT_FOUND
        )

    # 5. 중복 참가 확인
    if TripParticipant.objects.filter(trip=trip, traveler=traveler).exists():
        return Response(
            {'error': '이미 참가한 여행입니다.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 6. 참가 등록
    participant = TripParticipant.objects.create(
        trip=trip,
        traveler=traveler
    )

    # 7. 성공 응답
    serializer = TripParticipantSerializer(participant)
    return Response(
        {
            'message': f'{traveler.full_name_kr}님이 {trip.title}에 참가했습니다.',
            'participant': serializer.data
        },
        status=status.HTTP_201_CREATED
    )
'''''

#담당자 배정
@extend_schema(
    summary="여행 담당자 배정",
    description="총괄담당자만 실행 가능. 여행에 담당자를 배정합니다.",
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'manager_id': {'type': 'integer', 'example': 2}
            },
            'required': ['manager_id']
        }
    },
    responses={200: TripSerializer}
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assign_manager(request, trip_id):
    """
    담당자 배정 API
    POST /api/trips/{trip_id}/assign-manager/

    요청 예시:
    {
        "manager_id": 2
    }
    """
    #총괄 관리자만 사용 가능하도록
    if request.user.role != 'super_admin':
        return Response(
            {'error':'총괄관리자만 담당자를 배경할 수 있습니다.'},
            status=status.HTTP_403_FORBIDDEN
        )

    #여행 찾기
    trip = get_object_or_404(Trip, id=trip_id)

    #담당자 ID
    manager_id = request.data.get('manager_id')

    if not manager_id:
        return Response(
            {'error':'manager_id가 필요합니다.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    #담당자 찾기
    try:
        manager = User.objects.get(id=manager_id)
    except User.DoesNotExist:
        return Response(
            {'error':'존재하지 않는 직원입니다.'},
            status=status.HTTP_404_NOT_FOUND
        )

    # 5. 담당자 역할 확인
    if manager.role != 'manager':
        return Response(
            {'error': '담당자 역할을 가진 직원만 배정 가능합니다.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 6. 담당자 배정
    trip.manager = manager
    trip.save()

    # 7. 성공 응답
    serializer = TripSerializer(trip)
    return Response({
        'message': f'{manager.full_name_kr} 담당자를 배정했습니다.',
        'trip': serializer.data
    })