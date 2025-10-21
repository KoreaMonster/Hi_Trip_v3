import json
import logging
from datetime import time, timedelta

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from schedules.models import (
    CoordinatorRole,
    OptionalExpense,
    Place,
    PlaceCoordinator,
    Schedule,
)

LOGGER = logging.getLogger("tests.schedules")

"""향후 고려 사항
=================
실제 서비스에서는 AI 추천 정보가 외부 API와 연동될 가능성이 있습니다.
그때에는 응답 지연이나 통신 오류를 대비한 통합 테스트를 별도로 마련하면
운영 안정성을 높일 수 있습니다.
"""


SCHEDULE_DURATION_CASES = []
for idx in range(1, 16):
    start_hour = 8 + (idx % 5)
    start_minute = 30 if idx % 2 else 0
    should_raise = idx % 4 == 0
    invalid_day = idx % 6 == 0
    order = (idx % 3) + 1
    end_hour = start_hour + (2 if idx % 3 else 1)
    end_minute = 45 if idx % 3 == 0 else 15
    if should_raise:
        end_hour = start_hour - 1
        end_minute = 15
    start_time = time(start_hour % 24, start_minute)
    end_time = time(end_hour % 24, end_minute)
    expected_duration = None
    if not should_raise and not invalid_day:
        expected_duration = (end_hour - start_hour) * 60 + (end_minute - start_minute)
    SCHEDULE_DURATION_CASES.append(
        {
            "id": f"schedule_case_{idx:02d}",
            "start": start_time,
            "end": end_time,
            "day_number": (idx % 5) + 1,
            "order": order,
            "should_raise": should_raise,
            "invalid_day": invalid_day,
            "expected_duration": expected_duration,
            "check_duplicate": idx in {5, 10, 15},
        }
    )


PLACE_CASES = []
place_names = [
    "경복궁",
    "  남산타워  ",
    "한강공원",
    "부산해운대",
    "제주성산일출봉",
    "전주한옥마을",
    "포항영일대",
    "속초설악산",
    "울산대왕암",
    "대구근대골목",
    "대전엑스포",
    "광주국립아시아문화전당",
    "춘천남이섬",
    "군산근대항",
    "경주불국사",
    "여수밤바다",
    "강릉안목해변",
    "인천차이나타운",
    "수원화성",
    "서울로7017",
]
for idx, name in enumerate(place_names, start=1):
    entrance_fee = 0 if idx % 4 == 0 else 3000 + idx * 500
    if idx % 6 == 0:
        entrance_fee = -1000
    activity_minutes = 30 * (idx % 4)
    PLACE_CASES.append(
        {
            "id": f"place_case_{idx:02d}",
            "name": name,
            "entrance_fee": entrance_fee,
            "activity_duration": timedelta(minutes=activity_minutes) if activity_minutes else None,
            "ai_data": {"place_name": f"대체 장소 {idx}", "reason": "혼잡 시 대안"}
            if idx % 3 == 0
            else None,
            "expect_clean_error": entrance_fee < 0 or not name.strip(),
        }
    )


OPTIONAL_EXPENSE_CASES = []
for idx in range(1, 21):
    base_price = 5000 + idx * 500
    prices = [base_price + step * 1000 for step in range(3)]
    if idx % 6 == 0:
        prices[0] = -5000
    selected = [0, 1] if idx % 2 else [1, 2]
    expected_total = sum(prices[i] for i in selected if prices[i] >= 0)
    OPTIONAL_EXPENSE_CASES.append(
        {
            "id": f"expense_case_{idx:02d}",
            "prices": prices,
            "selected": selected,
            "limit": (idx % 3) + 1,
            "expected_total": expected_total,
        }
    )


COORDINATOR_CASES = []
for idx in range(1, 21):
    COORDINATOR_CASES.append(
        {
            "id": f"coordinator_case_{idx:02d}",
            "role_name": "가이드" if idx % 2 else "통역사",
            "missing_name": idx % 5 == 0,
            "missing_phone": idx % 6 == 0,
            "create_multiple": idx % 3 == 0,
            "note": "특별 요청: 조용한 가이드" if idx % 4 == 0 else "",
        }
    )


