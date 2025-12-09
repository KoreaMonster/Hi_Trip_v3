# 프런트엔드 개발자를 위한 백엔드/API 요약

## 기본 개요
- API 베이스: 로컬 실행 시 `http://127.0.0.1:8000/` (Swagger: `/api/docs`, 스키마: `/api/schema`)
- 인증: DEMO_MODE 기본 활성화 → `DemoAuthentication`가 모든 요청을 데모 슈퍼관리자로 인증합니다. 로그인 필요 없음.
- 데이터베이스: 기본 SQLite(`db.sqlite3`), `python manage.py seed_demo`로 데모 데이터 삽입.
- 스키마 파일: `schema.yaml` (이 파일만으로 Swagger UI/Editor에서 API 문서를 볼 수 있음).

## 스키마 확인 방법
- https://editor.swagger.io → File > Import File → `schema.yaml` 선택.
- 태그별로 API가 그룹화됨: 인증/직원, 여행, 참가자, 일정/장소, 모니터링, 헬스체크.

## 주요 엔드포인트
- 인증/직원: `/api/auth/`
  - 직원 등록: `POST /api/auth/staff/` (데모 모드에서는 승인/로그인 없이 접근 가능)
  - 직원 목록/상세: `GET /api/auth/staff/`, `/api/auth/staff/{id}/`
  - 직원 승인: `POST /api/auth/staff/{id}/approve/`
  - 로그인/로그아웃/프로필: `POST /api/auth/login/`, `POST /api/auth/logout/`, `GET /api/auth/profile/`
- 여행/참가자: `/api/trips/`
  - 여행 CRUD: `/api/trips/`, `/api/trips/{id}/`
  - 참가자 등록/조회: `/api/trips/{trip_pk}/participants/`
- 일정/장소: `/api/places/`, `/api/categories/`, `/api/trips/{trip_pk}/schedules/` 등
  - 장소, 카테고리, 담당자, 선택 지출, 일정 CRUD
- 모니터링: `/api/monitoring/trips/{id}/...`
  - 최신 상태 조회: `GET /api/monitoring/trips/{id}/latest/`
  - 알림 목록: `GET /api/monitoring/trips/{id}/alerts/`
  - 더미 데이터 생성: `POST /api/monitoring/trips/{id}/generate-demo/` (body: `minutes`, `interval`)
- 헬스 체크: `GET /api/health/` (로드밸런서/모니터링용)

## 더미 데이터 흐름
1) 시드: `python manage.py seed_demo` → 여행 1건, 참가자 1명, 기본 알림 1건 생성.
2) 모니터링 데이터 생성: `POST /api/monitoring/trips/{id}/generate-demo/` (예: `{"minutes":1,"interval":30}`) → 건강/위치 스냅샷과 알림 생성.
3) 조회: `GET /api/monitoring/trips/{id}/latest/`, `GET /api/monitoring/trips/{id}/alerts/`에서 확인.

## 프런트 개발 시 참고
- DEMO_MODE 덕분에 인증 토큰을 따로 넣지 않아도 모든 API를 호출할 수 있습니다.
- 실제 인증이 필요해지면 `DEMO_MODE=false`로 끄고, 세션 로그인 흐름을 사용하거나 별도 토큰 인증을 추가해야 합니다.
- 스키마 변경 시 `python manage.py spectacular --file schema.yaml`로 최신 스키마를 갱신할 수 있습니다.

## 빠른 실행 스크립트 예시
```bash
python -m venv .venv && .\.venv\Scripts\activate   # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver  # Swagger: http://127.0.0.1:8000/api/docs
```
