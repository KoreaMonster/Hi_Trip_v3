from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    여행사 직원 전용 모델

    # AbstractUser에 포함된 기본 필드를 영문 이름으로 사용합니다.
    # first_name (영문 이름), last_name (영문 성)
    """
    first_name_kr = models.CharField(max_length=10, blank=True, verbose_name='한글 이름')
    last_name_kr = models.CharField(max_length=10, blank=True, verbose_name='한글 성')

    phone = models.CharField(max_length=20, blank=True, verbose_name='연락처')

    class Meta:
        verbose_name = '직원'
        verbose_name_plural = '직원 목록'

    def __str__(self):
        return self.username


class Traveler(models.Model):
    """여행 참가 고객 정보 (로그인 불필요)"""
    GENDER_CHOICES = [
        ('M', '남'),
        ('F', '여'),
    ]

    # 기본 정보
    last_name_kr = models.CharField(max_length=20, verbose_name='한글 성')  # 2. '성' 필드 추가
    first_name_kr = models.CharField(max_length=30, verbose_name='한글 이름')
    first_name_en = models.CharField(max_length=50, blank=True, verbose_name='영문 First Name')
    last_name_en = models.CharField(max_length=50, blank=True, verbose_name='영문 Last Name')
    birth_date = models.DateField(verbose_name='생년월일')
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, verbose_name='성별')

    # 연락 정보
    phone = models.CharField(max_length=20, verbose_name='연락처')
    email = models.EmailField(blank=True, verbose_name='이메일')
    address = models.TextField(blank=True, verbose_name='주소')
    country = models.CharField(max_length=50, default='대한민국', verbose_name='국가')

    # 여행 관련
    is_companion = models.BooleanField(default=False, verbose_name='동행 여부')
    companion_names = models.CharField(max_length=200, blank=True, verbose_name='동행인', help_text='예: 홍길동, 김원주')
    proxy_booking = models.BooleanField(default=False, verbose_name='대리 예약 여부')

    # 여권 정보
    passport_number = models.CharField(max_length=20, blank=True, verbose_name='여권 번호')
    passport_expiry = models.DateField(null=True, blank=True, verbose_name='여권 만료일')

    # 검증 상태
    passport_verified = models.BooleanField(default=False, verbose_name='여권정보 검증')
    identity_verified = models.BooleanField(default=False, verbose_name='신분확인 검증')
    booking_verified = models.BooleanField(default=False, verbose_name='예약 확인')

    # 결제 정보 (원화 기준: 최대 9,999,999,999원)
    total_amount = models.IntegerField(default=0, verbose_name='총 금액(원)')
    paid_amount = models.IntegerField(default=0, verbose_name='결제 금액(원)')

    # 보험
    insurance_subscribed = models.BooleanField(default=False, verbose_name='여행자 보험 가입')

    # 메타 정보
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    #
    # #어떤 여행에 포함되었는지 (Day 4: Trip 모델 먼저 생성 후 들어가야할 속성)
    # trip = models.ForeignKey('trips.Trip', on_delete=models.CASCADE, related_name='travelers')



    class Meta:
        verbose_name = '여행자'
        verbose_name_plural = '여행자 목록'
        ordering = ['last_name_kr', 'first_name_kr'] # 3. 정렬 기준 변경

    def __str__(self):
        return f"{self.full_name_kr} ({self.phone})"

    @property
    def full_name_kr(self): # 5. 한글 전체 이름을 위한 프로퍼티 추가
        """한글 전체 이름"""
        return f"{self.last_name_kr}{self.first_name_kr}"

    @property
    def full_name_en(self):
        """영문 전체 이름"""
        return f"{self.first_name_en} {self.last_name_en}".strip()

    @property
    def payment_status(self):
        """결제 완료 여부"""
        return self.paid_amount >= self.total_amount