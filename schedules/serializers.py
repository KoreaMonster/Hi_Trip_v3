"""Schedules 앱에서 사용할 Serializer 정의."""
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .constants import FIXED_RECOMMENDATION_PLACE_TYPES, SUPPORTED_TRAVEL_MODES
from .models import (
    Schedule,
    Place,
    PlaceCategory,
    CoordinatorRole,
    PlaceCoordinator,
    OptionalExpense,
)


#Schedule Serializer
class ScheduleSerializer(serializers.ModelSerializer):
    """
    Schedule 직렬화

    기능:
    일정 정보 -> json으로 변환
    추가 정보 제공
    입력 데이터 검증
    """
    """Schedule 모델의 입·출력을 담당하는 핵심 Serializer.

        - 읽기 전용 필드(`place_name`, `duration_display`)를 통해 프론트에서 바로 사용할 수 있는 정보를 제공합니다.
        - 쓰기 전용 필드(`place_id`)는 HTTP 요청 본문에서 정수 ID만 넘겨도 ForeignKey를 연결할 수 있게 도와줍니다.
        - `validate()`와 `create()`/`update()`에서 모델의 `clean()`과 `unique_together` 규칙을 직접 호출하여
            뷰(View) 코드에는 비즈니스 규칙이 남지 않도록 설계했습니다.
        """

    place = serializers.PrimaryKeyRelatedField(read_only=True, allow_null=True)

    # 사람 친화적 보조 정보
    place_name = serializers.CharField(
        source='place.name',
        read_only=True,
        help_text="방문 장소 이름"
    )
    duration_display = serializers.SerializerMethodField(
        read_only=True,
        help_text="소요 시간을 사람이 읽기 쉬운 형식으로 표시"
    )

    # === 쓰기 전용 ===
    # 요청에서 place_id(정수) → 내부적으로 place(객체)로 매핑
    place_id = serializers.PrimaryKeyRelatedField(
        source='place',
        queryset=Place.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
        help_text="장소 ID(선택). 없으면 null 일정으로 생성"
    )

    class Meta:
        model = Schedule
        fields = [
            # 기본 필드
            'id',
            'trip',
            'place',  # 읽기: 항상 응답에 포함 (null 가능)
            'place_id',  # 쓰기: 요청에서만 사용
            'day_number',
            'start_time',
            'end_time',
            'duration_minutes',
            'transport',
            'main_content',
            'meeting_point',
            'budget',
            'order',

            # 추가 읽기 필드
            'place_name',
            'duration_display',

            # 메타
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'duration_minutes',  # save()에서 자동 계산
            'created_at',
            'updated_at',
            'trip',
        ]

    def get_duration_display(self, obj):
        """
        소요 시간을 사람이 읽기 쉬운 형식으로 반환

        Args:
            obj: Schedule 인스턴스

        Returns:
            str: "3시간", "2시간 30분" 등
        """
        if not obj.duration_minutes:
            return "정보 없음"

        hours = obj.duration_minutes // 60
        minutes = obj.duration_minutes % 60

        if hours > 0 and minutes > 0:
            return f"{hours}시간 {minutes}분"
        elif hours > 0:
            return f"{hours}시간"
        elif minutes > 0:
            return f"{minutes}분"
        return "정보 없음"

    def validate(self, data):
        """
        전체 데이터 검증

        Args:
            data: 검증할 데이터 (dict)

        Returns:
            dict: 검증된 데이터

        Raises:
            ValidationError: 검증 실패 시
        """
        """모든 필드를 종합적으로 검증합니다.

                1) 시작·종료 시간의 순서를 확인하고,
                2) 일차(`day_number`) 값이 1 이상인지 체크하며,
                3) 같은 여행(trip) 안에서 같은 일차/순서가 중복되지는 않는지 검사합니다.

                CBV(ViewSet)에서 `serializer.is_valid()`만 호출하면 위 조건이 모두 자동으로 적용되므로
                뷰 코드에 별도의 if 문을 추가할 필요가 없습니다.
                """

        validated = super().validate(data)

        start_time = validated.get("start_time")
        end_time = validated.get("end_time")
        if start_time and end_time and end_time <= start_time:
            raise serializers.ValidationError(
                {"end_time": "종료 시간은 시작 시간보다 늦어야 합니다."}
            )

        day_number = validated.get("day_number")
        if day_number is not None and day_number < 1:
            raise serializers.ValidationError(
                {"day_number": "일차는 1 이상이어야 합니다."}
            )

        # ===== 동일한 날/순서 중복 검사 =====
        # ViewSet에서 context로 넘겨준 trip 객체를 사용합니다.
        trip = self.context.get("trip") or getattr(self.instance, "trip", None)
        order = validated.get("order")
        if trip and day_number is not None and order is not None:
            qs = Schedule.objects.filter(trip=trip, day_number=day_number, order=order)
            if self.instance is not None:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {
                        "non_field_errors": [
                            f"{day_number}일차의 {order}번째 순서는 이미 존재합니다."
                        ]
                    }
                )

        return validated

    def validate_budget(self, value):
        """
        예산 필드 검증

        Args:
            value: budget 값

        Returns:
            Decimal: 검증된 값

        Raises:
            ValidationError: 검증 실패 시
        """
        if value is not None and value < 0:
            raise serializers.ValidationError("예산은 0 이상이어야 합니다.")
        return value

    # --------------------------- 저장 로직 ---------------------------
    def _run_model_validation(self, instance: Schedule) -> None:
        """모델의 ``clean()``을 호출하여 추가 비즈니스 규칙을 실행합니다.

        DRF Serializer는 기본적으로 모델의 ``full_clean()``을 호출하지 않기 때문에
        우리가 직접 호출해야 모델에 정의된 검증 규칙이 함께 적용됩니다.
        """

        try:
            instance.full_clean()
        except DjangoValidationError as exc:  # 모델이 반환한 에러를 DRF 형식으로 변환
            raise serializers.ValidationError(exc.message_dict)

    def create(self, validated_data):
        """새로운 Schedule 인스턴스를 생성할 때 모델 검증을 함께 실행합니다."""

        schedule = Schedule(**validated_data)
        self._run_model_validation(schedule)
        schedule.save()
        return schedule

    def update(self, instance, validated_data):
        """기존 Schedule 업데이트 시에도 모델 검증을 보장합니다."""

        for field, value in validated_data.items():
            setattr(instance, field, value)
        self._run_model_validation(instance)
        instance.save()
        return instance


