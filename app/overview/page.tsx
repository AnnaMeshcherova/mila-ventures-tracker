"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { getThisMonday } from "@/lib/dates";
import WeekSelector from "@/components/WeekSelector";
import { Skeleton } from "@/components/ui/skeleton";

interface Theme {
  title: string;
  summary: string;
  people: string[];
  isBlocker: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function OverviewPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentWeek, setCurrentWeek] = useState(getThisMonday());
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [teamCount, setTeamCount] = useState(0);

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push("/auth/login");
    }
    checkAuth();
  }, [router, supabase.auth]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setThemes([]);

      const prevWeekDate = new Date(currentWeek + "T00:00:00");
      prevWeekDate.setDate(prevWeekDate.getDate() - 7);
      const prevWeek = prevWeekDate.toISOString().split("T")[0];

      const [updatesRes, prevUpdatesRes, cachedRes] = await Promise.all([
        supabase
          .from("weekly_updates")
          .select("user_id, planned_tasks, blockers, achievements, announcements, commitment, updated_at, profiles(full_name)")
          .eq("week_start", currentWeek)
          .eq("is_draft", false),
        supabase
          .from("weekly_updates")
          .select("user_id, commitment, profiles(full_name)")
          .eq("week_start", prevWeek)
          .eq("is_draft", false),
        supabase
          .from("weekly_summaries")
          .select("summary_text, generated_at")
          .eq("week_start", currentWeek)
          .eq("section_type", "themes")
          .maybeSingle(),
      ]);

      const updates = updatesRes.data ?? [];
      const prevUpdates = prevUpdatesRes.data ?? [];
      setTeamCount(updates.length);

      if (updates.length === 0) {
        setLoading(false);
        return;
      }

      // Check cache freshness
      const latestUpdateTime = Math.max(
        ...updates.map((u: any) => new Date(u.updated_at).getTime()),
        0
      );

      if (
        cachedRes.data?.summary_text &&
        new Date(cachedRes.data.generated_at).getTime() >= latestUpdateTime
      ) {
        try {
          const cached = JSON.parse(cachedRes.data.summary_text);
          setThemes(cached);
          setLoading(false);
          return;
        } catch {
          // Cache corrupted, regenerate
        }
      }

      // Build data for LLM
      const getName = (u: any) => (u.profiles as any)?.full_name ?? "Unknown";

      const focusItems = updates.flatMap((u: any) =>
        (u.planned_tasks ?? []).filter((t: string) => t.trim()).map((t: string) => ({ name: getName(u), text: t }))
      );
      const blockerItems = updates.flatMap((u: any) =>
        (u.blockers ?? []).filter((b: string) => b.trim()).map((b: string) => ({ name: getName(u), text: b }))
      );
      const achievementItems = updates.flatMap((u: any) =>
        (u.achievements ?? []).filter((a: string) => a.trim()).map((a: string) => ({ name: getName(u), text: a }))
      );
      const announcementItems = updates.flatMap((u: any) =>
        (u.announcements ?? []).filter((a: string) => a.trim()).map((a: string) => ({ name: getName(u), text: a }))
      );
      const commitmentItems = prevUpdates
        .filter((u: any) => u.commitment?.trim())
        .map((u: any) => ({ name: getName(u), text: u.commitment }));

      setLoading(false);
      setGenerating(true);

      // Call LLM for theme extraction
      try {
        const res = await fetch("/api/generate-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          redirect: "error",
          body: JSON.stringify({
            weekStart: currentWeek,
            data: {
              focus: focusItems,
              blockers: blockerItems,
              achievements: achievementItems,
              announcements: announcementItems,
              commitments: commitmentItems,
            },
          }),
        });

        if (res.ok) {
          const { themes: extractedThemes } = await res.json();
          setThemes(extractedThemes);
        } else {
          console.error("Theme extraction failed:", await res.text().catch(() => ""));
        }
      } catch (err) {
        console.error("Theme extraction error:", err);
      }

      setGenerating(false);
    }
    fetchData();
  }, [currentWeek, supabase]);

  return (
    <div className="max-w-[900px] mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">Team Overview</h1>
          {teamCount > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {teamCount} {teamCount === 1 ? "person" : "people"} submitted this week
            </p>
          )}
        </div>
        <WeekSelector currentWeek={currentWeek} onWeekChange={setCurrentWeek} />
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border rounded-xl p-5 space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      ) : teamCount === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">No updates submitted for this week yet.</p>
        </div>
      ) : generating ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Analyzing team updates...</p>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border rounded-xl p-5 space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      ) : themes.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">Could not extract themes. Try refreshing.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Regular themes first, blockers last */}
          {[...themes.filter((t) => !t.isBlocker), ...themes.filter((t) => t.isBlocker)].map(
            (theme, i) => (
              <div
                key={i}
                className={`border rounded-xl p-5 ${
                  theme.isBlocker
                    ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900"
                    : "bg-card border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base flex items-center gap-2">
                      {theme.isBlocker ? (
                        <span className="text-red-600">⚠️</span>
                      ) : (
                        <span className="text-primary">●</span>
                      )}
                      {theme.title}
                    </h3>
                    <p className="text-sm text-foreground/80 mt-2 leading-relaxed">
                      {theme.summary}
                    </p>
                  </div>
                </div>

                {/* People pills */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {theme.people.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1.5 text-xs bg-background border rounded-full px-2.5 py-1"
                    >
                      <span className="w-4 h-4 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-[8px] font-semibold">
                        {getInitials(name)}
                      </span>
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
