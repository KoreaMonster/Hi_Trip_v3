from rest_framework import serializers
from .models import TripParticipant, Trip
from users.serializers import TravelerSerializer

class TripSerializer(serializers.ModelSerializer):
    """
    여행 정보 직렬화
    """
    # 추가 필드 (읽기 전용)
    manager_name = serializers.SerializerMethodField()
    participant_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Trip
        fields = [
            'id',
            'title',
            'destination',
            'start_date',
            'end_date',
            'status',
            'invite_code',
            'manager',
            'manager_name',      # 추가 필드
            'participant_count',  # 추가 필드
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'invite_code',       # 자동 생성
            'participant_count',
            'created_at',
            'updated_at'
        ]

    def get_manager_name(self, obj):
        """
        담당자 이름 반환
        obj = Trip 인스턴스
        """
        if obj.manager:
            #담당자가 있으면
            return obj.manager.full_name_kr
        return None  # 담당자 없으면 None

    def validate(self,data):
        """
        전체 데이터 검증
        end_date >= start_date 확인
        """

        start_date = data.get('start_date')
        end_date = data.get('end_date')

        if start_date and end_date:
            if end_date < start_date:
                raise serializers.ValidationError(
                    "종료일은 시작일보다 빠를 수 없습니다."
                )
        return data


class TripParticipantSerializer(serializers.ModelSerializer):
    """
    여행 참가자 정보 직렬화
    """
    # Traveler 정보를 중첩(nested)해서 표시
    traveler = TravelerSerializer(read_only=True)

    # 또는 ID만 받을 때 (참가 등록 시)
    traveler_id = serializers.IntegerField(write_only=True, required=True)

    class Meta:
        model = TripParticipant
        fields = [
            'id',
            'trip',
            'traveler',      # 읽기용 (전체 정보)
            'traveler_id',   # 쓰기용 (ID만)
            'joined_date',
        ]
        read_only_fields = ['id', 'joined_date']

class TripDetailSerializer(TripSerializer):
    """
    여행 상세 정보 직렬화 (참가자 목록 포함)
    """
    # 이 여행의 모든 참가자 표시
    participants = TripParticipantSerializer(many=True, read_only=True)

    class Meta:
        model = Trip #DRF에서 상속을 활용했음. 여기서 부모의 Meta의 속성이 상속될 것이라 예상 -> 그러나 완전이 덮어씀(override)
        # 부모 클래스의 fields에 participants 추가
        fields = TripSerializer.Meta.fields + ['participants']