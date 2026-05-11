-- One-time migration: rebucket weekly_updates.week_start to the Monday-standup
-- date that each submission belonged to, based on its updated_at timestamp.
--
-- Standup logic: Mondays at 1pm America/Toronto.
--   - Submission on Mon before 1pm  → bucket = that Monday
--   - Submission on Mon at/after 1pm → bucket = next Monday
--   - Submission on Tue/Wed/Thu     → bucket = next Monday
--   - Submission on Fri/Sat/Sun     → bucket = upcoming Monday
--
-- Postgres DOW: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

UPDATE weekly_updates
SET week_start = (
  CASE
    WHEN EXTRACT(DOW FROM (updated_at AT TIME ZONE 'America/Toronto')) = 1
      AND EXTRACT(HOUR FROM (updated_at AT TIME ZONE 'America/Toronto')) < 13
    THEN (updated_at AT TIME ZONE 'America/Toronto')::date
    WHEN EXTRACT(DOW FROM (updated_at AT TIME ZONE 'America/Toronto')) = 1
    THEN ((updated_at AT TIME ZONE 'America/Toronto')::date + INTERVAL '7 days')::date
    ELSE (
      (updated_at AT TIME ZONE 'America/Toronto')::date
      + (((1 - EXTRACT(DOW FROM (updated_at AT TIME ZONE 'America/Toronto'))::int + 7) % 7) || ' days')::interval
    )::date
  END
);

-- If the migration creates duplicate (user_id, week_start) pairs (someone
-- submitted multiple times in the same bucket), keep only the most recent.
-- Run this if you hit a UNIQUE constraint violation above.
-- DELETE FROM weekly_updates a
-- USING weekly_updates b
-- WHERE a.user_id = b.user_id
--   AND a.week_start = b.week_start
--   AND a.updated_at < b.updated_at;
