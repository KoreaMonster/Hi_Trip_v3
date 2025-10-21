from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from monitoring.models import HealthSnapshot, LocationSnapshot
from monitoring.services import create_health_snapshot, create_location_snapshot
from trips.models import TripParticipant


@pytest.mark.django_db
def test_generate_demo_creates_snapshots(manager_user, trip, traveler, additional_travelers):
    participant_primary = TripParticipant.objects.create(trip=trip, traveler=traveler)
    participant_secondary = TripParticipant.objects.create(
        trip=trip,
        traveler=additional_travelers[0],
    )

    client = APIClient()
    client.force_authenticate(manager_user)

    response = client.post(
        f"/api/monitoring/trips/{trip.id}/generate-demo/",
        {"minutes": 1, "interval": 60},
        format="json",
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload == {
        "created": 4,
        "minutes": 1,
        "interval": 60,
        "participants": 2,
    }

    assert HealthSnapshot.objects.filter(participant__trip=trip).count() == 2
    assert LocationSnapshot.objects.filter(participant__trip=trip).count() == 2

    # 다른 참가자를 생성했지만 스냅샷은 정상적으로 생성되었음을 확인
    assert participant_primary.health_snapshots.exists()
    assert participant_secondary.health_snapshots.exists()


@pytest.mark.django_db
def test_participant_history_returns_sorted_snapshots(manager_user, trip, traveler, additional_travelers):
    participant = TripParticipant.objects.create(trip=trip, traveler=traveler)
    other_participant = TripParticipant.objects.create(
        trip=trip,
        traveler=additional_travelers[1],
    )

    now = timezone.now()
    first_point = now - timedelta(minutes=2)
    second_point = now - timedelta(minutes=1)

    create_health_snapshot(
        participant=participant,
        heart_rate=72,
        spo2=Decimal("97.20"),
        measured_at=first_point,
    )
    create_health_snapshot(
        participant=participant,
        heart_rate=78,
        spo2=Decimal("96.80"),
        measured_at=second_point,
    )
    create_location_snapshot(
        participant=participant,
        latitude=37.5665,
        longitude=126.9780,
        accuracy_m=10,
        measured_at=first_point,
    )
    create_location_snapshot(
        participant=participant,
        latitude=37.5666,
        longitude=126.9781,
        accuracy_m=12,
        measured_at=second_point,
    )

    # 다른 참가자 데이터는 섞이지 않아야 한다.
    create_health_snapshot(
        participant=other_participant,
        heart_rate=65,
        spo2=Decimal("98.10"),
        measured_at=now,
    )

    client = APIClient()
    client.force_authenticate(manager_user)

    response = client.get(
        f"/api/monitoring/trips/{trip.id}/participants/{participant.id}/history/",
        {"limit": 5},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["participant_id"] == participant.id
    assert payload["traveler_name"] == participant.traveler.full_name_kr
    assert payload["trip_id"] == trip.id
    assert payload["last_updated"] == payload["health"][-1]["measured_at"]

    assert len(payload["health"]) == 2
    measured_times = [entry["measured_at"] for entry in payload["health"]]
    assert measured_times == sorted(measured_times)

    assert len(payload["location"]) == 2
    location_times = [entry["measured_at"] for entry in payload["location"]]
    assert location_times == sorted(location_times)
