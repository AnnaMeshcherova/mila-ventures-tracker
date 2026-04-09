"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { formatWeekLabel, getMonday } from "@/lib/dates";
import SearchBar from "@/components/SearchBar";

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

interface Update {
  id: string;
  user_id: string;
  week_start: string;
  achievements: string[];
  planned_tasks: string[];
  blockers: string[];
  commitment?: string;
  announcements?: string[];
  profiles?: Profile;
  full_name?: string;
  role?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function SkeletonCard() {
  return (
    <div className="bg-card border rounded-xl p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded-full bg-muted" />
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="h-3 w-20 bg-muted rounded" />
      </div>
      <div className="h-5 w-40 bg-muted rounded-full" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-muted rounded" />
        <div className="h-3 w-3/4 bg-muted rounded" />
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Generate recent 12 weeks
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const monday = getMonday(-i);
    return { value: monday, label: formatWeekLabel(monday) };
  });

  // Auth check
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/auth/login");
      }
    });
  }, [router, supabase.auth]);

  // Fetch updates for selected week
  const fetchWeekUpdates = useCallback(
    async (week: string) => {
      setLoading(true);
      setSearchQuery("");

      let query = supabase
        .from("weekly_updates")
        .select("*, profiles(id, full_name, role)")
        .eq("is_draft", false)
        .order("week_start", { ascending: false });

      if (week !== "all") {
        query = query.eq("week_start", week);
      }

      const { data } = await query;
      setUpdates(data ?? []);
      setLoading(false);
    },
    [supabase]
  );

  // Fetch on mount and when week changes
  useEffect(() => {
    if (searchQuery) return;
    fetchWeekUpdates(selectedWeek);
  }, [selectedWeek, searchQuery, fetchWeekUpdates]);

  // Search handler
  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      if (!query.trim()) {
        fetchWeekUpdates(selectedWeek);
        return;
      }

      setLoading(true);
      const { data } = await supabase.rpc("search_updates", {
        search_query: query,
      });
      setUpdates(data ?? []);
      setLoading(false);
    },
    [supabase, selectedWeek, fetchWeekUpdates]
  );

  const getDisplayName = (update: Update): string => {
    return update.profiles?.full_name ?? update.full_name ?? "Unknown";
  };

  const getDisplayRole = (update: Update): string => {
    return update.profiles?.role ?? update.role ?? "";
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Update History</h1>

      <div className="flex items-center gap-4">
        <select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="all">All weeks</option>
          {weeks.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </select>

        <div className="flex-1 max-w-sm">
          <SearchBar
            onSearch={handleSearch}
            placeholder="Search updates..."
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : updates.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          {searchQuery
            ? "No updates match your search. Try different keywords."
            : "No updates for this week."}
        </p>
      ) : (
        <div className="space-y-4">
          {updates.map((update) => (
            <div
              key={update.id}
              className="bg-card border rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-semibold">
                  {getInitials(getDisplayName(update))}
                </div>
                <span className="font-semibold">{getDisplayName(update)}</span>
                <span className="text-xs text-muted-foreground">
                  {getDisplayRole(update)}
                </span>
              </div>

              <span className="inline-block bg-secondary text-secondary-foreground text-xs rounded-full px-2 py-0.5">
                {formatWeekLabel(update.week_start)}
              </span>

              {update.achievements?.length > 0 && (
                <div>
                  <p className="text-xs uppercase font-semibold text-muted-foreground mb-1">
                    Achievements
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-0.5">
                    {update.achievements.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              {update.planned_tasks?.length > 0 && (
                <div>
                  <p className="text-xs uppercase font-semibold text-muted-foreground mb-1">
                    Planned
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-0.5">
                    {update.planned_tasks.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}

              {update.commitment?.trim() && (
                <div>
                  <p className="text-xs uppercase font-semibold text-amber-700 mb-1">
                    Commitment
                  </p>
                  <p className="text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {update.commitment}
                  </p>
                </div>
              )}

              {update.announcements?.filter((a) => a.trim()).length ? (
                <div>
                  <p className="text-xs uppercase font-semibold text-muted-foreground mb-1">
                    Announcements
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-0.5">
                    {update.announcements
                      .filter((a) => a.trim())
                      .map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                  </ul>
                </div>
              ) : null}

              {update.blockers?.length > 0 && (
                <div>
                  <p className="text-xs uppercase font-semibold text-muted-foreground mb-1">
                    Blockers
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-0.5">
                    {update.blockers.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
