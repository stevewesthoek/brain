# Infrastructure Knowledge & Health Plane — Repository Analysis

**Date:** 2026-08-16
**Scope:** analysis/roadmap admission only; no monitoring/provider/action implementation
**Owner:** Brain

## Executive conclusion

Brain already contains most of the necessary infrastructure knowledge and several working live-provider surfaces. The problem is **not absence of information**. The problem is that static topology, evidence, credentials metadata, live health, backup state, and safety rules are represented in different formats and locations without one machine-readable authority model or one unified freshness/relationship layer.

The correct solution is therefore **consolidation by contract**, not migration into one giant file and not replacement of New Relic.

Recommended architecture:

```text
one logical Infrastructure Knowledge & Health Plane
        ↓
Brain Core / Context Broker / CLI / MCP / Obsidian
        ↓
multiple stores by authority:
- Git catalog (static non-secret truth)
- architecture/evidence docs (human provenance)
- external/local secret store (actual secret values)
- runtime/local health/incident state (derived, bounded)
- Decision Core only when human choice is required
```

## Existing implementation inventory

### 1. Central infrastructure reference already exists

`operations/infrastructure/infra.md` explicitly calls itself the central infrastructure document and already covers cloud accounts, servers, access paths, hosted platforms, local apps, recovery references, and related control-plane inventories.

Gap:

- verification date predates the current AWS migration architecture;
- prose is not enough for reliable programmatic relation/blast-radius queries;
- no unified health/freshness state.

Recommendation:

Keep it as a human reference, but make it a view/entry page over a machine-readable catalog rather than the only canonical model.

### 2. Current architecture/evidence layer is strong

`operations/architecture/prochat-infrastructure-architecture.md` contains current server/network/application/database/backup/observability/safety design and migration constraints.

`operations/architecture/prochat-infrastructure-evidence-register.md` already introduces a useful provenance model:

```text
OBSERVED-VERIFIED
DERIVED-VERIFIED
AUTHORITATIVE-CONFIG
USER-PROPOSED
UNKNOWN
```

It also records observed server/Tailscale/tunnel/application facts with timestamps.

Gap:

- machine consumers cannot efficiently query relations/dependencies without parsing prose;
- evidence freshness is not normalized by resource/policy;
- these files are migration-owned and actively changing, so they should not be refactored during the migration.

Recommendation:

Preserve them. IKHP1 should map them into stable resource IDs and provenance-backed catalog facts after appropriate migration boundaries.

### 3. Credential metadata architecture already follows the right security principle

`operations/accounts/credentials-index.md` is a central metadata-only map. It deliberately stores variable names, locations, purpose, rotation notes, and regeneration guidance but no secret values.

`operations/standards/api-standards.md` establishes that actual credentials stay under local `~/.config/<service>/` or equivalent external stores, with restrictive file permissions.

`tools/scripts/sync-credentials.sh` automatically discovers `.env` variable names and appends untracked metadata candidates.

Gap:

- `credentials-index.md` is Markdown-only and manually stale (`Last synced` is older than current architecture state);
- JSON credentials are not auto-detected;
- expiry, OAuth connectedness, last verification, rotation due, and provider-health states are not normalized;
- some app-specific credential stores/flows exist separately in Brain Core.

Recommendation:

Do not move raw secrets into Git. Create a machine-readable credential-reference catalog with opaque references, expiry/rotation/connectedness metadata, and provider-specific verification adapters. Keep the Markdown index as a human view during transition.

### 4. New Relic integration already exists and should be expanded, not replaced

Brain Core already exposes read-only `/infra/monitoring` and queries New Relic through NerdGraph/NRQL for infrastructure hosts and synthetic monitor state. Brain Console already renders this data.

The decision log records a wider New Relic strategy including Linux infrastructure agents, Node APM, Docker log forwarding, PostgreSQL monitoring, and synthetic URL checks.

Gap:

- current Brain Core adapter exposes only a narrow host/synthetic summary;
- no canonical resource-ID mapping;
- disk/process/service/alert state is not normalized into one infrastructure incident model;
- New Relic state is not correlated with Cloudflare/Tailscale/Dokploy/backup/credential state.

Recommendation:

Use New Relic as the primary telemetry/alert provider. Brain should normalize and correlate its signals with topology and safety policy rather than copying all time-series telemetry locally.

### 5. Cloudflare tunnel/domain adapters already exist

Brain Core already has `/infra/tunnels` and `/infra/domains` read-only provider adapters using external credential files. The current architecture contains detailed Cloudflare tunnel/write-isolation rules.

Gap:

- tunnel health is not linked to canonical server/app/resource IDs;
- connector count/conflict state is not an infrastructure incident policy;
- tunnel metrics/connector freshness are not part of one health model.

Recommendation:

Extend existing adapters in IKHP2 rather than creating a new Cloudflare subsystem.

### 6. Tailscale/network facts are well documented but not a provider-backed Brain health model

The architecture/evidence register contains live-observed Tailscale addresses, device state, direct connectivity, and subnet routing.

Gap:

- no one Brain Core topology/health provider exposes expected-device vs observed-device state, last seen, route health, and SSH-access health with catalog mapping.

Recommendation:

Add a read-only Tailscale provider adapter and normalize its observations to resource IDs.

### 7. Scheduler and backup state already has useful health semantics

