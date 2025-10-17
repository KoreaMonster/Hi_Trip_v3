"""관리 커맨드: 시연용 더미 건강/위치 데이터를 생성한다."""

from django.core.management.base import BaseCommand, CommandError

from trips.models import Trip

from monitoring.services import generate_demo_snapshots_for_trip


class Command(BaseCommand):
    """`python manage.py generate_demo_telemetry` 형태로 실행한다."""

    help = (
        "여행 참가자들의 건강/위치 스냅샷을 랜덤으로 생성합니다. "
        "데모 직전에 5~10분 치 데이터를 빠르게 준비하는 용도로 사용하세요."
    )

    def add_arguments(self, parser):
        """커맨드 실행 시 사용할 옵션 정의."""

        parser.add_argument(
            "trip_id",
            type=int,
            help="데이터를 생성할 Trip ID",
        )
        parser.add_argument(
            "--minutes",
            type=int,
            default=10,
            help="몇 분 분량의 데이터를 만들지 지정 (기본 10분).",
        )
        parser.add_argument(
            "--interval",
            type=int,
            default=60,
            help="측정 간격(초). 기본값 60초.",
        )

    def handle(self, *args, **options):
        """커맨드가 호출되면 실행되는 메인 로직."""

        trip_id = options["trip_id"]
        minutes = options["minutes"]
        interval = options["interval"]

        if minutes <= 0:
            raise CommandError("minutes 값은 1 이상이어야 합니다.")
        if interval <= 0:
            raise CommandError("interval 값은 1 이상이어야 합니다.")

        try:
            trip = Trip.objects.get(pk=trip_id)
        except Trip.DoesNotExist as exc:
            raise CommandError(f"Trip(id={trip_id})을 찾을 수 없습니다.") from exc

        created = generate_demo_snapshots_for_trip(
            trip=trip,
            minutes=minutes,
            interval_seconds=interval,
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Trip {trip_id} 참가자를 대상으로 {created}개의 스냅샷을 생성했습니다."
            )
        )

        # 향후 개선: 옵션으로 특정 참가자만 선택하거나 경고 발생 비율을 조정할 수 있습니다.
