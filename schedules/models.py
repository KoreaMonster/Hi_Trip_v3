import json
import math
import os
from collections.abc import Mapping
from datetime import datetime, timedelta

from django.conf import settings

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

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
    duration_minutes = models.IntegerField(
        null=True,
        blank=True,
        verbose_name="소요 시간(분)",
        help_text="시작 및 종료 시간 입력 시 자동 계산됨",
        editable=False  # 관리자 페이지에서 직접 수정하지 못하도록 설정
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
        if self.day_number is not None and self.day_number < 1:
            raise ValidationError({
                'day_number': '일차는 1 이상이어야 합니다.'
            })

    def save(self, *args, **kwargs):
        """
        저장 시 자동으로 duration_minutes 계산
        """
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
    # ========== Google Maps 연동 기본 정보 ==========
    google_place_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name='Google Place ID',
        help_text='Places API에서 제공하는 고유 식별자. 추후 API 재호출 시 재사용합니다.'
    )

    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        verbose_name='위도',
        help_text='Geocoding API 또는 Places API 응답에서 받아온 위도 값 (예: 37.579621)'
    )

    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        verbose_name='경도',
        help_text='Geocoding API 또는 Places API 응답에서 받아온 경도 값 (예: 126.977041)'
    )

    google_synced_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Google 데이터 동기화 시각',
        help_text='외부 API와 마지막으로 동기화한 일시를 저장하여 재호출 주기를 관리합니다.'
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
        """백엔드에 저장된 AI 대체 장소 정보를 정규화하여 반환합니다."""

        def _as_non_empty_str(value):
            if isinstance(value, str):
                text = value.strip()
                if text:
                    return text
            return None

        def _as_number(value):
            if isinstance(value, (int, float)) and math.isfinite(value):
                return float(value)
            if isinstance(value, str):
                try:
                    parsed = float(value.strip())
                except (ValueError, AttributeError):
                    return None
                if math.isfinite(parsed):
                    return parsed
            return None

        def _minutes_from_seconds(value):
            seconds = _as_number(value)
            if seconds is None:
                return None
            return max(1, int(round(seconds / 60.0)))

        def _as_minutes(value):
            minutes = _as_number(value)
            if minutes is None:
                return None
            return max(1, int(round(minutes)))

        def _build_reason(candidate):
            provided = _as_non_empty_str(candidate.get('reason'))
            if provided:
                return provided

            parts = []
            delta_text = _as_non_empty_str(candidate.get('delta_text'))
            duration_text = _as_non_empty_str(candidate.get('total_duration_text'))
            if delta_text:
                parts.append(f"기존 경로 대비 {delta_text}")
            if duration_text:
                parts.append(f"총 소요 {duration_text}")
            if parts:
                return " · ".join(parts)
            return None

        def _extract_candidate(value):
            if isinstance(value, list):
                for item in value:
                    normalized = _extract_candidate(item)
                    if normalized:
                        return normalized
                return None

            if not isinstance(value, Mapping):
                return None

            candidate = dict(value)
            place_info = candidate.get('place')
            place_name = (
                _as_non_empty_str(candidate.get('place_name'))
                or (
                    _as_non_empty_str(place_info.get('name'))
                    if isinstance(place_info, Mapping)
                    else None
                )
                or _as_non_empty_str(candidate.get('name'))
            )
            place_id = (
                _as_non_empty_str(candidate.get('place_id'))
                or (
                    _as_non_empty_str(place_info.get('place_id'))
                    if isinstance(place_info, Mapping)
                    else None
                )
            )

            distance_text = (
                _as_non_empty_str(candidate.get('distance_text'))
                or _as_non_empty_str(candidate.get('total_duration_text'))
                or (
                    _as_non_empty_str(place_info.get('distance_text'))
                    if isinstance(place_info, Mapping)
                    else None
                )
            )

            eta_minutes = _as_minutes(candidate.get('eta_minutes'))
            if eta_minutes is None:
                eta_minutes = _as_minutes(candidate.get('travel_minutes'))
            if eta_minutes is None:
                eta_minutes = _minutes_from_seconds(candidate.get('total_duration_seconds'))

            reason = _build_reason(candidate)
            delta_text = _as_non_empty_str(candidate.get('delta_text'))

            result = {}
            if place_name:
                result['place_name'] = place_name
            if place_id:
                result['place_id'] = place_id
            if reason:
                result['reason'] = reason
            if distance_text:
                result['distance_text'] = distance_text
            if eta_minutes is not None:
                result['eta_minutes'] = eta_minutes
            if delta_text:
                result['delta_text'] = delta_text

            total_duration_text = _as_non_empty_str(candidate.get('total_duration_text'))
            if total_duration_text:
                result['total_duration_text'] = total_duration_text

            delta_seconds = candidate.get('delta_seconds')
            if isinstance(delta_seconds, (int, float)) and math.isfinite(delta_seconds):
                result['delta_seconds'] = int(round(float(delta_seconds)))

            total_duration_seconds = candidate.get('total_duration_seconds')
            if isinstance(total_duration_seconds, (int, float)) and math.isfinite(total_duration_seconds):
                result['total_duration_seconds'] = int(round(float(total_duration_seconds)))

            hint_url = _as_non_empty_str(candidate.get('hint_url'))
            if hint_url:
                result['hint_url'] = hint_url

            if result:
                return result

            alternatives = candidate.get('alternatives')
            if isinstance(alternatives, list):
                return _extract_candidate(alternatives)

            for nested in candidate.values():
                normalized = _extract_candidate(nested)
                if normalized:
                    return normalized

            return None

        source = self.ai_alternative_place
        if not source:
            return None

        payload = source
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except json.JSONDecodeError:
                return None

        if isinstance(payload, Mapping):
            normalized = _extract_candidate(payload)
            if normalized:
                return normalized
            # dict지만 필요한 키가 없다면 기존 필드를 그대로 반환합니다.
            fallback = {}
            place_name = _as_non_empty_str(payload.get('place_name'))
            if place_name:
                fallback['place_name'] = place_name
            else:
                fallback['place_name'] = '정보 없음'

            reason = _as_non_empty_str(payload.get('reason'))
            if reason:
                fallback['reason'] = reason
            else:
                fallback['reason'] = '정보 없음'

            hint_url = _as_non_empty_str(payload.get('hint_url'))
            if hint_url:
                fallback['hint_url'] = hint_url
            return fallback

        if isinstance(payload, list):
            return _extract_candidate(payload)

        return None
