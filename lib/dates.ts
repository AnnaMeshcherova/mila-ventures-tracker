/**
 * Date utilities for weekly update tracking.
 *
 * The team standup is every **Monday at 1pm**. Each row in `weekly_updates`
 * is bucketed by the Monday-standup date it belongs to. The submission window
 * for a given standup is Friday → Monday 1pm. So:
 *   - Friday/Saturday/Sunday/Monday-before-1pm → bucket = upcoming Monday
 *   - Monday-after-1pm/Tuesday/Wednesday/Thursday → bucket = NEXT Monday
 *
 * The column is still named `week_start` historically, but the value is now
 * always the Monday of the standup that update is for.
 *
 * Dates compute client-side using the user's local timezone to avoid UTC
 * boundary issues on Vercel.
 */

const STANDUP_HOUR = 13; // 1pm

/**
 * Returns ISO date (YYYY-MM-DD) of the Monday standup this submission is for.
 * - If today is Monday before 1pm: today.
 * - If today is Monday at/after 1pm: next Monday.
 * - Otherwise: upcoming Monday.
 */
export function getStandupMonday(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const hours = d.getHours();

  let diff: number;
  if (day === 1) {
    // Monday: today's standup if before 1pm, else next week's
    diff = hours < STANDUP_HOUR ? 0 : 7;
  } else {
    // Days until next Monday
    diff = (1 - day + 7) % 7;
  }

  d.setDate(d.getDate() + diff);
  return formatDate(d);
}

/** Returns ISO date of the Monday standup before getStandupMonday(). */
export function getPreviousStandupMonday(date: Date = new Date()): string {
  const thisMonday = new Date(getStandupMonday(date) + "T00:00:00");
  thisMonday.setDate(thisMonday.getDate() - 7);
  return formatDate(thisMonday);
}

/** Returns the standup Monday N weeks offset from the current standup Monday. */
export function getWeekStart(weekOffset: number, fromDate: Date = new Date()): string {
  const monday = new Date(getStandupMonday(fromDate) + "T00:00:00");
  monday.setDate(monday.getDate() + weekOffset * 7);
  return formatDate(monday);
}

/** Returns human-readable label like "Week of May 11, 2026" */
export function formatWeekLabel(weekStartDate: string): string {
  const d = new Date(weekStartDate + "T00:00:00");
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = d.getDate();
  const year = d.getFullYear();
  return `Week of ${month} ${day}, ${year}`;
}

/** Formats a Date as YYYY-MM-DD using local timezone. */
function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Returns relative time string like "2 min ago", "1 hour ago" */
export function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

// Aliases — code throughout the project still imports these names.
// All point at the new Monday-standup logic.
export const getThisMonday = getStandupMonday;
export const getThisFriday = getStandupMonday;
export const getPreviousMonday = getPreviousStandupMonday;
export const getPreviousFriday = getPreviousStandupMonday;
export const getMonday = getWeekStart;
