"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { getThisMonday } from "@/lib/dates";
import WeekSelector from "@/components/WeekSelector";
import { Skeleton } from "@/components/ui/skeleton";

interface Profile {
  id: string;
  full_name: string;
}

interface WeeklyUpdate {
  user_id: string;
  planned_tasks: string[];
  blockers: string[];
  achievements: string[];
  announcements: string[];
  commitment: string | null;
  updated_at: string;
}

interface UpdateWithProfile extends WeeklyUpdate {
  full_name: string;
}

interface SectionData {
  type: string;
  title: string;
  borderColor: string;
  items: { name: string; text: string }[];
  summary: string | null;
  loading: boolean;
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
  const [sections, setSections] = useState<SectionData[]>([]);
  const [loading, setLoading] = useState(true);

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

      const prevWeekDate = new Date(currentWeek + "T00:00:00");
      prevWeekDate.setDate(prevWeekDate.getDate() - 7);
      const prevWeek = prevWeekDate.toISOString().split("T")[0];

      const [profilesRes, updatesRes, prevUpdatesRes, summariesRes] =
        await Promise.all([
          supabase.from("profiles").select("id, full_name"),
          supabase
            .from("weekly_updates")
            .select(
              "user_id, planned_tasks, blockers, achievements, announcements, commitment, updated_at"
            )
            .eq("week_start", currentWeek)
            .eq("is_draft", false),
          supabase
            .from("weekly_updates")
            .select("user_id, commitment, updated_at")
            .eq("week_start", prevWeek)
            .eq("is_draft", false),
          supabase
            .from("weekly_summaries")
            .select("section_type, summary_text, generated_at")
            .eq("week_start", currentWeek),
        ]);

      const profileMap = new Map(
        (profilesRes.data ?? []).map((p: any) => [p.id, p.full_name])
      );

      const updates: UpdateWithProfile[] = (updatesRes.data ?? []).map(
        (u: any) => ({
          ...u,
          planned_tasks: u.planned_tasks ?? [],
          blockers: u.blockers ?? [],
          achievements: u.achievements ?? [],
          announcements: u.announcements ?? [],
          commitment: u.commitment ?? null,
          full_name: profileMap.get(u.user_id) ?? "Unknown",
        })
      );

      const prevUpdates = (prevUpdatesRes.data ?? []).map((u: any) => ({
        ...u,
        commitment: u.commitment ?? null,
        full_name: profileMap.get(u.user_id) ?? "Unknown",
      }));

      // Build cached summaries map
      const cachedSummaries = new Map(
        (summariesRes.data ?? []).map((s: any) => [
          s.section_type,
          { text: s.summary_text, generated_at: s.generated_at },
        ])
      );

      // Find the latest update timestamp to compare against cache
      const latestUpdateTime = Math.max(
        ...(updatesRes.data ?? []).map((u: any) =>
          new Date(u.updated_at).getTime()
        ),
        0
      );

      // Build section items
      const focusItems = updates.flatMap((u) => {
        const tasks = (u.planned_tasks ?? [])
          .filter((t) => t.trim())
          .map((t) => ({ name: u.full_name, text: t }));
        if (u.commitment?.trim()) {
          const exists = tasks.some((t) => t.text === u.commitment);
          if (!exists) {
            tasks.unshift({
              name: u.full_name,
              text: `[To get done] ${u.commitment}`,
            });
          }
        }
        return tasks;
      });

      const blockerItems = updates.flatMap((u) =>
        (u.blockers ?? [])
          .filter((b) => b.trim())
          .map((b) => ({ name: u.full_name, text: b }))
      );

      const commitmentItems = prevUpdates
        .filter((u: any) => u.commitment?.trim())
        .map((u: any) => ({ name: u.full_name, text: u.commitment }));

      const achievementItems = updates.flatMap((u) =>
        (u.achievements ?? [])
          .filter((a) => a.trim())
          .map((a) => ({ name: u.full_name, text: a }))
      );

      const announcementItems = updates.flatMap((u) =>
        (u.announcements ?? [])
          .filter((a) => a.trim())
          .map((a) => ({ name: u.full_name, text: a }))
      );

      // Build sections with cache status
      const sectionDefs = [
        {
          type: "focus",
          title: "This Week's Focus",
          borderColor: "border-amber-400",
          items: focusItems,
        },
        {
          type: "blockers",
          title: "Blockers & Help Needed",
          borderColor: "border-red-500",
          items: blockerItems,
        },
        {
          type: "commitments",
          title: "Last Week's To Get Done",
          borderColor: "border-blue-400",
          items: commitmentItems,
        },
        {
          type: "achievements",
          title: "What Got Done Last Week",
          borderColor: "border-green-500",
          items: achievementItems,
        },
        {
          type: "announcements",
          title: "Announcements",
          borderColor: "border-border",
          items: announcementItems,
        },
      ];

      const builtSections: SectionData[] = sectionDefs
        .filter((s) => s.items.length > 0)
        .map((s) => {
          const cached = cachedSummaries.get(s.type);
          const isFresh =
            cached &&
            new Date(cached.generated_at).getTime() >= latestUpdateTime;

          return {
            ...s,
            summary: isFresh ? cached.text : null,
            loading: !isFresh, // will trigger generation
          };
        });

      setSections(builtSections);
      setLoading(false);

      // Generate summaries for stale/missing sections (in parallel)
      const staleSections = builtSections.filter((s) => s.loading);
      if (staleSections.length > 0) {
        await Promise.all(
          staleSections.map(async (section) => {
            try {
              const res = await fetch("/api/generate-summary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                redirect: "error",
                body: JSON.stringify({
                  weekStart: currentWeek,
                  sectionType: section.type,
                  items: section.items,
                }),
              });

              if (res.ok) {
                const data = await res.json();
                setSections((prev) =>
                  prev.map((s) =>
                    s.type === section.type
                      ? { ...s, summary: data.summary, loading: false }
                      : s
                  )
                );
              } else {
                const errText = await res.text().catch(() => "unknown");
                console.error(`Summary generation failed for ${section.type}: ${res.status} ${errText}`);
                setSections((prev) =>
                  prev.map((s) =>
                    s.type === section.type ? { ...s, loading: false } : s
                  )
                );
              }
            } catch {
              setSections((prev) =>
                prev.map((s) =>
                  s.type === section.type ? { ...s, loading: false } : s
                )
              );
            }
          })
        );
      }
    }
    fetchData();
  }, [currentWeek, supabase]);

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold">Team Overview</h1>
        <WeekSelector
          currentWeek={currentWeek}
          onWeekChange={setCurrentWeek}
        />
      </div>

      {loading ? (
        <div className="space-y-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      ) : sections.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          No updates submitted for this week yet.
        </p>
      ) : (
        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.type}>
              <h2
                className={`text-lg font-semibold mb-4 border-l-4 ${section.borderColor} pl-3`}
              >
                {section.title}
              </h2>

              {section.loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : section.summary ? (
                <p className="text-sm leading-relaxed text-foreground bg-card border rounded-lg p-4">
                  {section.summary}
                </p>
              ) : (
                // Fallback: bullet points if LLM summary failed
                <div className="space-y-2">
                  {section.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-[10px] font-semibold shrink-0 mt-0.5">
                        {getInitials(item.name)}
                      </div>
                      <span className="font-medium text-sm shrink-0">
                        {item.name}
                      </span>
                      <span className="text-sm">{item.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
