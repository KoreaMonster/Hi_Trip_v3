/**
 * API 클라이언트
 * ky를 사용하여 백엔드 API와 통신
 */

import ky, { HTTPError } from "ky"
import { API_CONFIG } from "@/lib/utils/constants"
import type { ApiError } from "@/lib/types"

/**
 * ky 인스턴스 생성
 * 모든 API 요청에 공통으로 적용되는 설정
 */
export const api = ky.create({
  prefixUrl: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  credentials: "include", // 세션 쿠키 포함
  headers: {
    "Content-Type": "application/json",
  },
  hooks: {
    /**
     * 에러 처리 훅
     * API 에러를 일관된 형식으로 변환
     */
    beforeError: [
      async (error) => {
        const { response } = error
        if (response) {
          try {
            const body = (await response.json()) as ApiError
            error.message = body.detail || body.message || "알 수 없는 오류가 발생했습니다."
          } catch {
            error.message = "서버와 통신 중 오류가 발생했습니다."
          }
        }
        return error
      },
    ],
  },
})

/**
 * API 에러 처리 헬퍼
 * HTTPError를 사용자 친화적인 메시지로 변환
 */
export const handleApiError = (error: unknown): string => {
  if (error instanceof HTTPError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return "알 수 없는 오류가 발생했습니다."
}

/**
 * 인증 API
 */
export const authApi = {
  /**
   * 로그인
   */
  login: async (username: string, password: string) => {
    return api
      .post("auth/login/", {
        json: { username, password },
      })
      .json<{ message: string }>()
  },

  /**
   * 로그아웃
   */
  logout: async () => {
    return api.post("auth/logout/").json<{ message: string }>()
  },

  /**
   * 프로필 조회
   */
  getProfile: async () => {
    return api.get("auth/profile/").json<{ user: any }>()
  },

  /**
   * 회원가입
   */
  register: async (data: { username: string; password: string; korean_name: string; english_name: string }) => {
    return api
      .post("auth/register/", {
        json: data,
      })
      .json<{ message: string }>()
  },
}

/**
 * 여행 API
 */
export const tripsApi = {
  /**
   * 여행 목록 조회
   */
  getTrips: async (status?: string) => {
    const searchParams = status ? { status } : {}
    return api.get("trips/", { searchParams }).json<any[]>()
  },

  /**
   * 여행 상세 조회
   */
  getTrip: async (id: number) => {
    return api.get(`trips/${id}/`).json<any>()
  },

  /**
   * 여행 생성
   */
  createTrip: async (data: any) => {
    return api.post("trips/", { json: data }).json<any>()
  },

  /**
   * 여행 수정
   */
  updateTrip: async (id: number, data: any) => {
    return api.put(`trips/${id}/`, { json: data }).json<any>()
  },

  /**
   * 담당자 배정
   */
  assignManager: async (id: number, managerId: number) => {
    return api
      .post(`trips/${id}/assign-manager/`, {
        json: { manager_id: managerId },
      })
      .json<any>()
  },

  /**
   * 참가자 목록 조회
   */
  getParticipants: async (tripId: number) => {
    return api.get(`trips/${tripId}/participants/`).json<any[]>()
  },

  /**
   * 참가자 상세 조회
   */
  getParticipant: async (tripId: number, participantId: number) => {
    return api.get(`trips/${tripId}/participants/${participantId}/`).json<any>()
  },

  /**
   * 참가자 수정
   */
  updateParticipant: async (tripId: number, participantId: number, data: any) => {
    return api
      .put(`trips/${tripId}/participants/${participantId}/`, {
        json: data,
      })
      .json<any>()
  },
}

/**
 * 일정 API
 */
export const schedulesApi = {
  /**
   * 일정 목록 조회
   */
  getSchedules: async (tripId: number) => {
    return api.get(`trips/${tripId}/schedules/`).json<any[]>()
  },

  /**
   * 일정 생성
   */
  createSchedule: async (tripId: number, data: any) => {
    return api
      .post(`trips/${tripId}/schedules/`, {
        json: data,
      })
      .json<any>()
  },

  /**
   * 일정 수정
   */
  updateSchedule: async (tripId: number, scheduleId: number, data: any) => {
    return api
      .put(`trips/${tripId}/schedules/${scheduleId}/`, {
        json: data,
      })
      .json<any>()
  },

  /**
   * 장소 목록 조회
   */
  getPlaces: async (tripId: number, scheduleId: number) => {
    return api.get(`trips/${tripId}/schedules/${scheduleId}/places/`).json<any[]>()
  },
}

/**
 * 모니터링 API
 */
export const monitoringApi = {
  /**
   * 여행 상태 조회
   */
  getTripStatus: async (tripId: number) => {
    return api.get(`monitoring/trips/${tripId}/status/`).json<any>()
  },

  /**
   * 경고 목록 조회
   */
  getAlerts: async (tripId: number) => {
    return api.get(`monitoring/trips/${tripId}/alerts/`).json<any[]>()
  },

  /**
   * 더미 데이터 생성
   */
  generateDemo: async (tripId: number) => {
    return api.post(`monitoring/trips/${tripId}/generate-demo/`).json<any>()
  },
}

/**
 * 장소 추천 API
 */
export const placesApi = {
  /**
   * 고정 장소 추천
   */
  recommendFixed: async (data: any) => {
    return api
      .post("places/recommend-fixed/", {
        json: data,
      })
      .json<any>()
  },

  /**
   * 대체 장소 추천
   */
  recommendAlternative: async (data: any) => {
    return api
      .post("places/recommend-alternative/", {
        json: data,
      })
      .json<any>()
  },
}
