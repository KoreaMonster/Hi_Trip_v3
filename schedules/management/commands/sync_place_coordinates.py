"""Google Places 상세 정보를 이용해 Place 좌표를 갱신하는 관리 명령."""

from __future__ import annotations

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from schedules.models import Place
from schedules.services import GoogleMapsError, fetch_place_details


class Command(BaseCommand):
    """Place 모델의 좌표/동기화 시간을 일괄 갱신합니다."""

    help = (
        "Google Place ID가 저장된 Place 레코드에 대해 좌표와 동기화 시각을 새로 가져옵니다.\n"
        "- 기본적으로 24시간 이상 지난 데이터만 갱신해 Google API 호출 수를 절약합니다.\n"
        "- --force 플래그를 사용하면 모든 Place를 강제로 갱신합니다."
    )

    def add_arguments(self, parser):
        """명령 실행 시 사용할 선택 인자를 정의합니다."""

        parser.add_argument(
            "--max-age-hours",
            type=int,
            default=24,
            help="이 시간보다 오래된 데이터만 갱신합니다. 기본값은 24시간입니다.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="테스트 용도로 처리할 최대 레코드 수를 제한하고 싶을 때 사용합니다.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="조건과 무관하게 모든 Place를 갱신합니다.",
        )

    def handle(self, *args, **options):
        """커맨드의 메인 로직."""

        max_age_hours: int = options["max_age_hours"]
        limit: int | None = options["limit"]
        force_refresh: bool = options["force"]

        if max_age_hours <= 0:
            self.stdout.write(self.style.WARNING("max-age-hours가 0 이하로 설정되어 1시간으로 강제 조정합니다."))
            max_age_hours = 1

        queryset = Place.objects.exclude(google_place_id__isnull=True).exclude(google_place_id="")

        if not force_refresh:
            threshold = timezone.now() - timedelta(hours=max_age_hours)
            queryset = queryset.filter(Q(google_synced_at__isnull=True) | Q(google_synced_at__lt=threshold))

        if limit:
            queryset = queryset[:limit]

        total = queryset.count()
        if total == 0:
            self.stdout.write(self.style.NOTICE("갱신 대상 Place가 없습니다."))
            return

        updated = 0
        skipped = 0

        for place in queryset:
            google_place_id = place.google_place_id
            if not google_place_id:
                skipped += 1
                continue

            try:
                details = fetch_place_details(google_place_id)
            except GoogleMapsError as exc:
                skipped += 1
                self.stderr.write(
                    self.style.WARNING(
                        f"{place.name or '이름 없는 장소'}(ID={place.id}) 상세 조회 실패: {exc}"
                    )
                )
                continue

            place.latitude = details.latitude
            place.longitude = details.longitude
            place.google_synced_at = timezone.now()
            place.save(update_fields=["latitude", "longitude", "google_synced_at"])
            updated += 1

            self.stdout.write(
                self.style.SUCCESS(
                    f"갱신 완료: {place.name or '이름 없는 장소'} (Place ID={google_place_id})"
                )
            )

        self.stdout.write(
            self.style.MIGRATE_HEADING(
                f"완료: 총 {total}건 중 {updated}건 갱신, {skipped}건 건너뜀"
            )
        )