# IKHP2 Live Health Observation & Provider Normalization — 2026-08-16

## Status

**Accepted 2026-08-17 as a repository implementation.** IKHP0-IKHP2 are complete. IKHP3-IKHP6 and CLR5 remain not authorized. This acceptance proves deterministic read-only normalization and bounded runtime persistence contracts; it does not claim continuous scheduling, live provider reachability, valid credentials, current infrastructure health, incidents/notifications, remediation, or infrastructure mutation.

## Goal

Implement a source-neutral, read-only infrastructure observation layer over IKHP1 resource IDs. IKHP2 normalizes provider/scheduler/access evidence into bounded derived runtime state without changing canonical topology, provider configuration, servers, backups, credentials, or human decision state.

## Authority boundary

- **IKHP1** remains canonical Git authority for resource IDs, topology, bindings, backup policy, health/freshness policy, access-reference metadata, and safety policy.
- **Provider systems** remain telemetry/evidence authority for their own live observations.
- **IKHP2** stores normalized derived observations only under `runtime/local/infrastructure/`.
- **IKHP3** incidents/notifications are not implemented here.
- **CLR3 Decision Core** is unchanged.

Unknown, unavailable, error, and stale provider state must never become healthy by default.

## Implemented repository surfaces

```text
operations/specs/infrastructure-observation-v1.schema.json
operations/infrastructure/health/provider-bindings.v1.json
operations/fixtures/infrastructure-health-provider-fixtures-v1.json
projects/brain-core/src/adapters/infrastructure-observation-runtime.mjs
projects/brain-core/src/adapters/infrastructure-provider-normalizers.mjs
projects/brain-core/src/adapters/infra-tailscale.ts
projects/brain-core/src/adapters/infra-health-collector.ts
projects/brain-core/src/adapters/infra-new-relic.ts
projects/brain-core/src/adapters/infra-cloudflare-tunnels.ts
projects/brain-core/src/adapters/infra-cloudflare-domains.ts
projects/brain-core/src/tests/infrastructure-observation-runtime.test.mjs
tools/validate-infrastructure-health.mjs
package.json
```

Root package scripts expose deterministic validation/tests without requiring live provider credentials or network access:

```text
npm run validate:infrastructure-health
npm run test:infrastructure-health
```

## Observation contract

Every normalized observation must contain at least:

```text
schemaVersion
observationId
resourceId
providerId
observedAt
status
freshness
sourceEntityId
metricsSummary
conditionCodes
provenance
```

Status vocabulary:

```text
healthy
degraded
unhealthy
unknown
```

Freshness vocabulary:

```text
fresh
stale
unknown
```

If freshness is `stale` or `unknown`, the effective observation status must not be `healthy`.

## Runtime state

Default runtime namespace:

```text
runtime/local/infrastructure/
```

Planned state file:

```text
health-state.json
```

The writer must:

- use atomic replacement;
- use restrictive file permissions;
- retain only bounded recent observations;
- prune observations older than a configured maximum age;
- never persist raw provider responses, credential values, request headers, stdout/stderr, or private keys.

Tests use temporary directories and must not populate the real runtime path.

## Provider normalization

### New Relic

Extend the existing read-only adapter to retrieve/provider-shape:

- host reporting/last seen;
- CPU/memory/storage summaries;
- disk capacity;
- process presence/health summaries;
- synthetic state;
- APM/entity status summaries where available;
- alert/issue summary counts where available.

Provider query failure remains `error` and maps to unknown/stale IKHP2 observations.

### Cloudflare

Extend existing read-only tunnel data with connector count/state and preserve hostname/origin metadata. IKHP2 derives missing/conflicting connector condition codes from configured policy without performing provider writes.

### Tailscale

Add a source-neutral read-only adapter using a named `tailscale status --json` command invocation without shell execution. Normalize expected devices against IKHP1 addresses. Optional SSH reachability evidence is a bounded TCP port-22 connect probe only; it does not execute SSH, read keys, authenticate, or change known-host state.

### Dokploy / applications

Reuse the existing read-only Dokploy status adapter. Aggregate/project only provider status that maps to known IKHP1 resource IDs; unmatched provider app/entity names remain explicit unmapped evidence, not new canonical assets.

### Backups

Normalize scheduler output for cataloged backup jobs separately from backup policy. Include:

