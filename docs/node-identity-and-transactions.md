# Node identity and operations

Status: current ARC server reference for operators and maintainers. This is the
single reference for wallet ownership, transfers, both stake types and read failures.

## Three identities

ARC authenticates the administrator. The mailbox DID identifies a client signer. The node wallet owns node assets and signs server-funded operations. An ARC login alone neither replaces the node wallet nor authorizes signing as the user's wallet.

Keep one stable node wallet in private instance configuration. Existing deployments must retain the original application secret and expected `NODE_ADDRESS`, chain, factories and token configuration. A replacement address cannot inherit old assets, stakes or encrypted domain-key access. Never send the private key through chat, browser state, logs or documentation.

Encode the secret explicitly as `0x`-prefixed hexadecimal: a 32-byte ED25519 seed or a coherent 64-byte seed/public-key pair. The server rejects bare hex strings and inconsistent public-key halves; it never silently reinterprets an existing node's encoding. Before funding a newly provisioned address, independently derive its public key and verify a nontransaction ownership challenge through the configured signing path. Repeating an address derivation alone does not prove signing authority. If validation fails, retain the original address, recovery material and transaction records; deriving a different address is not recovery of the original funds.

## Transaction review and recovery

The server derives recipients, assets and stake addresses from trusted policy,
not browser input. Compare exact base units and freshly verify terms before
confirmation and submission. Login/startup must never spend funds implicitly.
A returned hash is submission evidence, not finality. On timeout or uncertain
results inspect original transaction/state before another action; retain durable
signed bytes. Chain, wallet and storage share no rollback transaction.

