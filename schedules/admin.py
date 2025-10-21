from django.contrib import admin
from django.utils.html import format_html

from .models import (
    CoordinatorRole,
    OptionalExpense,
    Place,
    PlaceCategory,
    PlaceCoordinator,
    PlaceSummaryCard,
    PlaceUpdate,
    PlaceUpdateSource,
    Schedule,
)
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

class PlaceUpdateInline(admin.TabularInline):
    """Place 상세 화면에서 최신 소식을 바로 관리할 수 있도록 구성."""

    model = PlaceUpdate
    fk_name = "place"
    extra = 0
    fields = (
        "title",
        "description",
        "source_url",
        "published_at",
        "is_official",
        "sources",
        "recent_warning",
    )
    readonly_fields = ("recent_warning",)
    filter_horizontal = ("sources",)
    verbose_name = "최신 소식"
    verbose_name_plural = "최신 소식 목록"

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        current_place = getattr(request, "_current_place_obj", None)
        if current_place is None:
            return qs.none()
        return qs.filter(place=current_place)

    def recent_warning(self, obj):
        if not obj.pk:
            return "저장 후 자동 계산"
        if obj.is_recent:
            return format_html('<span style="color:#3c763d;">최근 등록</span>')
        return format_html('<span style="color:#a94442;font-weight:bold;">14일 경과</span>')

    recent_warning.short_description = "신선도"


class PlaceSummaryCardInline(admin.StackedInline):
    """Place 요약 카드 메타 정보를 읽기 전용으로 보여줍니다."""

    model = PlaceSummaryCard
    can_delete = False
    extra = 0
    readonly_fields = (
        "generator",
        "generated_at",
        "cached_at",
        "created_by",
        "created_at",
        "updated_at",
    )
    fields = (
        "generator",
        "generated_at",
        "cached_at",
        "created_by",
        "created_at",
        "updated_at",
    )
    verbose_name = "요약 카드 캐시"
    verbose_name_plural = "요약 카드 캐시"

    def has_add_permission(self, request, obj=None):
        return False
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
    inlines = [
        PlaceSummaryCardInline,
        PlaceUpdateInline,
        PlaceCoordinatorInline,
        OptionalExpenseInline,
    ]
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

    def get_form(self, request, obj=None, **kwargs):
        request._current_place_obj = obj
        return super().get_form(request, obj, **kwargs)

    def get_inline_instances(self, request, obj=None):
        request._current_place_obj = obj
        return super().get_inline_instances(request, obj)

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        PlaceSummaryCard.objects.get_or_create(place=obj)


@admin.register(OptionalExpense)
class OptionalExpenseAdmin(admin.ModelAdmin):
    """(직접 관리용) 선택적 지출 항목 관리자 페이지"""
    list_display = ('place', 'item_name', 'price_display', 'display_order')
    list_filter = ('place',)
    search_fields = ('item_name', 'place__name')


@admin.register(PlaceSummaryCard)
class PlaceSummaryCardAdmin(admin.ModelAdmin):
    """요약 카드 캐시 테이블 관리용 Admin."""

    list_display = (
        'place',
        'generator',
        'generated_at',
        'cached_at',
        'created_by',
    )
    search_fields = ('place__name', 'generator')
    list_filter = ('generator', 'created_by')
    readonly_fields = (
        'place',
        'generated_lines_pretty',
        'sources_pretty',
        'ai_response',
        'generator',
        'generated_at',
        'cached_at',
        'created_by',
        'created_at',
        'updated_at',
    )
    fieldsets = (
        ("기본 정보", {'fields': ('place', 'generator', 'generated_at', 'cached_at', 'created_by')}),
        ("생성 결과", {'fields': ('generated_lines_pretty', 'sources_pretty', 'ai_response')}),
        ("메타", {'fields': ('created_at', 'updated_at')}),
    )

    def has_add_permission(self, request):
        return False

    def generated_lines_pretty(self, obj):
        return "\n".join(obj.generated_lines or [])

    generated_lines_pretty.short_description = "생성 문장"

    def sources_pretty(self, obj):
        if not obj.sources:
            return "등록된 출처 없음"
        return "\n".join(f"- {source}" for source in obj.sources)

    sources_pretty.short_description = "저장된 출처"


@admin.register(PlaceUpdate)
class PlaceUpdateAdmin(admin.ModelAdmin):
    """최신 소식 모델 전용 Admin."""

    list_display = ('title', 'place_name', 'published_at', 'is_official', 'is_recent')
    list_filter = ('is_official', 'published_at')
    search_fields = ('title', 'description', 'place__name')
    autocomplete_fields = ('place', 'summary_card', 'sources')
    readonly_fields = ('is_recent',)
    fieldsets = (
        ("기본 정보", {'fields': ('place', 'summary_card', 'title', 'description')}),
        ("출처", {'fields': ('source_url', 'sources', 'is_official')}),
        ("일시", {'fields': ('published_at', 'is_recent')}),
    )

    def place_name(self, obj):
        return obj.place.name

    place_name.short_description = "장소"


@admin.register(PlaceUpdateSource)
class PlaceUpdateSourceAdmin(admin.ModelAdmin):
    """출처 테이블 관리 Admin."""

    list_display = ('name', 'url', 'note')
    search_fields = ('name', 'url')