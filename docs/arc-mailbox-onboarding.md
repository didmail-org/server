# ARC mailbox association

Status: implemented, deployment-gated. Audience: operators and client integrators. Exact signed artifacts are in the [onboarding protocol](https://github.com/didmail-org/protocol/blob/main/docs/protocol/account-onboarding.md).

## User flow

In the extension, unlock the existing mailbox, connect a private server and use **ARC member binding** in the server panel. Start the association, log into ARC, compare the displayed verification information, explicitly approve and return to complete it. The selected server/mailbox and current unlock session are captured; account/server changes or logout invalidate old work. An administrator cannot associate two DIDs by editing a form.

The extension associates the existing mailbox without generating/uploading a new recovery file. For a new device, first restore the original mailbox using existing import/backup tools; the mailbox-signed lookup restores the association display without another ARC approval. Association cannot recreate missing signing or random device-encryption keys. Other clients expose their own onboarding UI; do not infer identical screen placement.

Local association records are display caches scoped to server origin and mailbox DID, containing revision/state/check time, not passwords/private keys. Refresh/focus and binding operations recheck the server. Offline cached state cannot grant member privileges. Retries preserve the same pending intent; cancellation clears only the pending local workflow.

## Eligibility

Only active owner/admin/member identities with unrevoked mailbox associations qualify. Guest, inactive, removed and unaccepted identities do not. Blocking takes priority. Sender admission, internal direct storage, external sponsorship and gas eligibility are separate checks; see [delivery behavior](https://github.com/didmail-org/overview/blob/main/docs/delivery.md). Historical downloads do not require current sending eligibility.

## Configuration

Apply `0012_account_links.sql` and later migrations before enabling associations. Preserve the original node identity and matching state: native ARC uses instance AFS; historical D1/R2 sources remain migration inputs only. For an existing native installation, follow the [instance migration sequence](instance-afs-migration.md) rather than applying D1 commands to ARC.

| Setting/binding                   | Contract                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| `DIDMAIL_ACCOUNT_LINKS_ENABLED=1` | Explicit association capability; disabled unless configured                                     |
| `DIDMAIL_ACCOUNT_ORIGIN`          | Fixed HTTPS authorization origin; only approved loopback/local development origins may use HTTP |
| `DIDMAIL_ARC_INSTANCE_ID`         | Exact instance scope                                                                            |
| `ARC_MEMBERS`                     | Dedicated trusted membership Service Binding                                                    |
| `DIDMAIL_MEMBER_ACCESS=arc`       | Current default member-based admission model; legacy allowlist compatibility is not the default |

The membership source must prove both role and active status. See the [adapter contract](arc-members-source-compatibility.md). Credentials remain private; browser cookies, mailbox secrets and caller-supplied roles are not a substitute. Rotate credentials before expiry and reverify the contract after ARC upgrades. The packaged native integration supplies this binding in process; no external Worker deployment is supported.

## Recovery and administration

The optional online encrypted recovery capsule is a snapshot, not continuous backup of future device keys. Existing signed update/delete APIs remain compatible; the extension binding flow does not silently update historical online backups. Keep complete client backups and the original recovery password. Passkey/origin changes require explicit migration rather than silently changing a registered origin.

`/admin/members` displays the trusted instance directory joined with local associations. It searches/paginates and filters verified role/active status; membership and invitations remain managed by ARC. It exposes sender blocking, not a second member or editable allowlist copy. Directory-source errors appear as unavailable, not an empty organization. Private recovery ciphertext, proofs, tokens and personal email are not directory output.

## Evidence

[Account-link business tests](../tests/business/account-links.test.mjs), membership bridge tests and client tests cover explicit approval, two-key proofs, exact-intent retries, recovery/CAS, revocation, guest/inactive rejection, source failure, privacy and account isolation. Browser fixtures cover directory/filter/blocking behavior and localization without changing real members or broadcasting mail.
