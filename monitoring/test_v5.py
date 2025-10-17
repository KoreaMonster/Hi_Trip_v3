"""monitoring 앱 기능을 검증하는 pytest 기반 테스트 모음.

이 파일은 MVP 수준의 백엔드 모니터링 기능을 광범위하게 확인하기 위한 테스트를
제공한다. 초보 개발자도 흐름을 이해할 수 있도록 각 테스트에 상세 주석과 로그를
첨부했으며, 회귀를 방지하기 위해 다양한 경계 조건을 다룬다.
"""

import logging
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from monitoring import services
from monitoring.models import HealthSnapshot, LocationSnapshot, MonitoringAlert
from trips.models import TripParticipant

logger = logging.getLogger("monitoring.tests")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter("[%(levelname)s] %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
logger.setLevel(logging.INFO)


@pytest.fixture
def monitored_trip(trip):
    """임계치가 설정된 Trip 인스턴스를 반환한다."""

    trip.heart_rate_min = 55
    trip.heart_rate_max = 105
    trip.spo2_min = Decimal("95.00")
    trip.geofence_center_lat = Decimal("37.566500")
    trip.geofence_center_lng = Decimal("126.978000")
    trip.geofence_radius_km = Decimal("1.50")
    trip.save()
    logger.info("임계치가 적용된 여행(%s)을 준비했습니다.", trip.id)
    return trip


@pytest.fixture
def participant(monitored_trip, traveler):
    """단일 참가자를 생성한다."""

    participant = TripParticipant.objects.create(trip=monitored_trip, traveler=traveler)
    logger.info("기본 참가자(%s)를 생성했습니다.", participant.id)
    return participant


@pytest.fixture
def participants(monitored_trip, traveler, additional_travelers):
    """여러 참가자를 만들어 대량 생성 시나리오를 검증한다."""

    created = [TripParticipant.objects.create(trip=monitored_trip, traveler=traveler)]
    for extra in additional_travelers[:3]:
        created.append(TripParticipant.objects.create(trip=monitored_trip, traveler=extra))
    logger.info("총 %s명의 참가자를 생성했습니다.", len(created))
    return created


# ------------------------- 건강 스냅샷 테스트 -------------------------


@pytest.mark.django_db
@pytest.mark.parametrize(
    "heart_rate,spo2,expected_status,expect_alert",
    [
        # 기본 정상 범위 (경보 없음)
        (70, Decimal("97.00"), "normal", False),
        (65, Decimal("96.50"), "normal", False),
        (95, Decimal("97.80"), "normal", False),
        (58, Decimal("95.50"), "normal", False),
        # 심박수 하한 미만 -> 경보
        (54, Decimal("97.00"), "danger", True),
        (40, Decimal("98.00"), "danger", True),
        # 심박수 상한 초과 -> 경보
        (106, Decimal("97.00"), "danger", True),
        (120, Decimal("98.00"), "danger", True),
        # 산소포화도 하한 미만 -> 경보
        (70, Decimal("94.00"), "danger", True),
        (100, Decimal("94.50"), "danger", True),
        (55, Decimal("94.99"), "danger", True),
        # 경계값 맞춤 - 경보 없음
        (55, Decimal("95.00"), "normal", False),
        (100, Decimal("95.00"), "normal", False),
        (105, Decimal("95.00"), "normal", False),
        # 심박과 산소 모두 초과 -> 경보
        (107, Decimal("94.00"), "danger", True),
        (80, Decimal("93.00"), "danger", True),
        # 산소 정상, 심박 정상 - 경보 없음
        (75, Decimal("98.50"), "normal", False),
        # 극단값 테스트
        (60, Decimal("90.00"), "danger", True),
        (50, Decimal("98.00"), "danger", True),
        # 미세한 정상 범위 유지
        (72, Decimal("96.80"), "normal", False),
        (83, Decimal("97.10"), "normal", False),
    ],
)
def test_create_health_snapshot_status(
    participant, heart_rate, spo2, expected_status, expect_alert, caplog
):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    initial_alerts = MonitoringAlert.objects.count()

    snapshot = services.create_health_snapshot(
        participant=participant,
        heart_rate=heart_rate,
        spo2=spo2,
    )

    logger.info(
        "건강 스냅샷 생성 결과 - HR: %s, SpO2: %s, 상태: %s", heart_rate, spo2, snapshot.status
    )

    assert snapshot.status == expected_status
    new_alerts = MonitoringAlert.objects.count() - initial_alerts
    if expect_alert:
        assert new_alerts == 1
        last_alert = MonitoringAlert.objects.latest("created_at")
        assert last_alert.participant_id == participant.id
        assert any(keyword in last_alert.message for keyword in ["심박수", "산소"])
    else:
        assert new_alerts == 0

    assert caplog.messages, "로그가 남지 않았습니다."


@pytest.mark.django_db
def test_create_health_snapshot_records_timestamp(participant, caplog):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    before = timezone.now() - timedelta(seconds=1)
    snapshot = services.create_health_snapshot(
        participant=participant,
        heart_rate=70,
        spo2=Decimal("97.00"),
    )
    after = timezone.now() + timedelta(seconds=1)

    logger.info("측정 시각 검증 - 기록된 시각: %s", snapshot.measured_at)

    assert before <= snapshot.measured_at <= after
    assert caplog.messages, "타임스탬프 테스트 로그가 비어 있습니다."


@pytest.mark.django_db
def test_create_health_snapshot_custom_timestamp(participant, caplog):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    custom_time = timezone.now() - timedelta(minutes=5)
    snapshot = services.create_health_snapshot(
        participant=participant,
        heart_rate=65,
        spo2=Decimal("96.00"),
        measured_at=custom_time,
    )

    logger.info("사용자 지정 타임스탬프: %s", snapshot.measured_at)

    assert snapshot.measured_at == custom_time
    assert caplog.messages, "사용자 지정 타임스탬프 로그가 비었습니다."


@pytest.mark.django_db
def test_create_health_snapshot_combined_alert(participant, caplog):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    snapshot = services.create_health_snapshot(
        participant=participant,
        heart_rate=48,
        spo2=Decimal("92.00"),
    )

    logger.info("결합 경고 메시지 확인: %s", snapshot.status)

    assert snapshot.status == "danger"
    alert = MonitoringAlert.objects.latest("created_at")
    assert "심박수" in alert.message and "산소" in alert.message
    assert caplog.messages, "결합 경고 로그가 비었습니다."


# ------------------------- 위치 스냅샷 테스트 -------------------------


@pytest.mark.django_db
@pytest.mark.parametrize(
    "lat_offset,lng_offset,expect_alert",
    [
        # 기준점 근처
        (0.0000, 0.0000, False),
        (0.0050, 0.0000, False),
        (0.0100, 0.0000, False),
        (0.0000, 0.0050, False),
        (0.0000, 0.0100, False),
        # 경계선 부근 (약 1.5km) - 경보 없음
        (0.0130, 0.0000, False),
        (0.0000, -0.0130, False),
        # 임계치를 확실히 초과하는 좌표 - 경보 발생
        (0.0150, 0.0000, True),
        (0.0000, 0.0200, True),
        (0.0120, 0.0120, True),
        (-0.0200, 0.0000, True),
        (0.0000, -0.0180, True),
        (0.0250, -0.0100, True),
        (-0.0180, 0.0180, True),
        # 매우 큰 이동 - 경보 발생
        (0.0500, 0.0500, True),
        (-0.0400, -0.0400, True),
    ],
)
def test_create_location_snapshot_alerts(
    participant, lat_offset, lng_offset, expect_alert, caplog
):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    trip = participant.trip
    base_lat = float(trip.geofence_center_lat)
    base_lng = float(trip.geofence_center_lng)

    initial_alerts = MonitoringAlert.objects.count()
    snapshot = services.create_location_snapshot(
        participant=participant,
        latitude=base_lat + lat_offset,
        longitude=base_lng + lng_offset,
        accuracy_m=15.0,
    )

    logger.info(
        "위치 스냅샷 생성 결과 - 좌표: (%s, %s)", snapshot.latitude, snapshot.longitude
    )

    new_alerts = MonitoringAlert.objects.count() - initial_alerts
    if expect_alert:
        assert new_alerts == 1
        last_alert = MonitoringAlert.objects.latest("created_at")
        assert last_alert.alert_type == "location"
        assert "반경" in last_alert.message
    else:
        assert new_alerts == 0

    assert caplog.messages, "위치 로그가 기록되지 않았습니다."


@pytest.mark.django_db
def test_create_location_snapshot_accuracy_decimal(participant, caplog):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    snapshot = services.create_location_snapshot(
        participant=participant,
        latitude=float(participant.trip.geofence_center_lat),
        longitude=float(participant.trip.geofence_center_lng),
        accuracy_m=12.3456,
    )
    snapshot.refresh_from_db()
    logger.info("정밀도 값: %s", snapshot.accuracy_m)
    assert snapshot.accuracy_m == Decimal("12.35")
    assert caplog.messages, "정밀도 로그가 비었습니다."


@pytest.mark.django_db
def test_create_location_snapshot_without_geofence(trip, traveler, caplog):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    participant = TripParticipant.objects.create(trip=trip, traveler=traveler)
    snapshot = services.create_location_snapshot(
        participant=participant,
        latitude=37.0,
        longitude=127.0,
    )
    logger.info("지오펜스 미설정 상태로 스냅샷 생성")
    assert snapshot is not None
    assert MonitoringAlert.objects.count() == 0
    assert caplog.messages, "지오펜스 미설정 로그가 필요합니다."


# ------------------------- 데모 생성 함수 테스트 -------------------------


@pytest.mark.django_db
def test_generate_demo_snapshots_no_participants(monitored_trip, caplog):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    created = services.generate_demo_snapshots_for_trip(
        trip=monitored_trip,
        minutes=5,
        interval_seconds=60,
    )
    logger.info("참가자 없음 생성 결과: %s", created)
    assert created == 0
    assert caplog.messages, "데모 생성 로그가 필요합니다."


@pytest.mark.django_db
def test_generate_demo_snapshots_counts(participants, caplog):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    trip = participants[0].trip
    created = services.generate_demo_snapshots_for_trip(
        trip=trip,
        minutes=1,
        interval_seconds=60,
    )
    logger.info("생성된 레코드 수: %s", created)
    expected = len(participants) * 2  # 건강 + 위치
    assert created == expected
    assert HealthSnapshot.objects.count() == len(participants)
    assert LocationSnapshot.objects.count() == len(participants)
    assert caplog.messages, "카운트 로그가 비었습니다."


@pytest.mark.django_db
def test_generate_demo_snapshots_multiple_points(participants, caplog):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    trip = participants[0].trip
    created = services.generate_demo_snapshots_for_trip(
        trip=trip,
        minutes=3,
        interval_seconds=60,
    )
    logger.info("다중 포인트 생성 결과: %s", created)
    points = max(1, (3 * 60) // 60)
    assert created == len(participants) * points * 2
    assert caplog.messages, "다중 포인트 로그가 필요합니다."


@pytest.mark.django_db
def test_generate_demo_snapshots_interval_larger_than_minutes(participants, caplog):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    trip = participants[0].trip
    created = services.generate_demo_snapshots_for_trip(
        trip=trip,
        minutes=1,
        interval_seconds=120,
    )
    logger.info("간격이 더 큰 경우 생성 수: %s", created)
    assert created == len(participants) * 2
    assert caplog.messages, "간격 로그가 필요합니다."


@pytest.mark.django_db
def test_generate_demo_snapshots_creates_alerts(participants, caplog):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    trip = participants[0].trip
    trip.heart_rate_max = 80
    trip.spo2_min = Decimal("98.00")
    trip.save(update_fields=["heart_rate_max", "spo2_min", "updated_at"])

    created = services.generate_demo_snapshots_for_trip(
        trip=trip,
        minutes=1,
        interval_seconds=60,
    )
    logger.info("경보 포함 생성 수: %s", created)
    assert MonitoringAlert.objects.filter(alert_type="health").exists()
    assert caplog.messages, "경보 생성 로그가 비었습니다."


# ------------------------- 상태 조회 로직 테스트 -------------------------


@pytest.mark.django_db
def test_get_participant_statuses_without_snapshots(participants, caplog):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    trip = participants[0].trip
    statuses = services.get_participant_statuses(trip)
    logger.info("스냅샷 없음 상태 수: %s", len(statuses))
    assert len(statuses) == len(participants)
    assert all(status.health is None for status in statuses)
    assert all(status.location is None for status in statuses)
    assert caplog.messages, "상태 조회 로그가 필요합니다."


@pytest.mark.django_db
def test_get_participant_statuses_after_generation(participants, caplog):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    trip = participants[0].trip
    services.generate_demo_snapshots_for_trip(trip=trip, minutes=1, interval_seconds=60)
    statuses = services.get_participant_statuses(trip)
    logger.info("스냅샷 생성 후 상태 수: %s", len(statuses))
    assert len(statuses) == len(participants)
    assert all(status.health is not None for status in statuses)
    assert all(status.location is not None for status in statuses)
    assert caplog.messages, "상태 조회 후 로그가 필요합니다."


@pytest.mark.django_db
def test_get_participant_statuses_returns_latest(participant, caplog):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    base_time = timezone.now() - timedelta(minutes=10)
    services.create_health_snapshot(
        participant=participant,
        heart_rate=70,
        spo2=Decimal("97.00"),
        measured_at=base_time,
    )
    services.create_health_snapshot(
        participant=participant,
        heart_rate=90,
        spo2=Decimal("96.00"),
        measured_at=base_time + timedelta(minutes=5),
    )
    services.create_location_snapshot(
        participant=participant,
        latitude=float(participant.trip.geofence_center_lat),
        longitude=float(participant.trip.geofence_center_lng),
        measured_at=base_time,
    )
    recent_location = services.create_location_snapshot(
        participant=participant,
        latitude=float(participant.trip.geofence_center_lat) + 0.005,
        longitude=float(participant.trip.geofence_center_lng),
        measured_at=base_time + timedelta(minutes=6),
    )
    statuses = services.get_participant_statuses(participant.trip)
    latest = statuses[0]
    logger.info(
        "최신 상태 검증 - 최근 심박수: %s, 최근 위치 시각: %s",
        latest.health.heart_rate,
        latest.location.measured_at,
    )
    assert latest.health.heart_rate == 90
    assert latest.location.id == recent_location.id
    assert caplog.messages, "최신 상태 로그가 필요합니다."


@pytest.mark.django_db
def test_get_participant_statuses_multiple_participants(participants, caplog):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    trip = participants[0].trip
    services.generate_demo_snapshots_for_trip(trip=trip, minutes=1, interval_seconds=60)
    statuses = services.get_participant_statuses(trip)
    logger.info("다수 참가자 상태 수집: %s", len(statuses))
    participant_ids = sorted(p.id for p in participants)
    returned_ids = sorted(status.participant.id for status in statuses)
    assert returned_ids == participant_ids
    assert caplog.messages, "다수 참가자 로그가 필요합니다."


@pytest.mark.django_db
def test_get_participant_statuses_handles_missing_data(participants, caplog):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    trip = participants[0].trip
    first, *rest = participants
    services.create_health_snapshot(
        participant=first,
        heart_rate=70,
        spo2=Decimal("97.00"),
    )
    statuses = services.get_participant_statuses(trip)
    logger.info("부분 데이터 상태 수집: %s", len(statuses))
    mapping = {status.participant.id: status for status in statuses}
    assert mapping[first.id].health is not None
    assert mapping[first.id].location is None
    for other in rest:
        assert mapping[other.id].health is None
        assert mapping[other.id].location is None
    assert caplog.messages, "부분 데이터 로그가 필요합니다."


# ------------------------- 모델 무결성 및 단순 검증 -------------------------


@pytest.mark.django_db
def test_health_snapshot_str(participant, caplog):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    snapshot = services.create_health_snapshot(
        participant=participant,
        heart_rate=72,
        spo2=Decimal("96.00"),
    )
    representation = str(snapshot)
    logger.info("__str__ 표현: %s", representation)
    assert str(participant.id) in representation
    assert caplog.messages, "문자열 표현 로그가 필요합니다."


@pytest.mark.django_db
def test_location_snapshot_str(participant, caplog):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    snapshot = services.create_location_snapshot(
        participant=participant,
        latitude=float(participant.trip.geofence_center_lat),
        longitude=float(participant.trip.geofence_center_lng),
    )
    representation = str(snapshot)
    logger.info("위치 __str__ 표현: %s", representation)
    assert str(participant.id) in representation
    assert caplog.messages, "위치 문자열 로그가 필요합니다."


@pytest.mark.django_db
def test_monitoring_alert_str(participant, caplog):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    services.create_health_snapshot(
        participant=participant,
        heart_rate=40,
        spo2=Decimal("90.00"),
    )
    alert = MonitoringAlert.objects.latest("created_at")
    representation = str(alert)
    logger.info("경보 __str__ 표현: %s", representation)
    assert "건강 이상" in representation
    assert caplog.messages, "경보 문자열 로그가 필요합니다."


@pytest.mark.django_db
def test_health_snapshot_decimal_precision(participant, caplog):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    snapshot = services.create_health_snapshot(
        participant=participant,
        heart_rate=75,
        spo2=Decimal("96.789"),
    )
    snapshot.refresh_from_db()
    logger.info("소수점 저장 값: %s", snapshot.spo2)
    assert snapshot.spo2 == Decimal("96.79")
    assert caplog.messages, "소수점 로그가 필요합니다."


# ------------------------- 추가 회귀 테스트 -------------------------


@pytest.mark.django_db
def test_health_alert_message_contains_min_threshold(participant, caplog):
    """최소 심박수 미만일 때 메시지에 기준값이 포함되는지 검증한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    snapshot = services.create_health_snapshot(
        participant=participant,
        heart_rate=45,
        spo2=Decimal("97.00"),
    )
    alert = MonitoringAlert.objects.latest("created_at")
    logger.info("경보 메시지: %s", alert.message)
    assert snapshot.status == "danger"
    assert str(participant.trip.heart_rate_min) in alert.message
    assert caplog.messages, "최소 심박 경보 로그가 없습니다."


@pytest.mark.django_db
def test_health_alert_message_contains_max_threshold(participant, caplog):
    """최대 심박수 초과 시 메시지가 상한선을 언급하는지 확인한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    services.create_health_snapshot(
        participant=participant,
        heart_rate=130,
        spo2=Decimal("98.00"),
    )
    alert = MonitoringAlert.objects.latest("created_at")
    logger.info("경보 메시지(상한): %s", alert.message)
    assert str(participant.trip.heart_rate_max) in alert.message
    assert "초과" in alert.message
    assert caplog.messages, "최대 심박 경보 로그가 없습니다."


@pytest.mark.django_db
def test_health_alert_message_contains_spo2_threshold(participant, caplog):
    """산소포화도 경고 시 기준 값이 언급되는지 확인한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    services.create_health_snapshot(
        participant=participant,
        heart_rate=85,
        spo2=Decimal("93.50"),
    )
    alert = MonitoringAlert.objects.latest("created_at")
    logger.info("경보 메시지(산소): %s", alert.message)
    assert "산소포화도" in alert.message
    assert str(participant.trip.spo2_min) in alert.message
    assert caplog.messages, "산소 경보 로그가 없습니다."


@pytest.mark.django_db
def test_health_snapshot_without_thresholds(participant, caplog):
    """Trip 임계치를 모두 제거하면 경보가 발생하지 않아야 한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    trip = participant.trip
    trip.heart_rate_min = None
    trip.heart_rate_max = None
    trip.spo2_min = None
    trip.save(update_fields=["heart_rate_min", "heart_rate_max", "spo2_min", "updated_at"])

    initial_alerts = MonitoringAlert.objects.count()
    snapshot = services.create_health_snapshot(
        participant=participant,
        heart_rate=30,
        spo2=Decimal("80.00"),
    )
    logger.info("임계치 제거 후 상태: %s", snapshot.status)
    assert snapshot.status == "normal"
    assert MonitoringAlert.objects.count() == initial_alerts
    assert caplog.messages, "임계치 제거 로그가 없습니다."


@pytest.mark.django_db
def test_location_alert_message_contains_radius(participant, caplog):
    """지오펜스 초과 메시지가 반경 정보를 포함하는지 확인한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    trip = participant.trip
    base_lat = float(trip.geofence_center_lat)
    base_lng = float(trip.geofence_center_lng)
    services.create_location_snapshot(
        participant=participant,
        latitude=base_lat + 0.03,
        longitude=base_lng + 0.03,
    )
    alert = MonitoringAlert.objects.latest("created_at")
    logger.info("위치 경보 메시지: %s", alert.message)
    assert f"{trip.geofence_radius_km:.2f}" in alert.message
    assert "초과" in alert.message
    assert caplog.messages, "위치 경보 로그가 없습니다."


@pytest.mark.django_db
def test_location_snapshot_no_alert_when_exact_radius(participant, caplog):
    """반경과 거의 동일한 거리에서는 경보가 발생하지 않아야 한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    trip = participant.trip
    base_lat = float(trip.geofence_center_lat)
    base_lng = float(trip.geofence_center_lng)
    services.create_location_snapshot(
        participant=participant,
        latitude=base_lat,
        longitude=base_lng + 0.013,
    )
    logger.info("경계 거리 테스트 완료")
    assert not MonitoringAlert.objects.filter(alert_type="location").exists()
    assert caplog.messages, "경계 거리 로그가 없습니다."


@pytest.mark.django_db
def test_location_snapshot_accuracy_none(participant, caplog):
    """정확도 값이 없을 때도 저장이 가능한지 검증한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    snapshot = services.create_location_snapshot(
        participant=participant,
        latitude=float(participant.trip.geofence_center_lat),
        longitude=float(participant.trip.geofence_center_lng),
        accuracy_m=None,
    )
    logger.info("정확도 없음 저장 결과: %s", snapshot.accuracy_m)
    assert snapshot.accuracy_m is None
    assert caplog.messages, "정확도 없음 로그가 없습니다."


@pytest.mark.django_db
def test_generate_demo_snapshots_zero_minutes(participants, caplog):
    """minutes=0이어도 최소 1회 측정이 생성되는지 확인한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    trip = participants[0].trip
    created = services.generate_demo_snapshots_for_trip(
        trip=trip,
        minutes=0,
        interval_seconds=60,
    )
    logger.info("0분 생성 결과: %s", created)
    assert created == len(participants) * 2
    assert caplog.messages, "0분 생성 로그가 없습니다."


@pytest.mark.django_db
def test_generate_demo_snapshots_short_interval(participants, caplog):
    """짧은 간격으로 다수 포인트가 생성되는지 검증한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    trip = participants[0].trip
    created = services.generate_demo_snapshots_for_trip(
        trip=trip,
        minutes=2,
        interval_seconds=30,
    )
    logger.info("짧은 간격 생성 결과: %s", created)
    expected_points = max(1, (2 * 60) // 30)
    assert created == len(participants) * expected_points * 2
    assert caplog.messages, "짧은 간격 로그가 없습니다."


@pytest.mark.django_db
def test_generate_demo_snapshots_even_number(participants, caplog):
    """생성된 총 레코드가 건강+위치 짝수인지 확인한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    trip = participants[0].trip
    created = services.generate_demo_snapshots_for_trip(
        trip=trip,
        minutes=1,
        interval_seconds=45,
    )
    logger.info("짝수 개수 확인: %s", created)
    assert created % 2 == 0
    assert caplog.messages, "짝수 개수 로그가 없습니다."


@pytest.mark.django_db
def test_generate_demo_snapshots_creates_health_entries(participants, caplog):
    """데모 생성 후 참가자별 건강 기록이 존재하는지 확인한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    trip = participants[0].trip
    services.generate_demo_snapshots_for_trip(
        trip=trip,
        minutes=1,
        interval_seconds=60,
    )
    logger.info("건강 스냅샷 개수: %s", HealthSnapshot.objects.count())
    assert HealthSnapshot.objects.filter(participant__trip=trip).exists()
    assert caplog.messages, "건강 스냅샷 로그가 없습니다."


@pytest.mark.django_db
def test_generate_demo_snapshots_creates_location_entries(participants, caplog):
    """데모 생성 후 참가자별 위치 기록이 존재하는지 확인한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    trip = participants[0].trip
    services.generate_demo_snapshots_for_trip(
        trip=trip,
        minutes=1,
        interval_seconds=60,
    )
    logger.info("위치 스냅샷 개수: %s", LocationSnapshot.objects.count())
    assert LocationSnapshot.objects.filter(participant__trip=trip).exists()
    assert caplog.messages, "위치 스냅샷 로그가 없습니다."


@pytest.mark.django_db
def test_get_participant_statuses_includes_trip_reference(participants, caplog):
    """상태 응답이 올바른 여행 참가자를 참조하는지 확인한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    trip = participants[0].trip
    services.generate_demo_snapshots_for_trip(trip=trip, minutes=1, interval_seconds=60)
    statuses = services.get_participant_statuses(trip)
    logger.info("상태 응답 참가자 ID: %s", [status.participant.id for status in statuses])
    assert all(status.participant.trip_id == trip.id for status in statuses)
    assert caplog.messages, "상태 참가자 로그가 없습니다."


@pytest.mark.django_db
def test_get_participant_statuses_without_health_data(participants, caplog):
    """위치만 존재할 때 health 필드가 None인지 확인한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    trip = participants[0].trip
    for member in participants:
        services.create_location_snapshot(
            participant=member,
            latitude=float(trip.geofence_center_lat),
            longitude=float(trip.geofence_center_lng),
        )
    statuses = services.get_participant_statuses(trip)
    logger.info("건강 데이터 없음 상태 수집 완료")
    assert all(status.health is None for status in statuses)
    assert any(status.location is not None for status in statuses)
    assert caplog.messages, "건강 없음 로그가 없습니다."


@pytest.mark.django_db
def test_get_participant_statuses_without_location_data(participants, caplog):
    """건강만 존재할 때 location 필드가 None인지 확인한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    trip = participants[0].trip
    for member in participants:
        services.create_health_snapshot(
            participant=member,
            heart_rate=70,
            spo2=Decimal("97.00"),
        )
    statuses = services.get_participant_statuses(trip)
    logger.info("위치 데이터 없음 상태 수집 완료")
    assert all(status.location is None for status in statuses)
    assert any(status.health is not None for status in statuses)
    assert caplog.messages, "위치 없음 로그가 없습니다."


@pytest.mark.django_db
def test_monitoring_alert_ordering_recent_first(participant, caplog):
    """경보가 최신순으로 정렬되는지 확인한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    services.create_health_snapshot(
        participant=participant,
        heart_rate=130,
        spo2=Decimal("98.00"),
    )
    services.create_health_snapshot(
        participant=participant,
        heart_rate=40,
        spo2=Decimal("92.00"),
    )
    alerts = list(MonitoringAlert.objects.filter(alert_type="health"))
    logger.info("경보 ID 순서: %s", [alert.id for alert in alerts])
    assert alerts[0].created_at >= alerts[1].created_at
    assert caplog.messages, "경보 정렬 로그가 없습니다."


@pytest.mark.django_db
def test_monitoring_alert_snapshot_time_matches(participant, caplog):
    """경보에 기록된 시각이 스냅샷 시각과 동일한지 확인한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    custom_time = timezone.now() - timedelta(minutes=2)
    snapshot = services.create_health_snapshot(
        participant=participant,
        heart_rate=120,
        spo2=Decimal("94.00"),
        measured_at=custom_time,
    )
    alert = MonitoringAlert.objects.latest("created_at")
    logger.info("경보 시각: %s, 스냅샷 시각: %s", alert.snapshot_time, snapshot.measured_at)
    assert alert.snapshot_time == snapshot.measured_at
    assert caplog.messages, "경보 시각 로그가 없습니다."


@pytest.mark.django_db
def test_monitoring_alert_type_health_vs_location(participant, caplog):
    """건강/위치 경보가 구분되어 저장되는지 확인한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    services.create_health_snapshot(
        participant=participant,
        heart_rate=130,
        spo2=Decimal("98.00"),
    )
    services.create_location_snapshot(
        participant=participant,
        latitude=float(participant.trip.geofence_center_lat) + 0.04,
        longitude=float(participant.trip.geofence_center_lng) + 0.04,
    )
    logger.info("경보 타입: %s", list(MonitoringAlert.objects.values_list("alert_type", flat=True)))
    types = set(MonitoringAlert.objects.values_list("alert_type", flat=True))
    assert types == {"health", "location"}
    assert caplog.messages, "경보 타입 로그가 없습니다."


@pytest.mark.django_db
def test_monitoring_alert_message_length(participant, caplog):
    """경보 메시지가 일정 길이 이상인지 확인해 가독성을 검증한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    services.create_health_snapshot(
        participant=participant,
        heart_rate=20,
        spo2=Decimal("80.00"),
    )
    alert = MonitoringAlert.objects.latest("created_at")
    logger.info("경보 메시지 길이: %s", len(alert.message))
    assert len(alert.message) >= 10
    assert caplog.messages, "경보 길이 로그가 없습니다."


@pytest.mark.django_db
def test_location_snapshot_precision_six_decimal_places(participant, caplog):
    """위도/경도가 소수점 6자리로 저장되는지 확인한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    snapshot = services.create_location_snapshot(
        participant=participant,
        latitude=37.1234567,
        longitude=127.7654321,
    )
    snapshot.refresh_from_db()
    logger.info("위치 정밀도: %s, %s", snapshot.latitude, snapshot.longitude)
    assert str(snapshot.latitude).count(".") == 1
    assert len(str(snapshot.latitude).split(".")[1]) <= 6
    assert len(str(snapshot.longitude).split(".")[1]) <= 6
    assert caplog.messages, "위치 정밀도 로그가 없습니다."


@pytest.mark.django_db
def test_health_snapshot_status_choices(participant, caplog):
    """상태 필드가 허용된 문자열 중 하나인지 확인한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    snapshot = services.create_health_snapshot(
        participant=participant,
        heart_rate=85,
        spo2=Decimal("97.00"),
    )
    logger.info("상태 값: %s", snapshot.status)
    assert snapshot.status in {"normal", "danger"}
    assert caplog.messages, "상태 값 로그가 없습니다."


@pytest.mark.django_db
def test_health_snapshot_measured_at_timezone_awareness(participant, caplog):
    """저장된 시각이 타임존 정보를 가진 datetime인지 확인한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    snapshot = services.create_health_snapshot(
        participant=participant,
        heart_rate=80,
        spo2=Decimal("96.00"),
    )
    logger.info("measured_at tzinfo: %s", snapshot.measured_at.tzinfo)
    assert snapshot.measured_at.tzinfo is not None
    assert caplog.messages, "타임존 로그가 없습니다."


@pytest.mark.django_db
def test_location_snapshot_measured_at_timezone_awareness(participant, caplog):
    """위치 스냅샷 시각도 타임존 정보를 포함해야 한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    snapshot = services.create_location_snapshot(
        participant=participant,
        latitude=float(participant.trip.geofence_center_lat),
        longitude=float(participant.trip.geofence_center_lng),
    )
    logger.info("위치 measured_at tzinfo: %s", snapshot.measured_at.tzinfo)
    assert snapshot.measured_at.tzinfo is not None
    assert caplog.messages, "위치 타임존 로그가 없습니다."


@pytest.mark.django_db
def test_multiple_participants_alert_count(participants, caplog):
    """여러 참가자에게서 동시에 경보가 발생하는지 확인한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    trip = participants[0].trip
    for member in participants:
        services.create_health_snapshot(
            participant=member,
            heart_rate=130,
            spo2=Decimal("92.00"),
        )
    count = MonitoringAlert.objects.filter(alert_type="health").count()
    logger.info("다중 참가자 경보 수: %s", count)
    assert count == len(participants)
    assert caplog.messages, "다중 경보 로그가 없습니다."


@pytest.mark.django_db
def test_multiple_alerts_sequential_creation(participant, caplog):
    """연속 호출 시 경보가 누락되지 않는지 확인한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    initial = MonitoringAlert.objects.count()
    services.create_health_snapshot(
        participant=participant,
        heart_rate=140,
        spo2=Decimal("91.00"),
    )
    services.create_health_snapshot(
        participant=participant,
        heart_rate=20,
        spo2=Decimal("88.00"),
    )
    delta = MonitoringAlert.objects.count() - initial
    logger.info("연속 경보 생성 수: %s", delta)
    assert delta == 2
    assert caplog.messages, "연속 경보 로그가 없습니다."


@pytest.mark.django_db
def test_alerts_associated_with_participant(participant, caplog):
    """생성된 경보가 정확한 참가자와 연결되는지 확인한다."""

    caplog.set_level(logging.INFO, logger="monitoring.tests")
    services.create_health_snapshot(
        participant=participant,
        heart_rate=150,
        spo2=Decimal("85.00"),
    )
    alert = MonitoringAlert.objects.latest("created_at")
    logger.info("경보 참가자 ID: %s", alert.participant_id)
    assert alert.participant_id == participant.id
    assert caplog.messages, "경보 참가자 로그가 없습니다."


@pytest.mark.django_db
def test_location_snapshot_orders_by_measured_at(participant, caplog):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    base_lat = float(participant.trip.geofence_center_lat)
    base_lng = float(participant.trip.geofence_center_lng)
    past_time = timezone.now() - timedelta(minutes=5)
    services.create_location_snapshot(
        participant=participant,
        latitude=base_lat,
        longitude=base_lng,
        measured_at=past_time,
    )
    latest = services.create_location_snapshot(
        participant=participant,
        latitude=base_lat + 0.001,
        longitude=base_lng,
        measured_at=past_time + timedelta(minutes=3),
    )
    logger.info("정렬 검증 - 최신 ID: %s", latest.id)
    ordered = list(LocationSnapshot.objects.order_by("-measured_at"))
    assert ordered[0].id == latest.id
    assert caplog.messages, "정렬 로그가 필요합니다."


@pytest.mark.django_db
def test_health_snapshot_orders_by_measured_at(participant, caplog):
    caplog.set_level(logging.INFO, logger="monitoring.tests")
    base_time = timezone.now() - timedelta(minutes=5)
    services.create_health_snapshot(
        participant=participant,
        heart_rate=60,
        spo2=Decimal("97.00"),
        measured_at=base_time,
    )
    latest = services.create_health_snapshot(
        participant=participant,
        heart_rate=80,
        spo2=Decimal("96.00"),
        measured_at=base_time + timedelta(minutes=2),
    )
    logger.info("건강 정렬 검증 - 최신 ID: %s", latest.id)
    ordered = list(HealthSnapshot.objects.order_by("-measured_at"))
    assert ordered[0].id == latest.id
    assert caplog.messages, "건강 정렬 로그가 필요합니다."