@pytest.mark.django_db
@pytest.mark.parametrize("case", SCHEDULE_DURATION_CASES, ids=lambda c: c["id"])
def test_schedule_duration_and_clean_rules(case, trip_factory, place_factory):
    logger = LOGGER.getChild("schedule")
    logger.info(
        "[%s] 일정 검증 시작 | day=%s, order=%s, should_raise=%s, invalid_day=%s",
        case["id"],
        case["day_number"],
        case["order"],
        case["should_raise"],
        case["invalid_day"],
    )

    trip_obj = trip_factory(
        title=f"일정 테스트 {case['id']}",
        destination="일정도시",
    )
    place = place_factory(_index=int(case["id"].split("_")[-1]))

    schedule = Schedule(
        trip=trip_obj,
        day_number=case["day_number"],
        order=case["order"],
        place=place,
        start_time=case["start"],
        end_time=case["end"],
    )

    if case["invalid_day"]:
        schedule.day_number = 0
        with pytest.raises(ValidationError):
            logger.info("[%s] 잘못된 일차 검증", case["id"])
            schedule.full_clean()
        return

    if case["should_raise"]:
        with pytest.raises(ValidationError):
            logger.info("[%s] 종료 시간이 시작보다 빠른지 확인", case["id"])
            schedule.full_clean()
        return

    schedule.full_clean()
    schedule.save()
    schedule.refresh_from_db()

    logger.info(
        "[%s] 저장된 일정 | duration_minutes=%s",
        case["id"],
        schedule.duration_minutes,
    )
    assert schedule.duration_minutes == case["expected_duration"]

    if case["check_duplicate"]:
        with pytest.raises(IntegrityError):
            logger.info("[%s] 중복 일정 생성 검증", case["id"])
            Schedule.objects.create(
                trip=trip_obj,
                day_number=case["day_number"],
                order=case["order"],
                place=place,
                start_time=case["start"],
                end_time=case["end"],
            )


@pytest.mark.django_db
@pytest.mark.parametrize("case", PLACE_CASES, ids=lambda c: c["id"])
def test_place_display_and_validation_behaviour(case, place_category):
    logger = LOGGER.getChild("place")
    logger.info(
        "[%s] 장소 검증 시작 | name=%s, entrance_fee=%s",
        case["id"],
        case["name"],
        case["entrance_fee"],
    )

    place = Place(
        name=case["name"],
        category=place_category,
        entrance_fee=case["entrance_fee"],
        ai_alternative_place=case["ai_data"],
    )
    if case["activity_duration"]:
        place.activity_time = case["activity_duration"]

    if case["expect_clean_error"]:
        with pytest.raises(ValidationError):
            logger.info("[%s] 유효성 오류 예상", case["id"])
            place.full_clean()
        return

    place.full_clean()
    place.save()
    place.refresh_from_db()

    expected_display = "무료" if not place.entrance_fee else f"{place.entrance_fee:,}원"
    logger.info(
        "[%s] 표시 정보 | entrance_fee_display=%s",
        case["id"],
        place.entrance_fee_display,
    )
    assert place.entrance_fee_display == expected_display
    assert place.has_image is False

    if case["activity_duration"]:
        display = place.activity_time_display
        logger.info("[%s] 활동 시간 표시=%s", case["id"], display)
        assert display != "정보 없음"
    else:
        assert place.activity_time_display == "정보 없음"

    if isinstance(case["ai_data"], dict):
        info = place.get_alternative_place_info()
        logger.info("[%s] 대체 장소 정보=%s", case["id"], info)
        assert info["place_name"].startswith("대체 장소")
    else:
        assert place.get_alternative_place_info() is None


@pytest.mark.parametrize(
    "payload, expected",
    [
        (
            {
                "alternatives": [
                    {
                        "place": {"name": "카페 소풍", "place_id": "alt123"},
                        "total_duration_seconds": 780,
                        "total_duration_text": "13분",
                        "delta_text": "+2분",
                    }
                ]
            },
            {
                "place_name": "카페 소풍",
                "place_id": "alt123",
                "eta_minutes": 13,
                "total_duration_seconds": 780,
                "total_duration_text": "13분",
                "delta_text": "+2분",
                "reason": "기존 경로 대비 +2분 · 총 소요 13분",
            },
        ),
        (
            json.dumps(
                {
                    "place_name": "야경 스팟",
                    "reason": "야경이 아름다움",
                    "distance_text": "1.2km",
                    "eta_minutes": 5,
                }
            ),
            {
                "place_name": "야경 스팟",
                "reason": "야경이 아름다움",
                "distance_text": "1.2km",
                "eta_minutes": 5,
            },
        ),
    ],
    ids=["nested-google-payload", "stringified-dict"],
)
def test_place_alternative_info_normalization(payload, expected):
    place = Place(name="테스트 장소", ai_alternative_place=payload)

    info = place.get_alternative_place_info()

    assert info is not None
    for key, value in expected.items():
        assert info.get(key) == value


