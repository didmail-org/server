-- Unlimited internal uploads must not enlarge external unpaid-session scans.
DROP INDEX IF EXISTS dmp_messages_unpaid;
CREATE INDEX dmp_messages_unpaid ON dmp_messages(sender_id,upload_expires_at)
  WHERE delivery_kind='nft' AND accepted_at IS NULL AND lifecycle='live';
