# users/urls.py

from django.urls import path
# from . import views # 나중에 views.py와 연결할 때 이 줄의 주석을 해제하세요.

# Django가 이 변수를 찾습니다. 지금 당장 경로를 추가하지 않더라도
# 비어있는 리스트 형태로 꼭 만들어 주어야 합니다.
urlpatterns = [
    # 예시: 나중에 회원가입 URL을 만든다면 아래와 같이 추가할 수 있습니다.
    # path('signup/', views.SignupView.as_view(), name='signup'),
]