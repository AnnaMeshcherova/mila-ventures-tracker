import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getThisMonday, getPreviousMonday, formatWeekLabel } from "@/lib/dates";
import UpdateForm from "@/components/UpdateForm";

export default async function SubmitPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const thisMonday = getThisMonday();
  const previousMonday = getPreviousMonday();
  const today = new Date().getDay();

  // Fetch current week's update (including drafts) with new fields
  const { data: currentUpdate } = await supabase
    .from("weekly_updates")
    .select("*, commitment, announcements")
    .eq("user_id", user.id)
    .eq("week_start", thisMonday)
    .maybeSingle();

  // Fetch previous week's submitted update with new fields
  const { data: previousUpdate } = await supabase
    .from("weekly_updates")
    .select("*, commitment, announcements")
    .eq("user_id", user.id)
    .eq("week_start", previousMonday)
    .eq("is_draft", false)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
      {today !== 1 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Updates are typically submitted on Mondays. You can still submit
          anytime.
        </div>
      )}

      <h1 className="text-2xl font-bold text-foreground">
        {formatWeekLabel(thisMonday)}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Submit your weekly update
      </p>

      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_320px]">
        {/* Left column: form */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <UpdateForm
            currentUpdate={currentUpdate}
            previousUpdate={previousUpdate}
            weekStart={thisMonday}
          />
        </div>

        {/* Right column: last week sidebar */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm h-fit">
          <h2 className="text-sm font-semibold text-foreground">
            Last Week&apos;s Update
          </h2>

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
                    Commitment
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {previousUpdate.commitment}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No update submitted last week.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
