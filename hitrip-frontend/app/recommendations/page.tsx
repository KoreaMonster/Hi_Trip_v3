"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Layout from "@/components/Layout"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { MapPin, Star } from "lucide-react"

/**
 * 여행 추천 페이지
 *
 * 화면 설계서 14페이지 구현
 *
 * 기능:
 * 1. 장소 추천 목록 표시
 * 2. 지역별 필터 (전체보기, 서울 동작구, 서울 서대문구, 경기도 이천)
 * 3. 카드 레이아웃: 이미지, 장소명, 추천 강도, 어드벤티지
 * 4. 클릭 시 상세 페이지로 이동
 *
 * API 연동:
 * - POST /api/places/recommend-fixed/ (장소 추천)
 */

// 더미 데이터
const DUMMY_RECOMMENDATIONS = [
  {
    id: 1,
    name: "남산타워",
    image: "/placeholder.svg?height=200&width=300",
    region: "서울 동작구",
    priority: 1,
    advantage: "20% 할인",
  },
  {
    id: 2,
    name: "경복궁",
    image: "/placeholder.svg?height=200&width=300",
    region: "서울 서대문구",
    priority: 3,
    advantage: "무료 입장",
  },
  {
    id: 3,
    name: "이천 도자기 마을",
    image: "/placeholder.svg?height=200&width=300",
    region: "경기도 이천",
    priority: 1,
    advantage: "체험 프로그램 포함",
  },
  {
    id: 4,
    name: "북촌 한옥마을",
    image: "/placeholder.svg?height=200&width=300",
    region: "서울 동작구",
    priority: 2,
    advantage: "가이드 투어 제공",
  },
  {
    id: 5,
    name: "명동 거리",
    image: "/placeholder.svg?height=200&width=300",
    region: "서울 서대문구",
    priority: 1,
    advantage: "쇼핑 할인 쿠폰",
  },
  {
    id: 6,
    name: "이천 온천",
    image: "/placeholder.svg?height=200&width=300",
    region: "경기도 이천",
    priority: 2,
    advantage: "30% 할인",
  },
]

const REGIONS = ["전체보기", "서울 동작구", "서울 서대문구", "경기도 이천"]

export default function RecommendationsPage() {
  const router = useRouter()
  const [selectedRegion, setSelectedRegion] = useState("전체보기")
  const [recommendations, setRecommendations] = useState(DUMMY_RECOMMENDATIONS)

  // 지역별 필터링
  const filteredRecommendations =
    selectedRegion === "전체보기" ? recommendations : recommendations.filter((r) => r.region === selectedRegion)

  // 추천 강도 텍스트
  const getPriorityText = (priority: number) => {
    return `${priority}순위`
  }

  // 장소 상세 페이지로 이동
  const handlePlaceClick = (placeId: number) => {
    router.push(`/recommendations/${placeId}`)
  }

  return (
    <Layout>
      <div className="p-8 space-y-6">
        {/* 헤더 */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary">여행 추천</h1>
          <p className="text-sm text-text-secondary mt-1">AI가 추천하는 여행지를 확인할 수 있습니다</p>
        </div>

        {/* 지역 필터 */}
        <div className="flex gap-2">
          {REGIONS.map((region) => (
            <Button
              key={region}
              variant={selectedRegion === region ? "primary" : "secondary"}
              onClick={() => setSelectedRegion(region)}
            >
              {region}
            </Button>
          ))}
        </div>

        {/* 추천 장소 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredRecommendations.map((place) => (
            <Card
              key={place.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handlePlaceClick(place.id)}
            >
              {/* 이미지 */}
              <div className="relative h-48 bg-gray-200 rounded-t-lg overflow-hidden">
                <img src={place.image || "/placeholder.svg"} alt={place.name} className="w-full h-full object-cover" />
                <div className="absolute top-3 right-3 bg-primary text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  {getPriorityText(place.priority)}
                </div>
              </div>

              {/* 정보 */}
              <div className="p-4 space-y-2">
                <h3 className="text-lg font-semibold text-text-primary">{place.name}</h3>
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <MapPin className="w-4 h-4" />
                  <span>{place.region}</span>
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <span className="text-sm text-success font-medium">{place.advantage}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredRecommendations.length === 0 && (
          <div className="text-center py-12 text-text-secondary">추천 장소가 없습니다</div>
        )}
      </div>
    </Layout>
  )
}
