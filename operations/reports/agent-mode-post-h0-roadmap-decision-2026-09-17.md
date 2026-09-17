# Agent Mode Post-H0 Roadmap Decision — 2026-09-17

Status: **DECISION COMPLETE — NO NEW FOUNDATION PHASE**

Decision: the Agent Mode foundational roadmap is complete through H0. Brain
enters **release-maintenance mode**. Product work, operational hardening, and
optional platform/distribution work may be authorized as separate bounded
tasks, but no successor foundation phase is created by this decision.

## Reconciliation

- Starting HEAD: `46a595e7 docs(agent-mode): clarify H0 live evidence chronology`.
- `git status --short` contained only the protected/unrelated baseline paths:
  `operations/accounts/credentials-index.md`,
  `tools/firecrawl/logs/firecrawl.log`,
  `operations/specs/mindcontrol-product-roadmap.md`, and
  `operations/specs/nevermind-release-pipeline-roadmap.md`.
- No staged changes were present and no protected path was read, modified,
  staged, reset, cleaned, or committed.
- K5, U0, V0, and D0 are recorded complete. H0-G2 supplies the corrected
  provider and remote-node evidence and records H0 complete with the release
  gate passed.
- The older H0-A through H0-G entries retain their historical chronology. The
  H0-G2 entry and this report are the current authority; historical
  `IN PROGRESS`, `BLOCKED`, and “next task” wording is not a current status.

## Completed phase ledger

| Phase | Purpose and current status | Exit evidence / caveat |
|---|---|---|
| K0 | Durable kernel, StateStore, execution journal, budgets, leases, receipts, local BrainNode envelope, mock runtime and observer. **COMPLETE for bounded offline/kernel gate.** | K0.1–K0.4 evidence; live execution was intentionally left to later phases. |
| K1 | Native Bedrock gateway, model/resource identity, deterministic tier, budget, health and escalation policy, and runtime surfaces. **COMPLETE for bounded policy/gateway gate.** | K1.1–K1.3 evidence; Codex remains a separate quota-aware subscription runtime. |
| K2 | One Jarvis/one worker live vertical slice, read-only capability, controls, process-loss recovery and portability. **COMPLETE for bounded slice.** | K2.1-R1/K2.2 evidence; not unrestricted Jarvis autonomy. |
| N0 | Authenticated remote BrainNode/NodeTransport, enrollment, reconnect and multi-node parity. **COMPLETE for bounded transport gate.** | N0.1/N0.2 evidence; not a distributed shared-database control plane. |
| K3 | Safe coding autonomy: Workcells, writer leases/fences, bounded writes, validation, review, commit/merge authorization. **COMPLETE for bounded safe-coding gate.** | K3.0–K3.8 evidence; arbitrary shell, main-checkout writes and deployment remain outside the contracts. |
| K4 | Event-driven autonomy, scheduler/EventSources, dynamic workers, K4 admission/reservation/assignment/dispatch, live autonomy closure. **COMPLETE; release gate closed.** | K4.3-B closure evidence; full-suite history includes three unrelated timing failures in the earlier baseline. |
| K5 | Supervisor-owned organization plans, deterministic DAG delegation, K4 worker execution, structured evidence, auditor gate and final result. **COMPLETE.** | K5-A/K5-B/K5-C evidence; bounded three-worker mock fixture, no unrestricted Jarvis reasoning. |
| U0 | Canonical durable Agent Mode Console projection, detail, guarded controls, operator session, resources, attention/notifications and phase-exit audit. **COMPLETE; exit gate passed.** | U0-A–U0-G evidence; Console remains an observer over Brain authority. |
| V0 | Jarvis voice transport, bounded local STT, deterministic response generation, interruptible browser speech and voice-gateway exit audit. **COMPLETE.** | V0-A/B/C/C1/C2/D evidence; wake word and richer speech/product behavior remain deferred. |
| D0 | Portable configuration, bootstrap, package/install/service descriptors, StateStore relocation and offline cutover/recovery. **COMPLETE; exit gate passed.** | D0-A–D0-F evidence; no live VPS/Tailscale deployment or multi-user distribution claim. |
| H0 | Fault matrix, wall-clock soak, security review, structural absent-capability classification, disposable provider outage/recovery and remote host-loss acceptance. **COMPLETE; release gate passed.** | H0-G2 final evidence; bounded disposable resources were destroyed and zero remained. |

