"use client";

import { useState } from "react";
import Link from "next/link";
import { BulletList } from "./BulletList";

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

interface Update {
  planned_tasks: string[];
  blockers: string[];
  achievements: string[];
  commitment?: string;
  announcements?: string[];
}

interface WeeklyUpdateCardProps {
  profile: Profile;
  update?: Update;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function WeeklyUpdateCard({
  profile,
  update,
}: WeeklyUpdateCardProps) {
  const [blockersOpen, setBlockersOpen] = useState(false);

  const hasUpdate = !!update;
  const hasAchievements =
    update?.achievements && update.achievements.filter((a) => a.trim()).length > 0;
  const hasPlanned =
    update?.planned_tasks && update.planned_tasks.filter((t) => t.trim()).length > 0;
  const hasBlockers =
    update?.blockers && update.blockers.filter((b) => b.trim()).length > 0;
  const hasCommitment = !!update?.commitment?.trim();
  const hasAnnouncements =
    update?.announcements && update.announcements.filter((a) => a.trim()).length > 0;

  return (
    <div
      className={`bg-card border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow ${
        !hasUpdate ? "opacity-50" : ""
      }`}
    >
      {/* Header: avatar + name + role */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-semibold shrink-0">
          {getInitials(profile.full_name)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{profile.full_name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {profile.role}
          </p>
        </div>
      </div>

      {hasUpdate ? (
        <>
          {/* What they got done last week */}
          {hasAchievements && (
            <div className="mb-4">
              <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wide mb-2">
                Done last week
              </p>
              <BulletList items={update!.achievements} dotClass="bg-chart-2/60" />
            </div>
          )}

          {/* What they're focusing on this week */}
          {hasPlanned && (
            <div className="mb-4">
              <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wide mb-2">
                Focus this week
              </p>
              <BulletList items={update!.planned_tasks} dotClass="bg-amber-300" />
            </div>
          )}

          {/* Commitment */}
          {hasCommitment && (
            <div className="mb-4">
              <p className="text-xs uppercase font-semibold text-amber-700 tracking-wide mb-1">
                To get done
              </p>
              <p className="text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {update!.commitment}
              </p>
            </div>
          )}

          {/* Comms Story */}
          {hasAnnouncements && (
            <div className="mb-4">
              <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wide mb-2">
                Story for comms
              </p>
              <BulletList items={update!.announcements!} dotClass="bg-muted-foreground/40" />
            </div>
          )}

          {/* Collapsible blockers */}
          {hasBlockers && (
            <div className="mb-3">
              <button
                onClick={() => setBlockersOpen(!blockersOpen)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <svg
                  className={`w-3 h-3 transition-transform ${
                    blockersOpen ? "rotate-90" : ""
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
                Blockers ({update!.blockers.filter((b) => b.trim()).length})
              </button>
              {blockersOpen && (
                <div className="mt-2 pl-4">
                  <BulletList items={update!.blockers} dotClass="bg-destructive/60" />
                </div>
              )}
            </div>
          )}

          {/* View history link */}
          <Link
            href={`/${profile.id}`}
            className="text-xs text-primary hover:underline"
          >
            View history &rarr;
          </Link>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No update this week</p>
      )}
    </div>
  );
}
