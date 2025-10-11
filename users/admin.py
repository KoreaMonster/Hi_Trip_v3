from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Traveler


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """직원 관리자 페이지"""

    list_display = ['username', 'full_name_kr_display', 'email', 'phone', 'role', 'is_approved']
    list_filter = ['role', 'is_approved', 'is_staff', 'is_active']
    search_fields = ['username', 'first_name_kr', 'last_name_kr', 'email', 'phone']

    fieldsets = BaseUserAdmin.fieldsets + (
        ('추가 정보', {'fields': ('phone', 'first_name_kr', 'last_name_kr')}),
        ('권한 설정', {'fields': ('role', 'is_approved')}),
    )
    @admin.display(description='이름') # 관리자 페이지에 표시될 컬럼명 설정
    def full_name_kr_display(self, obj):
        return obj.full_name_kr


@admin.register(Traveler)
class TravelerAdmin(admin.ModelAdmin):
    """여행자 관리자 페이지"""
    list_display = ['full_name_kr', 'phone', 'birth_date', 'gender', 'payment_complete', 'created_at']
    list_filter = ['gender', 'country', 'passport_verified', 'identity_verified', 'booking_verified']
    search_fields = ['last_name_kr', 'first_name_kr', 'phone', 'email']
    readonly_fields = ['created_at', 'updated_at']

    fieldsets = (
        ('기본 정보', {
            'fields': ('last_name_kr', 'first_name_kr', 'first_name_en', 'last_name_en', 'birth_date', 'gender')
        }),
        ('연락 정보', {
            'fields': ('phone', 'email', 'address', 'country')
        }),
        ('여행 관련', {
            'fields': ('is_companion', 'companion_names', 'proxy_booking')
        }),
        ('여권 정보', {
            'fields': ('passport_number', 'passport_expiry')
        }),
        ('검증 상태', {
            'fields': ('passport_verified', 'identity_verified', 'booking_verified')
        }),
        ('결제 정보', {
            'fields': ('total_amount', 'paid_amount')
        }),
        ('보험', {
            'fields': ('insurance_subscribed',)
        }),
        ('메타 정보', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    # def payment_complete(self, obj):
    #     """결제 완료 여부 표시"""
    #     return obj.payment_status
    #
    # payment_complete.boolean = True
    # payment_complete.short_description = '결제 완료'
    @admin.display(boolean=True, description='결제 완료')
    def payment_status(self, obj):
        return obj.payment_status