## Stable architecture and security boundary

The durable authority is one Brain StateStore/control plane. `Agent` owns the
root/parent lifecycle; `Task` is the bounded unit of work; `Run` owns an
execution lifecycle; and `Attempt` owns one admitted execution/effect path.
K5 adds only organization plans, work-item ownership/dependency bindings and
organization aggregation receipts above K4. Scheduler/EventSources produce
bounded intents; K4 owns admission, child creation, concurrency, budgets,
leases/fences, cancellation, deadlines, uncertainty, runtime dispatch,
receipts and settlement. The external-effect journal and durable receipts are
the replay/reconciliation authority.

Reviews/approvals and operator controls are Brain-owned durable decisions.
Attention/escalation and notifications are bounded projections with
operator-scoped read receipts. Jarvis has durable root ownership plus typed
voice intake/response seams; it is not the kernel and does not run an
unbounded reasoning loop. `NodeTransport` delivers the same BrainNode
command/receipt envelope to local or remote nodes. BrainNode is a generic
capability boundary, and Workcells are fenced repository-scoped execution
resources. `ModelGateway` is the admitted model seam; `ExecutionResource` is a
descriptor, not another control plane. Console projections are request-time
observers, and D0 relocation moves logical StateStore state rather than
copying a live SQLite WAL.

Security boundaries proven by H0 are: Brain policy is the authority; roles do
not grant runtime/model/capability authority; restricted Harness composition
has no production tool or sandbox injection; provider outage and remote host
loss were exercised only in exact disposable boundaries; SSM-backed remote
transport used read-only `repo.read`; no inbound SSH, repository write,
provider fallback, shared IAM mutation, or production resource was used; and
all disposable resources were destroyed. The release claim does not include
arbitrary tools, unrestricted shell/filesystem access, public deployment,
multi-user identity, HA, or general fleet operations.

## Release claim classification

### Proven

- A durable, bounded Agent Mode control plane exists through K0–K5.
- A supervisor can organize and execute a three-worker dependency-gated goal
  through K4, then reconstruct ownership, cost, evidence and final result.
- Console state is reconstructed from Brain StateStore/observer data, with
  bounded APIs, guarded local operator controls, attention metadata and no
  browser authority.
- Typed Jarvis/voice transport and deterministic response boundaries compose
  with the same durable contracts.
- Portable Core/package/install/relocation contracts and an isolated cutover
  drill pass.
- The H0 source-enumerated hardening classes satisfy their required evidence,
  including live provider outage/recovery and remote host-loss reconnect.

### Supported but not broadly proven

- A personal, single-controller deployment can use the portable contracts;
  H0 is not a multi-region, HA, fleet-scale or unattended release SLO.
- Remote BrainNode operation is proven through the bounded SSM/SSH transport
  and read-only acceptance, not every network, host, topology or provider.
- Provider/model behavior is proven at the admitted seams and bounded
  MiniMax acceptance path; it is not a broad reliability claim for every
  model, quota, region or commercial account.
- Workcell/repository execution is bounded and policy-gated; it is not an
  unrestricted coding/deployment platform.

### Deferred

- Production-grade release promotion, upgrade/rollback, backup/restore,
  monitoring, incident response, cost operations, support, versioning and
  migration procedures.
- Rich conversational Jarvis intake/task synthesis, wake-word UX and broader
  voice/product behavior.
- VPS/Tailscale deployment, multi-user identity, public distribution and
  fleet provisioning.
- Alternative StateStore backends, AgentCore adapters, extension/plugin SDK,
  and additional packaged BrainNode targets.

### Out of scope

- Unrestricted autonomous CEO/Jarvis reasoning or model-authored authority.
- A second Task/Run/Attempt/result/budget ledger, browser-side authority,
  arbitrary shell/tools/credentials, or public AWS/IAM/SSH expansion.
- Live models, uncontrolled peer chat, generic multi-tenant SaaS, or
  deployment/production mutation as a consequence of this decision.

## Deferred and optional inventory decision