```text
lastAttempt
lastSuccess
lastFailure
ageSeconds
expectedCadence
retention
storageDestination
restoreLastVerified
restoreVerificationAgeSeconds
```

Unknown policy fields remain unknown/null rather than invented.

### Access references / OAuth

Normalize only metadata and verification result:

```text
configured
connected
expiresAt
expiryKnown
rotationDueAt
lastVerifiedAt
scopeSummary
verificationStatus
```

No raw value may appear. For current cataloged New Relic/Cloudflare/Dokploy access references, provider success/failure can serve as read-only connectedness evidence. The normalizer contract must also support OAuth-style fixture metadata even though IKHP1 currently has no canonical OAuth access reference.

## Provider-binding design

IKHP2 provider bindings are operational mapping configuration, not canonical topology. Bindings point provider selectors/expected addresses to existing IKHP1 resource IDs and must validate that every target exists.

Unknown/unmatched provider entities must be reported as unmapped observations/summary evidence, not silently assigned to an arbitrary IKHP1 resource.

## Validation plan

Required deterministic validation:

- observation JSON Schema;
- provider-binding JSON validation;
- provider fixture validation;
- IKHP1 resource-ID mapping integrity;
- exact freshness/age calculations;
- stale provider evidence cannot be healthy;
- unavailable/error/not-configured provider fallback;
- New Relic host/metric/synthetic/APM/alert projection fixtures;
- Cloudflare tunnel/connector/DNS projection fixtures;
- Tailscale peer and bounded SSH-probe projection fixtures;
- Dokploy mapped/unmapped projection fixtures;
- backup health projection;
- access/OAuth metadata-only projection;
- bounded runtime retention and atomic store behavior using temporary directories;
- no provider mutation contracts;
- no raw secret output;
- JSON validation;
- `git diff --check`;
- exact `forbidden_secret_material` scan over IKHP2 paths.

## Explicit exclusions

Do not implement or activate:

- IKHP3 incidents/notifications;
- automatic remediation;
- provider mutation;
- DNS/tunnel writes;
- credential rotation/revocation;
- backup/restore mutation;
- server/config changes;
- arbitrary shell execution;
- Obsidian installation;
- Mind changes;
- Workbench-private changes;
- Video Orchestrator changes;
- CLR5;
- Git push.

Do not absorb `operations/system-configs/claude/settings.json`.

## Acceptance boundary

IKHP2 acceptance will mean deterministic read-only normalization contracts/adapters and bounded runtime persistence are validated in the repository. It will **not** mean all providers are currently reachable, all mappings are live-confirmed, credentials are valid, monitoring is continuously scheduled, incidents are emitted, or infrastructure mutations are enabled.



## Final implementation evidence

### Normalized observation coverage

`npm run validate:infrastructure-health` passes with:

```text
bindings=16
observations=16
resourcesMapped=13
newrelic=3
cloudflareTunnels=1
cloudflareDomains=1
cloudflareDns=1
tailscale=5
dokploy=1
backups=1
access=3
```

Every configured provider binding maps to an existing IKHP1 resource ID and produces one explicit deterministic observation. Missing provider entities produce explicit `unknown`/`unhealthy` evidence rather than disappearing from the output.

### Provider coverage

- **New Relic:** existing read-only GraphQL/NRQL adapter now exposes host reporting/last seen, CPU, memory, maximum disk usage, process count, synthetics, APM reporting counts, and aggregate alert/issue summaries. No mutation query is added and Brain does not duplicate time-series telemetry.
- **Cloudflare tunnels:** existing read-only adapter now exposes connector count; normalization detects missing/conflicting connectors and origin reachability conditions.
- **Cloudflare domains/DNS:** existing read-only domain adapter now performs bounded GET-only DNS record reads. Domain state/expiry is normalized. DNS record observations are mapped to `dns_record:prochat-tools-root`; because IKHP1 intentionally does not yet encode the exact expected provider DNS content, drift remains `unknown` with `dns_expected_state_unknown` rather than false healthy.
- **Tailscale:** new adapter uses `execFile('tailscale', ['status', '--json'])` with no shell execution. Optional SSH evidence is a bounded TCP port-22 reachability probe only; no SSH command, authentication, private key, or known-host mutation is used.
- **Dokploy:** the existing read-only provider status is normalized to the canonical provider resource. Unmatched/unhealthy provider entities remain explicit evidence in `unmappedProviderEntities`; IKHP2 does not invent catalog resources.
- **Backups:** scheduler state is normalized separately from catalog policy with last attempt/success/failure, exact age, expected cadence, retention/destination references, exit code, and explicit null restore-verification evidence where unknown.
- **Access/OAuth:** current New Relic/Cloudflare/Dokploy access references expose only configured/connected/expiry/rotation/last-verification/scope/verification metadata. A generic OAuth-style fixture proves expiry/rotation semantics without introducing a new canonical OAuth asset.

