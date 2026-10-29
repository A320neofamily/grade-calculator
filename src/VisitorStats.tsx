import { useEffect, useState } from "react";
import "./VisitorStats.css";

const API_URL = "https://grade-calculator-stats.grade-calculator.workers.dev";

type Stats = {
  today: number;
  total: number;
};

const format = (value: number) => value.toLocaleString();

export default function VisitorStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let active = true;

    const loadStats = async () => {
      try {
        const response = await fetch(`${API_URL}/stats`, { cache: "no-store" });

        if (!response.ok) {
          throw new Error("통계 조회 실패");
        }

        const data: Stats = await response.json();

        if (active && Number.isFinite(data.today) && Number.isFinite(data.total)) {
          setStats(data);
        }
      } catch {
        // Visitor stats are optional; keep them hidden and retry on the next interval.
      }
    };

    const trackAndLoad = async () => {
      try {
        await fetch(`${API_URL}/track`, { cache: "no-store", keepalive: true });
      } catch {}

      await loadStats();
    };

    trackAndLoad();

    const timer = window.setInterval(loadStats, 30000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  if (!stats) return null;

  return (
    <span className="visitor-stats">
      <span>오늘 조회 {format(stats.today)}회</span>
      {" · "}
      <span>누적 조회 {format(stats.total)}회</span>
    </span>
  );
}
