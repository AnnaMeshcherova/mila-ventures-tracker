-- Mila Ventures Weekly Update Tracker — Initial Schema
-- Run this in Supabase SQL Editor

-- Extended user profiles beyond Supabase auth
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Core weekly updates table
CREATE TABLE weekly_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  achievements TEXT[] NOT NULL DEFAULT '{}',
  planned_tasks TEXT[] NOT NULL DEFAULT '{}',
  blockers TEXT[] DEFAULT '{}',
  is_draft BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER weekly_updates_updated_at
  BEFORE UPDATE ON weekly_updates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ========================================
-- Row Level Security
-- ========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_updates ENABLE ROW LEVEL SECURITY;

-- Profiles: all authenticated can read, users manage own
CREATE POLICY "Team can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Weekly updates: authenticated can read submitted updates,
-- but drafts are only visible to the author
CREATE POLICY "Team can view submitted updates"
  ON weekly_updates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_draft = false);

CREATE POLICY "Users can insert own updates"
  ON weekly_updates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own updates"
  ON weekly_updates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own updates"
  ON weekly_updates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ========================================
-- Full-text search RPC
-- ========================================

CREATE OR REPLACE FUNCTION search_updates(search_query TEXT)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  week_start DATE,
  achievements TEXT[],
  planned_tasks TEXT[],
  blockers TEXT[],
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
      array_to_string(COALESCE(wu.blockers, '{}'), ' ')
    ) @@ plainto_tsquery('english', search_query)
  ORDER BY wu.week_start DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
