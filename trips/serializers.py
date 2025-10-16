"""trips 앱에서 사용할 DRF Serializer 모음."""

from rest_framework import serializers
from users.models import User, Traveler
from users.serializers import TravelerSerializer
from .models import Trip, TripParticipant

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
            "id",
            "title",
            "destination",
            "start_date",
            "end_date",
            "status",
            "invite_code",
            "manager",
            "manager_name",
            "participant_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "invite_code",
            "participant_count",
            "created_at",
            "updated_at",
        ]

    def get_manager_name(self, obj):
        """
        "담당자(User)가 존재하면 한글 이름을 반환한다.
        담당자 이름 반환
        obj = Trip 인스턴스
        """
        if obj.manager:
            return obj.manager.full_name_kr
        return None

    def validate(self,data):
        """
        전체 데이터 검증
        end_date >= start_date 확인
        """
        start_date = data.get("start_date")
        end_date = data.get("end_date")

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError(
                "종료일은 시작일보다 빠를 수 없습니다."
            )


class TripParticipantSerializer(serializers.ModelSerializer):
    """
    여행 참가자를 생성/조회할 때 사용하는 Serializer.
    여행 참가자 정보 직렬화
    """
    traveler = TravelerSerializer(read_only=True)
    traveler_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        required=True,
        queryset=Traveler.objects.all(),
        source="traveler",
        help_text="참가자로 등록할 Traveler의 PK",
    )
    invite_code = serializers.CharField(
        write_only=True,
        required=False,
        help_text="선택: 초대코드가 전달됐다면 여기서 확인합니다.",
    )

    class Meta:
        model = TripParticipant
        fields = [
            "id",
            "trip",
            "traveler",
            "traveler_id",
            "invite_code",
            "joined_date",
        ]
        read_only_fields = ["id", "joined_date", "trip", "traveler"]

    def validate(self, attrs):
        """중복 참가 및 초대코드 일치 여부를 검사한다."""

        trip = self.context.get("trip")
        traveler = attrs.get("traveler")
        invite_code = attrs.pop("invite_code", None)

        if trip is None:
            raise serializers.ValidationError("trip context가 설정되지 않았습니다.")

        if invite_code and invite_code != trip.invite_code:
            raise serializers.ValidationError({"invite_code": "초대코드가 일치하지 않습니다."})

        if TripParticipant.objects.filter(trip=trip, traveler=traveler).exists():
            raise serializers.ValidationError("이미 참가한 여행입니다.")

        attrs["trip"] = trip
        return attrs

    def create(self, validated_data):
        """검증이 끝난 데이터를 사용해 참가자를 생성한다."""

        return TripParticipant.objects.create(**validated_data)

class TripDetailSerializer(TripSerializer):
    """참가자 목록을 포함한 상세 정보 Serializer."""

    participants = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = TripSerializer.Meta.fields + ["participants"]

    def get_participants(self, obj):
        """참가자 목록을 직렬화해 반환한다."""

        return TripParticipantSerializer(obj.participants.all(), many=True).data

    class AssignManagerSerializer(serializers.Serializer):
        """총괄담당자가 여행 담당자를 교체할 때 사용하는 전용 Serializer."""

        manager_id = serializers.PrimaryKeyRelatedField(
            queryset=User.objects.filter(role="manager"),
            source="manager",
            help_text="새롭게 배정할 담당자(User) ID",
        )

        def update_trip(self, trip: Trip) -> Trip:
            """Trip 인스턴스에 담당자를 배정하고 저장한 뒤 반환한다."""

            manager = self.validated_data["manager"]
            trip.assign_manager(manager)
            return trip