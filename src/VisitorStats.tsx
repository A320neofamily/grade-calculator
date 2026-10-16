import { useEffect, useState } from "react"
import "./VisitorStats.css"

type VisitorStatsData = {
  today: number
  total: number
  updatedAt?: string
}

const API_URL =
  "https://script.google.com/macros/s/AKfycbyEiYrkmtPt-jryyXDEoKeqlOy5sLXqkXf0bBDlPtnwRuOXvxWhKKm4hbb5PnNbekfNYA/exec"

export default function VisitorStats() {
  const [stats, setStats] = useState<VisitorStatsData | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadStats() {
      try {
        const response = await fetch(API_URL)

        if (!response.ok) {
          throw new Error("통계를 불러오지 못했습니다.")
        }

        const data: VisitorStatsData = await response.json()

        if (typeof data.today !== "number" || typeof data.total !== "number") {
          throw new Error("통계 데이터 형식이 올바르지 않습니다.")
        }

        if (!cancelled) {
          setStats(data)
          setError(false)
        }
      } catch {
        if (!cancelled) {
          setError(true)
        }
      }
    }

    loadStats()

    return () => {
      cancelled = true
    }
  }, [])

  const format = (value: number) => new Intl.NumberFormat("ko-KR").format(value)

  if (error && !stats) {
    return (
      <span className="visitor-stats">방문자 통계를 불러올 수 없습니다.</span>
    )
  }

  return (
    <span className="visitor-stats">
      <span>오늘 조회 {format(stats?.today ?? 0)}회/span>
      {" · "}
      <span>누적 조회 {format(stats?.total ?? 0)}회</span>
    </span>
  )
}
