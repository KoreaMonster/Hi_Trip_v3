from django.urls import path
from . import views


urlpatterns = [
    #여행 목록 조회
    path('', views.list_trips, name='list_trips'),
    #여행을 새로 생성
    path('create/', views.create_trip, name='create_trip'),
    #여행 상세 조회
    path('<int:trip_id>', views.trip_detail, name="trip_detail"),
    #담당자 배정 - 총괄담당자만 이 역할을 수행
    path('<int:trip_id>/assign-manager', views.assign_manager, name="assign_manager" )
    # ==================== 초대코드 관련 (나중에 구현) ====================
    # path('join/', views.join_trip, name='join_trip'),  # 초대코드로 참가
]