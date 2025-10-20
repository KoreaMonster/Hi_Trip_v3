import { useEffect } from "react"
import { useNavigate } from "react-router-dom"

/**
 * 메인 페이지
 * 로그인 페이지로 리다이렉트
 */
export default function HomePage() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate("/login", { replace: true })
  }, [navigate])

  return null
}
