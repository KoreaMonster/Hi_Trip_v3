
from schedules.models import CoordinatorRole, PlaceCoordinator
from schedules.serializers import CoordinatorRoleSerializer, \
    PlaceCoordinatorSerializer
from rest_framework import status
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
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = ScheduleSerializer(data=request.data)
        if serializer.is_valid():
            # trip 객체를 save()에 직접 전달하여 관계를 설정합니다.
            serializer.save(trip=trip)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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
        return Response(serializer.data)

    elif request.method == 'PUT' or request.method == 'PATCH':
        partial = request.method == 'PATCH'
        serializer = ScheduleSerializer(schedule, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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

extend_schema(summary="장소 목록 조회 및 생성", tags=['Places'])
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
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = PlaceSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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
        return Response(serializer.data)

    elif request.method == 'PUT' or request.method == 'PATCH':
        partial = request.method == 'PATCH'
        serializer = PlaceSerializer(place, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        place.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
#
# @extend_schema(
#     summary="장소 목록 조회",
#     description="모든 장소 목록을 반환합니다.",
#     responses={200: PlaceSerializer(many=True)}
# )
# @api_view(['GET'])
# @permission_classes([IsAuthenticated])
# def list_places(request):
#     """
#     장소 목록 조회
#     GET /api/schedules/places/
#     """
#     #모든 장소 조회
#     places = Place.objects.all()
#
#     serializer = PlaceSerializer(places, many=True)
#
#     return Response(serializer.data)
#
#
# @extend_schema(
#     summary="장소 상세 조회",
#     description="특정 장소의 상세 정보를 반환합니다.",
#     responses={200: PlaceSerializer}
# )
# @api_view(['GET'])
# @permission_classes([IsAuthenticated])
# def place_detail(request, place_id):
#     """
#     장소 상세 조회
#     GET /api/schedules/places/{place_id}/
#     """
#     place = get_object_or_404(Place, id = place_id)
#
#     serializer = PlaceSerializer(place)
#
#     return Response(serializer.data)
#
#
# @extend_schema(
#     summary="장소 생성",
#     description="새로운 장소를 생성합니다. 이미지 파일 업로드 가능.",
#     request=PlaceSerializer,
#     responses={201: PlaceSerializer}
# )
# @api_view(['POST'])
# @permission_classes([IsAuthenticated])
# def create_place(request):
#     """
#     장소 생성
#     POST /api/schedules/places/create/
#
#     요청 예시:
#     {
#         "name": "경복궁",
#         "address": "서울특별시 종로구 사직로 161",
#         "category_id": 1,
#         "entrance_fee": 3000,
#         "activity_time": "2:30:00",
#         "ai_alternative_place": {
#             "place_name": "국립중앙박물관",
#             "reason": "우천 시 대체 가능"
#         }
#     }
#
#     파일 업로드:
#     - FormData로 전송 시 image 필드에 파일 첨부
#     """
#     # 데이터 검증
#     serializer = PlaceSerializer(data=request.data)
#
#     if serializer.is_valid():
#         place = serializer.save()
#
#         return Response(
#             PlaceSerializer(place).data,
#             status = status.HTTP_201_CREATED
#         )
#     return Response(
#         serializer.errors,
#         status=status.HTTP_400_BAD_REQUEST
#     )
#
#
# @extend_schema(
#     summary="장소 수정",
#     description="기존 장소 정보를 수정합니다. PATCH는 부분 수정 가능.",
#     request=PlaceSerializer,
#     responses={200: PlaceSerializer}
# )
# @api_view(['PUT', 'PATCH'])
# @permission_classes([IsAuthenticated])
# def update_place(request, place_id):
#     """
#     장소 수정
#     PUT /api/schedules/places/{place_id}/update/  (전체 수정)
#     PATCH /api/schedules/places/{place_id}/update/  (부분 수정)
#
#     요청 예시 (PATCH):
#     {
#         "entrance_fee": 5000  // 입장료만 수정
#     }
#     """
#     # 1. 장소 조회
#     place = get_object_or_404(Place, id=place_id)
#
#     #put 인지 patch인지
#     partial = request.method == "PATCH"
#
#     #데이터 검증
#     serializer = PlaceSerializer(
#         place,
#         data=request.data,
#         partial=partial
#     )
#
#     #유효성 검사
#     if serializer.is_valid():
#         serializer.save()
#         return Response(serializer.data)
#     return Response(
#         serializer.errors,
#         status=status.HTTP_400_BAD_REQUEST
#     )
#
#
# @extend_schema(
#     summary="장소 삭제",
#     description="장소를 삭제합니다. 연결된 일정, 담당자, 지출 항목도 함께 삭제됩니다.",
#     responses={204: None}
# )
# @api_view(['DELETE'])
# @permission_classes([IsAuthenticated])
# def delete_place(request, place_id):
#     """
#     장소 삭제
#     DELETE /api/schedules/places/{place_id}/delete/
#
#     주의: CASCADE로 연결된 데이터도 함께 삭제됩니다.
#     - 이 장소를 참조하는 Schedule (place 필드만 NULL)
#     - PlaceCoordinator (담당자)
#     - OptionalExpense (지출 항목)
#     """
#     # 1. 장소 조회
#     place = get_object_or_404(Place, id=place_id)
#
#     place.delete()
#
#     return Response(status=status.HTTP_204_NO_CONTENT)

# 선택 비용 (Optional Expense) Views (수정된 부분)
# ========================================

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
        return Response(serializer.data)

    elif request.method == 'POST':
        # (수정) 요청 데이터에 place_id를 자동으로 추가합니다.
        data = request.data.copy()
        data['place_id'] = place.id
        serializer = OptionalExpenseSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(summary="선택 비용 총합 계산", tags=['Expenses'], request=...) # 내용은 이전과 동일
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def calculate_expense(request):
    """
    선택한 선택 비용 항목들의 총합을 계산합니다.
    POST /api/schedules/expenses/calculate/
    """
    expense_ids = request.data.get('expense_ids', [])
    if not expense_ids or not isinstance(expense_ids, list):
        return Response({'error': 'expense_ids는 비어있지 않은 배열이어야 합니다.'}, status=status.HTTP_400_BAD_REQUEST)

    result = OptionalExpense.calculate_selected_total(expense_ids)
    return Response(result)


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
        # (수정) 요청 데이터에 place_id를 자동으로 추가합니다.
        data = request.data.copy()
        data['place_id'] = place.id
        serializer = PlaceCoordinatorSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# ==================== OptionalExpense Views ====================
#
# @extend_schema(
#     summary="장소별 선택적 지출 항목 조회",
#     description="특정 장소의 모든 선택적 지출 항목을 반환합니다.",
#     responses={200: OptionalExpenseSerializer(many=True)}
# )
# @api_view(['GET'])
# @permission_classes([IsAuthenticated])
# def list_expenses(request, place_id):
#     """
#     장소별 지출 항목 조회
#     GET /api/schedules/places/{place_id}/expenses/
#
#     응답 예시:
#     [
#         {
#             "id": 1,
#             "item_name": "한복 대여",
#             "price": 15000,
#             "price_display": "15,000원",
#             "description": "2시간 기준"
#         },
#         ...
#     ]
#     """
#     # 1. 장소 존재 확인
#     place = get_object_or_404(Place, id=place_id)
#     # 지출항목
#     expenses = OptionalExpense.objects.filter(place=place)
#     #변환
#     serializer = OptionalExpenseSerializer(expenses, many=True)
#
#     return  Response(serializer.data)
#
#
# @extend_schema(
#     summary="선택적 지출 항목 생성",
#     description="특정 장소에 새로운 선택적 지출 항목을 추가합니다.",
#     request=OptionalExpenseSerializer,
#     responses={201: OptionalExpenseSerializer}
# )
# @api_view(['POST'])
# @permission_classes([IsAuthenticated])
# def create_expense(request, place_id):
#     """
#     지출 항목 생성
#     POST /api/schedules/places/{place_id}/expenses/create/
#
#     요청 예시:
#     {
#         "item_name": "한복 대여",
#         "price": 15000,
#         "description": "2시간 기준",
#         "display_order": 1
#     }
#
#     주의: place_id는 URL에서 자동으로 처리됩니다.
#     """
#     # 1. 장소 존재 확인
#     place = get_object_or_404(Place, id=place_id)
#
#     # 2. 요청 데이터에 place_id 추가
#     data = request.data.copy()
#     data['place_id'] = place_id
#
#     serializer = OptionalExpenseSerializer(data=data)
#
#     if serializer.is_valid():
#         expense = serializer.save()
#         return Response(
#             OptionalExpenseSerializer(expense).data,
#             status=status.HTTP_201_CREATED
#         )
#     return Response(
#         serializer.errors,
#         status=status.HTTP_400_BAD_REQUEST
#     )
#
#
# @extend_schema(
#     summary="선택한 항목의 총 비용 계산",
#     description="사용자가 선택한 지출 항목들의 총 비용을 계산합니다.",
#     request={
#         'application/json': {
#             'type': 'object',
#             'properties': {
#                 'expense_ids': {
#                     'type': 'array',
#                     'items': {'type': 'integer'},
#                     'example': [1, 2, 5]
#                 }
#             },
#             'required': ['expense_ids']
#         }
#     },
#     responses={
#         200: {
#             'type': 'object',
#             'properties': {
#                 'total': {'type': 'integer'},
#                 'count': {'type': 'integer'},
#                 'formatted_total': {'type': 'string'},
#                 'items': {'type': 'array'}
#             }
#         }
#     }
# )
# @api_view(['POST'])
# @permission_classes([IsAuthenticated])
# def calculate_expense(request):
#     """
#     선택한 항목의 총 비용 계산
#     POST /api/schedules/expenses/calculate/
#
#     요청 예시:
#     {
#         "expense_ids": [1, 2, 5]
#     }
#
#     응답 예시:
#     {
#         "total": 18000,
#         "count": 2,
#         "formatted_total": "18,000원",
#         "items": [
#             {
#                 "id": 1,
#                 "item_name": "한복 대여",
#                 "price": 15000,
#                 "price_display": "15,000원",
#                 "place_name": "경복궁"
#             },
#             ...
#         ]
#     }
#     """
#     # 1. 요청 데이터에서 expense_ids 추출
#     expense_ids = request.data.get('expense_ids', [])
#
#     # 2. 입력 검증
#     if not expense_ids:
#         return Response(
#             {'error': 'expense_ids가 필요합니다.'},
#             status=status.HTTP_400_BAD_REQUEST
#         )
#
#     if not isinstance(expense_ids, list):
#         return Response(
#             {'error': 'expense_ids는 배열이어야 합니다.'},
#             status=status.HTTP_400_BAD_REQUEST
#         )
#
#     # 3. Class Method 호출 (모델에 정의된 로직 사용)
#     result = OptionalExpense.calculate_selected_total(expense_ids)
#
#     # 4. 결과 반환
#     return Response(result)
#
#
# # ==================== PlaceCategory Views (보너스) ====================
#
# @extend_schema(
#     summary="장소 카테고리 목록 조회",
#     description="모든 장소 카테고리 목록을 반환합니다.",
#     responses={200: PlaceCategorySerializer(many=True)}
# )
# @api_view(['GET'])
# @permission_classes([IsAuthenticated])
# def list_categories(request):
#     """
#     카테고리 목록 조회
#     GET /api/schedules/categories/
#     """
#     categories = PlaceCategory.objects.all()
#     serializer = PlaceCategorySerializer(categories, many=True)
#     return Response(serializer.data)
#
#
# # ==================== PlaceCoordinator Views ====================
#
# @extend_schema(
#     summary="장소별 담당자 목록 조회",
#     responses={200: PlaceCoordinatorSerializer(many=True)}
# )
# @api_view(['GET'])
# @permission_classes([IsAuthenticated])
# def list_coordinators(request, place_id):
#     """
#     장소별 담당자 목록
#     GET /api/schedules/places/{place_id}/coordinators/
#     """
#     place = get_object_or_404(Place, id=place_id)
#     coordinators = PlaceCoordinator.objects.filter(place=place)
#     serializer = PlaceCoordinatorSerializer(coordinators, many=True)
#     return Response(serializer.data)
#
#
# @extend_schema(
#     summary="담당자 생성",
#     request=PlaceCoordinatorSerializer,
#     responses={201: PlaceCoordinatorSerializer}
# )
# @api_view(['POST'])
# @permission_classes([IsAuthenticated])
# def create_coordinator(request, place_id):
#     """
#     담당자 생성
#     POST /api/schedules/places/{place_id}/coordinators/create/
#
#     Body: {
#         "role_id": 1,
#         "name": "김문화",
#         "phone": "010-1234-5678",
#         "note": "9시 출근"
#     }
#     """
#     place = get_object_or_404(Place, id=place_id)
#
#     data = request.data.copy()
#     data['place_id'] = place_id
#
#     serializer = PlaceCoordinatorSerializer(data=data)
#
#     if serializer.is_valid():
#         coordinator = serializer.save()
#         return Response(
#             PlaceCoordinatorSerializer(coordinator).data,
#             status=status.HTTP_201_CREATED
#         )
#
#     return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
#
#
# @extend_schema(
#     summary="담당자 역할 목록 조회",
#     responses={200: CoordinatorRoleSerializer(many=True)}
# )
# @api_view(['GET'])
# @permission_classes([IsAuthenticated])
# def list_coordinator_roles(request):
#     """
#     담당자 역할 목록
#     GET /api/schedules/coordinator-roles/
#     """
#     roles = CoordinatorRole.objects.all()
#     serializer = CoordinatorRoleSerializer(roles, many=True)
#     return Response(serializer.data)
