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
| `/admin/attachment` | `admin-attachment` | Attachment settings                |

The [architecture source map](server-architecture.md#native-ui) is authoritative
for authored UI inputs and regression facades; the [development guide](local-arc-development.md)
owns build/run commands.

The shared protocol handler maps public admin paths to flat native page IDs. Direct ARC hosting uses the manifest's explicit redirects from these bookmarks to their canonical flat pages. Locale prefixes, queries and anchors retain their public meaning. ARC owns the single app header, language/theme/user menus and login; the platform Admin Console is separate from DIDMail business administration.

## Authorization and state

Every admin navigation verifies the ARC session before loading data or restoring display snapshots. Members/anonymous users do not load owner/admin data. API authorization and origin checks remain authoritative. No node private key enters browser state.

[ui/node-state.js](../ui/node-state.js) scopes query/display snapshots to user identity/provider/role and node/network/configuration. Corrupt, future, expired or foreign snapshots are rejected. Stored fields are a bounded display allowlist, not credentials, mail or transaction authority. Logout/revoked access clears snapshots. Disabled browser storage falls back to reads.

Progressive regions render independently: account, stake, NFT/factory, template lists and mail/capacity do not all wait for the slowest read. Same-page concurrent identical GETs coalesce; mutations never coalesce/cache and invalidate older in-flight reads. Polling/manual refresh behavior belongs to the current query/header implementation; it cannot authorize a transaction from a cached balance.

Before spending, load current terms/balance/stake again. Cancel or invalidate pre-write reads so they cannot repopulate stale state. Preserve failed forms and saved snapshots with explicit stale/unavailable status. A returned transaction hash is submission evidence, not chain confirmation.

Settings policy forms and Members access lists use the ARC session WebSocket
and native `/didmail-native` AFS actions. They verify the native ARC role and do
not require a Worker session or node balance. Missing policy offers explicit
administrator initialization; malformed/inaccessible data never becomes a draft.
Conflicts preserve unsaved input; revocation clears protected display snapshots.
Delivery progress, diagnostic codes, next attempts and previous rejected NFT transaction IDs are shown in each Storage record. Settings contains only the new-mail service policy. It does not render or read/write the historical attachment configuration, and it does not request the separate delivery-health endpoint. Already accepted mail retains its recorded terms; historical configuration data and compatibility APIs remain available to their existing consumers. The original REST health contract remains available for compatibility.
See [policy/admission guarantees](afs-policy-admission.md).

## Templates and list caches

SVG samples are bundled, rendered as images and validated before use. Envelope samples require `mail.sender`; supported fields include subject, sender, creation/expiry and envelope metadata. Namecards require `{{contact.name}}` and use the contact rendering context. Factory details load on demand, while creation always checks actual factory fees before confirmation. Categories are assigned once and publication does not change them.

Template list pages use scope/version/pointer metadata and separate JSON payloads, stored in instance AFS. Historical D1/R2 cache records remain migration-compatible. Normal cached pages avoid chain reads; a cache miss, explicit refresh or successful creation synchronizes. Publication flags are merged separately, never overwritten by chain refresh. Failed refresh keeps the last valid list. Version and pointer CAS reject stale writers and prevent deleting another writer's object. These are rebuildable display caches, not economic authorization or a complete orphan-cleanup mechanism.

## Public brand entrance

The public home uses a full near-black scene in both saved appearances. At 1024 CSS pixels and above, the transparent dove/product name and existing introduction/entry actions occupy equal full-page halves, with each group centered horizontally and vertically. A 1px neutral midpoint separator fades from its brighter center to transparent ends. Narrow screens retain the centered vertical composition without a separator. The native header keeps its accessible small home link while visually hiding the redundant home-page title; other pages retain their normal header identity.

Owned server form fields signal focus through a neutral border-color change with unchanged stroke width, font weight and geometry. They do not add a ring/shadow; forced-colors mode retains a visible system outline. Native ARC authentication remains platform-owned.

## Accessibility and localization

English is default; Simplified Chinese, Arabic, Japanese and Russian have matching message keys. SSR emits the requested language and localized links. Arabic uses RTL, while DIDs, amounts and code retain appropriate LTR isolation. Forms/dialogs have labels and keyboard interactions. The header exposes a direct Light/Dark toggle with a target-specific accessible name. Fixed choices persist; legacy explicit System resolves once during migration. Later OS palette changes have no effect. See the [product design authority](https://github.com/didmail-org/overview/blob/main/docs/product-design.md). Mobile navigation may scroll within its own strip without overflowing the page.

The help renderer reads the public Markdown copies in `blocklet/.aup/locales`, preserving stable translated section IDs and escaping raw HTML. Update these together with [docs/help](help/README.md); the native package test checks equality. Help is readable without JavaScript and does not request business data. Header/home/admin links and per-page contextual links expose it.

## Verification

Use the [UI check row](local-arc-development.md#change-a-feature-and-choose-checks)
for commands. Browser fixtures cover routing, failure states, precise amounts,
forms, categories, themes, localization and mobile layout without real mutations.
They do not replace target-runtime authentication or settlement acceptance.
