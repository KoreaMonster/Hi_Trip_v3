"""실시간 모니터링(MVP)에서 사용하는 데이터 모델 모음."""

from django.db import models


class HealthSnapshot(models.Model):
    """여행 참가자의 건강 측정값을 시간 순으로 저장하는 모델."""

    participant = models.ForeignKey(
        "trips.TripParticipant",
        on_delete=models.CASCADE,
        related_name="health_snapshots",
        help_text="어떤 참가자의 측정값인지 지정합니다.",
    )
    measured_at = models.DateTimeField(
        help_text="데이터가 측정된 시각 (UTC 기준으로 저장).",
        db_index=True,
    )
    heart_rate = models.PositiveIntegerField(
        help_text="분당 심박수. 보통 40~180 사이의 값을 예상합니다.",
    )
    spo2 = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text="산소포화도(%). 소수점 둘째 자리까지 보관합니다.",
    )
    status = models.CharField(
        max_length=20,
        default="normal",
        help_text="서버에서 판정한 상태값 (예: normal, caution, danger).",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="레코드가 DB에 삽입된 시각.",
    )

    class Meta:
        ordering = ["-measured_at"]
        verbose_name = "건강 스냅샷"
        verbose_name_plural = "건강 스냅샷 목록"

    def __str__(self) -> str:
        return f"{self.participant_id} @ {self.measured_at:%Y-%m-%d %H:%M:%S}"  # pragma: no cover


class LocationSnapshot(models.Model):
    """여행 참가자의 위치 좌표 기록을 저장한다."""

    participant = models.ForeignKey(
        "trips.TripParticipant",
        on_delete=models.CASCADE,
        related_name="location_snapshots",
        help_text="좌표를 측정한 참가자.",
    )
    measured_at = models.DateTimeField(
        help_text="위치가 기록된 시각.",
        db_index=True,
    )
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        help_text="위도. 소수점 6자리면 약 0.11m 해상도를 제공합니다.",
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        help_text="경도. 소수점 6자리로 대부분의 도시 지역을 커버합니다.",
    )
    accuracy_m = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="위치 정확도(미터). 없으면 기기에서 값을 주지 않은 것입니다.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-measured_at"]
        verbose_name = "위치 스냅샷"
        verbose_name_plural = "위치 스냅샷 목록"

    def __str__(self) -> str:
        return f"{self.participant_id} @ ({self.latitude}, {self.longitude})"  # pragma: no cover


class MonitoringAlert(models.Model):
    """임계치를 벗어난 이벤트를 간략히 보관하는 모델."""

    ALERT_TYPE_CHOICES = [
        ("health", "건강 이상"),
        ("location", "위치 이탈"),
    ]

    participant = models.ForeignKey(
        "trips.TripParticipant",
        on_delete=models.CASCADE,
        related_name="monitoring_alerts",
        help_text="경보가 발생한 참가자.",
    )
    alert_type = models.CharField(
        max_length=20,
        choices=ALERT_TYPE_CHOICES,
        help_text="경보 분류 (건강/위치).",
    )
    message = models.TextField(
        help_text="관리자에게 보여줄 경보 요약 메시지.",
    )
    snapshot_time = models.DateTimeField(
        help_text="경보 판단에 사용한 측정 시각.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "모니터링 경보"
        verbose_name_plural = "모니터링 경보 목록"

    def __str__(self) -> str:
        return f"[{self.get_alert_type_display()}] {self.participant_id}"  # pragma: no cover

    # 향후 개선 사항:
    # - 경보 상태(해결 여부, 담당자) 필드를 추가하면 업무 히스토리를 남길 수 있습니다.
    # - Slack/이메일 전송 로그를 별도로 연결하여 감사 추적성을 확보할 수 있습니다.