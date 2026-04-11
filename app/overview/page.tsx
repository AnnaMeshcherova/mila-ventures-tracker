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

interface PersonItems {
  name: string;
  items: string[];
}

interface SectionData {
  type: string;
  title: string;
  borderColor: string;
  emoji: string;
  allItems: { name: string; text: string }[];
  byPerson: PersonItems[];
  summary: string | null;
  loading: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Group flat items into per-person buckets */
function groupByPerson(items: { name: string; text: string }[]): PersonItems[] {
  const map = new Map<string, string[]>();
  for (const item of items) {
    const existing = map.get(item.name) ?? [];
    existing.push(item.text);
    map.set(item.name, existing);
  }
  return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
}

export default function OverviewPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentWeek, setCurrentWeek] = useState(getThisMonday());
  const [sections, setSections] = useState<SectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  function toggleSection(type: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

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
      setExpandedSections(new Set());

      const prevWeekDate = new Date(currentWeek + "T00:00:00");
      prevWeekDate.setDate(prevWeekDate.getDate() - 7);
      const prevWeek = prevWeekDate.toISOString().split("T")[0];

      const [profilesRes, updatesRes, prevUpdatesRes, summariesRes] =
        await Promise.all([
          supabase.from("profiles").select("id, full_name"),
          supabase
            .from("weekly_updates")
            .select("user_id, planned_tasks, blockers, achievements, announcements, commitment, updated_at")
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

      const updates: UpdateWithProfile[] = (updatesRes.data ?? []).map((u: any) => ({
        ...u,
        planned_tasks: u.planned_tasks ?? [],
        blockers: u.blockers ?? [],
        achievements: u.achievements ?? [],
        announcements: u.announcements ?? [],
        commitment: u.commitment ?? null,
        full_name: profileMap.get(u.user_id) ?? "Unknown",
      }));

      const prevUpdates = (prevUpdatesRes.data ?? []).map((u: any) => ({
        ...u,
        commitment: u.commitment ?? null,
        full_name: profileMap.get(u.user_id) ?? "Unknown",
      }));

      const cachedSummaries = new Map(
        (summariesRes.data ?? []).map((s: any) => [
          s.section_type,
          { text: s.summary_text, generated_at: s.generated_at },
        ])
      );

      const latestUpdateTime = Math.max(
        ...(updatesRes.data ?? []).map((u: any) => new Date(u.updated_at).getTime()),
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
            tasks.unshift({ name: u.full_name, text: u.commitment! });
          }
        }
        return tasks;
      });

      const blockerItems = updates.flatMap((u) =>
        (u.blockers ?? []).filter((b) => b.trim()).map((b) => ({ name: u.full_name, text: b }))
      );

      const commitmentItems = prevUpdates
        .filter((u: any) => u.commitment?.trim())
        .map((u: any) => ({ name: u.full_name, text: u.commitment }));

      const achievementItems = updates.flatMap((u) =>
        (u.achievements ?? []).filter((a) => a.trim()).map((a) => ({ name: u.full_name, text: a }))
      );

      const announcementItems = updates.flatMap((u) =>
        (u.announcements ?? []).filter((a) => a.trim()).map((a) => ({ name: u.full_name, text: a }))
      );

      const sectionDefs = [
        { type: "focus", title: "Focus Next Week", borderColor: "border-amber-400", emoji: "🎯", items: focusItems },
        { type: "blockers", title: "Blockers & Help Needed", borderColor: "border-red-500", emoji: "🚧", items: blockerItems },
        { type: "commitments", title: "Committed To Get Done", borderColor: "border-blue-400", emoji: "🔒", items: commitmentItems },
        { type: "achievements", title: "Done This Week", borderColor: "border-green-500", emoji: "✅", items: achievementItems },
        { type: "announcements", title: "Announcements", borderColor: "border-border", emoji: "📢", items: announcementItems },
      ];

      const builtSections: SectionData[] = sectionDefs
        .filter((s) => s.items.length > 0)
        .map((s) => {
          const cached = cachedSummaries.get(s.type);
          const isFresh = cached && new Date(cached.generated_at).getTime() >= latestUpdateTime;

          return {
            ...s,
            allItems: s.items,
            byPerson: groupByPerson(s.items),
            summary: isFresh ? cached.text : null,
            loading: !isFresh,
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
                  items: section.allItems,
                }),
              });
              if (res.ok) {
                const data = await res.json();
                setSections((prev) =>
                  prev.map((s) =>
                    s.type === section.type ? { ...s, summary: data.summary, loading: false } : s
                  )
                );
              } else {
                setSections((prev) =>
                  prev.map((s) => (s.type === section.type ? { ...s, loading: false } : s))
                );
              }
            } catch {
              setSections((prev) =>
                prev.map((s) => (s.type === section.type ? { ...s, loading: false } : s))
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
        <WeekSelector currentWeek={currentWeek} onWeekChange={setCurrentWeek} />
      </div>

      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border rounded-xl p-5 space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : sections.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          No updates submitted for this week yet.
        </p>
      ) : (
        <div className="space-y-6">
          {sections.map((section) => {
            const isExpanded = expandedSections.has(section.type);
            const personCount = section.byPerson.length;

            return (
              <div key={section.type} className="bg-card border rounded-xl overflow-hidden">
                {/* Section header */}
                <div className={`border-l-4 ${section.borderColor} px-5 pt-5 pb-4`}>
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <span>{section.emoji}</span>
                    {section.title}
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      ({personCount} {personCount === 1 ? "person" : "people"})
                    </span>
                  </h2>

                  {/* AI Summary */}
                  <div className="mt-3">
                    {section.loading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    ) : section.summary ? (
                      <p className="text-sm leading-relaxed text-foreground/90">
                        {section.summary}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        Summary unavailable
                      </p>
                    )}
                  </div>

                  {/* Show details toggle */}
                  <button
                    onClick={() => toggleSection(section.type)}
                    className="mt-3 text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                  >
                    <svg
                      className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    {isExpanded ? "Hide details" : `Show details (${section.allItems.length} items)`}
                  </button>
                </div>

                {/* Expandable per-person details */}
                {isExpanded && (
                  <div className="border-t bg-background/50 px-5 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {section.byPerson.map((person) => (
                        <div
                          key={person.name}
                          className="flex gap-3"
                        >
                          <div className="w-7 h-7 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-[10px] font-semibold shrink-0 mt-0.5">
                            {getInitials(person.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{person.name}</p>
                            <ul className="mt-1 space-y-0.5">
                              {person.items.map((item, i) => (
                                <li key={i} className="text-xs text-muted-foreground leading-relaxed">
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
