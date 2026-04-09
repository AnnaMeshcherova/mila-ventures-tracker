"use client";

import { formatWeekLabel } from "@/lib/dates";

interface WeekSelectorProps {
  currentWeek: string;
  onWeekChange: (week: string) => void;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function WeekSelector({
  currentWeek,
  onWeekChange,
}: WeekSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onWeekChange(addDays(currentWeek, -7))}
        className="w-8 h-8 rounded-md border flex items-center justify-center hover:bg-accent transition-colors"
        aria-label="Previous week"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>
      <span className="text-sm font-medium text-muted-foreground min-w-[180px] text-center">
        {formatWeekLabel(currentWeek)}
      </span>
      <button
        onClick={() => onWeekChange(addDays(currentWeek, 7))}
        className="w-8 h-8 rounded-md border flex items-center justify-center hover:bg-accent transition-colors"
        aria-label="Next week"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
    </div>
  );
}
