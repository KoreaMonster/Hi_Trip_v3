# users/urls.py


from django.urls import path
from . import views
# Phase 1 안내:
#   - 이후 단계에서 DefaultRouter를 도입할 예정이라 함수형 경로는 임시 유지한다.
#   - CBV 전환 시 이 파일이 router.register(...) 기반으로 재작성될 것임을
#     명시적으로 알려 초보 개발자의 이해를 돕는다.
urlpatterns = [
    path('register/', views.register, name='register'),           # 회원가입
    path('login/', views.login_view, name='login'),               # 로그인
    path('logout/', views.logout_view, name='logout'),            # 로그아웃
    path('profile/', views.profile, name='profile'),              # 프로필 조회
    path('approve/', views.approve_user, name='approve_user'),    # 담당자 승인
]

# # test_v1을 위해 생성함.
# # users/urls.py
#
# from django.urls import path
# from . import views  # views.py 파일을 가져옵니다.
#
# urlpatterns = [
#     # 각 기능(view)에 맞는 URL 경로를 지정합니다.
#     path('register/', views.register, name='register'),      # 회원가입
#     path('login/', views.login_view, name='login'),          # 로그인
#     path('logout/', views.logout_view, name='logout'),        # 로그아웃
#     path('profile/', views.profile, name='profile'),          # 프로필 조회
# ]
# # test_v1을 위해 생성함.
