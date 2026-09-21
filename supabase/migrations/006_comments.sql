-- Comments on weekly updates, with @mentions inside them.
-- Run this in the Supabase SQL Editor.
--
-- Design note: the pre-existing `mentions` table assumed you only ever tag
-- people inside YOUR OWN update (see sync_mentions below). Comments break that
-- assumption — you tag people on someone else's update — so comment-mentions
-- get their own write path. `update_id` stays populated on comment-mentions so
-- the existing /action-items inbox keeps working unchanged.

-- ========================================
-- comments
-- ========================================

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID REFERENCES weekly_updates(id) ON DELETE CASCADE NOT NULL,
  author_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_update ON comments(update_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_user_id);

DROP TRIGGER IF EXISTS comments_updated_at ON comments;
CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Team-visible, but mirror the weekly_updates rule: drafts stay private to
-- their author, so comments on a draft never leak.
DROP POLICY IF EXISTS "Team can view comments" ON comments;
CREATE POLICY "Team can view comments"
  ON comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM weekly_updates wu
      WHERE wu.id = comments.update_id
        AND (wu.is_draft = false OR wu.user_id = auth.uid())
    )
  );

-- Anyone on the team may comment on any SUBMITTED update, as themselves.
DROP POLICY IF EXISTS "Authenticated can insert own comments" ON comments;
CREATE POLICY "Authenticated can insert own comments"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_user_id
    AND EXISTS (
      SELECT 1 FROM weekly_updates wu
      WHERE wu.id = update_id AND wu.is_draft = false
    )
  );

DROP POLICY IF EXISTS "Authors can update own comments" ON comments;
CREATE POLICY "Authors can update own comments"
  ON comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_user_id);

DROP POLICY IF EXISTS "Authors can delete own comments" ON comments;
CREATE POLICY "Authors can delete own comments"
  ON comments FOR DELETE
  TO authenticated
  USING (auth.uid() = author_user_id);

-- ========================================
-- mentions: allow a mention to hang off a comment
-- ========================================

ALTER TABLE mentions
  ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_mentions_comment ON mentions(comment_id);

-- BUGFIX: sync_mentions wipes every mention on an update authored by the
-- caller. Without the comment_id guard, a user commenting on their OWN update
-- and tagging someone would lose that tag the next time they edited the update.
-- Only the `AND comment_id IS NULL` line differs from migration 003.
CREATE OR REPLACE FUNCTION sync_mentions(
  p_update_id UUID,
  p_author_user_id UUID,
  p_mentions JSONB
)
RETURNS void AS $$
BEGIN
  IF p_author_user_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized: cannot sync mentions for another user';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM weekly_updates WHERE id = p_update_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'unauthorized: update does not belong to caller';
  END IF;

  DELETE FROM mentions
  WHERE update_id = p_update_id
    AND author_user_id = p_author_user_id
    AND comment_id IS NULL;

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

-- ========================================
-- create a comment + its mentions atomically
-- ========================================

CREATE OR REPLACE FUNCTION create_comment_with_mentions(
  p_update_id UUID,
  p_body TEXT,
  p_mentions JSONB -- array of {mentioned_user_id}
)
RETURNS UUID AS $$
DECLARE
  v_comment_id UUID;
  v_body TEXT := btrim(p_body);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF v_body = '' THEN
    RAISE EXCEPTION 'comment body cannot be empty';
  END IF;

  -- Never allow commenting on a draft (it is not visible to the team).
  IF NOT EXISTS (
    SELECT 1 FROM weekly_updates WHERE id = p_update_id AND is_draft = false
  ) THEN
    RAISE EXCEPTION 'cannot comment on this update';
  END IF;

  INSERT INTO comments (update_id, author_user_id, body)
  VALUES (p_update_id, auth.uid(), v_body)
  RETURNING id INTO v_comment_id;

  -- author is always auth.uid(), so mentions cannot be forged onto someone else
  INSERT INTO mentions (
    update_id, comment_id, mentioned_user_id, author_user_id,
    field_type, field_index, snippet
  )
  SELECT DISTINCT
    p_update_id,
    v_comment_id,
    (item->>'mentioned_user_id')::UUID,
    auth.uid(),
    'comment',
    0,
    v_body
  FROM jsonb_array_elements(COALESCE(p_mentions, '[]'::jsonb)) AS item
  WHERE (item->>'mentioned_user_id') IS NOT NULL
    -- ignore unknown ids and don't notify yourself
    AND EXISTS (SELECT 1 FROM profiles WHERE id = (item->>'mentioned_user_id')::UUID)
    AND (item->>'mentioned_user_id')::UUID <> auth.uid();

  RETURN v_comment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
