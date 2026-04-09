import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface SummaryRequest {
  weekStart: string;
  sectionType: string;
  items: { name: string; text: string }[];
}

export async function POST(request: NextRequest) {
  // Auth check: reject unauthenticated calls
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: SummaryRequest = await request.json();
  const { weekStart, sectionType, items } = body;

  if (!weekStart || !sectionType || !items || items.length === 0) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Build the prompt from items
  const bulletPoints = items
    .map((item) => `- ${item.name}: ${item.text}`)
    .join("\n");

  const sectionLabels: Record<string, string> = {
    focus: "what each team member is focusing on this week",
    blockers: "blockers and help needed across the team",
    commitments: "what each person committed to getting done",
    achievements: "what the team accomplished last week",
    announcements: "team announcements",
  };

  const sectionContext = sectionLabels[sectionType] || sectionType;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-20250414",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `You are summarizing a team's weekly updates for an internal overview page. Here are individual bullet points about ${sectionContext}:\n\n${bulletPoints}\n\nWrite a short, cohesive 2-4 sentence summary paragraph that weaves these together naturally. Use people's first names. Be concise and factual. Don't add commentary or encouragement. Write in past tense for achievements, present/future tense for plans and focus items. Example style: "Anna finished building her website and reached out to some researchers. Jon shipped his website and also helped Anna with the design."`,
        },
      ],
    });

    const summaryText =
      message.content[0].type === "text" ? message.content[0].text : "";

    if (!summaryText) {
      return NextResponse.json(
        { error: "Empty response from LLM" },
        { status: 500 }
      );
    }

    // Cache the summary in weekly_summaries (upsert)
    const { error: upsertError } = await supabase
      .from("weekly_summaries")
      .upsert(
        {
          week_start: weekStart,
          section_type: sectionType,
          summary_text: summaryText,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "week_start,section_type" }
      );

    if (upsertError) {
      // Summary was generated but caching failed — still return it
      console.error("Failed to cache summary:", upsertError);
    }

    return NextResponse.json({ summary: summaryText });
  } catch (error) {
    console.error("LLM summary generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}
