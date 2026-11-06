ALTER TABLE dmp_messages ADD COLUMN delivery_kind TEXT NOT NULL DEFAULT 'nft';
ALTER TABLE dmp_messages ADD COLUMN reserved_bytes INTEGER NOT NULL DEFAULT 0;
CREATE TABLE dmp_internal_deliveries (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 message_id TEXT NOT NULL UNIQUE REFERENCES dmp_messages(id)
);
CREATE INDEX dmp_internal_messages ON dmp_messages(recipient_id,delivery_kind,state);
