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

## IKHP-IAP — Identity & Access contract foundation

**Status:** contract foundation, bounded verification, and synthetic-tested scheduled read-only health orchestration complete as repository-only work on 2026-09-05. No real provider, runtime, or credential state was changed.

### IKHP-IAP.1 — Provider-neutral entity contract

Define one versioned schema for account/identity, credential, session/connection, runtime profile, secret-store adapter, lifecycle policy, verification policy, expected principal, and read-only observation evidence. Keep account, credential, session, and runtime-profile identity distinct so one provider may have arbitrarily many accounts and one account may have multiple credentials or sessions.

### IKHP-IAP.2 — Secret-store boundary

Brain stores only opaque references and non-secret metadata. The `SecretStoreAdapter` contract is capability-based and product-neutral. It permits metadata inspection and tightly bound verifier invocation, but never returns a raw value to Brain and exposes no generic getter or mutation path. Application-managed OAuth/session material remains owned by its application unless an official, explicitly approved import/export contract exists.

The first/reference local adapter is the read-only macOS Keychain pilot. It
uses a fixed Security.framework `SecItemCopyMatching` query for generic
password attributes on its metadata/existence path; that path never requests
`kSecReturnData`. A separate bounded-verification boundary is the only admitted
data-use path, and it never returns a secret to Brain or exposes a generic
process-resolution method. The adapter is namespace-bound and provider-neutral.
Apple Passwords remains an operator UI, not an automation API.

Current backup/recovery evidence does not prove that the login Keychain,
item-level access controls, or application authorization state are portable.
Record Keychain recovery assurance as `unknown` until a later synthetic
restore exercise verifies those boundaries. Provider reauthentication or
credential reissue remains the break-glass path when portability is not proven.

### IKHP-IAP.2a — Bounded credential-verification boundary

`tools/infrastructure-identity-access/credential-verification-boundary.mjs`
defines the provider-neutral `verifyCredential` contract. It accepts only an
opaque reference, expected principal, read-only verification policy, provider
adapter, and Keychain adapter. The Keychain adapter passes the registered
verifier command to the native boundary without receiving a secret.

`macos-keychain-verification-boundary.swift` performs the only Keychain data
request in this tranche. It writes the returned bytes directly to the
registered verifier's stdin pipe, captures only bounded verifier output, and
emits a fixed allowlisted result. It never emits the secret, captures verifier
stderr, forwards arbitrary JSON, or exposes a generic `getSecret` operation.
The provider-neutral normalizer converts that result into the canonical IKHP
observation and performs expected-principal, scope, expiry, refreshability, and
failure-state normalization.

The synthetic verifier is deterministic and local. Its Keychain fixture is
strictly namespaced, receives its synthetic canary through stdin, and is
deleted in a `finally` cleanup path. The end-to-end test proves healthy,
wrong-account, provider-unavailable, provider-output-leak rejection,
provider-rejected, and credential-missing outcomes without live provider
traffic.

### IKHP-IAP.3 — Read-only health and principal verification

Reuse IKHP's normalized `healthy|degraded|unhealthy|unknown` status and add detailed identity/access states. A future provider verifier must prove, where supported, reference availability, authentication acceptance, observed principal, expected-principal match, scope/capability match, minimal safe capability, and freshness. `wrong_account` blocks account-sensitive use even if authentication succeeds.

Identity/access conditions project into existing IKHP incidents and attention; they do not create a second decision database. The scheduled implementation now applies freshness deadlines, missed-interval accounting, bounded exponential backoff, incident dedupe/recovery, and safe CLR3 notifications. Its scheduler entry remains report-only, opt-in, and externally unverified; no real credential is read by repository tests.

### IKHP-IAP.4 — Codex vertical-slice design

Codex is represented only as an adapter use case:

- one Brain account record per intended OpenAI identity;
- separate session records for Codex authentication and MCP authorization;
- one runtime-profile record per isolated application/runtime context;
- expected-principal verification before account-sensitive use;
- profile-aware process ownership and deterministic recovery metadata.

An adapter may use isolated `CODEX_HOME` directories, but `CODEX_HOME` is not the canonical model. The existing stop-and-repair scripts remain tactical recovery tooling and are not changed into an account manager.

### IKHP-IAP.4a — Semantic configuration ownership and atomic mutation

Before live profile onboarding, runtime configuration writes pass the shared
semantic ownership planner at `tools/lib/configuration-ownership.mjs`. The
planner is resource-scoped even when multiple resources share one file. It
fails closed for unknown ownership, ownership transfer, inconsistent
application journals, and optimistic-revision drift. Executable Brain-owned
writes are validated, owner-only, atomic, and post-verified; the profile
materializer records an opaque config revision in its ownership sidecar and
never handles application auth or runtime state.

