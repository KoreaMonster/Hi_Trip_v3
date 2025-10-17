import logging
from datetime import date

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from users.models import Traveler, User

LOGGER = logging.getLogger("tests.users")


USER_FULL_NAME_CASES = [
    {
        "id": "user_full_case_01",
        "username_suffix": "01",
        "first_name": "Jane",
        "last_name": "Manager",
        "first_name_kr": "길동",
        "last_name_kr": "홍",
        "expected_kr": "홍길동",
        "expected_en": "Jane Manager",
        "role": "manager",
        "approved": True,
    },
    {
        "id": "user_full_case_02",
        "username_suffix": "02",
        "first_name": "Charles",
        "last_name": "Kim",
        "first_name_kr": "철수",
        "last_name_kr": "김",
        "expected_kr": "김철수",
        "expected_en": "Charles Kim",
        "role": "super_admin",
        "approved": False,
    },
    {
        "id": "user_full_case_03",
        "username_suffix": "03",
        "first_name": "Younghee",
        "last_name": "Park",
        "first_name_kr": "영희",
        "last_name_kr": "박",
        "expected_kr": "박영희",
        "expected_en": "Younghee Park",
        "role": "manager",
        "approved": True,
    },
    {
        "id": "user_full_case_04",
        "username_suffix": "04",
        "first_name": "",
        "last_name": "",
        "first_name_kr": "",
        "last_name_kr": "",
        "expected_kr": "__username__",
        "expected_en": "",
        "role": "manager",
        "approved": False,
    },
    {
        "id": "user_full_case_05",
        "username_suffix": "05",
        "first_name": "Sujeong",
        "last_name": "",
        "first_name_kr": "수정",
        "last_name_kr": "최",
        "expected_kr": "최수정",
        "expected_en": "Sujeong",
        "role": "super_admin",
        "approved": True,
    },
    {
        "id": "user_full_case_06",
        "username_suffix": "06",
        "first_name": "",
        "last_name": "Han",
        "first_name_kr": "가람",
        "last_name_kr": "한",
        "expected_kr": "한가람",
        "expected_en": "Han",
        "role": "manager",
        "approved": False,
    },
    {
        "id": "user_full_case_07",
        "username_suffix": "07",
        "first_name": "Doyun",
        "last_name": "Yoon",
        "first_name_kr": "도윤",
        "last_name_kr": "윤",
        "expected_kr": "윤도윤",
        "expected_en": "Doyun Yoon",
        "role": "manager",
        "approved": True,
    },
    {
        "id": "user_full_case_08",
        "username_suffix": "08",
        "first_name": "Hyejin",
        "last_name": "Shin",
        "first_name_kr": "혜진",
        "last_name_kr": "신",
        "expected_kr": "신혜진",
        "expected_en": "Hyejin Shin",
        "role": "super_admin",
        "approved": True,
    },
    {
        "id": "user_full_case_09",
        "username_suffix": "09",
        "first_name": "Sejin",
        "last_name": "Chung",
        "first_name_kr": "세진",
        "last_name_kr": "정",
        "expected_kr": "정세진",
        "expected_en": "Sejin Chung",
        "role": "manager",
        "approved": False,
    },
    {
        "id": "user_full_case_10",
        "username_suffix": "10",
        "first_name": "Taemin",
        "last_name": "Oh",
        "first_name_kr": "태민",
        "last_name_kr": "오",
        "expected_kr": "오태민",
        "expected_en": "Taemin Oh",
        "role": "super_admin",
        "approved": True,
    },
]


