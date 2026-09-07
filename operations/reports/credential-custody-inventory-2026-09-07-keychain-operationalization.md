# Credential custody inventory — Keychain operationalization — 2026-09-07

## Result

This re-audit covers the production macOS Keychain adapter and every
credential-bearing family identified by the accepted Identity & Access
inventory. It records ownership, scope, store, host, consumer, verifier, and
migration state without reading credential values, auth files, browser storage,
cookies, process environments, private keys, or Keychain data.

There are zero production credentials whose authoritative material owner is
currently proven to be Brain and therefore zero production migrations. The
adapter is nevertheless production-capable and is validated with one
ephemeral synthetic credential that is deleted after each lifecycle test.

## Custody matrix

| Resource family | Owner | Scope/store/host | Consumer | Health verifier | Migration state |
| --- | --- | --- | --- | --- | --- |
| Codex CLI OAuth, accounts 01 and 02 | Codex application/provider | runtime-instance-local; native Codex roots on Office | Codex CLI | supported app-server status/doctor | `application_owned`; excluded |
| Codex Desktop OAuth | Codex Desktop application/provider | runtime-instance-local; MacBook application state | Codex Desktop | owner-supported application status | `application_owned`; excluded |
| Shared `~/.codex` | native Codex application | OS-user-global; shared default root | Codex/CLI | bounded metadata-only profile check | `unknown`; observe-only; excluded |
| WebGPT browser/session/routing state | WebGPT application/provider | browser-profile-local; WebGPT production | WebGPT | WebGPT owner doctor and browser acceptance | `application_owned`; excluded |
| `codex_apps` MCP OAuth | MCP/application/provider | MCP application-local | `codex_apps` MCP | provider response state | `application_owned`; excluded; revoked incident |
| Stitch MCP OAuth/startup state | MCP/application/provider | MCP application-local | Stitch MCP | startup/provider diagnostic | `application_owned`; excluded; availability unknown |
| Tailscale identity/API session | Tailscale application/provider | host/connection-local | Tailscale tooling | Tailscale path/control checks | `provider_owned`; excluded |
| MacBook → Office SSH identity | host/SSH owner | connection-local; MacBook to Office | remote execution connection | SSH/path health | `host_owned`; excluded |
| Seven IKHP infrastructure references | material owner varies by provider/app/host; Brain owns metadata only | existing provider/app/host stores | Cloudflare, New Relic, Dokploy, AWS, Azure, Tailscale consumers | provider-specific verifiers per resource | `unknown`; not eligible until owner/rotation/recovery proof |
| Synthetic acceptance credential | Brain test harness | host-local macOS `login` Keychain, `tools.prochat.brain` | registered synthetic verifier | bounded verifier result | `ephemeral`; create/read/update/delete then deleted |

The seven IKHP references are
`cloudflare-provisioner`, `newrelic-query`, `dokploy-management`,
`aws-provisioner`, `azure-apps-provisioner`, `azure-data-provisioner`,
and `tailscale-control`. Their existing metadata remains authoritative for
discovery, but its presence does not prove Brain owns the underlying secret.

## Classification

| Classification | Count | Meaning |
| --- | ---: | --- |
| `eligible_for_keychain` | 0 production | No real candidate has complete owner, consumer, rotation, recovery, and cutover evidence |
| `already_secure_elsewhere` | 0 asserted production | No storage was promoted without a full custody proof |
| `application_owned` | 6 families | Codex, Desktop, WebGPT, and MCP application state stays with its owner |
| `provider_owned` | 1 family | Tailscale/provider sessions stay with their owner |
| `unknown` | 1 family | Seven infrastructure references need individual custody proof |
| `deprecated` | 0 asserted | No candidate was silently retired |
| `not_applicable` | 1 test family | Ephemeral synthetic fixture only |

## Brain Keychain contract

The default store is the user's macOS `login` Keychain. Brain uses the single
logical service namespace `tools.prochat.brain`; references use the form
`keychain-ref://<service>/<opaque-account>`. Items are generic passwords,
host-local, `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, and explicitly
non-synchronizing. Metadata inventory returns only safe attributes and never
requests secret data.

Create/update/delete are approval-gated. Secret input is accepted only in
memory and delivered to the native Security.framework helper through stdin.
Authorized read is bounded native-to-registered-verifier stdin delivery. No
secret is placed in argv, environment, stdout, stderr, logs, Git, prompts,
reports, or plaintext files. A separate physical Brain keychain is optional
future deployment, not the default.

## Evidence

- Native synthetic lifecycle: create → metadata lookup → existence check →
  bounded verification → update → delete → absence proof: pass.
- Native helper output: redacted JSON only; secret output: never returned.
- Locked/denied and unavailable Keychain states: fail closed and remain
  distinct from provider health.
- Canonical catalog: zero production credential records and one operational
  Keychain adapter.
- Application-owned OAuth and WebGPT state: not read, copied, or modified.

The complete security review and validation results are in the companion
Keychain production-readiness audit.
