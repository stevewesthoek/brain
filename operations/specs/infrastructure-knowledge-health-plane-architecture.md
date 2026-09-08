# Infrastructure Knowledge & Health Plane — Architecture

**Status:** proposed architecture with repository-implemented read-only identity-health and runtime-governance projections; no credential mutation, runtime activation, or unreviewed live integration is authorized
**Owner:** Brain
**Relationship to CLR:** sibling Brain capability plane; CLR consumes its bounded context/health through Brain Core and Context Broker. CLR5 conversation ingestion remains separate.

## 1. Problem

Brain already contains strong infrastructure knowledge, but it is spread across several authority types:

- `operations/infrastructure/infra.md` — central prose infrastructure reference, last live verification older than the current migration state;
- `operations/architecture/prochat-infrastructure-architecture.md` — current detailed architecture/migration-state document;
- `operations/architecture/prochat-infrastructure-evidence-register.md` — evidence/provenance register for observed infrastructure facts;
- `operations/accounts/credentials-index.md` — central credential metadata map with no secret values;
- `operations/specs/infinite-brain-recovery-inventory.json` and backup/runbook documents — recovery/backup knowledge;
- Brain Core `/infra/*` endpoints — read-only runtime/provider projections for Dokploy, scheduler, Cloudflare tunnels/domains, New Relic monitoring, and other services;
- Brain Console monitoring UI — current read-only New Relic server/synthetic visibility;
- provider-specific runbooks/scripts — Cloudflare, Tailscale, backup, credentials, OAuth, app health, migrations, and local runtime control.

This is useful but not yet one fresh programmable infrastructure model. Human and LLM retrieval must currently know which document/provider to inspect, and freshness/health/expiry is inconsistent across sources.

## 2. Architectural decision

Do **not** collapse all infrastructure information into one giant file or one mutable database.

Create **one logical Infrastructure Knowledge & Health Plane (IKHP)** with one Brain Core/CLI/MCP entry point, backed by multiple stores according to authority and lifecycle.

```text
                         ┌────────────────────────────┐
                         │ Obsidian Brain Console     │
                         │ CLI / MCP / LLM consumers  │
                         └─────────────┬──────────────┘
                                       │
                              Brain Core / Context Broker
                                       │
                  ┌────────────────────┼────────────────────┐
                  │                    │                    │
         Canonical inventory     Live health state     Decision/safety
          (Git, non-secret)       (runtime/local)       (Brain policy)
                  │                    │                    │
        ┌─────────┼────────┐      ┌────┼────────────┐       │
        │         │        │      │    │            │       │
     assets   relations  refs   NewRelic Cloudflare Tailscale/Dokploy/backup probes
```

The single user/programmatic entry point is logical, not a single physical file.

## 3. Authority layers

### 3.1 Canonical static infrastructure inventory — Git, non-secret

Target namespace:

```text
operations/infrastructure/catalog/
```

Recommended machine-readable contracts:

```text
manifest.v1.json
assets.v1.json
relations.v1.json
service-bindings.v1.json
credential-references.v1.json
backup-policies.v1.json
health-policies.v1.json
safety-policies.v1.json
```

The top-level `manifest.v1.json` is the single discovery entry point for humans, Brain Core, MCP, CLI, and LLM context resolution.

Static inventory may describe:

- server/host identity, role, provider, region, environment, lifecycle state;
- public/private/Tailscale addresses where safe to store;
- SSH logical aliases and access-path references;
- Cloudflare tunnel/domain relationships;
- Dokploy/server/application relationships;
- databases, storage, backup classes, recovery dependencies;
- application-to-server, application-to-database, tunnel-to-origin, DNS-to-service relations;
- configuration ownership and canonical source references;
- provider account identifiers that are non-secret;
- credential **references and metadata only**, never credential values;
- expected health checks, SLO/threshold policy, freshness deadline, and owner;
- safety class and allowed mutation class per resource.

### 3.2 Human architecture/evidence documents — Git, explanatory

`operations/architecture/**` remains the human architecture/evidence layer, especially during migrations. It should not become the only machine authority.

