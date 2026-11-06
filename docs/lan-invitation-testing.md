# Phone invitations over LAN or USB

Status: local development procedure. Audience: contributors testing their own disposable identities. Preserve running state before changing private runtime configuration; see [native lifecycle](arc-package-runtime.md).

## LAN

A computer's `.localhost` name does not reach that computer from a phone.
For an explicitly authorized development instance, configure `listenHost` and
`aliases` in private `protocol-runtime.json`, preserving all existing key,
network, origin and scheduler values. A typical LAN listener uses `0.0.0.0`
and an explicit alias such as `http://192.168.1.23:8788`; use the computer's
current private IPv4 address. The original public origin can remain unchanged.

Use the [private configuration/lifecycle procedure](arc-package-runtime.md#configuration-keys-and-installation)
to coordinate backup and restart of only the affected DIDMail instance. Activate
the app after restart. The create-only install action cannot overwrite an
existing configuration; changing a configured installation is a deliberate
private operator action. Never reinitialize its wallet or business state.

The retired preview's `DIDMAIL_ARC_PREVIEW_HOST` and alias environment variables
do not configure the native listener. Starting ARC with those variables is not
a configuration update. Do not start another signer against the same data or
restart unrelated ARC instances.

The computer can still use `http://didmail-server.localhost:8788`; the phone uses the configured LAN alias. Generate an invitation through that entry, or change only the origin of an authorized local invitation while preserving its full path/query. Do not commit valid invitations. Unknown hosts are rejected, and the internal ARC site namespace remains fixed; the trusted public alias controls callbacks.

This alias is for development pages, invitations and wallet callbacks. It does not migrate the advertised mail endpoint, historical content or node identity. HTTP 200 does not prove that a person accepted an invitation. The person must complete the actual wallet/ARC interaction.

Check same-network connectivity, client/guest Wi-Fi isolation and the host firewall. Update the alias after an address change. Passkeys require a suitable trusted secure origin; do not disable browser security for LAN HTTP tests.

## Android USB

For an authorized disposable Android target, add explicit `http://localhost:8788,http://127.0.0.1:8788` private runtime aliases and run:

```sh
adb -s <device-serial> reverse tcp:8788 tcp:8788
```

Use ordinary `http://localhost:8788` on the phone; native wallets may not resolve `.localhost` subdomains. Preserve invite paths/queries. Reconnection may require recreating the mapping. Remove only this mapping when finished:

```sh
adb -s <device-serial> reverse --remove tcp:8788
```

Do not replace another application's mapping. USB debugging/ADB is Android-specific; this is not an iPhone procedure.