def test_place_alternative_info_invalid_string():
    place = Place(name="테스트", ai_alternative_place="{잘못된 json}")

    assert place.get_alternative_place_info() is None


@pytest.mark.django_db
@pytest.mark.parametrize("case", OPTIONAL_EXPENSE_CASES, ids=lambda c: c["id"])
def test_optional_expense_totals_and_queries(case, place_factory):
    logger = LOGGER.getChild("expense")
    logger.info("[%s] 선택 지출 항목 테스트 시작", case["id"])

    place = place_factory(_index=int(case["id"].split("_")[-1]))
    created_expenses = []

    for idx, price in enumerate(case["prices"]):
        expense = OptionalExpense(
            place=place,
            item_name=f"항목{case['id']}_{idx}",
            price=price,
        )
        if price < 0:
            with pytest.raises(ValidationError):
                logger.info("[%s] 음수 금액 검증", case["id"])
                expense.full_clean()
            continue
        expense.full_clean()
        expense.save()
        created_expenses.append(expense)
        logger.info(
            "[%s] 항목 저장 | item=%s, price=%s",
            case["id"],
            expense.item_name,
            expense.price,
        )

    selected_ids = [
        created_expenses[i].id
        for i in case["selected"]
        if i < len(created_expenses)
    ]
    result = OptionalExpense.calculate_selected_total(selected_ids)
    logger.info(
        "[%s] 선택 합산 결과 | total=%s, count=%s",
        case["id"],
        result["total"],
        result["count"],
    )
    assert result["total"] == case["expected_total"]
    assert result["count"] == len(selected_ids)

    cheapest = list(OptionalExpense.get_cheapest_items(place.id, limit=case["limit"]))
    logger.info(
        "[%s] 저렴한 항목 수=%s",
        case["id"],
        len(cheapest),
    )
    assert len(cheapest) <= case["limit"]


@pytest.mark.django_db
@pytest.mark.parametrize("case", COORDINATOR_CASES, ids=lambda c: c["id"])
def test_place_coordinator_role_assignments(case, place_factory):
    logger = LOGGER.getChild("coordinator")
    place = place_factory(_index=int(case["id"].split("_")[-1]))
    role, _ = CoordinatorRole.objects.get_or_create(name=case["role_name"])
    logger.info("[%s] 역할 준비 | role=%s", case["id"], role.name)

    coordinator = PlaceCoordinator(
        place=place,
        role=role,
        name="" if case["missing_name"] else f"담당자{case['id']}",
        phone="" if case["missing_phone"] else f"010-6600-{case['id'][-2:]}",
        note=case["note"],
    )

    if case["missing_name"] or case["missing_phone"]:
        with pytest.raises(ValidationError):
            logger.info("[%s] 필수 정보 누락 검증", case["id"])
            coordinator.full_clean()
        return

    coordinator.full_clean()
    coordinator.save()
    coordinator.refresh_from_db()
    logger.info(
        "[%s] 담당자 저장 | repr=%s",
        case["id"],
        str(coordinator),
    )
    assert role.name in str(coordinator)

    if case["create_multiple"]:
        extra_role, _ = CoordinatorRole.objects.get_or_create(name=f"특별역할{case['id']}")
        for extra_idx in range(2):
            extra = PlaceCoordinator(
                place=place,
                role=extra_role,
                name=f"추가담당자{extra_idx}",
                phone=f"010-6610-{case['id'][-2:]}{extra_idx}",
            )
            extra.full_clean()
            extra.save()
            logger.info(
                "[%s] 추가 담당자 저장 | name=%s",
                case["id"],
                extra.name,
            )
        coordinators = list(PlaceCoordinator.objects.filter(place=place))
        logger.info(
            "[%s] 총 담당자 수=%s",
            case["id"],
            len(coordinators),
        )
        assert len(coordinators) >= 3