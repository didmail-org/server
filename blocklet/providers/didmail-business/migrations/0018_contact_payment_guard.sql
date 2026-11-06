-- Historical contacts without an original preparation cannot be submitted safely.
ALTER TABLE contacts ADD COLUMN preparedOrigin TEXT;
ALTER TABLE contacts ADD COLUMN sendStatus VARCHAR(255) NOT NULL DEFAULT 'review';
UPDATE contacts SET sendStatus='sent' WHERE asset IS NOT NULL AND asset!='';
