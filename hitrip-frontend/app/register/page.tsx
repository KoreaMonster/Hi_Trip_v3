"use client"

import type React from "react"

/**
 * 회원가입 페이지
 * 간단한 회원가입 폼
 */

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { authApi, handleApiError } from "@/lib/api/client"

export default function RegisterPage() {
  const navigate = useNavigate()

  // 폼 상태
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    passwordConfirm: "",
    korean_name: "",
    english_name: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 입력 값 변경 처리
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  /**
   * 회원가입 처리
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // 유효성 검사
    if (!formData.username.trim()) {
      alert("아이디를 입력해주세요.")
      return
    }

    if (!formData.password.trim()) {
      alert("비밀번호를 입력해주세요.")
      return
    }

    if (formData.password !== formData.passwordConfirm) {
      alert("비밀번호가 일치하지 않습니다.")
      return
    }

    if (!formData.korean_name.trim()) {
      alert("한글 이름을 입력해주세요.")
      return
    }

    if (!formData.english_name.trim()) {
      alert("영문 이름을 입력해주세요.")
      return
    }

    setIsLoading(true)

    try {
      // 회원가입 API 호출
      await authApi.register({
        username: formData.username,
        password: formData.password,
        korean_name: formData.korean_name,
        english_name: formData.english_name,
      })

      alert("회원가입이 완료되었습니다. 승인 후 로그인할 수 있습니다.")
      navigate("/login")
    } catch (error) {
      const errorMessage = handleApiError(error)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">HI-TRIP</h1>
          <p className="text-text-muted">회원가입</p>
        </div>

        {/* 회원가입 폼 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 아이디 */}
          <Input
            label="아이디"
            name="username"
            type="text"
            placeholder="아이디를 입력하세요"
            value={formData.username}
            onChange={handleChange}
            disabled={isLoading}
          />

          {/* 비밀번호 */}
          <Input
            label="비밀번호"
            name="password"
            type="password"
            placeholder="비밀번호를 입력하세요"
            value={formData.password}
            onChange={handleChange}
            disabled={isLoading}
          />

          {/* 비밀번호 확인 */}
          <Input
            label="비밀번호 확인"
            name="passwordConfirm"
            type="password"
            placeholder="비밀번호를 다시 입력하세요"
            value={formData.passwordConfirm}
            onChange={handleChange}
            disabled={isLoading}
          />

          {/* 한글 이름 */}
          <Input
            label="한글 이름"
            name="korean_name"
            type="text"
            placeholder="홍길동"
            value={formData.korean_name}
            onChange={handleChange}
            disabled={isLoading}
          />

          {/* 영문 이름 */}
          <Input
            label="영문 이름"
            name="english_name"
            type="text"
            placeholder="Hong Gildong"
            value={formData.english_name}
            onChange={handleChange}
            disabled={isLoading}
          />

          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 rounded-md bg-error/10 border border-error">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => navigate("/login")}>
              취소
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? "가입 중..." : "회원가입"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