USER_ROLE_CASES = [
    {
        "id": "approval_case_01",
        "username_suffix": "a01",
        "initial_role": "manager",
        "initial_approved": False,
        "toggle_to": True,
        "new_role": "super_admin",
        "should_raise": False,
    },
    {
        "id": "approval_case_02",
        "username_suffix": "a02",
        "initial_role": "super_admin",
        "initial_approved": True,
        "toggle_to": False,
        "new_role": "manager",
        "should_raise": False,
    },
    {
        "id": "approval_case_03",
        "username_suffix": "a03",
        "initial_role": "manager",
        "initial_approved": True,
        "toggle_to": False,
        "new_role": "manager",
        "should_raise": False,
    },
    {
        "id": "approval_case_04",
        "username_suffix": "a04",
        "initial_role": "manager",
        "initial_approved": False,
        "toggle_to": False,
        "new_role": "manager",
        "should_raise": False,
    },
    {
        "id": "approval_case_05",
        "username_suffix": "a05",
        "initial_role": "super_admin",
        "initial_approved": False,
        "toggle_to": True,
        "new_role": "super_admin",
        "should_raise": False,
    },
    {
        "id": "approval_case_06",
        "username_suffix": "a06",
        "initial_role": "manager",
        "initial_approved": True,
        "toggle_to": True,
        "new_role": "manager",
        "should_raise": False,
    },
    {
        "id": "approval_case_07",
        "username_suffix": "a07",
        "initial_role": "manager",
        "initial_approved": False,
        "toggle_to": True,
        "new_role": "manager",
        "should_raise": False,
    },
    {
        "id": "approval_case_08",
        "username_suffix": "a08",
        "initial_role": "super_admin",
        "initial_approved": True,
        "toggle_to": True,
        "new_role": "super_admin",
        "should_raise": False,
    },
    {
        "id": "approval_case_09",
        "username_suffix": "a09",
        "initial_role": "manager",
        "initial_approved": True,
        "toggle_to": False,
        "new_role": "super_admin",
        "should_raise": False,
    },
    {
        "id": "approval_case_10",
        "username_suffix": "a10",
        "initial_role": "manager",
        "initial_approved": True,
        "toggle_to": True,
        "new_role": "intern",
        "should_raise": True,
    },
]


TRAVELER_PAYMENT_CASES = [
    {
        "id": "payment_case_01",
        "total": 100000,
        "paid": 0,
        "increment": 100000,
        "expected_initial": False,
        "expected_after_update": True,
    },
    {
        "id": "payment_case_02",
        "total": 150000,
        "paid": 50000,
        "increment": 50000,
        "expected_initial": False,
        "expected_after_update": False,
    },
    {
        "id": "payment_case_03",
        "total": 150000,
        "paid": 150000,
        "increment": 0,
        "expected_initial": True,
        "expected_after_update": True,
    },
    {
        "id": "payment_case_04",
        "total": 200000,
        "paid": 250000,
        "increment": 0,
        "expected_initial": True,
        "expected_after_update": True,
    },
    {
        "id": "payment_case_05",
        "total": 0,
        "paid": 0,
        "increment": 0,
        "expected_initial": True,
        "expected_after_update": True,
    },
    {
        "id": "payment_case_06",
        "total": 50000,
        "paid": 10000,
        "increment": 40000,
        "expected_initial": False,
        "expected_after_update": True,
    },
    {
        "id": "payment_case_07",
        "total": 75000,
        "paid": 25000,
        "increment": 25000,
        "expected_initial": False,
        "expected_after_update": False,
    },
    {
        "id": "payment_case_08",
        "total": 80000,
        "paid": 60000,
        "increment": 10000,
        "expected_initial": False,
        "expected_after_update": False,
    },
    {
        "id": "payment_case_09",
        "total": 90000,
        "paid": 85000,
        "increment": 10000,
        "expected_initial": False,
        "expected_after_update": True,
    },
    {
        "id": "payment_case_10",
        "total": 120000,
        "paid": 50000,
        "increment": 70000,
        "expected_initial": False,
        "expected_after_update": True,
    },
    {
        "id": "payment_case_11",
        "total": 60000,
        "paid": 30000,
        "increment": -10000,
        "expected_initial": False,
        "expected_after_update": False,
    },
    {
        "id": "payment_case_12",
        "total": 100000,
        "paid": 40000,
        "increment": 50000,
        "expected_initial": False,
        "expected_after_update": False,
    },
]


