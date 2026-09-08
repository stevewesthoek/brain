# Infrastructure Knowledge & Health Plane — Roadmap

**Namespace:** IKHP
**Status:** IKHP0-IKHP5 complete; IKHP6 Packet 1 accepted; later automation/remediation not authorized
**Owner:** Brain
**Primary human surface:** Obsidian Brain Console
**Program relationship:** sibling Brain program to CLR. CLR consumes IKHP context/health through Brain Core/Context Broker; IKHP does not ingest conversations.

## Program objective

Make Brain the fresh, programmable, safety-aware knowledge/control plane for Steve's servers, networks, applications, tunnels, backups, credential references, runtimes, and infrastructure health without duplicating New Relic or storing secrets in Git.

Success means:

- one logical infrastructure entry point for humans, LLMs, MCP, CLI, and Brain Core;
- machine-readable topology and relation knowledge;
- explicit freshness/health/provenance;
- credential/OAuth/API-key **metadata and health** without exposing secret values;
- backup success/failure/age/restore-verification awareness;
- server/app/tunnel/SSH/disk/service monitoring normalized from existing providers;
- one incident/attention model with dedupe and recovery;
- safe blast-radius-aware mutation planning;
- provider-neutral runtime ownership, onboarding, dependency, isolation, and lifecycle intelligence;
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

**Status:** complete and accepted 2026-08-16 as a repository implementation; no live provider polling, health normalization, credential verification, infrastructure mutation, or IKHP2 activation is claimed.

**Acceptance evidence:** `operations/reports/ikhp1-infrastructure-catalog-acceptance-2026-08-16.md`

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

**Status:** complete and accepted 2026-08-17 as a repository implementation; deterministic read-only normalization and bounded runtime persistence are implemented, but continuous scheduling, live provider reachability, credential validity, incident generation, remediation, and IKHP3 activation are not claimed.

**Acceptance evidence:** `operations/reports/ikhp2-live-health-normalization-acceptance-2026-08-16.md`

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

**Status:** complete and accepted 2026-08-17 as a repository implementation.

**Acceptance evidence:** `operations/reports/ikhp3-incidents-attention-acceptance-2026-08-17.md`

**Boundary:** no continuous scheduling, live provider polling, live notification delivery, API/CLI/MCP/Obsidian incident surface, Decision Core proposal creation, remediation, infrastructure mutation, CLR5 implementation, or IKHP4 activation.

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

**Status:** complete and accepted 2026-08-19 as a repository implementation.

**Acceptance evidence:** `operations/reports/ikhp4-safety-action-contracts-acceptance-2026-08-19.md`

**Boundary:** deterministic safety policy, typed action plans, fail-closed preflight evaluation, and bounded non-secret runtime receipt persistence only. No live/provider/infrastructure execution, remediation, IKHP5 activation, IKHP6 activation, or CLR5 implementation.

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

**Status:** complete and accepted 2026-08-19 as a repository implementation.

**Acceptance evidence:** `operations/reports/ikhp5-unified-consumer-surfaces-acceptance-2026-08-19.md`

**Boundary:** one canonical read-only infrastructure identity/state model across Brain Core API, Context Broker, CLI/MCP, and the existing Obsidian Brain Console. No provider/infrastructure execution, remediation, IKHP6 activation, or CLR5 implementation.

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

**Status:** Packet 1 complete and accepted 2026-08-22 as an admission-only repository implementation. Later measured automation execution and bounded remediation remain not authorized.

**Acceptance evidence:** `operations/reports/ikhp6-packet1-reconciliation-2026-08-22.md`

**Packet 1 boundary:** versioned automation-admission and measurement contracts, deterministic validation, and evidence-only fixtures. `executionEnabled=false`, `executionPerformed=false`, and `actualEffects=[]` remain mandatory. No provider/infrastructure execution, remediation, scheduling, credential mutation, or live action path is authorized.

**Packet 1 exit gate:** admission and measurement schemas, dedicated validators, focused measurement tests, IKHP4/IKHP5 regression floors, JSON/syntax/diff validation, and explicit non-execution evidence are complete.

Only after sustained read-only reliability evidence:

- deterministic low-risk self-healing may be proposed for explicitly approved action classes;
- high-risk infrastructure remains approval-gated;
- New Relic/Cloudflare/etc. workflows may trigger Brain incident intake, not arbitrary shell remediation;
- every automated action requires policy, preflight, receipt, post-health verification, and rollback semantics;
- track false-positive, failed-remediation, mean-time-to-detect, mean-time-to-recover, backup success, restore-test success, credential-expiry warning coverage, and alert-noise metrics.

Exit gate:

- automation demonstrates measurable benefit without weakening safety or creating hidden mutation channels.

## IKHP-IAP — Identity & Access contract foundation

**Status:** Identity & Access contracts, bounded verification, GitHub adapter,
and scheduled read-only health/incident orchestration are implemented as
repository-only proof on 2026-09-05. Real enrollment, live provider polling,
runtime profile activation, and credential mutation remain separately gated.

**Contract:** `operations/specs/infrastructure-identity-access-v1.schema.json`

**Validation:** `node tools/validate-infrastructure-identity-access.mjs`, `node tools/validate-infrastructure-credential-health.mjs`, `node --test tools/infrastructure-identity-access.test.mjs`, `node --test tools/infrastructure-identity-access/macos-keychain-adapter.test.mjs`, `node --test tools/infrastructure-identity-access/macos-keychain-enrollment.test.mjs`, `node --test tools/infrastructure-identity-access/credential-verification-boundary.test.mjs tools/infrastructure-identity-access/credential-verification-boundary.e2e.test.mjs`, `node --test tools/infrastructure-identity-access/github-provider-verifier.test.mjs`, and `node --test tools/infrastructure-identity-access/credential-health-orchestrator.test.mjs`

IKHP-IAP establishes one logical provider-neutral identity/access view with separate entities for:

- accounts/identities, including multiple accounts for one provider;
- credentials and opaque secret-store references;
- live or cached application-managed sessions;
- isolated runtime profiles owned by runtime adapters;
- replaceable secret-store adapters;
- explicit lifecycle and read-only verification policies;
- detailed identity/access evidence mapped to IKHP normalized health and incidents.

The canonical enrollment catalog is intentionally empty. Existing credentials and application-managed OAuth/session state are not imported, copied, extracted, or changed by this tranche.

The first/reference local adapter is the read-only macOS Keychain pilot at
`tools/infrastructure-identity-access/macos-keychain-adapter.mjs`, backed by a
fixed Security.framework probe. It admits namespace-bound metadata,
reference-existence checks, and bounded consumption by the registered synthetic
verifier. No generic raw-value resolution, item mutation, migration, real
provider verification, or catalog enrollment is enabled. Other stores remain
replaceable future adapters behind the same contract; no particular vault
product is a Brain policy dependency.

Recovery portability for the login Keychain and its application access
controls is currently `unknown`: the existing repository recovery inventory
does not contain a Keychain restore proof. The next recovery-evidence tranche
must test a namespaced synthetic item on a replacement profile/Mac and document
which provider credentials require human reauthentication or reissue.

Exit gate for this foundation:

- schema validates canonical and source-neutral alternate catalogs;
- multiple same-provider accounts are represented without provider-specific core fields;
- sessions are distinct from credentials and may remain application-owned;
- expected-principal mismatch is a first-class failed state;
- stale/unknown evidence cannot become healthy;
- raw secret material, credential mutation, browser login, artificial keepalive behavior, and unadmitted Keychain resolution are rejected or absent.

The first provider/enrollment implementation is now present but remains
human-gated: no real credential has been enrolled or verified. The next
operational tranche requires separate owner authorization for reviewed
metadata enrollment and a live read-only health run. It must not begin with
credential migration, automatic refresh, or provider mutation.

### IKHP-IAP-CFG — Semantic configuration ownership safety

**Status:** implemented and synthetic-tested on 2026-09-06; live OAuth and
credential migration remain explicitly deferred.

Runtime configuration is now planned at semantic-resource level through
`tools/lib/configuration-ownership.mjs`. The profile materializer records an
opaque source revision, rechecks it immediately before publication, validates
non-secret output, writes atomically with owner-only permissions, and verifies
the result. Unknown ownership, ownership transfer, application-journal
inconsistency, and drift are non-executable outcomes.