class GoogleApiCache(models.Model):
    """외부 Google API 응답을 재사용하기 위한 간단한 캐시 테이블"""

    service_name = models.CharField(
        max_length=100,
        verbose_name='사용 API 구분',
        help_text='예: geocoding, places_nearby, place_details, routes'
    )

    request_hash = models.CharField(
        max_length=64,
        verbose_name='요청 식별 해시',
        help_text='요청 파라미터를 직렬화한 뒤 해시한 값. 동일 요청이면 캐시를 재사용합니다.'
    )

    response_data = models.JSONField(
        verbose_name='응답 원본 데이터',
        help_text='Google API에서 받은 응답 전문(JSON)을 그대로 저장해둡니다.'
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='저장 일시',
        help_text='캐시가 생성된 시각'
    )

    expires_at = models.DateTimeField(
        verbose_name='만료 시각',
        help_text='이 시간이 지나면 캐시를 무시하고 실제 API를 다시 호출합니다.'
    )

    class Meta:
        verbose_name = 'Google API 캐시'
        verbose_name_plural = 'Google API 캐시 목록'
        unique_together = [['service_name', 'request_hash']]
        indexes = [
            models.Index(fields=['service_name', 'request_hash']),
            models.Index(fields=['expires_at'])
        ]

    def __str__(self):
        return f"{self.service_name} 캐시({self.request_hash})"

    @property
    def is_expired(self):
        """
        캐시 만료 여부 반환

        Returns:
            bool: True면 만료됨 → 새 API 호출 필요
        """
        if not self.expires_at:
            # 만료 시각이 비어 있으면 즉시 만료로 간주 (안전장치)
            return True
        return timezone.now() >= self.expires_at
# ========== CoordinatorRole 모델 ==========
class CoordinatorRole(models.Model):
    """
    담당자 역할 모델

    역할을 별도 테이블로 관리하여:
    - 오타 방지
    - 일관성 유지
    - 역할별 통계 가능
    - 코드 수정 없이 새 역할 추가 가능

    예: 가이드, 통역사, 코디네이터, 운전기사, 사진작가
    """

    name = models.CharField(
        max_length=50,
        unique=True,  # 중복 방지
        verbose_name='역할명',
        help_text='예: 가이드, 통역사, 코디네이터'
    )

    description = models.TextField(
        null=True,
        blank=True,
        verbose_name='설명',
        help_text='역할에 대한 설명'
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='생성일시'
    )

    class Meta:
        verbose_name = '담당자 역할'
        verbose_name_plural = '담당자 역할 목록'
        ordering = ['name']

    def __str__(self):
        return self.name


