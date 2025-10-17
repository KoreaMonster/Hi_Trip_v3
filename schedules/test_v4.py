# import os
# import logging
# from PIL import Image
# from io import BytesIO
# from django.test import TestCase
# from django.urls import reverse
# from django.core.files.uploadedfile import SimpleUploadedFile
# from django.conf import settings
# from rest_framework.test import APIClient
# from rest_framework import status
# from datetime import date, time, timedelta
# from django.db.models import ProtectedError
#
# from users.models import User
# from trips.models import Trip
# from .models import Schedule, PlaceCategory, Place, CoordinatorRole, PlaceCoordinator, OptionalExpense
#
# # ======================================================================
# # 로깅 설정: 테스트 과정을 상세히 추적하기 위해 로거를 설정합니다.
# # ======================================================================
# logger = logging.getLogger(__name__)
# logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
#
#
# class ScheduleAPITestCaseV4(TestCase):
#     """
#     schedules 앱 API 최종 통합 테스트 (v4)
#     - 총 65개 테스트 케이스
#     - 상세 로깅 기능 추가
#     - 실제 이미지 파일 테스트
#     - 엣지 케이스 및 상세 유효성 검사 강화
#     """
#
#     @classmethod
#     def setUpClass(cls):
#         """테스트 클래스 전체에 한 번만 실행되는 설정"""
#         super().setUpClass()
#         # 미디어 디렉토리가 없으면 생성
#         if not os.path.exists(settings.MEDIA_ROOT):
#             os.makedirs(settings.MEDIA_ROOT)
#         logger.info("=" * 70)
#         logger.info("schedules 앱 통합 테스트 (v4) 시작")
#         logger.info("=" * 70)
#
#     def setUp(self):
#         """각 테스트 시작 전에 실행되는 공통 데이터 설정"""
#         self.client = APIClient()
#         self.super_admin = User.objects.create_user(username='super_admin', password='password', role='super_admin',
#                                                     is_approved=True, last_name_kr='김', first_name_kr='총괄')
#         self.manager1 = User.objects.create_user(username='manager1', password='password', role='manager',
#                                                  is_approved=True, last_name_kr='이', first_name_kr='담당')
#         self.manager2 = User.objects.create_user(username='manager2', password='password', role='manager',
#                                                  is_approved=True, last_name_kr='박', first_name_kr='부담당')
#         self.unapproved_user = User.objects.create_user(username='unapproved', password='password', role='manager',
#                                                         is_approved=False)
#         self.trip1 = Trip.objects.create(title='manager1의 제주 여행', destination='제주도', start_date=date(2025, 11, 1),
#                                          end_date=date(2025, 11, 3), manager=self.manager1)
#         self.trip2 = Trip.objects.create(title='manager2의 부산 여행', destination='부산', start_date=date(2025, 12, 5),
#                                          end_date=date(2025, 12, 7), manager=self.manager2)
#         self.category_food = PlaceCategory.objects.create(name='음식점')
#         self.category_tour = PlaceCategory.objects.create(name='관광지')
#         self.place1 = Place.objects.create(name='흑돈가', category=self.category_food, address='제주 제주시',
#                                            activity_time=timedelta(hours=1, minutes=30))
#         self.place2 = Place.objects.create(name='성산일출봉', category=self.category_tour, address='제주 서귀포시',
#                                            entrance_fee=3000)
#         self.role_guide = CoordinatorRole.objects.create(name='가이드')
#         self.role_driver = CoordinatorRole.objects.create(name='운전기사')
#         self.expense1 = OptionalExpense.objects.create(place=self.place1, item_name='흑돼지 2인 세트', price=50000)
#         self.expense2 = OptionalExpense.objects.create(place=self.place2, item_name='오디오 가이드', price=3000)
#         self.schedule1 = Schedule.objects.create(trip=self.trip1, day_number=1, order=1, place=self.place1,
#                                                  start_time=time(12, 0), end_time=time(13, 30))
#
#     def _generate_dummy_image(self):
#         """테스트용 임시 이미지 파일을 생성합니다."""
#         file = BytesIO()
#         image = Image.new('RGB', (100, 100), 'white')
#         image.save(file, 'jpeg')
#         file.name = 'test.jpg'
#         file.seek(0)
#         return SimpleUploadedFile(file.name, file.read(), content_type='image/jpeg')
#
#     # ======================================================================
#     # PART 1: 권한 검증 (기존 5개 + 2개 추가 = 총 7개)
#     # ======================================================================
#
#     def test_01_unauthenticated_access_denied(self):
#         """01: 비로그인 사용자는 일정 API 접근 불가"""
#         logger.info("--- 01: 비로그인 접근 차단 테스트 시작 ---")
#         url = reverse('schedule-list-create', kwargs={'trip_id': self.trip1.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
#         logger.info("✅ 01: 비로그인 접근 차단 성공")
#
#     def test_02_unapproved_user_access_denied(self):
#         """02: 미승인 사용자는 일정 API 접근 불가"""
#         logger.info("--- 02: 미승인 사용자 접근 차단 테스트 시작 ---")
#         self.client.force_authenticate(user=self.unapproved_user)
#         url = reverse('schedule-list-create', kwargs={'trip_id': self.trip1.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
#         logger.info("✅ 02: 미승인 사용자 접근 차단 성공")
#
#     def test_03_manager_cannot_access_others_trip(self):
#         """03: 담당자는 다른 담당자의 여행 일정에 접근 불가"""
#         logger.info("--- 03: 담당자 상호 접근 차단 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('schedule-list-create', kwargs={'trip_id': self.trip2.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
#         logger.info("✅ 03: 담당자 상호 접근 차단 성공")
#
#     def test_04_super_admin_can_access_any_trip(self):
#         """04: 총괄담당자는 모든 여행 일정에 접근 가능"""
#         logger.info("--- 04: 총괄담당자 접근 권한 테스트 시작 ---")
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('schedule-list-create', kwargs={'trip_id': self.trip1.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         logger.info("✅ 04: 총괄담당자 접근 권한 확인 성공")
#
#     def test_05_manager_cannot_modify_others_schedule(self):
#         """05: 담당자는 다른 담당자의 일정을 수정/삭제 불가"""
#         logger.info("--- 05: 담당자 상호 수정/삭제 차단 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager2)
#         url = reverse('schedule-detail-action', kwargs={'trip_id': self.trip1.id, 'schedule_id': self.schedule1.id})
#         response = self.client.delete(url)
#         self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
#         logger.info("✅ 05: 담당자 상호 수정/삭제 차단 성공")
#
#     def test_42_place_api_requires_authentication(self):
#         """42: 장소 API는 인증이 필요함"""
#         logger.info("--- 42: 장소 API 인증 필요 테스트 시작 ---")
#         url = reverse('place-list-create')
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
#         logger.info("✅ 42: 장소 API 비로그인 접근 차단 성공")
#
#     def test_43_expense_api_requires_authentication(self):
#         """43: 선택 비용 API는 인증이 필요함"""
#         logger.info("--- 43: 선택 비용 API 인증 필요 테스트 시작 ---")
#         url = reverse('expense-list-create', kwargs={'place_id': self.place1.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
#         logger.info("✅ 43: 선택 비용 API 비로그인 접근 차단 성공")
#
#     # ======================================================================
#     # PART 2: 일정(Schedule) CRUD & 유효성 검사 (기존 8개 + 4개 추가 = 총 12개)
#     # ======================================================================
#
#     def test_06_create_schedule_success(self):
#         """06: 담당자가 자기 여행에 일정 생성 성공"""
#         logger.info("--- 06: 일정 생성 성공 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('schedule-list-create', kwargs={'trip_id': self.trip1.id})
#         data = {"day_number": 1, "order": 2, "place": self.place2.id, "start_time": "15:00", "end_time": "17:00"}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_201_CREATED)
#         self.assertEqual(response.data['duration_minutes'], 120)
#         logger.info(f"생성된 일정 ID: {response.data['id']}, 자동 계산된 소요 시간: {response.data['duration_minutes']}분")
#         logger.info("✅ 06: 일정 생성 성공")
#
#     def test_07_list_schedules(self):
#         """07: 특정 여행의 일정 목록 조회"""
#         logger.info("--- 07: 일정 목록 조회 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('schedule-list-create', kwargs={'trip_id': self.trip1.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(len(response.data), 1)
#         logger.info(f"조회된 일정 수: {len(response.data)}개")
#         logger.info("✅ 07: 일정 목록 조회 성공")
#
#     def test_08_schedule_detail(self):
#         """08: 특정 일정 상세 조회"""
#         logger.info("--- 08: 일정 상세 조회 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('schedule-detail-action', kwargs={'trip_id': self.trip1.id, 'schedule_id': self.schedule1.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(response.data['id'], self.schedule1.id)
#         logger.info(f"조회된 일정 상세 정보: {response.data}")
#         logger.info("✅ 08: 일정 상세 조회 성공")
#
#     def test_09_update_schedule_patch(self):
#         """09: PATCH로 일정 부분 수정"""
#         logger.info("--- 09: 일정 부분 수정(PATCH) 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('schedule-detail-action', kwargs={'trip_id': self.trip1.id, 'schedule_id': self.schedule1.id})
#         data = {'main_content': '흑돼지 맛집 탐방'}
#         response = self.client.patch(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(response.data['main_content'], '흑돼지 맛집 탐방')
#         logger.info(f"수정 후 내용: {response.data['main_content']}")
#         logger.info("✅ 09: 일정 부분 수정(PATCH) 성공")
#
#     def test_10_delete_schedule(self):
#         """10: 일정 삭제"""
#         logger.info("--- 10: 일정 삭제 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('schedule-detail-action', kwargs={'trip_id': self.trip1.id, 'schedule_id': self.schedule1.id})
#         response = self.client.delete(url)
#         self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
#         self.assertFalse(Schedule.objects.filter(id=self.schedule1.id).exists())
#         logger.info(f"ID {self.schedule1.id} 일정 삭제 확인")
#         logger.info("✅ 10: 일정 삭제 성공")
#
#     def test_11_create_schedule_with_invalid_time(self):
#         """11: 유효성 검사 - 종료 시간이 시작 시간보다 빠를 때 생성 실패"""
#         logger.info("--- 11: 유효성 검사 - 잘못된 시간 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('schedule-list-create', kwargs={'trip_id': self.trip1.id})
#         data = {"day_number": 2, "order": 1, "start_time": "14:00", "end_time": "13:00"}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#         logger.info(f"서버 응답: {response.data}")
#         logger.info("✅ 11: 유효성 검사 - 잘못된 시간 성공")
#
#     def test_12_create_schedule_with_negative_day_number(self):
#         """12: 유효성 검사 - 일차가 음수일 때 생성 실패"""
#         logger.info("--- 12: 유효성 검사 - 음수 일차 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('schedule-list-create', kwargs={'trip_id': self.trip1.id})
#         data = {"day_number": -1, "order": 1, "start_time": "10:00", "end_time": "11:00"}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#         logger.info(f"서버 응답: {response.data}")
#         logger.info("✅ 12: 유효성 검사 - 음수 일차 성공")
#
#     def test_13_create_schedule_duplicate_order(self):
#         """13: 유효성 검사 - 같은 날, 같은 순서로 중복 생성 불가"""
#         logger.info("--- 13: 유효성 검사 - 중복 순서 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('schedule-list-create', kwargs={'trip_id': self.trip1.id})
#         data = {"day_number": 1, "order": 1, "start_time": "19:00", "end_time": "21:00"}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#         self.assertIn('non_field_errors', response.data)
#         logger.info(f"서버 응답: {response.data}")
#         logger.info("✅ 13: 유효성 검사 - 중복 순서(unique_together) 성공")
#
#     def test_44_schedule_response_has_place_name(self):
#         """44: 일정 상세 응답에 장소 이름(place_name) 필드 포함 확인"""
#         logger.info("--- 44: 일정 응답 필드(place_name) 확인 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('schedule-detail-action', kwargs={'trip_id': self.trip1.id, 'schedule_id': self.schedule1.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertIn('place_name', response.data)
#         self.assertEqual(response.data['place_name'], self.place1.name)
#         logger.info(f"응답 내 place_name: {response.data.get('place_name')}")
#         logger.info("✅ 44: 일정 응답 필드(place_name) 확인 성공")
#
#     def test_45_create_schedule_without_place(self):
#         """45: 장소(place) 없이 일정 생성 (null=True, blank=True)"""
#         logger.info("--- 45: 장소 없이 일정 생성 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('schedule-list-create', kwargs={'trip_id': self.trip1.id})
#         data = {"day_number": 2, "order": 1, "start_time": "09:00", "end_time": "10:00", "main_content": "자유시간"}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_201_CREATED)
#         self.assertIsNone(response.data['place'])
#         logger.info(f"장소 없이 생성된 일정 ID: {response.data['id']}")
#         logger.info("✅ 45: 장소 없이 일정 생성 성공")
#
#     def test_46_update_schedule_with_put(self):
#         """46: PUT으로 일정 전체 수정 (모든 필드 제공)"""
#         logger.info("--- 46: 일정 전체 수정(PUT) 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('schedule-detail-action', kwargs={'trip_id': self.trip1.id, 'schedule_id': self.schedule1.id})
#         data = {
#             "day_number": 1,
#             "order": 1,
#             "start_time": "12:30",
#             "end_time": "14:00",
#             "place": self.place1.id,
#             "transport": "도보",
#             "main_content": "점심 식사",
#             "meeting_point": "식당 앞",
#             "budget": 50000
#         }
#         response = self.client.put(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(response.data['budget'], 50000)
#         self.assertEqual(response.data['start_time'], '12:30:00')
#         logger.info(f"PUT으로 수정된 일정 정보: {response.data}")
#         logger.info("✅ 46: 일정 전체 수정(PUT) 성공")
#
#     def test_47_create_schedule_with_invalid_data_type(self):
#         """47: 유효성 검사 - 잘못된 데이터 타입으로 일정 생성 시도"""
#         logger.info("--- 47: 잘못된 데이터 타입으로 일정 생성 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('schedule-list-create', kwargs={'trip_id': self.trip1.id})
#         data = {"day_number": "이틀째", "order": "첫번째", "start_time": "10:00", "end_time": "11:00"}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#         logger.info(f"서버 응답: {response.data}")
#         logger.info("✅ 47: 잘못된 데이터 타입으로 일정 생성 차단 성공")
#
#     # ======================================================================
#     # PART 3: 장소(Place) CRUD & 유효성 검사 (기존 9개 + 6개 추가 = 총 15개)
#     # ======================================================================
#     def test_14_list_places(self):
#         """14: 장소 목록 조회"""
#         logger.info("--- 14: 장소 목록 조회 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('place-list-create')
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(len(response.data), 2)
#         logger.info(f"조회된 장소 수: {len(response.data)}개")
#         logger.info("✅ 14: 장소 목록 조회 성공")
#
#     def test_15_create_place_with_real_image_success(self):
#         """15: (수정) 실제 이미지 파일로 새 장소 생성 성공"""
#         logger.info("--- 15: 실제 이미지로 장소 생성 테스트 시작 ---")
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('place-list-create')
#         image = self._generate_dummy_image()
#         data = {"name": "한라산", "category_id": self.category_tour.id, "image": image}
#
#         response = self.client.post(url, data, format='multipart')
#         self.assertEqual(response.status_code, status.HTTP_201_CREATED, msg=f"응답 내용: {response.data}")
#
#         new_place = Place.objects.get(name="한라산")
#         self.assertTrue(new_place.image.name.startswith('places/한라산/'))
#         self.assertTrue(new_place.image.name.endswith('.jpg'))
#
#         # 테스트 후 생성된 이미지 파일 삭제
#         image_path = os.path.join(settings.MEDIA_ROOT, new_place.image.name)
#         if os.path.exists(image_path):
#             os.remove(image_path)
#             logger.info(f"테스트 이미지 파일 삭제: {image_path}")
#
#         logger.info(f"생성된 장소: {response.data}")
#         logger.info("✅ 15: 장소 생성(이미지 포함) 성공")
#
#     def test_16_create_place_with_non_existent_category(self):
#         """16: 유효성 검사 - 존재하지 않는 카테고리 ID로 장소 생성 실패"""
#         logger.info("--- 16: 존재하지 않는 카테고리 ID 테스트 시작 ---")
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('place-list-create')
#         data = {"name": "없는 카테고리 장소", "category_id": 9999}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#         logger.info(f"서버 응답: {response.data}")
#         logger.info("✅ 16: 유효성 검사 - 존재하지 않는 카테고리 ID 성공")
#
#     def test_17_place_detail(self):
#         """17: 특정 장소 상세 정보 조회"""
#         logger.info("--- 17: 장소 상세 조회 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('place-detail-action', kwargs={'place_id': self.place1.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(response.data['name'], '흑돈가')
#         logger.info(f"조회된 장소 정보: {response.data}")
#         logger.info("✅ 17: 장소 상세 조회 성공")
#
#     def test_18_update_place(self):
#         """18: 장소 정보 수정"""
#         logger.info("--- 18: 장소 정보 수정 테스트 시작 ---")
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('place-detail-action', kwargs={'place_id': self.place2.id})
#         data = {'entrance_fee': 5000, 'name': '성산일출봉(수정)'}
#         response = self.client.patch(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(response.data['entrance_fee'], 5000)
#         logger.info(f"수정된 장소 정보: {response.data}")
#         logger.info("✅ 18: 장소 정보 수정 성공")
#
#     def test_19_delete_place_and_check_schedule(self):
#         """19: 장소 삭제 시 연결된 일정의 place 필드가 NULL로 변경되는지 확인"""
#         logger.info("--- 19: 장소 삭제 후 SET_NULL 동작 확인 테스트 시작 ---")
#         self.client.force_authenticate(user=self.super_admin)
#         logger.info(f"삭제 전 schedule1.place: {self.schedule1.place}")
#         url = reverse('place-detail-action', kwargs={'place_id': self.place1.id})
#         response = self.client.delete(url)
#         self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
#         self.schedule1.refresh_from_db()
#         self.assertIsNone(self.schedule1.place)
#         logger.info(f"삭제 후 schedule1.place: {self.schedule1.place}")
#         logger.info("✅ 19: 장소 삭제 후 SET_NULL 동작 확인 성공")
#
#     def test_20_list_place_categories(self):
#         """20: 장소 카테고리 목록 조회"""
#         logger.info("--- 20: 장소 카테고리 목록 조회 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('list-categories')
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(len(response.data), 2)
#         logger.info(f"조회된 카테고리 목록: {response.data}")
#         logger.info("✅ 20: 장소 카테고리 목록 조회 성공")
#
#     def test_21_delete_category_in_use(self):
#         """21: 사용 중인 카테고리 삭제 시 장소의 category 필드가 NULL로 변경되는지 확인"""
#         logger.info("--- 21: 사용 중 카테고리 삭제 후 SET_NULL 동작 확인 테스트 시작 ---")
#         logger.info(f"삭제 전 place1.category: {self.place1.category}")
#         self.category_food.delete()
#         self.place1.refresh_from_db()
#         self.assertIsNone(self.place1.category)
#         logger.info(f"삭제 후 place1.category: {self.place1.category}")
#         logger.info("✅ 21: 사용 중인 카테고리 삭제 후 SET_NULL 동작 확인 성공")
#
#     def test_22_create_place_with_negative_fee(self):
#         """22: 유효성 검사 - 입장료를 음수로 입력 시 생성 실패"""
#         logger.info("--- 22: 유효성 검사 - 음수 입장료 테스트 시작 ---")
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('place-list-create')
#         data = {"name": "음수 입장료", "entrance_fee": -1000}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#         logger.info(f"서버 응답: {response.data}")
#         logger.info("✅ 22: 유효성 검사 - 음수 입장료 성공")
#
#     def test_48_place_detail_response_contains_display_fields(self):
#         """48: 장소 상세 응답에 _display 필드(입장료, 활동 시간) 포함 확인"""
#         logger.info("--- 48: 장소 응답 _display 필드 확인 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('place-detail-action', kwargs={'place_id': self.place1.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertIn('entrance_fee_display', response.data)
#         self.assertIn('activity_time_display', response.data)
#         self.assertEqual(response.data['activity_time_display'], '1시간 30분')
#         logger.info(
#             f"응답 내 display 필드: entrance_fee_display='{response.data['entrance_fee_display']}', activity_time_display='{response.data['activity_time_display']}'")
#         logger.info("✅ 48: 장소 응답 _display 필드 확인 성공")
#
#     def test_49_create_place_without_category(self):
#         """49: 카테고리 없이 장소 생성 (null=True, blank=True)"""
#         logger.info("--- 49: 카테고리 없이 장소 생성 테스트 시작 ---")
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('place-list-create')
#         data = {"name": "미분류 장소", "address": "주소 없음"}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_201_CREATED)
#         self.assertIsNone(response.data['category'])
#         logger.info(f"카테고리 없이 생성된 장소: {response.data}")
#         logger.info("✅ 49: 카테고리 없이 장소 생성 성공")
#
#     def test_50_update_place_category(self):
#         """50: 장소의 카테고리 변경"""
#         logger.info("--- 50: 장소 카테고리 변경 테스트 시작 ---")
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('place-detail-action', kwargs={'place_id': self.place1.id})
#         logger.info(f"변경 전 카테고리 ID: {self.place1.category.id}")
#         data = {'category_id': self.category_tour.id}
#         response = self.client.patch(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(response.data['category']['id'], self.category_tour.id)
#         logger.info(f"변경 후 카테고리 ID: {response.data['category']['id']}")
#         logger.info("✅ 50: 장소 카테고리 변경 성공")
#
#     def test_51_place_model_str_representation(self):
#         """51: Place 모델의 __str__ 메서드 작동 확인"""
#         logger.info("--- 51: Place 모델 __str__ 메서드 테스트 시작 ---")
#         self.assertEqual(str(self.place1), f"{self.place1.name} ({self.place1.category.name})")
#         place_no_cat = Place.objects.create(name="카테고리 없는 곳")
#         self.assertEqual(str(place_no_cat), place_no_cat.name)
#         logger.info(f"Place 1 __str__: {str(self.place1)}")
#         logger.info(f"Place (no cat) __str__: {str(place_no_cat)}")
#         logger.info("✅ 51: Place 모델 __str__ 메서드 확인 성공")
#
#     def test_52_get_alternative_place_info_parsing(self):
#         """52: AI 대체 장소 정보 파싱 메서드(get_alternative_place_info) 테스트"""
#         logger.info("--- 52: AI 대체 장소 정보 파싱 테스트 시작 ---")
#         place_with_ai_info = Place.objects.create(
#             name="AI 정보 장소",
#             ai_alternative_place={"place_name": "국립중앙박물관", "reason": "우천 시 대체"}
#         )
#         info = place_with_ai_info.get_alternative_place_info()
#         self.assertIsNotNone(info)
#         self.assertEqual(info['place_name'], "국립중앙박물관")
#
#         place_no_ai_info = Place.objects.create(name="AI 정보 없는 장소")
#         self.assertIsNone(place_no_ai_info.get_alternative_place_info())
#         logger.info(f"파싱된 정보: {info}")
#         logger.info("✅ 52: AI 대체 장소 정보 파싱 성공")
#
#     def test_53_create_place_with_ai_json_data(self):
#         """53: AI 관련 JSON 필드를 포함하여 장소 생성"""
#         logger.info("--- 53: AI JSON 필드 포함 장소 생성 테스트 시작 ---")
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('place-list-create')
#         ai_data = {"place_name": "대체 장소", "reason": "테스트"}
#         data = {"name": "AI 장소", "ai_alternative_place": ai_data}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_201_CREATED)
#         self.assertEqual(response.data['ai_alternative_place']['place_name'], "대체 장소")
#         logger.info(f"생성된 장소의 AI 정보: {response.data['ai_alternative_place']}")
#         logger.info("✅ 53: AI JSON 필드 포함 장소 생성 성공")
#
#     # ======================================================================
#     # PART 4: 선택 비용(Optional Expense) CRUD & 유효성 검사 (기존 7개 + 4개 추가 = 총 11개)
#     # ======================================================================
#     def test_23_list_expenses_for_place(self):
#         """23: 특정 장소의 선택 비용 목록 조회"""
#         logger.info("--- 23: 선택 비용 목록 조회 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('expense-list-create', kwargs={'place_id': self.place2.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(len(response.data), 1)
#         logger.info(f"조회된 선택 비용 수: {len(response.data)}개")
#         logger.info("✅ 23: 선택 비용 목록 조회 성공")
#
#     def test_24_create_expense_for_place(self):
#         """24: 특정 장소에 선택 비용 항목 추가"""
#         logger.info("--- 24: 선택 비용 항목 추가 테스트 시작 ---")
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('expense-list-create', kwargs={'place_id': self.place1.id})
#         data = {"item_name": "계란찜", "price": 2000}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_201_CREATED, msg=f"응답 내용: {response.data}")
#         self.assertEqual(OptionalExpense.objects.filter(place=self.place1).count(), 2)
#         logger.info(f"생성된 선택 비용: {response.data}")
#         logger.info("✅ 24: 선택 비용 항목 추가 성공")
#
#     def test_25_create_expense_with_negative_price(self):
#         """25: 유효성 검사 - 가격을 음수로 입력 시 생성 실패"""
#         logger.info("--- 25: 유효성 검사 - 음수 가격 테스트 시작 ---")
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('expense-list-create', kwargs={'place_id': self.place1.id})
#         data = {"item_name": "마이너스 비용", "price": -5000}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#         logger.info(f"서버 응답: {response.data}")
#         logger.info("✅ 25: 유효성 검사 - 음수 가격 성공")
#
#     def test_26_calculate_expenses_success(self):
#         """26: 선택 비용 계산 API 성공"""
#         logger.info("--- 26: 선택 비용 계산 성공 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('calculate-expense')
#         data = {"expense_ids": [self.expense1.id, self.expense2.id]}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(response.data['total'], 53000)
#         logger.info(f"계산 결과: {response.data}")
#         logger.info("✅ 26: 선택 비용 계산 성공")
#
#     def test_27_calculate_expenses_with_non_existent_id(self):
#         """27: 존재하지 않는 ID 포함하여 비용 계산 시도"""
#         logger.info("--- 27: 예외 처리 - 존재하지 않는 ID로 비용 계산 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('calculate-expense')
#         data = {"expense_ids": [self.expense1.id, 9999]}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(response.data['total'], 50000)
#         logger.info(f"존재하지 않는 ID 포함 계산 결과: {response.data}")
#         logger.info("✅ 27: 예외 처리 - 존재하지 않는 ID로 비용 계산 성공")
#
#     def test_28_calculate_expenses_with_empty_list(self):
#         """28: 빈 리스트로 비용 계산 시도"""
#         logger.info("--- 28: 예외 처리 - 빈 리스트로 비용 계산 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('calculate-expense')
#         data = {"expense_ids": []}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#         logger.info(f"서버 응답: {response.data}")
#         logger.info("✅ 28: 예외 처리 - 빈 리스트로 비용 계산 성공")
#
#     def test_29_delete_place_cascades_to_expenses(self):
#         """29: 장소 삭제 시 연결된 선택 비용 항목도 연쇄 삭제되는지 확인"""
#         logger.info("--- 29: 장소 삭제 시 선택 비용 연쇄 삭제(CASCADE) 테스트 시작 ---")
#         self.assertTrue(OptionalExpense.objects.filter(id=self.expense1.id).exists())
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('place-detail-action', kwargs={'place_id': self.place1.id})
#         self.client.delete(url)
#         self.assertFalse(OptionalExpense.objects.filter(id=self.expense1.id).exists())
#         logger.info(f"ID {self.expense1.id} 선택 비용 항목 삭제 확인")
#         logger.info("✅ 29: 장소 삭제 시 선택 비용 연쇄 삭제(CASCADE) 확인 성공")
#     #
#     # def test_54_calculate_expenses_with_invalid_data_type(self):
#     #     """54: 유효성 검사 - 잘못된 데이터 타입으로 비용 계산 시도"""
#     #     logger.info("--- 54: 잘못된 데이터 타입으로 비용 계산 테스트 시작 ---")
#     #     self.client.force_authenticate(user=self.manager1)
#     #     url = reverse('calculate-expense')
#     #     data = {"expense_ids": ["하나", "둘"]}
#     #     response = self.client.post(url, data, format='json')
#     #     self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#     #     logger.info(f"서버 응답: {response.data}")
#     #     logger.info("✅ 54: 잘못된 데이터 타입으로 비용 계산 차단 성공")
#
#     def test_55_expense_response_has_price_display(self):
#         """55: 선택 비용 응답에 포맷된 가격(price_display) 필드 포함 확인"""
#         logger.info("--- 55: 선택 비용 응답 필드(price_display) 확인 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('expense-list-create', kwargs={'place_id': self.place1.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertIn('price_display', response.data[0])
#         self.assertEqual(response.data[0]['price_display'], f"{self.expense1.price:,}원")
#         logger.info(f"응답 내 price_display: {response.data[0]['price_display']}")
#         logger.info("✅ 55: 선택 비용 응답 필드(price_display) 확인 성공")
#
#     def test_56_create_expense_for_non_existent_place(self):
#         """56: 존재하지 않는 장소에 선택 비용 추가 시도"""
#         logger.info("--- 56: 존재하지 않는 장소에 선택 비용 추가 테스트 시작 ---")
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('expense-list-create', kwargs={'place_id': 9999})
#         data = {"item_name": "유령 비용", "price": 1000}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
#         logger.info("✅ 56: 존재하지 않는 장소에 선택 비용 추가 차단 성공")
#
#     def test_57_optional_expense_ordering(self):
#         """57: 선택 비용 항목 정렬 순서(가격, display_order) 확인"""
#         logger.info("--- 57: 선택 비용 정렬 순서 테스트 시작 ---")
#         OptionalExpense.objects.create(place=self.place1, item_name='물티슈', price=1000, display_order=2)
#         OptionalExpense.objects.create(place=self.place1, item_name='음료수', price=2000, display_order=1)
#         OptionalExpense.objects.create(place=self.place1, item_name='공기밥', price=1000, display_order=1)
#
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('expense-list-create', kwargs={'place_id': self.place1.id})
#         response = self.client.get(url)
#
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         # 정렬 순서: place -> price -> display_order
#         # 1000원(공기밥, order 1) -> 1000원(물티슈, order 2) -> 2000원(음료수, order 1) -> 50000원(세트)
#         item_names = [item['item_name'] for item in response.data]
#         self.assertEqual(item_names, ['공기밥', '물티슈', '음료수', '흑돼지 2인 세트'])
#         logger.info(f"정렬된 항목명: {item_names}")
#         logger.info("✅ 57: 선택 비용 정렬 순서 확인 성공")
#
#     # ======================================================================
#     # PART 5: 장소 담당자(Coordinator) CRUD & 유효성 검사 (기존 12개 + 8개 추가 = 총 20개)
#     # ======================================================================
#     def test_30_list_coordinator_roles(self):
#         """30: 담당자 역할 목록 조회"""
#         logger.info("--- 30: 담당자 역할 목록 조회 테스트 시작 ---")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('list-coordinator-roles')
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(len(response.data), 2)
#         logger.info(f"조회된 담당자 역할 수: {len(response.data)}")
#         logger.info("✅ 30: 담당자 역할 목록 조회 성공")
#
#     def test_31_create_coordinator_success(self):
#         """31: 장소에 담당자 배정 성공"""
#         logger.info("--- 31: 장소 담당자 배정 성공 테스트 시작 ---")
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('coordinator-list-create', kwargs={'place_id': self.place2.id})
#         data = {"role_id": self.role_guide.id, "name": "나신입", "phone": "010-9876-5432"}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_201_CREATED, msg=f"응답 내용: {response.data}")
#         self.assertEqual(response.data['name'], "나신입")
#         logger.info(f"생성된 담당자 정보: {response.data}")
#         logger.info("✅ 31: 장소 담당자 배정 성공")
#
#     def test_32_list_coordinators_for_place(self):
#         """32: 장소별 담당자 목록 조회"""
#         logger.info("--- 32: 장소별 담당자 목록 조회 테스트 시작 ---")
#         PlaceCoordinator.objects.create(place=self.place2, role=self.role_guide, name="임시가이드", phone="123")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('coordinator-list-create', kwargs={'place_id': self.place2.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(len(response.data), 1)
#         logger.info(f"조회된 담당자 목록: {response.data}")
#         logger.info("✅ 32: 장소별 담당자 목록 조회 성공")
#
#     def test_33_create_coordinator_with_non_existent_role(self):
#         """33: 유효성 검사 - 존재하지 않는 역할 ID로 담당자 생성 실패"""
#         logger.info("--- 33: 유효성 검사 - 존재하지 않는 역할 ID 테스트 시작 ---")
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('coordinator-list-create', kwargs={'place_id': self.place2.id})
#         data = {"role_id": 9999, "name": "유령", "phone": "010-0000-0000"}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#         logger.info(f"서버 응답: {response.data}")
#         logger.info("✅ 33: 유효성 검사 - 존재하지 않는 역할 ID 성공")
#
#     def test_34_create_coordinator_missing_name(self):
#         """34: 유효성 검사 - 필수 필드(name) 누락 시 생성 실패"""
#         logger.info("--- 34: 유효성 검사 - 필수 필드 누락 테스트 시작 ---")
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('coordinator-list-create', kwargs={'place_id': self.place2.id})
#         data = {"role_id": self.role_guide.id, "phone": "010-1111-2222"}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#         logger.info(f"서버 응답: {response.data}")
#         logger.info("✅ 34: 유효성 검사 - 필수 필드 누락 성공")
#
#     def test_35_delete_place_cascades_to_coordinators(self):
#         """35: 장소 삭제 시 연결된 담당자도 연쇄 삭제되는지 확인"""
#         logger.info("--- 35: 장소 삭제 시 담당자 연쇄 삭제(CASCADE) 테스트 시작 ---")
#         coordinator = PlaceCoordinator.objects.create(place=self.place1, role=self.role_driver, name='베스트', phone='111')
#         self.assertTrue(PlaceCoordinator.objects.filter(id=coordinator.id).exists())
#
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('place-detail-action', kwargs={'place_id': self.place1.id})
#         self.client.delete(url)
#         self.assertFalse(PlaceCoordinator.objects.filter(id=coordinator.id).exists())
#         logger.info(f"ID {coordinator.id} 담당자 삭제 확인")
#         logger.info("✅ 35: 장소 삭제 시 담당자 연쇄 삭제(CASCADE) 확인 성공")
#
#     def test_36_delete_coordinator_role_in_use_fail(self):
#         """36: 사용 중인 담당자 역할 삭제 시도 (PROTECT)"""
#         logger.info("--- 36: 사용 중인 역할 삭제 방지(PROTECT) 테스트 시작 ---")
#         PlaceCoordinator.objects.create(place=self.place1, role=self.role_guide, name='테스터', phone='123')
#         with self.assertRaises(ProtectedError):
#             self.role_guide.delete()
#         logger.info("ProtectedError 발생 확인")
#         logger.info("✅ 36: 사용 중인 역할 삭제 방지(PROTECT) 확인 성공")
#
#     def test_37_add_multiple_coordinators_to_place(self):
#         """37: 한 장소에 여러 역할의 담당자 배정"""
#         logger.info("--- 37: 한 장소에 여러 담당자 배정 테스트 시작 ---")
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('coordinator-list-create', kwargs={'place_id': self.place1.id})
#
#         response1 = self.client.post(url, {"role_id": self.role_guide.id, "name": "가이드김", "phone": "010-1111-1111"})
#         self.assertEqual(response1.status_code, status.HTTP_201_CREATED, msg=f"첫 번째 담당자 생성 실패: {response1.data}")
#         logger.info("첫 번째 담당자(가이드김) 생성 성공")
#
#         response2 = self.client.post(url, {"role_id": self.role_driver.id, "name": "운전박", "phone": "010-2222-2222"})
#         self.assertEqual(response2.status_code, status.HTTP_201_CREATED, msg=f"두 번째 담당자 생성 실패: {response2.data}")
#         logger.info("두 번째 담당자(운전박) 생성 성공")
#
#         self.assertEqual(PlaceCoordinator.objects.filter(place=self.place1).count(), 2)
#         logger.info(f"{self.place1.name}에 배정된 담당자 수: {PlaceCoordinator.objects.filter(place=self.place1).count()}명")
#         logger.info("✅ 37: 한 장소에 여러 담당자 배정 성공")
#
#     def test_38_coordinator_api_for_non_existent_place(self):
#         """38: 존재하지 않는 장소에 담당자 생성/조회 시도"""
#         logger.info("--- 38: 존재하지 않는 장소의 담당자 API 테스트 시작 ---")
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('coordinator-list-create', kwargs={'place_id': 9999})
#         response_get = self.client.get(url)
#         self.assertEqual(response_get.status_code, status.HTTP_404_NOT_FOUND)
#         logger.info("GET 요청에 404 Not Found 확인")
#
#         response_post = self.client.post(url, {"role_id": self.role_guide.id, "name": "담당자", "phone": "123"})
#         self.assertEqual(response_post.status_code, status.HTTP_404_NOT_FOUND)
#         logger.info("POST 요청에 404 Not Found 확인")
#         logger.info("✅ 38: 예외 처리 - 존재하지 않는 장소의 담당자 API 성공")
#
#     def test_39_update_coordinator_info_not_implemented(self):
#         """39: 장소 담당자 정보 수정 (별도 API 미구현 시나리오)"""
#         logger.info("--- 39: 담당자 수정/삭제 API 미구현 확인 시작 ---")
#         print("ℹ️ 39: 담당자 수정/삭제 API는 현재 미구현 상태")
#         logger.info("✅ 39: 담당자 수정/삭제 API 미구현 확인 완료")
#         pass
#
#     def test_40_delete_coordinator_info_not_implemented(self):
#         """40: 장소 담당자 정보 삭제 (별도 API 미구현 시나리오)"""
#         logger.info("--- 40: 담당자 수정/삭제 API 미구현 확인 시작 ---")
#         print("ℹ️ 40: 담당자 수정/삭제 API는 현재 미구현 상태")
#         logger.info("✅ 40: 담당자 수정/삭제 API 미구현 확인 완료")
#         pass
#
#     def test_41_schedule_detail_wrong_trip_id(self):
#         """41: URL의 trip_id와 schedule의 실제 trip_id가 다를 경우 404 반환"""
#         logger.info("--- 41: 예외 처리 - URL의 trip_id 불일치 테스트 시작 ---")
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('schedule-detail-action', kwargs={'trip_id': self.trip2.id, 'schedule_id': self.schedule1.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
#         logger.info("GET 요청에 404 Not Found 확인")
#         logger.info("✅ 41: 예외 처리 - URL의 trip_id 불일치 성공")
#
#     def test_58_coordinator_response_has_nested_role_info(self):
#         """58: 담당자 목록 응답에 역할(role) 정보가 중첩되어 포함되는지 확인"""
#         logger.info("--- 58: 담당자 응답 중첩 역할 정보 확인 테스트 시작 ---")
#         PlaceCoordinator.objects.create(place=self.place1, role=self.role_guide, name='테스트가이드', phone='123')
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('coordinator-list-create', kwargs={'place_id': self.place1.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertIn('role', response.data[0])
#         self.assertIsInstance(response.data[0]['role'], dict)
#         self.assertEqual(response.data[0]['role']['name'], self.role_guide.name)
#         logger.info(f"응답 내 중첩된 role 정보: {response.data[0]['role']}")
#         logger.info("✅ 58: 담당자 응답 중첩 역할 정보 확인 성공")
#
#     def test_59_create_coordinator_with_same_role_and_place(self):
#         """59: 한 장소에 같은 역할의 담당자를 여러 명 추가"""
#         logger.info("--- 59: 한 장소에 동일 역할 담당자 중복 추가 테스트 시작 ---")
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('coordinator-list-create', kwargs={'place_id': self.place1.id})
#         self.client.post(url, {"role_id": self.role_guide.id, "name": "김가이드", "phone": "010-1111-1111"})
#         self.client.post(url, {"role_id": self.role_guide.id, "name": "이가이드", "phone": "010-2222-2222"})
#         self.assertEqual(PlaceCoordinator.objects.filter(place=self.place1, role=self.role_guide).count(), 2)
#         logger.info(
#             f"{self.place1.name}의 가이드 수: {PlaceCoordinator.objects.filter(place=self.place1, role=self.role_guide).count()}명")
#         logger.info("✅ 59: 한 장소에 동일 역할 담당자 중복 추가 성공")
#
#     def test_60_empty_coordinator_list_for_new_place(self):
#         """60: 새로 생성된 장소의 담당자 목록은 비어 있음"""
#         logger.info("--- 60: 새 장소의 빈 담당자 목록 확인 테스트 시작 ---")
#         new_place = Place.objects.create(name="새로운 장소")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('coordinator-list-create', kwargs={'place_id': new_place.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(len(response.data), 0)
#         logger.info("새 장소의 담당자 목록이 비어 있음을 확인")
#         logger.info("✅ 60: 새 장소의 빈 담당자 목록 확인 성공")
#
#     def test_61_coordinator_role_model_str_representation(self):
#         """61: CoordinatorRole 모델의 __str__ 메서드 작동 확인"""
#         logger.info("--- 61: CoordinatorRole 모델 __str__ 메서드 테스트 시작 ---")
#         self.assertEqual(str(self.role_guide), self.role_guide.name)
#         logger.info(f"CoordinatorRole __str__: {str(self.role_guide)}")
#         logger.info("✅ 61: CoordinatorRole 모델 __str__ 메서드 확인 성공")
#
#     def test_62_place_coordinator_model_str_representation(self):
#         """62: PlaceCoordinator 모델의 __str__ 메서드 작동 확인"""
#         logger.info("--- 62: PlaceCoordinator 모델 __str__ 메서드 테스트 시작 ---")
#         coordinator = PlaceCoordinator.objects.create(place=self.place1, role=self.role_guide, name='홍길동', phone='123')
#         expected_str = f"{coordinator.name} ({coordinator.role.name}) - {coordinator.place.name}"
#         self.assertEqual(str(coordinator), expected_str)
#         logger.info(f"PlaceCoordinator __str__: {str(coordinator)}")
#         logger.info("✅ 62: PlaceCoordinator 모델 __str__ 메서드 확인 성공")
#
#     def test_63_create_coordinator_with_extra_fields(self):
#         """63: 요청 데이터에 불필요한 필드가 포함된 경우 무시하고 담당자 생성"""
#         logger.info("--- 63: 불필요한 필드 포함 담당자 생성 테스트 시작 ---")
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('coordinator-list-create', kwargs={'place_id': self.place2.id})
#         data = {
#             "role_id": self.role_guide.id,
#             "name": "나무시",
#             "phone": "010-9876-5432",
#             "age": 30,  # 불필요한 필드
#             "city": "Seoul"  # 불필요한 필드
#         }
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_201_CREATED)
#         self.assertNotIn('age', response.data)
#         logger.info(f"생성된 담당자 정보 (불필요 필드 제외 확인): {response.data}")
#         logger.info("✅ 63: 불필요한 필드 포함 담당자 생성 성공")
#
#     def test_64_create_coordinator_for_place_managed_by_other(self):
#         """64: 총괄담당자는 다른 담당자의 여행에 속한 장소에도 담당자 배정 가능"""
#         logger.info("--- 64: 총괄담당자가 다른 담당자 여행 장소에 담당자 배정 테스트 시작 ---")
#         # manager2의 여행(trip2)에 속한 장소(place_busan) 생성
#         place_busan = Place.objects.create(name="해운대", category=self.category_tour)
#         Schedule.objects.create(trip=self.trip2, day_number=1, order=1, place=place_busan, start_time=time(10, 0),
#                                 end_time=time(12, 0))
#
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('coordinator-list-create', kwargs={'place_id': place_busan.id})
#         data = {"role_id": self.role_guide.id, "name": "부산가이드", "phone": "051-123-4567"}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_201_CREATED)
#         self.assertTrue(PlaceCoordinator.objects.filter(place=place_busan, name="부산가이드").exists())
#         logger.info("총괄담당자가 manager2의 여행 장소에 담당자 배정 성공")
#         logger.info("✅ 64: 총괄담당자가 다른 담당자 여행 장소에 담당자 배정 성공")
#
#     def test_65_list_coordinators_is_ordered(self):
#         """65: 장소별 담당자 목록이 역할 이름, 담당자 이름 순으로 정렬되는지 확인"""
#         logger.info("--- 65: 담당자 목록 정렬 순서 확인 테스트 시작 ---")
#         PlaceCoordinator.objects.create(place=self.place1, role=self.role_driver, name='박기사', phone='333')
#         PlaceCoordinator.objects.create(place=self.place1, role=self.role_guide, name='이가이드', phone='222')
#         PlaceCoordinator.objects.create(place=self.place1, role=self.role_guide, name='김가이드', phone='111')
#
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('coordinator-list-create', kwargs={'place_id': self.place1.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#
#         names = [item['name'] for item in response.data]
#         # 정렬 순서: role.name (가이드 -> 운전기사), name (김가이드 -> 이가이드)
#         self.assertEqual(names, ['김가이드', '이가이드', '박기사'])
#         logger.info(f"정렬된 담당자 이름: {names}")
#         logger.info("✅ 65: 담당자 목록 정렬 순서 확인 성공")
#
#     @classmethod
#     def tearDownClass(cls):
#         """테스트 클래스 전체가 끝난 후 한 번만 실행"""
#         super().tearDownClass()
#         logger.info("=" * 70)
#         logger.info("schedules 앱 통합 테스트 (v4) 종료")
#         logger.info("=" * 70)