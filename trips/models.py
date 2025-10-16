from django.db import models
from users.models import User, Traveler
import string
import random


class Trip(models.Model):
    """
    여행 정보 모델
    여행 상품의 대표 정보를 담는, 이른바 '여행 폴더'

    """

    # 여행 상태 선택지
    STATUS_CHOICES = [
        ('planning', '계획 중'),
        ('ongoing', '진행 중'),
        ('completed', '완료'),
    ]

    # 기본 정보
    title = models.CharField(max_length=200, verbose_name='여행명')
    destination = models.CharField(max_length=200, verbose_name='목적지')
    start_date = models.DateField(verbose_name='시작일')
    end_date = models.DateField(verbose_name='종료일')

    # 상태 및 관리
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='planning',
        verbose_name='상태'
    )

    # 초대 코드 (8자리 고유 코드)
    invite_code = models.CharField(
        max_length=8,
        unique=True,
        blank=True,
        verbose_name='초대 코드',
        help_text='자동 생성되는 8자리 코드'
    )

    # 담당자 (User 모델과 연결)
    manager = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='managed_trips',
        verbose_name='담당자',
        help_text='총괄담당자가 배정'
    )

    # 메타 정보
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성일시')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='수정일시')

    class Meta:
        verbose_name = '여행'
        verbose_name_plural = '여행 목록'
        ordering = ['-created_at']  # 최신순 정렬

    def __str__(self):
        return f"{self.title} ({self.start_date})"

    def save(self, *args, **kwargs):
        """
        저장 시 초대코드 자동 생성

        초보 개발자를 위한 설명:
        - ViewSet에서 Trip을 생성할 때는 별도로 초대코드를 만들지 않습니다.
        - 따라서 모델 수준에서 한 번만 생성하면, CBV이든 FVB이든 항상 동일하게 동작합니다.
        """
        if not self.invite_code:
            self.invite_code = self._generate_invite_code()

        super().save(*args, **kwargs)

    def _generate_invite_code(self):
        """
        8자리 랜덤 초대코드 생성 (중복 방지)
        """
        # 사용 가능한 문자: 대문자 + 숫자
        characters = string.ascii_uppercase + string.digits

        while True:
            # 8자리 랜덤 코드 생성
            code = ''.join(random.choice(characters) for _ in range(8))

            # 중복 확인 (DB에 같은 코드가 없으면 반환)
            if not Trip.objects.filter(invite_code=code).exists():
                return code

    @property
    def participant_count(self):
        """
        참가자 수 반환 (property)
        나중에 TripParticipant 모델 생성 후 구현
        """
        cache = getattr(self, "_prefetched_objects_cache", {})
        participants = cache.get("participants")
        if participants is not None:
            return len(participants)
        return self.participants.count()

    def assign_manager(self, manager):
        """여행 담당자를 갱신하고 저장한다.

        ViewSet의 `assign_manager` 액션에서 호출할 예정이며, 비즈니스 규칙을
        모델 메서드로 모아 두면 관리자 페이지에서도 동일한 로직을 재사용할 수 있다.
        """
        self.manager = manager
        self.save(update_fields=["manager", "updated_at"])




class TripParticipant(models.Model):
    """
    여행-참가자 관계 모델 (중간 테이블)
    여행과 **고객(Traveler)**을 연결하는 '참가자 명단
    """

    trip = models.ForeignKey(
        Trip,
        on_delete= models.CASCADE,
        #(연쇄 삭제) 여행이 삭제되면 → 참가자 기록도 모두 삭제
        related_name= 'participants',
        verbose_name= '여행'
    )

    traveler = models.ForeignKey(
        Traveler,
        on_delete= models.CASCADE,
        related_name= 'trips',
        verbose_name= '참가자'
    )

    joined_date = models.DateTimeField(
        auto_now_add= True,
        verbose_name= '참가일시'
    )

    class Meta:
        verbose_name = '여행 참가자'
        verbose_name_plural = '여행 참가자 목록'
        ordering = ['joined_date']

        #같은 사람이 같은 여행에 두 번 참가 불가
        unique_together = [['trip', 'traveler']]

    def __str__(self):
        return f"{self.traveler.full_name_kr} - {self.trip.title}"