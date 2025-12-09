from __future__ import annotations

from datetime import date, time, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from monitoring.models import MonitoringAlert
from schedules.models import Place, PlaceCategory, Schedule
from trips.models import Trip, TripParticipant
from users.models import Traveler, User


class Command(BaseCommand):
    help = "Seed minimal demo data for Swagger demo (users, trip, schedule, place)."

    def handle(self, *args, **options):
        with transaction.atomic():
            demo_admin, admin_created = User.objects.get_or_create(
                username="demo_admin",
                defaults={
                    "first_name": "Demo",
                    "last_name": "Admin",
                    "first_name_kr": "데모",
                    "last_name_kr": "관리자",
                    "role": "super_admin",
                    "is_staff": True,
                    "is_superuser": True,
                    "is_approved": True,
                },
            )
            if admin_created:
                demo_admin.set_password("demo1234")
                demo_admin.save()

            manager, manager_created = User.objects.get_or_create(
                username="demo_manager",
                defaults={
                    "first_name": "Demo",
                    "last_name": "Manager",
                    "first_name_kr": "데모",
                    "last_name_kr": "담당자",
                    "role": "manager",
                    "is_staff": True,
                    "is_approved": True,
                },
            )
            if manager_created:
                manager.set_password("demo1234")
                manager.save()

            traveler, _ = Traveler.objects.get_or_create(
                phone="010-0000-0000",
                defaults={
                    "first_name_kr": "길동",
                    "last_name_kr": "홍",
                    "first_name_en": "Gildong",
                    "last_name_en": "Hong",
                    "birth_date": date(1990, 1, 1),
                    "gender": "M",
                    "email": "traveler@example.com",
                    "address": "서울시 데모구 데모동",
                    "country": "대한민국",
                    "is_companion": False,
                    "proxy_booking": False,
                    "total_amount": 1000000,
                    "paid_amount": 500000,
                },
            )

            category, _ = PlaceCategory.objects.get_or_create(
                name="랜드마크",
                defaults={"description": "데모용 랜드마크 카테고리"},
            )

            place, _ = Place.objects.get_or_create(
                name="Demo Palace",
                defaults={
                    "address": "서울시 중구 데모로 1",
                    "category": category,
                    "latitude": 37.5665,
                    "longitude": 126.978,
                },
            )

            today = date.today()
            trip, _ = Trip.objects.get_or_create(
                title="Demo Trip to Seoul",
                defaults={
                    "destination": "Seoul",
                    "start_date": today + timedelta(days=1),
                    "end_date": today + timedelta(days=3),
                    "status": "planning",
                    "manager": manager,
                },
            )

            participant, _ = TripParticipant.objects.get_or_create(
                trip=trip,
                traveler=traveler,
            )

            Schedule.objects.update_or_create(
                trip=trip,
                day_number=1,
                order=1,
                defaults={
                    "start_time": time(9, 0),
                    "end_time": time(12, 0),
                    "place": place,
                    "transport": "도보",
                    "main_content": "도심 투어 및 오리엔테이션",
                    "meeting_point": "호텔 로비",
                    "budget": 0,
                },
            )

            MonitoringAlert.objects.get_or_create(
                participant=participant,
                alert_type="health",
                snapshot_time=timezone.now(),
                defaults={
                    "message": "데모 알림: 일정이 정상적으로 시작되었습니다.",
                },
            )

        self.stdout.write(self.style.SUCCESS("Demo data seeded."))
        self.stdout.write(self.style.SUCCESS("Users: demo_admin / demo_manager (pw: demo1234)"))
        self.stdout.write(self.style.SUCCESS("Traveler/Trip/Schedule/Place created for demo."))
