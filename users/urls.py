# users/urls.py

from django.urls import path
# from . import views # 나중에 views.py와 연결할 때 이 줄의 주석을 해제하세요.

# Django가 이 변수를 찾습니다. 지금 당장 경로를 추가하지 않더라도
# 비어있는 리스트 형태로 꼭 만들어 주어야 합니다.
urlpatterns = [
    # 예시: 나중에 회원가입 URL을 만든다면 아래와 같이 추가할 수 있습니다.
    # path('signup/', views.SignupView.as_view(), name='signup'),
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
