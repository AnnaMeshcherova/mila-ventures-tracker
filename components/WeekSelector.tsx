"use client";

import { formatWeekLabel } from "@/lib/dates";

interface WeekSelectorProps {
  currentWeek: string;
  onWeekChange: (week: string) => void;
  /** Earliest selectable week (YYYY-MM-DD). Omit for no lower bound. */
  minWeek?: string;
  /** Latest selectable week (YYYY-MM-DD). Omit for no upper bound. */
  maxWeek?: string;
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
  minWeek,
  maxWeek,
}: WeekSelectorProps) {
  const prevWeek = addDays(currentWeek, -7);
  const nextWeek = addDays(currentWeek, 7);

  // YYYY-MM-DD strings compare correctly lexicographically.
  const prevDisabled = minWeek !== undefined && prevWeek < minWeek;
  const nextDisabled = maxWeek !== undefined && nextWeek > maxWeek;

  const arrowClass =
    "w-8 h-8 rounded-md border flex items-center justify-center transition-colors enabled:hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onWeekChange(prevWeek)}
        disabled={prevDisabled}
        className={arrowClass}
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
        onClick={() => onWeekChange(nextWeek)}
        disabled={nextDisabled}
        className={arrowClass}
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
