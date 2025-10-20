"use client"

import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Printer, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import Layout from "@/components/Layout"

/**
 * 장소 상세 페이지
 *
 * 화면 설계서 10페이지 구현
 *
 * 기능:
 * 1. 장소 정보 표시 (방문지명, 이미지, 주소, 입장료, 활동 시간)
 * 2. AI 대체 장소 추천
 * 3. AI 자동생성 정보
 * 4. 활동 상세 정보
 * 5. 집결지 상세주소
 * 6. 담당자지원 (통역사 등)
 * 7. 목록, 수정, 인쇄 버튼
 *
 * API 연동:
 * - GET /api/trips/{trip_pk}/schedules/{schedule_pk}/places/{id}/ (장소 상세 조회)
 * - PUT /api/trips/{trip_pk}/schedules/{schedule_pk}/places/{id}/ (장소 수정)
 * - POST /api/places/recommend-alternative/ (AI 대체 장소 추천)
 */

// 더미 데이터
const DUMMY_PLACE = {
  id: 1,
  name: "숭례문",
  image: "/placeholder.svg?height=400&width=600",
  address: "서울특별시 중구 세종대로 40",
  entrance_fee: 2,
  activity_duration: 3,
  ai_info:
    "숭례문은 서울의 대표적인 역사 유적지로, 조선시대의 건축 양식을 잘 보여주는 문화재입니다. 주변에는 남대문시장이 있어 전통 시장 체험도 가능합니다.",
  activity_details:
    "숭례문 관람 후 주변 남대문시장에서 자유 시간을 가집니다. 전통 한식과 다양한 먹거리를 즐길 수 있습니다.",
  meeting_point_details: "숭례문 정문 앞 광장에서 집결합니다. 지하철 4호선 회현역 5번 출구에서 도보 5분 거리입니다.",
  staff: [
    {
      id: 1,
      role: "통역사",
      name: "홍길동",
      phone: "010-1234-5678",
      note: "9시 출근",
    },
  ],
}

export default function PlaceDetailPage() {
  const params = useParams()
  const navigate = useNavigate()
  const tripId = params.id as string
  const scheduleId = params.scheduleId as string
  const placeId = params.placeId as string

  const [place, setPlace] = useState(DUMMY_PLACE)
  const [isEditing, setIsEditing] = useState(false)

  // 목록으로 돌아가기
  const handleBack = () => {
    navigate(`/trips/${tripId}/schedules`)
  }

  // 수정 모드 토글
  const handleEdit = () => {
    setIsEditing(!isEditing)
  }

  // 인쇄
  const handlePrint = () => {
    window.print()
  }

  // AI 대체 장소 추천
  const handleAIRecommend = async () => {
    // TODO: API 연동
    alert("AI 대체 장소 추천 기능은 준비 중입니다.")
  }

  return (
    <Layout>
      <div className="p-8 space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="secondary" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              목록
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">장소 정보</h1>
              <p className="text-sm text-text-secondary mt-1">방문 장소의 상세 정보를 확인할 수 있습니다</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              인쇄
            </Button>
            <Button onClick={handleEdit}>{isEditing ? "저장" : "수정"}</Button>
          </div>
        </div>

      {/* 장소 정보 */}
      <Card>
        <div className="space-y-6">
          {/* 기본 정보 */}
          <div>
            <h2 className="text-lg font-semibold text-text-primary mb-4">장소 정보</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">방문지명</label>
                {isEditing ? <Input value={place.name} /> : <p className="text-text-primary">{place.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">주소</label>
                {isEditing ? <Input value={place.address} /> : <p className="text-text-primary">{place.address}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">입장료 정보</label>
                {isEditing ? (
                  <Input type="number" value={place.entrance_fee} />
                ) : (
                  <p className="text-text-primary">${place.entrance_fee}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">활동 시간</label>
                {isEditing ? (
                  <Input type="number" value={place.activity_duration} />
                ) : (
                  <p className="text-text-primary">{place.activity_duration}시간</p>
                )}
              </div>
            </div>
          </div>

          {/* 이미지 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">이미지</label>
            <img
              src={place.image || "/placeholder.svg"}
              alt={place.name}
              className="w-full h-64 object-cover rounded-lg"
            />
          </div>

          {/* AI 대체 장소 추천 */}
          <div>
            <Button variant="secondary" onClick={handleAIRecommend}>
              <Sparkles className="w-4 h-4 mr-2" />
              AI 대체 장소 추천
            </Button>
          </div>

          {/* AI 자동생성 정보 */}
          <div>
            <h3 className="text-base font-semibold text-text-primary mb-2">AI 자동생성 정보</h3>
            {isEditing ? (
              <textarea
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                rows={4}
                value={place.ai_info}
              />
            ) : (
              <p className="text-text-secondary">{place.ai_info}</p>
            )}
          </div>

          {/* 활동 상세 정보 */}
          <div>
            <h3 className="text-base font-semibold text-text-primary mb-2">활동 상세 정보</h3>
            {isEditing ? (
              <textarea
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                rows={4}
                value={place.activity_details}
              />
            ) : (
              <p className="text-text-secondary">{place.activity_details}</p>
            )}
          </div>

          {/* 집결지 상세주소 */}
          <div>
            <h3 className="text-base font-semibold text-text-primary mb-2">집결지 상세주소</h3>
            {isEditing ? (
              <textarea
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                rows={3}
                value={place.meeting_point_details}
              />
            ) : (
              <p className="text-text-secondary">{place.meeting_point_details}</p>
            )}
          </div>
        </div>
      </Card>

      {/* 담당자지원 */}
      <Card>
        <h2 className="text-lg font-semibold text-text-primary mb-4">담당자지원</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">구분</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">이름</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">연락처</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">비고</th>
              </tr>
            </thead>
            <tbody>
              {place.staff.map((staff) => (
                <tr key={staff.id} className="border-b border-gray-100">
                  <td className="py-3 px-4 text-sm text-text-primary">{staff.role}</td>
                  <td className="py-3 px-4 text-sm text-text-primary">{staff.name}</td>
                  <td className="py-3 px-4 text-sm text-text-primary">{staff.phone}</td>
                  <td className="py-3 px-4 text-sm text-text-primary">{staff.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      </div>
    </Layout>
  )
}
