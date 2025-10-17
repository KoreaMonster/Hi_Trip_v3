import logging
from datetime import date, timedelta
import string

import pytest
from django.core.exceptions import ValidationError

from trips.models import Trip, TripParticipant
from users.models import Traveler, User

LOGGER = logging.getLogger("tests.trips")


TRIP_CREATION_CASES = []
_destinations = [
    "서울",
    "부산",
    "제주",
    "강릉",
    "여수",
    "전주",
    "포항",
    "속초",
    "울산",
    "대구",
    "대전",
    "광주",
    "춘천",
    "군산",
    "경주",
]
for idx in range(1, 16):
    TRIP_CREATION_CASES.append(
        {
            "id": f"trip_creation_{idx:02d}",
            "title": f"테스트 여행 {idx:02d}",
            "destination": _destinations[idx - 1],
            "start_offset": idx,
            "duration": (idx % 5) + 2,
            "predefined_code": f"FIXED{idx:03d}" if idx % 5 == 0 else None,
        }
    )


TRIP_STATUS_CASES = [
    {
        "id": "status_case_01",
        "sequence": ["planning", "ongoing", "completed"],
        "invalid": None,
    },
    {
        "id": "status_case_02",
        "sequence": ["planning", "ongoing", "planning"],
        "invalid": None,
    },
    {
        "id": "status_case_03",
        "sequence": ["planning", "completed"],
        "invalid": "archived",
    },
    {
        "id": "status_case_04",
        "sequence": ["planning", "ongoing"],
        "invalid": "cancelled",
    },
    {
        "id": "status_case_05",
        "sequence": ["planning"],
        "invalid": "invalid",
    },
    {
        "id": "status_case_06",
        "sequence": ["planning", "ongoing", "completed", "ongoing"],
        "invalid": None,
    },
    {
        "id": "status_case_07",
        "sequence": ["planning", "completed", "completed"],
        "invalid": "delayed",
    },
    {
        "id": "status_case_08",
        "sequence": ["planning", "ongoing", "ongoing"],
        "invalid": None,
    },
    {
        "id": "status_case_09",
        "sequence": ["planning", "completed", "planning"],
        "invalid": "paused",
    },
    {
        "id": "status_case_10",
        "sequence": ["planning", "ongoing", "completed"],
        "invalid": "archived",
    },
    {
        "id": "status_case_11",
        "sequence": ["planning", "ongoing", "completed"],
        "invalid": None,
    },
    {
        "id": "status_case_12",
        "sequence": ["planning", "planning"],
        "invalid": "unknown",
    },
    {
        "id": "status_case_13",
        "sequence": ["planning", "ongoing"],
        "invalid": "",
    },
    {
        "id": "status_case_14",
        "sequence": ["planning", "completed"],
        "invalid": "archived",
    },
    {
        "id": "status_case_15",
        "sequence": ["planning", "ongoing", "completed", "planning"],
        "invalid": None,
    },
]


TRIP_PARTICIPANT_CASES = []
for idx in range(1, 16):
    TRIP_PARTICIPANT_CASES.append(
        {
            "id": f"participant_case_{idx:02d}",
            "participant_count": idx % 5 + 1,
            "remove_count": 1 if idx % 4 == 0 else 0,
            "prefetch": idx % 3 == 0,
        }
    )


