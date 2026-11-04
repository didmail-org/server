# DIDMail Server help

Set up an organization mailbox, manage your node, and understand how mail is delivered. This guide follows the current server and clients; historical VC-delivery documents are not instructions for enabling a supported feature.

<a id="overview"></a>

## What the server does

DIDMail Server stores encrypted mail and attachments. Clients encrypt and decrypt content locally. The node handles access checks, storage, delivery records and, when required, blockchain transactions.

There are three different identities: your ARC login, your mailbox DID in a mail client, and the server's node wallet. Signing in to the administration site does not turn your ARC account into a mailbox, and your personal wallet is not the node wallet.

Member-to-member mail on the same server is stored directly: no envelope is required, no payment is made, and no mail NFT or on-chain notification is created. External mail continues to use NFT envelopes. The server chooses the delivery result automatically; there is no separate sending-mode selector.

“No mail data on-chain” describes internal delivery. An account's earlier identity or staking transactions can still exist on-chain. The operator also pays for infrastructure such as storage and bandwidth.

<a id="quick-start"></a>

## Start with an organization mailbox

1. Ask the operator for the server's HTTPS endpoint and an invitation to its ARC organization.
2. Sign in through the ARC invitation. Your organization identity must be an active owner, admin or member; guest or disabled status does not grant member-mail eligibility.
3. In an updated DIDMail extension, React Native or Flutter client, connect to that endpoint. Create or select your mailbox, then complete the ARC mailbox-binding flow offered by the client. Verify the displayed account and server before approving.
4. Let the client register its encryption receiving key. Binding alone does not make a mailbox ready to receive encrypted mail.
5. Before sending internally, the sender needs at least one actively self-staked native token. The server checks this without creating a mail transaction. A pending withdrawal is not active collateral for this requirement.
6. Ask another member to connect, bind and register a receiving key on the same server. Compose normally. Review the actual internal-mail terms and storage period before confirming.
7. Refresh the inbox. **Internal mail** and **External mail** are separate tabs; ordinary refresh also synchronizes internal mail. Keep the client open until the body and all attachments have downloaded, then use its backup function.

A node with member delivery enabled can be connected without a published envelope. Sending to someone outside that eligibility requires an available external envelope and a new review of the actual terms.

<a id="access"></a>

## Sign in and find the right page

Open [DIDMail Admin](/admin). ARC verifies your session and role. The Help page is public; business data is restricted to owners and admins. Members use their mail client rather than the administration console.

- [Node account](/admin/account): node DID, balance, recharge, owner transfers and gas staking.
- [Server](/admin/server): service-node NFTs, public-network visibility and NFT staking.
- [Members](/admin/members): ARC member status, linked mailboxes and blocked senders.
- [Envelope](/admin/envelope) and [Namecard](/admin/namecard): create and publish templates.
- [Storage](/admin/storage): encrypted-mail records, capacity, search and deletion.
- [Settings](/admin/attachment): attachment policy and delivery operations.

ARC's avatar menu can also show its platform **Admin Console**. That platform console and DIDMail Admin serve different purposes. Use the platform's organization tools for membership and DIDMail's pages for mail operations. Only the owner can transfer node funds or perform the node's native-token gas staking and withdrawal operations.

<a id="node-account"></a>

## Manage the node wallet

In **Node account**, verify the node DID and network before recharging. Copy the node address or scan its QR code and send the correct network's token from your wallet. Refresh to check the result. An unavailable balance is not a confirmed zero balance.

Recharge adds spendable funds. Gas staking locks native tokens under the chain's rules; it does not pay an envelope price or purchase a service-node NFT. The member sender's one-token requirement is a separate check on that sender's wallet, not on the node wallet.

The owner can review a transfer of available funds to the authorized owner address. Staked funds cannot be transferred as available balance. For gas staking, review the current amount and withdrawal waiting period shown by the server. Revocation starts a waiting period; it does not immediately return the tokens. Claim only when the displayed eligibility permits it.

If a transaction's result is uncertain, refresh and inspect the original result before trying again. Keep the original node wallet when upgrading or restoring an existing server: replacing it changes the node identity and can strand access to existing assets and encrypted domain keys.

<a id="server-node"></a>

## Private endpoints and public service nodes

For a private organization, distribute the endpoint directly. Internal member delivery does not require purchasing or staking a service-node NFT and does not require a node-funded mail NFT.

For public-network discovery, use **Server** to inspect the configured factory, acquire the appropriate node NFT and manage its stake. Public visibility is based on a valid service-node NFT stake, not merely a token balance, a native-token gas stake or a sender allowlist.

