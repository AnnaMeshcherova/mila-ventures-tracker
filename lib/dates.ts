/**
 * Date utilities for weekly update tracking.
 * All functions compute dates client-side using the user's local timezone
 * to avoid UTC date boundary issues on Vercel.
 */

/** Returns ISO date (YYYY-MM-DD) of the most recent Monday, or today if today is Monday. */
export function getThisMonday(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  // day: 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return formatDate(d);
}

/** Returns ISO date of the Monday before getThisMonday(). */
export function getPreviousMonday(date: Date = new Date()): string {
  const thisMonday = new Date(getThisMonday(date) + "T00:00:00");
  thisMonday.setDate(thisMonday.getDate() - 7);
  return formatDate(thisMonday);
}

/** Returns human-readable label like "Week of Apr 6, 2026" */
export function formatWeekLabel(mondayDate: string): string {
  const d = new Date(mondayDate + "T00:00:00");
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

/** Returns the Monday N weeks before the given Monday date string. */
export function getMonday(weekOffset: number, fromDate: Date = new Date()): string {
  const monday = new Date(getThisMonday(fromDate) + "T00:00:00");
  monday.setDate(monday.getDate() + weekOffset * 7);
  return formatDate(monday);
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