TRIP_MANAGER_CASES = [
    {
        "id": "manager_case_01",
        "new_manager_role": "manager",
        "should_assign": True,
        "assign_none": False,
    },
    {
        "id": "manager_case_02",
        "new_manager_role": "super_admin",
        "should_assign": True,
        "assign_none": False,
    },
    {
        "id": "manager_case_03",
        "new_manager_role": "manager",
        "should_assign": True,
        "assign_none": True,
    },
    {
        "id": "manager_case_04",
        "new_manager_role": "super_admin",
        "should_assign": True,
        "assign_none": True,
    },
    {
        "id": "manager_case_05",
        "new_manager_role": "manager",
        "should_assign": True,
        "assign_none": False,
    },
    {
        "id": "manager_case_06",
        "new_manager_role": "super_admin",
        "should_assign": True,
        "assign_none": False,
    },
    {
        "id": "manager_case_07",
        "new_manager_role": "manager",
        "should_assign": True,
        "assign_none": False,
    },
    {
        "id": "manager_case_08",
        "new_manager_role": "super_admin",
        "should_assign": True,
        "assign_none": False,
    },
    {
        "id": "manager_case_09",
        "new_manager_role": "manager",
        "should_assign": True,
        "assign_none": False,
    },
    {
        "id": "manager_case_10",
        "new_manager_role": "super_admin",
        "should_assign": True,
        "assign_none": False,
    },
    {
        "id": "manager_case_11",
        "new_manager_role": "manager",
        "should_assign": True,
        "assign_none": True,
    },
    {
        "id": "manager_case_12",
        "new_manager_role": "super_admin",
        "should_assign": True,
        "assign_none": False,
    },
    {
        "id": "manager_case_13",
        "new_manager_role": "manager",
        "should_assign": True,
        "assign_none": False,
    },
    {
        "id": "manager_case_14",
        "new_manager_role": "super_admin",
        "should_assign": True,
        "assign_none": False,
    },
    {
        "id": "manager_case_15",
        "new_manager_role": "manager",
        "should_assign": True,
        "assign_none": False,
    },
]


@pytest.mark.django_db
@pytest.mark.parametrize("case", TRIP_CREATION_CASES, ids=lambda c: c["id"])
def test_trip_invite_code_generation_and_uniqueness(case, trip_factory):
    logger = LOGGER.getChild("creation")
    logger.info(
        "[%%s] 여행 생성 시작 | title=%%s, destination=%%s, predefined=%%s",
        case["id"],
        case["title"],
        case["destination"],
        case["predefined_code"],
    )

    start_date = date.today() + timedelta(days=case["start_offset"])
    end_date = start_date + timedelta(days=case["duration"])
    trip_obj = trip_factory(
        _index=case["start_offset"],
        title=case["title"],
        destination=case["destination"],
        start_date=start_date,
        end_date=end_date,
        invite_code=case["predefined_code"],
    )

    logger.info(
        "[%%s] 생성된 여행 | invite_code=%%s",
        case["id"],
        trip_obj.invite_code,
    )

    if case["predefined_code"]:
        assert trip_obj.invite_code == case["predefined_code"]
        logger.info("[%%s] 사전 정의 코드 유지 확인", case["id"])
    else:
        assert trip_obj.invite_code
        assert len(trip_obj.invite_code) == 8
        assert all(ch in string.ascii_uppercase + string.digits for ch in trip_obj.invite_code)
        duplicate_trip = trip_factory(
            _index=case["start_offset"] + 50,
            title=f"{case['title']} 복제",
            destination=case["destination"],
        )
        logger.info(
            "[%%s] 중복 코드 검증 | original=%%s, duplicate=%%s",
            case["id"],
            trip_obj.invite_code,
            duplicate_trip.invite_code,
        )
        assert trip_obj.invite_code != duplicate_trip.invite_code

    assert Trip.objects.filter(invite_code=trip_obj.invite_code).count() == 1
    logger.info("[%%s] 초대 코드 고유성 검증 완료", case["id"])


@pytest.mark.django_db
@pytest.mark.parametrize("case", TRIP_STATUS_CASES, ids=lambda c: c["id"])
def test_trip_status_progression_and_validation(case, trip_factory):
    logger = LOGGER.getChild("status")
    trip_obj = trip_factory(
        title=f"상태 테스트 {case['id']}",
        destination="상태도시",
    )

    for status in case["sequence"]:
        logger.info("[%%s] 상태 변경 시도 | status=%%s", case["id"], status)
        trip_obj.status = status
        trip_obj.full_clean()
        trip_obj.save(update_fields=["status"])
        trip_obj.refresh_from_db()
        assert trip_obj.status == status
        logger.info("[%%s] 상태 변경 완료", case["id"])

    if case["invalid"] is not None:
        trip_obj.status = case["invalid"]
        with pytest.raises(ValidationError):
            logger.info("[%%s] 잘못된 상태 검증: %%s", case["id"], case["invalid"])
            trip_obj.full_clean()
    logger.info("[%%s] 상태 진행 시나리오 종료", case["id"])


