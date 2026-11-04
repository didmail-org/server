# Service-node NFT stake policy

Status: implemented fixed policy. Audience: operators and server maintainers.

This stake controls service-node discovery/admission and is separate from [native-token gas staking](gas-staking.md).

- Node names are not editable through a rename API.
- Initial stake uses one node token under the existing NFT stake policy. Browser-supplied alternate amounts/waiting periods cannot change the signed parameters.
- `CHAIN_ID=beta` uses a 120-second revocation waiting period for new stakes.
- `CHAIN_ID=main` uses 604800 seconds (7 days) for new stakes.
- Derive policy from chain configuration, not `NODE_ENV`; local workerd can run with production-mode code on beta.
- `REVOKE_WAITING_PERIOD` does not override the fixed policy.
- Existing chain stakes retain their actual historical waiting period.

Do not equate holding an NFT, a token balance or a native-token self stake with an effective service-node NFT stake. Validate current factory, ownership and unrevoked stake evidence. See [stake routes](../api/src/routes/stake.ts), [policy API](mail-policy-api.md) and [node identity](node-identity-and-transactions.md).
