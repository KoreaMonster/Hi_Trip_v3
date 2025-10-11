from django.db import models
from django.core.exceptions import ValidationError
from datetime import datetime
import os

class Schedule(models.Model):
    """
    여행 일정 모델
    하나의 여행(Trip) -> 여러개의 일정 (Schedule)

    """
    #기본적인 정보
    trip = models.ForeignKey(
        'trips.Trip',  # trips 앱의 Trip 모델과 연결
        on_delete=models.CASCADE,  # 여행 삭제 시 → 일정도 모두 삭제
        related_name='schedules',  # 역참조: trip.schedules.all()
        verbose_name='여행'
    )

    day_number = models.IntegerField(
        verbose_name='일차',
        help_text='1일차, 2일차...'
    )
    place = models.ForeignKey(
        'Place',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='schedules',
        verbose_name='방문 장소'
    )

    #시간 관련 정보
    start_time = models.TimeField(
        verbose_name="시작 시간",
        help_text="예: 09:00"
    )

    end_time = models.TimeField(
        verbose_name="종료 시간",
        help_text="예: 12:00"
    )

    #일정관련 내용
    transport = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name="이동 수단",
        help_text= "예: 단체버스, 기차, 도보"
    )

    main_content = models.TextField(
        null=True,
        blank=True,
        verbose_name="주요 활동 내용",
        help_text="예: 숭례문 문화 해설 투어"
    )

    meeting_point = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        verbose_name="집결지",
        help_text="예: 숭례문 주차장"
    )

    budget = models.IntegerField(
        null=True,
        blank=True,
        verbose_name="예상 비용(원화)",
        help_text="예: 100000",
        default=0  # 기본값을 0으로 설정하는 것을 권장합니다.
    )
    """ 달러인지 원화인지
    budget = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='예상 비용(USD)',
        help_text='예: 25.50'
    )
    """
    order = models.IntegerField(
        default=0,
        verbose_name='순서',
        help_text='같은 날 내 순서 (1, 2, 3...)'
    )

    # ========== 메타 정보 ==========
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='생성일시'
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='수정일시'
    )
    class Meta:
        verbose_name = '일정'
        verbose_name_plural = '일정 목록'

        #자동 정렬 : 날짜 -> 순서 -> 시작 시간 (사실상 순서까지만 해도 됨)
        ordering = ['day_number', 'order', 'start_time']
        #중복 방지: 같은 여행의 같은날, 같은 순서는 될 수 없음
        unique_together = [['trip', 'day_number', 'order']]


    def __str__(self):
        """
        관리자 페이지나 쉘에서 객체를 출력할 때 보이는 문자열
        예: "제주도 여행 - 1일차 (09:00-12:00)"
        """
        return f"{self.trip.title} - {self.day_number}일차 ({self.start_time}-{self.end_time})"

    def clean(self):
        """
        데이터 저장 전 검증 로직
        save() 호출 전에 자동 실행됨
        """
        # 종료 시간이 시작 시간보다 빠르면 에러
        if self.start_time and self.end_time:
            if self.end_time <= self.start_time:
                raise ValidationError({
                    'end_time': '종료 시간은 시작 시간보다 늦어야 합니다.'
                })

        # day_number가 양수인지 검증
        if self.day_number and self.day_number < 1:
            raise ValidationError({
                'day_number': '일차는 1 이상이어야 합니다.'
            })

    def save(self, *args, **kwargs):
        """
        저장 시 자동으로 duration_minutes 계산
        """
        # clean() 메서드 실행 (데이터 검증)
        self.full_clean()

        # 소요 시간 자동 계산 (향후 자동 시간 재계산에 활용)
        if self.start_time and self.end_time:
            from datetime import datetime, timedelta

            # TimeField를 datetime으로 변환해서 계산
            start = datetime.combine(datetime.today(), self.start_time)
            end = datetime.combine(datetime.today(), self.end_time)

            # 분 단위로 차이 계산
            self.duration_minutes = int((end - start).total_seconds() / 60)

        # 실제 DB 저장
        super().save(*args, **kwargs)


class PlaceCategory(models.Model):
    """
    장소 카테고리 모델

    카테고리를 별도 테이블로 관리하여:
    - 오타 방지
    - 일관성 유지
    - 카테고리별 통계 가능

    예: 문화재, 음식점, 자연, 쇼핑, 체험
    """
    name = models.CharField(
        max_length=50,
        unique=True,  # 중복 방지
        verbose_name='카테고리명',
        help_text='예: 문화재, 음식점, 자연'
    )

    description = models.TextField(
        null=True,
        blank=True,
        verbose_name='설명',
        help_text='카테고리에 대한 설명'
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='생성일시'
    )

    class Meta:
        verbose_name = '장소 카테고리'
        verbose_name_plural = '장소 카테고리 목록'
        ordering = ['name']

    def __str__(self):
        return self.name


# ========== 이미지 경로 함수 ==========
def place_image_path(instance, filename):
    """
    장소 이미지 동적 저장 경로

    저장 형식: places/장소명/날짜_원본파일명.확장자
    예: places/경복궁/20251011_photo.jpg

    Args:
        instance: Place 모델 인스턴스
        filename: 업로드된 파일명

    Returns:
        str: 저장될 경로
    """
    #파일 확장자 추출
    ext = filename.split('.')[-1]

    #원본 파일명
    original_name = os.path.splitext(filename)[0]

    #날찌 문자열
    date_str = datetime.now().strftime('%Y%m%d')

    #장소명 폴더 생성 (공백 -> 언더바)
    place_folder = instance.name.replace(' ', '_')

    return f"places/{place_folder}/{datetime}_{original_name}.{ext}"

