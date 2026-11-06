-- Commit fences only: policy, access entries and audit remain authoritative in AFS.
-- Closed rows are durable tombstones. Never reopen/reuse or prune a token while
-- an arbitrarily delayed old request could still attempt to register it.
CREATE TABLE IF NOT EXISTS didmail_admission_fences (
 token TEXT PRIMARY KEY,
 policy_revision INTEGER NOT NULL,
 open INTEGER NOT NULL CHECK(open IN (0,1))
);
