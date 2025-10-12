from django.urls import path
from . import views

urlpatterns = [
    # ========== 일정 (Schedule) ==========
    # GET, POST -> /api/schedules/trips/1/schedules/
    #해당 Trip에 속하는 schedule이라는 의미
    path('trips/<int:trip_id>/schedules/', views.list_schedules, name="list_schedules"),
    path('trips/<int:trip_id>/schedules/',views.create_schedule, name="create_schedule"),

    # GET, PUT, PATCH, DELETE -> /api/schedules/trips/1/schedules/5/
    path('trips/<int:trip_id>/schedules/<int:schedule_id>/', views.schedule_detail, name="schedule_detail"),
    path('trips/<int:trip_id>/schedules/<int:schedule_id>', views.update_schedule, name="update_schedule"),
    path('trips/<int:trip_id>/schedules/<int:schedule_id>', views.delete_schedule, name="delete_schedule"),

    # ========== 장소 (Place) ==========
    # GET, POST -> /api/schedules/places/
    path('places/', views.list_places, name="list_places"),
    path('places/', views.create_place, name="create_place"),

    # GET, PUT, PATCH, DELETE -> /api/schedules/places/1/
    path("places/<int:place_id>/", views.place_detail, name="place_detail"),
    path("place/<int:place_id>/", views.update_place, name="update_place"),
    path("place/<int:place_id>/", views.delete_place, name="delete_place"),


    # ========== 선택 비용 (Optional Expense) ==========
    # GET, POST -> /api/schedules/places/1/expenses/
    path('places/<int:place_id>/expenses/', views.list_expenses, name="list_expenses"),
    path('places/<int:place_id>/expenses/', views.create_expense, name="create_expense"),
    path('expenses/calculate/', views.calculate_expense, name='calculate_expense'),

    # ========== 장소 담당자 (Place Coordinator) & 역할 (Role) ==========
    # 'GET', 'POST' on /places/{id}/coordinators/
    path('places/<int:place_id>/coordinators/', views.list_coordinators, name='list_coordinators'),
    path('places/<int:place_id>/coordinators/', views.create_coordinator, name='create_coordinator'),

    path('categories/', views.list_categories, name='list_categories'),
    path('coordinator-roles/', views.list_coordinator_roles, name='list_coordinator_roles'),
]


