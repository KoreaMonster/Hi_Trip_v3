"""관리자 페이지에서 모니터링 모델을 다루기 위한 설정."""

from django.contrib import admin

from .models import HealthSnapshot, LocationSnapshot, MonitoringAlert


@admin.register(HealthSnapshot)
class HealthSnapshotAdmin(admin.ModelAdmin):
    """건강 스냅샷을 리스트로 확인하기 위한 관리자 설정."""

    list_display = ("participant", "measured_at", "heart_rate", "spo2", "status")
    list_filter = ("status", "participant__trip",)
    search_fields = ("participant__traveler__last_name_kr", "participant__traveler__first_name_kr")
    ordering = ("-measured_at",)


@admin.register(LocationSnapshot)
class LocationSnapshotAdmin(admin.ModelAdmin):
    """위치 스냅샷 관리자 설정."""

    list_display = ("participant", "measured_at", "latitude", "longitude", "accuracy_m")
    list_filter = ("participant__trip",)
    search_fields = ("participant__traveler__last_name_kr", "participant__traveler__first_name_kr")
    ordering = ("-measured_at",)


@admin.register(MonitoringAlert)
class MonitoringAlertAdmin(admin.ModelAdmin):
    """경보 이력을 빠르게 조회하기 위한 설정."""

    list_display = ("participant", "alert_type", "snapshot_time", "created_at")
    list_filter = ("alert_type", "participant__trip")
    search_fields = (
        "participant__traveler__last_name_kr",
        "participant__traveler__first_name_kr",
        "message",
    )
    ordering = ("-created_at",)

    # 향후 개선 아이디어:
    # - action으로 "CSV 내보내기"를 추가하면 관리자 페이지에서 바로 다운로드가 가능합니다.