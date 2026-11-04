ALTER TABLE ordinary_messages ADD COLUMN unsigned_payment TEXT;
ALTER TABLE ordinary_messages ADD COLUMN signed_payment TEXT;
ALTER TABLE ordinary_messages ADD COLUMN payment_hash TEXT;
ALTER TABLE ordinary_messages ADD COLUMN payment_evidence_json TEXT;
CREATE UNIQUE INDEX ordinary_unique_payment ON ordinary_messages(payment_hash) WHERE payment_hash IS NOT NULL;
