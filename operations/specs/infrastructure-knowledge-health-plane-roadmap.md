# Infrastructure Knowledge & Health Plane — Roadmap

**Namespace:** IKHP
**Status:** IKHP0 architecture/inventory complete; IKHP1-IKHP6 not authorized
**Owner:** Brain
**Primary human surface:** Obsidian Brain Console
**Program relationship:** sibling Brain program to CLR. CLR consumes IKHP context/health through Brain Core/Context Broker; IKHP does not ingest conversations.

## Program objective

Make Brain the fresh, programmable, safety-aware knowledge/control plane for Steve's servers, networks, applications, tunnels, backups, credential references, and infrastructure health without duplicating New Relic or storing secrets in Git.

Success means:

- one logical infrastructure entry point for humans, LLMs, MCP, CLI, and Brain Core;
- machine-readable topology and relation knowledge;
- explicit freshness/health/provenance;
- credential/OAuth/API-key **metadata and health** without exposing secret values;
- backup success/failure/age/restore-verification awareness;
- server/app/tunnel/SSH/disk/service monitoring normalized from existing providers;
- one incident/attention model with dedupe and recovery;
- safe blast-radius-aware mutation planning;
- Obsidian-first visual observability;
- no automatic high-risk remediation until read-only accuracy is measured.

## Existing foundations to preserve and consolidate

- `operations/infrastructure/infra.md` — existing central prose infrastructure reference;
- `operations/architecture/prochat-infrastructure-architecture.md` — current detailed architecture/migration state;
- `operations/architecture/prochat-infrastructure-evidence-register.md` — current evidence/provenance register;
- `operations/accounts/credentials-index.md` + `sync-credentials` — central credential metadata and discovery;
- `operations/infrastructure/scheduler-inventory.md` — scheduler/backup-job state;
- `operations/specs/infinite-brain-recovery-inventory.json` — recovery-critical inventory;
- Brain Core `/infra/dokploy`, `/infra/scheduler`, `/infra/tunnels`, `/infra/domains`, `/infra/monitoring`, and related endpoints;
- Brain Console New Relic monitoring view;
- provider-specific Cloudflare, Tailscale, Dokploy, backup, OAuth, credential, and application runbooks;
- CLR1 authority/freshness contracts;
- CLR2 Context Broker/provider model;
- CLR3 Decision Core/attention model;
- CLR4 deployment/provider profile and cross-host runtime contracts.

IKHP must consolidate these through contracts and references, not replace working systems gratuitously.

## IKHP0 — Architecture, inventory, and roadmap admission

**Status:** complete 2026-08-16.

Deliverables:

- repository inventory of infrastructure knowledge/health surfaces;
- authority-layer decision: canonical catalog vs live health vs secret store vs evidence docs;
- single logical Brain entry point;
- monitoring-provider strategy centered on existing New Relic investment;
- credential-reference/expiry/connectedness model;
- backup/restore-health model;
- infrastructure mutation safety model;
- roadmap and implementation plan.

Exit gate:

- no implementation begins accidentally;
- current migration-owned architecture documents remain untouched;
- CLR5 conversation ingestion remains separate.

## IKHP1 — Canonical infrastructure catalog and relationship contracts

**Status:** not authorized.

Create versioned machine-readable contracts under `operations/infrastructure/catalog/` for:

- top-level manifest/discovery;
- assets/resources;
- relations/dependencies;
- service bindings;
- credential references/metadata;
- backup policies;
- health policies;
- safety policies.

Requirements:

- assign stable resource IDs to servers, apps, databases, tunnels, domains, storage, backup systems, provider accounts, and control-plane services;
- map existing `infra.md`, architecture evidence, credentials index, recovery inventory, local apps, scheduler, tunnels/domains, Dokploy, and deployment profiles without duplicating authority;
- preserve evidence/provenance and freshness deadline per material fact;
- no secret values in Git;
- include Steve's current topology as one installation profile, not generic product semantics;
- include a synthetic alternate installation fixture.

Exit gate:

- one manifest can discover the complete catalog;
- exact relations answer "what depends on this?" and "what breaks if this changes?";
- duplicate/conflicting ownership is reported rather than silently merged.

## IKHP2 — Live health observation and provider normalization

**Status:** not authorized.

Normalize read-only health from existing providers into bounded runtime state.

Initial adapters:

- New Relic: hosts, storage, process/service health, synthetics/APM/alerts;
- Cloudflare: tunnel/connectors, domains/DNS relationships, connector-policy violations;
- Tailscale: devices/last-seen/connectivity/routes where available;
- Dokploy/server probes: applications/services/systemd/read-only resource health;
- scheduler/backups: last run, failures, age, retention, restore verification;
- credential/OAuth/API providers: configured/connected/expiry/rotation/verification state without values.

