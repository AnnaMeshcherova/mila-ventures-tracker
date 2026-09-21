"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { timeAgo } from "@/lib/dates";
import { getInitials } from "@/lib/utils";
import { MentionInput, type MentionData, type Profile } from "./MentionInput";

export interface Comment {
  id: string;
  update_id: string;
  author_user_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

interface CommentThreadProps {
  updateId: string;
  comments: Comment[];
  profiles: Profile[];
  currentUserId: string | null;
  /** Refetch the week's comments after a successful write. */
  onChanged: () => void;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Bold "@Name" for any known teammate; everything else renders as plain text. */
function renderBody(body: string, profiles: Profile[]) {
  const names = profiles
    .map((p) => p.full_name)
    .filter((n) => n && n.trim())
    // longest first so "Anna Meshcherova" wins over a teammate named "Anna"
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);

  if (names.length === 0) return body;

  const re = new RegExp(`@(?:${names.join("|")})`, "g");
  const out: React.ReactNode[] = [];
  let last = 0;

  for (const m of body.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push(body.slice(last, i));
    out.push(
      <span key={`${i}`} className="font-semibold text-primary">
        {m[0]}
      </span>
    );
    last = i + m[0].length;
  }
  if (last < body.length) out.push(body.slice(last));
  return out;
}

export default function CommentThread({
  updateId,
  comments,
  profiles,
  currentUserId,
  onChanged,
}: CommentThreadProps) {
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<MentionData[]>([]);
  const [posting, setPosting] = useState(false);

  const count = comments.length;

  async function handlePost() {
    const trimmed = body.trim();
    if (!trimmed || posting) return;

    setPosting(true);

    // Only mentions whose name survived edits still count.
    const live = mentions.filter((m) => {
      const p = profiles.find((x) => x.id === m.mentioned_user_id);
      return p && trimmed.includes(p.full_name);
    });

    const { error } = await supabase.rpc("create_comment_with_mentions", {
      p_update_id: updateId,
      p_body: trimmed,
      p_mentions: live.map((m) => ({ mentioned_user_id: m.mentioned_user_id })),
    });

    setPosting(false);

    if (error) {
      toast.error("Failed to post comment");
      return;
    }

    setBody("");
    setMentions([]);
    onChanged();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete comment");
      return;
    }
    onChanged();
  }

  return (
    <div className="mt-4 pt-3 border-t">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={open}
      >
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
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.9 9.9 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        {count === 0 ? "Comment" : count === 1 ? "1 comment" : `${count} comments`}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2 group">
              <div className="w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-[10px] font-semibold shrink-0">
                {getInitials(c.author_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs">
                  <span className="font-medium">{c.author_name}</span>{" "}
                  <span className="text-muted-foreground">
                    {timeAgo(c.created_at)}
                  </span>
                </p>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {renderBody(c.body, profiles)}
                </p>
              </div>
              {c.author_user_id === currentUserId && (
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-xs text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0"
                  aria-label="Delete comment"
                >
                  Delete
                </button>
              )}
            </div>
          ))}

          <div>
            <MentionInput
              value={body}
              onChange={(v, m) => {
                setBody(v);
                setMentions(m);
              }}
              onSubmit={handlePost}
              placeholder="Add a comment — type @ to tag someone"
              profiles={profiles}
              fieldType="comment"
              fieldIndex={0}
              multiline
              keepAtSign
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-muted-foreground">
                ⌘↵ to post
              </span>
              <button
                onClick={handlePost}
                disabled={!body.trim() || posting}
                className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
              >
                {posting ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
