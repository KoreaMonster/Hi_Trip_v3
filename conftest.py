import logging
import os
from datetime import date, timedelta

import django
import pytest

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Hi_Trip_v3.settings")
django.setup()

pytest_plugins = ["pytest_django"]


@pytest.fixture
def manager_user(db):
    from users.models import User

    return User.objects.create_user(
        username="manager",
        password="secure-password",
        email="manager@example.com",
        first_name="Jane",
        last_name="Manager",
        first_name_kr="길동",
        last_name_kr="홍",
        role="manager",
        is_approved=True,
    )


@pytest.fixture
def traveler(db):
    from users.models import Traveler

    return Traveler.objects.create(
        last_name_kr="김",
        first_name_kr="철수",
        first_name_en="Chulsoo",
        last_name_en="Kim",
        birth_date=date(1990, 1, 1),
        gender="M",
        phone="010-0000-0000",
        email="traveler@example.com",
        address="서울 특별시",
        country="대한민국",
        total_amount=100000,
        paid_amount=50000,
    )


@pytest.fixture
def additional_travelers(db):
    """테스트에서 다양한 여행자 조합을 사용할 수 있도록 다수의 여행자를 생성합니다."""
    from users.models import Traveler

    created = []
    base_date = date(1980, 1, 1)
    for idx in range(1, 11):
        created.append(
            Traveler.objects.create(
                last_name_kr=f"테스트{idx}",
                first_name_kr=f"사용자{idx}",
                first_name_en=f"Tester{idx}",
                last_name_en=f"User{idx}",
                birth_date=base_date.replace(year=base_date.year + idx),
                gender="M" if idx % 2 else "F",
                phone=f"010-9000-{idx:04d}",
                email=f"traveler{idx}@example.com",
                address="서울특별시", 
                country="대한민국",
                total_amount=200000 + idx * 1000,
                paid_amount=100000 + idx * 500,
            )
        )

    logging.getLogger("tests.fixtures").info("생성된 여행자 수: %s", len(created))
    return created


@pytest.fixture
def trip(db, manager_user):
    from trips.models import Trip

    return Trip.objects.create(
        title="서울 투어",
        destination="서울",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=2),
        manager=manager_user,
    )


@pytest.fixture
def trip_factory(db, manager_user):
    from trips.models import Trip

    def create_trip(**kwargs):
        base_index = kwargs.pop("_index", 1)
        defaults = {
            "title": f"기본 여행 {base_index}",
            "destination": "부산",
            "start_date": date.today() + timedelta(days=base_index),
            "end_date": date.today() + timedelta(days=base_index + 3),
            "manager": manager_user,
        }
        defaults.update(kwargs)
        trip_obj = Trip.objects.create(**defaults)
        logging.getLogger("tests.fixtures").info(
            "생성된 여행: %s (%s)", trip_obj.title, trip_obj.invite_code
        )
        return trip_obj

    return create_trip


@pytest.fixture
def place_category(db):
    from schedules.models import PlaceCategory

    return PlaceCategory.objects.create(name="문화재")


@pytest.fixture
def place(db, place_category):
    from schedules.models import Place

    return Place.objects.create(
        name="경복궁",
        category=place_category,
        entrance_fee=3000,
    )


@pytest.fixture
def place_factory(db, place_category):
    from schedules.models import Place

    def create_place(**kwargs):
        idx = kwargs.pop("_index", 1)
        defaults = {
            "name": f"장소 {idx}",
            "category": place_category,
            "entrance_fee": 1000 * idx,
        }
        defaults.update(kwargs)
        place_obj = Place.objects.create(**defaults)
        logging.getLogger("tests.fixtures").info(
            "생성된 장소: %s / 입장료: %s", place_obj.name, place_obj.entrance_fee
        )
        return place_obj

    return create_place