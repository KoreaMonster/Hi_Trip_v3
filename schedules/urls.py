from django.urls import path
from . import views

urlpatterns = [
    #Schedule
    path('trips/<int:trip_id>/schedules/', views.list_schedules),
    path('trips/<int:tirp_id>/schedules/create/', views.create_schedule),
    path('tirps/<int:tirp_id>/schedules/<int:schedule_id>/', views.schedule_detail),
    path('trip/<int:trip_id>/scheduels/<int:schedule_id>/update/', views.update_schedule),
    path('trip/<int:trip_id>/schedules/<int:schedule_id>/delate/',views.delete_schedule),

    #Place
    path('places/', views.list_places),
    path('places/create/', views.create_place),
    path('places/<int:place_id>/', views.place_detail),
    path('places/<int:place_id>/update/', views.update_place),
    path('places/<int:place_id>/delete/', views.delete_place),

    #Optional Expense
    path('places/<int:place_id>/expenses/', views.list_expenses),
    path('places/<int:place_id>/expenses/create/', views.create_expense),
    path('expenses/calculate/', views.calculate_expense),

    #Place Coordinator
    path('categories/', views.list_categories),
    path('places/<int:place_id>/coordinators/', views.list_coordinators),
    path('places/<int:place_id>/coordinatores/create/', views.create_coordinator),
    path('coordinator-roles/', views.list_coordinator_roles)
]