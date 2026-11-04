# Native administration UI

Status: current implementation. Audience: UI contributors. The server uses AUP / Web Device pages, vanilla browser JavaScript and TanStack Query Core without a React runtime.

## Routes and source

| Public route        | AUP page           | Content                                                    |
| ------------------- | ------------------ | ---------------------------------------------------------- |
| `/`                 | `index`            | Landing page and downloads                                 |
| `/help`             | `help`             | Public English guide and four translations                 |
| `/admin`            | `admin`            | Default server administration                              |
| `/admin/account`    | `admin-account`    | Recharge, owner transfer and native-token gas stake        |
| `/admin/server`     | `admin-server`     | Service-node NFT and stake operations                      |
| `/admin/members`    | `admin-members`    | Scoped ARC directory, mailbox bindings and sender blocking |
| `/admin/envelope`   | `admin-envelope`   | Envelope templates, categories and publication             |
| `/admin/namecard`   | `admin-namecard`   | Namecard templates, categories and publication             |
| `/admin/storage`    | `admin-storage`    | Encrypted-mail metadata, search and authorized deletion    |
| `/admin/attachment` | `admin-attachment` | Attachment settings and delivery operations                |

Page sources are [blocklet/pages](../blocklet/pages/). Renderers and interactions live in [ui](../ui/), with component manifests/styles in [blocklet/.web/components](../blocklet/.web/components/). `pnpm build:client` bundles them, runs ARC check/build and generates `blocklet/dist` and Worker `dist` assets. Generated renderer/browser bundles are not hand-edited or committed. The shared [appearance adapter](../ui/native-appearance.js) prepares both built HTML and live ARC responses in the Worker: the native header and preference bootstrap stay consistent with the page-wide black brand scene, including before browser paint. It only adapts known DIDMail pages and the recognized native appearance initializer; identity and authorization responses retain their existing paths.

The Worker maps public admin paths to flat native page IDs; it does not use a SPA fallback. Locale prefixes, queries and anchors retain their public meaning. ARC owns the single app header, language/theme/user menus and login; the platform Admin Console is separate from DIDMail business administration.

## Authorization and state

Every admin navigation verifies the ARC session before loading data or restoring display snapshots. Members/anonymous users do not load owner/admin data. API authorization and origin checks remain authoritative. No node private key enters browser state.

[ui/node-state.js](../ui/node-state.js) scopes query/display snapshots to user identity/provider/role and node/network/configuration. Corrupt, future, expired or foreign snapshots are rejected. Stored fields are a bounded display allowlist, not credentials, mail or transaction authority. Logout/revoked access clears snapshots. Disabled browser storage falls back to reads.

Progressive regions render independently: account, stake, NFT/factory, template lists and mail/capacity do not all wait for the slowest read. Same-page concurrent identical GETs coalesce; mutations never coalesce/cache and invalidate older in-flight reads. Polling/manual refresh behavior belongs to the current query/header implementation; it cannot authorize a transaction from a cached balance.

Before spending, load current terms/balance/stake again. Cancel or invalidate pre-write reads so they cannot repopulate stale state. Preserve failed forms and saved snapshots with explicit stale/unavailable status. A returned transaction hash is submission evidence, not chain confirmation.

## Templates and list caches

SVG samples are bundled, rendered as images and validated before use. Envelope samples require `mail.sender`; supported fields include subject, sender, creation/expiry and envelope metadata. Namecards require `{{contact.name}}` and use the contact rendering context. Factory details load on demand, while creation always checks actual factory fees before confirmation. Categories are assigned once and publication does not change them.

Template list pages use D1 scope/version/pointer metadata and R2 JSON payloads. Normal cached pages avoid chain reads; a cache miss, explicit refresh or successful creation synchronizes. Publication flags are merged separately, never overwritten by chain refresh. Failed refresh keeps the last valid list. Version and pointer CAS reject stale writers and prevent deleting another writer's object. These are rebuildable display caches, not economic authorization or a complete orphan-cleanup mechanism.

## Public brand entrance

The public home uses a full near-black scene in both saved appearances. At 1024 CSS pixels and above, the transparent dove/product name and existing introduction/entry actions occupy equal full-page halves, with each group centered horizontally and vertically. A 1px neutral midpoint separator fades from its brighter center to transparent ends. Narrow screens retain the centered vertical composition without a separator. The native header keeps its accessible small home link while visually hiding the redundant home-page title; other pages retain their normal header identity.

Owned server form fields signal focus through a neutral border-color change with unchanged stroke width, font weight and geometry. They do not add a ring/shadow; forced-colors mode retains a visible system outline. Native ARC authentication remains platform-owned.

## Accessibility and localization

English is default; Simplified Chinese, Arabic, Japanese and Russian have matching message keys. SSR emits the requested language and localized links. Arabic uses RTL, while DIDs, amounts and code retain appropriate LTR isolation. Forms/dialogs have labels and keyboard interactions. The header exposes a direct Light/Dark toggle with a target-specific accessible name. Fixed choices persist; legacy explicit System resolves once during migration. Later OS palette changes have no effect. See the [product design authority](https://github.com/didmail-org/overview/blob/main/docs/product-design.md). Mobile navigation may scroll within its own strip without overflowing the page.

The help renderer builds directly from [docs/help](help/README.md), preserving stable translated section IDs and escaping raw HTML. It is readable without JavaScript and does not request business data. Header/home/admin links and per-page contextual links expose it.

## Verification

Run `pnpm lint:ui`, `pnpm test:ui`, `pnpm build:client` and `pnpm test:browser`. With the local preview running, run `pnpm test:browser:admin`, `pnpm test:browser:ui` and `pnpm test:browser:help`; set `DIDMAIL_BROWSER_THEME=dark` for the dark UI regression. Help checks serve isolated artifacts and read only ARC's public core stylesheet from the preview.

Standalone Workers serve native pages from `dist` without ARC's dynamic core CSS route. Before a standalone build, set `DIDMAIL_WORKER_CORE_CSS` to a genuine offline public ARC core stylesheet matching the `aup-core.<sha256-prefix>.css` reference emitted in the pages. `build:client` copies its exact bytes into `dist` and records the full digest in `worker-core-assets.json`; it does not fetch from a running ARC instance. Ordinary ARC builds can omit this input. Standalone `start` and `worker:deploy:dry` verify the asset and fail before serving/deploying if it is missing or its content hash differs. No replacement CSS or identity fixture is supplied by this packaging step.

Browser tests use isolated identity/business API fixtures and must never broadcast real transactions. They cover routing, loading/failure states, precise amounts, forms, categories, themes, localization and mobile layout. They do not replace target-deployment login or real settlement acceptance.

If the approved preview is unavailable, `node scripts/browser-artifacts.mjs ui` (or `admin` or `policy`) runs the existing interaction checks against the current built native artifacts on a disposable loopback HTTP server. Supply `DIDMAIL_BROWSER_CORE_CSS=/absolute/path/to/cached-aup-core.css` containing the genuine public ARC stylesheet; help and appearance checks accept the same file. Unhandled business mutations are rejected. This validates generated pages and isolated interactions, not the running ARC integration, and does not start another ARC instance.
