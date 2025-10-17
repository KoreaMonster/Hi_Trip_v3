# from django.test import TestCase
# from django.urls import reverse
# from rest_framework.test import APIClient
# from rest_framework import status
# from datetime import date, timedelta
#
# from users.models import User, Traveler
# from trips.models import Trip, TripParticipant
#
#
# class TripAPITestCase(TestCase):
#     """여행 관리 API 통합 테스트"""
#
#     def setUp(self):
#         """각 테스트 실행 전 공통 설정"""
#         self.client = APIClient()
#
#         # ==================== 사용자 생성 ====================
#         # 1. 총괄담당자 (승인됨)
#         self.super_admin = User.objects.create_user(
#             username='super_admin',
#             password='test1234',
#             role='super_admin',
#             is_approved=True,
#             first_name_kr='김',
#             last_name_kr='총괄'
#         )
#
#         # 2. 담당자 (승인됨)
#         self.manager = User.objects.create_user(
#             username='manager1',
#             password='test1234',
#             role='manager',
#             is_approved=True,
#             first_name_kr='이',
#             last_name_kr='담당'
#         )
#
#         # 3. 담당자2 (승인됨)
#         self.manager2 = User.objects.create_user(
#             username='manager2',
#             password='test1234',
#             role='manager',
#             is_approved=True,
#             first_name_kr='박',
#             last_name_kr='부담당'
#         )
#
#         # 4. 미승인 담당자
#         self.unapproved_manager = User.objects.create_user(
#             username='unapproved',
#             password='test1234',
#             role='manager',
#             is_approved=False,
#             first_name_kr='최',
#             last_name_kr='미승인'
#         )
#
#         # ==================== 여행자 생성 ====================
#         self.traveler1 = Traveler.objects.create(
#             last_name_kr='홍',
#             first_name_kr='길동',
#             phone='010-1111-1111',
#             birth_date='1990-01-01',
#             gender='M',
#             email='hong@example.com'
#         )
#
#         self.traveler2 = Traveler.objects.create(
#             last_name_kr='김',
#             first_name_kr='철수',
#             phone='010-2222-2222',
#             birth_date='1992-05-15',
#             gender='M',
#             email='kim@example.com'
#         )
#
#         # ==================== 여행 생성 ====================
#         self.trip1 = Trip.objects.create(
#             title='제주도 힐링 여행',
#             destination='제주도',
#             start_date=date.today() + timedelta(days=30),
#             end_date=date.today() + timedelta(days=33),
#             manager=self.manager,
#             status='planning'
#         )
#
#         self.trip2 = Trip.objects.create(
#             title='부산 바다 여행',
#             destination='부산',
#             start_date=date.today() + timedelta(days=60),
#             end_date=date.today() + timedelta(days=62),
#             manager=self.manager2,
#             status='planning'
#         )
#
#         # 담당자 없는 여행
#         self.trip3 = Trip.objects.create(
#             title='강원도 산악 여행',
#             destination='강원도',
#             start_date=date.today() + timedelta(days=90),
#             end_date=date.today() + timedelta(days=92),
#             status='planning'
#         )
#
#         # ==================== 참가자 등록 ====================
#         TripParticipant.objects.create(
#             trip=self.trip1,
#             traveler=self.traveler1
#         )
#
#     # ==================== 테스트 1: 비로그인 접근 차단 ====================
#     def test_01_list_trips_without_login(self):
#         """비로그인 사용자는 여행 목록 조회 불가"""
#         url = reverse('list_trips')
#         response = self.client.get(url)
#
#         self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
#         print("✅ 테스트 1 통과: 비로그인 접근 차단")
#
#     # ==================== 테스트 2: 미승인 직원 접근 차단 ====================
#     def test_02_list_trips_unapproved_user(self):
#         """미승인 직원은 여행 목록 조회 불가"""
#         self.client.force_authenticate(user=self.unapproved_manager)
#         url = reverse('list_trips')
#         response = self.client.get(url)
#
#         self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
#         self.assertIn('승인되지 않은', response.data['error'])
#         print("✅ 테스트 2 통과: 미승인 직원 접근 차단")
#
#     # ==================== 테스트 3: 총괄담당자 모든 여행 조회 ====================
#     def test_03_super_admin_list_all_trips(self):
#         """총괄담당자는 모든 여행 조회 가능"""
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('list_trips')
#         response = self.client.get(url)
#
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(len(response.data), 3)  # 총 3개 여행
#         print(f"✅ 테스트 3 통과: 총괄담당자 전체 조회 ({len(response.data)}개)")
#
#     # ==================== 테스트 4: 담당자 자기 여행만 조회 ====================
#     def test_04_manager_list_own_trips_only(self):
#         """담당자는 자신이 담당하는 여행만 조회"""
#         self.client.force_authenticate(user=self.manager)
#         url = reverse('list_trips')
#         response = self.client.get(url)
#
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(len(response.data), 1)  # manager는 trip1만 담당
#         self.assertEqual(response.data[0]['title'], '제주도 힐링 여행')
#         print(f"✅ 테스트 4 통과: 담당자 자기 여행만 조회 ({len(response.data)}개)")
#
#     # ==================== 테스트 5: 여행 생성 성공 ====================
#     def test_05_create_trip_success(self):
#         """승인된 직원은 여행 생성 가능"""
#         self.client.force_authenticate(user=self.manager)
#         url = reverse('create_trip')
#         data = {
#             'title': '경주 역사 여행',
#             'destination': '경주',
#             'start_date': (date.today() + timedelta(days=120)).isoformat(),
#             'end_date': (date.today() + timedelta(days=122)).isoformat(),
#         }
#         response = self.client.post(url, data, format='json')
#
#         self.assertEqual(response.status_code, status.HTTP_201_CREATED)
#         self.assertEqual(response.data['title'], '경주 역사 여행')
#         self.assertIsNotNone(response.data['invite_code'])  # 초대코드 자동 생성
#         self.assertEqual(len(response.data['invite_code']), 8)  # 8자리
#         print(f"✅ 테스트 5 통과: 여행 생성 (초대코드: {response.data['invite_code']})")
#
#     # ==================== 테스트 6: 여행 생성 - 날짜 검증 실패 ====================
#     def test_06_create_trip_invalid_dates(self):
#         """종료일이 시작일보다 빠르면 생성 실패"""
#         self.client.force_authenticate(user=self.manager)
#         url = reverse('create_trip')
#         data = {
#             'title': '잘못된 여행',
#             'destination': '어딘가',
#             'start_date': (date.today() + timedelta(days=10)).isoformat(),
#             'end_date': (date.today() + timedelta(days=5)).isoformat(),  # 시작일보다 빠름!
#         }
#         response = self.client.post(url, data, format='json')
#
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#         self.assertIn('종료일', str(response.data))
#         print("✅ 테스트 6 통과: 날짜 검증 실패")
#
#     # ==================== 테스트 7: 여행 생성 - 필수 필드 누락 ====================
#     def test_07_create_trip_missing_fields(self):
#         """필수 필드 누락 시 생성 실패"""
#         self.client.force_authenticate(user=self.manager)
#         url = reverse('create_trip')
#         data = {
#             'title': '불완전한 여행',
#             # destination, start_date, end_date 누락
#         }
#         response = self.client.post(url, data, format='json')
#
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#         self.assertIn('destination', response.data)
#         self.assertIn('start_date', response.data)
#         print("✅ 테스트 7 통과: 필수 필드 누락 검증")
#
#     # ==================== 테스트 8: 여행 상세 조회 성공 ====================
#     def test_08_trip_detail_success(self):
#         """담당자는 자기 여행 상세 조회 가능"""
#         self.client.force_authenticate(user=self.manager)
#         url = reverse('trip_detail', kwargs={'trip_id': self.trip1.id})
#         response = self.client.get(url)
#
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(response.data['title'], '제주도 힐링 여행')
#         self.assertIn('participants', response.data)  # 참가자 목록 포함
#         self.assertEqual(len(response.data['participants']), 1)  # traveler1 참가
#         print(f"✅ 테스트 8 통과: 여행 상세 조회 (참가자 {len(response.data['participants'])}명)")
#
#     # ==================== 테스트 9: 여행 상세 조회 - 권한 없음 ====================
#     def test_09_trip_detail_no_permission(self):
#         """담당자는 다른 담당자의 여행 조회 불가"""
#         self.client.force_authenticate(user=self.manager)  # manager
#         url = reverse('trip_detail', kwargs={'trip_id': self.trip2.id})  # manager2의 여행
#         response = self.client.get(url)
#
#         self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
#         self.assertIn('권한', response.data['error'])
#         print("✅ 테스트 9 통과: 다른 담당자 여행 접근 차단")
#
#     # ==================== 테스트 10: 여행 상세 조회 - 존재하지 않는 여행 ====================
#     def test_10_trip_detail_not_found(self):
#         """존재하지 않는 여행 조회 시 404"""
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('trip_detail', kwargs={'trip_id': 9999})
#         response = self.client.get(url)
#
#         self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
#         print("✅ 테스트 10 통과: 존재하지 않는 여행 404 반환")
#
#     # ==================== 테스트 11: 총괄담당자는 모든 여행 상세 조회 가능 ====================
#     def test_11_super_admin_can_view_all_trips(self):
#         """총괄담당자는 담당자 상관없이 모든 여행 조회 가능"""
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('trip_detail', kwargs={'trip_id': self.trip2.id})
#         response = self.client.get(url)
#
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(response.data['title'], '부산 바다 여행')
#         print("✅ 테스트 11 통과: 총괄담당자 모든 여행 조회 가능")
#
#     # ==================== 테스트 12: 담당자 배정 성공 ====================
#     def test_12_assign_manager_success(self):
#         """총괄담당자는 여행에 담당자 배정 가능"""
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('assign_manager', kwargs={'trip_id': self.trip3.id})
#         data = {'manager_id': self.manager.id}
#         response = self.client.post(url, data, format='json')
#
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertIn('배정', response.data['message'])
#
#         # DB 확인
#         self.trip3.refresh_from_db()
#         self.assertEqual(self.trip3.manager, self.manager)
#         print(f"✅ 테스트 12 통과: 담당자 배정 ({self.manager.full_name_kr})")
#
#     # ==================== 테스트 13: 담당자 배정 - 권한 없음 ====================
#     def test_13_assign_manager_no_permission(self):
#         """일반 담당자는 담당자 배정 불가"""
#         self.client.force_authenticate(user=self.manager)
#         url = reverse('assign_manager', kwargs={'trip_id': self.trip3.id})
#         data = {'manager_id': self.manager2.id}
#         response = self.client.post(url, data, format='json')
#
#         self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
#         self.assertIn('총괄담당자', response.data['error'])
#         print("✅ 테스트 13 통과: 일반 담당자 배정 권한 없음")
#
#     # ==================== 테스트 14: 담당자 배정 - 존재하지 않는 담당자 ====================
#     def test_14_assign_manager_invalid_manager_id(self):
#         """존재하지 않는 담당자 ID로 배정 시도"""
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('assign_manager', kwargs={'trip_id': self.trip3.id})
#         data = {'manager_id': 9999}
#         response = self.client.post(url, data, format='json')
#
#         self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
#         self.assertIn('존재하지 않는', response.data['error'])
#         print("✅ 테스트 14 통과: 존재하지 않는 담당자 검증")
#
#     # ==================== 테스트 15: 담당자 배정 - 역할 검증 ====================
#     def test_15_assign_manager_wrong_role(self):
#         """총괄담당자를 담당자로 배정 시도 (role 검증)"""
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('assign_manager', kwargs={'trip_id': self.trip3.id})
#         data = {'manager_id': self.super_admin.id}  # 총괄담당자 ID
#         response = self.client.post(url, data, format='json')
#
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#         self.assertIn('담당자 역할', response.data['error'])
#         print("✅ 테스트 15 통과: 역할 검증 (총괄담당자는 담당자로 배정 불가)")
#
#     # ==================== 테스트 16: 초대코드 고유성 검증 ====================
#     def test_16_invite_code_uniqueness(self):
#         """초대코드는 각 여행마다 고유해야 함"""
#         invite_codes = set()
#
#         # 10개 여행 생성
#         for i in range(10):
#             trip = Trip.objects.create(
#                 title=f'테스트 여행 {i}',
#                 destination=f'장소 {i}',
#                 start_date=date.today() + timedelta(days=i * 10),
#                 end_date=date.today() + timedelta(days=i * 10 + 2)
#             )
#             invite_codes.add(trip.invite_code)
#
#         # 10개 모두 고유해야 함
#         self.assertEqual(len(invite_codes), 10)
#         print(f"✅ 테스트 16 통과: 초대코드 고유성 검증 (10개 모두 고유)")
#
#     # ==================== 테스트 17: 참가자 수 카운트 ====================
#     def test_17_participant_count(self):
#         """참가자 수 정확히 카운트되는지 검증"""
#         # trip1에 traveler2 추가
#         TripParticipant.objects.create(
#             trip=self.trip1,
#             traveler=self.traveler2
#         )
#
#         self.client.force_authenticate(user=self.manager)
#         url = reverse('trip_detail', kwargs={'trip_id': self.trip1.id})
#         response = self.client.get(url)
#
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(len(response.data['participants']), 2)
#         print(f"✅ 테스트 17 통과: 참가자 수 카운트 ({len(response.data['participants'])}명)")
#
#     # ==================== 테스트 18: 참가자 중복 등록 방지 ====================
#     def test_18_duplicate_participant_prevented(self):
#         """같은 참가자를 같은 여행에 두 번 등록 불가"""
#         # 이미 trip1에 traveler1 등록됨 (setUp에서)
#
#         with self.assertRaises(Exception):  # IntegrityError 발생
#             TripParticipant.objects.create(
#                 trip=self.trip1,
#                 traveler=self.traveler1  # 중복!
#             )
#
#         print("✅ 테스트 18 통과: 참가자 중복 등록 방지 (unique_together)")
#
#
# # ==================== 테스트 실행 명령어 ====================
# """
# 전체 테스트 실행:
# python manage.py test trips.test_v2
#
# 특정 테스트만 실행:
# python manage.py test trips.test_v2.TripAPITestCase.test_05_create_trip_success
#
# 상세 출력:
# python manage.py test trips.test_v2 --verbosity=2
# """