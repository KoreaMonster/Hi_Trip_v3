"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import Layout from "@/components/Layout"
import { Card } from "@/components/ui/Card"

/**
 * 여행 중 관리 - 여행 목록 페이지
 *
 * 화면 설계서 11페이지 구현
 *
 * 기능:
 * 1. 진행 중인 여행 목록 표시 (status=ongoing)
 * 2. 테이블: 구분, 고객 수, 여행명, 담당자, 시작일자
 * 3. 여행 클릭 시 모니터링 페이지로 이동
 *
 * API 연동:
 * - GET /api/trips/?status=ongoing (진행 중인 여행 목록)
 */

// 더미 데이터 (실제로는 API에서 가져옴)
const DUMMY_ONGOING_TRIPS = [
  {
    id: 1,
    name: "A 여행",
    participant_count: 5,
    manager_name: "이연세",
    start_date: "2025.09.12",
    status: "ongoing",
  },
  {
    id: 2,
    name: "B 여행",
    participant_count: 7,
    manager_name: "김원주",
    start_date: "2025.10.12",
    status: "ongoing",
  },
  {
    id: 3,
    name: "C 여행",
    participant_count: 21,
    manager_name: "학김이",
    start_date: "2025.08.15",
    status: "ongoing",
  },
]

export default function OngoingTripsPage() {
  const navigate = useNavigate()
  const [trips, setTrips] = useState(DUMMY_ONGOING_TRIPS)

  // 여행 클릭 시 모니터링 페이지로 이동
  const handleTripClick = (tripId: number) => {
    navigate(`/monitoring?tripId=${tripId}`)
  }

  return (
    <Layout>
      <div className="p-8 space-y-6">
        {/* 헤더 */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary">진행 중인 여행 리스트</h1>
          <p className="text-sm text-text-secondary mt-1">현재 진행 중인 여행을 관리할 수 있습니다</p>
        </div>

        {/* 여행 목록 테이블 */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">구분</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">고객 수</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">여행명</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">담당자</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">시작일자</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((trip, index) => (
                  <tr
                    key={trip.id}
                    onClick={() => handleTripClick(trip.id)}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-text-primary">{index + 1}</td>
                    <td className="py-3 px-4 text-sm text-text-primary">{trip.participant_count}명</td>
                    <td className="py-3 px-4 text-sm text-primary font-medium">{trip.name}</td>
                    <td className="py-3 px-4 text-sm text-text-primary">{trip.manager_name}</td>
                    <td className="py-3 px-4 text-sm text-text-primary">{trip.start_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {trips.length === 0 && (
              <div className="text-center py-12 text-text-secondary">진행 중인 여행이 없습니다</div>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  )
}