| Item | Decision | Classification |
|---|---|---|
| VPS/Tailscale deployment | Foundation complete; defer until a real always-on/remote deployment need is authorized. Tailscale remains an optional network overlay, not NodeTransport authority. | Optional/product- or platform-driven; not a release blocker. |
| Postgres/DynamoDB or other StateStore backends | Not needed for the current single-controller SQLite reference. Any future backend must pass the StateStore transactional conformance suite. | Optional/platform-driven; not a release blocker. |
| AgentCore runtime/gateway/memory adapters | No adoption decision is required; existing AgentRuntime/ModelGateway/StateStore seams are sufficient. | Optional/adapter-driven; not a release blocker. |
| Extension/plugin SDK | Internal seams and closed registries are sufficient for the current product. A public SDK requires a concrete consumer and security review. | Product-driven; defer, not a foundation gap. |
| More BrainNode packaging | Current generic protocol and portable package boundary are sufficient for the proven scope. Add a target only for a concrete supported host/capability. | Platform-driven; not a release blocker. |
| Other-user distribution improvements | D0 proves the lean portable boundary, not polished commercial distribution/support. Improve when another-user adoption is authorized. | Product/operations-driven; not a missing Agent Mode foundation. |

No deferred item justifies inventing another foundation phase now.

## Product, operational and distribution gap audit

Product gaps are separate from completed contracts: a richer human-facing
conversational Jarvis intake that turns intent into a bounded root/task plan;
polished task creation and organization UX; richer voice and eventual wake-word
behavior; deeper Console drill-down/polish; and any future specialist/fleet
experience. K5 workers, dependency gating, reviews, evidence, attention and
the Console observer/control boundaries are already complete and must not be
reimplemented. Notifications/escalations exist as durable bounded state;
future work is experience/coverage expansion, not a second notification store.

Operational gaps are release lifecycle concerns: signed/versioned release
promotion, upgrade compatibility, rollback, consistent backup/restore of the
StateStore plus referenced evidence, retention/redaction, monitoring and
alerting, incident/support procedures, cost reporting, migration policy and
release-version support. These are the correct next work category after H0.

Distribution gaps are optional scale/product decisions: public or multi-user
identity, VPS/Tailscale deployment, fleet provisioning, HA and backend scale.
The current local operator/session and server-to-server HMAC boundaries are
appropriate for the proven loopback/single-operator scope; they are not
multi-user IAM. Ory/Clerk integration should be selected only when a real
multi-user product is authorized.

## Specific architecture decisions

- **Multi-user IAM:** defer. The current fallback operator/session and
  server-to-server identity remain bounded; do not relabel them as a
  multi-tenant identity system.
- **Distributed control plane:** defer. Keep one active controller and local
  SQLite; remote nodes exchange commands/receipts through the existing
  transport. Do not share WAL or add consensus prematurely.
- **StateStore backend:** keep SQLite as the reference. Future Postgres,
  DynamoDB or another backend is optional and must prove transactional
  semantics, exact-once/recovery, leases and foreign-key behavior.
- **AgentCore:** optional adapter only; it must never own Brain policy,
  budgets, leases, organization, or result authority.
- **Extension/plugin SDK:** defer public packaging. Keep closed Brain-owned
  registries and explicit seams until a concrete extension contract exists.
- **Workcell:** foundation complete. Extend only for an explicitly authorized
  capability/product need; do not create a second repository control plane.
- **Jarvis:** keep deterministic root/task/voice/response contracts. Future
  intake UX may consume them, but Jarvis does not become kernel authority or
  an unrestricted LLM loop.
- **Console:** U0 is complete. Continue as read-only/guarded observer product
  iteration over Brain APIs; do not add browser authority or duplicate ledgers.
- **Model policy:** retain cloud-only text policy with Brain-owned
  Auto/MiniMax → GLM → Opus quality escalation and separate manual/quota-aware
  Codex. No new provider or automatic fallback is required by this decision.

## Candidate directions

