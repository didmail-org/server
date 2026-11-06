-- Mail signing keys remain client-side. Tombstones preserve uniqueness and deny associations.
CREATE TABLE account_links (
 arc_id TEXT PRIMARY KEY,
 mailbox_id TEXT NOT NULL UNIQUE,
 mailbox_public_key TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>=1),
 revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0,1)),
 capsule_json TEXT,
 capsule_digest TEXT,
 proof_json TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE account_link_intents (
 id TEXT PRIMARY KEY,
 client_id TEXT NOT NULL,
 client_public_key TEXT NOT NULL,
 operation TEXT NOT NULL CHECK(operation IN ('link','recover','revoke')),
 pkce_challenge TEXT NOT NULL,
 challenge TEXT NOT NULL,
 create_digest TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 arc_id TEXT,
 csrf_digest TEXT,
 statement_json TEXT,
 completed_digest TEXT,
 result_json TEXT
);
CREATE INDEX account_link_intents_expiry ON account_link_intents(expires_at);
