
import { useEffect, useState } from "react";

const API_URL =
  "https://grade-calculator-stats.grade-calculator.workers.dev";

type Stats = {
  today: number;
  total: number;
};

export default function VisitorStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let active = true;

    const loadStats = async () => {
      try {
        const response = await fetch(`${API_URL}/stats`);
        if (!response.ok) throw new Error("통계 조회 실패");

        const data: Stats = await response.json();
        if (active) setStats(data);
      } catch (error) {
        console.error("통계 로드 실패:", error);
      }
    };

    loadStats();
    fetch(`${API_URL}/track`).catch((error) => {
      console.error("조회 기록 저장 실패:", error);
    });
    const timer = window.setInterval(loadStats, 30000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="visitor-stats">
      {stats ? (
        <>
          <span>오늘 조회 {stats.today.toLocaleString()}회</span>
          <span className="visitor-stats-separator"> · </span>
          <span>누적 조회 {stats.total.toLocaleString()}회</span>
        </>
      ) : (
        "조회 통계를 불러오는 중..."
      )}
    </div>
  );
}