`operations/infrastructure/scheduler-inventory.md` is a central scheduler inventory.

Brain Core `/infra/scheduler` already exposes job state including success, failed, timeout, never-run, running, last run, next run, error message, and failure counts. It already includes the n8n backup job.

The current architecture also documents instance snapshots, logical DB dumps, planned S3/off-instance backups, retention, and restore verification.

Gap:

- backup health is not a first-class normalized resource;
- backup success is not distinguished consistently from restore-verification confidence;
- backup age/retention/restore overdue state is not unified across backup mechanisms.

Recommendation:

Model backup jobs, destinations, policies, and restore verification separately. A backup is not fully healthy merely because a backup job exited zero.

### 8. Brain Core already has multiple infrastructure surfaces

Existing read-only examples include:

```text
/infra/dokploy
/infra/scheduler
/infra/tunnels
/infra/domains
/infra/monitoring
```

This is a strong foundation.

Gap:

- these are provider-shaped endpoints rather than one resource/relationship/health model;
- no generic `/infra/resources/:id`, topology, incidents, backup, credential-health, or doctor interface exists;
- consumers need provider-specific knowledge.

Recommendation:

IKHP5 should preserve compatibility endpoints but make them views over the unified catalog/health plane where practical.

## Current architecture strengths to preserve

The current AWS migration architecture already contains excellent safety principles that should become general Brain infrastructure policy:

- authoritative source of truth must be explicit;
- production-write boundaries are more important than public ingress alone;
- backup/rollback classes depend on whether authoritative writes occurred;
- migration actions are validated and staged;
- ambiguous/legacy resources are not deleted without investigation;
- production tunnel concurrency has strict safety consequences;
- backup hardening and restore verification are separately planned;
- destructive post-cutover hygiene is deferred until stability and owner approval.

IKHP4 should generalize these patterns without weakening them.

## External capability research conclusion

Primary-source vendor documentation confirms the proposed provider strategy is realistic:

- New Relic supports infrastructure host-not-reporting, process and storage/metric alerting, NerdGraph/NRQL queries, notification workflows/destinations, and synthetic monitoring;
- Cloudflare Tunnel exposes connector/tunnel monitoring and Prometheus-format metrics from `cloudflared`;
- Tailscale provides an API plus client metrics for device/connectivity automation/monitoring;
- secret-reference systems such as 1Password can provide opaque references and runtime injection without putting plaintext secrets in source control.

The last item should remain an **optional secret-store adapter**, not a new mandatory dependency: Brain's existing `~/.config` convention remains valid until the owner chooses a different secret backend.

## Why not one giant file

A single file containing servers, IPs, credentials metadata, live health, backup state, alerts, and action history would mix incompatible authority/lifecycle classes:

- static topology changes relatively slowly and belongs in Git;
- actual secrets must not enter Git;
- live health changes every seconds/minutes and belongs in derived runtime state;
- evidence/provenance deserves append/review semantics;
- action/decision history belongs in audit/Decision Core;
- telemetry time series belongs in New Relic or provider systems.

The correct definition of "central" is therefore:

> **one discoverable logical interface with stable IDs and relations, not one physical storage file.**

## Recommended single entry point

For humans:

- Obsidian Brain Console infrastructure view.

For Brain Core/API:

- `/infra/catalog`, `/infra/topology`, `/infra/health`, `/infra/incidents`, `/infra/backups`, `/infra/credentials/status`, `/infra/resources/:id`, `/infra/doctor`.

For CLI/MCP/LLM:

- `prochat infra ...` plus Context Broker infrastructure provider.

The same IDs, freshness, health, and safety policies must power all three.

## Recommended implementation order

1. **IKHP1 catalog/relations/credential-reference contracts.**
2. **IKHP2 read-only health adapters and normalized observations.**
3. **IKHP3 incident/freshness/notification model.**
4. **IKHP4 guarded action/safety contracts.**
5. **IKHP5 unified API/CLI/MCP/Obsidian surfaces.**
6. **IKHP6 measured preventive automation only after evidence.**

This order intentionally delays mutation/auto-remediation until Brain can reliably answer:

- what resource is this?;
- what depends on it?;
- what is its current health?;
- how fresh is that information?;
- what backup/recovery evidence exists?;
- what safety class applies?;
- what is the exact rollback path?

## Relation to Infinite Brain

This is not a separate philosophy. It is the infrastructure specialization of Infinite Brain:

- **Mind** owns human priorities, strategic preferences, acceptable cost/downtime/risk, and owner decisions.
- **Brain** owns infrastructure topology, machine capability, health, safety policy, provider adapters, runbooks, and execution contracts.
- **Context Broker** supplies bounded relevant infrastructure context to LLM/CLI/MCP consumers.
- **Decision Core** is used only for genuine human authority choices.
- **New Relic and other providers** supply evidence/telemetry, not canonical architecture meaning.

The result should make Brain hyper-aware without making every model prompt huge and without giving models unsafe direct access to credentials or infrastructure mutation.

## Roadmap decision

IKHP0 is complete as an analysis/architecture admission.

IKHP1-IKHP6 are **not authorized** by this analysis.

Before CLR5 is implemented, its conversation-evidence contracts must explicitly recognize IKHP ownership so infrastructure-related conversation evidence cannot become a parallel server/network/credential/backup truth store.
