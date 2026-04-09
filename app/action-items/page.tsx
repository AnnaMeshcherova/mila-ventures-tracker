"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { formatWeekLabel } from "@/lib/dates";
import { useMentionBadge } from "@/components/MentionBadgeProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Mention {
  id: string;
  snippet: string;
  field_type: string;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  author_user_id: string;
  mentioned_user_id: string;
  weekly_update_id: string;
  author_name: string;
  week_start: string | null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ActionItemsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { refresh: refreshBadge } = useMentionBadge();

  const [mentions, setMentions] = useState<Mention[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvedOpen, setResolvedOpen] = useState(false);

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

  // Fetch mentions
  const fetchMentions = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Try joined query first
    const { data, error } = await supabase
      .from("mentions")
      .select(
        "*, profiles!mentions_author_user_id_fkey(full_name), weekly_updates(week_start)"
      )
      .eq("mentioned_user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const mapped: Mention[] = data.map((m: any) => ({
        id: m.id,
        snippet: m.snippet,
        field_type: m.field_type,
        resolved: m.resolved,
        resolved_at: m.resolved_at,
        created_at: m.created_at,
        author_user_id: m.author_user_id,
        mentioned_user_id: m.mentioned_user_id,
        weekly_update_id: m.weekly_update_id,
        author_name: m.profiles?.full_name ?? "Unknown",
        week_start: m.weekly_updates?.week_start ?? null,
      }));
      setMentions(mapped);
      setLoading(false);
      return;
    }

    // Fallback: two separate queries
    const { data: mentionsData, error: mentionsError } = await supabase
      .from("mentions")
      .select("*")
      .eq("mentioned_user_id", user.id)
      .order("created_at", { ascending: false });

    if (mentionsError || !mentionsData) {
      toast.error("Failed to load action items");
      setLoading(false);
      return;
    }

    const authorIds = [...new Set(mentionsData.map((m: any) => m.author_user_id))];
    const updateIds = [...new Set(mentionsData.map((m: any) => m.weekly_update_id))];

    const [profilesRes, updatesRes] = await Promise.all([
      authorIds.length > 0
        ? supabase.from("profiles").select("id, full_name").in("id", authorIds)
        : { data: [] },
      updateIds.length > 0
        ? supabase
            .from("weekly_updates")
            .select("id, week_start")
            .in("id", updateIds)
        : { data: [] },
    ]);

    const profileMap = new Map(
      (profilesRes.data ?? []).map((p: any) => [p.id, p.full_name])
    );
    const updateMap = new Map(
      (updatesRes.data ?? []).map((u: any) => [u.id, u.week_start])
    );

    const mapped: Mention[] = mentionsData.map((m: any) => ({
      id: m.id,
      snippet: m.snippet,
      field_type: m.field_type,
      resolved: m.resolved,
      resolved_at: m.resolved_at,
      created_at: m.created_at,
      author_user_id: m.author_user_id,
      mentioned_user_id: m.mentioned_user_id,
      weekly_update_id: m.weekly_update_id,
      author_name: profileMap.get(m.author_user_id) ?? "Unknown",
      week_start: updateMap.get(m.weekly_update_id) ?? null,
    }));

    setMentions(mapped);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchMentions();
  }, [fetchMentions]);

  // Resolve / Unresolve
  async function handleResolve(mentionId: string) {
    const prev = [...mentions];
    setMentions((ms) =>
      ms.map((m) =>
        m.id === mentionId
          ? { ...m, resolved: true, resolved_at: new Date().toISOString() }
          : m
      )
    );

    const { error } = await supabase
      .from("mentions")
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("id", mentionId);

    if (error) {
      setMentions(prev);
      toast.error("Failed to resolve item");
    } else {
      refreshBadge();
    }
  }

  async function handleUnresolve(mentionId: string) {
    const prev = [...mentions];
    setMentions((ms) =>
      ms.map((m) =>
        m.id === mentionId
          ? { ...m, resolved: false, resolved_at: null }
          : m
      )
    );

    const { error } = await supabase
      .from("mentions")
      .update({ resolved: false, resolved_at: null })
      .eq("id", mentionId);

    if (error) {
      setMentions(prev);
      toast.error("Failed to unresolve item");
    } else {
      refreshBadge();
    }
  }

  const unresolved = mentions.filter((m) => !m.resolved);
  const resolved = mentions.filter((m) => m.resolved);

  return (
    <div className="max-w-[800px] mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Action Items</h1>
        {!loading && unresolved.length > 0 && (
          <span className="text-xs font-semibold bg-primary text-primary-foreground rounded-full px-2 py-0.5">
            {unresolved.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-card border rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : mentions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          No one has tagged you yet. When teammates mention you in their updates,
          those items will appear here.
        </p>
      ) : (
        <>
          {/* Unresolved */}
          {unresolved.length > 0 && (
            <div className="space-y-3 mb-8">
              {unresolved.map((mention) => (
                <MentionCard
                  key={mention.id}
                  mention={mention}
                  onAction={() => handleResolve(mention.id)}
                  actionLabel="Resolve"
                  actionIcon={
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  }
                />
              ))}
            </div>
          )}

          {/* Resolved */}
          {resolved.length > 0 && (
            <div>
              <button
                onClick={() => setResolvedOpen(!resolvedOpen)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
              >
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${
                    resolvedOpen ? "rotate-90" : ""
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
                Resolved ({resolved.length})
              </button>
              {resolvedOpen && (
                <div className="space-y-3">
                  {resolved.map((mention) => (
                    <MentionCard
                      key={mention.id}
                      mention={mention}
                      onAction={() => handleUnresolve(mention.id)}
                      actionLabel="Unresolve"
                      dimmed
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MentionCard({
  mention,
  onAction,
  actionLabel,
  actionIcon,
  dimmed,
}: {
  mention: Mention;
  onAction: () => void;
  actionLabel: string;
  actionIcon?: React.ReactNode;
  dimmed?: boolean;
}) {
  return (
    <div
      className={`bg-card border rounded-xl p-4 shadow-sm ${
        dimmed ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-semibold shrink-0">
            {getInitials(mention.author_name)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm text-muted-foreground">
                From:{" "}
                <span className="font-medium text-foreground">
                  {mention.author_name}
                </span>
              </p>
              <span className="text-xs bg-secondary rounded-full px-2 py-0.5">
                {mention.field_type}
              </span>
            </div>
            <p className="text-sm mt-1">{mention.snippet}</p>
            {mention.week_start && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatWeekLabel(mention.week_start)}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onAction}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 shrink-0 mt-1"
        >
          {actionIcon}
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
