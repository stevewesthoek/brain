# Infrastructure Knowledge & Health Plane — Implementation Plan

**Namespace:** IKHP
**Status:** IKHP0-IKHP5 complete; IKHP6 Packet 1 accepted; later automation/remediation not authorized
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

**Status:** owner-authorized and complete 2026-08-16 as a repository implementation.
**Acceptance:** `operations/reports/ikhp1-infrastructure-catalog-acceptance-2026-08-16.md`
**Mapping evidence:** `operations/reports/ikhp1-infrastructure-source-mapping-2026-08-16.md`
**Boundary:** no live provider polling, credential verification, infrastructure mutation, CLR5 implementation, or IKHP2 activation.

### IKHP1.1 — Catalog schema bundle

Create:

```text
operations/infrastructure/catalog/manifest.v1.json
operations/infrastructure/catalog/assets.v1.json
operations/infrastructure/catalog/relations.v1.json
operations/infrastructure/catalog/service-bindings.v1.json
operations/infrastructure/catalog/access-references.v1.json
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

- **PASS:** JSON Schema/catalog validation through `npm run validate:infrastructure-catalog`.
- **PASS:** duplicate resource IDs and competing canonical owners fail closed.
- **PASS:** unresolved relation targets and contradictory duplicate topology facts fail closed.
- **PASS:** provenance and freshness chronology are required; stale provenance is surfaced as warnings rather than silently refreshed.
- **PASS:** raw access-bearing fields and unsafe inline secret-store references are rejected; exact IKHP1 paths also require repository `forbidden_secret_material` scan before commit.
- **PASS:** public schema and alternate fixture are source/vendor/UI neutral and cover all 16 resource classes plus all 11 relation classes.
- **PASS:** alternate fixture portability validated.
- **PASS:** source mapping report covers all 11 required existing infrastructure source families.
- **PASS:** focused integrity/conflict suite `npm run test:infrastructure-catalog` passes 8/8.
- **STOP:** IKHP2 remains not authorized; live health/provider normalization is not part of IKHP1 acceptance.

## IKHP2 — Live health/provider adapters

**Status:** owner-authorized and complete 2026-08-17 as a repository implementation.
**Acceptance:** `operations/reports/ikhp2-live-health-normalization-acceptance-2026-08-16.md`
**Boundary:** no continuous scheduler, incident/notification engine, automatic remediation, provider mutation, credential rotation, backup mutation, CLR5 implementation, or IKHP3 activation.

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
```

IKHP2 intentionally uses one bounded atomic snapshot rather than duplicating provider time-series/event history locally. Retention is count- and age-bounded; no Git runtime state is written.

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

- **PASS:** deterministic validator maps all 16 configured provider bindings to 16 normalized observations across 13 IKHP1 resources.
- **PASS:** provider unavailable/error fallback produces `unknown`/`stale`, never false healthy.
- **PASS:** exact freshness boundaries are tested; stale healthy observations are downgraded.
- **PASS:** IKHP1 resource-target integrity is enforced for every provider binding and observation.
- **PASS:** access/OAuth normalization exposes metadata only; raw credential values are absent.
- **PASS:** New Relic host metrics, disk, process/APM/synthetic/alert summaries; Cloudflare tunnel/domain/DNS; Tailscale; Dokploy; backup; and access-health fixtures are deterministic.
- **PASS:** Cloudflare DNS drift remains explicit `unknown` when canonical expected DNS content is unavailable rather than being treated as healthy.
- **PASS:** Tailscale uses named `status --json` execution with no shell; SSH evidence is bounded TCP/22 reachability only.
- **PASS:** runtime persistence is atomic, mode `0600`, count-bounded, age-bounded, and stored under `runtime/local/infrastructure/` only when explicitly invoked.
- **PASS:** focused runtime/provider suite `npm run test:infrastructure-health` passes 10/10.
- **PASS:** `npm run validate:infrastructure-health` passes.
- **LIMITATION:** Brain Core `npm run typecheck` cannot run in this checkout because `tsc` is not installed. No dependency installation was attempted.
- **STOP:** IKHP3 remains not authorized; incidents/notifications and remediation are not part of IKHP2 acceptance.

## IKHP3 — Incidents and attention

**Status:** owner-authorized and complete 2026-08-17 as a repository implementation.
**Acceptance:** `operations/reports/ikhp3-incidents-attention-acceptance-2026-08-17.md`
**Boundary:** IKHP3 provides deterministic derived incident/attention contracts and bounded local runtime state only. No continuous scheduling, live notification delivery, API/CLI/MCP/Obsidian incident surface, automatic Decision Core proposals, remediation, infrastructure mutation, CLR5 implementation, or IKHP4 activation is included.

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

**Status:** owner-authorized and complete 2026-08-19 as a repository implementation.
**Acceptance:** `operations/reports/ikhp4-safety-action-contracts-acceptance-2026-08-19.md`
**Boundary:** deterministic safety policy, typed action-plan validation, fail-closed preflight evaluation, and bounded non-secret receipt persistence only. No live/provider/infrastructure execution, remediation, IKHP5 activation, IKHP6 activation, or CLR5 implementation.

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

**Status:** owner-authorized and complete 2026-08-19 as a repository implementation.
**Acceptance:** `operations/reports/ikhp5-unified-consumer-surfaces-acceptance-2026-08-19.md`
**Boundary:** one canonical read-only infrastructure identity/state model across Brain Core API, Context Broker, CLI/MCP, and the existing Obsidian Brain Console. No live/provider/infrastructure execution, remediation, IKHP6 activation, or CLR5 implementation.

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

**Status:** Packet 1 complete and accepted 2026-08-22 as an admission-only repository implementation. Later automation execution and remediation remain not authorized.
**Acceptance:** `operations/reports/ikhp6-packet1-reconciliation-2026-08-22.md`
**Boundary:** versioned admission and measurement contracts, deterministic validators, and evidence-only fixtures. Preserve `executionEnabled=false`, `executionPerformed=false`, and `actualEffects=[]`. No provider/infrastructure execution, remediation, scheduling, credential mutation, or live action path is authorized.

### IKHP6 Packet 1 acceptance

Complete the admission-only foundation before any runtime automation packet:

- admission proposal schema and validator;
- measurement schema, complete metric fixtures, validator, and focused tests;
- IKHP4 action/receipt safety regression floor;
- IKHP5 unified-consumer regression floor;
- JSON, syntax, diff, and explicit non-execution validation.

Acceptance evidence is recorded in the reconciliation report above. This acceptance does not authorize the candidate automation examples below.

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

IKHP1 now provides the canonical catalog/relationship foundation for this gate. CLR5 remains not authorized, and IKHP2 live health/provider normalization still requires separate owner authorization.
