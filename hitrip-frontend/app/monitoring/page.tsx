"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import Layout from "@/components/Layout"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Search, AlertTriangle } from "lucide-react"

/**
 * 여행 중 관리 - 고객 관리/모니터링 페이지
 *
 * 화면 설계서 12페이지 구현
 *
 * 기능:
 * 1. 실시간 모니터링 (건강 상태, 위치 이탈)
 * 2. 테이블: 이름, 생년월일, 성별, 연락처, 이메일, 대화, 위험여부, 건강상태
 * 3. 건강상태: 심박수, 산소포화도
 * 4. 이탈여부: 빨간색 표시
 * 5. "보기" 버튼 (대화)
 * 6. 검색 기능
 *
 * API 연동:
 * - GET /api/monitoring/trips/{id}/status/ (실시간 상태)
 * - GET /api/monitoring/trips/{id}/alerts/ (경고 알림)
 * - POST /api/monitoring/trips/{id}/generate-demo/ (더미 데이터 생성)
 */

// 더미 데이터
const DUMMY_PARTICIPANTS = [
  {
    id: 1,
    name: "이연세",
    birth_date: "111111",
    gender: "남",
    phone: "000-0000-0000",
    email: "dasd1@dasda.com",
    has_chat: true,
    chat_count: 3,
    is_danger: false,
    heart_rate: 90,
    oxygen_saturation: 98,
    is_out_of_range: false,
    distance_from_group: 0,
  },
  {
    id: 2,
    name: "둘리",
    birth_date: "222222",
    gender: "남",
    phone: "000-0000-0000",
    email: "test@test.com",
    has_chat: false,
    chat_count: 0,
    is_danger: true,
    heart_rate: 110,
    oxygen_saturation: 87,
    is_out_of_range: true,
    distance_from_group: 5,
  },
  {
    id: 3,
    name: "펭수",
    birth_date: "333333",
    gender: "여",
    phone: "000-0000-0000",
    email: "test2@test.com",
    has_chat: false,
    chat_count: 0,
    is_danger: true,
    heart_rate: 135,
    oxygen_saturation: 94,
    is_out_of_range: false,
    distance_from_group: 0,
  },
  {
    id: 4,
    name: "뽀로로",
    birth_date: "444444",
    gender: "여",
    phone: "000-0000-0000",
    email: "test3@test.com",
    has_chat: true,
    chat_count: 1,
    is_danger: false,
    heart_rate: 90,
    oxygen_saturation: 84,
    is_out_of_range: false,
    distance_from_group: 0,
  },
  {
    id: 5,
    name: "에디",
    birth_date: "121314",
    gender: "남",
    phone: "000-0000-0000",
    email: "test4@test.com",
    has_chat: true,
    chat_count: 2,
    is_danger: false,
    heart_rate: 187,
    oxygen_saturation: 95,
    is_out_of_range: true,
    distance_from_group: 3,
  },
]

export default function MonitoringPage() {
  const searchParams = useSearchParams()
  const tripId = searchParams.get("tripId")

  const [participants, setParticipants] = useState(DUMMY_PARTICIPANTS)
  const [searchQuery, setSearchQuery] = useState("")

  // 검색 필터링
  const filteredParticipants = participants.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))

  // 대화 보기
  const handleViewChat = (participantId: number) => {
    // TODO: 채팅 모달 열기 (화면 설계서 13페이지 - 구현 안 함)
    alert("채팅 기능은 구현되지 않았습니다.")
  }

  return (
    <Layout>
      <div className="p-8 space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">신청자 현황</h1>
            <p className="text-sm text-text-secondary mt-1">여행 참가자의 실시간 상태를 모니터링할 수 있습니다</p>
          </div>
          {/* 검색 */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <Input
              type="text"
              placeholder="이름"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* 참가자 모니터링 테이블 */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">이름</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">생년월일</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">성별</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">연락처</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">이메일</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">대화</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">위험여부</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">건강상태확인</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((participant) => (
                  <tr key={participant.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-sm text-text-primary font-medium">{participant.name}</td>
                    <td className="py-3 px-4 text-sm text-text-primary">{participant.birth_date}</td>
                    <td className="py-3 px-4 text-sm text-text-primary">{participant.gender}</td>
                    <td className="py-3 px-4 text-sm text-text-primary">{participant.phone}</td>
                    <td className="py-3 px-4 text-sm text-text-primary">{participant.email}</td>
                    <td className="py-3 px-4">
                      {participant.has_chat ? (
                        <button
                          onClick={() => handleViewChat(participant.id)}
                          className="text-sm text-primary hover:underline"
                        >
                          보기
                        </button>
                      ) : (
                        <span className="text-sm text-text-muted">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {participant.is_danger ? (
                          <AlertTriangle className="w-4 h-4 text-error" />
                        ) : (
                          <span className="text-sm text-text-muted">-</span>
                        )}
                        {participant.is_out_of_range && (
                          <span className="text-sm text-error font-medium">{participant.distance_from_group}km</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-sm ${
                            participant.heart_rate > 100 || participant.heart_rate < 60
                              ? "text-error font-medium"
                              : "text-text-primary"
                          }`}
                        >
                          {participant.heart_rate}
                        </span>
                        <span
                          className={`text-sm ${
                            participant.oxygen_saturation < 95 ? "text-error font-medium" : "text-text-primary"
                          }`}
                        >
                          {participant.oxygen_saturation}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredParticipants.length === 0 && (
              <div className="text-center py-12 text-text-secondary">검색 결과가 없습니다</div>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  )
}
