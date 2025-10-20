"""monitoring 앱의 스냅샷·알림 로직을 50개의 현실 사례로 검증한다."""

from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from monitoring import services
from monitoring.models import MonitoringAlert
from trips.models import TripParticipant


MONITORING_VARIANTS = [
    {
        "label": "정상 상태 1",
        "heart_rate": 75,
        "spo2": "95.50",
        "latitude": 37.5657,
        "longitude": 126.978,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": False,
    },
    {
        "label": "정상 상태 2",
        "heart_rate": 80,
        "spo2": "96.00",
        "latitude": 37.5665,
        "longitude": 126.9789,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": False,
    },
    {
        "label": "정상 상태 3",
        "heart_rate": 85,
        "spo2": "95.00",
        "latitude": 37.5673,
        "longitude": 126.9798,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": False,
    },
    {
        "label": "정상 상태 4",
        "heart_rate": 90,
        "spo2": "95.50",
        "latitude": 37.5681,
        "longitude": 126.9771,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": False,
    },
    {
        "label": "정상 상태 5",
        "heart_rate": 95,
        "spo2": "96.00",
        "latitude": 37.5649,
        "longitude": 126.978,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": False,
    },
    {
        "label": "정상 상태 6",
        "heart_rate": 70,
        "spo2": "95.00",
        "latitude": 37.5657,
        "longitude": 126.9789,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": False,
    },
    {
        "label": "정상 상태 7",
        "heart_rate": 75,
        "spo2": "95.50",
        "latitude": 37.5665,
        "longitude": 126.9798,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": False,
    },
    {
        "label": "정상 상태 8",
        "heart_rate": 80,
        "spo2": "96.00",
        "latitude": 37.5673,
        "longitude": 126.9771,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": False,
    },
    {
        "label": "정상 상태 9",
        "heart_rate": 85,
        "spo2": "95.00",
        "latitude": 37.5681,
        "longitude": 126.978,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": False,
    },
    {
        "label": "정상 상태 10",
        "heart_rate": 90,
        "spo2": "95.50",
        "latitude": 37.5649,
        "longitude": 126.9789,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": False,
    },
    {
        "label": "정상 상태 11",
        "heart_rate": 95,
        "spo2": "96.00",
        "latitude": 37.5657,
        "longitude": 126.9798,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": False,
    },
    {
        "label": "정상 상태 12",
        "heart_rate": 70,
        "spo2": "95.00",
        "latitude": 37.5665,
        "longitude": 126.9771,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": False,
    },
    {
        "label": "정상 상태 13",
        "heart_rate": 75,
        "spo2": "95.50",
        "latitude": 37.5673,
        "longitude": 126.978,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": False,
    },
    {
        "label": "정상 상태 14",
        "heart_rate": 80,
        "spo2": "96.00",
        "latitude": 37.5681,
        "longitude": 126.9789,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": False,
    },
    {
        "label": "정상 상태 15",
        "heart_rate": 85,
        "spo2": "95.00",
        "latitude": 37.5649,
        "longitude": 126.9798,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": False,
    },
    {
        "label": "정상 상태 16",
        "heart_rate": 90,
        "spo2": "95.50",
        "latitude": 37.5657,
        "longitude": 126.9771,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": False,
    },
    {
        "label": "정상 상태 17",
        "heart_rate": 95,
        "spo2": "96.00",
        "latitude": 37.5665,
        "longitude": 126.978,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": False,
    },
    {
        "label": "정상 상태 18",
        "heart_rate": 70,
        "spo2": "95.00",
        "latitude": 37.5673,
        "longitude": 126.9789,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": False,
    },
    {
        "label": "정상 상태 19",
        "heart_rate": 75,
        "spo2": "95.50",
        "latitude": 37.5681,
        "longitude": 126.9798,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": False,
    },
    {
        "label": "정상 상태 20",
        "heart_rate": 80,
        "spo2": "96.00",
        "latitude": 37.5649,
        "longitude": 126.9771,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": False,
    },
    {
        "label": "건강 경보 21",
        "heart_rate": 117,
        "spo2": "92.50",
        "latitude": 37.5665,
        "longitude": 126.9778,
        "expect_health_status": "danger",
        "expect_health_alert": True,
        "expect_location_alert": False,
    },
    {
        "label": "건강 경보 22",
        "heart_rate": 120,
        "spo2": "93.00",
        "latitude": 37.567,
        "longitude": 126.97825,
        "expect_health_status": "danger",
        "expect_health_alert": True,
        "expect_location_alert": False,
    },
    {
        "label": "건강 경보 23",
        "heart_rate": 50,
        "spo2": "92.50",
        "latitude": 37.566,
        "longitude": 126.97775,
        "expect_health_status": "danger",
        "expect_health_alert": True,
        "expect_location_alert": False,
    },
    {
        "label": "건강 경보 24",
        "heart_rate": 123,
        "spo2": "93.00",
        "latitude": 37.5665,
        "longitude": 126.97825,
        "expect_health_status": "danger",
        "expect_health_alert": True,
        "expect_location_alert": False,
    },
    {
        "label": "건강 경보 25",
        "heart_rate": 52,
        "spo2": "92.50",
        "latitude": 37.567,
        "longitude": 126.97775,
        "expect_health_status": "danger",
        "expect_health_alert": True,
        "expect_location_alert": False,
    },
    {
        "label": "건강 경보 26",
        "heart_rate": 126,
        "spo2": "93.00",
        "latitude": 37.566,
        "longitude": 126.97825,
        "expect_health_status": "danger",
        "expect_health_alert": True,
        "expect_location_alert": False,
    },
    {
        "label": "건강 경보 27",
        "heart_rate": 54,
        "spo2": "92.50",
        "latitude": 37.567,
        "longitude": 126.97775,
        "expect_health_status": "danger",
        "expect_health_alert": True,
        "expect_location_alert": False,
    },
    {
        "label": "건강 경보 28",
        "heart_rate": 129,
        "spo2": "93.00",
        "latitude": 37.5665,
        "longitude": 126.97825,
        "expect_health_status": "danger",
        "expect_health_alert": True,
        "expect_location_alert": False,
    },
    {
        "label": "건강 경보 29",
        "heart_rate": 56,
        "spo2": "92.50",
        "latitude": 37.566,
        "longitude": 126.97775,
        "expect_health_status": "danger",
        "expect_health_alert": True,
        "expect_location_alert": False,
    },
    {
        "label": "건강 경보 30",
        "heart_rate": 132,
        "spo2": "93.00",
        "latitude": 37.567,
        "longitude": 126.97825,
        "expect_health_status": "danger",
        "expect_health_alert": True,
        "expect_location_alert": False,
    },
    {
        "label": "건강 경보 31",
        "heart_rate": 58,
        "spo2": "92.50",
        "latitude": 37.566,
        "longitude": 126.97775,
        "expect_health_status": "danger",
        "expect_health_alert": True,
        "expect_location_alert": False,
    },
    {
        "label": "건강 경보 32",
        "heart_rate": 135,
        "spo2": "93.00",
        "latitude": 37.567,
        "longitude": 126.97825,
        "expect_health_status": "danger",
        "expect_health_alert": True,
        "expect_location_alert": False,
    },
    {
        "label": "건강 경보 33",
        "heart_rate": 60,
        "spo2": "92.50",
        "latitude": 37.5665,
        "longitude": 126.97775,
        "expect_health_status": "danger",
        "expect_health_alert": True,
        "expect_location_alert": False,
    },
    {
        "label": "건강 경보 34",
        "heart_rate": 138,
        "spo2": "93.00",
        "latitude": 37.566,
        "longitude": 126.97825,
        "expect_health_status": "danger",
        "expect_health_alert": True,
        "expect_location_alert": False,
    },
    {
        "label": "건강 경보 35",
        "heart_rate": 62,
        "spo2": "92.50",
        "latitude": 37.567,
        "longitude": 126.97775,
        "expect_health_status": "danger",
        "expect_health_alert": True,
        "expect_location_alert": False,
    },
    {
        "label": "위치 경보 36",
        "heart_rate": 80,
        "spo2": "95.50",
        "latitude": 37.5765,
        "longitude": 126.988,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": True,
    },
    {
        "label": "위치 경보 37",
        "heart_rate": 83,
        "spo2": "95.50",
        "latitude": 37.5775,
        "longitude": 126.9895,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": True,
    },
    {
        "label": "위치 경보 38",
        "heart_rate": 86,
        "spo2": "95.50",
        "latitude": 37.5785,
        "longitude": 126.991,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": True,
    },
    {
        "label": "위치 경보 39",
        "heart_rate": 89,
        "spo2": "95.50",
        "latitude": 37.5765,
        "longitude": 126.9925,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": True,
    },
    {
        "label": "위치 경보 40",
        "heart_rate": 80,
        "spo2": "95.50",
        "latitude": 37.5775,
        "longitude": 126.988,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": True,
    },
    {
        "label": "위치 경보 41",
        "heart_rate": 83,
        "spo2": "95.50",
        "latitude": 37.5785,
        "longitude": 126.9895,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": True,
    },
    {
        "label": "위치 경보 42",
        "heart_rate": 86,
        "spo2": "95.50",
        "latitude": 37.5765,
        "longitude": 126.991,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": True,
    },
    {
        "label": "위치 경보 43",
        "heart_rate": 89,
        "spo2": "95.50",
        "latitude": 37.5775,
        "longitude": 126.9925,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": True,
    },
    {
        "label": "위치 경보 44",
        "heart_rate": 80,
        "spo2": "95.50",
        "latitude": 37.5785,
        "longitude": 126.988,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": True,
    },
    {
        "label": "위치 경보 45",
        "heart_rate": 83,
        "spo2": "95.50",
        "latitude": 37.5765,
        "longitude": 126.9895,
        "expect_health_status": "normal",
        "expect_health_alert": False,
        "expect_location_alert": True,
    },
    {
        "label": "복합 경보 46",
        "heart_rate": 94,
        "spo2": "91.80",
        "latitude": 37.5785,
        "longitude": 126.965,
        "expect_health_status": "danger",
        "expect_health_alert": True,
        "expect_location_alert": True,
    },
    {
        "label": "복합 경보 47",
        "heart_rate": 95,
        "spo2": "91.80",
        "latitude": 37.5795,
        "longitude": 126.964,
        "expect_health_status": "danger",
        "expect_health_alert": True,
        "expect_location_alert": True,
    },
    {
        "label": "복합 경보 48",
        "heart_rate": 96,
        "spo2": "91.80",
        "latitude": 37.5785,
        "longitude": 126.966,
        "expect_health_status": "danger",
        "expect_health_alert": True,
        "expect_location_alert": True,
    },
    {
        "label": "복합 경보 49",
        "heart_rate": 97,
        "spo2": "91.80",
        "latitude": 37.5795,
        "longitude": 126.965,
        "expect_health_status": "danger",
        "expect_health_alert": True,
        "expect_location_alert": True,
    },
    {
        "label": "복합 경보 50",
        "heart_rate": 98,
        "spo2": "91.80",
        "latitude": 37.5785,
        "longitude": 126.964,
        "expect_health_status": "danger",
        "expect_health_alert": True,
        "expect_location_alert": True,
    },
]


