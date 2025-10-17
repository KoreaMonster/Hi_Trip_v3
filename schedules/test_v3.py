# import os
# from django.test import TestCase
# from django.urls import reverse
# from django.core.files.uploadedfile import SimpleUploadedFile
# from django.conf import settings
# from rest_framework.test import APIClient
# from rest_framework import status
# from datetime import date, time
# from django.db.models import ProtectedError
#
# from users.models import User
# from trips.models import Trip
# from schedules.models import Schedule, PlaceCategory, Place, CoordinatorRole, PlaceCoordinator, OptionalExpense
#
#
# class ScheduleAPITestCase(TestCase):
#     """ schedules 앱 API 최종 통합 테스트 (v3) """
#
#     def setUp(self):
#         """테스트를 위한 공통 데이터 설정"""
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
#         self.place1 = Place.objects.create(name='흑돈가', category=self.category_food, address='제주 제주시')
#         self.place2 = Place.objects.create(name='성산일출봉', category=self.category_tour, address='제주 서귀포시')
#         self.role_guide = CoordinatorRole.objects.create(name='가이드')
#         self.role_driver = CoordinatorRole.objects.create(name='운전기사')
#         self.expense1 = OptionalExpense.objects.create(place=self.place1, item_name='흑돼지 2인 세트', price=50000)
#         self.expense2 = OptionalExpense.objects.create(place=self.place2, item_name='오디오 가이드', price=3000)
#         self.schedule1 = Schedule.objects.create(trip=self.trip1, day_number=1, order=1, place=self.place1,
#                                                  start_time=time(12, 0), end_time=time(13, 30))
#
#     # ======================================================================
#     # PART 1: 권한 검증 - 5 Cases
#     # ======================================================================
#
#     def test_01_unauthenticated_access_denied(self):
#         """01: 비로그인 사용자는 일정 API 접근 불가"""
#         url = reverse('schedule-list-create', kwargs={'trip_id': self.trip1.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
#         print("✅ 01: 비로그인 접근 차단")
#
#     def test_02_unapproved_user_access_denied(self):
#         """02: 미승인 사용자는 일정 API 접근 불가"""
#         self.client.force_authenticate(user=self.unapproved_user)
#         url = reverse('schedule-list-create', kwargs={'trip_id': self.trip1.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
#         print("✅ 02: 미승인 사용자 접근 차단")
#
#     def test_03_manager_cannot_access_others_trip(self):
#         """03: 담당자는 다른 담당자의 여행 일정에 접근 불가"""
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('schedule-list-create', kwargs={'trip_id': self.trip2.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
#         print("✅ 03: 담당자 상호 접근 차단")
#
#     def test_04_super_admin_can_access_any_trip(self):
#         """04: 총괄담당자는 모든 여행 일정에 접근 가능"""
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('schedule-list-create', kwargs={'trip_id': self.trip1.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         print("✅ 04: 총괄담당자 접근 권한 확인")
#
#     def test_05_manager_cannot_modify_others_schedule(self):
#         """05: 담당자는 다른 담당자의 일정을 수정/삭제 불가"""
#         self.client.force_authenticate(user=self.manager2)
#         url = reverse('schedule-detail-action', kwargs={'trip_id': self.trip1.id, 'schedule_id': self.schedule1.id})
#         response = self.client.delete(url)
#         self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
#         print("✅ 05: 담당자 상호 수정/삭제 차단")
#
#     # ======================================================================
#     # PART 2: 일정(Schedule) CRUD & 유효성 검사 - 8 Cases
#     # ======================================================================
#
#     def test_06_create_schedule_success(self):
#         """06: 담당자가 자기 여행에 일정 생성 성공"""
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('schedule-list-create', kwargs={'trip_id': self.trip1.id})
#         data = {"day_number": 1, "order": 2, "place": self.place2.id, "start_time": "15:00", "end_time": "17:00"}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_201_CREATED)
#         self.assertEqual(response.data['duration_minutes'], 120)
#         print("✅ 06: 일정 생성 성공")
#
#     def test_07_list_schedules(self):
#         """07: 특정 여행의 일정 목록 조회"""
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('schedule-list-create', kwargs={'trip_id': self.trip1.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(len(response.data), 1)
#         print("✅ 07: 일정 목록 조회 성공")
#
#     def test_08_schedule_detail(self):
#         """08: 특정 일정 상세 조회"""
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('schedule-detail-action', kwargs={'trip_id': self.trip1.id, 'schedule_id': self.schedule1.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(response.data['id'], self.schedule1.id)
#         print("✅ 08: 일정 상세 조회 성공")
#
#     def test_09_update_schedule_patch(self):
#         """09: PATCH로 일정 부분 수정"""
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('schedule-detail-action', kwargs={'trip_id': self.trip1.id, 'schedule_id': self.schedule1.id})
#         data = {'main_content': '흑돼지 맛집 탐방'}
#         response = self.client.patch(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(response.data['main_content'], '흑돼지 맛집 탐방')
#         print("✅ 09: 일정 부분 수정(PATCH) 성공")
#
#     def test_10_delete_schedule(self):
#         """10: 일정 삭제"""
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('schedule-detail-action', kwargs={'trip_id': self.trip1.id, 'schedule_id': self.schedule1.id})
#         response = self.client.delete(url)
#         self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
#         self.assertFalse(Schedule.objects.filter(id=self.schedule1.id).exists())
#         print("✅ 10: 일정 삭제 성공")
#
#     def test_11_create_schedule_with_invalid_time(self):
#         """11: 유효성 검사 - 종료 시간이 시작 시간보다 빠를 때 생성 실패"""
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('schedule-list-create', kwargs={'trip_id': self.trip1.id})
#         data = {"day_number": 2, "order": 1, "start_time": "14:00", "end_time": "13:00"}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#         print("✅ 11: 유효성 검사 - 잘못된 시간")
#
#     def test_12_create_schedule_with_negative_day_number(self):
#         """12: 유효성 검사 - 일차가 음수일 때 생성 실패"""
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('schedule-list-create', kwargs={'trip_id': self.trip1.id})
#         data = {"day_number": -1, "order": 1, "start_time": "10:00", "end_time": "11:00"}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#         print("✅ 12: 유효성 검사 - 음수 일차")
#
#     def test_13_create_schedule_duplicate_order(self):
#         """13: 유효성 검사 - 같은 날, 같은 순서로 중복 생성 불가"""
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('schedule-list-create', kwargs={'trip_id': self.trip1.id})
#         data = {"day_number": 1, "order": 1, "start_time": "19:00", "end_time": "21:00"}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#         self.assertIn('non_field_errors', response.data)
#         print("✅ 13: 유효성 검사 - 중복 순서(unique_together)")
#
#     # ======================================================================
#     # PART 3: 장소(Place) CRUD & 유효성 검사 - 9 Cases
#     # ======================================================================
#     def test_14_list_places(self):
#         """14: 장소 목록 조회"""
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('place-list-create')
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(len(response.data), 2)
#         print("✅ 14: 장소 목록 조회 성공")
#     #
#     # def test_15_create_place_success(self):
#     #     """15: 새 장소 생성 성공 (이미지 포함)"""
#     #     self.client.force_authenticate(user=self.super_admin)
#     #     url = reverse('place-list-create')
#     #     image = SimpleUploadedFile("test.jpg", b"file_content", content_type="image/jpeg")
#     #     data = {"name": "한라산", "category_id": self.category_tour.id, "image": image}
#     #     response = self.client.post(url, data, format='multipart')
#     #     self.assertEqual(response.status_code, status.HTTP_201_CREATED)
#     #     new_place = Place.objects.get(name="한라산")
#     #     self.assertTrue(new_place.image.name.endswith('.jpg'))
#     #     os.remove(os.path.join(settings.MEDIA_ROOT, new_place.image.name))
#     #     print("✅ 15: 장소 생성(이미지 포함) 성공")
#
#     def test_16_create_place_with_non_existent_category(self):
#         """16: 유효성 검사 - 존재하지 않는 카테고리 ID로 장소 생성 실패"""
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('place-list-create')
#         data = {"name": "없는 카테고리 장소", "category_id": 9999}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#         print("✅ 16: 유효성 검사 - 존재하지 않는 카테고리 ID")
#
#     def test_17_place_detail(self):
#         """17: 특정 장소 상세 정보 조회"""
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('place-detail-action', kwargs={'place_id': self.place1.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(response.data['name'], '흑돈가')
#         print("✅ 17: 장소 상세 조회 성공")
#
#     def test_18_update_place(self):
#         """18: 장소 정보 수정"""
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('place-detail-action', kwargs={'place_id': self.place2.id})
#         data = {'entrance_fee': 5000, 'name': '성산일출봉(수정)'}
#         response = self.client.patch(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(response.data['entrance_fee'], 5000)
#         print("✅ 18: 장소 정보 수정 성공")
#
#     def test_19_delete_place_and_check_schedule(self):
#         """19: 장소 삭제 시 연결된 일정의 place 필드가 NULL로 변경되는지 확인"""
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('place-detail-action', kwargs={'place_id': self.place1.id})
#         response = self.client.delete(url)
#         self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
#         self.schedule1.refresh_from_db()
#         self.assertIsNone(self.schedule1.place)
#         print("✅ 19: 장소 삭제 후 SET_NULL 동작 확인")
#
#     def test_20_list_place_categories(self):
#         """20: 장소 카테고리 목록 조회"""
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('list-categories')
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(len(response.data), 2)
#         print("✅ 20: 장소 카테고리 목록 조회 성공")
#
#     def test_21_delete_category_in_use(self):
#         """21: 사용 중인 카테고리 삭제 시 장소의 category 필드가 NULL로 변경되는지 확인"""
#         self.category_food.delete()
#         self.place1.refresh_from_db()
#         self.assertIsNone(self.place1.category)
#         print("✅ 21: 사용 중인 카테고리 삭제 후 SET_NULL 동작 확인")
#
#     def test_22_create_place_with_negative_fee(self):
#         """22: 유효성 검사 - 입장료를 음수로 입력 시 생성 실패"""
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('place-list-create')
#         data = {"name": "음수 입장료", "entrance_fee": -1000}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#         print("✅ 22: 유효성 검사 - 음수 입장료")
#
#     # ======================================================================
#     # PART 4: 선택 비용(Optional Expense) CRUD & 유효성 검사 - 7 Cases
#     # ======================================================================
#     def test_23_list_expenses_for_place(self):
#         """23: 특정 장소의 선택 비용 목록 조회"""
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('expense-list-create', kwargs={'place_id': self.place2.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(len(response.data), 1)
#         print("✅ 23: 선택 비용 목록 조회 성공")
#
#     def test_24_create_expense_for_place(self):
#         """24: 특정 장소에 선택 비용 항목 추가"""
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('expense-list-create', kwargs={'place_id': self.place1.id})
#         data = {"item_name": "계란찜", "price": 2000}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_201_CREATED)
#         self.assertEqual(OptionalExpense.objects.filter(place=self.place1).count(), 2)
#         print("✅ 24: 선택 비용 항목 추가 성공")
#
#     def test_25_create_expense_with_negative_price(self):
#         """25: 유효성 검사 - 가격을 음수로 입력 시 생성 실패"""
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('expense-list-create', kwargs={'place_id': self.place1.id})
#         data = {"item_name": "마이너스 비용", "price": -5000}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#         print("✅ 25: 유효성 검사 - 음수 가격")
#
#     def test_26_calculate_expenses_success(self):
#         """26: 선택 비용 계산 API 성공"""
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('calculate-expense')
#         data = {"expense_ids": [self.expense1.id, self.expense2.id]}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(response.data['total'], 53000)
#         print("✅ 26: 선택 비용 계산 성공")
#
#     def test_27_calculate_expenses_with_non_existent_id(self):
#         """27: 존재하지 않는 ID 포함하여 비용 계산 시도"""
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('calculate-expense')
#         data = {"expense_ids": [self.expense1.id, 9999]}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(response.data['total'], 50000)
#         print("✅ 27: 예외 처리 - 존재하지 않는 ID로 비용 계산")
#
#     def test_28_calculate_expenses_with_empty_list(self):
#         """28: 빈 리스트로 비용 계산 시도"""
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('calculate-expense')
#         data = {"expense_ids": []}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#         print("✅ 28: 예외 처리 - 빈 리스트로 비용 계산")
#
#     def test_29_delete_place_cascades_to_expenses(self):
#         """29: 장소 삭제 시 연결된 선택 비용 항목도 연쇄 삭제되는지 확인"""
#         self.assertTrue(OptionalExpense.objects.filter(id=self.expense1.id).exists())
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('place-detail-action', kwargs={'place_id': self.place1.id})
#         self.client.delete(url)
#         self.assertFalse(OptionalExpense.objects.filter(id=self.expense1.id).exists())
#         print("✅ 29: 장소 삭제 시 선택 비용 연쇄 삭제(CASCADE) 확인")
#
#     # ======================================================================
#     # PART 5: 장소 담당자(Coordinator) CRUD & 유효성 검사 - 12 Cases
#     # ======================================================================
#     def test_30_list_coordinator_roles(self):
#         """30: 담당자 역할 목록 조회"""
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('list-coordinator-roles')
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(len(response.data), 2)
#         print("✅ 30: 담당자 역할 목록 조회 성공")
#
#     def test_31_create_coordinator_success(self):
#         """31: 장소에 담당자 배정 성공"""
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('coordinator-list-create', kwargs={'place_id': self.place2.id})
#         data = {"role_id": self.role_guide.id, "name": "나신입", "phone": "010-9876-5432"}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_201_CREATED)
#         self.assertEqual(response.data['name'], "나신입")
#         print("✅ 31: 장소 담당자 배정 성공")
#
#     def test_32_list_coordinators_for_place(self):
#         """32: 장소별 담당자 목록 조회"""
#         PlaceCoordinator.objects.create(place=self.place2, role=self.role_guide, name="임시가이드", phone="123")
#         self.client.force_authenticate(user=self.manager1)
#         url = reverse('coordinator-list-create', kwargs={'place_id': self.place2.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(len(response.data), 1)
#         print("✅ 32: 장소별 담당자 목록 조회 성공")
#
#     def test_33_create_coordinator_with_non_existent_role(self):
#         """33: 유효성 검사 - 존재하지 않는 역할 ID로 담당자 생성 실패"""
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('coordinator-list-create', kwargs={'place_id': self.place2.id})
#         data = {"role_id": 9999, "name": "유령", "phone": "010-0000-0000"}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#         print("✅ 33: 유효성 검사 - 존재하지 않는 역할 ID")
#
#     def test_34_create_coordinator_missing_name(self):
#         """34: 유효성 검사 - 필수 필드(name) 누락 시 생성 실패"""
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('coordinator-list-create', kwargs={'place_id': self.place2.id})
#         data = {"role_id": self.role_guide.id, "phone": "010-1111-2222"}
#         response = self.client.post(url, data, format='json')
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
#         print("✅ 34: 유효성 검사 - 필수 필드 누락")
#
#     def test_35_delete_place_cascades_to_coordinators(self):
#         """35: 장소 삭제 시 연결된 담당자도 연쇄 삭제되는지 확인"""
#         coordinator = PlaceCoordinator.objects.create(place=self.place1, role=self.role_driver, name='베스트', phone='111')
#         self.assertTrue(PlaceCoordinator.objects.filter(id=coordinator.id).exists())
#
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('place-detail-action', kwargs={'place_id': self.place1.id})
#         self.client.delete(url)
#         self.assertFalse(PlaceCoordinator.objects.filter(id=coordinator.id).exists())
#         print("✅ 35: 장소 삭제 시 담당자 연쇄 삭제(CASCADE) 확인")
#
#     def test_36_delete_coordinator_role_in_use_fail(self):
#         """36: 사용 중인 담당자 역할 삭제 시도 (PROTECT)"""
#         PlaceCoordinator.objects.create(place=self.place1, role=self.role_guide, name='테스터', phone='123')
#         with self.assertRaises(ProtectedError):
#             self.role_guide.delete()
#         print("✅ 36: 사용 중인 역할 삭제 방지(PROTECT) 확인")
#
#     def test_37_add_multiple_coordinators_to_place(self):
#         """37: 한 장소에 여러 역할의 담당자 배정"""
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('coordinator-list-create', kwargs={'place_id': self.place1.id})
#         self.client.post(url, {"role_id": self.role_guide.id, "name": "가이드김", "phone": "010-1111-1111"})
#         self.client.post(url, {"role_id": self.role_driver.id, "name": "운전박", "phone": "010-2222-2222"})
#         self.assertEqual(PlaceCoordinator.objects.filter(place=self.place1).count(), 2)
#         print("✅ 37: 한 장소에 여러 담당자 배정 성공")
#
#     def test_38_coordinator_api_for_non_existent_place(self):
#         """38: 존재하지 않는 장소에 담당자 생성/조회 시도"""
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('coordinator-list-create', kwargs={'place_id': 9999})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
#         response = self.client.post(url, {"role_id": self.role_guide.id, "name": "담당자", "phone": "123"})
#         self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
#         print("✅ 38: 예외 처리 - 존재하지 않는 장소의 담당자 API")
#
#     def test_39_update_coordinator_info_not_implemented(self):
#         """39: 장소 담당자 정보 수정 (별도 API 미구현 시나리오)"""
#         print("ℹ️ 39: 담당자 수정/삭제 API는 현재 미구현 상태")
#         pass
#
#     def test_40_delete_coordinator_info_not_implemented(self):
#         """40: 장소 담당자 정보 삭제 (별도 API 미구현 시나리오)"""
#         print("ℹ️ 40: 담당자 수정/삭제 API는 현재 미구현 상태")
#         pass
#
#     def test_41_schedule_detail_wrong_trip_id(self):
#         """41: URL의 trip_id와 schedule의 실제 trip_id가 다를 경우 404 반환"""
#         self.client.force_authenticate(user=self.super_admin)
#         url = reverse('schedule-detail-action', kwargs={'trip_id': self.trip2.id, 'schedule_id': self.schedule1.id})
#         response = self.client.get(url)
#         self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
#         print("✅ 41: 예외 처리 - URL의 trip_id 불일치")
