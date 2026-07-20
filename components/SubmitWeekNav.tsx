"use client";

import { useRouter } from "next/navigation";
import WeekSelector from "@/components/WeekSelector";

interface SubmitWeekNavProps {
  currentWeek: string;
  minWeek: string;
  maxWeek: string;
}

/**
 * Bridges the server-rendered /submit page to the controlled WeekSelector.
 * Week lives in the `?week=` search param so the page can keep fetching that
 * week's update server-side.
 */
export default function SubmitWeekNav({
  currentWeek,
  minWeek,
  maxWeek,
}: SubmitWeekNavProps) {
  const router = useRouter();

  return (
    <WeekSelector
      currentWeek={currentWeek}
      minWeek={minWeek}
      maxWeek={maxWeek}
      onWeekChange={(week) => router.push(`/submit?week=${week}`)}
    />
  );
}
