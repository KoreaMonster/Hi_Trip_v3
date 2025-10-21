from __future__ import annotations

from datetime import date, time, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from schedules.models import Place, PlaceCategory, Schedule
from trips.models import Trip, TripParticipant
from users.models import Traveler, User


class Command(BaseCommand):
    help = "MVP 검증을 위한 데모 데이터를 생성합니다."

    def handle(self, *args, **options):
        with transaction.atomic():
            supervisor = self._ensure_supervisor()
            manager = self._ensure_manager()
            categories = self._ensure_categories()
            places = self._ensure_places(categories)
            trip = self._ensure_trip(manager)
            self._ensure_schedules(trip, places)
            travelers = self._ensure_travelers()
            self._ensure_participants(trip, travelers)

        self.stdout.write(self.style.SUCCESS("데모 데이터 구성이 완료되었습니다."))

    def _ensure_supervisor(self) -> User:
        user, created = User.objects.get_or_create(
            username="supervisor",
            defaults={
                "first_name": "MVP",
                "last_name": "Lead",
                "first_name_kr": "현장",
                "last_name_kr": "총괄",
                "email": "supervisor@example.com",
                "phone": "010-1000-2000",
                "role": "super_admin",
                "is_approved": True,
            },
        )
        if created:
            user.set_password("admin1234")
            user.save(update_fields=["password"])
        return user

    def _ensure_manager(self) -> User:
        user, created = User.objects.get_or_create(
            username="manager01",
            defaults={
                "first_name": "Jin",
                "last_name": "Park",
                "first_name_kr": "지훈",
                "last_name_kr": "박",
                "email": "manager@example.com",
                "phone": "010-2000-3000",
                "role": "manager",
                "is_approved": True,
            },
        )
        if created:
            user.set_password("manager1234")
            user.save(update_fields=["password"])
        return user

    def _ensure_categories(self) -> dict[str, PlaceCategory]:
        mapping: dict[str, PlaceCategory] = {}
        payload = [
            ("heritage", "문화재"),
            ("dining", "맛집"),
            ("nature", "자연"),
            ("activity", "체험"),
        ]
        for slug, name in payload:
            category, _ = PlaceCategory.objects.get_or_create(
                name=name,
                defaults={"description": f"{name} 카테고리"},
            )
            mapping[slug] = category
        return mapping

    def _ensure_places(self, categories: dict[str, PlaceCategory]) -> dict[str, Place]:
        data = {
            "palace": {
                "name": "경복궁",
                "address": "서울 종로구 사직로 161",
                "category": categories["heritage"],
                "ai_generated_info": "조선 왕조의 법궁으로, 새벽 시간을 활용하면 한적하게 관람할 수 있습니다.",
                "ai_meeting_point": "흥례문 매표소 앞",
                "ai_alternative_place": {
                    "place_name": "창덕궁",
                    "reason": "인접한 궁궐로 이동 동선이 유사하며 비가 와도 실내 관람이 가능합니다.",
                },
            },
            "market": {
                "name": "광장시장",
                "address": "서울 종로구 창경궁로 88",
                "category": categories["dining"],
                "ai_generated_info": "빈대떡, 마약김밥 등 전통 먹거리가 풍부하며 오후 2시 이후 방문 시 대기 시간이 짧습니다.",
                "ai_meeting_point": "1번 게이트 앞",
                "ai_alternative_place": {
                    "place_name": "통인시장",
                    "reason": "도보 10분 거리에 위치하며 점심 시간 이후 혼잡도가 낮습니다.",
                },
            },
            "hanriver": {
                "name": "한강 세빛섬",
                "address": "서울 서초구 올림픽대로 2085-14",
                "category": categories["nature"],
                "ai_generated_info": "석양 무렵 방문 시 조명 연출이 아름답고, 단체 사진 촬영 명소로 추천됩니다.",
                "ai_meeting_point": "세빛섬 인포메이션 데스크",
                "ai_alternative_place": {
                    "place_name": "뚝섬 한강공원",
                    "reason": "야외 체험 공간과 야간 조명이 잘 갖춰져 있어 비슷한 분위기를 제공합니다.",
                },
            },
            "experience": {
                "name": "한복 문화 체험관",
                "address": "서울 종로구 북촌로 12",
                "category": categories["activity"],
                "ai_generated_info": "10인 이상 단체 예약 시 전문 해설사가 동행하며, 한복 착용 후 사진 촬영 공간을 제공합니다.",
                "ai_meeting_point": "체험관 안내 데스크",
                "ai_alternative_place": {
                    "place_name": "전통문화 체험학교",
                    "reason": "우천 시에도 실내에서 다채로운 체험 프로그램을 운영합니다.",
                },
            },
        }

        created_places: dict[str, Place] = {}
        for slug, payload in data.items():
            place, _ = Place.objects.update_or_create(
                name=payload["name"],
                defaults={
                    "address": payload["address"],
                    "category": payload["category"],
                    "ai_generated_info": payload["ai_generated_info"],
                    "ai_meeting_point": payload["ai_meeting_point"],
                    "ai_alternative_place": payload["ai_alternative_place"],
                    "entrance_fee": 0,
                    "activity_time": timedelta(hours=2),
                },
            )
            created_places[slug] = place
        return created_places

    def _ensure_trip(self, manager: User) -> Trip:
        today = timezone.localdate()
        defaults = {
            "destination": "서울",
            "start_date": today,
            "end_date": today + timedelta(days=1),
            "status": "ongoing",
            "manager": manager,
            "heart_rate_min": 55,
            "heart_rate_max": 110,
            "spo2_min": "94.00",
        }
        trip, _ = Trip.objects.update_or_create(
            title="서울 문화 탐방 1박 2일",
            defaults=defaults,
        )
        return trip

    def _ensure_schedules(self, trip: Trip, places: dict[str, Place]) -> None:
        plan = {
            1: [
                (time(hour=9, minute=0), time(hour=11, minute=0), "오전 입장 및 전통 해설 투어", places["palace"]),
                (time(hour=12, minute=0), time(hour=13, minute=30), "광장시장 점심 식사", places["market"]),
                (time(hour=15, minute=0), time(hour=17, minute=0), "한복 체험 및 북촌 거리 산책", places["experience"]),
            ],
            2: [
                (time(hour=10, minute=0), time(hour=12, minute=0), "세빛섬에서 요트 체험", places["hanriver"]),
            ],
        }

        for day, items in plan.items():
            for order, (start, end, content, place) in enumerate(items, start=1):
                Schedule.objects.update_or_create(
                    trip=trip,
                    day_number=day,
                    order=order,
                    defaults={
                        "start_time": start,
                        "end_time": end,
                        "main_content": content,
                        "meeting_point": place.ai_meeting_point,
                        "transport": "전용 버스",
                        "budget": 100000,
                        "place": place,
                    },
                )

    def _ensure_travelers(self) -> list[Traveler]:
        dataset = [
            {
                "last_name_kr": "이",
                "first_name_kr": "연서",
                "first_name_en": "Yeonseo",
                "last_name_en": "Lee",
                "gender": "F",
                "phone": "010-4000-5000",
                "email": "yeonseo@example.com",
                "birth_date": date(1992, 3, 14),
                "total_amount": 1200000,
                "paid_amount": 1200000,
            },
            {
                "last_name_kr": "최",
                "first_name_kr": "민수",
                "first_name_en": "Minsu",
                "last_name_en": "Choi",
                "gender": "M",
                "phone": "010-5000-6000",
                "email": "minsu@example.com",
                "birth_date": date(1988, 11, 2),
                "total_amount": 1200000,
                "paid_amount": 800000,
            },
        ]

        travelers: list[Traveler] = []
        for payload in dataset:
            traveler, _ = Traveler.objects.update_or_create(
                phone=payload["phone"],
                defaults={
                    "last_name_kr": payload["last_name_kr"],
                    "first_name_kr": payload["first_name_kr"],
                    "first_name_en": payload["first_name_en"],
                    "last_name_en": payload["last_name_en"],
                    "gender": payload["gender"],
                    "email": payload["email"],
                    "birth_date": payload["birth_date"],
                    "address": "서울특별시 중구 세종대로",
                    "country": "대한민국",
                    "total_amount": payload["total_amount"],
                    "paid_amount": payload["paid_amount"],
                    "insurance_subscribed": True,
                    "passport_verified": True,
                    "identity_verified": True,
                    "booking_verified": payload["paid_amount"] >= payload["total_amount"],
                },
            )
            travelers.append(traveler)
        return travelers

    def _ensure_participants(self, trip: Trip, travelers: list[Traveler]) -> None:
        for traveler in travelers:
            TripParticipant.objects.get_or_create(trip=trip, traveler=traveler)
