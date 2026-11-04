# Node identity and transaction ownership

Status: current server model. Audience: operators and financial-operation maintainers.

## Three identities

ARC authenticates the administrator. The mailbox DID identifies a client signer. The node wallet owns node assets and signs server-funded operations. An ARC login alone neither replaces the node wallet nor authorizes signing as the user's wallet.

Keep one stable node wallet in private configuration/Workers Secrets. Existing deployments must retain the original application secret and expected `NODE_ADDRESS`, chain, factories and token configuration. A replacement address cannot inherit old assets, stakes or encrypted domain-key access. Never send the private key through chat, browser state, logs or documentation.

Encode the secret explicitly as `0x`-prefixed hexadecimal: a 32-byte ED25519 seed or a coherent 64-byte seed/public-key pair. The server rejects bare hex strings and inconsistent public-key halves; it never silently reinterprets an existing node's encoding. Before funding a newly provisioned address, independently derive its public key and verify a nontransaction ownership challenge through the configured signing path. Repeating an address derivation alone does not prove signing authority. If validation fails, retain the original address, recovery material and transaction records; deriving a different address is not recovery of the original funds.

## Operations

Administrators can recharge the displayed node address from a wallet. Node purchases/NFT stakes use the node wallet and their server-side role checks. [Owner transfers](node-transfers.md) and [native-token gas stake/revoke/claim](gas-staking.md) require an ARC-verified owner; admin is insufficient for those operations.

The server derives recipients, assets and stake addresses from trusted policy/state rather than browser input. Preserve exact base-unit amounts and independently check current terms and evidence. Logging in must not itself trigger a purchase, stake or payment. No automatic startup hook may silently spend funds.

## Availability and recovery

`GET /api/account/state` retains the configured node address even for an unregistered account or failed chain read. `chainStatus=ready|unregistered|unavailable` distinguishes confirmed data from errors; unavailable balance is not zero balance. The UI must preserve this distinction.

A transaction hash establishes submission evidence, not finality. After uncertain responses, inspect the original transaction/state before another action. Keep durable original signed bytes wherever the supported task workflow provides them. There is no cross-service rollback spanning the wallet, chain and storage.

Remote signing or user-wallet ownership would require a new reviewed identity, authorization, key-access and migration design. A DID Connect signature/payment workflow cannot be assumed to be an incidental ARC session capability.

See [chain troubleshooting](troubleshoot-chain-reads.md), [NFT stake policy](node-staking.md) and [server release gates](https://github.com/didmail-org/overview/blob/main/docs/status.md).
