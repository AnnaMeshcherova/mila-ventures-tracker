"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { MentionInput, type MentionData, type Profile } from "./MentionInput";
import { toast } from "sonner";

interface UpdateFormProps {
  currentUpdate?: any;
  previousUpdate?: any;
  weekStart: string;
}

export default function UpdateForm({
  currentUpdate,
  previousUpdate,
  weekStart,
}: UpdateFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const isSubmitted = currentUpdate && !currentUpdate.is_draft;

  const [achievements, setAchievements] = useState<string[]>(
    currentUpdate?.achievements ?? ["", "", ""]
  );
  const [plannedTasks, setPlannedTasks] = useState<string[]>(
    currentUpdate?.planned_tasks ?? ["", "", ""]
  );
  const [blockers, setBlockers] = useState<string[]>(
    currentUpdate?.blockers ?? ["", ""]
  );
  const [commitment, setCommitment] = useState<string>(
    currentUpdate?.commitment ?? ""
  );
  const [announcements, setAnnouncements] = useState<string>(
    currentUpdate?.announcements?.[0] ?? ""
  );

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [allMentions, setAllMentions] = useState<MentionData[]>([]);

  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const readOnly = isSubmitted && !editing;

  // Fetch profiles for @mention dropdown
  useEffect(() => {
    async function fetchProfiles() {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (!error && data) {
        setProfiles(data);
      }
    }
    fetchProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Collect mentions from a field change and merge into allMentions
  function handleFieldMentions(
    fieldType: string,
    fieldIndex: number,
    newMentions: MentionData[]
  ) {
    setAllMentions((prev) => {
      // Remove old mentions for this specific field, add new ones
      const filtered = prev.filter(
        (m) => !(m.field_type === fieldType && m.field_index === fieldIndex)
      );
      return [...filtered, ...newMentions];
    });
  }

  async function upsertUpdate(isDraft: boolean) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const payload = {
      user_id: user.id,
      week_start: weekStart,
      achievements: achievements.filter((a) => a.trim() !== ""),
      planned_tasks: plannedTasks.filter((t) => t.trim() !== ""),
      blockers: blockers.filter((b) => b.trim() !== ""),
      commitment: commitment.trim() || null,
      announcements: announcements.trim()
        ? [announcements.trim()]
        : null,
      is_draft: isDraft,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("weekly_updates").upsert(payload, {
      onConflict: "user_id,week_start",
    });

    if (error) throw error;
  }

  async function handleBlurSave() {
    try {
      await upsertUpdate(true);
      toast.success("Draft saved");
    } catch {
      toast.error("Failed to save draft");
    }
  }

  function validate(): string | null {
    const filledAchievements = achievements.filter((a) => a.trim() !== "");
    const filledTasks = plannedTasks.filter((t) => t.trim() !== "");
    if (filledAchievements.length === 0) {
      return "Please add at least one achievement.";
    }
    if (filledTasks.length === 0) {
      return "Please add at least one planned task.";
    }
    if (!commitment.trim()) {
      return "Please add one thing to get done by next week.";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSubmitting(true);

    try {
      await upsertUpdate(false);

      // Sync mentions
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && allMentions.length > 0) {
        // Get the update id
        const { data: update } = await supabase
          .from("weekly_updates")
          .select("id")
          .eq("user_id", user.id)
          .eq("week_start", weekStart)
          .single();

        if (update) {
          const { error: mentionError } = await supabase.rpc("sync_mentions", {
            p_update_id: update.id,
            p_author_user_id: user.id,
            p_mentions: allMentions,
          });

          if (mentionError) {
            // Roll back: set update back to draft since mentions failed
            await supabase
              .from("weekly_updates")
              .update({ is_draft: true })
              .eq("id", update.id);
            toast.error("Failed to save mentions. Your update was saved as a draft.");
            setSubmitting(false);
            return;
          }
        }
      }

      toast.success("Update submitted!");
      router.push("/dashboard");
    } catch {
      toast.error("Failed to submit update");
      setSubmitting(false);
    }
  }

  async function handleSaveDraft() {
    try {
      await upsertUpdate(true);
      toast.success("Draft saved");
    } catch {
      toast.error("Failed to save draft");
    }
  }

  if (readOnly) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">
            What did you get done last week?
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">
            {currentUpdate.achievements.map((item: string, i: number) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">
            What will you focus on this week?
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">
            {currentUpdate.planned_tasks.map((item: string, i: number) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>

        {currentUpdate.blockers?.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">
              Where are you stuck or need help?
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">
              {currentUpdate.blockers.map((item: string, i: number) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {currentUpdate.commitment && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">
              One thing to get done by next week
            </p>
            <p className="text-sm text-foreground">{currentUpdate.commitment}</p>
          </div>
        )}

        {currentUpdate.announcements?.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">
              Announcements
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">
              {currentUpdate.announcements.map((item: string, i: number) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <Button variant="outline" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Achievements */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-foreground">
          What did you get done last week?
        </label>
        {achievements.map((val, i) => (
          <MentionInput
            key={`ach-${i}`}
            value={val}
            placeholder={`Achievement ${i + 1}`}
            profiles={profiles}
            fieldType="achievement"
            fieldIndex={i}
            onBlur={handleBlurSave}
            onChange={(newValue, mentions) => {
              const next = [...achievements];
              next[i] = newValue;
              setAchievements(next);
              handleFieldMentions("achievement", i, mentions);
            }}
          />
        ))}
      </div>

      {/* Planned Tasks */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-foreground">
          What will you focus on this week?
        </label>
        {plannedTasks.map((val, i) => (
          <MentionInput
            key={`task-${i}`}
            value={val}
            placeholder={`Planned task ${i + 1}`}
            profiles={profiles}
            fieldType="planned_task"
            fieldIndex={i}
            onBlur={handleBlurSave}
            onChange={(newValue, mentions) => {
              const next = [...plannedTasks];
              next[i] = newValue;
              setPlannedTasks(next);
              handleFieldMentions("planned_task", i, mentions);
            }}
          />
        ))}
      </div>

      {/* Blockers */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-foreground">
          Where are you stuck or need help?{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        {blockers.map((val, i) => (
          <MentionInput
            key={`block-${i}`}
            value={val}
            placeholder={`Blocker ${i + 1}`}
            profiles={profiles}
            fieldType="blocker"
            fieldIndex={i}
            onBlur={handleBlurSave}
            onChange={(newValue, mentions) => {
              const next = [...blockers];
              next[i] = newValue;
              setBlockers(next);
              handleFieldMentions("blocker", i, mentions);
            }}
          />
        ))}
      </div>

      {/* Commitment */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-foreground">
          One thing to get done by next week
        </label>
        <MentionInput
          value={commitment}
          placeholder="Your #1 priority to finish by next week"
          profiles={profiles}
          fieldType="commitment"
          fieldIndex={0}
          onBlur={handleBlurSave}
          onChange={(newValue, mentions) => {
            setCommitment(newValue);
            handleFieldMentions("commitment", 0, mentions);
          }}
        />
      </div>

      {/* Announcements */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-foreground">
          Anything the whole team should know?{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <MentionInput
          value={announcements}
          placeholder="Team announcements, shoutouts, etc."
          profiles={profiles}
          fieldType="announcement"
          fieldIndex={0}
          onBlur={handleBlurSave}
          onChange={(newValue, mentions) => {
            setAnnouncements(newValue);
            handleFieldMentions("announcement", 0, mentions);
          }}
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Update"}
        </Button>
        <Button type="button" variant="secondary" onClick={handleSaveDraft}>
          Save Draft
        </Button>
      </div>
    </form>
  );
}
