"use client"

import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Plus, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs"
import { Modal } from "@/components/ui/Modal"
import { Input } from "@/components/ui/Input"
import Layout from "@/components/Layout"

/**
 * 일정 관리 페이지
 *
 * 화면 설계서 9페이지 구현
 *
 * 기능:
 * 1. 일차별 탭으로 일정 구분
 * 2. 일정 목록 표시 (구분, 시간, 방문지, 이동수단, 주요 내용, 집결지, 예산)
 * 3. 일정 추가/수정/삭제
 * 4. 순서 변경 (드래그 앤 드롭 - 간단하게 버튼으로 구현)
 * 5. 장소 클릭 시 상세 페이지로 이동
 *
 * API 연동:
 * - GET /api/trips/{trip_pk}/schedules/ (일정 목록 조회)
 * - POST /api/trips/{trip_pk}/schedules/ (일정 추가)
 * - PUT /api/trips/{trip_pk}/schedules/{id}/ (일정 수정)
 * - DELETE /api/trips/{trip_pk}/schedules/{id}/ (일정 삭제)
 */

// 더미 데이터 (실제로는 API에서 가져옴)
const DUMMY_SCHEDULES = [
  {
    id: 1,
    day: 1,
    order: 1,
    start_time: "09:00",
    end_time: "10:00",
    place_name: "A 지역",
    transportation: "단체버스",
    activity: "이동",
    meeting_point: "숭례문",
    budget: 10,
  },
  {
    id: 2,
    day: 1,
    order: 2,
    start_time: "10:00",
    end_time: "13:00",
    place_name: "B 지역",
    transportation: "도보",
    activity: "단체 식사",
    meeting_point: "식사장소",
    budget: 0,
  },
  {
    id: 3,
    day: 1,
    order: 3,
    start_time: "13:00",
    end_time: "20:00",
    place_name: "C 지역",
    transportation: "개인도보",
    activity: "개인 여행",
    meeting_point: "숙소A",
    budget: 25,
  },
  {
    id: 4,
    day: 2,
    order: 1,
    start_time: "09:00",
    end_time: "12:00",
    place_name: "D 지역",
    transportation: "단체버스",
    activity: "관광",
    meeting_point: "호텔 로비",
    budget: 15,
  },
]

export default function SchedulesPage() {
  const params = useParams()
  const navigate = useNavigate()
  const tripId = params.id as string

  // 상태 관리
  const [activeDay, setActiveDay] = useState("1")
  const [schedules, setSchedules] = useState(DUMMY_SCHEDULES)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  // 현재 선택된 일차의 일정 필터링
  const currentDaySchedules = schedules
    .filter((s) => s.day === Number.parseInt(activeDay))
    .sort((a, b) => a.order - b.order)

  // 전체 일차 수 계산 (최대 일차)
  const totalDays = schedules.length > 0 ? Math.max(...schedules.map((s) => s.day)) : 1

  // 일정 추가 핸들러
  const handleAddSchedule = () => {
    setIsAddModalOpen(true)
  }

  // 장소 상세 페이지로 이동
  const handlePlaceClick = (scheduleId: number) => {
    // 실제로는 schedule의 place_id를 사용해야 함
    navigate(`/trips/${tripId}/schedules/${scheduleId}/places/1`)
  }

  return (
    <Layout>
      <div className="p-8 space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">일정 관리</h1>
            <p className="text-sm text-text-secondary mt-1">여행 일정을 일차별로 관리할 수 있습니다</p>
          </div>
          <Button onClick={handleAddSchedule}>
            <Plus className="w-4 h-4 mr-2" />
            일정 추가하기
          </Button>
        </div>

      {/* 일차별 탭 */}
      <Card>
        <Tabs value={activeDay} onValueChange={setActiveDay}>
          <TabsList>
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => (
              <TabsTrigger key={day} value={String(day)}>
                {day}일차
              </TabsTrigger>
            ))}
          </TabsList>

          {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => (
            <TabsContent key={day} value={String(day)}>
              {/* 일정 테이블 */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">구분</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">변경시간</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">방문지</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">이동수단</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">주요 내용</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">집결지</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">예산</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">순서</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentDaySchedules.map((schedule) => (
                      <tr key={schedule.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-sm text-text-primary">{schedule.order}</td>
                        <td className="py-3 px-4 text-sm text-text-primary">
                          {schedule.start_time}-{schedule.end_time}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handlePlaceClick(schedule.id)}
                            className="text-sm text-primary hover:underline"
                          >
                            {schedule.place_name}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-sm text-text-primary">{schedule.transportation}</td>
                        <td className="py-3 px-4 text-sm text-text-primary">{schedule.activity}</td>
                        <td className="py-3 px-4 text-sm text-text-primary">{schedule.meeting_point}</td>
                        <td className="py-3 px-4 text-sm text-text-primary">${schedule.budget}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button className="text-text-secondary hover:text-text-primary">
                              <GripVertical className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {currentDaySchedules.length === 0 && (
                  <div className="text-center py-12 text-text-secondary">등록된 일정이 없습니다</div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </Card>

      {/* 일정 추가 모달 */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="일정 추가" size="lg">
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">일차</label>
              <Input type="number" placeholder="1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">순서</label>
              <Input type="number" placeholder="1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">시작 시간</label>
              <Input type="time" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">종료 시간</label>
              <Input type="time" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">방문지</label>
            <Input placeholder="방문지명을 입력하세요" />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">이동수단</label>
            <Input placeholder="예: 단체버스, 도보, 개인" />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">주요 내용</label>
            <Input placeholder="활동 내용을 입력하세요" />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">집결지</label>
            <Input placeholder="집결 장소를 입력하세요" />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">예산 ($)</label>
            <Input type="number" placeholder="0" />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
              취소
            </Button>
            <Button type="submit">추가</Button>
          </div>
        </form>
      </Modal>
      </div>
    </Layout>
  )
}
