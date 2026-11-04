CREATE TABLE IF NOT EXISTS member_envelope_config (
 id INTEGER PRIMARY KEY CHECK(id=1),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
 public_plan_id TEXT,
 member_plan_id TEXT,
 daily_member_limit INTEGER NOT NULL DEFAULT 20 CHECK(daily_member_limit BETWEEN 1 AND 10000),
 minute_member_limit INTEGER NOT NULL DEFAULT 5 CHECK(minute_member_limit BETWEEN 1 AND 100),
 daily_budget_atomic TEXT NOT NULL DEFAULT '10000000000000000',
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 updated_at TEXT NOT NULL,
 updated_by TEXT NOT NULL DEFAULT '',
 CHECK(public_plan_id IS NULL OR member_plan_id IS NULL OR public_plan_id<>member_plan_id)
);
-- Snapshot the historical default once. Later publish order never changes this reference.
INSERT OR IGNORE INTO member_envelope_config(id,public_plan_id,updated_at) VALUES(1,(SELECT address FROM envelopes WHERE enabled=1 ORDER BY id ASC LIMIT 1),'1970-01-01T00:00:00.000Z');

CREATE INDEX IF NOT EXISTS envelopes_published_page ON envelopes(enabled,createdAt DESC,id DESC);
CREATE INDEX IF NOT EXISTS envelopes_enabled_address ON envelopes(enabled,address);