class PlaceCategorySerializer(serializers.ModelSerializer):
    """
    장소 카테고리 직렬화
    """
    class Meta:
        model = PlaceCategory
        fields = [
            'id',
            'name',
            'description',
            'created_at'
        ]
        read_only_fields = [
            'id',
            'created_at'
        ]


# ========== Place Serializer ==========
class PlaceSerializer(serializers.ModelSerializer):
    """
    장소 정보 직렬화

    핵심:
    - category: 중첩 객체로 표시 (읽기)
    - category_id: ID로 받음 (쓰기)
    - image: URL로 자동 변환
    - 추가 필드: 포맷된 입장료, 활동시간
    """
    #중첩 serializer - 읽기 전용
    category = PlaceCategorySerializer(read_only=True)

    #작성용 필드
    category_id = serializers.PrimaryKeyRelatedField(
        source="category",
        queryset=PlaceCategory.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
        help_text="카테고리 ID (선택). 없으면 카테고리 없이 생성됩니다."
    )


    #읽기 전용 추가 필드
    entrance_fee_display = serializers.CharField(
        # source='entrance_fee_display',          # ✅ TYPO CORRECTED
        read_only=True,
        help_text="포맷된 입장료"
    )

    activity_time_display = serializers.CharField(
        read_only=True,
        help_text="포맷된 활동 시간"
    )

    has_image = serializers.BooleanField(
        # source = 'has_image',
        read_only=True,
        help_text="이미지 존재 여부"
    )
    image = serializers.ImageField(required=False, allow_null=True)  # 테스트 요구에 맞춰 조정


    # ========== AI 대체 장소 정보 (파싱) ==========
    alternative_place_info = serializers.SerializerMethodField(
        read_only=True,
        help_text='AI 대체 장소 정보 (파싱됨)'
    )


    class Meta:
        model = Place
        fields = [
            # 기본 필드
            'id',
            'name',
            'address',
            'category',  # 읽기: 중첩 객체
            'category_id',  # 쓰기: ID
            'entrance_fee',
            'activity_time',
            'ai_alternative_place',
            'ai_generated_info',
            'ai_meeting_point',
            'image',

            # 추가 필드 (읽기 전용)
            'entrance_fee_display',
            'activity_time_display',
            'has_image',
            'alternative_place_info',

            # 메타 정보
            'created_at',
            'updated_at',
        ]

        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
        ]

    def get_alternative_place_info(self, obj):
        """
        AI 대체 장소 JSON 파싱

        Returns:
            dict or None
        """
        return obj.get_alternative_place_info()

    def validate_entrance_fee(self, value):
        """
        입장료 검증: 0 이상
        """
        if value is not None and value < 0:
            raise serializers.ValidationError('입장료는 0 이상이어야 합니다.')
        return value

    def validate_ai_alternative_place(self, value):
        """
        AI 대체 장소 JSON 검증

        기대 형식: {"place_name": "...", "reason": "..."}
        """
        if value:
            # dict 형태인지 확인
            if not isinstance(value, dict):
                raise serializers.ValidationError('JSON 형식이어야 합니다.')

            # 필수 키 확인 (선택 사항)
            # if 'place_name' not in value:
            #     raise serializers.ValidationError('place_name 키가 필요합니다.')

        return value

    #
    # def create(self, validated_data):
    #     category_id = validated_data.pop('category_id', None)
    #     if category_id:
    #         validated_data['category_id'] = category_id
    #     elif 'category' in validated_data:
    #         # category가 직접 전달된 경우 처리
    #         pass
    #     return super().create(validated_data)
    #
    # def update(self, instance, validated_data):
    #     """
    #     수정 시 category_id 처리
    #     """
    #     category_id = validated_data.pop('category_id', None)
    #
    #     # category_id가 있으면 category 설정
    #     if category_id:
    #         validated_data['category_id'] = category_id
    #
    #     return super().update(instance, validated_data)

