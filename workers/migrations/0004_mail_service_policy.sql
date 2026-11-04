ALTER TABLE mails ADD COLUMN preparedOrigin TEXT;
ALTER TABLE mails ADD COLUMN sendStatus TEXT NOT NULL DEFAULT 'prepared';
UPDATE mails SET sendStatus = 'sent' WHERE asset IS NOT NULL AND asset != '';
UPDATE mails SET sendStatus = 'review' WHERE (asset IS NULL OR asset = '') AND (paymentTx IS NOT NULL OR assetTx IS NOT NULL);
