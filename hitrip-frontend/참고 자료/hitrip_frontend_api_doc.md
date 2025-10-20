# Hi Trip 백엔드 API 명세서 (프론트엔드 개발용)

## 📌 프로젝트 개요

**Hi Trip**은 여행사 담당자를 위한 SaaS 플랫폼으로, 여행 관리, 일정 최적화, 실시간 모니터링 기능을 제공합니다.

### 기술 스택
- **백엔드**: Django 5.2 + Django REST Framework
- **데이터베이스**: PostgreSQL
- **인증**: 세션 기반 (Django Session)
- **외부 API**: Google Places API, Routes API, Geocoding API

### 서버 정보
- **Base URL**: `http://localhost:8000`
- **API 문서**: `http://localhost:8000/api/docs/` (Swagger UI)
- **CORS**: `http://localhost:3000` 허용
- **인증**: 세션 쿠키 (`credentials: 'include'` 필수)

---

## 🔐 1. 인증 API (`/api/auth/`)

### 1.1 회원가입
```http
POST /api/auth/register/
Content-Type: application/json

{
  "username": "manager1",
  "password": "Password123!",
  "last_name_kr": "김",
  "first_name_kr": "민우",
  "last_name": "Kim",
  "first_name": "Minwoo"
}
```

**응답 (201 Created)**:
```json
{
  "id": 1,
  "username": "manager1",
  "role": "manager",
  "is_approved": false,
  "full_name_kr": "김민우",
  "full_name_en": "Minwoo Kim"
}
```

### 1.2 로그인
```http
POST /api/auth/login/
Content-Type: application/json

{
  "username": "manager1",
  "password": "Password123!"
}
```

**응답 (200 OK)**:
```json
{
  "id": 1,
  "username": "manager1",
  "role": "manager",
  "is_approved": true,
  "full_name_kr": "김민우"
}
```

**에러**:
- `401`: 아이디/비밀번호 불일치
- `403`: 미승인 계정

### 1.3 로그아웃
```http
POST /api/auth/logout/
```

### 1.4 프로필 조회
```http
GET /api/auth/profile/
```

### 1.5 직원 승인 (총괄담당자만)
```http
POST /api/auth/staff/{id}/approve/
```

---

## 🗺️ 2. 여행 관리 API (`/api/trips/`)

### 2.1 여행 목록 조회
```http
GET /api/trips/
```

**응답**:
```json
[
  {
    "id": 1,
    "title": "제주 3박 4일 패키지",
    "destination": "제주도",
    "start_date": "2025-11-01",
    "end_date": "2025-11-04",
    "status": "planning",
    "invite_code": "A8K3D9F2",
    "manager": {
      "id": 2,
      "full_name_kr": "이담당"
    },
    "participant_count": 15
  }
]
```

### 2.2 여행 생성
```http
POST /api/trips/
Content-Type: application/json

{
  "title": "제주 3박 4일",
  "destination": "제주도",
  "start_date": "2025-11-01",
  "end_date": "2025-11-04",
  "heart_rate_min": 55,
  "heart_rate_max": 105,
  "spo2_min": 95.00,
  "geofence_center_lat": 33.499621,
  "geofence_center_lng": 126.531188,
  "geofence_radius_km": 2.5
}
```

**응답**: 초대코드 자동 생성됨

### 2.3 여행 상세 조회
```http
GET /api/trips/{id}/
```

**응답**: 참가자 목록 포함

### 2.4 담당자 배정 (총괄담당자만)
```http
POST /api/trips/{id}/assign-manager/
Content-Type: application/json

{
  "manager_id": 3
}
```

### 2.5 참가자 추가
```http
POST /api/trips/{trip_pk}/participants/
Content-Type: application/json

{
  "traveler_id": 5,
  "invite_code": "A8K3D9F2"
}
```

### 2.6 참가자 목록
```http
GET /api/trips/{trip_pk}/participants/
```

---

## 📅 3. 일정 관리 API (`/api/schedules/`, `/api/places/`)

### 3.1 일정 목록 조회
```http
GET /api/trips/{trip_pk}/schedules/
```

**응답**:
```json
[
  {
    "id": 1,
    "trip": 1,
    "place": 10,
    "place_name": "성산일출봉",
    "date": "2025-11-02",
    "start_time": "09:00:00",
    "end_time": "11:00:00",
    "duration_minutes": 120,
    "notes": "일출 관람 추천"
  }
]
```

