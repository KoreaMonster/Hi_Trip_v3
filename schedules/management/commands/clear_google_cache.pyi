"""GoogleApiCache 테이블을 정리하는 관리 명령."""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.utils import timezone

from schedules.models import GoogleApiCache


class Command(BaseCommand):
    """Google API 캐시 데이터를 정리하거나 전부 삭제합니다."""

    help = (
        "GoogleApiCache 테이블에서 만료된 데이터만 제거하거나 전체를 비웁니다.\n"
        "운영 환경에서 캐시 용량이 쌓였을 때 빠르게 정리할 수 있도록 단순한 명령으로 제공합니다."
    )

    def add_arguments(self, parser):
        """명령 실행 옵션을 정의합니다."""

        parser.add_argument(
            "--expired-only",
            action="store_true",
            help="만료된 데이터만 삭제합니다. 지정하지 않으면 모든 캐시를 삭제합니다.",
        )

    def handle(self, *args, **options):
        """데이터 삭제 로직."""

        expired_only: bool = options["expired_only"]

        if expired_only:
            queryset = GoogleApiCache.objects.filter(expires_at__lt=timezone.now())
        else:
            queryset = GoogleApiCache.objects.all()

        count = queryset.count()
        if count == 0:
            self.stdout.write(self.style.NOTICE("삭제할 캐시 데이터가 없습니다."))
            return

        queryset.delete()
        scope = "만료된" if expired_only else "전체"
        self.stdout.write(self.style.SUCCESS(f"{scope} 캐시 {count}건을 삭제했습니다."))