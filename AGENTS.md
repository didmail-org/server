# DIDMail Server agent guide

Use the single native ARC Blocklet runtime. Do not restore standalone Workers
startup, deployment or fallback. Read README → docs/local-arc-development.md →
docs/server-architecture.md; consult docs/arc-package-runtime.md only for operation/state changes.

- Inspect Git changes first. This is an independent repository; preserve unrelated work and private state.
- Edit canonical package sources/components, not `ui/` regression facades. Unit tests live in `tests/unit`; Node-only ports live in `tests/support/node`. Keep test substitutions outside the native loader and never copy shared implementations. Source ownership is in the architecture guide.
- Preserve `did:blocklet:didmail-server`, `/instance`, route/method contracts, original identities, exact amounts, signed bytes, replay/lease/fence predicates and encrypted objects. SQL migrations and fixtures are compatibility contracts, not dead files.
- For persistence changes read docs/afs-business-storage.md and docs/afs-policy-admission.md. Close relational fences before releasing policy locks; never reopen delayed-writer tokens or silently initialize over missing/corrupt state.
- Existing local operation uses `didmail-web`. Configuration/provider changes require controlled restart; leave unrelated services (especially purpose=observe) running. Follow operations for coordinated backup/import; never regenerate a wallet as recovery.
- Keep keys, real mail, configs, databases, checkpoints and private evidence outside Git/logs/package. Preserve LICENSE, NOTICE, third-party provenance and unresolved release gates. Vendor bytes/hashes change only through deliberate dependency review.
- Run the development guide's checks for the affected source. Lint actual components/core, not only facades; exclude vendor/generated outputs. Never delete assertions or expose production test routes to pass checks. Tests use disposable public fixtures without real mail or chain broadcasts.
- English is authoritative. Preserve all five help languages and their package copies. Consolidate lasting facts at the task's authority; put run records/measurements in ignored artifacts, not dated appendices to guides.