class PlaceCoordinator(models.Model):
    """
    장소 담당자 모델

    변경사항:
    1. role: CharField(choices) → ForeignKey(CoordinatorRole)
    2. 이름/연락처 검증 제거

    한 장소에 여러 담당자(가이드, 통역사, 코디네이터 등)를 배치할 수 있습니다.
    """

    # ========== 기본 정보 ==========
    place = models.ForeignKey(
        Place,
        on_delete=models.CASCADE,  # 장소 삭제 시 → 담당자도 삭제
        related_name='coordinators',  # place.coordinators.all()
        verbose_name='장소',
        help_text='담당할 장소 선택'
    )

    role = models.ForeignKey(
        CoordinatorRole,
        on_delete=models.PROTECT,  # 역할이 사용 중이면 삭제 불가 - 나중에 삭제할지 고민
        related_name='coordinators',  # role.coordinators.all()
        verbose_name='역할',
        help_text='담당자의 역할 선택 (가이드, 통역사 등)'
    )

    name = models.CharField(
        max_length=100,
        verbose_name='이름',
        help_text='담당자 이름'
    )

    phone = models.CharField(
        max_length=20,
        verbose_name='연락처',
        help_text='예: 010-1234-5678'
    )

    note = models.TextField(
        null=True,
        blank=True,
        verbose_name='비고',
        help_text='특별 요청사항, 근무 시간, 전문 분야 등\n예: 9시 출근, 영어/중국어 가능, 단체 할인 협의 가능'
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
        verbose_name = '장소 담당자'
        verbose_name_plural = '장소 담당자 목록'

        # 역할 → 이름 순으로 정렬
        ordering = ['role__name', 'name']  # role의 name 필드로 정렬

        # 인덱스 생성 (빠른 조회를 위해)
        indexes = [
            models.Index(fields=['place', 'role']),  # 장소별 역할 조회 최적화
        ]

    def __str__(self):
        """
        객체를 문자열로 표현
        예: "김문화 (가이드) - 경복궁"
        """
        return f"{self.name} ({self.role.name}) - {self.place.name}"

    def clean(self):
        """
        데이터 검증 (간소화)
        """
        # 이름 필수 (공백 제거는 하지 않음)
        if not self.name:
            raise ValidationError({
                'name': '담당자 이름은 필수 입력 항목입니다.'
            })

        # 연락처 필수
        if not self.phone:
            raise ValidationError({
                'phone': '연락처는 필수 입력 항목입니다.'
            })
'''''
    # ========== 편의 메서드 ==========
    @property
    def role_display_with_name(self):
        """
        역할과 이름을 함께 표시
        예: "가이드 김문화"
        """
        return f"{self.role.name} {self.name}"

    @property
    def formatted_phone(self):
        """
        연락처를 보기 좋게 포맷팅
        예: 01012345678 → 010-1234-5678

        Note: 간단한 포맷팅만 수행, 엄격한 검증은 하지 않음
        """
        if not self.phone:
            return ""

        # 하이픈 제거
        phone = self.phone.replace('-', '').replace(' ', '')

        # 11자리 휴대폰 번호 포맷팅
        if len(phone) == 11 and phone.isdigit():
            return f"{phone[:3]}-{phone[3:7]}-{phone[7:]}"

        # 10자리 번호 포맷팅
        elif len(phone) == 10 and phone.isdigit():
            return f"{phone[:3]}-{phone[3:6]}-{phone[6:]}"

        # 그 외는 원본 반환
        return self.phone

    def has_note(self):
        """
        비고가 있는지 확인

        Returns:
            bool: 비고가 있으면 True
        """
        return bool(self.note and self.note.strip())'''''


class PlaceUpdateSource(models.Model):
    """요약 카드 작성 시 참고한 외부/내부 출처 URL 정보를 보관하는 테이블."""

    name = models.CharField(
        max_length=100,
        verbose_name="출처 이름",
        help_text="예: 서울시 문화재청 블로그, 이용자 후기",
    )
    url = models.URLField(
        verbose_name="참고 URL",
        help_text="Perplexity에 전달한 실제 주소. 운영 팀이 직접 관리합니다.",
    )
    note = models.CharField(
        max_length=200,
        blank=True,
        verbose_name="비고",
        help_text="출처 활용 시 주의사항이나 핵심 키워드를 짧게 정리합니다.",
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="등록일시")

    class Meta:
        verbose_name = "장소 업데이트 출처"
        verbose_name_plural = "장소 업데이트 출처 목록"
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name}"