Architecture documents may be generated from, linked to, or reconciled with the catalog, but current migration-owned architecture files remain independently editable until the migration closes.

### 3.3 Secret material — external/application-local store only

Actual API keys, OAuth refresh/access tokens, private keys, passwords, tunnel tokens, and other secret values remain outside Git.

Brain stores only an opaque credential reference plus metadata such as:

```text
credentialRefId
provider
purpose
owner
secretStoreAdapter
secretStoreRef
scopes
expiresAt / expiryUnknown
rotateBeforeDays
lastVerifiedAt
verificationAdapter
connectedState
rotationPolicyRef
regenerationRunbookRef
```

LLM/MCP/portal responses expose only redacted metadata/health, never raw secret values or filesystem contents.

The current `operations/accounts/credentials-index.md` remains the human-readable credential index during migration to a machine-readable credential-reference catalog. `sync-credentials` must eventually update/validate the machine-readable metadata model rather than appending only Markdown rows.

Migration is deliberately staged: first inventory metadata and ownership without reading values; then human-review candidate account/credential records; then enroll only approved opaque references; then add read-only provider/runtime verification; then project incidents and guided recovery; and only after measured reliability consider narrowly scoped, approval-gated lifecycle automation. The Markdown index, project `.env` files, OS stores, and application-managed state remain compatibility sources during the transition and are not silently rewritten.

### 3.3.1 Identity & Access extension

IKHP's credential-reference model is extended by a provider-neutral **Identity & Access** domain. The domain has one logical Brain view but does not require one physical secret store or one runtime implementation.

The canonical entities are deliberately separate:

```text
account / identity       who Brain expects to act as
credential               evidence used to authenticate or authorize that identity
session / connection     live or cached authorization state created by an application/provider
runtime profile          isolated execution/configuration context for an expected identity
secret reference          opaque pointer to secret material owned outside Brain Git
lifecycle policy          machine-readable rules for expiry, refresh, reauthentication, and rotation
```

Multiple accounts for the same provider are first-class. Account IDs are stable Brain identifiers and are not inferred solely from a display email. Verification must compare the provider-asserted principal with the account's expected principal and report `wrong_account` when they differ.

The contract foundation is defined in:

```text
operations/specs/infrastructure-identity-access-v1.schema.json
operations/infrastructure/catalog/identity-access.v1.json
```

The canonical enrollment catalog is intentionally empty in this tranche. Existing credentials are not imported, copied, inspected for values, or changed. The current credentials index and project-specific credential UI remain compatibility inputs until a later, explicitly approved metadata migration.

### 3.3.2 Replaceable secret-store and runtime adapters

Brain owns the metadata, policy, orchestration, health semantics, and incident projection. Adapters own product-specific mechanics:

- `SecretStoreAdapter` may describe references, expose metadata, and resolve a secret only into a tightly bound child process or application-owned channel. It must never return the value to Brain's normal model/context/incident surfaces.
- `ProviderAdapter` performs provider-specific read-only authentication, principal, scope/capability, and minimal safe capability checks.
- `RuntimeProfileAdapter` owns profile isolation, process ownership, launch mechanics, and application-managed session boundaries. A path such as `CODEX_HOME` may be an implementation detail of one adapter; it is not the canonical Brain abstraction.

The v1 contract exposes no autonomous secret-store mutation operation. The
first/reference local adapter is the read-only macOS Keychain adapter
documented in `operations/runbooks/infrastructure-identity-access-macos-keychain-pilot.md`.
It uses Keychain Services through a fixed Security.framework probe, accepts
only namespace-bound `keychain-ref://` references, and currently admits
metadata, reference-existence checks, and bounded consumption by an explicitly
registered verifier only. It never returns secret data to Brain, exposes no
generic secret getter, creates/updates/deletes items, or infers provider health.
The adapter is a replaceable implementation of this boundary, not a change to
the provider-neutral contract. Other stores remain replaceable future adapters;
no particular vault product is a Brain policy dependency.

