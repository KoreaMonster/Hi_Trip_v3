from django.urls import path
from . import views


urlpatterns = [
    # ========== 일정 (Schedule) ==========
    # 'schedule-list-create'라는 이름으로 /api/schedules/trips/<id>/schedules/ URL을 정의합니다.
    path('trips/<int:trip_id>/schedules/', views.schedule_list_create, name='schedule-list-create'),

    # 'schedule-detail-action'이라는 이름으로 개별 일정을 다루는 URL을 정의합니다.
    path('trips/<int:trip_id>/schedules/<int:schedule_id>/', views.schedule_detail_action, name='schedule-detail-action'),

    # ========== 장소 (Place) ==========
    # (수정) 'place-list-create' 라는 이름으로 /places/ URL을 정의합니다.
    path('places/', views.place_list_create, name='place-list-create'),

    # (수정) 'place-detail-action' 이라는 이름으로 개별 장소를 다루는 URL을 정의합니다.
    path('places/<int:place_id>/', views.place_detail_action, name='place-detail-action'),

    # ========== 선택 비용 (Optional Expense) ==========
    path('places/<int:place_id>/expenses/', views.expense_list_create, name='expense-list-create'),
    path('expenses/calculate/', views.calculate_expense, name='calculate-expense'),

    # ========== 장소 담당자 (Place Coordinator) & 역할 (Role) ==========
    path('places/<int:place_id>/coordinators/', views.coordinator_list_create, name='coordinator-list-create'),
    path('categories/', views.list_categories, name='list-categories'),
    path('coordinator-roles/', views.list_coordinator_roles, name='list-coordinator-roles'),
]