-- Private recovery evidence. No public capability is enabled by this migration.
CREATE TABLE IF NOT EXISTS contact_preparations (
 id TEXT PRIMARY KEY,
 sender TEXT NOT NULL,
 chain_id TEXT NOT NULL,
 snapshot_json TEXT NOT NULL,
 ciphertext TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL CHECK(expires_at > created_at),
 accepted_at INTEGER,
 payment_hash TEXT,
 signed_payment TEXT,
 unsigned_payment TEXT,
 public_key TEXT,
 CHECK (
  (accepted_at IS NULL AND payment_hash IS NULL AND signed_payment IS NULL AND unsigned_payment IS NULL AND public_key IS NULL)
  OR
  (accepted_at IS NOT NULL AND payment_hash IS NOT NULL AND signed_payment IS NOT NULL AND unsigned_payment IS NOT NULL AND public_key IS NOT NULL)
 ),
 UNIQUE(chain_id, payment_hash)
);
CREATE INDEX IF NOT EXISTS contact_preparations_sender ON contact_preparations(sender, id);
