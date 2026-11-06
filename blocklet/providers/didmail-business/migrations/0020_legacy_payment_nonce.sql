CREATE TABLE legacy_payment_nonce (
  id INTEGER PRIMARY KEY CHECK(id=1),
  last_nonce INTEGER NOT NULL
);