### 3.2 일정 생성
```http
POST /api/trips/{trip_pk}/schedules/
Content-Type: application/json

{
  "place_id": 10,
  "date": "2025-11-02",
  "start_time": "09:00",
  "end_time": "11:00",
  "notes": "일출 관람"
}
```

### 3.3 장소 생성
```http
POST /api/places/
Content-Type: multipart/form-data

{
  "name": "성산일출봉",
  "category": 2,
  "address": "제주 서귀포시 성산읍",
  "latitude": 33.458452,
  "longitude": 126.941537,
  "description": "UNESCO 세계자연유산",
  "image": [File]
}
```

### 3.4 고정 카테고리 장소 추천 ⭐
```http
POST /api/places/recommend-fixed/
Content-Type: application/json

{
  "address": "제주시 제주대학로 102"
}
```

**응답**:
```json
{
  "center_location": {
    "latitude": 33.450701,
    "longitude": 126.570667
  },
  "results": {
    "restaurant": [
      {
        "place_id": "ChIJ...",
        "name": "흑돈가",
        "types": ["restaurant", "food"],
        "location": {
          "latitude": 33.451234,
          "longitude": 126.571234
        },
        "rating": 4.5,
        "user_ratings_total": 1234
      }
    ],
    "tourist_attraction": [...],
    "lodging": [...],
    "cafe": [...],
    "shopping_mall": [...]
  }
}
```

### 3.5 대체 장소 추천
```http
POST /api/places/recommend-alternative/
Content-Type: application/json

{
  "previous_place_id": "ChIJ_A_place_id",
  "unavailable_place_id": "ChIJ_B_place_id",
  "next_place_id": "ChIJ_C_place_id",
  "travel_mode": "DRIVE"
}
```

**응답**: 대체 장소 + 예상 소요 시간

### 3.6 일정 재배치 (동선 최적화)
```http
POST /api/schedules/rebalance/
Content-Type: application/json

{
  "schedule_ids": [1, 2, 3, 4],
  "travel_mode": "DRIVE"
}
```

### 3.7 선택 경비 계산
```http
POST /api/places/{place_pk}/expenses/calculate/
Content-Type: application/json

{
  "expense_ids": [1, 3, 5]
}
```

**응답**:
```json
{
  "total": 150000,
  "currency": "KRW",
  "items": [
    {
      "id": 1,
      "item_name": "흑돼지 2인 세트",
      "price": 50000
    }
  ]
}
```

---

## 📊 4. 모니터링 API (`/api/monitoring/`)

### 4.1 헬스 체크
```http
GET /api/health/
```

### 4.2 참가자 최신 상태 조회
```http
GET /api/monitoring/trips/{id}/status/
```

**응답**:
```json
[
  {
    "participant_id": 1,
    "traveler_name": "김여행",
    "trip_id": 1,
    "health": {
      "id": 123,
      "measured_at": "2025-10-20T14:30:00Z",
      "heart_rate": 75,
      "spo2": 98.5,
      "status": "normal"
    },
    "location": {
      "id": 456,
      "measured_at": "2025-10-20T14:30:00Z",
      "latitude": 33.450701,
      "longitude": 126.570667,
      "accuracy_m": 10.5
    }
  }
]
```

### 4.3 경고 이력 조회
```http
GET /api/monitoring/trips/{id}/alerts/
```

**응답**:
```json
[
  {
    "id": 1,
    "participant": 1,
    "traveler_name": "김여행",
    "alert_type": "heart_rate_high",
    "message": "심박수가 기준치(105)를 초과했습니다: 120",
    "snapshot_time": "2025-10-20T14:30:00Z",
    "created_at": "2025-10-20T14:30:05Z"
  }
]
```

### 4.4 데모 데이터 생성
```http
POST /api/monitoring/trips/{id}/generate-demo/
Content-Type: application/json

{
  "minutes": 10,
  "interval": 60
}
```

---

## 📂 5. 데이터 모델 구조

### User (직원)
```typescript
interface User {
  id: number;
  username: string;
  role: "super_admin" | "manager";
  is_approved: boolean;
  full_name_kr: string;
  full_name_en: string;
}
```

### Trip (여행)
```typescript
interface Trip {
  id: number;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  status: "planning" | "ongoing" | "completed";
  invite_code: string;
  manager: User;
  participant_count: number;
  // 모니터링 임계치
  heart_rate_min?: number;
  heart_rate_max?: number;
  spo2_min?: number;
  geofence_center_lat?: number;
  geofence_center_lng?: number;
  geofence_radius_km?: number;
}
```

