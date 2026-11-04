CREATE TABLE IF NOT EXISTS mail_service_policy (
 id INTEGER PRIMARY KEY CHECK(id=1),
 revision INTEGER NOT NULL DEFAULT 1,
 policy_json TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 updated_by TEXT NOT NULL,
 mutation_id TEXT
);
INSERT OR IGNORE INTO mail_service_policy(id,policy_json,updated_at,updated_by) VALUES(1,'{"accessMode":"public","ordinary":{"enabled":false,"baseFee":"0","retentionDays":10,"attachmentPricePerBytePerDay":"0"},"attachments":{"enabled":true,"maxCount":20,"maxFileBytes":33554432,"maxTotalBytes":62914560},"maxMessageCiphertextBytes":67108864}',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'migration');
CREATE TABLE IF NOT EXISTS mail_access_entries (
 kind TEXT NOT NULL CHECK(kind IN ('allow','deny')),
 did TEXT NOT NULL,
 remark TEXT NOT NULL,
 created_at TEXT NOT NULL,
 created_by TEXT NOT NULL,
 PRIMARY KEY(kind,did)
);
CREATE TABLE IF NOT EXISTS mail_policy_audit (
 revision INTEGER PRIMARY KEY,
 actor TEXT NOT NULL,
 action TEXT NOT NULL,
 target TEXT,
 created_at TEXT NOT NULL
);
