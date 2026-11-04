CREATE TABLE IF NOT EXISTS ordinary_messages (
 id TEXT PRIMARY KEY,sender_id TEXT NOT NULL,recipient_id TEXT NOT NULL,service_id TEXT NOT NULL,
 manifest_hash TEXT NOT NULL,manifest_json TEXT NOT NULL,terms_id TEXT NOT NULL,terms_json TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'uploading',lifecycle TEXT NOT NULL DEFAULT 'live',revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL,upload_expires_at TEXT NOT NULL,accepted_at TEXT,
 signed_notification TEXT,notification_hash TEXT,credential_json TEXT,receipt_json TEXT,retention_expires_at TEXT,
 problem_json TEXT,next_attempt_at INTEGER NOT NULL DEFAULT 0,
 lease_owner TEXT,lease_expires_at INTEGER NOT NULL DEFAULT 0,lease_fence INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ordinary_sender_uploads ON ordinary_messages(sender_id,upload_expires_at) WHERE accepted_at IS NULL AND lifecycle='live';
CREATE INDEX IF NOT EXISTS ordinary_jobs ON ordinary_messages(state,next_attempt_at,lease_expires_at);
CREATE TABLE IF NOT EXISTS ordinary_chunks (
 message_id TEXT NOT NULL,blob_id TEXT NOT NULL,chunk_index INTEGER NOT NULL,
 ciphertext_sha256 TEXT NOT NULL,object_key TEXT NOT NULL,size_bytes INTEGER NOT NULL,
 PRIMARY KEY(message_id,blob_id,chunk_index)
);
CREATE TABLE IF NOT EXISTS ordinary_orphan_tombstones(message_id TEXT PRIMARY KEY,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ordinary_sweep_state(id INTEGER PRIMARY KEY CHECK(id=1),cursor TEXT NOT NULL);
INSERT OR IGNORE INTO ordinary_sweep_state(id,cursor) VALUES(1,'');
