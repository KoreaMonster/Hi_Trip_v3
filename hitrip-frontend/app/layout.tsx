import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

/**
 * 메타데이터 설정
 * SEO 및 브라우저 탭에 표시되는 정보
 */
export const metadata: Metadata = {
  title: "HI-TRIP - 여행 관리 시스템",
  description: "여행 전/중/후 관리를 위한 SaaS 프로그램",
  generator: "v0.app",
}

/**
 * 루트 레이아웃
 * 모든 페이지에 공통으로 적용되는 레이아웃
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard 폰트 로드 (한글) */}
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
        {/* Inter 폰트 로드 (영문) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