OnePassword is therefore a possible future human-recovery-store adapter, not
the default vault, authority source, or automatic OAuth/session manager. Its
admission would require a separate adapter contract, least-privilege scope,
read-only health proof, recovery semantics, and explicit human authorization.

Apple Passwords remains an operator-facing application and is not treated as an
automation API. Application-managed OAuth/session state, including Codex and
MCP authorization state, remains owned by the application that created it.

### 3.3.3 Keychain recovery and portability boundary

The current recovery inventory and backup-policy catalog provide no explicit
evidence that the user's login Keychain, item access controls, or application
entitlements can be restored on another Mac. Keychain recovery is therefore
`unknown`, not assumed from repository or infrastructure backup success. Brain
stores the recovery assurance state and the evidence required to improve it;
the Keychain adapter does not export or back up secret values. A later recovery
exercise must use a namespaced synthetic item on a replacement profile/Mac,
verify item accessibility and application authorization, and separately record
which provider credentials require human reauthentication or reissue.

### 3.3.4 Bounded credential verification execution

The provider-neutral verification contract is implemented by
`tools/infrastructure-identity-access/credential-verification-boundary.mjs`:

```text
Brain orchestrator
    │ opaque reference + expected principal + read-only policy
    ▼
native Keychain verification boundary
    │ Keychain data → anonymous stdin pipe only
    ▼
registered provider verifier
    │ allowlisted metadata result only
    ▼
redacted IKHP observation
```

The parent/orchestrator never receives the raw secret. The native boundary
requests Keychain data internally, writes it directly to the registered
verifier's stdin, discards verifier stderr, rejects oversized or malformed
results, rejects output containing the exact secret bytes, and emits only a
small allowlisted result. The provider verifier owns authentication, principal,
scope, expiry, and refreshability semantics; the boundary owns secret use and
transport. No environment variable, argv value, temporary file, shell, JSON,
MCP response, log, snapshot, Git file, or LLM context carries the secret.

This is a bounded capability, not `getSecret(ref)`. It is currently proven
only with the synthetic local verifier. The native runtime and verifier may
retain transient copies in memory, and hard process termination cannot promise
perfect zeroization; those limitations remain explicit in the runbook.

### 3.3.5 Runtime ownership, onboarding, and lifecycle governance

Runtime ownership is an extension of the existing IKHP catalog, not a second
truth store. `infrastructure-catalog-v1.schema.json` adds optional,
provider-neutral governance metadata to resources, relations, and bindings.
The metadata separates:

```text
resource/application/runtime identity
account identity
credential and session state
runtime profile and binding
configuration custody
route ownership and writers
dependencies and recovery
environment and isolation
```

The authority rule is one authoritative owner per mutable resource. Ownership
and custody are not the same: the application may own a mutable configuration
or browser session while a provider owns the credential lifecycle. Brain's
role is lifecycle intelligence—observation, verification, drift detection,
recommendation, coordination, and guarded recovery—not custody of
application-managed state or raw secret material.

Onboarding is contract-driven and monotonic:

```text
discover → candidate → classify → validate → resolve ambiguity → admit → participate
```

Automatic discovery creates candidates and evidence only. Admission requires a
confirmed owner, environment/isolation boundary, health policy, recovery path,
and explicit lifecycle policy. Conflicting owners, route writers, account
bindings, or environment boundaries fail closed; they are never resolved by
file order or a model guess. `tools/validate-infrastructure-governance.mjs`
reports coverage and the pure admission planner proposes a transition without
mutating the catalog.

Lifecycle operations require dependency checks and, where declared,
quiescence evidence. Active workloads or leases block a mutation; missing or
unobservable runtime evidence remains `unknown`, never `idle`. Availability
policy remains with the owning application/provider, so Brain observes and
coordinates rather than introducing a competing keepalive or supervisor.

The same model supports one account or many accounts. An adapter declares its
capacity (`one`, `many`, `unsupported`, or `unknown`) and profile concurrency.
It does not imply that every application can run simultaneous profiles. Native
Codex and Codex Web GPT are separate adapter surfaces; a `CODEX_HOME` path,
browser profile, loopback bridge, port, or connector is implementation evidence
and never becomes a canonical Brain identity.