class PlaceSummaryCardQuerySet(models.QuerySet):
    """PlaceSummaryCard 전용 QuerySet 도우미."""

    def with_recent_updates(self):
        """14일 내 최신 업데이트를 Prefetch하여 N+1 쿼리를 방지합니다."""

        return self.prefetch_related(
            models.Prefetch(
                "updates",
                queryset=PlaceUpdate.objects.recent().select_related("summary_card"),
            ),
            "updates__sources",
        )


class PlaceSummaryCard(models.Model):
    """AI가 생성한 장소 요약을 캐시하는 모델."""

    CACHE_TTL_HOURS = 24

    place = models.OneToOneField(
        "Place",
        on_delete=models.CASCADE,
        related_name="summary_card",
        verbose_name="대상 장소",
        help_text="Place가 삭제되면 요약 카드도 함께 제거됩니다.",
    )
    generated_lines = models.JSONField(
        default=list,
        verbose_name="생성된 줄 목록",
        help_text="줄 단위 요약 문장을 배열로 저장합니다. UI는 순서를 그대로 사용합니다.",
    )
    sources = models.JSONField(
        default=list,
        verbose_name="출처 메타데이터",
        help_text="Validator를 통과한 출처 정보를 리스트로 보관합니다.",
    )
    ai_response = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="AI 원본 응답",
        help_text="Perplexity 응답 전문(JSON)을 저장하여 재검증 시 활용합니다.",
    )
    generator = models.CharField(
        max_length=50,
        default="perplexity",
        verbose_name="생성기 식별자",
        help_text="어떤 AI 엔진이 응답을 생성했는지 기록합니다.",
    )
    generated_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="AI 생성 시각",
        help_text="Validator까지 통과한 응답이 저장된 시간입니다.",
    )
    cached_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="캐시 저장 시각",
        help_text="동일 요청에 대해 재사용할 수 있는 기준 시각입니다 (기본 24시간).",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_summary_cards",
        verbose_name="생성 요청자",
        help_text="요약 생성 요청을 수행한 직원 계정. 실패 시에도 마지막 성공 요청자를 유지합니다.",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="생성일시")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="수정일시")

    objects = PlaceSummaryCardQuerySet.as_manager()

    class Meta:
        verbose_name = "장소 요약 카드"
        verbose_name_plural = "장소 요약 카드 목록"

    def __str__(self) -> str:
        return f"{self.place.name} 요약 카드"

    @property
    def is_cache_valid(self) -> bool:
        """캐시 만료 여부를 간단히 확인하는 헬퍼."""

        if not self.cached_at:
            return False
        expiry = self.cached_at + timedelta(hours=self.CACHE_TTL_HOURS)
        return timezone.now() < expiry

    def mark_cached(self) -> None:
        """캐시 시각을 현재로 갱신합니다."""

        self.cached_at = timezone.now()
        self.save(update_fields=["cached_at", "updated_at"])


class PlaceUpdateQuerySet(models.QuerySet):
    """PlaceUpdate용 QuerySet: 14일 내 최신 소식을 필터링하는 기능을 제공합니다."""

    RECENT_DAYS = 14

    def recent(self):
        """RECENT_DAYS 이내에 발행된 업데이트만 반환합니다."""

        threshold = timezone.now() - timedelta(days=self.RECENT_DAYS)
        return self.filter(published_at__gte=threshold)