# ========== 카테고리별 이미지 경로 (주석 처리) ==========
# def place_image_path_by_category(instance, filename):
#     """
#     카테고리/장소명 폴더 구조로 저장
#
#     저장 형식: places/카테고리/장소명/날짜_파일명.확장자
#     예: places/문화재/경복궁/20251011_photo.jpg
#
#     사용법: image = models.ImageField(upload_to=place_image_path_by_category)
#     """
#     ext = filename.split('.')[-1]
#     original_name = os.path.splitext(filename)[0]
#     date_str = datetime.now().strftime('%Y%m%d')
#
#     # 카테고리가 없으면 'uncategorized' 폴더에 저장
#     category_folder = instance.category.name if instance.category else 'uncategorized'
#     place_folder = instance.name.replace(' ', '_')
#
#     return f'places/{category_folder}/{place_folder}/{date_str}_{original_name}.{ext}'


#Place 모델
class Place(models.Model):
    """
        여행 장소 정보 모델
        하나의 장소는 여러 일정(Schedule)에서 재사용될 수 있습니다.

        예: "경복궁"이라는 장소를 1일차와 3일차에 모두 방문 가능
    """
    name = models.CharField(
        max_length=200,
        verbose_name="장소명",
        help_text="예: 경복궁"
    )

    address = models.CharField(
        max_length = 300,
        null=True,
        blank=True,
        verbose_name="주소",
        help_text='예: 서울특별시 종로구 사직로'
    )

    category = models.ForeignKey(
        PlaceCategory,
        on_delete=models.SET_NULL,  # 카테고리 삭제 시 장소는 유지
        null=True,
        blank=True,
        related_name='places',  # category.places.all()
        verbose_name='카테고리',
        help_text='장소 카테고리 선택'
    )

    # ========== 운영 정보 ==========
    entrance_fee = models.IntegerField(
        null=True,
        blank=True,
        default=0,
        verbose_name='입장료 (원)',
        help_text='무료인 경우 0 또는 빈칸, 예: 3000 (3,000원)'
    )

    activity_time = models.DurationField(
        null=True,
        blank=True,
        verbose_name='권장 활동 시간',
        help_text='예: 2시간 30분 → 2:30:00 형식 입력'
    )

    # ========== AI 추천 정보 ==========
    ai_alternative_place = models.JSONField(
        null=True,
        blank=True,
        default=dict,  # 기본값: 빈 딕셔너리
        verbose_name='AI 추천 대체 장소',
        help_text='JSON 형식: {"place_name": "장소명", "reason": "추천 이유"}'
    )

    ai_generated_info = models.TextField(
        null=True,
        blank=True,
        verbose_name='AI 자동생성 관련 정보',
        help_text='AI가 생성한 유용한 정보\n예: 봄철 벚꽃 명소, 주말 혼잡도 높음'
    )

    ai_meeting_point = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        verbose_name='AI 집결지 추천',
        help_text='AI가 추천하는 장소\n예: 광화문 광장 세종대왕 동상 앞'
    )

    # ========== 이미지 ==========
    image = models.ImageField(
        upload_to=place_image_path,  # 동적 경로 함수 사용
        null=True,
        blank=True,
        verbose_name='장소 이미지',
        help_text='JPG, PNG 파일 업로드 가능'
    )

    # ========== 메타 정보 ==========
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='생성일시'
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='수정일시'
    )

    class Meta:
        verbose_name = '장소'
        verbose_name_plural = '장소 목록'
        ordering = ['name']

    def __str__(self):
        if self.category:
            return f"{self.name} ({self.category.name})"
        return self.name

    def clean(self):
        """
        데이터 검증
        """
        # 장소명 필수
        if not self.name or not self.name.strip():
            raise ValidationError({
                'name': '장소명은 필수 입력 항목입니다.'
            })

        # 장소명 앞뒤 공백 제거
        if self.name:
            self.name = self.name.strip()

        # 입장료 음수 불가
        if self.entrance_fee and self.entrance_fee < 0:
            raise ValidationError({
                'entrance_fee': '입장료는 0 이상이어야 합니다.'
            })

    # ========== 편의를 위한 메서드 ==========
    @property
    def has_image(self):
        """이미지 존재 여부"""
        return bool(self.image)

    def get_image_url(self):
        """이미지 URL 반환"""
        if self.image:
            return self.image.url
        return '/static/images/default_place.jpg'

    @property
    def entrance_fee_display(self):
        """
        입장료를 사람이 읽기 쉬운 형식으로 반환
        예: 3000 → "3,000원"
        """
        if self.entrance_fee is None or self.entrance_fee == 0:
            return "무료"
        return f"{self.entrance_fee:,}원"

    @property
    def activity_time_display(self):
        """
        활동 시간을 사람이 읽기 쉬운 형식으로 반환
        예: timedelta(hours=2, minutes=30) → "2시간 30분"
        """
        if not self.activity_time:
            return "정보 없음"

        total_seconds = int(self.activity_time.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60

        if hours > 0 and minutes > 0:
            return f"{hours}시간 {minutes}분"
        elif hours > 0:
            return f"{hours}시간"
        elif minutes > 0:
            return f"{minutes}분"
        return "정보 없음"

    def get_alternative_place_info(self):
        """
        대체 장소 정보 반환

        Returns:
            dict: {"place_name": "...", "reason": "..."}
            None: 정보가 없는 경우
        """
        if not self.ai_alternative_place:
            return None

        # JSON 데이터가 dict 형태가 아니면 None 반환
        if not isinstance(self.ai_alternative_place, dict):
            return None

        return {
            'place_name': self.ai_alternative_place.get('place_name', '정보 없음'),
            'reason': self.ai_alternative_place.get('reason', '정보 없음')
        }