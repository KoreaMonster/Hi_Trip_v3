"use client"

/**
 * 대시보드 페이지
 * 화면 설계서 5페이지 참고
 */

import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/lib/store/authStore"
import Layout from "@/components/Layout"
import StatCard from "@/components/ui/StatCard"
import { Users, Calendar, TrendingUp, UserCheck } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

/**
 * 더미 데이터 - 월별 예약 추이
 */
const bookingData = [
  { month: "Jan", bookings: 120 },
  { month: "Feb", bookings: 180 },
  { month: "Mar", bookings: 250 },
  { month: "Apr", bookings: 320 },
  { month: "May", bookings: 280 },
  { month: "Jun", bookings: 350 },
  { month: "Jul", bookings: 420 },
  { month: "Aug", bookings: 380 },
]

/**
 * 더미 데이터 - 최신 고객 활동
 */
const recentActivities = [
  { id: 1, name: "김지수", activity: "유럽 자유여행 예약 완료", percentage: 80 },
  { id: 2, name: "박민호", activity: "괌 가족여행 문의", percentage: 75 },
  { id: 3, name: "이수영", activity: "스위스 패키지 진행 중", percentage: 70 },
  { id: 4, name: "정은주", activity: "몰디브 허니문 결제 대기", percentage: 65 },
  { id: 5, name: "이도윤", activity: "일본 온천 여행 리뷰 등록", percentage: 60 },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore()

  /**
   * 페이지 로드 시 인증 상태 확인
   */
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  /**
   * 미인증 시 로그인 페이지로 리다이렉트
   */
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login")
    }
  }, [isAuthenticated, isLoading, navigate])

  // 로딩 중
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-text-muted">로딩 중...</p>
      </div>
    )
  }

  // 미인증
  if (!isAuthenticated) {
    return null
  }

  return (
    <Layout>
      <div className="p-8">
        {/* 페이지 제목 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary mb-2">Dashboard</h1>
          <p className="text-sm text-text-muted">Monday 20/07/2020</p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="신규 고객 수" value="125명" icon={Users} trend={{ value: 8, isPositive: true }} />
          <StatCard title="신규 예약 건수" value="84건" icon={Calendar} trend={{ value: 12, isPositive: true }} />
          <StatCard title="고객 만족도 평균" value="92%" icon={TrendingUp} trend={{ value: 4, isPositive: true }} />
          <StatCard title="재방문 고객 비율" value="36%" icon={UserCheck} trend={{ value: 2, isPositive: true }} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 예약 추이 그래프 */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-text-primary mb-1">예약 추이 그래프</h2>
              <p className="text-sm text-text-muted">월별 예약 추이</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={bookingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#9CA3AF" style={{ fontSize: "12px" }} />
                <YAxis stroke="#9CA3AF" style={{ fontSize: "12px" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="bookings"
                  stroke="#5B8DEF"
                  strokeWidth={2}
                  dot={{ fill: "#5B8DEF", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 최신 고객 활동 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-6">최신 고객 활동</h2>
            <div className="space-y-4">
              {recentActivities.map((activity, index) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-light rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">#{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary mb-1">{activity.name}</p>
                    <p className="text-xs text-text-muted mb-2">{activity.activity}</p>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${activity.percentage}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-medium text-text-muted">{activity.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
