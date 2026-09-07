# Identity & Access credential-custody inventory — 2026-09-07

> Historical pre-operationalization snapshot. The authoritative re-audit is
> `operations/reports/credential-custody-inventory-2026-09-07-keychain-operationalization.md`.

## Scope and conclusion

This is a metadata-only inventory. It records custody, scope, health, and
evidence boundaries without reading credential values, `auth.json`, browser
storage, Keychain data, process environments, cookies, OAuth callbacks, or
private keys.

The inventory confirms that native application authentication must remain
application-owned. Brain can safely own metadata and read-only health policy,
but it must not become a second owner for Codex, WebGPT, MCP, Tailscale, or
provider-issued sessions. Existing Brain infrastructure references remain a
separate migration backlog because their consumer and rotation contracts are
not uniformly proven.

## Custody matrix

| Resource family | Canonical reference/evidence | Custody | Scope | Current health/evidence | Keychain action |
| --- | --- | --- | --- | --- | --- |
| Codex CLI account 01 | `account:openai.01`, `runtime_profile:openai.01.cli`, `runtime_instance:office.openai.01.cli` | application-managed (Codex) | runtime-instance-local / host-local | authenticated; doctor OK; account mapping operator-attested | never migrate OAuth |
| Codex CLI account 02 | `account:openai.02`, `runtime_profile:openai.02.cli`, `runtime_instance:office.openai.02.cli` | application-managed (Codex) | runtime-instance-local / host-local | authenticated; doctor OK; account mapping operator-attested | never migrate OAuth |
| MacBook Codex desktop | `runtime_instance:macbook.openai.02.desktop` | application-managed (Codex Desktop) | runtime-instance-local / host-local | operator-attested; provider identity not inspected | never migrate OAuth |
| Shared/default Codex | `session:codex-default.shared` | application-managed; observe-only | global / operating-system-user | unknown account, storage mode, and effective backend | do not normalize or rewrite |
| WebGPT production | `session:codex-webgpt-production` | application-managed (WebGPT) | surface-local / browser-profile | config, service, proxy, tunnel healthy; browser/connector acceptance deferred | never migrate browser/session OAuth |
| `codex_apps` MCP | `session:mcp.codex_apps` | MCP/application-managed | surface-local | provider-revoked (`token_revoked`) from prior 401 | human/provider reauth only |
| Stitch MCP | `session:mcp.stitch` | MCP/application-managed | surface-local | startup/provider availability unknown after timeout | no token inspection or copying |
| MacBook → Office SSH | execution connections with `credentialCustodyRef=custody:ssh.macbook-office` | host/application-managed | connection-local | two network paths and SSH connections observed healthy | not an OpenAI credential |
| Tailscale control/session | external `credential_reference:tailscale-control` plus access paths | Tailscale/application-managed | host-local / connection-local | path probe healthy; API credential not migrated | separate provider/application custody |
| Existing infrastructure refs | seven refs in `operations/infrastructure/catalog/access-references.v1.json` | Brain metadata owner; material owner remains provider/app/host-specific | provider-, host-, or service-local | metadata exists; several source freshness dates require review | deferred per-provider migration |
| Other indexed credentials | `operations/accounts/credentials-index.md` | provider/application/host ownership varies | service- or application-local | inventory source exists; no universal verifier | classify individually before enrollment |

The seven currently indexed IKHP credential references are
`cloudflare-provisioner`, `newrelic-query`, `dokploy-management`,
`aws-provisioner`, `azure-apps-provisioner`, `azure-data-provisioner`, and
`tailscale-control`. Their reference metadata remains in the IKHP catalog. It
was not duplicated into the I&A catalog, and no file contents were read.

## Brain-managed versus application-managed

No production secret was proven eligible for migration in this closeout. A
credential is not Brain-managed merely because Brain has a metadata entry or a
runbook naming its current file. Before any future Keychain enrollment, the
owner must establish the exact authoritative mutation owner, all consumers,
provider-supported verification, rotation/recovery behavior, and a safe
human-gated migration path. Shared environment files with multiple consumers
therefore remain deferred rather than being silently moved.

The canonical I&A catalog has zero credential records and one registered
reference adapter. This is intentional: it prevents Brain's read-only health
loop from pretending that application-owned OAuth is a Brain-vault credential,
and it prevents a missing adapter reference from being mistaken for healthy
provider authentication.

## Keychain evidence

The registered adapter is `secret-store:macos-keychain` with:

- namespace `keychain-ref://` under the then-pilot Brain service namespace
  prefix;
- metadata read and bounded-consume capabilities only;
- mutation disabled and explicit human bootstrap;
- no generic getter, export, backup, or application-OAuth import path.

The real metadata-only smoke probe of the fixed synthetic reference returned
`storageState=missing`, `detailedState=credential_missing`, and
`secretValueReturned=false`. This is a safe availability/reference result,
not provider health and not evidence that any user credential is absent.

## Health and incident separation

The read-only health CLI completed with no credential evaluations because no
Brain-managed credential records are admitted. That is a valid zero-credential
result, not a claim that all credentials work. The session/runtime evidence
remains separate:

- dedicated Codex CLI runtime authentication: healthy and root-isolated;
- shared/default Codex: unknown and intentionally bounded;
- WebGPT: local runtime components healthy, browser/connector acceptance
  deferred while the active Codex turn is present;
- `codex_apps`: provider-revoked incident;
- Stitch: startup/provider-availability incident;
- SSH/Tailscale path health: independent of OpenAI OAuth health.

Unknown, wrong-account, revoked, expired, stale, unavailable, and
reauthentication-required remain distinct states. No generic refresh, artificial
keepalive, logout switching, or automatic provider rotation is enabled.

## Security review

The repository and live checks exposed only identifiers, paths, status values,
timestamps, and redacted metadata. No OAuth access/refresh token, API key,
password, cookie, auth-file content, Keychain value, SSH private key, Tailscale
credential, or unnecessary raw provider identity was added to the catalog,
report, stdout, Git, or model context.
