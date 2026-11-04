# Owner transfer of node funds

Status: implemented. Audience: node owners and API maintainers.

The Node account page separates recharge, transfer and gas staking. Transfers require an ARC-verified `owner` session with a valid chain DID. The recipient is that owner's canonical address, not an arbitrary browser-entered destination. Admins may recharge but cannot transfer.

- `GET /api/account/transfer` freshly reads configured node balance/token metadata and returns the network, owner recipient and available balance without caching.
- `POST /api/account/transfer` accepts a decimal string `amount`. The server verifies the owner again, rereads balance/token precision and signs with the node wallet. Caller-supplied recipients or tokens cannot change the transaction.
- Compare exact base units against spendable balance. Staked or revoked-but-unclaimed funds are not available balance. Keep enough funds for required fees.
- Show one explicit confirmation for amount/recipient/network, prevent duplicate submission and render progress/results inline. Neither client nor server automatically retries a transfer.

A returned hash is not finality. A timeout may have an uncertain result; check original chain evidence before another transfer. [Account routes](../api/src/routes/account.ts) and isolated API/browser tests cover ownership, exact amounts, cancellation and failures without sending real funds.