Runtime target:

```text
runtime/local/infrastructure/
```

Every observation must include resource ID, provider, observed time, freshness, provenance, and normalized status.

Exit gate:

- provider failure produces `unknown`/`stale`, never false healthy;
- New Relic remains telemetry provider, Brain remains topology/policy authority;
- all adapters are read-only.

## IKHP3 — Freshness, incidents, notifications, and recovery state

**Status:** not authorized.

Implement normalized incident types such as:

- `host_not_reporting`;
- `disk_capacity_warning` / `disk_capacity_critical`;
- `service_unhealthy`;
- `tunnel_connector_missing` / `tunnel_connector_conflict`;
- `ssh_probe_failed`;
- `backup_failed` / `backup_stale` / `restore_verification_overdue`;
- `oauth_disconnected`;
- `credential_expiring` / `credential_probe_failed`;
- `certificate_expiring`.

Notification policy:

- critical/high attention on observation;
- dedupe repeated incident noise;
- persistent unresolved count;
- daily normal digest;
- recovery/cleared notification;
- use existing CLR3 Decision Core only when a human decision is required.

Exit gate:

- incident lifecycle is deterministic and idempotent;
- alert storms are bounded;
- no second human decision queue exists.

## IKHP4 — Infrastructure safety policy and guarded action contracts

**Status:** not authorized.

Define protected resource classes and mutation policies for:

- SSH;
- firewall/network routes;
- Cloudflare tunnels/DNS;
- Tailscale ACL/routes;
- systemd/services;
- Dokploy/platform config;
- production databases;
- backup policies/destinations/restores;
- credential stores/OAuth/API keys;
- New Relic alert configuration.

Future actions must use typed action plans, never arbitrary infrastructure shell text.

Required preflight according to risk:

- exact resource ID and expected current revision;
- dependency/blast-radius graph;
- current health/freshness;
- backup/recovery evidence;
- dry-run/provider validation;
- syntax/schema/config validation;
- explicit approval for destructive/routing/auth/data/availability-impacting changes;
- atomic/staged replacement where applicable;
- post-change health verification;
- rollback/receipt.

Exit gate:

- read-only discovery never grants mutation;
- protected mutations fail closed without all required evidence;
- delete/decommission requires dependency and recovery evidence plus owner approval.

## IKHP5 — Unified Brain Core, Context Broker, CLI/MCP, and Obsidian surfaces

**Status:** not authorized.

Expose one logical infrastructure interface:

```text
/infra/catalog
/infra/topology
/infra/health
/infra/incidents
/infra/backups
/infra/credentials/status
/infra/resources/:id
/infra/resources/:id/relations
/infra/doctor
```

CLI/MCP equivalents:

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

Context Broker:

- compact infrastructure descriptor first;
- exact topology/health/policy only when task-relevant;
- no raw secrets in context;
- freshness and source citations required.

Obsidian Brain Console:

- primary visual infrastructure portal;
- topology/resource relationships;
- host/app/tunnel/service health;
- incidents;
- backups/restore verification;
- credential/OAuth status and expiry metadata;
- freshness indicators;
- safe action-plan/Decision Core links where authorized.

Exit gate:

- one logical entry point works for human, LLM, CLI, and MCP consumers;
- no portal-specific duplicated infrastructure truth.

## IKHP6 — Measured preventive automation and bounded remediation

**Status:** not authorized.

Only after sustained read-only reliability evidence:

- deterministic low-risk self-healing may be proposed for explicitly approved action classes;
- high-risk infrastructure remains approval-gated;
- New Relic/Cloudflare/etc. workflows may trigger Brain incident intake, not arbitrary shell remediation;
- every automated action requires policy, preflight, receipt, post-health verification, and rollback semantics;
- track false-positive, failed-remediation, mean-time-to-detect, mean-time-to-recover, backup success, restore-test success, credential-expiry warning coverage, and alert-noise metrics.

Exit gate:

- automation demonstrates measurable benefit without weakening safety or creating hidden mutation channels.

## Cross-program ordering

CLR0-CLR4 are complete.

IKHP is now admitted as a sibling program. It does not reopen CLR0-CLR4.

Before CLR5 implementation is authorized, the CLR5 ingestion design must reference IKHP authority boundaries so infrastructure conversation evidence cannot become a parallel infrastructure truth store. CLR5 may capture evidence/candidates, but canonical server/network/config/credential-reference/backup knowledge remains IKHP/Brain authority.

IKHP implementation itself requires separate owner authorization.
