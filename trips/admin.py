from django.contrib import admin
from .models import Trip, TripParticipant


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    """여행 관리자 페이지"""
    list_display = ['title', 'destination', 'start_date', 'end_date', 'manager', 'status', 'invite_code', 'created_at']
    list_filter = ['status', 'start_date', 'manager']
    search_fields = ['title', 'destination', 'invite_code']
    readonly_fields = ['invite_code', 'created_at', 'updated_at']

    fieldsets = (
        ('기본 정보', {
            'fields': ('title', 'destination', 'start_date', 'end_date')
        }),
        ('관리 정보', {
            'fields': ('status', 'manager', 'invite_code')
        }),
        ('메타 정보', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(TripParticipant)
class TripParticipantAdmin(admin.ModelAdmin):
    """여행 참가자 관리자 페이지"""
    list_display = ['trip', 'traveler', 'joined_date']
    list_filter = ['trip', 'joined_date']
    search_fields = ['trip__title', 'traveler__last_name_kr', 'traveler__first_name_kr']
    readonly_fields = ['joined_date']

    fieldsets = (
        ('참가 정보', {
            'fields': ('trip', 'traveler', 'joined_date')
        }),
    )