### Schedule (일정)
```typescript
interface Schedule {
  id: number;
  trip: number;
  place: number;
  place_name: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  notes?: string;
}
```

### Place (장소)
```typescript
interface Place {
  id: number;
  name: string;
  category: number;
  address: string;
  latitude: number;
  longitude: number;
  description?: string;
  image?: string;
  google_place_id?: string;
}
```

---

## ⚠️ 6. 에러 처리

### HTTP 상태 코드
- **200**: 성공
- **201**: 생성 성공
- **400**: 잘못된 요청 (유효성 검사 실패)
- **401**: 인증 필요 (로그인 안 됨)
- **403**: 권한 없음 (미승인 또는 역할 불일치)
- **404**: 리소스 없음
- **500**: 서버 오류

### 에러 응답 형식
```json
{
  "error": "아이디 또는 비밀번호가 올바르지 않습니다."
}
```

또는

```json
{
  "username": ["이미 존재하는 사용자명입니다."],
  "password": ["8자 이상이어야 합니다."]
}
```

---

## 🚀 7. JavaScript 호출 예시

### Fetch API
```javascript
// 로그인
const login = async (username, password) => {
  const response = await fetch('http://localhost:8000/api/auth/login/', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return response.json();
};

// 여행 목록 조회
const getTrips = async () => {
  const response = await fetch('http://localhost:8000/api/trips/', {
    credentials: 'include'
  });
  return response.json();
};

// 장소 추천
const getRecommendations = async (address) => {
  const response = await fetch('http://localhost:8000/api/places/recommend-fixed/', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address })
  });
  return response.json();
};

// 이미지 업로드 (장소 생성)
const createPlace = async (formData) => {
  const response = await fetch('http://localhost:8000/api/places/', {
    method: 'POST',
    credentials: 'include',
    body: formData // multipart/form-data
  });
  return response.json();
};
```

### Axios
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  withCredentials: true
});

// 로그인
await api.post('/auth/login/', { username, password });

// 여행 목록
const { data } = await api.get('/trips/');

// 참가자 최신 상태
const { data } = await api.get(`/monitoring/trips/${tripId}/status/`);
```

---

## 📱 8. 화면별 API 매핑

### 로그인/회원가입 화면
- `POST /api/auth/register/` - 회원가입
- `POST /api/auth/login/` - 로그인

### 여행 관리 화면
- `GET /api/trips/` - 여행 목록
- `POST /api/trips/` - 여행 생성
- `GET /api/trips/{id}/` - 상세 조회
- `POST /api/trips/{id}/assign-manager/` - 담당자 배정

### 고객 관리 화면
- `GET /api/trips/{trip_pk}/participants/` - 참가자 목록
- `POST /api/trips/{trip_pk}/participants/` - 참가자 추가

### 일정 관리 화면
- `GET /api/trips/{trip_pk}/schedules/` - 일정 목록
- `POST /api/trips/{trip_pk}/schedules/` - 일정 생성
- `POST /api/places/recommend-fixed/` - 장소 추천
- `POST /api/schedules/rebalance/` - 일정 최적화

### 모니터링 대시보드
- `GET /api/monitoring/trips/{id}/status/` - 참가자 실시간 상태
- `GET /api/monitoring/trips/{id}/alerts/` - 경고 이력

---

## 🔧 9. 환경 설정

### CORS 설정
백엔드에서 `http://localhost:3000` 허용됨. 다른 포트 사용 시 백엔드 설정 변경 필요.

### 세션 쿠키
- 모든 요청에 `credentials: 'include'` 필수
- 로그인 후 세션 쿠키 자동 저장
- 로그아웃 시 세션 삭제

### 이미지 URL
업로드된 이미지는 `http://localhost:8000/media/{파일경로}` 형식으로 접근.

---

## 📊 10. 개발 완료 현황

### ✅ 완료된 기능
- 인증/권한 시스템 (회원가입, 로그인, 승인)
- 여행 CRUD + 참가자 관리
- 일정 CRUD + 장소 관리
- Google Places 통합 (추천, 대체, 최적화)
- 모니터링 시스템 (건강/위치 스냅샷, 경고)

### 🔄 진행 중
- 공지사항 기능 (notices 앱)
- 실시간 위치 추적 (locations 앱)

### ⏳ 미착수
- AI 기반 개인 맞춤 추천
- 게이미피케이션 시스템
- 경비 정산 자동화
- 여행 후기/커뮤니티

---

## 📞 문의

기술적 질문이나 API 관련 문의는 백엔드 개발자(민우)에게 연락 바랍니다.