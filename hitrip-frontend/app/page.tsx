/**
 * 메인 페이지
 * 로그인 페이지로 리다이렉트
 */

import { redirect } from "next/navigation"

export default function HomePage() {
  // 로그인 페이지로 리다이렉트
  redirect("/login")
}
