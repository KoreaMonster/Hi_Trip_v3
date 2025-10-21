from django.core.management import call_command
from django.test import TestCase

from schedules.models import Schedule
from trips.models import Trip, TripParticipant
from users.models import Traveler, User


class SeedDemoDataCommandTests(TestCase):
    """데모 데이터 시드 명령이 핵심 리소스를 생성하는지 확인한다."""

    def test_seed_demo_data_populates_trip_and_relations(self):
        call_command("seed_demo_data")

        self.assertTrue(User.objects.filter(username="supervisor").exists())
        self.assertTrue(User.objects.filter(username="manager01").exists())

        trip = Trip.objects.get(title="서울 문화 탐방 1박 2일")
        self.assertIsNotNone(trip.manager)
        self.assertGreater(trip.schedules.count(), 0)
        self.assertGreater(trip.participants.count(), 0)

        # 참가자와 여행자 정보가 함께 생성되는지 확인
        participant = TripParticipant.objects.first()
        self.assertIsNotNone(participant)
        self.assertIsInstance(participant.traveler, Traveler)

        # 일정이 겹치지 않도록 구성되었는지 간단히 검증
        first_day = list(
            Schedule.objects.filter(trip=trip, day_number=1).order_by("start_time")
        )
        for current, nxt in zip(first_day, first_day[1:]):
            self.assertLessEqual(current.end_time, nxt.start_time)
