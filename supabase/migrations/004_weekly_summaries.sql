-- V3: LLM-synthesized overview summaries with caching
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS weekly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  section_type TEXT NOT NULL, -- 'focus', 'blockers', 'commitments', 'achievements', 'announcements'
  summary_text TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(week_start, section_type)
);

ALTER TABLE weekly_summaries ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read summaries
CREATE POLICY "Team can view summaries"
  ON weekly_summaries FOR SELECT
  TO authenticated
  USING (true);

-- Only server (via service role or SECURITY DEFINER) should insert/update
-- But for simplicity with anon key + RLS, allow any authenticated user to write
CREATE POLICY "Authenticated can write summaries"
  ON weekly_summaries FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update summaries"
  ON weekly_summaries FOR UPDATE
  TO authenticated
  USING (true);
