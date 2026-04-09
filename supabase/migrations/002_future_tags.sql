-- Future AI auto-tagging tables
-- Do NOT run during MVP. Reserved for future AI features.

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE update_tags (
  update_id UUID REFERENCES weekly_updates(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (update_id, tag_id)
);