Keep the advertised endpoint reachable and correct. Review the network, asset and current chain rules before approving purchases, additional staking, revocation or claims. Public visibility and permission to send are separate decisions: a visible node can still reject an unauthorized sender.

<a id="members"></a>

## Members and mailbox bindings

The **Members** page shows information obtained from the configured ARC membership source and the node's mailbox associations. Refresh it after organizational changes. The source must provide trustworthy active/disabled status as well as role; a role label alone is insufficient.

Organization membership and mailbox binding are different. An ARC member without a bound mailbox is not yet eligible for internal mail. A client-side “bound” indicator is a display cache, not authorization. The server checks the live membership and binding again when accepting a send.

Use the client's account-binding or revocation flow to associate the correct mailbox. Binding does not require uploading a plaintext private key. Optional encrypted recovery requires the original recovery password; the node cannot decrypt the backup or reset that password. A mnemonic alone may not restore random historical device encryption keys, so retain the client's complete encrypted backup.

Use **Blocked senders** to apply sending restrictions and maintain remarks. Blocking takes priority over membership for new sending. Paying does not bypass a send prohibition. A membership change or revocation does not rewrite a previously accepted delivery, and deleting a local “bound” badge does not revoke the server association.

<a id="delivery"></a>

## Internal and external delivery

**Internal:** both parties must be active, eligible, bound members of this same server, and the recipient must have a valid receiving key. A selected envelope remains only an external candidate; it is not used or charged for internal delivery. The node's internal policy determines the storage period. A signed offline receipt binds the message, participants, server and retention period. It is not a blockchain certificate or a read receipt.

**External:** the selected published NFT envelope and current signed quote govern charges and retention. A zero-price member envelope can make the sender's payment zero while the node still funds a real mail NFT. This is different from internal delivery and still creates on-chain information. A zero sender price does not mean the node has no cost.

If eligibility changes after an internal quote but before acceptance, sending fails and requires refreshed terms. The server does not silently convert the free authorization into payment or on-chain publication. Membership-source failures mean “cannot verify,” not “non-member.” Once accepted, retries return the same task and do not change its delivery type or charge again.

“Delivered” means the server's delivery requirements have completed; it does not mean the recipient has read or completely downloaded the mail. The internal inbox is queried from the bound server and does not depend on NFT notifications. Existing external delivery remains in the external inbox.

<a id="envelopes"></a>

## Create and publish envelopes

Open **Envelope** to create a template, preview its SVG, set the price and retention, and choose **Public** or **Members** category. Category is fixed at creation; create another template if a different category is needed. A members-only category limits use by eligible senders, not by requiring every external recipient to belong to the organization.

Review any actual factory charge before creating or acquiring an NFT. Publishing makes a template available through this node; unpublishing stops new selection. Among visible published envelopes, a member's default prefers the Members category; within a category, the earliest local record wins. Clients may select another visible envelope.

Zero-price member envelopes can fund external mail NFTs from the node wallet. Keep sufficient node funds and the required gas eligibility for that path. Internal member mail bypasses envelopes entirely. Envelope retention of zero means indefinite storage under the existing NFT rules; it does not override the separate finite internal-mail policy.

<a id="namecards"></a>

## Create and publish namecards

Use **Namecard** to preview an SVG, configure its existing price and retention fields, choose Public or Members category, then create and publish it. Use the provided template samples and preserve the required `{{contact.name}}` placeholder. An envelope SVG and a namecard SVG use different rendering fields.

The category controls who may use the template and cannot be changed after creation. Publishing does not send a namecard. Contact/namecard exchange has its own transaction and payment rules; free internal email does not make namecard exchange automatically free or offline. If a paid operation stalls, retain its original preparation and transaction identifiers rather than authorizing a duplicate payment.

<a id="storage"></a>

## Storage, downloads and backups

In **Storage**, search and page through the node's mail records, inspect their status and capacity, and refresh after changes. The server holds encrypted bodies and attachments plus operational metadata; the administration page is not a plaintext mailbox reader.

Deleting a server record removes its available server content. Do this only after reviewing the target and retention needs. It cannot retract a client's downloaded copy or erase an existing blockchain record. Do not delete mail to “repair” a payment or delivery whose result is still uncertain.

Clients store downloaded content locally. A readable body does not imply that all attachments are present: incomplete attachments remain pending and can retry. One failed mail should not prevent other mail from synchronizing. Use the client's complete encrypted backup and retain the necessary historical encryption keys. This guide does not promise automatic server migration or recovery of unbacked-up content after the node's retention expires.

