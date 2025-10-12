
from schedules.models import CoordinatorRole, PlaceCoordinator
from schedules.serializers import CoordinatorRoleSerializer, \
    PlaceCoordinatorSerializer
from rest_framework import status, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema
from django.shortcuts import get_object_or_404
from trips.models import Trip

from .models import Schedule, Place, PlaceCategory, OptionalExpense
from .serializers import (
    ScheduleSerializer,
    PlaceSerializer,
    PlaceCategorySerializer,
    OptionalExpenseSerializer
)

# Create your views here.

#schedule Views
#Create

# 권한 확인 헬퍼 함수 (새로 추가)
# ========================================
def check_trip_permission(user, trip):
    """
    사용자가 해당 여행의 일정을 관리할 권한이 있는지 확인합니다.
    (총괄담당자 이거나, 해당 여행을 담당하는 승인된 담당자인지 검사)
    """
    if not user.is_approved:
        # 테스트 02번 실패 원인: 승인되지 않은 사용자를 거르지 못함
        return False, Response({'error': '아직 승인되지 않은 계정입니다.'}, status=status.HTTP_403_FORBIDDEN)

    if user.role == 'super_admin':
        return True, None  # 총괄담당자는 항상 통과

    if user.role == 'manager' and trip.manager == user:
        return True, None  # 담당자는 자기 여행일 경우 통과

    # 테스트 03번 실패 원인: 다른 담당자의 접근을 막지 못함
    return False, Response({'error': '이 여행에 접근할 권한이 없습니다.'}, status=status.HTTP_403_FORBIDDEN)



@extend_schema(summary="일정 목록 조회 및 생성", tags=['Schedules'])
@api_view(['GET', 'POST']) # 하나의 함수가 GET과 POST를 모두 처리
@permission_classes([IsAuthenticated])
def schedule_list_create(request, trip_id):
    """
    GET: 해당 여행의 모든 일정 목록 조회
    POST: 해당 여행에 새 일정 생성
    """
    # 1. 여행 객체를 먼저 가져옵니다.
    trip = get_object_or_404(Trip, id=trip_id)

    # 2. (수정) 뷰 함수의 시작 부분에 권한 확인 로직을 추가합니다.
    has_permission, error_response = check_trip_permission(request.user, trip)
    if not has_permission:
        return error_response

    # 3. (수정) HTTP 메소드에 따라 로직을 분기합니다.
    if request.method == 'GET':
        schedules = Schedule.objects.filter(trip=trip)
        serializer = ScheduleSerializer(schedules, many=True)

        return Response(serializer.data, status=status.HTTP_200_OK)


    elif request.method == 'POST':
        serializer = ScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # (뷰 단계의 중복 검사) — 테스트가 기대하는 non_field_errors 포맷으로 던지기
        day_number = serializer.validated_data.get('day_number')
        order = serializer.validated_data.get('order')
        if Schedule.objects.filter(trip=trip, day_number=day_number, order=order).exists():
            raise serializers.ValidationError({
                'non_field_errors': [f'{day_number}일차의 {order}번째 순서는 이미 존재합니다.']
            })

        # FK는 URL 기준으로 주입
        schedule = serializer.save(trip=trip)
        return Response(ScheduleSerializer(schedule).data, status=status.HTTP_201_CREATED)


@extend_schema(summary="일정 상세 조회, 수정, 삭제", tags=['Schedules'])
@api_view(['GET', 'PUT', 'PATCH', 'DELETE']) # 상세 조회, 수정, 삭제를 모두 처리
@permission_classes([IsAuthenticated])
def schedule_detail_action(request, trip_id, schedule_id):
    """
    GET: 특정 일정 상세 정보
    PUT/PATCH: 특정 일정 수정
    DELETE: 특정 일정 삭제
    """
    # 1. trip_id와 schedule_id로 정확한 일정을 가져옵니다.
    schedule = get_object_or_404(Schedule, id=schedule_id, trip_id=trip_id)

    # 2. (수정) 여기에도 권한 확인 로직을 추가합니다.
    has_permission, error_response = check_trip_permission(request.user, schedule.trip)
    if not has_permission:
        return error_response

    # 3. (수정) HTTP 메소드에 따라 로직을 분기합니다.
    if request.method == 'GET':
        serializer = ScheduleSerializer(schedule)

        return Response(serializer.data, status=status.HTTP_200_OK)

    elif request.method == 'PUT' or request.method == 'PATCH':
        partial = (request.method == 'PATCH')
        # ⚠️ 입력 데이터에 들어온 trip 값을 신뢰하지 않습니다.
        #     trip은 URL로 고정되므로, save()에서 schedule.trip으로 강제 주입합니다.
        serializer = ScheduleSerializer(schedule, data=request.data, partial=partial)

        serializer.is_valid(raise_exception=True)
        updated = serializer.save(trip=schedule.trip)

        return Response(ScheduleSerializer(updated).data, status=status.HTTP_200_OK)

    elif request.method == 'DELETE':
        schedule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


"""
장소를 조회하려면? → list_places (전체 목록)
특정 장소 상세보기? → place_detail (하나만)
장소를 생성하려면? → create_place
장소를 수정하려면? → update_place
장소를 삭제하려면? → delete_place
OptionalExpense는?

특정 장소의 지출 항목 조회 → list_expenses
지출 항목 생성 → create_expense
선택한 항목 비용 계산 → calculate_expense (Class Method 활용!)

"""

