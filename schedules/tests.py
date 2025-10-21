from datetime import time

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from schedules.models import Place, PlaceCategory, Schedule
from trips.models import Trip
from users.models import User


class TripScheduleValidationTests(APITestCase):
    """여행 일정 생성 및 재배치 기능을 검증한다."""

    def setUp(self):
        self.super_admin = User.objects.create_user(
            username="admin",
            password="test1234",
            role="super_admin",
            is_approved=True,
        )
        self.client.force_authenticate(self.super_admin)

        self.trip = Trip.objects.create(
            title="테스트 여행",
            destination="서울",
            start_date="2025-01-01",
            end_date="2025-01-03",
            status="planning",
            manager=self.super_admin,
        )

        self.category = PlaceCategory.objects.create(name="문화")
        self.place = Place.objects.create(
            name="경복궁",
            address="서울 종로구 사직로 161",
            category=self.category,
        )

    def _schedule_url(self):
        return reverse("trip-schedule-list", kwargs={"trip_pk": self.trip.pk})

    def test_create_schedule_rejects_overlapping_times(self):
        """같은 날 겹치는 시간이 존재하면 400 오류를 반환한다."""

        response = self.client.post(
            self._schedule_url(),
            {
                "place_id": self.place.pk,
                "day_number": 1,
                "start_time": "09:00:00",
                "end_time": "10:00:00",
                "main_content": "궁 투어",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        overlap = self.client.post(
            self._schedule_url(),
            {
                "place_id": self.place.pk,
                "day_number": 1,
                "start_time": "09:30:00",
                "end_time": "10:30:00",
                "main_content": "겹치는 일정",
            },
            format="json",
        )
        self.assertEqual(overlap.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("start_time", overlap.data)
        self.assertEqual(Schedule.objects.count(), 1)

    def test_rebalance_updates_order_and_times(self):
        """재배치 액션이 순서와 시간을 다시 계산한다."""

        first = self.client.post(
            self._schedule_url(),
            {
                "place_id": self.place.pk,
                "day_number": 1,
                "start_time": "09:00:00",
                "end_time": "10:00:00",
                "main_content": "첫 번째 일정",
            },
            format="json",
        ).data

        second = self.client.post(
            self._schedule_url(),
            {
                "place_id": self.place.pk,
                "day_number": 1,
                "start_time": "11:00:00",
                "end_time": "13:00:00",
                "main_content": "두 번째 일정",
            },
            format="json",
        ).data

        rebalance_url = reverse(
            "trip-schedule-rebalance-day",
            kwargs={"trip_pk": self.trip.pk},
        )
        payload = {
            "day_number": 1,
            "schedule_ids": [second["id"], first["id"]],
            "travel_mode": "DRIVE",
            "day_start_time": "08:00:00",
        }

        response = self.client.post(rebalance_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.trip.refresh_from_db()
        schedules = list(
            Schedule.objects.filter(trip=self.trip, day_number=1).order_by("order")
        )
        self.assertEqual(schedules[0].id, second["id"])
        self.assertEqual(schedules[0].start_time, time(hour=8, minute=0))
        self.assertEqual(schedules[0].end_time, time(hour=10, minute=0))

        self.assertEqual(schedules[1].id, first["id"])
        self.assertEqual(schedules[1].start_time, time(hour=10, minute=0))
        self.assertEqual(schedules[1].end_time, time(hour=11, minute=0))
