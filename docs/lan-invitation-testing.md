# Phone invitations over LAN or USB

Status: local development procedure. Audience: contributors testing their own disposable identities. Preserve running state before changing preview configuration; see [preview persistence](local-preview-persistence.md).

## LAN

A computer's `.localhost` name does not reach that computer from a phone. Explicitly enable the intended LAN listener and alias; replace the example with the computer's current private IPv4 address. Run from `server/`:

```sh
DIDMAIL_ARC_PREVIEW_HOST=0.0.0.0 \
DIDMAIL_ARC_PREVIEW_ALIASES=http://192.168.1.23:8788 \
NO_PROXY=127.0.0.1,localhost,.localhost,192.168.1.23 \
no_proxy=127.0.0.1,localhost,.localhost,192.168.1.23 \
pnpm arc:run
```

Keep any other required existing preview/network options. Do not start another runner against the same D1/R2 state or restart unrelated ARC instances.

The computer can still use `http://didmail-server.localhost:8788`; the phone uses the configured LAN alias. Generate an invitation through that entry, or change only the origin of an authorized local invitation while preserving its full path/query. Do not commit valid invitations. Unknown hosts are rejected, and the internal ARC site namespace remains fixed; the trusted public alias controls callbacks.

This alias is for development pages, invitations and wallet callbacks. It does not migrate the advertised mail endpoint, historical content or node identity. HTTP 200 does not prove that a person accepted an invitation. The person must complete the actual wallet/ARC interaction.

Check same-network connectivity, client/guest Wi-Fi isolation and the host firewall. Update the alias after an address change. Passkeys require a suitable trusted secure origin; do not disable browser security for LAN HTTP tests.

## Android USB

For an authorized disposable Android target, add explicit `http://localhost:8788,http://127.0.0.1:8788` preview aliases and run:

```sh
adb -s <device-serial> reverse tcp:8788 tcp:8788
```

Use ordinary `http://localhost:8788` on the phone; native wallets may not resolve `.localhost` subdomains. Preserve invite paths/queries. Reconnection may require recreating the mapping. Remove only this mapping when finished:

```sh
adb -s <device-serial> reverse --remove tcp:8788
```

Do not replace another application's mapping. USB debugging/ADB is Android-specific; this is not an iPhone procedure.
