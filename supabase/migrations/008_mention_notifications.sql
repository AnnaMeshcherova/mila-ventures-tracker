-- Email notifications for @mentions.
--
-- The blocker this solves: sync_mentions used to DELETE every mention on an
-- update and re-INSERT them on each submit. Identical mentions therefore
-- became brand-new rows every time an author edited and re-submitted, so any
-- "email when a mention appears" rule would re-notify everyone on every edit.
--
-- This rewrites sync_mentions to converge on the desired state instead:
-- removed mentions are deleted, new ones inserted, and unchanged ones left
-- alone so notified_at (and resolved) survive an edit.

ALTER TABLE mentions
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

-- Partial index: the notifier only ever scans un-notified rows.
CREATE INDEX IF NOT EXISTS idx_mentions_pending
  ON mentions(created_at)
  WHERE notified_at IS NULL;

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

  IF NOT EXISTS (
    SELECT 1 FROM weekly_updates WHERE id = p_update_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'unauthorized: update does not belong to caller';
  END IF;

  -- 1. Drop mentions the author has removed from the update.
  WITH desired AS (
    SELECT DISTINCT
      (item->>'mentioned_user_id')::UUID AS mentioned_user_id,
      item->>'field_type'                AS field_type,
      COALESCE((item->>'field_index')::INTEGER, 0) AS field_index
    FROM jsonb_array_elements(COALESCE(p_mentions, '[]'::jsonb)) AS item
    WHERE (item->>'mentioned_user_id') IS NOT NULL
  )
  DELETE FROM mentions m
   WHERE m.update_id = p_update_id
     AND m.author_user_id = p_author_user_id
     AND m.comment_id IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM desired d
        WHERE d.mentioned_user_id = m.mentioned_user_id
          AND d.field_type       = m.field_type
          AND d.field_index      = m.field_index
     );

  -- 2. Refresh snippet text on surviving rows. Deliberately does NOT touch
  --    notified_at or resolved: editing wording is not a new mention.
  WITH desired AS (
    SELECT DISTINCT
      (item->>'mentioned_user_id')::UUID AS mentioned_user_id,
      item->>'field_type'                AS field_type,
      COALESCE((item->>'field_index')::INTEGER, 0) AS field_index,
      item->>'snippet'                   AS snippet
    FROM jsonb_array_elements(COALESCE(p_mentions, '[]'::jsonb)) AS item
    WHERE (item->>'mentioned_user_id') IS NOT NULL
  )
  UPDATE mentions m
     SET snippet = d.snippet
    FROM desired d
   WHERE m.update_id = p_update_id
     AND m.author_user_id = p_author_user_id
     AND m.comment_id IS NULL
     AND d.mentioned_user_id = m.mentioned_user_id
     AND d.field_type       = m.field_type
     AND d.field_index      = m.field_index
     AND m.snippet IS DISTINCT FROM d.snippet;

  -- 3. Insert genuinely new mentions. Skips self-mentions and unknown ids,
  --    matching create_comment_with_mentions.
  WITH desired AS (
    SELECT DISTINCT
      (item->>'mentioned_user_id')::UUID AS mentioned_user_id,
      item->>'field_type'                AS field_type,
      COALESCE((item->>'field_index')::INTEGER, 0) AS field_index,
      item->>'snippet'                   AS snippet
    FROM jsonb_array_elements(COALESCE(p_mentions, '[]'::jsonb)) AS item
    WHERE (item->>'mentioned_user_id') IS NOT NULL
      AND (item->>'mentioned_user_id')::UUID <> auth.uid()
      AND EXISTS (
        SELECT 1 FROM profiles WHERE id = (item->>'mentioned_user_id')::UUID
      )
  )
  INSERT INTO mentions (
    update_id, mentioned_user_id, author_user_id, field_type, field_index, snippet
  )
  SELECT p_update_id, d.mentioned_user_id, p_author_user_id,
         d.field_type, d.field_index, d.snippet
    FROM desired d
   WHERE NOT EXISTS (
     SELECT 1 FROM mentions m
      WHERE m.update_id        = p_update_id
        AND m.author_user_id   = p_author_user_id
        AND m.comment_id IS NULL
        AND m.mentioned_user_id = d.mentioned_user_id
        AND m.field_type        = d.field_type
        AND m.field_index       = d.field_index
   );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
