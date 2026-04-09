"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { getThisMonday } from "@/lib/dates";
import WeekSelector from "@/components/WeekSelector";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

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
}

interface UpdateWithProfile extends WeeklyUpdate {
  full_name: string;
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
  const [updates, setUpdates] = useState<UpdateWithProfile[]>([]);
  const [prevUpdates, setPrevUpdates] = useState<UpdateWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

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

      const prevWeekDate = new Date(currentWeek + "T00:00:00");
      prevWeekDate.setDate(prevWeekDate.getDate() - 7);
      const prevWeek = prevWeekDate.toISOString().split("T")[0];

      const [profilesRes, updatesRes, prevUpdatesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name"),
        supabase
          .from("weekly_updates")
          .select(
            "user_id, planned_tasks, blockers, achievements, announcements, commitment"
          )
          .eq("week_start", currentWeek)
          .eq("is_draft", false),
        supabase
          .from("weekly_updates")
          .select("user_id, commitment")
          .eq("week_start", prevWeek)
          .eq("is_draft", false),
      ]);

      const profileMap = new Map(
        (profilesRes.data ?? []).map((p: any) => [p.id, p.full_name])
      );

      if (updatesRes.data) {
        const merged: UpdateWithProfile[] = updatesRes.data.map((u: any) => ({
          ...u,
          planned_tasks: u.planned_tasks ?? [],
          blockers: u.blockers ?? [],
          achievements: u.achievements ?? [],
          announcements: u.announcements ?? [],
          commitment: u.commitment ?? null,
          full_name: profileMap.get(u.user_id) ?? "Unknown",
        }));
        setUpdates(merged);
      } else {
        setUpdates([]);
      }

      if (prevUpdatesRes.data) {
        const merged: UpdateWithProfile[] = prevUpdatesRes.data.map(
          (u: any) => ({
            user_id: u.user_id,
            planned_tasks: [],
            blockers: [],
            achievements: [],
            announcements: [],
            commitment: u.commitment ?? null,
            full_name: profileMap.get(u.user_id) ?? "Unknown",
          })
        );
        setPrevUpdates(merged);
      } else {
        setPrevUpdates([]);
      }

      setLoading(false);
    }
    fetchData();
  }, [currentWeek, supabase]);

  // Collect items across all updates
  type ItemWithAuthor = { name: string; text: string; hasCommitment?: boolean };

  const focusItems: ItemWithAuthor[] = updates.flatMap((u) => {
    const tasks = (u.planned_tasks ?? [])
      .filter((t) => t.trim())
      .map((t) => ({ name: u.full_name, text: t, hasCommitment: false }));
    // Add the commitment as its own item with the badge (if it exists and isn't already a planned task)
    if (u.commitment?.trim()) {
      const commitmentAlreadyInTasks = tasks.some((t) => t.text === u.commitment);
      if (!commitmentAlreadyInTasks) {
        tasks.unshift({ name: u.full_name, text: u.commitment, hasCommitment: true });
      } else {
        const match = tasks.find((t) => t.text === u.commitment);
        if (match) match.hasCommitment = true;
      }
    }
    return tasks;
  });

  const blockerItems: ItemWithAuthor[] = updates.flatMap((u) =>
    (u.blockers ?? [])
      .filter((b) => b.trim())
      .map((b) => ({ name: u.full_name, text: b }))
  );

  const commitmentItems: ItemWithAuthor[] = prevUpdates
    .filter((u) => u.commitment && u.commitment.trim())
    .map((u) => ({ name: u.full_name, text: u.commitment! }));

  const achievementItems: ItemWithAuthor[] = updates.flatMap((u) =>
    (u.achievements ?? [])
      .filter((a) => a.trim())
      .map((a) => ({ name: u.full_name, text: a }))
  );

  const announcementItems: ItemWithAuthor[] = updates.flatMap((u) =>
    (u.announcements ?? [])
      .filter((a) => a.trim())
      .map((a) => ({ name: u.full_name, text: a }))
  );

  const hasAnyContent =
    focusItems.length > 0 ||
    blockerItems.length > 0 ||
    commitmentItems.length > 0 ||
    achievementItems.length > 0 ||
    announcementItems.length > 0;

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8">
      {/* Header */}
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
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <Skeleton className="w-6 h-6 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : !hasAnyContent ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          No updates submitted for this week yet.
        </p>
      ) : (
        <div className="space-y-8">
          {/* 1. This Week's Focus */}
          {focusItems.length > 0 && (
            <OverviewSection title="This Week's Focus" borderColor="border-amber-400">
              {focusItems.map((item, i) => (
                <ItemRow key={i} name={item.name} text={item.text}>
                  {item.hasCommitment && (
                    <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-full px-2 py-0.5 shrink-0">
                      To get done
                    </span>
                  )}
                </ItemRow>
              ))}
            </OverviewSection>
          )}

          {/* 2. Blockers & Help Needed */}
          {blockerItems.length > 0 && (
            <OverviewSection title="Blockers & Help Needed" borderColor="border-red-500">
              {blockerItems.map((item, i) => (
                <div key={i} className="border-l-2 border-red-500 pl-3">
                  <ItemRow name={item.name} text={item.text} />
                </div>
              ))}
            </OverviewSection>
          )}

          {/* 3. Last Week's Commitments */}
          {commitmentItems.length > 0 && (
            <OverviewSection title="Last Week's To Get Done" borderColor="border-blue-400">
              {commitmentItems.map((item, i) => (
                <ItemRow key={i} name={item.name} text={item.text} />
              ))}
            </OverviewSection>
          )}

          {/* 4. What Got Done Last Week */}
          {achievementItems.length > 0 && (
            <OverviewSection title="What Got Done Last Week" borderColor="border-green-500">
              {achievementItems.map((item, i) => (
                <div key={i} className="border-l-2 border-green-500 pl-3">
                  <ItemRow name={item.name} text={item.text} />
                </div>
              ))}
            </OverviewSection>
          )}

          {/* 5. Announcements */}
          {announcementItems.length > 0 && (
            <OverviewSection title="Announcements" borderColor="border-border">
              {announcementItems.map((item, i) => (
                <div key={i} className="border-l-2 border-border pl-3">
                  <ItemRow name={item.name} text={item.text} />
                </div>
              ))}
            </OverviewSection>
          )}
        </div>
      )}
    </div>
  );
}

function OverviewSection({
  title,
  borderColor,
  children,
}: {
  title: string;
  borderColor: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        className={`text-lg font-semibold mb-4 border-l-4 ${borderColor} pl-3`}
      >
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function ItemRow({
  name,
  text,
  children,
}: {
  name: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-[10px] font-semibold shrink-0 mt-0.5">
        {getInitials(name)}
      </div>
      <span className="font-medium text-sm shrink-0">{name}</span>
      <span className="text-sm">{text}</span>
      {children}
    </div>
  );
}
