# Local support-community Docker demo

This example runs the genuine ARC Linux service and native AUP Settings UI. It is separate from DIDMail's Workers business service and the `didmail-web` development instance. Docker/OrbStack, Node.js 24.14+, the repository's installed dependencies, and Chrome/Chromium are required. Linux amd64 is intentional; ARM64 Macs use Docker emulation.

Run from the **server repository root**:

```sh
corepack pnpm install --frozen-lockfile
node examples/support-community-docker/demo.mjs build
node examples/support-community-docker/demo.mjs start
node examples/support-community-docker/demo.mjs verify
```

`start` prints a loopback-only URL such as `http://localhost:<port>/app?blocklet=didmail-support-demo`. The host selects a free port and binds it explicitly, retaining it across restart and replacement; Docker's empty dynamic HostPort can change on OrbStack restart. Use `localhost` for the tested passkey flow. On a system without Chrome in a common location, set `SUPPORT_DEMO_CHROME` to the Chrome/Chromium executable before verification. Startup requires the locally built image and never implicitly pulls a demo image.

The build downloads ARC `2.0.0-beta.76`, verifies the archive SHA-256 and its internal file manifest, and generates the `support-community` template inside the image. Runtime binaries, upstream template material and release archives are **not vendored in this repository**. Normal Docker proxy configuration can be used for downloads. The pinned release digest comes from [ArcBlock's release digests](https://github.com/ArcBlock/arc-release-digests/blob/main/digests/2.0.0-beta.76.sha256).

## Private state and operations

All generated local material is under the ignored `artifacts/private/support-community-docker-local/` directory:

| Path                             | Purpose                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------- |
| `credentials/runtime.env`        | Generated vault and snapshot keys, mode 0600                                    |
| `credentials/authenticator.json` | Software test passkey, mode 0600                                                |
| `credentials/browser-state.json` | Browser login cookies, mode 0600                                                |
| `state/`                         | Bind-mounted `/data`, including instance identity, auth database and Space data |
| `reports/`                       | Private verification JSON and screenshots                                       |

Keys are generated only for a fresh state directory and are reused thereafter. If keys are missing while instance data exists, startup refuses to generate replacements. Preserve keys and state together when moving or backing up the demo. The Docker context has an explicit allowlist and never includes these files.

```sh
node examples/support-community-docker/demo.mjs status
node examples/support-community-docker/demo.mjs restart
node examples/support-community-docker/demo.mjs recreate
node examples/support-community-docker/demo.mjs stop
```

`recreate` stops and removes this checkout's labeled container and starts the built image with the same state, keys and port. Container/image names are derived from the checkout's private directory; mutation requires matching ownership labels. No unrelated container or host ARC service is stopped. `stop` retains all state. There is deliberately no automatic data-reset command.

## Verification contract

Run `verify` before registering a personal account in this isolated demo. The first run registers its own synthetic owner through the normal WebAuthn UI; later runs reuse the private test credential. It does not grant owner privileges to a different account. The software authenticator is an automation fixture, not proof of physical device or wallet login.

Verification runs sequentially and stops on failure:

1. Register or authenticate the saved passkey through the real server challenge/verification flow.
2. Open Settings → Support and edit **Support community name**. Assert the draft is unchanged in storage until the native **Save** button is clicked.
3. Reload and independently read the canonical ARC instance data.
4. Restart the container; check the existing login and saved value.
5. Remove/recreate the container; authenticate with the same passkey in a fresh browser and check the value again.
6. Assert service identity, original runtime keys and instance data are unchanged. Verify anonymous Settings access requires login and a direct anonymous write receives a permission refusal.

The command changes only the demo community-name test field, restarts/recreates only its owned container, and leaves the successful container running. Its private report contains sanitized request status records; credentials are stored separately. It does not invoke the agent model, send messages, make chain transactions or change Cloudflare resources.

Focused safety checks are part of `corepack pnpm test:scripts`, or run them directly:

```sh
node --test scripts/support-demo.test.mjs
```

Validated on 2026-11-05 with Node.js 24.14.0 and Docker 29.8.2/OrbStack on an ARM64 Mac: all five safety checks and the real browser Save/reload/restart/replacement/login/anonymous-refusal sequence passed. The runtime and template were built from these repository files; no previous experiment's credentials or instance data were imported.

## Settings compatibility fixes

The local demo package is version `0.1.1`:

- The reserved `/instance/settings` overlay exposes structured JSON fields. The original seed's non-JSON `settings.aup` entry could be listed but not read, breaking auto-surface expansion. The build removes that conflicting entry and declares explicit types/scopes for the five JSON fields, keeping their defaults. The original app DSL and `settings-shell` recipe remain in use.
- ARC caches the seed settings schema by application ID and package version. Schema changes require a deliberate version change; editing a previously used version's seed alone retained the old entry set.
- `sites.domains` binds `localhost` to this application. Settings requires owner/admin roles bound to the same tenant, rather than a host-level login role.
- Startup opens a genuine anonymous AUP session and verifies the application mount before Nginx accepts requests. This prevents a cold-start tenant-binding race. Only stale process/PID markers are cleared; persistent keys, identity and application data are retained.

Nginx maps `/app` to ARC's actual AUP root and proxies WebSockets. The runtime's direct `/app` route returned 404 in this configuration, so the successful `/app` acceptance includes this adapter. No `surfaces`, `replicated`, broad `networkRead` grant or global `/instance` alias is added. The ARC binary is unmodified.

## Scope and provenance

Only the community-name instance field is edited in the lifecycle test. Other fields render, but user-scoped editing, every field's behavior, physical passkeys and model inference are not covered. Local bind-mount persistence does not establish a Cloudflare Containers persistence design; this example neither deploys remotely nor upgrades a plan.

ARC and its generated template are third-party material fetched/generated locally. This repository's license does not relicense that runtime or template. The existing [distribution license audit](../../docs/distribution-license-audit.md) remains applicable; these scripts do not clear its artifact-redistribution gates. Relevant upstream documentation: [Package and Instance](https://www.arcblock.io/en/docs/blocklets/package-and-instance/), [publish/deploy boundaries](https://www.arcblock.io/en/docs/blocklets/publish-deploy/), and [Bun executable CLI mode](https://bun.sh/docs/compiler/executables#act-as-the-bun-cli).
