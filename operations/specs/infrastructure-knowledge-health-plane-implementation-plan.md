# Infrastructure Knowledge & Health Plane — Implementation Plan

**Namespace:** IKHP
**Status:** IKHP0 complete; IKHP1-IKHP6 not authorized
**Owner:** Brain
**Primary entry point:** Brain Core / Context Broker
**Primary human UI:** Obsidian Brain Console

## Principles

1. One logical infrastructure plane; multiple stores by authority/lifecycle.
2. No raw secrets in Git, LLM context, MCP responses, logs, or portal payloads.
3. Reuse New Relic and existing provider adapters; do not build a competing telemetry platform.
4. Read-only first; measured reliability before any remediation.
5. Exact resource IDs, relations, freshness, provenance, and safety class everywhere.
6. Existing architecture/migration docs remain human evidence, not the only machine authority.
7. No second decision queue; human choices route through CLR3 Decision Core.
8. No automatic high-risk infrastructure mutation.

## IKHP0 — Architecture/inventory admission

**Status:** complete 2026-08-16.

Evidence:

- `operations/specs/infrastructure-knowledge-health-plane-architecture.md`
- `operations/specs/infrastructure-knowledge-health-plane-roadmap.md`
- `operations/reports/infrastructure-knowledge-health-plane-analysis-2026-08-16.md`

Inventory findings:

- strong prose/evidence architecture already exists;
- credential metadata index and auto-discovery exist;
- Brain Core already exposes read-only Dokploy/scheduler/tunnel/domain/New Relic surfaces;
- Brain Console already visualizes New Relic hosts/synthetics;
- backup/scheduler/recovery knowledge exists but is not normalized into one health model;
- current gaps are machine-readable topology, unified freshness, credential health/expiry, backup restore-health, incident normalization, and guarded action contracts.

## IKHP1 — Canonical catalog contracts and migration

### IKHP1.1 — Catalog schema bundle

Create:

```text
operations/infrastructure/catalog/manifest.v1.json
operations/infrastructure/catalog/assets.v1.json
operations/infrastructure/catalog/relations.v1.json
operations/infrastructure/catalog/service-bindings.v1.json
operations/infrastructure/catalog/credential-references.v1.json
operations/infrastructure/catalog/backup-policies.v1.json
operations/infrastructure/catalog/health-policies.v1.json
operations/infrastructure/catalog/safety-policies.v1.json
operations/specs/infrastructure-catalog-v1.schema.json
```

Required resource classes:

```text
host
application
service
database
storage
backup_system
backup_job
network
tunnel
domain
dns_record
provider_account
credential_reference
scheduler
monitor
control_plane
```

Required relation classes:

```text
runs_on
depends_on
connects_to
routes_to
monitored_by
backed_up_by
authenticates_with
configured_by
owned_by
replaced_by
fails_over_to
```

### IKHP1.2 — Stable identifiers and provenance

Every resource/fact must include stable ID plus:

```text
sourceRef
sourceClassification
observedAt / verifiedAt
freshnessDeadline
owner
lifecycleState
```

Use current evidence classifications where possible:

```text
OBSERVED-VERIFIED
DERIVED-VERIFIED
AUTHORITATIVE-CONFIG
USER-PROPOSED
UNKNOWN
```

### IKHP1.3 — Reconcile existing sources

Map—not copy blindly—from:

- `operations/infrastructure/infra.md`;
- `operations/architecture/**`;
- `operations/accounts/credentials-index.md`;
- `operations/infrastructure/local-apps.json`;
- `operations/infrastructure/scheduler-inventory.md`;
- `operations/specs/infinite-brain-recovery-inventory.json`;
- CLR4 deployment profiles;
- Cloudflare tunnel/domain adapters;
- Dokploy adapter;
- New Relic adapter;
- existing backup/recovery runbooks.

Conflict rule: report duplicate/conflicting facts; never silently choose based on file order.

### IKHP1.4 — Credential metadata migration