class CoordinatorRoleSerializer(serializers.ModelSerializer):
    """
    담당자 역할 직렬화
    """
    class Meta:
        model = CoordinatorRole
        fields = [
            'id',
            'name',
            'description',
            'created_at'
        ]
        read_only_fields = [
            'id',
            'created_at'
        ]

class PlaceCoordinatorSerializer(serializers.ModelSerializer):
    """
    장소 담당자 직렬화

    - 읽기: 역할(role) 정보를 중첩해서 표시
    - 쓰기: 역할 ID(role_id), 장소 ID(place_id)를 받아 처리
    """
    # 읽기 전용: 응답에 역할 정보를 보기 좋게 포함
    role = CoordinatorRoleSerializer(read_only=True)

    # 쓰기 전용: 정수 ID로 입력 → 내부적으로 role(객체)에 바인딩
    role_id = serializers.PrimaryKeyRelatedField(
        source='role',
        queryset=CoordinatorRole.objects.all(),
        write_only=True,
        help_text="역할 ID"
    )
    # place는 URL로 고정되므로 읽기 전용으로만 노출 (본문 입력 금지)
    place = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = PlaceCoordinator
        fields = [
            'id',
            'place',  # read_only (URL로 고정, 뷰에서 save(place=place))
            'role',  # read_only (응답용)
            'role_id',  # write_only (요청용)
            'name',
            'phone',
            'note',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'place', 'created_at', 'updated_at']



# ========== OptionalExpense Serializer ==========
class OptionalExpenseSerializer(serializers.ModelSerializer):
    """
    선택적 지출 항목 직렬화

    - 읽기: 포맷된 가격(price_display) 표시
    - 쓰기: 장소 ID(place_id)를 받아 처리
    """
    # 읽기 전용 추가 필드
    price_display = serializers.CharField(
        # source='price_display',  # 모델의 @property 사용
        read_only=True,
        help_text="포맷된 가격 (예: '15,000원')"
    )
    #
    # # 쓰기 전용 필드
    # place_id = serializers.IntegerField(
    #     write_only=True,
    #     required=True,
    #     help_text="지출 항목이 속한 장소의 ID"
    # )

    # 쓰기 전용 필드: Nested Router에서 place를 자동 주입하지만, 단독 사용 시에도 ID 입력을 허용합니다.
    place_id = serializers.PrimaryKeyRelatedField(
        source="place",
        queryset=Place.objects.all(),
        write_only=True,
        required=False,
        help_text="지출 항목이 속한 장소의 ID",
    )

    class Meta:
        model = OptionalExpense
        fields = [
            # 기본 필드
            'id',
            'place',
            'place_id',         # 쓰기용
            'item_name',
            'price',
            'description',
            'display_order',

            # 추가 필드 (읽기 전용)
            'price_display',

            # 메타 정보
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
        ]
        # 쓰기 전용 필드는 Meta에 없어도 되지만, 명시적으로 place는 읽기 전용임을 나타낼 수 있음
        extra_kwargs = {
            'place': {'read_only': True}
        }


    def validate_price(self, value):
        """ 가격은 0 이상이어야 함 """
        if value is not None and value < 0:
            raise serializers.ValidationError("가격은 0 이상이어야 합니다.")
        return value

    def create(self, validated_data):
        """모델의 ``clean()``을 호출해 가격과 항목명 규칙을 재확인합니다."""

        expense = OptionalExpense(**validated_data)
        try:
            expense.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict)
        expense.save()
        return expense

    def update(self, instance, validated_data):
        """업데이트 시에도 모델 레벨 검증을 실행합니다."""

        for field, value in validated_data.items():
            setattr(instance, field, value)
        try:
            instance.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict)
        instance.save()
        return instance


