"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { formatWeekLabel } from "@/lib/dates";
import { Skeleton } from "@/components/ui/skeleton";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

interface Update {
  id: string;
  week_start: string;
  achievements: string[];
  planned_tasks: string[];
  blockers: string[];
  commitment?: string;
  announcements?: string[];
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const userId = params.username as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", userId)
        .single();

      if (!profileData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProfile(profileData);

      const { data: updatesData } = await supabase
        .from("weekly_updates")
        .select("id, week_start, achievements, planned_tasks, blockers, commitment, announcements")
        .eq("user_id", userId)
        .eq("is_draft", false)
        .order("week_start", { ascending: false });

      if (updatesData) setUpdates(updatesData);
      setLoading(false);
    }
    load();
  }, [userId, router, supabase]);

  if (loading) {
    return (
      <div className="max-w-[800px] mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-[800px] mx-auto px-4 py-8 text-center space-y-4">
        <p className="text-muted-foreground">Profile not found</p>
        <Link
          href="/dashboard"
          className="text-primary underline underline-offset-4 hover:text-primary/80"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto px-4 py-8 space-y-6">
      <Link
        href="/dashboard"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        &larr; Back to Dashboard
      </Link>

      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-sm font-semibold">
          {getInitials(profile!.full_name)}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{profile!.full_name}</h1>
          <p className="text-muted-foreground">{profile!.role}</p>
        </div>
      </div>

      {updates.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No updates yet.
        </p>
      ) : (
        <div className="space-y-4">
          {updates.map((update) => (
            <div
              key={update.id}
              className="bg-card border rounded-xl p-5 space-y-3"
            >
              <h2 className="font-semibold">
                {formatWeekLabel(update.week_start)}
              </h2>

              {update.achievements.filter((a) => a.trim()).length > 0 && (
                <div>
                  <p className="text-xs uppercase font-semibold text-muted-foreground mb-1">
                    Done last week
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-0.5">
                    {update.achievements
                      .filter((a) => a.trim())
                      .map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                  </ul>
                </div>
              )}

              {update.planned_tasks.filter((t) => t.trim()).length > 0 && (
                <div>
                  <p className="text-xs uppercase font-semibold text-muted-foreground mb-1">
                    Focus this week
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-0.5">
                    {update.planned_tasks
                      .filter((t) => t.trim())
                      .map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                  </ul>
                </div>
              )}

              {update.commitment?.trim() && (
                <div>
                  <p className="text-xs uppercase font-semibold text-amber-700 mb-1">
                    To get done
                  </p>
                  <p className="text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {update.commitment}
                  </p>
                </div>
              )}

              {update.announcements?.filter((a) => a.trim()).length ? (
                <div>
                  <p className="text-xs uppercase font-semibold text-muted-foreground mb-1">
                    Comms Story
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

              {update.blockers.filter((b) => b.trim()).length > 0 && (
                <div>
                  <p className="text-xs uppercase font-semibold text-muted-foreground mb-1">
                    Blockers
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-0.5">
                    {update.blockers
                      .filter((b) => b.trim())
                      .map((b, i) => (
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
