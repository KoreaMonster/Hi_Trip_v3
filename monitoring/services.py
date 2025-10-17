"""모니터링 관련 비즈니스 로직을 모아둔 모듈."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from typing import List, Optional

from django.utils import timezone

from trips.models import Trip, TripParticipant

from .models import HealthSnapshot, LocationSnapshot, MonitoringAlert


@dataclass
class ParticipantStatus:
    """참가자별 최신 상태를 반환할 때 사용하는 구조체."""

    participant: TripParticipant
    health: Optional[HealthSnapshot]
    location: Optional[LocationSnapshot]


# ------------------------- 평가 로직 -------------------------

def _evaluate_health(participant: TripParticipant, heart_rate: int, spo2: Decimal) -> tuple[str, Optional[str]]:
    """심박수와 산소포화도를 기준으로 상태와 경고 메시지를 계산한다."""

    trip = participant.trip
    status = "normal"
    messages: List[str] = []

    if trip.heart_rate_min is not None and heart_rate < trip.heart_rate_min:
        status = "danger"
        messages.append(
            f"심박수가 {heart_rate}bpm으로 설정한 최소값({trip.heart_rate_min})보다 낮습니다."
        )
    elif trip.heart_rate_max is not None and heart_rate > trip.heart_rate_max:
        status = "danger"
        messages.append(
            f"심박수가 {heart_rate}bpm으로 설정한 최대값({trip.heart_rate_max})을 초과했습니다."
        )

    if trip.spo2_min is not None and spo2 < Decimal(str(trip.spo2_min)):
        status = "danger"
        messages.append(f"산소포화도 {spo2}%가 기준({trip.spo2_min}%)보다 낮습니다.")

    alert_message = " ".join(messages) if messages else None
    return status, alert_message


def _evaluate_location(participant: TripParticipant, latitude: float, longitude: float) -> Optional[str]:
    """지오펜스 기준을 벗어났는지 확인하고 메시지를 반환한다."""

    trip = participant.trip
    if (
        trip.geofence_center_lat is None
        or trip.geofence_center_lng is None
        or trip.geofence_radius_km is None
    ):
        return None

    center_lat = float(trip.geofence_center_lat)
    center_lng = float(trip.geofence_center_lng)
    radius = float(trip.geofence_radius_km)
    distance = _haversine_km(center_lat, center_lng, latitude, longitude)

    if distance > radius:
        return (
            f"현재 위치가 기준 반경({radius:.2f}km)를 {distance - radius:.2f}km 초과했습니다."
        )
    return None


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """두 위경도 좌표 간의 거리를 km 단위로 계산한다."""

    r = 6371  # 지구 반지름(km)
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


# ------------------------- 생성 로직 -------------------------

def create_health_snapshot(
    *,
    participant: TripParticipant,
    heart_rate: int,
    spo2: Decimal,
    measured_at=None,
) -> HealthSnapshot:
    """건강 데이터를 저장하고 필요 시 경보도 함께 기록한다."""

    measured_at = measured_at or timezone.now()
    status, alert_message = _evaluate_health(participant, heart_rate, spo2)

    snapshot = HealthSnapshot.objects.create(
        participant=participant,
        measured_at=measured_at,
        heart_rate=heart_rate,
        spo2=spo2,
        status=status,
    )

    if alert_message:
        MonitoringAlert.objects.create(
            participant=participant,
            alert_type="health",
            message=alert_message,
            snapshot_time=measured_at,
        )

    return snapshot


def create_location_snapshot(
    *,
    participant: TripParticipant,
    latitude: float,
    longitude: float,
    accuracy_m: Optional[float] = None,
    measured_at=None,
) -> LocationSnapshot:
    """위치 데이터를 저장하고 임계치 위반 시 경보를 추가한다."""

    measured_at = measured_at or timezone.now()
    alert_message = _evaluate_location(participant, latitude, longitude)

    snapshot = LocationSnapshot.objects.create(
        participant=participant,
        measured_at=measured_at,
        latitude=Decimal(str(latitude)),
        longitude=Decimal(str(longitude)),
        accuracy_m=Decimal(str(accuracy_m)) if accuracy_m is not None else None,
    )

    if alert_message:
        MonitoringAlert.objects.create(
            participant=participant,
            alert_type="location",
            message=alert_message,
            snapshot_time=measured_at,
        )

    return snapshot


def generate_demo_snapshots_for_trip(*, trip: Trip, minutes: int, interval_seconds: int) -> int:
    """Trip에 속한 모든 참가자에 대해 더미 스냅샷을 생성한다."""

    participants = list(trip.participants.select_related("traveler"))
    if not participants:
        return 0

    total_points = max(1, (minutes * 60) // interval_seconds)
    now = timezone.now()
    created_count = 0

    for step in range(total_points):
        measured_at = now - timedelta(seconds=(total_points - step) * interval_seconds)
        for participant in participants:
            heart_rate = random.randint(55, 110)
            spo2 = Decimal(str(round(random.uniform(93, 99), 2)))

            # 가끔씩 의도적으로 임계치를 벗어나도록 만들어 경보를 시연합니다.
            if random.random() < 0.1 and trip.heart_rate_max:
                heart_rate = int(trip.heart_rate_max + random.randint(5, 15))
            if random.random() < 0.05 and trip.spo2_min:
                spo2 = Decimal(
                    str(
                        max(
                            85,
                            float(trip.spo2_min) - random.uniform(1, 5),
                        )
                    )
                )

            create_health_snapshot(
                participant=participant,
                heart_rate=heart_rate,
                spo2=spo2,
                measured_at=measured_at,
            )

            base_lat, base_lng = _resolve_base_coordinates(trip)
            lat_offset = random.uniform(-0.01, 0.01)
            lng_offset = random.uniform(-0.01, 0.01)
            latitude = base_lat + lat_offset
            longitude = base_lng + lng_offset

            # 지오펜스 경고를 위해 가끔 크게 벗어나는 좌표도 생성합니다.
            if random.random() < 0.08:
                latitude += random.uniform(0.05, 0.1)
                longitude += random.uniform(0.05, 0.1)

            create_location_snapshot(
                participant=participant,
                latitude=latitude,
                longitude=longitude,
                accuracy_m=random.uniform(5, 50),
                measured_at=measured_at,
            )
            created_count += 2

    return created_count


def _resolve_base_coordinates(trip: Trip) -> tuple[float, float]:
    """지오펜스가 설정되지 않았다면 기본 좌표(서울 시청)를 반환한다."""

    if (
        trip.geofence_center_lat is not None
        and trip.geofence_center_lng is not None
    ):
        return float(trip.geofence_center_lat), float(trip.geofence_center_lng)
    # 기본 좌표: 서울 시청
    return 37.5665, 126.9780


# ------------------------- 조회 로직 -------------------------

def get_participant_statuses(trip: Trip) -> List[ParticipantStatus]:
    """각 참가자의 최신 스냅샷을 가져온다."""

    participants = trip.participants.select_related("traveler")
    result: List[ParticipantStatus] = []
    for participant in participants:
        health = participant.health_snapshots.order_by("-measured_at").first()
        location = participant.location_snapshots.order_by("-measured_at").first()
        result.append(
            ParticipantStatus(
                participant=participant,
                health=health,
                location=location,
            )
        )
    return result


# 향후 개선 사항:
# - get_participant_statuses에서 Subquery를 사용하면 N+1 쿼리를 줄일 수 있습니다.
# - generate_demo_snapshots_for_trip은 Celery 태스크로 분리하여 비동기 실행하도록
#   확장하면 대규모 데이터 생성 시 웹 요청을 차단하지 않습니다.