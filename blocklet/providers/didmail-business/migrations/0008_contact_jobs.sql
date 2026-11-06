-- Internal recovery jobs. No route or scheduled consumer is enabled by this migration.
CREATE TABLE IF NOT EXISTS contact_jobs (
 preparation_id TEXT PRIMARY KEY REFERENCES contact_preparations(id) ON DELETE RESTRICT,
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN
  ('queued','payment_pending','payment_confirmed','mint_pending','delivered','payment_rejected','reconciliation_required')),
 payment_evidence TEXT,
 signed_mint TEXT,
 mint_hash TEXT,
 asset_id TEXT,
 delivery_evidence TEXT,
 problem_code TEXT,
 next_attempt_at INTEGER NOT NULL DEFAULT 0,
 lease_owner TEXT,
 lease_expires_at INTEGER NOT NULL DEFAULT 0,
 lease_fence INTEGER NOT NULL DEFAULT 0 CHECK(lease_fence BETWEEN 0 AND 9007199254740991),
 CHECK((signed_mint IS NULL AND mint_hash IS NULL AND asset_id IS NULL) OR
       (signed_mint IS NOT NULL AND mint_hash IS NOT NULL AND asset_id IS NOT NULL)),
 CHECK(state NOT IN ('payment_confirmed','mint_pending','delivered') OR payment_evidence IS NOT NULL),
 CHECK(state NOT IN ('mint_pending','delivered') OR signed_mint IS NOT NULL),
 CHECK(state!='delivered' OR delivery_evidence IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS contact_jobs_due ON contact_jobs(state,next_attempt_at,lease_expires_at);
ALTER TABLE contact_preparations ADD COLUMN job_pending INTEGER NOT NULL DEFAULT 1 CHECK(job_pending IN (0,1));
CREATE INDEX IF NOT EXISTS contact_preparations_job_pending ON contact_preparations(accepted_at,id)
 WHERE payment_hash IS NOT NULL AND job_pending=1;
CREATE INDEX IF NOT EXISTS dmp_wallet_lanes_owner ON dmp_wallet_lanes(message_id,lane);
