# Trusted ARC membership source

Status: implemented adapter contract, verified against the ARC beta.74 interface. Audience: operators and integration maintainers. Reverify upstream compatibility when upgrading ARC.

## Internal binding contract

A dedicated trusted binding accepts `GET https://arc-members.internal/member?instanceId=…&did=…` and returns exactly the required identity/scope plus `role` and authoritative boolean `active`. Roles are owner/admin/member/guest. A missing member returns 404. Unknown status, wrong identity/instance, malformed data, upstream authorization errors, timeouts or redirects return unavailable (503), never an implicit non-member or paid fallback.

## Upstream adapter

The local adapter queries only the configured ARC site's instance-scoped team list:

```text
GET /.well-known/service/api/team/members?instance=<configured>&blocklet=<configured>&search=<full-DID>&page=1&pageSize=2
```

Require `ok:true`, nonaggregated data, one exact DID/instance match and `paging.total=1`. `approved` is accepted only as boolean or exact integer 0/1 and normalized to `active`. Empty users plus total zero is the only absence result. Detail-only/role-only data cannot establish active status. Exact lookup is bounded to 64 KiB and 10 seconds, with no redirects. Strip extra profile fields.

The fixed public Host/forwarded-host context and private service credential are configured by the operator, never by the browser. The Node HTTP bridge sends Host explicitly; a wrong site context can produce an authentication failure even with a valid credential. Do not conclude that ARC lacks Bearer support from that failure alone.

The admin directory bridge separately permits bounded `/members` pagination/search and role/active filters. It validates returned scope, filter compliance, pagination and an explicit output-field allowlist. It does not read ARC's internal identity database.

## Credential and deployment boundary

The local `ARC_MEMBERS_TOKEN` remains in the private bridge closure, not Worker bindings, public packages or logs. Do not export a browser session cookie for this integration. Production requires an equally restricted trusted service integration. Prefer the smallest available permission scope and rotate expiring credentials. A broad upstream admin token does not justify exposing generic ARC RPC to callers.

Executable references: [bridge](../scripts/arc-members-bridge.mjs), [transport](../scripts/arc-http-transport.mjs) and their adjacent tests. These cover fixed host/scope, exact lookup, directory filtering, redirection refusal and failure-closed behavior without real member mutation.
