# Troubleshoot node balance and factory reads

Status: current diagnostic guide. Audience: operators and contributors. Unavailable evidence must never authorize a purchase.

## Identify the failing stage

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

## Read-only local checks

Use only this project's approved ARC instance:

```sh
arc service status --instance didmail-web
arc afs read /dev/chain/beta/.meta/.capabilities --instance didmail-web --json
arc afs read /dev/chain/beta/accounts/NODE_ADDRESS --instance didmail-web --json
arc afs ls /dev/chain/beta/accounts/NODE_ADDRESS/tokens --instance didmail-web --json
```

Replace `NODE_ADDRESS` with the node wallet's public address, not the logged-in user's DID. Use the actual configured network mount rather than beta on another network. Match the failure time to runtime logs; one successful read does not establish a permanent fix for intermittent upstream errors.

Balance and fee checks occur before confirmation and again before submission. Failed reads preserve retryable UI state and must not sign a transaction. See [native runtime integration](arc-package-runtime.md) and [node identity](node-identity-and-transactions.md).
