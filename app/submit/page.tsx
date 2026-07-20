import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getThisMonday, getWeekStart, formatWeekLabel } from "@/lib/dates";
import UpdateForm from "@/components/UpdateForm";
import SubmitWeekNav from "@/components/SubmitWeekNav";

// How far people may range from the current standup week.
const WEEKS_BACK = 8;
const WEEKS_FORWARD = 1;

/**
 * Resolves the `?week=` param to a selectable standup Monday.
 * Returns null for anything malformed, not a Monday, or out of range — the
 * caller redirects rather than clamping, so nobody silently edits a week they
 * didn't intend to land on.
 */
function resolveWeek(
  raw: string | string[] | undefined,
  minWeek: string,
  maxWeek: string
): string | null {
  if (typeof raw !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;

  const d = new Date(raw + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  if (d.getDay() !== 1) return null; // must be a Monday standup date

  // YYYY-MM-DD strings compare correctly lexicographically.
  if (raw < minWeek || raw > maxWeek) return null;

  return raw;
}

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const thisMonday = getThisMonday();
  const minWeek = getWeekStart(-WEEKS_BACK);
  const maxWeek = getWeekStart(WEEKS_FORWARD);

  const weekParam = (await searchParams).week;
  const selectedWeek =
    weekParam === undefined
      ? thisMonday
      : resolveWeek(weekParam, minWeek, maxWeek);

  // Malformed or out-of-range week → back to the current week.
  if (selectedWeek === null) {
    redirect("/submit");
  }

  const isCurrentWeek = selectedWeek === thisMonday;

  // Fetch the selected week's update (including drafts) with new fields
  const { data: currentUpdate } = await supabase
    .from("weekly_updates")
    .select("*, commitment, announcements")
    .eq("user_id", user.id)
    .eq("week_start", selectedWeek)
    .maybeSingle();

  // Fetch the most recent submitted update before the selected week
  // (uses lt instead of eq to handle the Monday→Friday migration gracefully)
  const { data: previousUpdate } = await supabase
    .from("weekly_updates")
    .select("*, commitment, announcements")
    .eq("user_id", user.id)
    .lt("week_start", selectedWeek)
    .eq("is_draft", false)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
      {!isCurrentWeek && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {selectedWeek < thisMonday
            ? "You're filling in a past week. This isn't the current standup week."
            : "You're filing ahead for an upcoming week."}{" "}
          <Link href="/submit" className="font-medium underline">
            Back to this week
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Submit your weekly update
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Updates are bucketed to the Monday standup they belong to.
          </p>
        </div>
        <SubmitWeekNav
          currentWeek={selectedWeek}
          minWeek={minWeek}
          maxWeek={maxWeek}
        />
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_320px]">
        {/* Left column: form */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {/* key= forces a remount on week change: UpdateForm seeds all its
              field state via useState initializers, which would otherwise keep
              showing the previous week's content. */}
          <UpdateForm
            key={selectedWeek}
            currentUpdate={currentUpdate}
            previousUpdate={previousUpdate}
            weekStart={selectedWeek}
          />
        </div>

        {/* Right column: last week sidebar */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm h-fit">
          <h2 className="text-sm font-semibold text-foreground">
            Previous Update
          </h2>
          {previousUpdate && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatWeekLabel(previousUpdate.week_start)}
            </p>
          )}

          {previousUpdate ? (
            <div className="mt-4 space-y-4">
              {previousUpdate.achievements?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Achievements
                  </p>
                  <ul className="mt-1 list-disc pl-4 space-y-0.5 text-sm text-foreground">
                    {previousUpdate.achievements.map(
                      (item: string, i: number) => (
                        <li key={i}>{item}</li>
                      )
                    )}
                  </ul>
                </div>
              )}

              {previousUpdate.planned_tasks?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Planned Tasks
                  </p>
                  <ul className="mt-1 list-disc pl-4 space-y-0.5 text-sm text-foreground">
                    {previousUpdate.planned_tasks.map(
                      (item: string, i: number) => (
                        <li key={i}>{item}</li>
                      )
                    )}
                  </ul>
                </div>
              )}

              {previousUpdate.blockers?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Blockers
                  </p>
                  <ul className="mt-1 list-disc pl-4 space-y-0.5 text-sm text-foreground">
                    {previousUpdate.blockers.map(
                      (item: string, i: number) => (
                        <li key={i}>{item}</li>
                      )
                    )}
                  </ul>
                </div>
              )}

              {previousUpdate.commitment && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    To get done
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {previousUpdate.commitment}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No submitted update before this week.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