The legacy/default Codex root is an observe-only shared surface for normal
Brain operations. Generic managed-root repair/migration is refused there and
when the WebGPT integration journal exists. WebGPT-owned route, journal,
browser, bridge, tunnel, launcher, and hook/application state remain under the
WebGPT adapter/application boundary. This safety tranche proves preservation
and refusal behavior with synthetic WebGPT-shaped fixtures; it does not
authorize OAuth migration, account login, credential mutation, or state-
database repair.

### IKHP-IAP validation and stop condition

Validate the schema, canonical empty catalog, source-neutral alternate fixture,
wrong-account observation, raw-secret rejection, mutation/keepalive invariants,
the macOS Keychain adapter pilot, the bounded synthetic end-to-end verification
boundary, the GitHub local HTTP verifier matrix, and the native interactive
enrollment/overwrite test. Stop after this read-only proof. Do not migrate
credentials, alter OAuth state, automate browser login, read raw Keychain
values outside the authorized verifier boundary, or enable renewal/rotation.

### IKHP-IAP first provider implementation (live use not performed)

GitHub is the recommended first real provider. Its REST API supplies a small
read-only `GET /user` identity probe with documented `200`, `401`, and `403`
outcomes. OAuth app responses also expose `X-OAuth-Scopes` and
`X-Accepted-OAuth-Scopes`, which gives the provider adapter concrete scope
evidence. The pilot should use separate opaque references for separate GitHub
accounts, compare stable user ID/login metadata to the expected principal,
capture only safe response metadata, and issue no write requests. The
repository now contains the fixed-origin verifier, provider adapter, safe
verification CLI, and human-gated fixed-namespace Keychain enrollment tool.
The synthetic HTTP/PTY/Keychain tests do not contact GitHub or use a real
credential. A live enrollment and verification remains a separately approved
operator action, not an automatic consequence of this implementation.

### IKHP-IAP staged follow-on sequence

These are future admission gates or human-run steps, not automatic live
execution authorized by this tranche:

1. **Reviewed metadata enrollment:** derive candidate account/credential/session/profile records from operator input without reading or moving secret values; require human review for ownership and stable numeric expected principals.
2. **First live GitHub run:** use the native enrollment tool directly in a trusted TTY, then run the verification CLI with the reviewed numeric principal. Record only the redacted observation; do not import Codex/MCP OAuth.
3. **Health and incident integration:** **IMPLEMENTED as synthetic-tested repository proof.** `credential-health-orchestrator.mjs` schedules provider-specific read-only checks with freshness, rate-limit-aware bounded backoff, missed-run accounting, dedupe, recovery transitions, and existing IKHP attention/notification semantics. Treat vault unavailability and wrong-account evidence as blocking conditions.
4. **Guided recovery:** generate exact account-aware reauthentication or provider-console instructions. Require human action for browser login, application-managed OAuth recovery, API-key replacement, permission changes, and any secret-store mutation.
5. **Approved automation:** consider only provider-authorized refresh or renewal flows whose policy, blast radius, rollback, post-check, and audit receipt are proven. Never add synthetic keepalive traffic or a generic credential janitor.

The Codex vertical slice belongs in steps 2–4 as a runtime/provider adapter exercise. It must prove isolated profiles and expected-principal matching before any account-sensitive action, while keeping application-owned OAuth/session state inside the owning application.

## IKHP-RGO — Runtime ownership, onboarding, and lifecycle governance

**Status:** implemented and synthetic-tested as a provider-neutral extension of
the existing IKHP catalog on 2026-09-05. No live consumer, Codex Web GPT
session, tunnel, connector, credential, or scheduler state was changed.

### IKHP-RGO.1 — Extend the existing catalog, do not create a second plane

Add optional governance metadata to the IKHP catalog resource, relation, and
service-binding contracts. Keep provider-specific mechanics behind adapters.
The metadata distinguishes resource/application/runtime identity, account,
credential, session, runtime profile, configuration custody, route ownership,
dependency, environment, and isolation. One mutable resource has one
authoritative owner; observers, verifiers, drift detectors, and mutation actors
are separate references. Application-managed sessions and provider-managed
credentials remain outside Brain custody.

### IKHP-RGO.2 — Contract-driven admission

Use the common path:

```text
discover → candidate → classify → validate → resolve ambiguity → admit → participate
```

Automatic discovery may create only a candidate and evidence. Admission
requires resolved ownership, environment/isolation, health and recovery
coverage, lifecycle policy, and safe dependency references. The pure admission
planner emits a proposed transition and never changes catalog state. Unknown,
conflicted, duplicate-owner, unowned-route, or competing-writer states are
reported explicitly.

### IKHP-RGO.3 — Lifecycle and isolation gate

