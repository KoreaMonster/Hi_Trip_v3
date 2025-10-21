"""모니터링 API 응답에 사용할 DRF Serializer."""

from rest_framework import serializers

from .models import HealthSnapshot, LocationSnapshot, MonitoringAlert

class HealthCheckSerializer(serializers.Serializer):
    """헬스 체크 응답의 간단한 JSON 구조."""

    status = serializers.CharField(read_only=True)
    message = serializers.CharField(read_only=True)
    service = serializers.CharField(read_only=True)


class HealthSnapshotSerializer(serializers.ModelSerializer):
    """HealthSnapshot을 읽기 전용으로 노출한다."""

    class Meta:
        model = HealthSnapshot
        fields = [
            "id",
            "measured_at",
            "heart_rate",
            "spo2",
            "status",
        ]
        read_only_fields = fields


class LocationSnapshotSerializer(serializers.ModelSerializer):
    """LocationSnapshot을 읽기 전용으로 직렬화."""

    class Meta:
        model = LocationSnapshot
        fields = [
            "id",
            "measured_at",
            "latitude",
            "longitude",
            "accuracy_m",
        ]
        read_only_fields = fields


class ParticipantLatestSerializer(serializers.Serializer):
    """참가자별 최신 건강/위치 상태를 묶어서 반환한다."""

    participant_id = serializers.IntegerField(read_only=True)
    traveler_name = serializers.CharField(read_only=True)
    trip_id = serializers.IntegerField(read_only=True)
    health = HealthSnapshotSerializer(read_only=True, allow_null=True)
    location = LocationSnapshotSerializer(read_only=True, allow_null=True)


class MonitoringAlertSerializer(serializers.ModelSerializer):
    """경고 이력을 간단히 반환하기 위한 Serializer."""

    participant = serializers.PrimaryKeyRelatedField(read_only=True)
    traveler_name = serializers.SerializerMethodField()
    trip_id = serializers.SerializerMethodField()

    class Meta:
        model = MonitoringAlert
        fields = [
            "id",
            "participant",
            "traveler_name",
            "trip_id",
            "alert_type",
            "message",
            "snapshot_time",
            "created_at",
        ]
        read_only_fields = fields

    def get_traveler_name(self, obj) -> str:
        """관리자 화면에서 참가자를 바로 식별하도록 이름을 제공합니다."""

        traveler = obj.participant.traveler
        return traveler.full_name_kr

    def get_trip_id(self, obj) -> int:
        """프런트에서 trip 필터링을 쉽게 하도록 Trip ID를 노출."""

        return obj.participant.trip_id


class DemoGenerationSerializer(serializers.Serializer):
    """데모 데이터를 API로 생성할 때 사용할 옵션."""

    minutes = serializers.IntegerField(
        min_value=1,
        max_value=60,
        default=10,
        help_text="몇 분 분량의 데이터를 생성할지 설정합니다 (기본 10분).",
    )
    interval = serializers.IntegerField(
        min_value=10,
        max_value=600,
        default=60,
        help_text="측정 간격(초). 기본값은 60초입니다.",
    )

    def validate(self, attrs):
        """minutes와 interval의 조합이 지나치게 많은 레코드를 만들지 확인."""

        minutes = attrs["minutes"]
        interval = attrs["interval"]
        total_points = (minutes * 60) // interval
        if total_points > 120:
            raise serializers.ValidationError(
                "한 번에 120개를 초과하는 데이터는 생성하지 않도록 제한했습니다."
            )
        return attrs

    def generate(self, trip: "Trip"):
        """View에서 호출하여 실제로 더미 데이터를 생성합니다."""

        from .services import generate_demo_snapshots_for_trip

        return generate_demo_snapshots_for_trip(
            trip=trip,
            minutes=self.validated_data["minutes"],
            interval_seconds=self.validated_data["interval"],
        )


class DemoGenerationResultSerializer(serializers.Serializer):
    """데모 데이터 생성 요청의 응답 구조."""

    created_records = serializers.IntegerField(read_only=True)
    minutes = serializers.IntegerField(read_only=True)
    interval_seconds = serializers.IntegerField(read_only=True)


class ParticipantHistorySerializer(serializers.Serializer):
    """특정 참가자의 건강·위치 측정 이력을 반환한다."""

    participant_id = serializers.IntegerField(read_only=True)
    traveler_name = serializers.CharField(read_only=True)
    trip_id = serializers.IntegerField(read_only=True)
    health = HealthSnapshotSerializer(many=True, read_only=True)
    location = LocationSnapshotSerializer(many=True, read_only=True)


# 향후 개선 사항:
# - Serializer에 geofence 기준점 등 Trip의 메타 데이터를 포함해 주면 프런트에서
#   지도 반경을 그릴 때 별도의 API 호출이 필요 없습니다.