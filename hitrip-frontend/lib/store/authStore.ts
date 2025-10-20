/**
 * 인증 상태 관리 (Zustand)
 * 로그인 상태와 사용자 정보를 전역으로 관리
 */

import { create } from "zustand"
import { authApi, handleApiError } from "@/lib/api/client"
import type { User } from "@/lib/types"

/**
 * 인증 상태 인터페이스
 */
interface AuthState {
  // 상태
  user: User | null // 현재 로그인한 사용자
  isAuthenticated: boolean // 로그인 여부
  isLoading: boolean // 로딩 상태
  error: string | null // 에러 메시지

  // 액션
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  clearError: () => void
}

/**
 * 인증 스토어
 */
export const useAuthStore = create<AuthState>((set) => ({
  // 초기 상태
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  /**
   * 로그인
   */
  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      // 로그인 API 호출
      await authApi.login(username, password)

      // 프로필 조회
      const { user } = await authApi.getProfile()

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (error) {
      const errorMessage = handleApiError(error)
      set({
        error: errorMessage,
        isLoading: false,
      })
      throw error
    }
  },

  /**
   * 로그아웃
   */
  logout: async () => {
    set({ isLoading: true, error: null })
    try {
      await authApi.logout()
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      })
    } catch (error) {
      const errorMessage = handleApiError(error)
      set({
        error: errorMessage,
        isLoading: false,
      })
      throw error
    }
  },

  /**
   * 인증 상태 확인
   * 페이지 로드 시 세션 쿠키로 자동 로그인 확인
   */
  checkAuth: async () => {
    set({ isLoading: true, error: null })
    try {
      const { user } = await authApi.getProfile()
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      })
    }
  },

  /**
   * 에러 초기화
   */
  clearError: () => {
    set({ error: null })
  },
}))
