/**
 * 통계 카드 컴포넌트
 * 대시보드의 통계 정보를 표시
 */

import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string // 카드 제목
  value: string | number // 통계 값
  icon: LucideIcon // 아이콘
  trend?: {
    // 추세 정보 (선택)
    value: number // 증감률
    isPositive: boolean // 긍정적 변화 여부
  }
}

export default function StatCard({ title, value, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 bg-primary-light rounded-lg flex items-center justify-center">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        {trend && (
          <span className={`text-sm font-medium ${trend.isPositive ? "text-success" : "text-error"}`}>
            {trend.isPositive ? "+" : ""}
            {trend.value}%
          </span>
        )}
      </div>
      <h3 className="text-sm font-medium text-text-muted mb-1">{title}</h3>
      <p className="text-3xl font-bold text-text-primary">{value}</p>
    </div>
  )
}
