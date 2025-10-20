"use client"

/**
 * 여행 전 관리 - 고객 관리 페이지
 * 화면 설계서 7페이지 참고
 */

import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import Layout from "@/components/Layout"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table"
import { tripsApi } from "@/lib/api/client"
import type { TripParticipant } from "@/lib/types"
import { Search, Check, X } from "lucide-react"

export default function ParticipantsPage() {
  const params = useParams()
  const navigate = useNavigate()
  const tripId = Number(params.id)

  const [participants, setParticipants] = useState<TripParticipant[]>([])
  const [filteredParticipants, setFilteredParticipants] = useState<TripParticipant[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)

  /**
   * 참가자 목록 조회
   */
  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        setLoading(true)
        const data = await tripsApi.getParticipants(tripId)
        setParticipants(data)
        setFilteredParticipants(data)
      } catch (error) {
        console.error("참가자 목록 조회 실패:", error)
        alert("참가자 목록을 불러오는데 실패했습니다.")
      } finally {
        setLoading(false)
      }
    }

    fetchParticipants()
  }, [tripId])

  /**
   * 검색 처리
   */
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredParticipants(participants)
    } else {
      const filtered = participants.filter((p) =>
        p.traveler.korean_name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      setFilteredParticipants(filtered)
    }
  }, [searchQuery, participants])

  /**
   * 참가자 클릭 시 상세 페이지로 이동
   */
  const handleParticipantClick = (participantId: number) => {
    navigate(`/trips/${tripId}/participants/${participantId}`)
  }

  /**
   * 상태 아이콘 렌더링
   */
  const renderStatusIcon = (status: boolean) => {
    return status ? <Check className="w-5 h-5 text-status-success" /> : <X className="w-5 h-5 text-status-error" />
  }

  return (
    <Layout>
      <div className="p-8">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary mb-4">신청자 현황</h1>
          <p className="text-sm text-text-muted">신청인원: {participants.length}명</p>
        </div>

        {/* 검색 */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <Input
              type="text"
              placeholder="이름 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* 참가자 목록 테이블 */}
        <Card>
          {loading ? (
            <div className="p-8 text-center text-text-muted">로딩 중...</div>
          ) : filteredParticipants.length === 0 ? (
            <div className="p-8 text-center text-text-muted">
              {searchQuery ? "검색 결과가 없습니다." : "등록된 참가자가 없습니다."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름/생년월일</TableHead>
                  <TableHead>성별</TableHead>
                  <TableHead>연락처</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>여권 제출</TableHead>
                  <TableHead>신분 확인</TableHead>
                  <TableHead>예약 정보</TableHead>
                  <TableHead>결제 상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParticipants.map((participant) => (
                  <TableRow key={participant.id} onClick={() => handleParticipantClick(participant.id)}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-text-primary">{participant.traveler.korean_name}</div>
                        <div className="text-xs text-text-muted">
                          {new Date(participant.traveler.birth_date).toLocaleDateString("ko-KR", {
                            year: "2-digit",
                            month: "2-digit",
                            day: "2-digit",
                          })}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{participant.traveler.gender === "male" ? "남성" : "여성"}</TableCell>
                    <TableCell>{participant.traveler.phone}</TableCell>
                    <TableCell>{participant.traveler.email}</TableCell>
                    <TableCell>{renderStatusIcon(participant.passport_submitted)}</TableCell>
                    <TableCell>{renderStatusIcon(participant.identity_verified)}</TableCell>
                    <TableCell>{renderStatusIcon(participant.booking_confirmed)}</TableCell>
                    <TableCell>
                      {participant.paid_amount >= participant.total_amount ? (
                        <span className="text-status-success font-medium">완료</span>
                      ) : participant.paid_amount > 0 ? (
                        <span className="text-status-warning font-medium">진행중</span>
                      ) : (
                        <span className="text-status-error font-medium">대기</span>
                      )}
                    </TableCell>
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