class PlaceUpdate(models.Model):
    """장소 최신 소식/공지 사항을 관리하는 모델."""

    RECENT_DAYS = PlaceUpdateQuerySet.RECENT_DAYS

    place = models.ForeignKey(
        "Place",
        on_delete=models.CASCADE,
        related_name="place_updates",
        verbose_name="대상 장소",
        help_text="최신 소식이 적용되는 장소",
    )
    summary_card = models.ForeignKey(
        PlaceSummaryCard,
        on_delete=models.CASCADE,
        related_name="updates",
        verbose_name="대상 요약 카드",
        help_text="요약 카드 삭제 시 연관된 업데이트도 함께 제거됩니다.",
    )
    title = models.CharField(
        max_length=100,
        verbose_name="업데이트 제목",
        help_text="예: 봄 시즌 야간 개장, 주차장 공사 안내",
    )
    description = models.TextField(
        verbose_name="상세 설명",
        help_text="줄바꿈 포함 가능. 요약 생성 시 한 줄로 축약됩니다.",
    )
    source_url = models.URLField(
        verbose_name="근거 URL",
        help_text="안내 문구의 공식/비공식 출처 주소",
    )
    published_at = models.DateTimeField(
        verbose_name="발행일시",
        help_text="원본 공지/소식이 게시된 시간. 14일 경과 시 경고가 표시됩니다.",
    )
    is_official = models.BooleanField(
        default=False,
        verbose_name="공식 출처 여부",
        help_text="관공서·공식 홈페이지 등 1차 출처라면 체크합니다.",
    )
    sources = models.ManyToManyField(
        PlaceUpdateSource,
        blank=True,
        related_name="updates",
        verbose_name="추가 참조 출처",
        help_text="줄(라인)과 매핑되는 참고 URL. 중복 입력을 막기 위해 테이블로 분리했습니다.",
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="등록일시")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="수정일시")

    objects = PlaceUpdateQuerySet.as_manager()

    class Meta:
        verbose_name = "장소 최신 소식"
        verbose_name_plural = "장소 최신 소식 목록"
        ordering = ["-published_at"]

    def __str__(self) -> str:
        return f"{self.title} ({self.summary_card.place.name})"

    @property
    def is_recent(self) -> bool:
        """RECENT_DAYS 규칙에 따라 최신 소식인지 여부를 반환합니다."""

        if not self.published_at:
            return False
        threshold = timezone.now() - timedelta(days=self.RECENT_DAYS)
        return self.published_at >= threshold

    def clean(self):
        """URL 유효성 및 발행일시 체크를 통해 운영자 실수를 줄입니다."""

        super().clean()
        if self.published_at and self.published_at > timezone.now() + timedelta(minutes=5):
            raise ValidationError({
                "published_at": "미래 시각으로 저장할 수 없습니다. 실제 발행 시간을 입력하세요.",
            })
        if self.summary_card and self.place and self.summary_card.place_id != self.place_id:
            raise ValidationError(
                {
                    "summary_card": "요약 카드와 장소 정보가 일치하지 않습니다.",
                    "place": "요약 카드와 동일한 장소를 선택해주세요.",
                }
            )

    def save(self, *args, **kwargs):
        """Place 기준으로 SummaryCard를 자동 연결."""

        if self.place_id and not self.summary_card_id:
            summary_card, _ = PlaceSummaryCard.objects.get_or_create(place=self.place)
            self.summary_card = summary_card
        elif self.summary_card_id and not self.place_id:
            self.place = self.summary_card.place
        super().save(*args, **kwargs)


