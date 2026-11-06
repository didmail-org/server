ALTER TABLE envelopes ADD COLUMN category TEXT NOT NULL DEFAULT 'public' CHECK(category IN ('public','members'));
UPDATE envelopes SET category='members' WHERE address IN (SELECT member_plan_id FROM member_envelope_config WHERE member_plan_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS envelopes_category_page ON envelopes(enabled,category,createdAt DESC,id DESC);
-- Classification replaces the previous independent configuration panel.
DROP TABLE member_envelope_config;
