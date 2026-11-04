# DIDMail ARC / Workers

This is the standalone DIDMail server repository. Never edit the historical legacy server.

- Production runtime is Cloudflare Workers: workers/index.ts, workers/app.ts, workers/database.ts.
- UI source is ui/ (framework-free browser interactions and component renderers); page layouts are blocklet/pages/\*/layout.aup, with styles/manifests under blocklet/.web/components. No React runtime. Original Express routes remain in api/src/routes.
- UI changes follow the single authority at the DIDMail project design documentation, including neutral semantic surfaces, direct Light/Dark switching and platform-specific runtime acceptance.
- pnpm build:client generates the component artifacts and ARC page cache. Never restore the old SPA fallback: preserve /admin/\* by mapping each route to its matching native page in workers/index.ts.
- workers adapters are substituted at build time by scripts/build-worker.mjs. Never ship the filesystem wallet, sqlite3, Sequelize driver or Node gateway into the Worker.
- D1 stores relational metadata; R2 stores encrypted mail bodies/attachments; Workers Secrets hold the original application wallet. ARC identity/platform requests go through an explicit Service Binding or HTTPS origin.
- pnpm start runs Wrangler/workerd, not the legacy Node API. start:legacy is reference only.
- Verify pnpm lint, pnpm test, pnpm test:scripts, pnpm test:worker, pnpm build, pnpm test:browser, pnpm test:ui, pnpm test:browser:admin, pnpm test:browser:ui, pnpm worker:deploy:dry.
- Keep methods/paths in docs/legacy-routes.json and preserve wallet derivation, ciphertext and signed download compatibility.
- Never commit .env.local, .dev.vars, wallets, SQLite, exports, .wrangler or .arc homes. Never put them in the public blocklet package.
- Keep the original node wallet when migrating existing assets and encrypted domain keys; ARC login identity is separate.
- Do not stop other ARC instances, especially purpose=observe. Use isolated test resources.
- Local DIDMail development uses only ARC instance `didmail-web` with `pnpm arc:run`, exposed at `http://didmail-server.localhost:8788`. Historical DIDMail instances were retired on 2026-10-27; do not recreate them for normal development. `pnpm start` is the separate Workers-only entry at 8787.
- Do not broadcast chain transactions or external messages from tests. Report actual runtime/deployment limits honestly.
- Read docs/workers-migration.md for the unresolved hosted ARC application/extension deployment boundary. Local ARC module imports do not prove Workers support.

- Local preview persistence uses `resourcePersistencePath` at `.wrangler/state/arc-preview`; Miniflare ignores legacy `d1Persist`/`r2Persist` options. Preserve an existing ephemeral D1/R2 state before restarting it; checkpoint tools and verified migration procedure are documented in `docs/local-preview-persistence.md`.
