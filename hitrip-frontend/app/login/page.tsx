"use client"

import type React from "react"

/**
 * 로그인 페이지
 * 화면 설계서 4페이지 참고
 */

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { useAuthStore } from "@/lib/store/authStore"
import { STORAGE_KEYS } from "@/lib/utils/constants"

export default function LoginPage() {
  const router = useRouter()
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore()

  // 폼 상태
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)

  /**
   * 페이지 로드 시 저장된 아이디 불러오기
   */
  useEffect(() => {
    const savedUsername = localStorage.getItem(STORAGE_KEYS.REMEMBER_ID)
    if (savedUsername) {
      setUsername(savedUsername)
      setRememberMe(true)
    }
  }, [])

  /**
   * 로그인 성공 시 대시보드로 이동
   */
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard")
    }
  }, [isAuthenticated, router])

  /**
   * 로그인 처리
   */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    // 유효성 검사
    if (!username.trim()) {
      alert("아이디를 입력해주세요.")
      return
    }

    if (!password.trim()) {
      alert("패스워드를 입력해주세요.")
      return
    }

    try {
      // 로그인 API 호출
      await login(username, password)

      // 아이디 저장
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEYS.REMEMBER_ID, username)
      } else {
        localStorage.removeItem(STORAGE_KEYS.REMEMBER_ID)
      }
    } catch (error) {
      // 에러는 authStore에서 처리됨
      console.error("[v0] Login error:", error)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* 왼쪽: 관련 이미지 (태블릿/모바일에서는 숨김) */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-light items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="w-full h-96 bg-primary/10 rounded-lg flex items-center justify-center">
            <p className="text-primary text-lg font-medium">여행 관리 이미지</p>
          </div>
          <p className="mt-6 text-text-secondary">HI-TRIP과 함께 여행 전/중/후를 효율적으로 관리하세요</p>
        </div>
      </div>

      {/* 오른쪽: 로그인 폼 */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* 로고 */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-primary mb-2">HI-TRIP</h1>
            <p className="text-text-muted">여행 관리 시스템</p>
          </div>

          {/* 로그인 폼 */}
          <form onSubmit={handleLogin} className="space-y-6">
            {/* 아이디 입력 */}
            <Input
              label="ID"
              type="text"
              placeholder="아이디를 입력하세요"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
            />

            {/* 비밀번호 입력 */}
            <Input
              label="Password"
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />

            {/* 아이디 저장 체크박스 */}
            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isLoading}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <label htmlFor="remember-me" className="ml-2 text-sm text-text-secondary">
                아이디 저장
              </label>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="p-3 rounded-md bg-error/10 border border-error">
                <p className="text-sm text-error">{error}</p>
              </div>
            )}

            {/* 로그인 버튼 */}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "로그인 중..." : "로그인"}
            </Button>
          </form>

          {/* 하단 링크 */}
          <div className="mt-6 text-center text-sm text-text-muted">
            <a href="#" className="hover:text-primary">
              아이디 찾기
            </a>
            <span className="mx-2">|</span>
            <a href="#" className="hover:text-primary">
              비밀번호 찾기
            </a>
            <span className="mx-2">|</span>
            <a href="/register" className="hover:text-primary">
              회원가입
            </a>
          </div>

          {/* 저작권 */}
          <div className="mt-12 text-center text-xs text-text-muted">
            <p>COPYRIGHT © 2025 FGTV ALL RIGHTS RESERVED.</p>
            <p className="mt-1">Contact PICTOREAL Inc.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