### 3.4 Live infrastructure health — derived runtime state, not Git truth

Target namespace:

```text
runtime/local/infrastructure/
```

Examples:

```text
health-state.json
provider-observations.jsonl
backup-observations.jsonl
credential-health-state.json
incident-state.json
```

Live state is derived, bounded, timestamped, rebuildable, and never a replacement for canonical architecture/inventory.

Every observation must include:

```text
resourceId
providerId
observedAt
sourceRevision / sourceEntityId when available
status
freshness
metric/condition summary
provenance
```

## 4. Provider strategy

Use existing systems rather than building a duplicate monitoring stack.

### New Relic

New Relic is the primary telemetry/alert aggregation provider for:

- host reporting;
- CPU/memory/storage/network/process metrics;
- disk-capacity thresholds;
- process/service health where instrumented;
- synthetic public endpoint checks;
- application/APM health;
- logs/integrations where already configured;
- alert issues/workflows.

Brain Core should query or receive normalized read-only New Relic state and map it to canonical resource IDs.

### Cloudflare

Cloudflare adapters should provide:

- tunnel/connector state;
- connector count and origin/tunnel metrics where available;
- domain/DNS/tunnel relationships;
- tunnel policy violations such as mutually exclusive production connectors;
- token/API credential metadata health without returning token values.

### Tailscale

Tailscale adapters should provide:

- device inventory/last-seen state;
- expected-node online/offline drift;
- route/subnet-router/exit-node state where applicable;
- client connectivity metrics where available;
- SSH logical-access health probes without exposing private keys.

### Dokploy / server-local probes

Use existing Dokploy and safe read-only server probes for:

- application/service state;
- container/service healthchecks;
- deployment drift;
- disk/filesystem capacity not already available through New Relic;
- expected process/systemd state;
- backup job status and restore-verification evidence.

### Backup providers

Backup health is not "backup exists". The model must distinguish:

```text
scheduled
last_success
last_failure
age
retention
storage_destination
restore_last_verified
restore_verification_age
recovery_class
```

A successful backup without restore verification is weaker evidence than a restore-tested backup.

## 5. Freshness and health model

Every canonical/derived infrastructure fact must declare or derive:

```text
observedAt
freshnessDeadline
fresh | review_due | stale | unknown
```

Examples:

- host/tunnel/process health: minutes;
- backup job success: according to backup schedule + grace window;
- restore verification: days/weeks/months according to policy;
- credential connectivity: provider-specific probe cadence;
- credential expiry: explicit expiry date where provider exposes it; otherwise `expiryUnknown` + verification cadence;
- static architecture inventory: review deadline and evidence timestamp.

Unknown is a first-class state and must not silently become healthy.

### 5.1 Identity & Access verification semantics

Identity/access observations reuse IKHP's existing normalized status values (`healthy`, `degraded`, `unhealthy`, `unknown`) and add a detailed state for the reason. The contract recognizes, at minimum:

```text
unknown
vault_unavailable
credential_missing
credential_present
credential_expiring
credential_expired
provider_rejected
provider_revoked
wrong_account
insufficient_scope
interactive_reauthentication_required
refresh_available
refresh_failed
provider_unavailable
verified_healthy
```

A provider verification is not healthy merely because a reference exists. Where supported, a read-only verifier must produce evidence for reference availability, authentication acceptance, observed principal, expected-principal match, required scope/capability, minimal provider capability, and evidence freshness. `unknown` is never promoted to healthy by absence of an error. `wrong_account` is a first-class condition and must block account-sensitive runtime use.

Detailed identity/access conditions project into the existing IKHP incident vocabulary, for example `identity_wrong_account`, `identity_provider_revoked`, `identity_credential_expiring`, and `identity_interactive_reauthentication_required`. They do not create a second incident or decision database. The scheduled adapter at `tools/infrastructure-identity-access/credential-health-orchestrator.mjs` reuses the existing IKHP3 incident projector and CLR3 attention planner, persists only non-secret evidence, and materializes stale/overdue state after missed schedules.