### Freshness and failure behavior

- freshness boundary is exact: age equal to the allowed freshness window is `fresh`; one second beyond is `stale`;
- stale or unknown observations cannot remain `healthy`;
- provider `error` produces explicit stale/unknown observations with `provider_error`;
- provider unavailable/not-configured state produces unknown observations rather than false healthy;
- missing configured entities produce explicit `provider_entity_missing` or provider-specific missing conditions;
- unknown DNS expected state remains unknown;
- unknown restore verification remains null/explicit rather than fabricated.

### Runtime persistence

Derived runtime state is stored only when the collector is explicitly invoked with persistence enabled. Default path:

```text
runtime/local/infrastructure/health-state.json
```

The runtime writer:

- writes atomically through a temporary file + rename;
- creates runtime directories with restrictive permissions;
- writes the snapshot with mode `0600`;
- defaults to at most 500 observations;
- defaults to a seven-day maximum observation age;
- prunes by both age and count;
- stores normalized summaries only, not raw provider responses or credential values.

Tests use temporary directories and do not create the real runtime state file.

### Deterministic tests

`npm run test:infrastructure-health` passes **10/10**:

1. exact freshness boundary and stale-healthy downgrade;
2. New Relic host/metric/missing-entity mapping;
3. provider error fallback never healthy;
4. Cloudflare connector policy/origin normalization;
5. Cloudflare domain/DNS unknown-drift behavior;
6. Tailscale expected-device/missing-peer behavior;
7. Dokploy unmapped provider evidence;
8. backup policy-vs-health separation and unknown restore evidence;
9. metadata-only access/OAuth expiry behavior;
10. bounded atomic `0600` runtime persistence.

### TypeScript toolchain limitation

`npm run typecheck` under `projects/brain-core` was attempted and could not run because `tsc` is not installed in this checkout (`sh: tsc: command not found`). This is an environment/tooling limitation, not a reported TypeScript diagnostic. No dependency installation was attempted merely to broaden validation.

### Live-versus-repository truth

Repository observation contracts/normalizers: **implemented and deterministic**.

Continuous background monitoring/scheduling: **not activated**.

Current live provider reachability: **not claimed by deterministic acceptance**.

Current credential/OAuth validity: **not claimed**.

Current server/tunnel/disk/backup health: **not claimed** until the collector is explicitly run against live providers.

IKHP3 incidents/notifications: **not implemented**.

Automatic remediation: **not implemented**.

Infrastructure/provider mutation: **not implemented**.

Mind / Workbench-private / Video Orchestrator / Obsidian installation / CLR5: **unchanged**.

Git push: **not performed**.



## Final repository hygiene

- JSON validation: **PASS** for `package.json`, observation schema, provider bindings, and deterministic provider fixtures.
- `npm run validate:infrastructure-health`: **PASS** — 16 bindings / 16 observations / 13 mapped IKHP1 resources.
- `npm run test:infrastructure-health`: **PASS 10/10**.
- `npm run validate:diff-check`: **PASS**.
- Exact `forbidden_secret_material` scan over all new IKHP2 paths and non-provider modified paths: **PASS — 0 findings**.
- Whole-file scanning of the three pre-existing credential-reading provider adapters (`infra-new-relic.ts`, `infra-cloudflare-tunnels.ts`, `infra-cloudflare-domains.ts`) reports lexical credential-loader assignments that predate IKHP2. Exact Git diff review proves the flagged loader lines are outside IKHP2 hunks; IKHP2 changes in those files are read-only query/result enrichments only. No raw secret value was added.
- Brain Core TypeScript typecheck remains unavailable because `tsc` is not installed; no dependency installation was attempted.
