# Native-token gas staking

Status: implemented owner-only operation. Audience: node operators and API maintainers.

## Identity and rules

Gas staking is a self stake: payer, signer, sender and receiver are the configured node wallet DID. The server derives `toStakeAddress(nodeDid,nodeDid)` with the existing empty nonce, uses native tokens and empty assets, and retains `message=stake-for-gas`. The browser cannot choose a stake address, receiver or substitute token.

Read amount and withdrawal waiting rules from the configured chain. Revocation starts the waiting period; it is not automatically unlocked after time since initial staking. Gas eligibility does not purchase an envelope, NFT or service access. The member sender's one-active-token rule is separate and excludes revoked pending withdrawals even where chain gas policy still counts them.

## API

All writes require a verified ARC owner, fresh policy verification and explicit review; admin cannot invoke them. [Account routes](../api/src/routes/account.ts) implement:

| Operation                            | Required input/behavior                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `GET /api/account/gas-stake`         | Reads native token, node balance, stake/config and policy IDs through AFS                  |
| `POST /api/account/gas-stake`        | Reviewed `policyId`; reject changed rules, insufficient balance or already satisfied stake |
| `POST /api/account/gas-stake/revoke` | Reviewed `exitPolicyId`; freshly verify self-stake address and revocable amount            |
| `POST /api/account/gas-stake/claim`  | `exitPolicyId` and `evidence`; verify the unclaimed revocation and elapsed waiting period  |

Do not cache/retry writes automatically. The UI uses one confirmation and inline progress/errors/results.

## Withdrawal evidence

AFS stake transaction history is bounded and validated for path/provider, success, sender, self-stake address and native-token output. Exclude already claimed evidence and reject totals inconsistent with on-chain revoked balance. Eligibility time comes from the actual revocation time plus its actual stake waiting period; new governance rules cannot shorten an old stake retroactively.

Service-node NFT revoke/claim does not operate this self stake. An uncertain response requires checking the original transaction and balance before retry. Tests use isolated identities/chain adapters and do not broadcast real stake, revoke or claim transactions.