Node backups require the original node wallet, relational data and matching encrypted objects. A D1-only export is not a complete D1/R2 backup. Quiesce writes for a consistent cross-storage snapshot and keep all private exports outside the public application package.

<a id="settings"></a>

## Limits and storage periods

In **Settings**, configure the available attachment controls and review delivery operations. Attachment counts, per-file size and total attachment size apply alongside the whole-message ciphertext limit. Review the units shown in each field. A rejected oversized draft should be edited before a new submission.

Internal mail has no daily message-count, cumulative-storage or pending-upload task quotas. Internal tasks do not consume external unpaid-upload slots. The retention period is deployment configuration, with a default of 30 days, not an extra Members-page form. Message and attachment size limits, request rate limits and upload expiry still apply. Operators monitor actual infrastructure capacity.

Operators configure these exact names:

```text
DMP_INTERNAL_RETENTION_DAYS=30
```

Changes do not retroactively alter accepted terms. If a policy changed while you were editing, refresh and review it before saving again. The retired ordinary/chain-VC delivery feature is not a supported setting to turn back on.

<a id="troubleshooting"></a>

## Common problems

- **Cannot open Admin:** sign in through ARC and verify that this instance recognizes you as owner or admin. If the ARC connection is unavailable, fix that connection; a caller-supplied role or DID is not a substitute.
- **Bound, but internal sending fails:** verify both parties' current membership, unrevoked bindings, receiving keys and the sender's active native-token self stake. Check the blocked-sender rules and that both clients use the same server and compatible version.
- **`MEMBERSHIP_UNAVAILABLE` or `GAS_STAKE_UNAVAILABLE`:** the server cannot verify the source. Retry after the operator restores it. Do not treat the error as proof of missing membership or zero stake.
- **`DELIVERY_TERMS_CHANGED` or a policy conflict:** keep the draft, refresh the terms and review the new result. Do not reuse a previous payment authorization for a changed delivery.
- **`ENVELOPE_REQUIRED`:** the recipient is not eligible for internal delivery. Select an available external envelope and review its charges; if none is published, ask the operator.
- **Message or attachment size limit reached:** reduce the draft before retrying. For an external unpaid-upload limit, finish existing external uploads or wait for their expiry. Do not repeatedly create new upload tasks for the same failed send.
- **Accepted, processing or uncertain result:** refresh the existing task and keep its message ID and original transaction hash, if any. Delivery operations may show items needing operator reconciliation. Do not pay again merely because a response timed out.
- **Body downloaded, attachment missing:** retry that attachment while the node retains it. Check local free space and connectivity. A missing historical private encryption key requires the original device-key backup, not another NFT lookup.

When contacting the operator, provide the client version, server endpoint, message ID, error code and time. Never send a private key, mnemonic, recovery password, session cookie or unredacted mail content.

<a id="deployment"></a>

## Operator setup and upgrades

The active server uses Cloudflare Workers, D1 for relational data and R2 for encrypted objects. ARC supplies login and authoritative organization membership through the configured trusted integration. An HTTPS private endpoint does not, by itself, make this an air-gapped or enterprise-intranet deployment.

1. Configure the server's public HTTPS origin, intended network, dedicated D1/R2 resources and trusted ARC connection. Keep the node wallet secret in private configuration and verify its public node address.
2. Configure the instance-scoped membership adapter and account-binding capability before offering member mail. Keep its credentials private and renew them before expiry. Do not substitute a role-only list for verified active membership.
3. Build the protocol SDK before linked consumers, install server dependencies with its configured pnpm version, and build the server. Apply all pending D1 migrations in order; member direct storage requires `0016_member_mail.sql`.
4. Preserve existing node identity and data. Use an isolated environment for testing, then verify login, membership, client receiving keys, internal synchronization and the external path you intend to offer.
5. Distribute the correct endpoint and compatible clients. Keep scheduled delivery recovery and expiration cleanup operating. Watch capacity and items requiring reconciliation.

For development in this repository, use Node.js 24.14 or newer and run from `server/`:

```sh
pnpm install --frozen-lockfile
pnpm arc:run
```

The approved local ARC instance is `didmail-web`, exposed through `http://didmail-server.localhost:8788`. `pnpm start` is the separate Workers-only entry at port 8787. Stop only the affected business preview when needed; preserve its D1/R2 state and do not disturb other ARC instances. A local build or deployment dry run is not evidence that a remote production deployment has been completed.
