ALTER TABLE namecards ADD COLUMN category TEXT NOT NULL DEFAULT 'public' CHECK(category IN ('public','members'));
CREATE INDEX IF NOT EXISTS namecards_category_page ON namecards(enabled,category,id);
