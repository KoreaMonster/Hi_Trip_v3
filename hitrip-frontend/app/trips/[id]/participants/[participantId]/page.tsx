"use client"

import type React from "react"

/**
 * 여행 전 관리 - 고객 상세 정보 관리 페이지
 * 화면 설계서 8페이지 참고
 */

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Layout from "@/components/Layout"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { tripsApi } from "@/lib/api/client"
import type { TripParticipant } from "@/lib/types"

export default function ParticipantDetailPage() {
  const params = useParams()
  const router = useRouter()
  const tripId = Number(params.id)
  const participantId = Number(params.participantId)

  const [participant, setParticipant] = useState<TripParticipant | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 폼 상태
  const [formData, setFormData] = useState({
    korean_name: "",
    english_name: "",
    birth_date: "",
    phone: "",
    gender: "male" as "male" | "female",
    email: "",
    address: "",
    has_companion: false,
    companion_names: "",
    is_proxy_booking: false,
    passport_number: "",
    passport_expiry: "",
    total_amount: 0,
    paid_amount: 0,
    insurance_status: "not_subscribed" as "not_subscribed" | "subscribed",
  })

  /**
   * 참가자 정보 조회
   */
  useEffect(() => {
    const fetchParticipant = async () => {
      try {
        setLoading(true)
        const data = await tripsApi.getParticipant(tripId, participantId)
        setParticipant(data)

        // 폼 데이터 초기화
        setFormData({
          korean_name: data.traveler.korean_name,
          english_name: data.traveler.english_name,
          birth_date: data.traveler.birth_date,
          phone: data.traveler.phone,
          gender: data.traveler.gender,
          email: data.traveler.email,
          address: data.traveler.address || "",
          has_companion: data.has_companion,
          companion_names: data.companion_names || "",
          is_proxy_booking: data.is_proxy_booking,
          passport_number: data.traveler.passport_number || "",
          passport_expiry: data.traveler.passport_expiry || "",
          total_amount: data.total_amount,
          paid_amount: data.paid_amount,
          insurance_status: data.insurance_status,
        })
      } catch (error) {
        console.error("참가자 정보 조회 실패:", error)
        alert("참가자 정보를 불러오는데 실패했습니다.")
      } finally {
        setLoading(false)
      }
    }

    fetchParticipant()
  }, [tripId, participantId])

  /**
   * 입력 변경 처리
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  /**
   * 중간 저장
   */
  const handleSave = async () => {
    if (!confirm("저장 하시겠습니까?")) return

    try {
      setSaving(true)
      await tripsApi.updateParticipant(tripId, participantId, formData)
      alert("저장 하였습니다.")
    } catch (error) {
      console.error("저장 실패:", error)
      alert("저장에 실패했습니다.")
    } finally {
      setSaving(false)
    }
  }

  /**
   * 완료 (저장 후 목록으로)
   */
  const handleComplete = async () => {
    if (!confirm("저장 하시겠습니까?")) return

    try {
      setSaving(true)
      await tripsApi.updateParticipant(tripId, participantId, formData)
      alert("정상적으로 저장 하였습니다.")
      router.push(`/trips/${tripId}/participants`)
    } catch (error) {
      console.error("저장 실패:", error)
      alert("저장에 실패했습니다.")
    } finally {
      setSaving(false)
    }
  }

  /**
   * 목록으로 돌아가기
   */
  const handleBack = () => {
    router.push(`/trips/${tripId}/participants`)
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-8 text-center text-text-muted">로딩 중...</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-8">
        {/* 헤더 */}
        <h1 className="text-2xl font-bold text-text-primary mb-6">고객 상세 정보 관리</h1>

        {/* 폼 */}
        <Card className="p-6">
          <div className="space-y-6">
            {/* 기본 정보 */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">성명</label>
                <Input name="korean_name" value={formData.korean_name} onChange={handleChange} />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">생년월일</label>
                <Input type="date" name="birth_date" value={formData.birth_date} onChange={handleChange} />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">영문이름</label>
                <Input name="english_name" value={formData.english_name} onChange={handleChange} />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">연락처</label>
                <Input name="phone" value={formData.phone} onChange={handleChange} />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">성별</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="male">남</option>
                  <option value="female">여</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">국가</label>
                <Input value="대한민국" disabled />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-text-primary mb-2">이메일</label>
                <Input type="email" name="email" value={formData.email} onChange={handleChange} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-text-primary mb-2">주소</label>
                <Input name="address" value={formData.address} onChange={handleChange} />
              </div>
            </div>

            {/* 동행 및 예약 정보 */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">동행 여부</label>
                <Input
                  name="companion_names"
                  value={formData.companion_names}
                  onChange={handleChange}
                  placeholder="동행자 이름 (쉼표로 구분)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">대리 예약 여부</label>
                <select
                  name="is_proxy_booking"
                  value={formData.is_proxy_booking ? "true" : "false"}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      is_proxy_booking: e.target.value === "true",
                    }))
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="false">X</option>
                  <option value="true">O</option>
                </select>
              </div>
            </div>

            {/* 여권 정보 */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">여권 정보</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">여권 번호</label>
                  <Input name="passport_number" value={formData.passport_number} onChange={handleChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">여권 만료일</label>
                  <Input type="date" name="passport_expiry" value={formData.passport_expiry} onChange={handleChange} />
                </div>
              </div>
            </div>

            {/* 결제 정보 */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">결제 여부</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">총 금액</label>
                  <Input type="number" name="total_amount" value={formData.total_amount} onChange={handleChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">결제 금액</label>
                  <Input type="number" name="paid_amount" value={formData.paid_amount} onChange={handleChange} />
                </div>
              </div>
            </div>

            {/* 여행자 보험 */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">여행자 보험 가입 여부</h3>
              <select
                name="insurance_status"
                value={formData.insurance_status}
                onChange={handleChange}
                className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="not_subscribed">미가입</option>
                <option value="subscribed">가입</option>
              </select>
            </div>

            {/* 자동 유효성 검증 결과 */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">자동 유효성 검증 결과</h3>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-secondary">여권정보</span>
                  <span className={participant?.passport_submitted ? "text-status-success" : "text-status-error"}>
                    {participant?.passport_submitted ? "O" : "X"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-secondary">신분확인</span>
                  <span className={participant?.identity_verified ? "text-status-success" : "text-status-error"}>
                    {participant?.identity_verified ? "O" : "X"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-secondary">예약</span>
                  <span className={participant?.booking_confirmed ? "text-status-success" : "text-status-error"}>
                    {participant?.booking_confirmed ? "O" : "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex justify-between mt-8">
            <Button variant="secondary" onClick={handleBack}>
              목록
            </Button>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={handleSave} disabled={saving}>
                중간 저장
              </Button>
              <Button onClick={handleComplete} disabled={saving}>
                완료
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  )
}