# ========== OptionalExpense 모델 (수정본) ==========
class OptionalExpense(models.Model):
    """
    선택적 지출 항목 모델

    장소에서 관람객이 선택적으로 지불할 수 있는 항목들을 관리합니다.

    예:
    - 경복궁: 한복 대여(15,000원), 오디오 가이드(3,000원)
    - N서울타워: 전망대 입장(16,000원), 케이블카 왕복(14,000원)

    특징:
    - 기본 입장료(entrance_fee)와는 별개
    - 참가자가 현장에서 선택 가능
    - 선택한 항목만 합산하여 예산 계산
    """

    # ========== 기본 정보 ==========
    place = models.ForeignKey(
        Place,
        on_delete=models.CASCADE,  # 장소 삭제 시 → 지출 항목도 삭제
        related_name='optional_expenses',  # place.optional_expenses.all()
        verbose_name='장소',
        help_text='지출 항목이 적용되는 장소'
    )

    item_name = models.CharField(
        max_length=100,
        verbose_name='항목명',
        help_text='예: 한복 대여, 오디오 가이드, 기념품'
    )

    price = models.IntegerField(
        verbose_name='가격 (원)',
        help_text='원화 기준, 예: 15000 (15,000원)'
    )

    description = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        verbose_name='설명',
        help_text='상세 정보, 예: 2시간 기준, 1인당 가격, 사전 예약 필수'
    )

    # ========== 표시 순서 ==========
    display_order = models.IntegerField(
        default=0,
        verbose_name='표시 순서',
        help_text='낮은 숫자가 먼저 표시됨, 같은 가격일 때 순서 조정용'
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
        verbose_name = '선택적 지출 항목'
        verbose_name_plural = '선택적 지출 항목 목록'

        # 정렬: 장소 → 가격 낮은 순 → 표시 순서
        ordering = ['place', 'price', 'display_order']

        # 인덱스 생성 (빠른 조회)
        indexes = [
            models.Index(fields=['place', 'price']),  # 장소별 가격 조회 최적화
        ]

    def __str__(self):
        """
        객체를 문자열로 표현
        예: "한복 대여 (15,000원) - 경복궁"
        """
        return f"{self.item_name} ({self.price:,}원) - {self.place.name}"

    def clean(self):
        """
        데이터 검증
        """
        # 항목명 필수
        if not self.item_name:
            raise ValidationError({
                'item_name': '항목명은 필수 입력 항목입니다.'
            })

        # 가격은 0 이상
        if self.price is not None and self.price < 0:
            raise ValidationError({
                'price': '가격은 0 이상이어야 합니다.'
            })

    # ========== 인스턴스 메서드 ==========
    @property
    def price_display(self):
        """
        가격을 사람이 읽기 쉬운 형식으로 반환
        예: 15000 → "15,000원"
        """
        return f"{self.price:,}원"

    def has_description(self):
        """
        설명이 있는지 확인

        Returns:
            bool: 설명이 있으면 True
        """
        return bool(self.description and self.description.strip())

    # ========== 클래스 메서드 (선택 항목 비용 계산) ==========
    @classmethod
    def calculate_selected_total(cls, expense_ids):
        """
        선택한 항목들의 총 비용 계산

        Args:
            expense_ids (list): 선택한 OptionalExpense의 ID 리스트
                예: [1, 2, 5]

        Returns:
            dict: {
                'total': 총 비용 (int),
                'count': 선택한 항목 수 (int),
                'items': 항목 상세 정보 (list of dict),
                'formatted_total': 포맷된 총 비용 (str)
            }

        사용 예시:
            >>> selected_ids = [1, 2, 5]
            >>> result = OptionalExpense.calculate_selected_total(selected_ids)
            >>> print(result['formatted_total'])
            "18,000원"
        """
        # 입력 검증
        if not expense_ids:
            return {
                'total': 0,
                'count': 0,
                'items': [],
                'formatted_total': '0원'
            }

        # 선택한 항목들 조회
        expenses = cls.objects.filter(id__in=expense_ids)

        # 총 비용 계산
        total = sum(expense.price for expense in expenses)

        # 항목 상세 정보
        items = [
            {
                'id': expense.id,
                'item_name': expense.item_name,
                'price': expense.price,
                'price_display': expense.price_display,
                'place_name': expense.place.name,
                'description': expense.description or ''
            }
            for expense in expenses
        ]

        return {
            'total': total,
            'count': len(items),
            'items': items,
            'formatted_total': f"{total:,}원"
        }

    @classmethod
    def get_by_place(cls, place_id):
        """
        특정 장소의 모든 선택적 지출 항목 조회

        Args:
            place_id (int): Place 모델의 ID

        Returns:
            QuerySet: 해당 장소의 OptionalExpense 목록

        사용 예시:
            expenses = OptionalExpense.get_by_place(place_id=5)
            for expense in expenses:
            print(expense.item_name, expense.price_display)
        """
        return cls.objects.filter(place_id=place_id)

    @classmethod
    def get_cheapest_items(cls, place_id, limit=3):
        """
        특정 장소의 저렴한 항목 상위 N개 조회

        Args:
            place_id (int): Place 모델의 ID
            limit (int): 조회할 항목 수 (기본값: 3)

        Returns:
            QuerySet: 가격이 낮은 순으로 정렬된 항목들

        사용 예시:
            >>> cheap_items = OptionalExpense.get_cheapest_items(place_id=5, limit=3)
        """
        return cls.objects.filter(place_id=place_id).order_by('price')[:limit]