class ExpenseSelectionSerializer(serializers.Serializer):
    """선택한 선택 비용 ID 목록을 검증하는 전용 Serializer.

    기존 함수형 뷰에서는 단순 리스트 검증만 수행했지만, Serializer로 분리하면
    ViewSet 액션에서도 재사용할 수 있고, 스웨거 문서에도 자동으로 노출됩니다.
    """

    expense_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
        help_text="합산할 OptionalExpense의 ID 목록",
    )


class FixedRecommendationRequestSerializer(serializers.Serializer):
    """고정 5개 카테고리 추천 API 입력 검증 전용 Serializer."""

    # 주소 문자열만 전달받은 경우 → 내부에서 Geocoding API 호출.
    address = serializers.CharField(
        required=False,
        allow_blank=False,
        help_text="여행 중심지 주소. 주소만 전달되면 서버가 Geocoding API로 위경도를 구합니다.",
    )
    # 이미 위경도를 알고 있다면 address 없이 latitude/longitude만 전달할 수 있습니다.
    latitude = serializers.FloatField(
        required=False,
        help_text="여행 중심지 위도 (address를 생략한 경우 필수)",
    )
    longitude = serializers.FloatField(
        required=False,
        help_text="여행 중심지 경도 (address를 생략한 경우 필수)",
    )

    def validate(self, attrs):
        """주소 또는 위경도 중 최소 한 가지는 반드시 입력되도록 보장합니다."""

        address = attrs.get("address")
        latitude = attrs.get("latitude")
        longitude = attrs.get("longitude")

        # 1) 주소가 없는 경우 → 위경도 모두 존재해야 한다.
        if not address:
            if latitude is None or longitude is None:
                raise serializers.ValidationError(
                    "주소가 없다면 latitude/longitude를 모두 전달해야 합니다."
                )
        # 2) 주소와 위경도가 동시에 들어온 경우는 허용하지만, 추후 로깅을 위해 그대로 유지.
        #    (실제 구현 단계에서 우선 순위를 정하기 쉽도록 그대로 attrs 반환)
        return attrs

    @property
    def fixed_categories(self):
        """뷰 로직에서 상수 목록을 재활용할 수 있도록 helper 프로퍼티를 제공합니다."""

        return FIXED_RECOMMENDATION_PLACE_TYPES

class AlternativePlaceRequestSerializer(serializers.Serializer):
    """대체 장소 추천 API 입력을 검증합니다."""

    previous_place_id = serializers.CharField(
        help_text="이전 일정의 Google Place ID (A)",
    )
    unavailable_place_id = serializers.CharField(
        help_text="방문 불가한 장소의 Google Place ID (X)",
    )
    next_place_id = serializers.CharField(
        help_text="다음 일정의 Google Place ID (Y)",
    )
    travel_mode = serializers.ChoiceField(
        choices=SUPPORTED_TRAVEL_MODES,
        help_text="Routes API에 전달할 이동 수단",
    )

    def validate(self, attrs):
        """입력된 Place ID가 모두 서로 다른지 확인합니다."""

        ids = {
            attrs.get("previous_place_id"),
            attrs.get("unavailable_place_id"),
            attrs.get("next_place_id"),
        }
        if None in ids:
            # 개별 필드 검증이 이미 수행되지만, 안전 차원에서 다시 확인
            raise serializers.ValidationError("Place ID는 모두 필수입니다.")

        if len(ids) != 3:
            raise serializers.ValidationError(
                "이전/현재/다음 장소의 Place ID는 서로 달라야 합니다."
            )
        return attrs

class ScheduleRebalanceRequestSerializer(serializers.Serializer):
    """하루 일정 재배치 요청을 검증하는 Serializer."""

    day_number = serializers.IntegerField(
        min_value=1,
        help_text="재배치할 여행 일차 (1일부터 시작)",
    )
    schedule_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
        help_text="새 순서대로 정렬된 Schedule ID 목록",
    )
    travel_mode = serializers.ChoiceField(
        choices=SUPPORTED_TRAVEL_MODES,
        help_text="이동 시간 계산에 사용할 이동 수단",
    )
    day_start_time = serializers.TimeField(
        required=False,
        help_text="일정 시작 기준 시각 (미입력 시 서버가 기존 일정의 가장 이른 시간을 사용)",
    )

    def validate_schedule_ids(self, value):
        """중복 Schedule ID가 들어오지 않도록 검증합니다."""

        if len(set(value)) != len(value):
            raise serializers.ValidationError("schedule_ids에 중복이 포함되어 있습니다.")
        return value

    def validate(self, attrs):
        """일차(day_number)와 일정 ID 목록이 비어 있지 않은지 최종 확인."""

        if not attrs.get("schedule_ids"):
            raise serializers.ValidationError("재배치할 일정 목록이 비어 있습니다.")
        return attrs
