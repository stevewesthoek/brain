# Infrastructure Knowledge & Health Plane — Architecture

**Status:** proposed architecture; roadmap admission only; no live monitoring/action implementation authorized
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
credential-health.json
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

Notification policy should reuse the CLR3 attention philosophy:

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