The first real-provider implementation is GitHub's read-only `GET /user`
identity probe behind the bounded macOS Keychain verifier boundary. The
provider adapter fixes the `https://api.github.com` origin and `/user` path,
requires TLS, rejects configured proxy use, does not follow redirects, limits
request/response time and body size, and makes one request with no retries or
writes. The stable numeric GitHub user ID is the principal; `login` is only a
display label. Credential type is explicit because scope observability differs
between fine-grained PATs, classic PATs, OAuth access tokens, GitHub App user
tokens, and other types. Unknown or unobservable scope/expiry evidence cannot
produce a false healthy result when the policy requires that evidence.

This provider slice is account-agnostic: each GitHub account has its own
Brain account, credential reference, expected numeric principal, and optional
runtime/session bindings. Enrollment is a separate human-gated native tool in
a fixed Brain Keychain namespace. The repository contains synthetic HTTP,
Keychain, and scheduled-lifecycle tests only; no real provider credential is enrolled, migrated,
renewed, rotated, revoked, or deleted.

## 6. Alerts and attention

Health providers should normalize observations into Brain infrastructure incidents, not separate human decision databases.

Examples:

```text
oauth_disconnected
credential_expiring
credential_probe_failed
host_not_reporting
disk_capacity_warning
disk_capacity_critical
backup_failed
backup_stale
restore_verification_overdue
tunnel_connector_missing
tunnel_connector_conflict
ssh_probe_failed
service_unhealthy
certificate_expiring
```

Notification policy should reuse the CLR3 attention philosophy. The credential-health dispatcher delivers only the planner's already-safe payloads through a shell-free, fixed macOS notification call and persists the notification cursor before delivery for best-effort at-most-once behavior:

- critical/high immediate on observation;
- dedupe repeated identical incidents;
- persistent unresolved count;
- normal daily digest;
- recovery notification when incident clears;
- human approval/decision requests enter the existing Decision Core only when a human choice is actually required.

Health incidents are not themselves a second Decision Core.

## 7. Portal and LLM/MCP entry point

Brain Core should eventually expose one coherent infrastructure namespace, for example:

```text
GET /infra/catalog
GET /infra/topology
GET /infra/health
GET /infra/incidents
GET /infra/backups
GET /infra/credentials/status
GET /infra/resources/:id
GET /infra/resources/:id/relations
GET /infra/doctor
```

CLI/MCP equivalents should use the same model:

```text
prochat infra status
prochat infra topology
prochat infra health
prochat infra inspect <resource-id>
prochat infra incidents
prochat infra backups
prochat infra credentials
prochat infra doctor
```

Context Broker/LLM consumers receive compact infrastructure descriptors first, then exact resource/relationship/health detail only when task relevance justifies retrieval.

The primary human UI remains Obsidian Brain Console. Infrastructure views should show topology, resource health, active incidents, backups, credential health/expiry, and freshness. The port-4881 console remains optional specialist diagnostics unless separately re-decided.

## 8. Safety model

Infrastructure mutation is high-risk by default.

### 8.1 Read-only default

Discovery, topology, status, health, credential metadata, backup status, and config provenance are read-only.

### 8.2 No secret leakage

Raw secrets must never enter:

- Git;
- LLM context packs;
- MCP tool descriptions/results;
- Brain Console payloads;
- logs/receipts;
- decision cards.

### 8.3 Protected resource classes

At minimum:

```text
ssh_config
firewall
cloudflare_tunnel
cloudflare_dns
tailscale_acl_route
systemd_service
dokploy_platform
production_database
backup_policy
backup_destination
restore_operation
credential_store
oauth_connection
api_key
newrelic_alert_policy
```

### 8.4 Mutation gates

Any future mutating infrastructure action must require, according to risk class:

1. exact resource ID and expected current revision/state;
2. dependency/blast-radius lookup from the topology graph;
3. backup/recovery evidence when the mutation can affect availability/data/access;
4. dry-run or provider validation where available;
5. syntax/schema/config validation;
6. explicit human approval for destructive, routing, auth, firewall, backup-policy, production DB, credential, or availability-impacting mutations;
7. atomic/staged replacement instead of blind overwrite where applicable;
8. post-change health verification;
9. rollback plan and receipt;
10. no broad shell execution or free-form configuration mutation.

