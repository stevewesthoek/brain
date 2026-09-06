# IKHP Live Codex Runtime Observation — 2026-09-05

## Scope

This is a read-only observation of the native Codex/ChatGPT runtime family and the Codex Web GPT production and DEV topology on the local workstation. It does not read or print auth files, OAuth tokens, cookies, API keys, tunnel credentials, process arguments, environment variables, or browser storage. It does not start, stop, restart, log in, log out, change configuration, attach a connector, or mutate the catalog.

The observation was produced by `tools/observe-infrastructure.mjs` at `2026-09-05T11:47:22.167Z`. The runtime health gate was `NOT_OK` because production is degraded on connector-attachment uncertainty and DEV is unknown/not ready. The output is an ephemeral evidence report; it is not a claim that runtime state remains unchanged after that timestamp.

## Safe observed evidence

| Subject | Observed | State | Evidence boundary |
|---|---|---|---|
| Codex Web GPT production application | Version `5.0.2`; supported doctor checks confirmed configuration, embedded browser reachability, route, proxy, tunnel binary/key/service/runtime | Degraded | Connector `Codex Native2` attachment is not locally provable, so production is not marked fully healthy |
| Codex Web GPT bridge | Loopback HTTP listener on port `17841`; owner process observed; supported doctor reports proxy reachable | Healthy | Bridge ownership is associated with the application route, but raw process arguments and configuration were excluded |
| Codex Web GPT tunnel | Tunnel process observed; supported doctor reports runtime ready | Healthy | Credential material was not read; application custody is inferred from supported runtime evidence, not secret inspection |
| Native Codex/ChatGPT runtime family | Native application version `26.901.31953`; `codex login status` classified as authenticated | Healthy runtime family / identity unresolved | No account, email, principal, OAuth profile, or token was emitted; executable family evidence does not prove one specific UI process or account |
| Codex Web GPT DEV profile | Configured as `full` / `dev-harness`; launcher not running; MCP required but not ready | Unknown / unavailable | DEV was not started or repaired during observation |
| Local runtime metadata | 26 allowlisted Codex-family process records and four allowlisted relevant loopback listeners | Observed | Process arguments, environment, and unrelated listener metadata were excluded from the report |

## Relationship model

```text
Codex Web GPT production application
├─ owns → local bridge :17841
├─ owns → production tunnel runtime
├─ depends on → embedded browser session
└─ routes through → Codex route

Native Codex/ChatGPT runtime family
└─ login status → authenticated (account identity intentionally unknown)

Codex Web GPT DEV profile
└─ configured → dev-harness (runtime not running; MCP readiness unknown)
```

The production route and tunnel are application-owned in the vendor-supported runtime model. The account-to-session mapping, connector attachment, launch-at-login behavior, keep-running policy, active workload/quiescence, and per-profile OAuth custody remain unknown unless a supported non-secret provider adapter can prove them.

## What this proves about the reported MCP error

The earlier `codex_apps` HTTP 401 with `token_revoked` is a provider credential/session failure: an OAuth token was invalidated by the provider. It is not explained by the local process/listener topology alone. The `stitch` timeout is a separate startup-availability condition. Connector attachment uncertainty is also a separate relationship-evidence gap. A future health check must therefore attribute failures to an opaque account/profile reference before any recovery or notification decision; a global “Codex is healthy” flag is insufficient for a multi-account setup.

## Account-agnostic conclusion

This observation does **not** prove that multiple Codex OAuth accounts are preserved across logout/login. It proves only that the current native login status is authenticated and that the WebGPT runtime is operational with one unresolved connector relationship. The correct long-term model is one opaque account/profile record per provider account, with separate provider-owned sessions and explicit runtime-profile bindings. Account identity must be learned through a supported provider/API boundary or user-confirmed enrollment; it must never be inferred from tokens, browser storage, filenames, or process guesses.

## Vault and credential-health boundary

The current/reference Brain-managed secret-store adapter remains macOS Keychain. OnePassword is a future adapter option, not the current source of truth and not a reason to move or duplicate secrets in this tranche. Brain may store opaque references, ownership, expiry/renewal metadata, and non-secret verification evidence. It must not store raw OAuth tokens, passwords, cookies, private keys, or API-key values.

