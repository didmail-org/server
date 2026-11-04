# Private endpoint connections

Status: current behavior. Audience: operators and client developers.

A client may connect directly to a server's HTTPS endpoint without discovering it through a staked service-node NFT. This does not create, purchase or stake a node asset. Default member admission and all signed authorization still apply.

## Discovery and sending

`GET /api/mail/service-config` exposes public connection metadata. Updated clients validate node identity, configured network/token and advertised capabilities. Member-capable nodes may be connectable without a published envelope; automatic eligible member delivery uses internal node policy. External sending still requires a visible published real envelope and a verified quote. A zero sender price may represent a node-sponsored NFT, not offline internal delivery.

A capability error is not an empty/free plan. Incompatible identity/network or unavailable authoritative state must remain visible failures. Member-only template lists require mailbox request signatures; public discovery cannot reveal private membership lists or grant access.

## Privacy and compatibility

Internal mail is discovered from the bound node, without a chain mail notification. External NFT metadata remains public even when the server endpoint was distributed privately. HTTPS alone does not make a deployment air-gapped or provide enterprise-intranet isolation. This implementation adds no SMTP gateway or cross-server member federation.

Stored messages retain their original service/endpoint identity. Selecting another server does not migrate historical ciphertext or reconstruct missing keys. Accepted tasks keep their original signed terms.

See [delivery behavior](https://github.com/didmail-org/overview/blob/main/docs/delivery.md), [member extension](https://github.com/didmail-org/protocol/blob/main/docs/protocol/member-mail.md), [category rules](https://github.com/didmail-org/protocol/blob/main/docs/protocol/envelope-categories.md) and [deployment boundaries](workers-migration.md). The old direct-connection design and retired two-step mail routes are not current sending instructions.