Delete/decommission operations additionally require evidence that the resource is unused/superseded, restore/rollback capability where relevant, and explicit owner approval.

### 8.5 LLM autonomy boundary

LLMs may proactively:

- inspect topology/health;
- identify drift/risk;
- explain blast radius;
- propose repairs;
- create bounded plans;
- notify/raise Decision Core items where human authority is needed.

LLMs must not autonomously perform production-affecting routing, credential, firewall, backup, database, tunnel, SSH, or destructive changes absent an explicitly authorized policy/action phase.

### 8.6 Identity & Access threat boundaries

The identity/access plane must explicitly account for:

- **secret zero/bootstrap:** initial vault access is an explicit human or application bootstrap step; Brain does not invent or print bootstrap material;
- **vault compromise:** adapter scope is least-privilege, references are purpose-bound, and health/incident output contains metadata only;
- **wrong-account operation:** expected-principal verification occurs before account-sensitive use, even when authentication succeeds;
- **stale evidence:** every observation has a freshness deadline; stale and unavailable evidence remain visible as `unknown` or degraded;
- **logging leakage:** raw values, provider responses containing values, process arguments, environment dumps, and session databases are excluded from logs and receipts;
- **backup/recovery:** recovery metadata and runbooks may be catalogued, but vault backups and human recovery material remain owned by their appropriate adapter;
- **vault unavailability:** Brain degrades gracefully and blocks account-sensitive actions when required evidence cannot be obtained;
- **lifecycle overreach:** automatic refresh is permitted only through an explicitly supported provider flow; browser login, synthetic keepalive traffic, blind key replacement, and silent revocation remain forbidden.

The current implementation tranche is read-only provider/boundary work. No
provider credential is migrated, extracted, renewed, rotated, revoked, or
deleted.

### 8.7 Ownership and recovery diagnostic order

When a managed runtime fails, recovery follows the dependency graph and
ownership boundaries rather than starting with credential replacement:

```text
consumer/runtime → local route target or bridge → owning runtime
→ connector/MCP/harness → provider/network → account/session
→ config or credential replacement
```

Healthy resources are preserved and verified first. A recovery proposal must
identify the owning actor, required quiescence, affected environment, evidence
freshness, rollback path, and whether the next step is human reauthentication.
Brain may coordinate and produce the exact next action; it must not silently
take custody of an application session or create a second keepalive loop.

### 8.8 Generic observation, candidate, and admission contract

The live plane uses one provider-neutral observation contract for applications,
runtimes, servers, processes, endpoints, dependencies, identities, sessions,
credential custody, lifecycle, health, and isolation. Each observation carries
an observer identity, candidate identity, environment, provenance, freshness,
confidence, evidence state, and redaction declaration. The adapter seam is:

```text
discover()            → non-secret observations and candidates
observe(candidate)    → latest evidence for one candidate
verifyRelationship()  → evidence for an ownership/dependency/route claim
```

Local runtime discovery is limited to allowlisted process identity and
listener metadata. Product adapters may call supported status/doctor surfaces
and normalize their output, but they cannot expose raw command arguments,
environment variables, browser storage, OAuth, or secret-store values.

Discovery never writes the canonical catalog. A candidate is admitted only by
a pure, schema-validated plan when identity, environment, ownership, custody,
dependencies, health/recovery, lifecycle, route writers, and isolation are
resolved. Unknown evidence remains a backlog item; conflicting evidence is
rejected. The plan contains proposed changes only and has
`executionEnabled=false`, `executionPerformed=false`, and no actual effects.

The current reference proof uses generic synthetic consumers to prove
application-managed and Brain-managed custody, dependencies, identity
binding, health, isolation, unknown ownership, and conflict rejection. Native
Codex and Codex Web GPT production/DEV are observed through a product adapter
without becoming the canonical model. The current catalog exposes a bounded
backlog of 46 governance-unknown resources, and the live evidence is recorded
separately from Git authority in
`operations/reports/ikhp-live-codex-runtime-observation-2026-09-05.md`.

