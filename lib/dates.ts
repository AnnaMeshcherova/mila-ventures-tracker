/**
 * Date utilities for weekly update tracking.
 * Weeks start on FRIDAY. "This week" = most recent Friday through next Thursday.
 * All functions compute dates client-side using the user's local timezone
 * to avoid UTC date boundary issues on Vercel.
 */

/** Returns ISO date (YYYY-MM-DD) of the most recent Friday, or today if today is Friday. */
export function getThisFriday(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  // day: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  // Days since last Friday:
  // Fri(5)=0, Sat(6)=1, Sun(0)=2, Mon(1)=3, Tue(2)=4, Wed(3)=5, Thu(4)=6
  const diff = (day - 5 + 7) % 7;
  d.setDate(d.getDate() - diff);
  return formatDate(d);
}

/** Returns ISO date of the Friday before getThisFriday(). */
export function getPreviousFriday(date: Date = new Date()): string {
  const thisFriday = new Date(getThisFriday(date) + "T00:00:00");
  thisFriday.setDate(thisFriday.getDate() - 7);
  return formatDate(thisFriday);
}

/** Returns human-readable label like "Week of Apr 11, 2026" */
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

/** Returns the Friday N weeks offset from the current week's Friday. */
export function getWeekStart(weekOffset: number, fromDate: Date = new Date()): string {
  const friday = new Date(getThisFriday(fromDate) + "T00:00:00");
  friday.setDate(friday.getDate() + weekOffset * 7);
  return formatDate(friday);
}

// Legacy aliases — keep for any code that still references the old names
export const getThisMonday = getThisFriday;
export const getPreviousMonday = getPreviousFriday;
export const getMonday = getWeekStart;
