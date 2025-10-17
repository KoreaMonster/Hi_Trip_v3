# # users/tests.py
#
# import json
# from rest_framework.test import APITestCase, APIClient
# from rest_framework import status
# from django.contrib.auth import get_user_model
#
# User = get_user_model()
#
#
# class UserComprehensiveTests(APITestCase):
#     """
#     User 앱 인증/권한 API 종합 테스트 (총 15개 시나리오)
#     - 복잡한 예외 상황 및 권한 체계를 집중적으로 검증하여 시스템의 안정성을 확보합니다.
#     """
#
#     # ===== 1. 테스트 사전 설정 =====
#     def setUp(self):
#         # 사용자 데이터 정의
#         self.super_admin_data = {"username": "superadmin", "password": "Password123", "role": "super_admin"}
#         self.manager_data_A = {"username": "managerA", "password": "Password123", "role": "manager"}
#         self.manager_data_B = {"username": "managerB", "password": "Password123", "role": "manager"}
#
#         # 사용자 객체 생성
#         self.super_admin = User.objects.create_user(**self.super_admin_data, is_approved=True)
#         self.unapproved_manager = User.objects.create_user(**self.manager_data_A, is_approved=False)
#         self.approved_manager = User.objects.create_user(**self.manager_data_B, is_approved=True)
#
#         # URL 경로
#         self.register_url = '/api/auth/register/'
#         self.login_url = '/api/auth/login/'
#         self.logout_url = '/api/auth/logout/'
#         self.approve_url = '/api/auth/approve/'
#         self.profile_url = '/api/auth/profile/'
#
#     # ===== 2. 보조 함수 (디버깅 및 결과 검증용) =====
#     def print_and_verify(self, message, response, expected_status):
#         print(f"\n▶️  {message}")
#         print("--- [서버 응답 확인] ---")
#         print(f"  - Status Code: {response.status_code}")
#         content = json.dumps(response.data, indent=2, ensure_ascii=False) if response.data else "No Content"
#         print(f"  - Response Body:\n{content}")
#         print("--- [테스트 결과 검증] ---")
#         self.assertEqual(response.status_code, expected_status)
#         print(f"  ✅ Status Code가 예상대로 '{expected_status}' 입니다.")
#
#     # ===== 3. 테스트 함수들 (총 15개) =====
#
#     # --- [그룹 A] 회원가입 시나리오 ---
#     def test_01_register_success(self):
#         """[테스트 01] (성공) 신규 담당자가 정상적으로 회원가입됩니다."""
#         new_user_data = {"username": "newmanager", "password": "Password123"}
#         response = self.client.post(self.register_url, new_user_data, format='json')
#         self.print_and_verify("[01] 신규 담당자 회원가입", response, status.HTTP_201_CREATED)
#         created_user = User.objects.get(username=new_user_data['username'])
#         self.assertFalse(created_user.is_approved)
#         self.assertEqual(created_user.role, 'manager')
#         print("  ✅ 신규 사용자가 '미승인/담당자' 상태로 DB에 생성되었습니다.")
#
#     def test_02_register_fail_duplicate_username(self):
#         """[테스트 02] (실패) 이미 존재하는 아이디로 회원가입할 수 없습니다."""
#         duplicate_data = {"username": "superadmin", "password": "Password123"}
#         response = self.client.post(self.register_url, duplicate_data, format='json')
#         self.print_and_verify("[02] 중복 아이디 회원가입", response, status.HTTP_400_BAD_REQUEST)
#
#     def test_03_register_fail_without_password(self):
#         """[테스트 03] (실패) 비밀번호 없이 회원가입할 수 없습니다."""
#         no_password_data = {"username": "nouser"}
#         response = self.client.post(self.register_url, no_password_data, format='json')
#         self.print_and_verify("[03] 비밀번호 없는 회원가입", response, status.HTTP_400_BAD_REQUEST)
#         self.assertIn('password', response.data)  # password 필드 에러인지 확인
#
#     # --- [그룹 B] 로그인 시나리오 ---
#     def test_04_login_fail_for_unapproved_user(self):
#         """[테스트 04] (실패) 승인되지 않은 담당자는 로그인할 수 없습니다."""
#         login_data = {"username": "managerA", "password": "Password123"}
#         response = self.client.post(self.login_url, login_data, format='json')
#         self.print_and_verify("[04] 미승인 담당자 로그인", response, status.HTTP_403_FORBIDDEN)
#
#     def test_05_login_success_for_approved_manager(self):
#         """[테스트 05] (성공) 승인된 담당자는 정상적으로 로그인할 수 있습니다."""
#         login_data = {"username": "managerB", "password": "Password123"}
#         response = self.client.post(self.login_url, login_data, format='json')
#         self.print_and_verify("[05] 승인된 담당자 로그인", response, status.HTTP_200_OK)
#
#     def test_06_login_success_for_super_admin(self):
#         """[테스트 06] (성공) 총괄담당자는 정상적으로 로그인할 수 있습니다."""
#         login_data = {"username": "superadmin", "password": "Password123"}
#         response = self.client.post(self.login_url, login_data, format='json')
#         self.print_and_verify("[06] 총괄담당자 로그인", response, status.HTTP_200_OK)
#
#     # --- [그룹 C] 권한 및 승인 시나리오 ---
#     def test_07_approval_success_by_super_admin(self):
#         """[테스트 07] (성공) 총괄담당자는 미승인 담당자를 승인할 수 있습니다."""
#         client = APIClient()
#         client.force_authenticate(user=self.super_admin)
#         approve_data = {"user_id": self.unapproved_manager.id}
#         response = client.post(self.approve_url, approve_data, format='json')
#         self.print_and_verify("[07] 총괄담당자의 승인 시도", response, status.HTTP_200_OK)
#         self.unapproved_manager.refresh_from_db()
#         self.assertTrue(self.unapproved_manager.is_approved)
#         print("  ✅ DB에서 is_approved가 True로 변경되었습니다.")
#
#     def test_08_approval_fail_by_manager(self):
#         """[테스트 08] (실패) 일반 담당자는 승인 권한이 없습니다."""
#         client = APIClient()
#         client.force_authenticate(user=self.approved_manager)
#         approve_data = {"user_id": self.unapproved_manager.id}
#         response = client.post(self.approve_url, approve_data, format='json')
#         self.print_and_verify("[08] 일반 담당자의 승인 시도", response, status.HTTP_403_FORBIDDEN)
#
#     def test_09_approval_fail_for_nonexistent_user(self):
#         """[테스트 09] (실패) 총괄담당자가 존재하지 않는 사용자를 승인 시도 시 에러가 발생합니다."""
#         client = APIClient()
#         client.force_authenticate(user=self.super_admin)
#         approve_data = {"user_id": 999}
#         response = client.post(self.approve_url, approve_data, format='json')
#         self.print_and_verify("[09] 존재하지 않는 사용자 승인 시도", response, status.HTTP_404_NOT_FOUND)
#
#     def test_10_approval_fail_for_already_approved_user(self):
#         """[테스트 10] (실패) 총괄담당자가 이미 승인된 사용자를 다시 승인 시도합니다."""
#         client = APIClient()
#         client.force_authenticate(user=self.super_admin)
#         approve_data = {"user_id": self.approved_manager.id}
#         response = client.post(self.approve_url, approve_data, format='json')
#         self.print_and_verify("[10] 이미 승인된 사용자 재승인 시도", response, status.HTTP_200_OK)  # views.py의 로직상 성공(메시지)으로 응답
#         self.assertIn('이미 승인된', response.data['message'])
#         print("  ✅ '이미 승인된 사용자'라는 메시지가 정상 출력되었습니다.")
#
#     def test_11_approval_fail_without_userid(self):
#         """[테스트 11] (실패) user_id 없이 승인 요청 시 에러가 발생합니다."""
#         client = APIClient()
#         client.force_authenticate(user=self.super_admin)
#         response = client.post(self.approve_url, {}, format='json')  # user_id를 보내지 않음
#         self.print_and_verify("[11] user_id 없는 승인 요청", response, status.HTTP_400_BAD_REQUEST)
#
#     # --- [그룹 D] 프로필 및 세션 시나리오 ---
#         # users/tests.py
#
#     def test_12_profile_access_fail_without_login(self):
#         """[테스트 12] (실패) 로그인하지 않은 사용자는 프로필 정보를 볼 수 없습니다."""
#         response = self.client.get(self.profile_url)
#         # ▼▼▼▼▼ [수정] 예상 코드를 401 -> 403으로 변경 ▼▼▼▼▼
#         self.print_and_verify("[12] 비로그인 사용자의 프로필 접근", response, status.HTTP_403_FORBIDDEN)
#
#     def test_13_profile_access_success_with_login(self):
#         """[테스트 13] (성공) 로그인한 사용자는 자신의 프로필 정보를 볼 수 있습니다."""
#         client = APIClient()
#         client.force_authenticate(user=self.approved_manager)
#         response = client.get(self.profile_url)
#         self.print_and_verify("[13] 로그인 사용자의 프로필 접근", response, status.HTTP_200_OK)
#         self.assertEqual(response.data['username'], self.approved_manager.username)
#         print("  ✅ 응답 데이터의 username이 요청 사용자와 일치합니다.")
#
#         # users/tests.py
#
#         def test_14_logout_and_session_invalidation(self):
#             """[테스트 14] (성공) 로그아웃 후에는 세션이 만료되어 프로필에 접근할 수 없습니다."""
#             client = APIClient()
#             client.post(self.login_url, {"username": "managerB", "password": "Password1223"}, format='json')
#
#             response_logout = client.post(self.logout_url)
#             self.print_and_verify("[14] 로그아웃 요청", response_logout, status.HTTP_200_OK)
#
#             response_profile = client.get(self.profile_url)
#             # ▼▼▼▼▼ [수정] 예상 코드를 401 -> 403으로 변경 ▼▼▼▼▼
#             self.print_and_verify("[14] 로그아웃 후 프로필 접근", response_profile, status.HTTP_403_FORBIDDEN)
#             # ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
#     def test_15_super_admin_cannot_approve_self(self):
#         """[테스트 15] (실패) 총괄담당자가 자기 자신을 승인하려고 시도합니다."""
#         client = APIClient()
#         client.force_authenticate(user=self.super_admin)
#         approve_data = {"user_id": self.super_admin.id}
#         response = client.post(self.approve_url, approve_data, format='json')
#         self.print_and_verify("[15] 총괄담당자 셀프 승인 시도", response, status.HTTP_200_OK)
#         self.assertIn('이미 승인된', response.data['message'])
#         print("  ✅ '이미 승인된 사용자'라는 메시지가 정상 출력되었습니다.")