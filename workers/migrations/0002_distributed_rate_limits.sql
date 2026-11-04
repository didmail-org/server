CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, resetAt INTEGER NOT NULL);
CREATE INDEX rate_limits_expiry ON rate_limits(resetAt);
