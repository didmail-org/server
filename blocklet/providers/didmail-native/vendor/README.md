# Retained crypto source

`noble-hashes/` contains unmodified published ESM modules from `@noble/hashes`
2.4.0 and its original MIT LICENSE. These are the same hash implementations used
by the installed `@ocap/mcrypto` 1.30.24. They support canonical ABT DID checksum
validation in the native provider without a package-install or build hook.
Deliberate updates require checksum compatibility tests and license review.
