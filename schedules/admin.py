from django.contrib import admin
from .models import Schedule, PlaceCategory, Place, CoordinatorRole, PlaceCoordinator, OptionalExpense

# ========================================
# 인라인(Inline) 정의: 다른 모델 수정 페이지에 포함될 섹션
# ========================================

class PlaceCoordinatorInline(admin.TabularInline):
    """Place 수정 페이지에서 담당자를 바로 추가/수정할 수 있도록 함"""
    model = PlaceCoordinator
    extra = 1  # 기본적으로 추가할 수 있는 빈 폼의 수
    fields = ('role', 'name', 'phone', 'note')
    verbose_name = "장소 담당자"
    verbose_name_plural = "장소 담당자 목록"


class OptionalExpenseInline(admin.TabularInline):
    """Place 수정 페이지에서 선택 비용 항목을 바로 추가/수정할 수 있도록 함"""
    model = OptionalExpense
    extra = 1
    fields = ('item_name', 'price', 'description', 'display_order')
    verbose_name = "선택적 지출 항목"
    verbose_name_plural = "선택적 지출 항목 목록"


# ========================================
# 각 모델의 관리자 페이지 설정
# ========================================

@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    """일정 관리자 페이지"""
    list_display = ('trip', 'day_number', 'order', 'place', 'start_time', 'end_time')
    list_filter = ('trip', 'day_number', 'place')
    search_fields = ('trip__title', 'place__name', 'main_content')
    list_editable = ('order', 'place', 'start_time', 'end_time') # 목록에서 바로 수정 가능
    ordering = ('trip', 'day_number', 'order', 'start_time')


@admin.register(PlaceCategory)
class PlaceCategoryAdmin(admin.ModelAdmin):
    """장소 카테고리 관리자 페이지"""
    list_display = ('name', 'description')
    search_fields = ('name',)


@admin.register(Place)
class PlaceAdmin(admin.ModelAdmin):
    """장소 관리자 페이지"""

    # Google 연동 필드를 포함한 주요 정보를 목록에서 바로 확인할 수 있도록 열 구성을 확장합니다.
    list_display = (
        'name',
        'category',
        'address',
        'google_place_id',
        'latitude',
        'longitude',
        'google_synced_at',
        'entrance_fee_display',
        'activity_time_display',
    )
    list_filter = ('category',)
    search_fields = ('name', 'address', 'google_place_id')
    readonly_fields = ('google_synced_at',)
    inlines = [PlaceCoordinatorInline, OptionalExpenseInline]  # 담당자 및 비용 항목 인라인 추가

    fieldsets = (
        ("기본 정보", {'fields': ('name', 'category', 'address', 'image')}),
        ("Google 연동 정보", {
            'fields': ('google_place_id', 'latitude', 'longitude', 'google_synced_at'),
            'description': '외부 API로 자동 채워지는 식별자/좌표입니다. 수동 수정 없이 참고용으로 사용하세요.',
        }),
        ("운영 정보", {'fields': ('entrance_fee', 'activity_time')}),
        ("AI 추천 정보", {
            'fields': ('ai_alternative_place', 'ai_generated_info', 'ai_meeting_point'),
            'classes': ('collapse',),
        }),
    )



@admin.register(OptionalExpense)
class OptionalExpenseAdmin(admin.ModelAdmin):
    """(직접 관리용) 선택적 지출 항목 관리자 페이지"""
    list_display = ('place', 'item_name', 'price_display', 'display_order')
    list_filter = ('place',)
    search_fields = ('item_name', 'place__name')