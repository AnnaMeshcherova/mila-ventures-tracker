"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { getThisMonday, getPreviousMonday, timeAgo } from "@/lib/dates";
import WeekSelector from "@/components/WeekSelector";
import SearchBar from "@/components/SearchBar";
import WeeklyUpdateCard from "@/components/WeeklyUpdateCard";
import { Skeleton } from "@/components/ui/skeleton";

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

interface WeeklyUpdate {
  user_id: string;
  planned_tasks: string[];
  blockers: string[];
  achievements: string[];
  commitment?: string;
  announcements?: string[];
  updated_at: string;
  is_draft: boolean;
}

interface ActivityItem {
  user_id: string;
  full_name: string;
  updated_at: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentWeek, setCurrentWeek] = useState(getThisMonday());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [updates, setUpdates] = useState<WeeklyUpdate[]>([]);
  const [prevUpdates, setPrevUpdates] = useState<WeeklyUpdate[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [activityOpen, setActivityOpen] = useState(false);

  // Auth check
  useEffect(() => {
    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
      }
    }
    checkAuth();
  }, [router, supabase.auth]);

  // Fetch data when week changes
  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // Compute previous week relative to the currently viewed week
      const prevWeekDate = new Date(currentWeek + "T00:00:00");
      prevWeekDate.setDate(prevWeekDate.getDate() - 7);
      const prevWeek = prevWeekDate.toISOString().split("T")[0];

      // Use a range query to handle Monday→Friday transition
      const weekEnd = new Date(currentWeek + "T00:00:00");
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekEndStr = weekEnd.toISOString().split("T")[0];

      const [profilesRes, updatesRes, prevUpdatesRes, activityRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, role"),
        supabase
          .from("weekly_updates")
          .select("user_id, planned_tasks, blockers, achievements, commitment, announcements, updated_at, is_draft")
          .gte("week_start", prevWeek)
          .lte("week_start", weekEndStr)
          .eq("is_draft", false),
        supabase
          .from("weekly_updates")
          .select("user_id, planned_tasks, blockers, achievements, commitment, announcements, updated_at, is_draft")
          .lt("week_start", prevWeek)
          .eq("is_draft", false)
          .order("week_start", { ascending: false })
          .limit(15),
        supabase
          .from("weekly_updates")
          .select("user_id, updated_at, profiles(full_name)")
          .eq("is_draft", false)
          .order("updated_at", { ascending: false })
          .limit(10),
      ]);

      if (profilesRes.data) setProfiles(profilesRes.data);
      if (updatesRes.data) setUpdates(updatesRes.data);
      if (prevUpdatesRes.data) setPrevUpdates(prevUpdatesRes.data);

      if (activityRes.data) {
        const items: ActivityItem[] = activityRes.data.map((item: any) => ({
          user_id: item.user_id,
          full_name: (item.profiles as any)?.full_name ?? "Unknown",
          updated_at: item.updated_at,
        }));
        setActivity(items);
      }

      setLoading(false);
    }
    fetchData();
  }, [currentWeek, supabase]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Build card data: merge profiles with updates
  const updatesByUser = new Map(updates.map((u) => [u.user_id, u]));
  const prevUpdatesByUser = new Map(prevUpdates.map((u) => [u.user_id, u]));

  const filteredProfiles = profiles.filter((p) =>
    p.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const submitted = filteredProfiles
    .filter((p) => updatesByUser.has(p.id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const notSubmitted = filteredProfiles
    .filter((p) => !updatesByUser.has(p.id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const sortedProfiles = [...submitted, ...notSubmitted];

  const submittedCount = profiles.filter((p) => updatesByUser.has(p.id)).length;
  const totalCount = profiles.length;

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          {!loading && (
            <p className="text-sm text-muted-foreground mt-1">
              <span className="text-primary font-semibold">
                {submittedCount}
              </span>{" "}
              of {totalCount} team members submitted this week
            </p>
          )}
        </div>
        <WeekSelector
          currentWeek={currentWeek}
          onWeekChange={setCurrentWeek}
        />
      </div>

      {/* Search */}
      <div className="mb-6 max-w-sm">
        <SearchBar
          onSearch={handleSearch}
          placeholder="Filter by name..."
        />
      </div>

      {/* Main grid: cards + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Cards grid */}
        <div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-card border rounded-xl p-5 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : sortedProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No team members found.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedProfiles.map((profile) => (
                <WeeklyUpdateCard
                  key={profile.id}
                  profile={profile}
                  update={updatesByUser.get(profile.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Activity feed sidebar */}
        <aside>
          {/* Desktop: always visible */}
          <div className="hidden lg:block">
            <h2 className="text-sm font-semibold mb-3">Recent Activity</h2>
            <ActivityFeed
              activity={activity}
              loading={loading}
            />
          </div>

          {/* Mobile: collapsible */}
          <div className="lg:hidden mt-6">
            <button
              onClick={() => setActivityOpen(!activityOpen)}
              className="flex items-center gap-2 text-sm font-semibold w-full"
            >
              <svg
                className={`w-4 h-4 transition-transform ${
                  activityOpen ? "rotate-90" : ""
                }`}
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
              Recent Activity
            </button>
            {activityOpen && (
              <div className="mt-3">
                <ActivityFeed
                  activity={activity}
                  loading={loading}
                />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ActivityFeed({
  activity,
  loading,
}: {
  activity: ActivityItem[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 py-2">
            <Skeleton className="w-6 h-6 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activity.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No activity yet this week.
      </p>
    );
  }

  return (
    <div>
      {activity.map((item, i) => (
        <div
          key={`${item.user_id}-${item.updated_at}`}
          className={`flex items-center gap-2 py-2 ${
            i < activity.length - 1 ? "border-b" : ""
          }`}
        >
          <div className="w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-[10px] font-semibold shrink-0">
            {getInitials(item.full_name)}
          </div>
          <div className="min-w-0">
            <p className="text-sm truncate">
              <span className="font-medium">{item.full_name}</span>{" "}
              <span className="text-muted-foreground">submitted</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {timeAgo(item.updated_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