Remote signing or user-wallet ownership needs a reviewed authorization,
key-access and migration design. DID Connect is not implicit permission to sign
as a user. See [release gates](https://github.com/didmail-org/overview/blob/main/docs/status.md).

## Owner transfers

The Node account page separates recharge, transfer and gas staking. Transfers require an ARC-verified `owner` session with a valid chain DID. The recipient is that owner's canonical address, not an arbitrary browser-entered destination. Admins may recharge but cannot transfer.

- `GET /api/account/transfer` freshly reads configured node balance/token metadata and returns the network, owner recipient and available balance without caching.
- `POST /api/account/transfer` accepts a decimal string `amount`. The server verifies the owner again, rereads balance/token precision and signs with the node wallet. Caller-supplied recipients or tokens cannot change the transaction.
- Compare exact base units against spendable balance. Staked or revoked-but-unclaimed funds are not available balance. Keep enough funds for required fees.
- Show one explicit confirmation for amount/recipient/network, prevent duplicate submission and render progress/results inline. Neither client nor server automatically retries a transfer.

[Account routes](../api/src/routes/account.ts) and isolated API/browser tests cover ownership, exact amounts, cancellation and failures without sending real funds.

## Native-token gas stake

### Identity and rules

Gas staking is a self stake: payer, signer, sender and receiver are the configured node wallet DID. The server derives `toStakeAddress(nodeDid,nodeDid)` with the existing empty nonce, uses native tokens and empty assets, and retains `message=stake-for-gas`. The browser cannot choose a stake address, receiver or substitute token.

Read amount and withdrawal waiting rules from the configured chain. Revocation starts the waiting period; it is not automatically unlocked after time since initial staking. Gas eligibility does not purchase an envelope, NFT or service access. The member sender's one-active-token rule is separate and excludes revoked pending withdrawals even where chain gas policy still counts them.

### API

All writes require a verified ARC owner, fresh policy verification and explicit review; admin cannot invoke them. [Account routes](../api/src/routes/account.ts) implement:

| Operation                            | Required input/behavior                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `GET /api/account/gas-stake`         | Reads native token, node balance, stake/config and policy IDs through AFS                  |
| `POST /api/account/gas-stake`        | Reviewed `policyId`; reject changed rules, insufficient balance or already satisfied stake |
| `POST /api/account/gas-stake/revoke` | `policyId` containing reviewed quote `exitPolicyId`; freshly verify self-stake address and revocable amount            |
| `POST /api/account/gas-stake/claim`  | `policyId` containing quote `exitPolicyId`, plus `evidence`; verify unclaimed revocation and elapsed waiting period  |

Do not cache/retry writes automatically. The UI uses one confirmation and inline progress/errors/results.

### Withdrawal evidence

AFS stake transaction history is bounded and validated for path/provider, success, sender, self-stake address and native-token output. Exclude already claimed evidence and reject totals inconsistent with on-chain revoked balance. Eligibility time comes from the actual revocation time plus its actual stake waiting period; new governance rules cannot shorten an old stake retroactively.

Service-node NFT revoke/claim does not operate this self stake. An uncertain response requires checking the original transaction and balance before retry. Tests use isolated identities/chain adapters and do not broadcast real stake, revoke or claim transactions.

## Service-node NFT stake

This policy controls node discovery/admission; it does not operate the gas self
stake above. Node purchase/stake routes retain their own server-side role gates.

- Node names are not editable through a rename API.
- Initial stake uses one node token under the existing NFT stake policy. Browser-supplied alternate amounts/waiting periods cannot change the signed parameters.
- `CHAIN_ID=beta` uses a 120-second revocation waiting period for new stakes.
- `CHAIN_ID=main` uses 604800 seconds (7 days) for new stakes.
- Derive policy from chain configuration, not `NODE_ENV`; a local ARC instance can use production-mode code on beta.
- `REVOKE_WAITING_PERIOD` does not override the fixed policy.
- Existing chain stakes retain their actual historical waiting period.

Do not equate holding an NFT, a token balance or a native-token self stake with an effective service-node NFT stake. Validate current factory, ownership and unrevoked stake evidence. See [stake routes](../api/src/routes/stake.ts), [policy API](mail-policy-api.md) and [identity](#three-identities).

## Chain-read troubleshooting

`GET /api/account/state` retains the configured node address on absent/failed
chain reads. Unavailable balance must not become zero or authorize a purchase.

Inspect `/api/account/state` in browser Network tools. `chainStatus=ready` means the read completed; `unregistered` is an absent chain account, not transport failure; `unavailable` means balance verification failed even if the compatibility response uses HTTP 200.

| Diagnostic                | Check                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `stage=transport`         | ARC connection/timeout; `TIMEOUT_10S` indicates the bounded OCAP read timed out      |
| `stage=http`              | Upstream status; 401/403 require private binding/credential/site-context checks      |
| `stage=rpc`               | Provider mount and resource path; inspect matching upstream OCAP/GraphQL diagnostics |
| `stage=decode`            | Response format and size constraints                                                 |
| Factory price unavailable | `/api/servers/factory?refresh=1`                                                     |
| Purchase submission error | `/api/servers/acquire` after reviewing the original result                           |

The UI may expose bounded code/stage/resource information, never keys, request credentials or server stacks. Do not open public AFS permissions to work around a private adapter authentication problem.

### Read-only local checks

Use only this project's approved ARC instance:

```sh
arc service status --instance didmail-web
arc afs read /dev/chain/beta/.meta/.capabilities --instance didmail-web --json
arc afs read /dev/chain/beta/accounts/NODE_ADDRESS --instance didmail-web --json
arc afs ls /dev/chain/beta/accounts/NODE_ADDRESS/tokens --instance didmail-web --json
```

Replace `NODE_ADDRESS` with the node wallet's public address, not the logged-in user's DID. Use the actual configured network mount rather than beta on another network. Match the failure time to runtime logs; one successful read does not establish a permanent fix for intermittent upstream errors.

Failed reads preserve retryable UI state and must not sign a transaction. See [native runtime integration](arc-package-runtime.md).

`pnpm chain:status --help` describes the optional read-only legacy local-wallet
probe. It uses `DIDMAIL_WALLET_FILE`/`DIDMAIL_DATA_DIR` and `CHAIN_HOST`, not the
private ARC configuration. Normal native administration uses the configured
instance; this tool is not startup or a wallet-provisioning step.
