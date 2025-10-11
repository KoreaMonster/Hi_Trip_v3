from Tools.scripts.var_access_benchmark import read_deque
from django.contrib.gis.gdal.prototypes.ds import release_ds
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
    #읽기 전용 필드
    place_name = serializers.CharField(
        source='place.name',     #place 모델의 name필드
        read_only=True,
        help_text="방문 장소 이름"
    )

    duration_display = serializers.SerializerMethodField(
        read_only=True,
        help_text="소요 시간을 사람이 읽기 쉬운 형식으로 표시"
    )

    class Meta:
        model = Schedule
        fields = [
            # 기본 필드
            'id',
            'trip',
            'place',
            'day_number',
            'start_time',
            'end_time',
            'duration_minutes',
            'transport',
            'main_content',
            'meeting_point',
            'budget',
            'order',

            # 추가 필드 (읽기 전용)
            'place_name',
            'duration_display',

            # 메타 정보
            'created_at',
            'updated_at',
        ]
        # 읽기 전용 필드
        read_only_fields = [
            'id',
            'duration_minutes',  # save()에서 자동 계산
            'created_at',
            'updated_at',
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
    category_id = serializers.IntegerField(
        write_only=True,
        required=False,
        allow_null=True,
        help_text="카테고리 ID"
    )

    #읽기 전용 추가 필드
    entrance_fee_display = serializers.CharField(
        source='enterance_fee_display',         #property 메서드
        read_only=True,
        help_text="포맷된 입장료"
    )

    activity_time_display = serializers.CharField(
        source='activity_time_display',         #property 메서드
        read_only=True,
        help_text="포맷된 활동 시간"
    )

    has_image = serializers.BooleanField(
        source = 'has_image',
        read_only=True,
        help_text="이미지 존재 여부"
    )

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

    def validate_category_id(self, value):
        """
        카테고리 ID 검증: 존재하는 카테고리인지 확인
        """
        if value is not None:
            if not PlaceCategory.objects.filter(id=value).exists():
                raise serializers.ValidationError('존재하지 않는 카테고리입니다.')
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

    def create(self, validated_data):
        """
        생성 시 category_id 처리
        """
        category_id = validated_data.pop('category_id', None)

        # category_id가 있으면 category 설정
        if category_id:
            validated_data['category_id'] = category_id

        return super().create(validated_data)

    def update(self, instance, validated_data):
        """
        수정 시 category_id 처리
        """
        category_id = validated_data.pop('category_id', None)

        # category_id가 있으면 category 설정
        if category_id:
            validated_data['category_id'] = category_id

        return super().update(instance, validated_data)

