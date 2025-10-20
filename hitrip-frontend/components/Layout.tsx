"use client"

import type React from "react"

/**
 * 전체 레이아웃 컴포넌트
 * 화면 설계서 5페이지 참고
 * Sidebar + Header + Content 구조
 */

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/store/authStore"
import { LayoutDashboard, Plane, Users, Calendar, MapPin, FileText, Search, LogOut } from "lucide-react"

interface LayoutProps {
  children: React.ReactNode
}

/**
 * 메인 레이아웃
 */
export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState("")

  /**
   * 로그아웃 처리
   */
  const handleLogout = async () => {
    try {
      await logout()
      router.push("/login")
    } catch (error) {
      console.error("로그아웃 실패:", error)
    }
  }

  /**
   * 검색 처리
   */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: 검색 기능 구현
    console.log("검색:", searchQuery)
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* 로고 */}
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-text-primary">HI-TRIP</span>
          </Link>
        </div>

        {/* 메뉴 */}
        <nav className="flex-1 py-6">
          <div className="px-3 space-y-1">
            {/* Dashboard */}
            <Link
              href="/dashboard"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                pathname === "/dashboard"
                  ? "bg-primary-light text-primary font-medium"
                  : "text-text-secondary hover:bg-gray-50"
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span>Dashboard</span>
            </Link>

            {/* 여행 전 관리 */}
            <div className="pt-4">
              <p className="px-3 text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">여행 전 관리</p>
              <Link
                href="/trips/planning"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  pathname.startsWith("/trips/planning")
                    ? "bg-primary-light text-primary font-medium"
                    : "text-text-secondary hover:bg-gray-50"
                }`}
              >
                <Users className="w-5 h-5" />
                <span>고객 관리</span>
              </Link>
              <Link
                href="/schedules"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  pathname.startsWith("/schedules")
                    ? "bg-primary-light text-primary font-medium"
                    : "text-text-secondary hover:bg-gray-50"
                }`}
              >
                <Calendar className="w-5 h-5" />
                <span>일정 관리</span>
              </Link>
            </div>

            {/* 여행 중 관리 */}
            <div className="pt-4">
              <p className="px-3 text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">여행 중 관리</p>
              <Link
                href="/trips/ongoing"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  pathname.startsWith("/trips/ongoing")
                    ? "bg-primary-light text-primary font-medium"
                    : "text-text-secondary hover:bg-gray-50"
                }`}
              >
                <Users className="w-5 h-5" />
                <span>고객 관리</span>
              </Link>
              <Link
                href="/recommendations"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  pathname.startsWith("/recommendations")
                    ? "bg-primary-light text-primary font-medium"
                    : "text-text-secondary hover:bg-gray-50"
                }`}
              >
                <MapPin className="w-5 h-5" />
                <span>여행 추천</span>
              </Link>
            </div>

            {/* 여행 후 관리 */}
            <div className="pt-4">
              <p className="px-3 text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">여행 후 관리</p>
              <Link
                href="/trips/completed"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  pathname.startsWith("/trips/completed")
                    ? "bg-primary-light text-primary font-medium"
                    : "text-text-secondary hover:bg-gray-50"
                }`}
              >
                <FileText className="w-5 h-5" />
                <span>여행 후 관리</span>
              </Link>
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
          {/* 검색바 */}
          <form onSubmit={handleSearch} className="flex-1 max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
              <input
                type="text"
                placeholder="고객 이름 또는 여행 상품 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </form>

          {/* 사용자 정보 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-white">{user?.korean_name?.[0] || "U"}</span>
              </div>
              <span className="text-sm font-medium text-text-primary">{user?.korean_name || "사용자"} 님</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