| Candidate | Problem / user value | Architecture and security | Migration/dependencies | Exit shape | Why not choose now |
|---|---|---|---|---|---|
| **1. NO NEW FOUNDATION PHASE / RELEASE-MAINTENANCE MODE** | Turn proven contracts into a supportable release while allowing product work by need. Highest immediate value is reliable operation and honest claims. | Preserve all K0–H0 contracts; no new authority or ledger. | Ready now; uses D0/H0 artifacts. | One bounded release-operations drill and a maintained support/version policy. | Chosen; it is a posture, with tasks authorized individually. |
| **2. Public multi-user/distributed control plane** | Serve multiple operators and remote always-on use. | Requires IAM, tenancy, revocation, distributed ownership and stronger state/backend guarantees. | Needs an actual multi-user product and backend/HA requirements. | Authenticated tenant-isolated control plane with recovery/ops SLO. | Too large and not required by current release evidence. |
| **3. Jarvis product/intake experience** | Make Brain easier to use through structured text/voice intake and task creation. | Must preserve deterministic root/task admission and no model-authored authority. | Depends on product UX decisions, not new kernel primitives. | Bounded intake creates an auditable root/plan and renders deterministic results. | Valuable, but should be a product slice after release baseline, not a new foundation phase. |
| **4. Platform/backend ecosystem** | Add VPS/Tailscale, alternate StateStore, AgentCore and public plugin surfaces. | Raises deployment, tenancy, compatibility and extension attack surface. | Needs concrete platform demand and conformance work. | One supported platform/backend/extension with security and recovery evidence. | Optional/platform-driven; no current user or release blocker requires it. |
| **5. More autonomy/capability expansion** | Broaden tools, models, repository writes or autonomous worker behavior. | Highest authority and security risk; would invalidate/reopen H0 assumptions. | Requires new explicit capability and acceptance gates. | New bounded capability with fresh security/live evidence. | Explicitly outside the completed foundation and not justified now. |

## Weighted decision score

Scores are 1–5, where higher is better. “Security risk inverse” and
“implementation cost inverse” therefore reward lower risk and lower cost.
Weights emphasize immediate user value and urgency while still requiring
architectural continuity and dependency readiness: value 25%, urgency 15%,
architectural leverage 15%, security risk inverse 15%, implementation cost
inverse 10%, roadmap continuity 10%, dependency readiness 10%.

| Candidate | Value | Urgency | Leverage | Security inverse | Cost inverse | Continuity | Dependencies | Weighted score |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| No new foundation / release-maintenance | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5.00** |
| Public multi-user/distributed control plane | 4 | 2 | 5 | 2 | 1 | 3 | 1 | 2.85 |
| Jarvis product/intake experience | 5 | 3 | 4 | 4 | 3 | 4 | 4 | 4.00 |
| Platform/backend ecosystem | 3 | 2 | 4 | 2 | 1 | 3 | 1 | 2.45 |
| More autonomy/capability expansion | 3 | 1 | 3 | 1 | 1 | 1 | 1 | 1.80 |

The selected direction scores highest because the foundation and its security
gates are already complete, while the next material risk is operating and
supporting releases honestly. Product/intake work remains viable, but it is
not a reason to create a new kernel phase. Multi-user, distributed, backend,
AgentCore, plugin and broad autonomy candidates remain deferred until concrete
demand supplies their missing requirements.

## Selected direction and exact next task

**Selected direction:** `NO NEW FOUNDATION PHASE / RELEASE-MAINTENANCE MODE`.

The exact next bounded task is:

> **Agent Mode release-maintenance baseline — signed release promotion with
> consistent backup/restore and rollback drill.**

That task should define one supported release artifact/version, verify package
provenance, take a consistent StateStore-plus-evidence backup, perform an
isolated upgrade/rollback rehearsal, verify schema/receipt/lease/uncertainty
compatibility, and document monitoring/incident/cost/support handoff. It must
not change Agent/Task/Run/Attempt/K5/K4 authority or start a new foundation
phase. It is not started by this decision.

## Validation and final decision

- `git diff --check`: required for the decision commit and must pass.
- Consistency checks must treat the dated H0-A–H0-G entries as historical and
  confirm that current status blocks state H0 complete, no post-H0 successor
  phase, and the selected maintenance direction.
- No implementation, provider call, network operation, deployment, or
  protected-path mutation is part of this decision.

**Final decision:** foundational roadmap complete through H0; transition to
release-maintenance mode; do not start the exact next task automatically.
