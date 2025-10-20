/**
 * 상수 정의
 * 프로젝트 전체에서 사용되는 상수를 한 곳에서 관리
 */

/**
 * API 설정
 */
export const API_CONFIG = {
  BASE_URL: "http://localhost:8000/api",
  TIMEOUT: 30000, // 30초
} as const

/**
 * 사용자 역할
 */
export const USER_ROLES = {
  SUPER_ADMIN: "super_admin", // 총괄담당자
  MANAGER: "manager", // 담당자
} as const

/**
 * 여행 상태
 */
export const TRIP_STATUS = {
  PLANNING: "planning", // 여행 전
  ONGOING: "ongoing", // 여행 중
  COMPLETED: "completed", // 여행 후
} as const

/**
 * 로컬 스토리지 키
 */
export const STORAGE_KEYS = {
  REMEMBER_ID: "hitrip_remember_id", // 아이디 저장
} as const

/**
 * 라우트 경로
 */
export const ROUTES = {
  LOGIN: "/login",
  DASHBOARD: "/",
  TRIPS: "/trips",
  TRIPS_PARTICIPANTS: (tripId: string) => `/trips/${tripId}/participants`,
  TRIPS_SCHEDULES: (tripId: string) => `/trips/${tripId}/schedules`,
  MONITORING: "/monitoring",
  MONITORING_PARTICIPANTS: (tripId: string) => `/monitoring/${tripId}/participants`,
  MONITORING_RECOMMENDATIONS: (tripId: string) => `/monitoring/${tripId}/recommendations`,
} as const

/**
 * 색상 상수 (Tailwind 클래스명)
 */
export const COLORS = {
  PRIMARY: "bg-primary text-primary-foreground",
  SUCCESS: "bg-success text-white",
  WARNING: "bg-warning text-white",
  ERROR: "bg-error text-white",
  NEUTRAL: "bg-neutral text-white",
} as const