Required dependencies, disruption risk, maintenance mode, active workload/lease
policy, and quiescence are modeled in the same contract. The guarded action
preflight consumes optional workload evidence: active work blocks a mutation;
missing or unobservable evidence is unknown and blocks a governed mutation.
Brain observes and coordinates; it does not add a competing keepalive or
availability supervisor. Production and development require distinct explicit
environment/isolation references unless a shared boundary is explicitly
approved.

### IKHP-RGO.4 — Codex Web GPT metadata adapter proof

`infrastructure-codex-web-gpt-metadata-v1.json` is a non-secret metadata
fixture, not a live adapter. It maps the production launcher, development
runtime, application-owned browser session, connector, loopback/API bridge,
route ownership, two opaque account references, `many` account capacity, and
unknown credential custody. Native Codex and Web GPT remain separate surfaces;
`CODEX_HOME`, browser profiles, ports, and connectors are adapter evidence,
not canonical Brain identity.

### IKHP-RGO validation and stop condition

Run `npm run validate:infrastructure-governance`,
`npm run test:infrastructure-governance`, `npm run test:infrastructure-actions`,
`npm run validate:infrastructure-actions`, and
`npm run test:infrastructure-catalog`. Stop at metadata and synthetic proof.
Do not enable the scheduler, log in/out, extract or copy OAuth/session state,
change live configuration, or add automatic provider refresh/keepalive.

## IKHP-OBS — Generic observation and admission implementation

**Status:** implemented and synthetic-tested on 2026-09-05; live observation
is report-only and no live configuration, process, credential, or connector
state was changed.

### Contract and adapter boundary

Extend the existing observation schema with provider-neutral evidence for
observer identity, candidate identity, environment, runtime/process/endpoint,
ownership, route writers, dependencies, identity binding, health, lifecycle,
isolation, provenance, freshness, confidence, and redaction. Add a separate
candidate schema for admission plans and backlog items. Keep the existing
health observation runtime compatible; do not create a second observation
store.

Every adapter exposes exactly three semantic seams:

```text
discover() → observe(candidate) → verifyRelationship()
```

The local runtime adapter uses `ps` executable identity and `lsof` listener
metadata only. Product adapters call supported read-only status/doctor
interfaces and return allowlisted metadata. Raw auth files, OAuth, cookies,
API keys, process arguments, environment variables, browser storage, and
Keychain data are outside the boundary.

### Candidate and admission behavior

Discovery emits evidence and candidates, never canonical writes. The pure
admission planner requires fresh evidence, stable/profile-scoped identity,
resolved ownership/custody, environment/isolation, dependencies,
health/recovery, lifecycle/quiescence, and route ownership. Unknown evidence
remains a candidate; conflict is rejected. Plans are schema-validated and
always report `executionEnabled=false`, `executionPerformed=false`, empty
actual effects, and no secrets.

### Proof and live evidence

`infrastructure-runtime-observation-synthetic-v1.json` proves two unrelated
consumer models plus unknown and conflict paths. The Codex adapter proves
native application metadata, WebGPT production, bridge, tunnel, and DEV
observations while retaining account identity and connector attachment as
unknown where local evidence cannot prove them. `tools/observe-infrastructure.mjs`
produces the report-only live projection; the 46-resource canonical backlog is
explicit and bounded.

### Verification gate

Run:

```text
npm run validate:infrastructure-observation-admission
npm run test:infrastructure-observation-admission
node tools/observe-infrastructure.mjs
```

The live command must remain observational. Do not start/stop runtimes, log
in/out, repair Codex configuration, attach connectors, import OAuth, move
secrets, enable scheduling, or add generic keepalive behavior. The next
implementation task is a human-gated account/session/runtime-profile binding
model with provider-supported account attribution and per-account health evidence.
The capability-proof implementation is documented in
`operations/specs/infrastructure-codex-account-profile-capability.md`; a real
profile manager remains gated because keyring isolation, authenticated-profile
concurrency, and Desktop isolation are not proven.

## Cross-program gate before CLR5

Before CLR5 conversation evidence ingestion begins:

1. CLR5 event classification must recognize infrastructure evidence as non-canonical evidence only.
2. Infrastructure candidates must target IKHP catalog/incident/credential-reference contracts rather than arbitrary Markdown updates.
3. Raw secret values remain prohibited from conversation evidence persistence.
4. Infrastructure health/provider observations remain IKHP runtime state, not conversation memory.
5. CLR5 must not create a parallel server/network/credential/backup truth store.

IKHP1 provides the canonical catalog/relationship foundation for this gate, and IKHP2 live health/provider normalization is complete and accepted with evidence recorded in `operations/reports/ikhp2-live-health-normalization-acceptance-2026-08-16.md`. CLR5 remains not authorized.
