
"""CSV 파일을 이용해 PlaceUpdate를 일괄 등록하는 관리 명령."""

from __future__ import annotations

import csv
from datetime import datetime

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from schedules.models import Place, PlaceSummaryCard, PlaceUpdate

DATE_FORMATS = [
    "%Y-%m-%d %H:%M",
    "%Y-%m-%d",
]


class Command(BaseCommand):
    """운영팀이 수집한 최신 소식을 손쉽게 DB에 적재하도록 돕습니다."""

    help = (
        "CSV 파일을 읽어 PlaceUpdate를 생성합니다.\n"
        "필수 컬럼: place_id,title,description,source_url,published_at,is_official\n"
        "- place_id: 요약 카드를 생성할 Place의 PK\n"
        "- published_at: 'YYYY-MM-DD' 또는 'YYYY-MM-DD HH:MM' 형식 지원\n"
        "- is_official: true/false"
    )

    def add_arguments(self, parser):
        parser.add_argument("csv_path", help="불러올 CSV 파일 경로")
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="DB에 쓰지 않고 처리 결과만 출력",
        )

    def handle(self, *args, **options):
        csv_path: str = options["csv_path"]
        dry_run: bool = options["dry_run"]

        try:
            with open(csv_path, newline="", encoding="utf-8") as fp:
                reader = csv.DictReader(fp)
                rows = list(reader)
        except FileNotFoundError as exc:
            raise CommandError(f"파일을 찾을 수 없습니다: {csv_path}") from exc

        if not rows:
            self.stdout.write(self.style.WARNING("처리할 행이 없습니다."))
            return

        created = 0
        for row in rows:
            place_id = row.get("place_id")
            if not place_id:
                self.stderr.write(self.style.WARNING("place_id가 비어 있어 건너뜀"))
                continue

            try:
                place = Place.objects.get(pk=int(place_id))
            except (Place.DoesNotExist, ValueError):
                self.stderr.write(
                    self.style.WARNING(f"유효하지 않은 place_id: {place_id} → 행을 건너뜁니다.")
                )
                continue

            summary_card, _ = PlaceSummaryCard.objects.get_or_create(place=place)
            published_at = self._parse_datetime(row.get("published_at"))
            if published_at is None:
                self.stderr.write(
                    self.style.WARNING(
                        f"published_at 형식을 해석할 수 없어 건너뜀 (place_id={place_id})"
                    )
                )
                continue

            is_official = str(row.get("is_official", "false")).lower() in {"1", "true", "yes"}

            if dry_run:
                self.stdout.write(
                    f"[DRY RUN] {place.name} → {row.get('title')} ({published_at.isoformat()})"
                )
                created += 1
                continue

            PlaceUpdate.objects.create(
                summary_card=summary_card,
                title=row.get("title", "제목 없음"),
                description=row.get("description", ""),
                source_url=row.get("source_url", ""),
                published_at=published_at,
                is_official=is_official,
            )
            created += 1

        self.stdout.write(self.style.SUCCESS(f"총 {created}건 처리 완료"))

    def _parse_datetime(self, value: str | None):
        if not value:
            return None
        for fmt in DATE_FORMATS:
            try:
                dt = datetime.strptime(value.strip(), fmt)
                return timezone.make_aware(dt) if timezone.is_naive(dt) else dt
            except ValueError:
                continue
        return None