The real shared/default `~/.codex` is classified as a legacy/shared native
surface and is observe-only for normal Brain operations. The generic
managed-root path refuses that root and refuses a WebGPT integration journal;
synthetic regression fixtures prove preservation of WebGPT route/model and
realtime routing, hook trust state, application/user settings, and unknown
third-party configuration. WebGPT route/journal recovery remains its adapter's
responsibility. This tranche does not touch OAuth, Keychain values, login,
logout, credential refresh, or state-database recovery.

### First provider implementation: GitHub (live use not performed)

GitHub is the recommended first real provider because its REST API offers a
small, read-only identity probe: `GET /user` returns the authenticated user and
documents explicit `200`, `401`, and `403` outcomes. For OAuth app tokens,
GitHub also documents `X-OAuth-Scopes` and `X-Accepted-OAuth-Scopes`, giving the
verifier a concrete scope-evidence path. A first pilot should use one opaque
credential reference per GitHub account, compare the returned stable user ID
and login to the expected principal, capture only safe scope/rate-limit
metadata, and make no write request. The repository now contains this
verifier and a fixed-namespace interactive Keychain enrollment tool, but this
is not authorization to use a live token. The real-provider run remains an
explicit operator step after stable numeric principal review.

### Identity & Access sequence

1. Canonical Identity & Access contracts — **DONE**.
2. macOS Keychain metadata/existence adapter — **DONE**.
3. Bounded credential-verification boundary with synthetic end-to-end proof — **DONE in this tranche**.
4. GitHub fixed-origin read-only verifier and human-gated enrollment — **IMPLEMENTED, synthetic-tested; live run NEXT, separately approved**.
5. First reviewed real GitHub enrollment and expected numeric-principal verification.
6. Scheduled health, freshness, cadence/backoff, IKHP incident, and CLR3 attention evaluation — **IMPLEMENTED as synthetic-tested repository proof; scheduler activation remains explicit and unverified**.
7. Codex multi-account runtime-profile manager and provider-specific OpenAI/Codex adapter.
8. Generic runtime ownership/admission and lifecycle evidence — **DONE in this tranche**.
9. Codex Web GPT metadata adapter proof and scoped live integration design — **DONE as metadata-only proof**.
10. Guided recovery flows.
11. Narrowly approved provider-supported refresh.
12. Broader credential lifecycle automation only after evidence.

## IKHP-RGO — Runtime ownership, onboarding, and lifecycle governance

**Status:** complete as repository-only, provider-neutral proof on 2026-09-05.
No live Codex Web GPT integration, config repair, tunnel/connector mutation,
credential migration, login/logout, or scheduler activation was performed.

This tranche extends the existing IKHP catalog and I&A model rather than
introducing a parallel ownership store. It defines:

- one authoritative owner and separate state custody, observer, verifier, drift,
  and mutation-authority fields;
- explicit resource/application/runtime, account, credential, session, runtime
  profile, configuration, route, dependency, environment, and isolation links;
- candidate-versus-admitted onboarding with discovery kept below authority;
- route ownership and writer conflict detection;
- required health/recovery and dependency coverage;
- active workload/lease and quiescence readiness that fails closed on unknown;
- one/many/unsupported/unknown account capacity and profile concurrency;
- a pure admission planner and a read-only Brain Core governance projection.

**Contracts and implementation:**

```text
operations/specs/infrastructure-catalog-v1.schema.json
tools/infrastructure-catalog/governance-core.mjs
tools/validate-infrastructure-governance.mjs
operations/fixtures/infrastructure-onboarding-alternate-v1.json
operations/fixtures/infrastructure-codex-web-gpt-metadata-v1.json
```

The synthetic proof covers two hypothetical consumers. The Codex Web GPT
fixture maps production and development runtimes, an application-owned browser
session, connector, loopback/API bridge, route owner, two opaque account
references, and unknown credential custody. It contains no secrets and makes
no live-state claim. Native Codex CLI/IDE and Codex Web GPT remain distinct
adapter surfaces.

The action preflight now consumes optional quiescence evidence and blocks
mutations when a governed target is active or evidence is missing. It never
kills processes, enables execution, or takes over availability policy.