TRAVELER_VERIFICATION_CASES = [
    {
        "id": "verification_case_01",
        "passport_verified": True,
        "identity_verified": True,
        "booking_verified": True,
        "is_companion": False,
        "companion_names": "",
        "proxy_booking": False,
        "duplicate_phone": False,
        "expect_clean_error": False,
    },
    {
        "id": "verification_case_02",
        "passport_verified": False,
        "identity_verified": True,
        "booking_verified": False,
        "is_companion": True,
        "companion_names": "홍길동, 이순신",
        "proxy_booking": True,
        "duplicate_phone": False,
        "expect_clean_error": False,
    },
    {
        "id": "verification_case_03",
        "passport_verified": True,
        "identity_verified": False,
        "booking_verified": False,
        "is_companion": False,
        "companion_names": "",
        "proxy_booking": False,
        "duplicate_phone": True,
        "expect_clean_error": False,
    },
    {
        "id": "verification_case_04",
        "passport_verified": False,
        "identity_verified": False,
        "booking_verified": True,
        "is_companion": True,
        "companion_names": "김영희",
        "proxy_booking": False,
        "duplicate_phone": False,
        "expect_clean_error": False,
    },
    {
        "id": "verification_case_05",
        "passport_verified": True,
        "identity_verified": True,
        "booking_verified": False,
        "is_companion": False,
        "companion_names": "",
        "proxy_booking": True,
        "duplicate_phone": False,
        "expect_clean_error": False,
    },
    {
        "id": "verification_case_06",
        "passport_verified": False,
        "identity_verified": True,
        "booking_verified": True,
        "is_companion": True,
        "companion_names": "박찬호",
        "proxy_booking": False,
        "duplicate_phone": False,
        "expect_clean_error": False,
    },
    {
        "id": "verification_case_07",
        "passport_verified": False,
        "identity_verified": False,
        "booking_verified": False,
        "is_companion": False,
        "companion_names": "",
        "proxy_booking": False,
        "duplicate_phone": False,
        "expect_clean_error": True,
    },
    {
        "id": "verification_case_08",
        "passport_verified": True,
        "identity_verified": True,
        "booking_verified": True,
        "is_companion": True,
        "companion_names": "김동행",
        "proxy_booking": True,
        "duplicate_phone": False,
        "expect_clean_error": False,
    },
]


@pytest.mark.django_db
@pytest.mark.parametrize("case", USER_FULL_NAME_CASES, ids=lambda c: c["id"])
def test_user_full_name_variations(case):
    logger = LOGGER.getChild("full_name")
    username = f"user_full_{case['username_suffix']}"
    logger.info("[%%s] 사용자 생성 시작", case["id"])

    user = User.objects.create_user(
        username=username,
        password="test-password",
        email=f"{username}@example.com",
        first_name=case["first_name"],
        last_name=case["last_name"],
        first_name_kr=case["first_name_kr"],
        last_name_kr=case["last_name_kr"],
        role=case["role"],
        is_approved=case["approved"],
    )

    expected_kr = case["expected_kr"]
    if expected_kr == "__username__":
        expected_kr = username

    logger.info(
        "[%%s] 생성된 사용자 정보 | username=%%s, full_name_kr=%%s, full_name_en=%%s",
        case["id"],
        user.username,
        user.full_name_kr,
        user.full_name_en,
    )

    assert user.full_name_kr == expected_kr
    assert user.full_name_en == case["expected_en"]
    assert str(user) == f"{user.username} ({user.get_role_display()})"
    logger.info("[%%s] 이름 검증 완료", case["id"])


@pytest.mark.django_db
@pytest.mark.parametrize("case", USER_ROLE_CASES, ids=lambda c: c["id"])
def test_user_role_and_approval_behaviour(case):
    logger = LOGGER.getChild("role")
    username = f"role_user_{case['username_suffix']}"
    logger.info("[%%s] 초기 사용자 생성", case["id"])

    user = User.objects.create_user(
        username=username,
        password="role-password",
        email=f"{username}@example.com",
        first_name="Role",
        last_name="Tester",
        first_name_kr="역할",
        last_name_kr="테스터",
        role=case["initial_role"],
        is_approved=case["initial_approved"],
    )

    logger.info("[%%s] 초기 상태 | role=%%s, is_approved=%%s", case["id"], user.role, user.is_approved)

    user.is_approved = case["toggle_to"]
    user.save(update_fields=["is_approved"])
    user.refresh_from_db()

    logger.info(
        "[%%s] 승인 상태 변경 후 | is_approved=%%s", case["id"], user.is_approved
    )
    assert user.is_approved == case["toggle_to"]

    user.role = case["new_role"]
    if case["should_raise"]:
        with pytest.raises(ValidationError):
            logger.info("[%%s] 잘못된 역할 검증 시도: %%s", case["id"], case["new_role"])
            user.full_clean()
    else:
        user.full_clean()
        user.save(update_fields=["role"])
        user.refresh_from_db()
        logger.info("[%%s] 역할 변경 후 | role=%%s", case["id"], user.role)
        assert user.role == case["new_role"]