Do not move secret values.

Convert credential metadata into machine-readable references while preserving the Markdown index as a human view until migration is stable.

Upgrade `sync-credentials` later to:

- discover candidate secret files/variable names;
- update metadata candidates;
- never read/persist values beyond what is necessary to detect key names;
- validate expiry/rotation metadata coverage;
- keep manual review for ambiguous/provider-specific credentials.

### IKHP1.5 — Alternate fixture

Add one non-Steve fixture proving generic resource/relation/credential-reference contracts.

### IKHP1 validation

- JSON Schema validation;
- duplicate ID tests;
- relation target integrity;
- provenance/freshness required;
- no raw credential value patterns;
- Steve-specific constants absent from public schemas;
- alternate fixture portability;
- migration coverage report for existing infrastructure sources.

## IKHP2 — Live health/provider adapters

### IKHP2.1 — Normalized health observation contract

Create versioned observation model:

```text
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

Runtime target:

```text
runtime/local/infrastructure/health-state.json
runtime/local/infrastructure/provider-observations.jsonl
```

Bound retention/compaction; no Git runtime state.

### IKHP2.2 — New Relic normalization

Extend existing read-only New Relic adapter to map telemetry to catalog resource IDs.

Initial coverage:

- host reporting;
- CPU/memory/storage;
- disk capacity;
- process/service health;
- synthetics;
- APM entity status;
- alert/issue summaries;
- last seen/freshness.

Do not create duplicate time-series storage in Brain.

### IKHP2.3 — Cloudflare normalization

Extend existing tunnel/domain adapters for:

- tunnel status;
- connector count/state;
- expected connector policy;
- hostname/origin relation health;
- read-only metrics where available;
- DNS/domain drift.

### IKHP2.4 — Tailscale normalization

Add read-only provider adapter for:

- expected device inventory;
- last seen/online state;
- route/subnet-router state;
- direct/relay connectivity when available;
- optional client metrics;
- SSH reachability probe result only, never keys.

### IKHP2.5 — Dokploy/server/app normalization

Normalize existing Dokploy/app/service status and safe server-local probes.

Do not use arbitrary shell; define named read-only probes.

### IKHP2.6 — Backup normalization

Normalize:

```text
lastAttempt
lastSuccess
lastFailure
age
retentionPolicy
expectedCadence
storageDestinationRef
restoreLastVerified
restoreVerificationAge
recoveryClass
```

Treat restore verification separately from backup creation success.

### IKHP2.7 — Credential/OAuth health adapters

Provider-specific read-only verification adapters expose only:

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

No raw tokens in output.

### IKHP2 validation

- provider disabled/unavailable fallback;
- unknown/stale propagation;
- resource mapping integrity;
- no secret leakage;
- deterministic fixture tests;
- no provider writes/network mutation.

## IKHP3 — Incidents and attention

### IKHP3.1 — Incident contract

Versioned incident object:

```text
incidentId
resourceId
conditionCode
severity
openedAt
lastObservedAt
status
providerRefs
fingerprint
freshness
recoveryEvidence
```

### IKHP3.2 — Condition rules

Implement normalized deterministic rules for:

- host not reporting;
- disk warning/critical;
- service unhealthy;
- tunnel missing/conflict;
- SSH probe failed;
- backup failed/stale;
- restore verification overdue;
- credential expiring/disconnected;
- certificate expiring;
- provider observation stale.

### IKHP3.3 — Dedupe/recovery

Fingerprint incidents by resource + condition + policy version.

Support:

- open;
- continuing;
- recovered;
- acknowledged;
- suppressed-by-policy.

### IKHP3.4 — Notification integration

Reuse CLR3 attention philosophy and Obsidian notification channel.

Only create Decision Core items when a real human choice is required.

### IKHP3 validation

- repeated observation dedupe;
- recovery transitions;
- stale provider behavior;
- alert-noise ceilings;
- notification sensitive-payload exclusion;
- no second decision store.

## IKHP4 — Safety and action contracts

### IKHP4.1 — Protected resource policy

Version resource risk classes and mutation classes.

Minimum classes:

```text
read_only
low_risk_reversible
availability_impacting
auth_sensitive
data_sensitive
destructive
```

### IKHP4.2 — Typed action plan

Every future mutation request must identify:

```text
actionId
resourceId
operation
expectedRevision
expectedHealth
relationSnapshotRef
blastRadius
backupEvidenceRef
dryRunEvidenceRef
validationPlan
approvalClass
rollbackPlan
postCheckPlan
```

### IKHP4.3 — Config mutation safety

For config-like resources require:

- exact source path/provider object;
- current hash/revision;
- backup or provider rollback evidence;
- syntax/schema/provider validation;
- staged/atomic replacement where possible;
- explicit path-scoped diff;
- post-change readback/hash;
- health verification;
- rollback receipt.

Never use broad search/replace across infrastructure config.

### IKHP4.4 — Delete/decommission safety

Require:

- zero active dependency edges or explicit migration plan;
- replacement/supersession evidence where relevant;
- backup/recovery proof;
- stale/usage observation window appropriate to resource class;
- explicit owner approval;
- rollback/restore plan.

### IKHP4 validation

- missing evidence fails closed;
- stale expected revision fails closed;
- dependency graph blocks unsafe delete;
- no arbitrary shell execution;
- no credential-value exposure;
- every successful plan produces receipt + post-check requirements.

## IKHP5 — Unified consumer surfaces

### IKHP5.1 — Brain Core API

Implement the planned `/infra/*` unified endpoints from the architecture spec.

Existing `/infra/dokploy`, `/infra/tunnels`, `/infra/domains`, `/infra/scheduler`, and `/infra/monitoring` become provider-backed compatibility views over the same catalog/health model where practical.

### IKHP5.2 — Context Broker

Add source-neutral infrastructure context provider:

- descriptor-first retrieval;
- exact resource/relationship/health expansion;
- citations/freshness;
- no raw secrets;
- bounded token budget.

### IKHP5.3 — CLI/MCP

Add `prochat infra ...` commands and source-neutral MCP capability descriptors using the same Brain Core contracts.

### IKHP5.4 — Obsidian Brain Console

Add infrastructure views to the existing primary cockpit, not a second portal.

Required visual sections:

- architecture/topology;
- resource health;
- incidents;
- backups/restore state;
- credential/OAuth status and expiry;
- freshness/provenance;
- safe action/Decision Core links where separately authorized.

### IKHP5 validation

- same IDs/state across API/CLI/MCP/portal;
- no duplicated truth;
- bounded context loading;
- no secret exposure;
- offline/stale provider states visible.

## IKHP6 — Preventive automation

Only authorize after measured IKHP2-IKHP5 reliability.

### Candidate low-risk automation

Examples only; require explicit policy admission:

- refresh a failed read-only provider observation;
- re-run a backup verification probe;
- re-run a healthcheck;
- regenerate a report/index from canonical state.

### High-risk actions remain approval-gated

Never automatically:

- change DNS/tunnel routing;
- modify firewall/Tailscale ACL;
- rotate/revoke credentials;
- restore/overwrite production data;
- delete servers/backups/resources;
- mutate production DB schemas/data;
- rewrite SSH/systemd critical config;
- disable monitoring/backup policy.

## Cross-program gate before CLR5

Before CLR5 conversation evidence ingestion begins:

1. CLR5 event classification must recognize infrastructure evidence as non-canonical evidence only.
2. Infrastructure candidates must target IKHP catalog/incident/credential-reference contracts rather than arbitrary Markdown updates.
3. Raw secret values remain prohibited from conversation evidence persistence.
4. Infrastructure health/provider observations remain IKHP runtime state, not conversation memory.
5. CLR5 must not create a parallel server/network/credential/backup truth store.

This gate is architectural now; IKHP1 implementation still requires separate owner authorization.