Health checks can detect invalid, revoked, stale, or unreachable credentials and notify through the existing attention/incident owners. Automatic refresh or rotation is provider-specific and must be an explicitly admitted, user-authorized action; artificial keep-alive traffic and blind renewal are not safe defaults.

## Implemented generic foundation

- [infrastructure-observation-v1.schema.json](/Users/Office/Repos/stevewesthoek/brain/operations/specs/infrastructure-observation-v1.schema.json) now carries provider-neutral runtime, relationship, ownership, dependency, identity, lifecycle, isolation, and redaction evidence while retaining the existing health-observation contract.
- [infrastructure-candidate-v1.schema.json](/Users/Office/Repos/stevewesthoek/brain/operations/specs/infrastructure-candidate-v1.schema.json) defines candidates, pure admission plans, and bounded onboarding backlog items.
- [observation-core.mjs](/Users/Office/Repos/stevewesthoek/brain/tools/infrastructure-catalog/observation-core.mjs) defines `discover()`, `observe()`, `verifyRelationship()`, candidate creation, fail-closed admission, and backlog construction.
- [local-runtime-observer.mjs](/Users/Office/Repos/stevewesthoek/brain/tools/infrastructure-catalog/local-runtime-observer.mjs) provides generic process/listener discovery without command arguments or environment capture.
- [codex-runtime-adapter.mjs](/Users/Office/Repos/stevewesthoek/brain/tools/infrastructure-catalog/codex-runtime-adapter.mjs) is a product adapter proof, not the canonical abstraction.
- [validate-infrastructure-observation-admission.mjs](/Users/Office/Repos/stevewesthoek/brain/tools/validate-infrastructure-observation-admission.mjs) provides a deterministic OK/NOT OK gate. It proves clean application-managed and Brain-managed admission, unresolved ownership, conflict rejection, dependencies, identity binding, isolation, redaction, local runtime parsing, Codex normalization, and the 46-resource canonical backlog.

## Remaining unknowns and next goal

The canonical catalog still contains 46 governance-unknown resources. The next safe tranche should evolve the existing Identity & Access catalog with account/session/runtime-profile bindings and provider-owned session/account adapters, beginning with read-only enrollment and per-account health attribution. It should not attempt token extraction, silent migration, automatic keep-alive traffic, blind refresh, or live route/config mutation.

### Canonical backlog item IDs

The report-only backlog enumerated these 46 resource IDs at observation time:

```text
application:prochat-local
backup_job:cloudpanel-aws-recovery
backup_job:dokploy-aws-recovery
backup_job:n8n-backup
backup_job:supabase-recovery
backup_system:cloudpanel-aws-recovery
backup_system:dokploy-aws-recovery
backup_system:office-nightly-maintenance
backup_system:supabase-recovery
control_plane:brain-core
credential_reference:aws-provisioner
credential_reference:azure-apps-provisioner
credential_reference:azure-data-provisioner
credential_reference:cloudflare-provisioner
credential_reference:dokploy-management
credential_reference:newrelic-query
credential_reference:tailscale-control
database:prochat-local-postgres
dns_record:prochat-tools-root
domain:prochat-tools
host:cloudpanel-aws
host:dokploy-aws
host:dokploy-azure
host:macbook
host:office
host:vm-supabase
monitor:newrelic-infrastructure
network:tailnet-infrastructure
provider_account:aws-primary
provider_account:azure-prochat-apps
provider_account:azure-prochat-data
provider_account:cloudflare-prochat
provider_account:dokploy-primary
provider_account:newrelic-primary
provider_account:tailscale-primary
scheduler:office-nightly
service:brain-core
service:cloudpanel-platform
service:dokploy-platform
service:n8n-office
service:supabase-platform
storage:supabase-storage
tunnel:cloudflare-cloudpanel-aws
tunnel:cloudflare-officemac
tunnel:cloudflare-production
tunnel:cloudflare-supabase
```
