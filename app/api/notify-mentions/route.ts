import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Sends one digest email per person for mentions they have not been told
 * about yet, then stamps notified_at so they are never told twice.
 *
 * Triggered by the Vercel cron in vercel.json. Protected by CRON_SECRET,
 * which Vercel sends automatically as a bearer token.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Never email about a mention older than this. Two reasons: notified_at was
 * added long after mentions existed, so the whole backlog reads as
 * un-notified; and a mention nobody was told about for a week is stale news.
 * Wide enough that a failed send still gets retried on later runs.
 */
const MAX_AGE_DAYS = 7;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://mila-ventures-tracker.vercel.app";

interface PendingMention {
  id: string;
  snippet: string | null;
  field_type: string;
  comment_id: string | null;
  mentioned: { full_name: string; email: string } | null;
  author: { full_name: string } | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** "commitment" -> "commitment", "planned_task" -> "planned task" */
function humanField(fieldType: string, isComment: boolean): string {
  if (isComment) return "a comment";
  return fieldType.replace(/_/g, " ");
}

function buildEmail(name: string, items: PendingMention[]): string {
  const rows = items
    .map((m) => {
      const author = escapeHtml(m.author?.full_name ?? "A teammate");
      const where = humanField(m.field_type, m.comment_id !== null);
      const snippet = m.snippet?.trim()
        ? `<div style="margin-top:6px;padding:10px 12px;background:#f6f6f7;border-radius:8px;font-size:14px;color:#333">${escapeHtml(
            m.snippet.trim()
          )}</div>`
        : "";
      return `<li style="margin-bottom:16px">
        <div style="font-size:14px;color:#111"><strong>${author}</strong> mentioned you in ${escapeHtml(
          where
        )}</div>
        ${snippet}
      </li>`;
    })
    .join("");

  const count = items.length;
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <h2 style="font-size:18px;margin:0 0 4px">Hi ${escapeHtml(
      name.split(/\s+/)[0] ?? name
    )},</h2>
    <p style="font-size:14px;color:#555;margin:0 0 20px">
      You were mentioned ${count === 1 ? "once" : `${count} times`} in the Mila Ventures tracker.
    </p>
    <ul style="list-style:none;padding:0;margin:0">${rows}</ul>
    <a href="${SITE_URL}/action-items"
       style="display:inline-block;margin-top:8px;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500">
      View your action items
    </a>
    <p style="font-size:12px;color:#999;margin-top:24px">
      Sent by the Mila Ventures weekly update tracker.
    </p>
  </div>`;
}

function buildText(name: string, items: PendingMention[]): string {
  const lines = items.map((m) => {
    const author = m.author?.full_name ?? "A teammate";
    const where = humanField(m.field_type, m.comment_id !== null);
    const snippet = m.snippet?.trim() ? `\n  "${m.snippet.trim()}"` : "";
    return `- ${author} mentioned you in ${where}${snippet}`;
  });

  return [
    `Hi ${name.split(/\s+/)[0] ?? name},`,
    "",
    `You were mentioned ${
      items.length === 1 ? "once" : `${items.length} times`
    } in the Mila Ventures tracker.`,
    "",
    ...lines,
    "",
    `View your action items: ${SITE_URL}/action-items`,
  ].join("\n");
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const resendKey = process.env.RESEND_API_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const fromAddress = process.env.NOTIFY_FROM_EMAIL;

  const missing = [
    !secret && "CRON_SECRET",
    !resendKey && "RESEND_API_KEY",
    !serviceKey && "SUPABASE_SERVICE_ROLE_KEY",
    !fromAddress && "NOTIFY_FROM_EMAIL",
  ].filter(Boolean);

  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Not configured. Missing: ${missing.join(", ")}` },
      { status: 500 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey!,
    { auth: { persistSession: false } }
  );

  const cutoff = new Date(
    Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // ?resend=<days> re-sends mentions from that window even if already
  // notified. For one-off catch-ups; the daily cron never uses it.
  const resendRaw = request.nextUrl.searchParams.get("resend");
  const resendDays = resendRaw === null ? 0 : Number(resendRaw);
  const isResend =
    Number.isFinite(resendDays) && resendDays > 0 && resendDays <= 30;

  let query = supabase
    .from("mentions")
    .select(
      "id, snippet, field_type, comment_id, " +
        "mentioned:profiles!mentions_mentioned_user_id_fkey(full_name, email), " +
        "author:profiles!mentions_author_user_id_fkey(full_name)"
    );

  if (isResend) {
    query = query.gte(
      "created_at",
      new Date(Date.now() - resendDays * 24 * 60 * 60 * 1000).toISOString()
    );
  } else {
    query = query.is("notified_at", null).gte("created_at", cutoff);
  }

  const { data, error } = await query
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const pending = (data ?? []) as unknown as PendingMention[];
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";

  if (pending.length === 0) {
    return NextResponse.json(
      dryRun
        ? { dryRun: true, wouldEmail: 0, mentions: 0, recipients: [] }
        : { sent: 0, mentions: 0 }
    );
  }

  // One email per recipient, however many mentions they accumulated.
  const byEmail = new Map<string, { name: string; items: PendingMention[] }>();
  for (const m of pending) {
    const email = m.mentioned?.email;
    if (!email) continue;
    const entry = byEmail.get(email);
    if (entry) entry.items.push(m);
    else byEmail.set(email, { name: m.mentioned!.full_name, items: [m] });
  }

  // ?only=<email> restricts the send to one recipient, for safely testing a
  // template change without mailing the whole team.
  const only = request.nextUrl.searchParams.get("only");
  if (only) {
    for (const key of [...byEmail.keys()]) {
      if (key.toLowerCase() !== only.toLowerCase()) byEmail.delete(key);
    }
  }

  if (byEmail.size === 0) {
    return NextResponse.json({ sent: 0, mentions: pending.length });
  }

  // ?dryRun=1 reports who would be emailed without sending anything.
  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      wouldEmail: byEmail.size,
      mentions: pending.length,
      recipients: [...byEmail.entries()].map(([email, { name, items }]) => ({
        name,
        email,
        mentions: items.length,
      })),
    });
  }

  // A display name and a plain-text part both materially improve
  // deliverability versus a bare address with HTML only.
  const from = fromAddress!.includes("<")
    ? fromAddress!
    : `Mila Ventures Tracker <${fromAddress}>`;

  const batch = [...byEmail.entries()].map(([email, { name, items }]) => ({
    from,
    to: [email],
    subject:
      items.length === 1
        ? `${items[0].author?.full_name ?? "Someone"} mentioned you`
        : `You were mentioned ${items.length} times`,
    html: buildEmail(name, items),
    text: buildText(name, items),
  }));

  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(batch),
  });

  if (!res.ok) {
    const detail = await res.text();
    // Nothing is stamped, so the next run retries these same mentions.
    return NextResponse.json(
      { error: "resend failed", status: res.status, detail: detail.slice(0, 500) },
      { status: 502 }
    );
  }

  // Only stamp after a confirmed send.
  const sentIds = [...byEmail.values()].flatMap((v) => v.items.map((i) => i.id));
  const { error: stampError } = await supabase
    .from("mentions")
    .update({ notified_at: new Date().toISOString() })
    .in("id", sentIds);

  if (stampError) {
    return NextResponse.json(
      { error: "sent but failed to mark notified", detail: stampError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ sent: batch.length, mentions: sentIds.length });
}