@pytest.mark.parametrize("scenario", MONITORING_VARIANTS)
@pytest.mark.django_db
def test_monitoring_alert_generation(manager_user, traveler, trip, scenario):
    """심박·산소포화도·위치 데이터 조합이 기대한 알림으로 연결되는지 검증한다."""

    trip.heart_rate_min = 60
    trip.heart_rate_max = 110
    trip.spo2_min = Decimal("94.50")
    trip.geofence_center_lat = Decimal("37.5665")
    trip.geofence_center_lng = Decimal("126.9780")
    trip.geofence_radius_km = Decimal("0.50")
    trip.save(update_fields=[
        "heart_rate_min",
        "heart_rate_max",
        "spo2_min",
        "geofence_center_lat",
        "geofence_center_lng",
        "geofence_radius_km",
    ])

    participant = TripParticipant.objects.create(trip=trip, traveler=traveler)

    health_snapshot = services.create_health_snapshot(
        participant=participant,
        heart_rate=scenario["heart_rate"],
        spo2=Decimal(scenario["spo2"]),
    )
    services.create_location_snapshot(
        participant=participant,
        latitude=scenario["latitude"],
        longitude=scenario["longitude"],
    )

    assert health_snapshot.status == scenario["expect_health_status"], scenario["label"]

    alerts = MonitoringAlert.objects.filter(participant=participant).order_by("created_at")
    health_alerts = [alert for alert in alerts if alert.alert_type == "health"]
    location_alerts = [alert for alert in alerts if alert.alert_type == "location"]

    assert bool(health_alerts) == scenario["expect_health_alert"]
    assert bool(location_alerts) == scenario["expect_location_alert"]

    if scenario["expect_health_alert"]:
        assert any("심박수" in alert.message or "산소포화도" in alert.message for alert in health_alerts)
    if scenario["expect_location_alert"]:
        assert any("현재 위치" in alert.message for alert in location_alerts)

    client = APIClient()
    login = client.post(
        "/api/auth/login/",
        data={"username": manager_user.username, "password": "secure-password"},
        format="json",
    )
    assert login.status_code == 200

    latest_response = client.get(f"/api/monitoring/trips/{trip.id}/latest/")
    assert latest_response.status_code == 200
    assert len(latest_response.data) == 1
    latest_payload = latest_response.data[0]
    assert latest_payload["participant_id"] == participant.id
    assert latest_payload["health"]["status"] == scenario["expect_health_status"]
    assert latest_payload["trip_id"] == trip.id

    alerts_response = client.get(f"/api/monitoring/trips/{trip.id}/alerts/")
    assert alerts_response.status_code == 200
    expected_count = int(scenario["expect_health_alert"]) + int(scenario["expect_location_alert"])
    assert len(alerts_response.data) == expected_count
    returned_types = {item["alert_type"] for item in alerts_response.data}
    if scenario["expect_health_alert"]:
        assert "health" in returned_types
    if scenario["expect_location_alert"]:
        assert "location" in returned_types