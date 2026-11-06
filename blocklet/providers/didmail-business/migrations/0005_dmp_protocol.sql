CREATE TABLE IF NOT EXISTS dmp_keys (owner_id TEXT NOT NULL,key_id TEXT NOT NULL,record_json TEXT NOT NULL,revocation_json TEXT,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,PRIMARY KEY(owner_id,key_id));
CREATE TABLE IF NOT EXISTS dmp_nonces (identity_id TEXT NOT NULL,nonce TEXT NOT NULL,expires_at INTEGER NOT NULL,PRIMARY KEY(identity_id,nonce));
CREATE INDEX IF NOT EXISTS dmp_nonces_expiry ON dmp_nonces(expires_at);
CREATE TABLE IF NOT EXISTS dmp_messages (
 id TEXT PRIMARY KEY,sender_id TEXT NOT NULL,recipient_id TEXT NOT NULL,service_id TEXT NOT NULL,
 manifest_hash TEXT NOT NULL,manifest_json TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'uploading',lifecycle TEXT NOT NULL DEFAULT 'live',revision INTEGER NOT NULL DEFAULT 1,
 quote_id TEXT NOT NULL,quote_json TEXT NOT NULL,quote_version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL,upload_expires_at TEXT NOT NULL,accepted_at TEXT,retention_expires_at TEXT,
 payment_request TEXT,signed_payment TEXT,payment_hash TEXT,signed_index TEXT,index_hash TEXT,asset_id TEXT,receipt_json TEXT,last_problem_json TEXT,
 next_attempt_at INTEGER NOT NULL DEFAULT 0,lease_owner TEXT,lease_expires_at INTEGER NOT NULL DEFAULT 0,lease_fence INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS dmp_messages_inbox ON dmp_messages(recipient_id,state,id);
CREATE INDEX IF NOT EXISTS dmp_messages_outbox ON dmp_messages(sender_id,id);
CREATE INDEX IF NOT EXISTS dmp_messages_jobs ON dmp_messages(state,next_attempt_at,lease_expires_at);
CREATE TABLE IF NOT EXISTS dmp_chunks (message_id TEXT NOT NULL,blob_id TEXT NOT NULL,chunk_index INTEGER NOT NULL,ciphertext_sha256 TEXT NOT NULL,object_key TEXT NOT NULL,size_bytes INTEGER NOT NULL,PRIMARY KEY(message_id,blob_id,chunk_index));
CREATE TABLE IF NOT EXISTS dmp_wallet_lanes (chain_id TEXT NOT NULL,wallet_id TEXT NOT NULL,lane TEXT NOT NULL,message_id TEXT NOT NULL,expires_at TEXT,PRIMARY KEY(chain_id,wallet_id,lane));
