-- V2 Features: @Mentions, Commitment, Announcements
-- Run this in Supabase SQL Editor

-- Add new columns to weekly_updates
ALTER TABLE weekly_updates ADD COLUMN IF NOT EXISTS commitment TEXT DEFAULT '';
ALTER TABLE weekly_updates ADD COLUMN IF NOT EXISTS announcements TEXT[] DEFAULT '{}';

-- Mentions table
CREATE TABLE IF NOT EXISTS mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID REFERENCES weekly_updates(id) ON DELETE CASCADE NOT NULL,
  mentioned_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  author_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  field_type TEXT NOT NULL, -- 'achievement', 'planned_task', 'blocker', 'commitment', 'announcement'
  field_index INTEGER DEFAULT 0,
  snippet TEXT, -- the text containing the mention for context
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for action items query (fetch mentions for a specific user)
CREATE INDEX IF NOT EXISTS idx_mentions_mentioned_user ON mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_mentions_update ON mentions(update_id);

-- RLS for mentions
ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view all mentions"
  ON mentions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authors can insert mentions"
  ON mentions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_user_id);

CREATE POLICY "Authors can delete own mentions"
  ON mentions FOR DELETE
  TO authenticated
  USING (auth.uid() = author_user_id);

-- Mentioned users can resolve/unresolve their own action items
CREATE POLICY "Mentioned users can update resolution"
  ON mentions FOR UPDATE
  TO authenticated
  USING (auth.uid() = mentioned_user_id);

-- Atomic sync_mentions RPC: delete old mentions + insert new ones in a transaction
CREATE OR REPLACE FUNCTION sync_mentions(
  p_update_id UUID,
  p_author_user_id UUID,
  p_mentions JSONB -- array of {mentioned_user_id, field_type, field_index, snippet}
)
RETURNS void AS $$
BEGIN
  -- Delete existing mentions for this update
  DELETE FROM mentions WHERE update_id = p_update_id AND author_user_id = p_author_user_id;

  -- Insert new mentions
  INSERT INTO mentions (update_id, mentioned_user_id, author_user_id, field_type, field_index, snippet)
  SELECT
    p_update_id,
    (item->>'mentioned_user_id')::UUID,
    p_author_user_id,
    item->>'field_type',
    COALESCE((item->>'field_index')::INTEGER, 0),
    item->>'snippet'
  FROM jsonb_array_elements(p_mentions) AS item;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update search_updates RPC to include new fields
CREATE OR REPLACE FUNCTION search_updates(search_query TEXT)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  week_start DATE,
  achievements TEXT[],
  planned_tasks TEXT[],
  blockers TEXT[],
  commitment TEXT,
  announcements TEXT[],
  is_draft BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  full_name TEXT,
  role TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wu.id,
    wu.user_id,
    wu.week_start,
    wu.achievements,
    wu.planned_tasks,
    wu.blockers,
    wu.commitment,
    wu.announcements,
    wu.is_draft,
    wu.created_at,
    wu.updated_at,
    p.full_name,
    p.role
  FROM weekly_updates wu
  JOIN profiles p ON p.id = wu.user_id
  WHERE wu.is_draft = false
    AND to_tsvector('english',
      array_to_string(wu.achievements, ' ') || ' ' ||
      array_to_string(wu.planned_tasks, ' ') || ' ' ||
      array_to_string(COALESCE(wu.blockers, '{}'), ' ') || ' ' ||
      COALESCE(wu.commitment, '') || ' ' ||
      array_to_string(COALESCE(wu.announcements, '{}'), ' ')
    ) @@ plainto_tsquery('english', search_query)
  ORDER BY wu.week_start DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