@pytest.mark.django_db
@pytest.mark.parametrize("case", TRIP_PARTICIPANT_CASES, ids=lambda c: c["id"])
def test_trip_participant_management_scenarios(case, trip_factory):
    logger = LOGGER.getChild("participants")
    trip_obj = trip_factory(
        title=f"참가자 테스트 {case['id']}",
        destination="참가도시",
    )

    participants = []
    for idx in range(case["participant_count"]):
        traveler = Traveler.objects.create(
            last_name_kr="참가",
            first_name_kr=f"사용자{case['id']}_{idx}",
            first_name_en="Participant",
            last_name_en="Tester",
            birth_date=date(1990, 1, 1) + timedelta(days=idx),
            gender="M" if idx % 2 == 0 else "F",
            phone=f"010-5500-{case['id'][-2:]}{idx:02d}",
            email=f"participant_{case['id']}_{idx}@example.com",
            address="서울",
            country="대한민국",
        )
        TripParticipant.objects.create(trip=trip_obj, traveler=traveler)
        participants.append(traveler)
        logger.info(
            "[%%s] 참가자 추가 | traveler=%%s",
            case["id"],
            traveler.full_name_kr,
        )

    refreshed = Trip.objects.get(pk=trip_obj.pk)
    logger.info(
        "[%%s] 참가자 수 확인 | expected=%%s, actual=%%s",
        case["id"],
        len(participants),
        refreshed.participant_count,
    )
    assert refreshed.participant_count == len(participants)

    if case["prefetch"]:
        cached_trip = Trip.objects.prefetch_related("participants").get(pk=trip_obj.pk)
        logger.info(
            "[%%s] prefetch cache 참가자 수=%%s",
            case["id"],
            cached_trip.participant_count,
        )
        assert cached_trip.participant_count == len(participants)

    if case["remove_count"]:
        removal_targets = TripParticipant.objects.filter(trip=trip_obj)[: case["remove_count"]]
        for record in removal_targets:
            logger.info(
                "[%%s] 참가자 제거 | traveler=%%s",
                case["id"],
                record.traveler.full_name_kr,
            )
            record.delete()
        refreshed = Trip.objects.get(pk=trip_obj.pk)
        logger.info(
            "[%%s] 제거 후 참가자 수=%%s",
            case["id"],
            refreshed.participant_count,
        )
        assert refreshed.participant_count == len(participants) - case["remove_count"]


@pytest.mark.django_db
@pytest.mark.parametrize("case", TRIP_MANAGER_CASES, ids=lambda c: c["id"])
def test_trip_assign_manager_and_metadata(case, trip_factory):
    logger = LOGGER.getChild("manager")
    trip_obj = trip_factory(
        title=f"담당자 테스트 {case['id']}",
        destination="담당도시",
    )

    new_manager = User.objects.create_user(
        username=f"manager_{case['id']}",
        password="manager-pass",
        email=f"manager_{case['id']}@example.com",
        first_name="Manager",
        last_name="Candidate",
        first_name_kr="담당",
        last_name_kr="후보",
        role=case["new_manager_role"],
        is_approved=True,
    )

    logger.info("[%%s] 신규 담당자 생성 | username=%%s", case["id"], new_manager.username)

    if case["assign_none"]:
        trip_obj.assign_manager(None)
        trip_obj.refresh_from_db()
        logger.info("[%%s] 담당자 제거 결과 | manager=%%s", case["id"], trip_obj.manager)
        assert trip_obj.manager is None

    if case["should_assign"]:
        trip_obj.assign_manager(new_manager)
        trip_obj.refresh_from_db()
        logger.info(
            "[%%s] 담당자 재배정 결과 | manager=%%s",
            case["id"],
            trip_obj.manager.username,
        )
        assert trip_obj.manager == new_manager

    trip_obj.assign_manager(new_manager)
    trip_obj.refresh_from_db()
    logger.info(
        "[%%s] 담당자 재저장 후 상태 확인 | manager=%%s",
        case["id"],
        trip_obj.manager.username if trip_obj.manager else None,
    )