@extend_schema(summary="장소 목록 조회 및 생성", tags=['Places'])
@api_view(['GET', 'POST']) # GET(목록), POST(생성)을 한 함수에서 처리
@permission_classes([IsAuthenticated])
def place_list_create(request):
    """
    GET: 모든 장소 목록을 조회합니다.
    POST: 새로운 장소를 생성합니다.
    """
    # (수정) HTTP 메소드에 따라 로직을 분기합니다.
    if request.method == 'GET':
        places = Place.objects.all()
        serializer = PlaceSerializer(places, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    elif request.method == 'POST':
        serializer = PlaceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        place = serializer.save()
        return Response(PlaceSerializer(place).data, status=status.HTTP_201_CREATED)



@extend_schema(summary="장소 상세 조회, 수정, 삭제", tags=['Places'])
@api_view(['GET', 'PUT', 'PATCH', 'DELETE']) # GET(상세), PUT/PATCH(수정), DELETE(삭제)를 한 함수에서 처리
@permission_classes([IsAuthenticated])
def place_detail_action(request, place_id):
    """
    GET: 특정 장소의 상세 정보를 조회합니다.
    PUT/PATCH: 특정 장소의 정보를 수정합니다.
    DELETE: 특정 장소를 삭제합니다.
    """
    place = get_object_or_404(Place, id=place_id)

    # (수정) HTTP 메소드에 따라 로직을 분기합니다.
    if request.method == 'GET':
        serializer = PlaceSerializer(place)

        return Response(serializer.data, status=status.HTTP_200_OK)

    elif request.method == 'PUT' or request.method == 'PATCH':
        partial = (request.method == 'PATCH')

        serializer = PlaceSerializer(place, data=request.data, partial=partial)

        serializer.is_valid(raise_exception=True)
        # 6) 저장:
        #    - Place가 Trip에 종속되어 있고, 그 소속을 바꾸면 안 된다면:
        #        updated = serializer.save(trip=place.trip)
        #      처럼 FK를 save() 인자로 강제 주입(본문 변조 무시).
        #    - 종속이 없다면 단순 저장即可.
        updated = serializer.save()
        return Response(PlaceSerializer(updated).data, status=status.HTTP_200_OK)

    elif request.method == 'DELETE':
        place.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

@extend_schema(summary="장소별 선택 비용 목록 조회 및 생성", tags=['Expenses'])
@api_view(['GET', 'POST']) # GET(목록), POST(생성)을 한 함수에서 처리
@permission_classes([IsAuthenticated])
def expense_list_create(request, place_id):
    """
    GET: 특정 장소의 모든 선택적 지출 항목을 조회합니다.
    POST: 특정 장소에 새로운 선택적 지출 항목을 추가합니다.
    """
    place = get_object_or_404(Place, id=place_id)

    if request.method == 'GET':
        expenses = OptionalExpense.objects.filter(place=place)
        serializer = OptionalExpenseSerializer(expenses, many=True)
        #   - 목록 조회는 성공 시 200 OK
        return Response(serializer.data, status=status.HTTP_200_OK)

    elif request.method == 'POST':
        serializer = OptionalExpenseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        expense = serializer.save(place=place)
        return Response(OptionalExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)




@extend_schema(
    summary="선택 비용 총합 계산",
    tags=['Expenses'],
    # request=YourInputSerializer,  # 입력 스키마를 만들면 여기에 지정하세요. 없으면 이 줄을 제거하세요.
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def calculate_expense(request):
    """
    선택한 선택 비용 항목들의 총합을 계산합니다.
    POST /api/schedules/expenses/calculate/
    """
    expense_ids = request.data.get('expense_ids')

    # 표준 에러 포맷: 잘못된 입력은 ValidationError로 던집니다.
    if not isinstance(expense_ids, list) or not expense_ids:
        raise serializers.ValidationError({
            'non_field_errors': ['expense_ids는 비어있지 않은 배열이어야 합니다.']
        })

    # (선택) 타입 검증: 모두 정수인지, 존재하는지 등 필요 시 추가
    # if not all(isinstance(x, int) for x in expense_ids):
    #     raise serializers.ValidationError({'expense_ids': ['정수 ID 배열이어야 합니다.']})

    result = OptionalExpense.calculate_selected_total(expense_ids)
    return Response(result, status=status.HTTP_200_OK)

# ========================================
# 장소 카테고리 (PlaceCategory) & 담당자 역할 (CoordinatorRole) Views
# ========================================

@extend_schema(summary="장소 카테고리 목록 조회", tags=['Categories & Roles'])
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_categories(request):
    categories = PlaceCategory.objects.all()
    serializer = PlaceCategorySerializer(categories, many=True)

    return Response(serializer.data)


@extend_schema(summary="담당자 역할 목록 조회", tags=['Categories & Roles'])
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_coordinator_roles(request):
    roles = CoordinatorRole.objects.all()
    serializer = CoordinatorRoleSerializer(roles, many=True)

    return Response(serializer.data)


# ========================================
# 장소 담당자 (PlaceCoordinator) Views (수정된 부분)
# ========================================

@extend_schema(summary="장소별 담당자 목록 조회 및 생성", tags=['Coordinators'])
@api_view(['GET', 'POST']) # GET(목록), POST(생성)을 한 함수에서 처리
@permission_classes([IsAuthenticated])
def coordinator_list_create(request, place_id):
    """
    GET: 특정 장소의 모든 담당자 목록을 조회합니다.
    POST: 특정 장소에 새로운 담당자를 추가합니다.
    """
    place = get_object_or_404(Place, id=place_id)

    if request.method == 'GET':
        coordinators = PlaceCoordinator.objects.filter(place=place)
        serializer = PlaceCoordinatorSerializer(coordinators, many=True)

        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = PlaceCoordinatorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        coordinator = serializer.save(place=place)

        return Response(PlaceCoordinatorSerializer(coordinator).data, status=status.HTTP_201_CREATED)

