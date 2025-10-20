"use client"

/**
 * 여행 전 관리 - 여행 목록 페이지
 * 화면 설계서 6페이지 참고
 */

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Layout from "@/components/Layout"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table"
import { tripsApi } from "@/lib/api/client"
import { useAuthStore } from "@/lib/store/authStore"
import type { Trip } from "@/lib/types"
import { Plus } from "lucide-react"

export default function TripsPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)

  /**
   * 여행 목록 조회
   * status=planning 필터 적용
   */
  useEffect(() => {
    const fetchTrips = async () => {
      try {
        setLoading(true)
        const data = await tripsApi.getTrips("planning")
        setTrips(data)
      } catch (error) {
        console.error("여행 목록 조회 실패:", error)
        alert("여행 목록을 불러오는데 실패했습니다.")
      } finally {
        setLoading(false)
      }
    }

    fetchTrips()
  }, [])

  /**
   * 여행 클릭 시 참가자 관리 페이지로 이동
   */
  const handleTripClick = (tripId: number) => {
    router.push(`/trips/${tripId}/participants`)
  }

  /**
   * 여행 생성 (총괄담당자만)
   */
  const handleCreateTrip = () => {
    if (user?.role !== "super_admin") {
      alert("총괄담당자만 여행을 생성할 수 있습니다.")
      return
    }
    // TODO: 여행 생성 모달 또는 페이지로 이동
    alert("여행 생성 기능은 추후 구현 예정입니다.")
  }

  return (
    <Layout>
      <div className="p-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-primary">여행 전 관리 리스트</h1>
          {/* 총괄담당자만 여행 생성 버튼 표시 */}
          {user?.role === "super_admin" && (
            <Button onClick={handleCreateTrip} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              여행 생성하기
            </Button>
          )}
        </div>

        {/* 여행 목록 테이블 */}
        <Card>
          {loading ? (
            <div className="p-8 text-center text-text-muted">로딩 중...</div>
          ) : trips.length === 0 ? (
            <div className="p-8 text-center text-text-muted">등록된 여행이 없습니다.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>구분</TableHead>
                  <TableHead>신청인 수</TableHead>
                  <TableHead>여행명</TableHead>
                  <TableHead>담당자</TableHead>
                  <TableHead>시작일자</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((trip, index) => (
                  <TableRow key={trip.id} onClick={() => handleTripClick(trip.id)}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{trip.participant_count > 0 ? `${trip.participant_count}명` : "-"}</TableCell>
                    <TableCell className="font-medium text-text-primary">{trip.name}</TableCell>
                    <TableCell>{trip.manager?.korean_name || "-"}</TableCell>
                    <TableCell>{new Date(trip.start_date).toLocaleDateString("ko-KR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </Layout>
  )
}
