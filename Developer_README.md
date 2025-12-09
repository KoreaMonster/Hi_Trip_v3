# Hi Trip Backend (Demo) - Developer Guide

Backend_Final 5.5 기준, Django/DRF 데모 백엔드입니다. Swagger UI로 API 구조를 보여주고, 간단한 데이터 저장/조회가 목적입니다.

## 실행 모드 개요
- `DEMO_MODE`(기본 true): 인증/권한을 우회하고 `demo_admin`으로 자동 인증. Swagger 테스트 시 편리.
- `USE_POSTGRES`(기본 false): true로 설정하면 PostgreSQL 접속. 기본은 SQLite(`db.sqlite3`).
- Swagger: `http://127.0.0.1:8000/api/docs`, OpenAPI: `http://127.0.0.1:8000/api/schema`.

## 빠른 시작 (로컬 데모)
1) 가상환경 생성/활성화  
   - Windows: `python -m venv .venv && .\.venv\Scripts\activate`
   - macOS/Linux: `python -m venv .venv && source .venv/bin/activate`
2) 패키지 설치: `pip install -r requirements.txt`
3) 마이그레이션: `python manage.py migrate`
4) 데모 데이터 시드: `python manage.py seed_demo`
5) 서버 실행: `python manage.py runserver`
6) Swagger 접속: 브라우저에서 `http://127.0.0.1:8000/api/docs`

## 데모 계정
- `demo_admin` / `demo1234` (슈퍼관리자)
- `demo_manager` / `demo1234` (담당자)
- DEMO_MODE가 켜져 있으면 로그인 없이도 권한 체크가 통과됩니다.

## 환경 변수 예시 (.env)
```
DEMO_MODE=true
USE_POSTGRES=false

# PostgreSQL 사용 시
# USE_POSTGRES=true
# DB_NAME=hitrip_db
# DB_USER=postgres
# DB_PASSWORD=secret
# DB_HOST=localhost
# DB_PORT=5432
```

## 주요 앱과 엔드포인트
- users: 직원 등록/승인, 로그인·로그아웃, 프로필 (`/api/auth/`, `/api/auth/staff/`)
- trips: 여행 CRUD, 관리자 배정, 참가자 관리 (`/api/trips/`, `/api/trips/{id}/participants/`)
- schedules: 장소/카테고리/담당자/지출, 여행별 일정 (`/api/places/`, `/api/categories/`, `/api/trips/{id}/schedules/`)
- monitoring: 헬스 체크, 참가자 최신 상태/알림 조회 (`/api/health/`, `/api/monitoring/trips/{id}/latest`, `/api/monitoring/trips/{id}/alerts`)

## 기타 참고
- 현재 `main`은 Backend_Final(5.5)으로 강제 동기화됨. 이전 main 이력은 `main-backup`에 보관.
- 작업 중 스태시: `stash@{0}: codex-temp-stash-before-main-reset` (원하면 `git stash show -p stash@{0}`로 확인).
