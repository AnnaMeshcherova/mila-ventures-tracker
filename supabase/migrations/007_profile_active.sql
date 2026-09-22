-- Soft-delete for departed teammates.
--
-- Deleting a profile cascades to weekly_updates, and from there to mentions,
-- future_tags and comments — so removing someone who left would erase their
-- entire update history, every comment left on their updates, and every
-- comment they left on other people's. This flag hides them from the "who
-- submitted this week" roster and the @mention picker while keeping the
-- historical record intact.
--
-- Existing rows default to active, so this is a no-op until someone is
-- explicitly marked inactive.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
