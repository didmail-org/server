-- Quota checks must not scan an account's entire paid message history.
CREATE INDEX IF NOT EXISTS contact_preparations_unpaid ON contact_preparations(sender,expires_at) WHERE payment_hash IS NULL;
CREATE INDEX IF NOT EXISTS dmp_messages_unpaid ON dmp_messages(sender_id,upload_expires_at) WHERE accepted_at IS NULL AND lifecycle='live';
