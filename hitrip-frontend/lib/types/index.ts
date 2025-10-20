/**
 * TypeScript 타입 정의
 * 백엔드 API 응답과 프론트엔드에서 사용하는 모든 타입을 정의
 */

/**
 * 사용자 (직원)
 */
export interface User {
  id: number
  username: string
  korean_name: string
  english_name: string
  role: "super_admin" | "manager"
  is_approved: boolean
  created_at: string
}

/**
 * 로그인 요청
 */
export interface LoginRequest {
  username: string
  password: string
}

/**
 * 회원가입 요청
 */
export interface RegisterRequest {
  username: string
  password: string
  korean_name: string
  english_name: string
}

/**
 * 여행
 */
export interface Trip {
  id: number
  name: string
  start_date: string
  end_date: string
  status: "planning" | "ongoing" | "completed"
  manager?: User
  participant_count: number
  created_at: string
  updated_at: string
}

/**
 * 여행자
 */
export interface Traveler {
  id: number
  korean_name: string
  english_name: string
  birth_date: string
  gender: "male" | "female"
  phone: string
  email: string
  address?: string
  passport_number?: string
  passport_expiry?: string
  created_at: string
}

/**
 * 여행 참가자
 */
export interface TripParticipant {
  id: number
  trip: number
  traveler: Traveler
  has_companion: boolean
  companion_names?: string
  is_proxy_booking: boolean
  total_amount: number
  paid_amount: number
  insurance_status: "not_subscribed" | "subscribed"
  passport_submitted: boolean
  identity_verified: boolean
  booking_confirmed: boolean
  created_at: string
}

/**
 * 일정
 */
export interface Schedule {
  id: number
  trip: number
  day_number: number
  start_time: string
  end_time: string
  transportation: string
  main_content: string
  meeting_point: string
  budget: number
  order: number
  created_at: string
}

/**
 * 장소
 */
export interface Place {
  id: number
  schedule: number
  name: string
  address: string
  latitude?: number
  longitude?: number
  entrance_fee?: number
  activity_duration?: number
  description?: string
  image_url?: string
  created_at: string
}

/**
 * 건강 스냅샷
 */
export interface HealthSnapshot {
  id: number
  participant: number
  heart_rate?: number
  oxygen_saturation?: number
  recorded_at: string
}

/**
 * 위치 스냅샷
 */
export interface LocationSnapshot {
  id: number
  participant: number
  latitude: number
  longitude: number
  recorded_at: string
}

/**
 * 모니터링 경고
 */
export interface MonitoringAlert {
  id: number
  participant: number
  alert_type: "health" | "location" | "emergency"
  severity: "low" | "medium" | "high"
  message: string
  is_resolved: boolean
  created_at: string
}

/**
 * 장소 추천 요청
 */
export interface PlaceRecommendationRequest {
  trip_id: number
  schedule_id?: number
  location?: string
  preferences?: string[]
}

/**
 * 장소 추천 응답
 */
export interface PlaceRecommendation {
  name: string
  address: string
  rating?: number
  price_level?: number
  types?: string[]
  photo_url?: string
  recommendation_strength: number
  advantage?: string
}

/**
 * API 에러 응답
 */
export interface ApiError {
  detail?: string
  message?: string
  [key: string]: any
}

/**
 * 페이지네이션 응답
 */
export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