**Validation:** `npm run validate:infrastructure-governance`,
`npm run test:infrastructure-governance`, `npm run test:infrastructure-actions`,
`npm run validate:infrastructure-actions`, and
`npm run test:infrastructure-catalog`.

**Prior exact Brain Goal:** add an account-neutral runtime adapter contract and
human-gated discovery/admission evidence for one real consumer, starting with
read-only observation of process/profile/session boundaries. That goal is
implemented below as IKHP-OBS; the follow-on goal is the account/session/
runtime-profile binding model. Do not begin with OAuth extraction or simultaneous desktop-profile
claims.

## IKHP-OBS — Generic live observation and account-neutral admission

**Status:** implemented and synthetic-tested on 2026-09-05; live observation
proof recorded; no live state was mutated.

This tranche closes the conceptual gap between broad infrastructure discovery
and safe catalog participation. It adds one provider-neutral observation and
candidate contract for applications, runtimes, servers, processes, endpoints,
dependencies, identity bindings, custody, lifecycle, health, and isolation.
Every observer implements `discover()`, `observe(candidate)`, and
`verifyRelationship()`.

Deliverables:

- `operations/specs/infrastructure-observation-v1.schema.json` — extended
  observation contract, backward-compatible with existing health snapshots;
- `operations/specs/infrastructure-candidate-v1.schema.json` — candidate,
  pure admission-plan, and bounded backlog contract;
- `tools/infrastructure-catalog/observation-core.mjs` — generic adapter seam,
  redaction checks, candidate conversion, fail-closed admission, and backlog;
- `tools/infrastructure-catalog/local-runtime-observer.mjs` — process/listener
  observation without arguments or environment capture;
- `tools/infrastructure-catalog/codex-runtime-adapter.mjs` — Codex/WebGPT
  product proof only;
- `tools/observe-infrastructure.mjs` — safe live observation output;
- `tools/validate-infrastructure-observation-admission.mjs` — deterministic
  OK/NOT OK acceptance gate;
- synthetic fixtures/tests and the live Codex evidence report.

Acceptance proof:

- two unrelated synthetic consumers admit cleanly with application custody and
  Brain custody respectively;
- unknown owner remains a candidate and conflicting owner is rejected;
- dependency, identity, health, isolation, freshness, redaction, and
  non-execution invariants are machine-checked;
- native Codex and WebGPT production/DEV are observed without account or
  secret disclosure;
- all 46 current canonical resources remain visible as governance backlog;
- no observer writes canonical state or activates a scheduler.

## IKHP-IAP-CODEX — Account/session/runtime-profile capability proof

**Status:** capability-proof tranche implemented and synthetic-tested on
2026-09-05; no live authentication or application state was changed.

This tranche evolves the existing Identity & Access catalog with non-secret
binding evidence, authentication-storage ownership/isolation metadata, and
explicit profile concurrency capability. It records the current Codex CLI,
IDE, Desktop, and Web GPT boundary without creating an OAuth registry or
claiming that `CODEX_HOME` alone isolates authenticated accounts.

The current result is **partially supported**: CLI configuration and
`CODEX_HOME` state boundaries are supported, file-mode per-root authentication
is documented for the CLI, and keyring/auto authenticated-profile isolation,
concurrency, and Desktop isolation remain unknown. The repository now includes
the synthetic-tested CLI-only manager at
`tools/runtime-profile-manager.mjs`; real authentication remains gated on the
two-account pilot in
`operations/specs/infrastructure-codex-account-profile-capability.md`.

The account/session/runtime-profile model must attribute health to an account
before notification or recovery guidance and must not extract application OAuth
or assume that logout/login preserves multiple profiles.

## Cross-program ordering

CLR0-CLR4 are complete.

IKHP is now admitted as a sibling program. It does not reopen CLR0-CLR4.

Before CLR5 implementation is authorized, the CLR5 ingestion design must reference IKHP authority boundaries so infrastructure conversation evidence cannot become a parallel infrastructure truth store. CLR5 may capture evidence/candidates, but canonical server/network/config/credential-reference/backup knowledge remains IKHP/Brain authority.

IKHP6 Packet 1 is accepted. Any later packet that enables automation execution, remediation, scheduling, provider mutation, or other capability expansion requires separate owner authorization and acceptance.
