"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Layout from "@/components/Layout"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { ArrowLeft, Printer, Sparkles } from "lucide-react"

/**
 * 여행 추천 상세 페이지
 *
 * 화면 설계서 15페이지 구현
 *
 * 장소 상세 페이지와 동일한 구조
 */

// 더미 데이터
const DUMMY_PLACE = {
  id: 1,
  name: "남산타워",
  image: "/placeholder.svg?height=400&width=600",
  address: "서울특별시 용산구 남산공원길 105",
  entrance_fee: 15,
  activity_duration: 2,
  ai_info:
    "남산타워는 서울의 랜드마크로, 서울 시내를 한눈에 볼 수 있는 전망대가 있습니다. 특히 야경이 아름다워 연인들에게 인기가 많습니다.",
  activity_details:
    "케이블카를 타고 남산타워에 올라가 전망대에서 서울 시내를 감상합니다. 타워 내부에는 레스토랑과 카페도 있어 식사나 차를 즐길 수 있습니다.",
  meeting_point_details:
    "남산 케이블카 승강장 앞에서 집결합니다. 지하철 4호선 명동역 3번 출구에서 도보 10분 거리입니다.",
  staff: [
    {
      id: 1,
      role: "가이드",
      name: "김가이드",
      phone: "010-9876-5432",
      note: "오전 9시 대기",
    },
  ],
}

export default function RecommendationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const placeId = params.id as string

  const [place, setPlace] = useState(DUMMY_PLACE)

  // 목록으로 돌아가기
  const handleBack = () => {
    router.push("/recommendations")
  }

  // 인쇄
  const handlePrint = () => {
    window.print()
  }

  // AI 대체 장소 추천
  const handleAIRecommend = async () => {
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
              <h1 className="text-2xl font-bold text-text-primary">여행 중 장소 추천 정보</h1>
              <p className="text-sm text-text-secondary mt-1">추천 장소의 상세 정보를 확인할 수 있습니다</p>
            </div>
          </div>
          <Button variant="secondary" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            인쇄
          </Button>
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
                  <p className="text-text-primary">{place.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">주소</label>
                  <p className="text-text-primary">{place.address}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">입장료 정보</label>
                  <p className="text-text-primary">${place.entrance_fee}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">활동 시간</label>
                  <p className="text-text-primary">{place.activity_duration}시간</p>
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
              <p className="text-text-secondary">{place.ai_info}</p>
            </div>

            {/* 활동 상세 정보 */}
            <div>
              <h3 className="text-base font-semibold text-text-primary mb-2">활동 상세 정보</h3>
              <p className="text-text-secondary">{place.activity_details}</p>
            </div>

            {/* 집결지 상세주소 */}
            <div>
              <h3 className="text-base font-semibold text-text-primary mb-2">집결지 상세주소</h3>
              <p className="text-text-secondary">{place.meeting_point_details}</p>
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