@pytest.mark.django_db
@pytest.mark.parametrize("case", TRAVELER_PAYMENT_CASES, ids=lambda c: c["id"])
def test_traveler_payment_status_scenarios(case):
    logger = LOGGER.getChild("payment")
    logger.info(
        "[%%s] 여행자 결제 상태 테스트 준비 | total=%%s, paid=%%s",
        case["id"],
        case["total"],
        case["paid"],
    )

    traveler = Traveler.objects.create(
        last_name_kr="결제",
        first_name_kr=case["id"],
        first_name_en="Payment",
        last_name_en="Tester",
        birth_date=date(1990, 1, 1),
        gender="M",
        phone=f"010-7000-{TRAVELER_PAYMENT_CASES.index(case):04d}",
        email=f"payment_{case['id']}@example.com",
        address="서울",
        country="대한민국",
        total_amount=case["total"],
        paid_amount=case["paid"],
    )

    logger.info(
        "[%%s] 초기 결제 상태 | payment_status=%%s",
        case["id"],
        traveler.payment_status,
    )
    assert traveler.payment_status is case["expected_initial"]

    traveler.paid_amount = traveler.paid_amount + case["increment"]
    traveler.save(update_fields=["paid_amount"])
    traveler.refresh_from_db()

    logger.info(
        "[%%s] 결제 금액 변경 후 | paid_amount=%%s, payment_status=%%s",
        case["id"],
        traveler.paid_amount,
        traveler.payment_status,
    )

    assert traveler.payment_status is case["expected_after_update"]


@pytest.mark.django_db
@pytest.mark.parametrize("case", TRAVELER_VERIFICATION_CASES, ids=lambda c: c["id"])
def test_traveler_verification_and_contact_scenarios(case):
    logger = LOGGER.getChild("verification")
    base_phone = f"010-8800-{TRAVELER_VERIFICATION_CASES.index(case):04d}"
    logger.info("[%%s] 여행자 생성 절차 시작", case["id"])

    traveler = Traveler(
        last_name_kr="검증",
        first_name_kr=case["id"],
        first_name_en="Verify",
        last_name_en="Tester",
        birth_date=date(1992, 5, 15),
        gender="F",
        phone=base_phone,
        email=f"verify_{case['id']}@example.com",
        address="부산",
        country="대한민국",
        total_amount=220000,
        paid_amount=110000,
        passport_verified=case["passport_verified"],
        identity_verified=case["identity_verified"],
        booking_verified=case["booking_verified"],
        is_companion=case["is_companion"],
        companion_names=case["companion_names"],
        proxy_booking=case["proxy_booking"],
    )

    if case["expect_clean_error"]:
        traveler.phone = ""
        with pytest.raises(ValidationError):
            logger.info("[%%s] 필수 정보 누락 검증", case["id"])
            traveler.full_clean()
        return

    traveler.full_clean()
    traveler.save()
    traveler.refresh_from_db()

    logger.info(
        "[%%s] 저장 완료 | passport_verified=%%s, identity_verified=%%s, booking_verified=%%s",
        case["id"],
        traveler.passport_verified,
        traveler.identity_verified,
        traveler.booking_verified,
    )

    if case["duplicate_phone"]:
        with pytest.raises(IntegrityError):
            logger.info("[%%s] 중복 연락처 생성 시도", case["id"])
            Traveler.objects.create(
                last_name_kr="중복",
                first_name_kr="여행자",
                first_name_en="Duplicate",
                last_name_en="Tester",
                birth_date=date(1991, 3, 3),
                gender="M",
                phone=base_phone,
                email=f"duplicate_{case['id']}@example.com",
                address="인천",
                country="대한민국",
            )

    assert traveler.is_companion is case["is_companion"]
    assert traveler.proxy_booking is case["proxy_booking"]
    logger.info("[%%s] 검증 및 연락처 시나리오 완료", case["id"])