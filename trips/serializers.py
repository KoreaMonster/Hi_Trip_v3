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
            return f"{obj.manager.last_name_kr}{obj.manager.first_name_kr}" \
                if obj.manager.last_name_kr else obj.manager.username
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