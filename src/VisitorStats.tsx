import { useEffect, useState } from "react"
import "./VisitorStats.css"

const API_URL = "https://grade-calculator-stats.grade-calculator.workers.dev"

type Stats = {
  today: number
  total: number
}

const format = (value: number) => value.toLocaleString()
let initialStatsRequest: Promise<Stats> | null = null

function trackAndLoadStats() {
  if (initialStatsRequest) return initialStatsRequest
  initialStatsRequest = (async () => {
    try {
      await fetch(`${API_URL}/track`, { cache: "no-store", keepalive: true })
    } catch {
      // Tracking is optional; still try to display the current counts.
    }
    const response = await fetch(`${API_URL}/stats`, { cache: "no-store" })
    if (!response.ok) throw new Error("통계 조회 실패")
    return response.json() as Promise<Stats>
  })()
  return initialStatsRequest
}

export default function VisitorStats() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    let active = true

    const loadStats = async () => {
      try {
        const data = await trackAndLoadStats()
        if (
          active &&
          Number.isFinite(data.today) &&
          Number.isFinite(data.total)
        ) {
          setStats(data)
        }
      } catch {
        // Visitor stats are optional; keep them hidden when unavailable.
      }
    }

    void loadStats()
    return () => {
      active = false
    }
  }, [])

  if (!stats) return null

  return (
    <span className="visitor-stats">
      <span>오늘 조회 {format(stats.today)}회</span>
      {" · "}
      <span>누적 조회 {format(stats.total)}회</span>
    </span>
  )
}