This contract is the bridge to account-aware credential health, not a generic
credential janitor. macOS Keychain remains the current/reference local custody
adapter. OnePassword is a possible future adapter and must satisfy the same
opaque-reference, least-privilege, redaction, verification, and admission
rules before it can participate.

The native Codex account/profile proof extends the existing I&A catalog with
account/session/runtime-profile binding evidence and authentication-storage
capabilities; it does not create a second account or OAuth registry. A runtime
profile may describe a `CODEX_HOME` adapter boundary, but that implementation
detail is not itself an account identity. File, keyring, auto, browser-profile,
and application-native storage are represented with explicit ownership and
isolation evidence. Unknown keyring namespacing, account attribution, and
concurrency remain unknown rather than being promoted from a successful login
status. See `operations/specs/infrastructure-codex-account-profile-capability.md`
for the product-specific capability matrix.

## 9. What not to build

Do not add:

- a second monitoring database to replace New Relic;
- a heavyweight graph database as a correctness dependency;
- raw secrets in Brain Git;
- an always-on model loop just to poll infrastructure;
- separate duplicated server inventories per CLI/MCP/UI;
- a second human decision queue;
- automatic remediation before measured read-only health/incident reliability exists.

The architecture should reuse Brain Core, Context Broker, Decision Core, existing provider adapters, New Relic, and current runbooks wherever possible.

## 10. Relationship to Infinite Brain philosophy

This plane is a direct application of Infinite Brain principles:

```text
human intent / authority
        ↓
canonical infrastructure knowledge + current health
        ↓
Brain capability/safety policy
        ↓
exact resource and dependency context
        ↓
authorized action plan
        ↓
validation + receipt + updated health
```

Brain owns machine capability, operational truth, provider contracts, safety, and infrastructure topology. Mind may hold human priorities/strategy (for example cost tolerance, acceptable downtime, preferred vendors), but server/IP/config/backup/credential metadata and live machine health belong in Brain.

The system should become hyper-aware by making infrastructure context available everywhere through one bounded Brain interface, not by stuffing all infrastructure text into every model prompt.

## 11. Codex vertical slice without Codex becoming the core

Codex is the first demanding vertical slice because it exercises multiple identities, application-managed sessions, MCP authorization, and runtime isolation. The provider-neutral contract maps the slice as follows:

```text
OpenAI account A / OpenAI account B
        ├── separate account records with expected principals
        ├── separate Codex session records
        ├── separate MCP authorization records where applicable
        └── separate runtime-profile records owned by a runtime adapter
```

The Codex Web GPT metadata fixture at
`operations/fixtures/infrastructure-codex-web-gpt-metadata-v1.json` applies
the same mapping without making a live claim: the production launcher,
application-owned browser session, connector, loopback/API bridge, and route
are separate resources. The route owner is the application; bridge/connector
custody is recorded as unknown until evidence identifies the actual owner.
Production and development have distinct environment and isolation references.
The fixture records two opaque account references and `many` account capacity,
but contains no cookies, OAuth values, tokens, or provider payloads.

Native Codex CLI/IDE and Codex Web GPT are separate surfaces. Native Codex may
use an adapter-specific local profile directory; Web GPT may use an
application-managed browser session. Neither surface is allowed to write
Brain's canonical account or route truth, and this architecture does not
promise simultaneous desktop profiles that the application has not proven.

An adapter may implement isolated `CODEX_HOME` directories for CLI/IDE use, but profile switching must be process-aware and must not terminate unrelated SSH or other runtimes. Desktop/application session ownership may still require an explicit interactive reauthentication flow. Brain records that boundary and its health; it does not extract or transplant application-managed OAuth state.

The tactical `codex-home-managed-root.sh` and `codex-stop-and-repair.sh` scripts remain recovery tools. They are not the Identity & Access abstraction and must not become the provider-specific canonical manager.
