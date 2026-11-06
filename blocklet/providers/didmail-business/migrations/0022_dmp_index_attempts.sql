-- Retain definitively rejected NFT transactions before preparing a replacement.
CREATE TABLE IF NOT EXISTS dmp_index_attempts (
 message_id TEXT NOT NULL, transaction_id TEXT NOT NULL, signed_transaction TEXT NOT NULL,
 asset_id TEXT NOT NULL, rejection_json TEXT NOT NULL, rejected_at TEXT NOT NULL,
 PRIMARY KEY(message_id,transaction_id)
);
