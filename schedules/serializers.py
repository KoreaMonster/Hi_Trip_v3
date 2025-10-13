from rest_framework import serializers
from .models import Schedule, Place, PlaceCategory, CoordinatorRole, PlaceCoordinator, OptionalExpense


#Schedule Serializer
class ScheduleSerializer(serializers.ModelSerializer):
    """
    Schedule 직렬화

    기능:
    일정 정보 -> json으로 변환
    추가 정보 제공
    입력 데이터 검증
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
        # end_time이 start_time보다 늦은지 확인
        start_time = data.get('start_time')
        end_time = data.get('end_time')

        if start_time and end_time:
            if end_time <= start_time:
                raise serializers.ValidationError({
                    'end_time': '종료 시간은 시작 시간보다 늦어야 합니다.'
                })

        # day_number가 양수인지 확인
        day_number = data.get('day_number')
        if day_number and day_number < 1:
            raise serializers.ValidationError({
                'day_number': '일차는 1 이상이어야 합니다.'
            })

        return data

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
            raise serializers.ValidationError('예산은 0 이상이어야 합니다.')
        return value

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

    def validate_place_id(self, value):
        """ 장소 ID가 실제로 존재하는지 검증 """
        if not Place.objects.filter(id=value).exists():
            raise serializers.ValidationError("존재하지 않는 장소 ID입니다.")
        return value

    def create(self, validated_data):
        """
        생성 시에는 validated_data에 place_id가 포함되어 있으므로
        ModelSerializer가 자동으로 처리
        """
        return super().create(validated_data)
