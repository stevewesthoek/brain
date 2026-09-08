# Brain Agent Mode Runtime Roadmap

**Status:** authoritative direction; principal review approved with changes; A0.2/A1 offline gates plus K0.1–K0.4 fixture gates passed; K0 is complete for the offline kernel and live execution remains gated
**Created:** 2026-09-08
**Discovery report:** `operations/reports/agent-mode-discovery-2026-09-08.md`
**Principal review:** `operations/reports/agent-mode-astra-review-2026-09-08.md`
**Relationship to Infinite Brain:** sibling runtime lane; does not rewrite or
reopen the completed Infinite Brain stabilization roadmap

## Authority and guardrails

This roadmap governs Brain-owned durable agent execution. It does not change
Mind authority, approve production writes, authorize AWS billing, or authorize
unrelated destructive host cleanup. The personal deployment ships first, but
core Agent Mode must remain portable to another macOS/Linux host or a future
VPS by configuration/adapters rather than host-specific domain code.

Hard model policy for this lane:

```text
MiniMax M2.5  →  GLM-5  →  Claude Opus 4.6
worker            senior      principal
```

No silent model substitution is permitted. The ladder is policy, not a forced
failure chain: known difficult work may start at GLM-5 and principal/high-risk
work may start at Opus 4.6.

Codex is a separate ChatGPT-subscription-backed execution runtime, not a
Bedrock tier. Automation defaults to Bedrock because the grant is the primary
high-volume resource. Automatic Codex use is quota-aware and must preserve a
configurable manual-use reserve. Unknown/stale quota evidence denies automatic
Codex admission; executable availability is not subscription headroom. An
explicit human override must be bounded and recorded, never an implicit fallback.

Target text-LLM policy is cloud-only. Ollama, MTPLX/Qwen local text routes,
oMLX text-model serving, LM Studio text-model residue, local text-model
weights/caches, stale launchers, and current operational references are cleanup
targets after exact dependency checks. Video Orchestrator will use cloud text
inference when resumed; its previous oMLX dependency is not a retention reason.
This does not automatically remove unrelated speech/image/video capabilities.

Jarvis may eventually create worker identities autonomously, but deterministic
Brain policy must cap templates/roles, capabilities, budget, TTL, spawn depth,
concurrency, repository scope, and kill switches.

## North-star architecture

```text
human / voice / Brain Console / CLI
               ↓
      Jarvis executive agent
               ↓
   deterministic Brain control plane
 tasks · events · scheduler · leases · budgets
 approvals · recovery · nodes · capabilities
               ↓
        AgentRuntime seam
        ↙             ↘
 harness runtime     Codex CLI runtime
        ↓
      ModelGateway seam
        ↓
 native amazon-bedrock  ←→  optional OmniRoute/future gateways
        ↓
 MiniMax M2.5 / GLM-5 / Claude Opus 4.6

 capabilities → generic BrainNode protocol → Office / MacBook / future VPS
```

Jarvis is not the kernel. Jarvis decides and delegates; deterministic Brain
infrastructure enforces leases, budgets, permissions, retries, scheduling,
idempotency, recovery, spawn limits, and audit.

The durable Brain store is authoritative for Agent Mode state. CLI/harness
sessions, provider logs, Console state, generated summaries, and AgentCore
resources are attached evidence/observer surfaces.

Executable seams are `StateStore`, `ModelGateway`, `AgentRuntime`,
`CapabilityProvider`, and a thin `NodeTransport`. `ExecutionResource` and
`BrainNode` are descriptors, not additional orchestration services. Reference
existing infrastructure resource/account/runtime-profile/credential IDs; do not
create a parallel infrastructure identity registry.
SQLite WAL is the first `StateStore`, not the architecture itself. Office is the
first BrainNode deployment; MacBook is the second instance of the same protocol,
not a separate worker architecture.

The legacy `claude-bedrock` name must not remain the generic Bedrock provider.
The target identity is `amazon-bedrock`, with Anthropic,
MiniMax, and Z.ai model/vendor metadata kept separately. A temporary compatibility
alias is allowed only during staged migration.

## Execution and recovery invariants

These are admission requirements from K0 onward, not deferred hardening:

- Brain is the sole authority for routing admission, retry/escalation budgets,
  capability grants, scheduling and child creation. Jarvis uses the same gates.
  Skills and tool descriptions convey procedure, never permission.
- For runtimes delegating model routing, every model call (including compaction,
  titles and runtime retries) must pass an admitted route and budget boundary.
  Opaque subscription runtimes such as Codex are admitted at the whole-attempt
  resource boundary; declare unavailable controls and deny tasks requiring them,
  rather than claiming per-call enforcement the interface cannot provide.
  Every tool/side effect must pass the
  capability broker or an equivalently enforced node perimeter. Disable hidden
  shell/filesystem/code-mode/subagent/scheduler paths until conformance proves
  them bounded. Runtime plugins and a filesystem sandbox alone are insufficient;
  isolate credentials, read scopes, network egress and descendant processes too.
- Atomically claim work, reserve aggregate budget, acquire a fenced lease and
  record a dispatch outbox entry before execution. Each effect has a stable
  operation ID, scope/input hash, policy/grant version, deadline and receipt.
  Receipt deduplication, task transition and event append share a transaction.
- After a timeout/crash, reconcile the same operation ID. Unknown external
  outcomes remain `uncertain` until verified; never blindly replay a possible
  successful effect. Lease expiry alone does not stop a writer: the node must
  reject stale fencing tokens and stop/reconcile the old process before reuse.
- `StateStore` exposes transactional domain operations, not a promise that any
  key-value backend is interchangeable. Fail closed on state-write failure.
  Use one active controller and its local SQLite database first; remote nodes
  exchange commands/receipts, never share the WAL database over a network mount.
- A minimal authenticated local node envelope ships in K0, before live K2.
  The same envelope gains a remote transport in N0. Bind resource/worktree IDs
  to canonical roots in node-local configuration; do not trust model paths.

## External project adoption policy

Research references:

- DeepSeek Harness: https://github.com/deepseek-ai/deepseek-harness
- OmniRoute: https://github.com/diegosouzapw/OmniRoute
- Orca: https://github.com/stablyai/orca
- Omarchy: https://github.com/omacom/omarchy

Do not reinvent mature mechanisms without first evaluating an adapter. DeepSeek
Harness is the strongest runtime architecture reference: plugin capability seams,
append-only/replayable model-visible sessions, swappable LLM/tool/storage/shell/
sandbox/scheduling/subagent providers, and headless/SDK modes. It is also a
fast-moving developer preview, so Brain must not hand it task/policy/budget/lease
authority or couple directly to its internal schemas. Principal decision:
**USE PARTIALLY** through an explicitly restricted, pinned SDK composition if
A0 conformance passes. Neither the default nor `sdk-minimal` profile is admitted
as-is. No Harness-owned organization, task scheduler or autonomous subagents in
the first slice; its session trace is evidence, not Brain's effect journal.

OmniRoute is the strongest routing/gateway reference: provider executors,
quota/cost/health/headroom routing, circuit breakers, telemetry, model catalogs,
remote mode, and current Bedrock support. It must not become Brain's mandatory
router or policy source in v1. Native Bedrock remains the reference gateway for
the three-model portfolio; an optional OmniRoute adapter may be benchmarked
behind the same `ModelGateway` seam. Its current Bedrock executor uses bearer-key
authentication, not Brain's ambient AWS credential-chain contract. A future
adapter must prove auth and tool/reasoning/usage fidelity and disable competing
fallback/ranking policy. An OmniRoute prototype is not an A0 exit dependency.

Orca is the strongest fleet/worktree UX reference. Borrow isolated worktrees,
reconnectable terminals, remote-node parity, usage visibility, diff review, and
notifications. Brain Console remains the control plane. Omarchy is an OS/product
experience reference: borrow provider neutrality, lazy agent launchers, skills,
and event-to-agent workflows, not its Linux-specific platform architecture.

All four reviewed projects are MIT-licensed at this review point. Any vendoring,
forking, or copied source still requires a pinned upstream/license record.

## Phase C0 — cloud-only local text-LLM cleanup

**Status:** approved direction; execute only after exact dependency/path checks
on each host and explicit cleanup authorization.

- remove Ollama application/service/state when dependency-free;
- remove oMLX text-serving runtime and its Gemma text model after disabling the
  old Video Orchestrator local-text dependency; VO will use cloud LLMs when resumed;
- remove MTPLX/Qwen local tooling, broken Qwen launcher, local Aider/MTPLX config,
  and owned local text-model caches;
- remove LM Studio text-model residue when dependency-free;
- remove current operational local-text provider routes, launchers, labels, and
  documentation; preserve useful history only when clearly historical;
- repeat the same manifest-driven cleanup on MacBook after connectivity and
  read-only inventory succeeds;
- do not delete unrelated speech/image/video model assets in this phase merely
  because they use MLX; never delete a mixed Hugging Face cache wholesale.

Exit gate: no Brain-managed local text LLM can be selected or launched, current
scripts/docs agree, reclaimed storage is recorded, and rollback/reinstall notes
exist.

## Phase A0 — minimal contracts and runtime admission spike

**Status:** A0.1 offline contract/fixture gate passed; A0.2's restricted
ephemeral overlay passes the real SDK read-only, denied-shell, single-provider,
cancellation, and crash-after-effect reconciliation checks. Upstream
`sdk-minimal` adoption is denied because its base profile is danger-full-access
with shell/filesystem/jobs. Durable effect journaling remains a K0 StateStore
responsibility. A1.1 canonical provider identity migration and A1.2 selector /
access-evidence separation pass their offline gates.

Draft only the versioned contracts exercised by one bounded attempt: stable
agent/task/run/attempt IDs, route/resource descriptors, capability command and
receipt, policy/grant reference, budget reservation, lease fence, cancellation,
event/evidence references and transactional StateStore operations. Keep the
larger agent organization/spawn schema provisional until its phase needs it.

Run a bounded non-production integration spike:

- DeepSeek Harness restricted SDK: prove one Brain-shaped mocked attempt with
  one admitted model route, one read-only tool, correlated session trace and
  cancellation. Prove denied built-in/indirect tools, model overrides, auxiliary
  LLM calls, child spawning and schedules cannot bypass Brain admission;
- verify exclusive session-per-attempt correlation, process-tree cancellation,
  duplicate receipt handling and crash-after-effect-before-receipt behavior;
- verify its native Bedrock route shape for the three target models without
  billable use unless separately admitted;
- document OmniRoute's future adapter shape and auth/fidelity constraints only;
  defer an executable adapter until a concrete routing need exists;
- pin evaluated upstream versions/commits and record adopt/adapter/idea-only
  decisions.

Exit gate: pin the first runtime composition and tested contract subset, keeping
native Bedrock as the reference gateway. Adopt the reusable Harness loop/tool/
context/session mechanisms only if they meet the enforced boundary. If the
bounded spike fails, record the failing gate and choose a minimal Brain runtime
without growing an indefinite upstream fork. Installation/activation still
requires the normal discovery and approval workflow; no live credentials needed.

## Phase A1 — Bedrock/provider normalization

**Status:** staged after A0, alongside fixture-only K0; billable probes require separate admission.

- migrate generic provider identity from legacy `claude-bedrock` to
  `amazon-bedrock` without breaking active consumers;
- separate transport/provider identity from vendor/model identity;
- add MiniMax M2.5, GLM-5, and Opus 4.6 exact registry entries with model IDs,
  inference profiles, region, API/tool compatibility, context/output limits,
  cost metadata, and lifecycle state;
- remove local-text providers from admitted selector policy;
- make route selection pure: filter lifecycle, scope and allowed models before
  using cached access evidence; never invoke an access probe during selection;
- scope access/health evidence by account/credential identity, region and exact
  model/profile binding with freshness; disable exploratory selection for this
  fixed portfolio; distinguish transport retry from a new semantic attempt;
- run approved small-output access probes and persist redacted evidence;
- add capability/tool-call shape tests and budget reconciliation;
- migrate `repos.sh` and `sessions.sh` away from Qwen/Haiku/provider coupling;
  keep `jump.sh` navigation-only;
- preserve product-specific Mind/Video policies as policy overlays rather than
  provider identities.

Exit gate: generic Bedrock code has no Claude-specific provider semantics; each
of the three target models is independently representable and any unverified
model fails closed rather than being silently replaced. New K0 records use only
canonical IDs from the outset. A compatibility mapper protects existing
consumers; a repository-wide rename and separately approved paid access checks
do not block fixture persistence. Agent Mode's A1 consumer migration must pass
before K1/K2 live admission; private Mind and other product overlays stay intact.

## Phase K0 — durable kernel and one-Jarvis/one-worker fixture slice

**Status:** complete for the offline fixture/kernel slice; live execution remains separately gated
**Safety:** fixture-backed, local-only, no live billable model call

**K0.2 status:** complete. The SQLite StateStore now durably journals task/run/
attempt admission, run-scoped budget reservation/settlement, fenced leases,
effect preparation and dispatch outbox state, receipts, cancellation and
deterministic crash recovery. The later K0.3 node and K0.4 observer/runtime
boundaries are intentionally recorded as separate sub-slice evidence.

**K0.3 status:** complete for the local fixture slice. A portable, non-listening
BrainNode command/receipt envelope now authenticates a deterministic local
provenance seam, binds installation-local resource IDs to canonical roots,
enforces one bounded `repo.read` capability, independently checks grants,
scope, policy, deadline, cancellation, lease fencing, and K0.2 outbox state,
and reconciles durable receipts. K0 remains fixture-backed and live execution
remains gated.

**K0.4 status:** complete. A deterministic mock `AgentRuntime` exercises an
admitted attempt through typed capability mediation, BrainNode, durable receipt
reconciliation, verification, budget settlement, terminal attempt state, and
StateStore reopen. Runtime bypasses and crash recovery fail closed. A versioned
read-only StateStore observer projection is exposed through Brain Core while
legacy approval/snapshot surfaces remain explicitly compatibility data. Empty
state observation creates no database or directory and does not mutate state.

Deliver:

- versioned Agent Mode types for agent, task, run, attempt, event, lease,
  budget, capability, session, result, and evidence;
- a `StateStore` contract with SQLite-WAL as the first implementation;
- append-only execution/event history plus transactional query projections;
- stable Jarvis identity and one worker identity;
- mocked model/runtime adapters and deterministic escalation fixtures;
- local BrainNode descriptor/command/receipt envelope and read-only capability
  execution in a known worktree through the admitted boundary;
- repository lease acquisition/release and restart recovery;
- atomic claims, budget reservations, lease fencing, dispatch outbox and receipt
  deduplication; per-effect checkpointing and explicit uncertain-outcome recovery;
- deterministic verification and redacted evidence;
- Brain Core read-only routes and Console observer projection;
- tests for restart, duplicate replay, lease conflict, budgets, escalation,
  Codex separation, agent-spawn limits, and failure recovery.

Exit gate: focused kernel/adapter compatibility tests remain green; crash,
disk-write failure, stale writer, duplicate dispatch, cancelled descendant and
denied capability fixtures fail safely. K0.1–K0.4 evidence proves the offline
gate. No LaunchAgent or live-provider change is part of K0.

## Phase K1 — model/resource gateway

**Status:** in progress. K1.1 is complete; K1.2 remains planned. Live/billable
probes remain separately admitted per sub-slice evidence.

**K1.1 status:** complete for the native Amazon Bedrock ModelGateway and
identity/region/route-scoped access gate. MiniMax M2.5, GLM-5, and Claude Opus
4.6 were verified against the current AWS catalog/model cards in `us-east-1`.
One tiny authorized Converse probe was completed for each target, with
redacted evidence recorded in
`operations/reports/agent-mode-k1-1-evidence-2026-09-08.md`. The gateway is
admitted-only, transport-swappable, deadline-bounded, and normalizes final
text/usage without leaking MiniMax reasoning content. Selection remains
disabled until K1.2 defines tier policy. K1.2 and K2 were not started.

- implement native `amazon-bedrock` ModelGateway support for MiniMax M2.5,
  GLM-5, and Claude Opus 4.6;
- record usage/cost/evidence independently from AgentRuntime state; preserve
  tool IDs, stop reasons, streaming cancellation, request IDs and necessary
  versioned provider replay data rather than flattening responses to text;
- implement deterministic model-tier admission based on task class, complexity,
  context need, previous attempt evidence, safety class, budget, and health;
- define and fixture-test Codex CLI as a separate ExecutionResource/AgentRuntime
  with observable `available | constrained | exhausted | unknown` quota state;
  actual coding execution is admitted in K3, not a K2 prerequisite;
- default autonomous work to Bedrock and preserve a configurable Codex manual-use
  reserve; stale/unknown quota denies automatic admission;
- disable Bedrock-error-to-Codex fallback for Agent Mode; resource switches need
  new admission, not a second provider loop;
- keep OmniRoute optional and deferred until its benefit and conformance are proven.

Exit gate: unavailable models fail closed, cost/quota state is observable, and
Codex is never mislabeled as a Bedrock tier.

## Phase K2 — one Jarvis + one worker live vertical slice

**Status:** planned after A0/A1/K0/K1

Prove exactly one Jarvis identity and one worker can:

1. survive restart;
2. receive and persist a bounded task;
3. select runtime/model through policy;
4. acquire approved capabilities and a repository/worktree lease;
5. execute one admitted attempt;
6. respect budget, wall-clock, retry, and tool-step limits;
7. verify result/evidence;
8. recover from a bounded failure;
9. escalate model tier when policy justifies it;
10. report the durable result to Jarvis;
11. expose task/run/attempt/event state through Brain Core/Console observers.

Use the AgentRuntime selected in A0. Do not build a second generic agent loop if
an adopted runtime already safely supplies that behavior.

Bound the live slice to one task class, one worker, one admitted read-only
capability and one accessible target model. Test escalation, write denial,
Codex separation/quota policy and crash paths with fixtures; a paid all-model
matrix and automatic Codex run are not K2 prerequisites. Missing model access
is shown explicitly, never substituted. Ship minimal intake, inspect, pause,
cancel/kill and approval visibility before unattended live use; fleet UI waits
for U0. Reuse the local node envelope delivered in K0.

## Phase N0 — generic Brain Node

**Status:** planned local envelope in K0; remote-node extension after K2.

- extend the local portable node envelope with authenticated remote commands,
  receipt replay, protocol/capability negotiation and reconnect recovery;
- reference existing infrastructure resource/runtime-profile identities; keep
  live enrollment/admission in Agent Mode without duplicating catalog authority;
- use the identical domain contracts/config model on MacBook when reachable;
- keep local and SSH request/receipt transport behind NodeTransport; Tailscale
  is a network overlay and VPS a deployment location, not transport types;
- admit only explicit least-privilege capabilities and produce receipts;
- keep host names, usernames, absolute paths, and private topology out of core
  Agent Mode schemas.

Exit gate: the same bounded worker task can target either admitted node without
application-code forks, and node loss/reconnect fails safely.

## Phase K3 — safe coding autonomy

**Status:** planned after K2 and N0

- isolated Git worktrees for parallel coding workers;
- one active writer lease per worktree, with multiple safe read-only workers;
- fence stale writers at the node, distinguish shared-repository Git/ref
  mutations from worktree-local edits, and revalidate dirty state/preimages;
  parallel readers use a pinned revision or report snapshot drift;
- Bedrock- or Codex-backed coding execution selected by policy and quota state;
- deterministic validation before result admission;
- diff/evidence capture and explicit commit/merge approval boundaries;
- stale-worktree and stale-lease cleanup rules.

Exit gate: two bounded coding workers can operate concurrently without sharing a
write surface, and failed validation cannot silently promote a result.

## Phase K4 — event-driven autonomy and dynamic workers

**Status:** planned after K3

- scheduler, heartbeat, repo/CI/host/task event sources, and dead-letter state;
- no-op heartbeats that do not invoke a model when no useful action exists;
- Jarvis may create bounded worker identities through `AgentSpawnPolicy`;
- enforce role templates, parent ownership, TTL, spawn depth, concurrency,
  repository scope, capability ceilings, budgets, cancellation, and kill switches;
- prevent recursive or unbounded agent spawning and free-chat loops.

Bound the entire root goal as well as each child: total creations (including
retired/recreated children), aggregate spend/steps, event redelivery and deadline.
Use causation/deduplication IDs, source watermarks, debounce/cooldown and bounded
catch-up. Parents release worker slots/write leases while awaiting children;
acquire multiple resources in a stable order. Cancellation reaches every child,
runtime and node operation. The scheduler remains deterministic Brain authority.

Exit gate: Jarvis can safely create, assign, observe, and retire bounded workers,
and autonomous activity remains inspectable, budgeted, interruptible, and
restart-safe.

## Phase K5 — multi-agent organization

**Status:** planned after K4

Initial logical roles:

- Jarvis / CEO;
- Engineering;
- Research;
- Operations;
- Memory / Archivist;
- Independent Auditor.

Agents communicate through structured tasks, events, results, evidence, review
requests, and escalations rather than unconstrained conversations. Model/runtime
selection remains policy-driven and independent from agent identity.

Exit gate: one supervisor can delegate a multi-step bounded goal to several
workers and reconstruct ownership, cost, evidence, dependencies, and final result.

## Phase U0 — unified Brain Console control surface

**Status:** planned after durable agent state is proven

Borrow Orca-like fleet/worktree/usage/notification patterns while keeping Brain
Console as the primary control/dashboard surface. Show Jarvis intake, agent
hierarchy, tasks/runs/attempts, node/worktree/runtime/model, budgets and Codex
quota state, approvals, evidence, schedules, failures, escalations, and unread
notifications. Obsidian/Mind, IDEs, CLIs, and optional Orca-like specialist
surfaces remain complementary tools over the same Brain APIs/events.

Exit gate: UI state is fully reconstructible from durable Brain state and never
becomes a competing source of truth.

## Phase V0 — Jarvis voice gateway

**Status:** planned after U0 foundations; local non-text inference remains allowed

- microphone / push-to-talk / future wake-word input;
- speech-to-text transport into Jarvis;
- interruptible Jarvis conversation and explicit voice approval semantics;
- text-to-speech output;
- only Jarvis normally speaks to the user;
- worker messages remain structured Brain events summarized by Jarvis.

FluidVoice is an active personal voice capability and is explicitly retained.
MLX Whisper remains retained while the scheduled Bible Studies transcription
pipeline consumes it. Voice/transcription providers remain separate capability
policies from the cloud-only text-LLM policy.

Exit gate: voice is a transport over the same durable Jarvis/task/control-plane
contracts and can be replaced without changing agent identity or orchestration.

## Phase D0 — distribution and always-on options

**Status:** planned after the personal deployment is stable

- portable configuration profiles separating personal integrations from core;
- installer/bootstrap for another user;
- macOS and Linux Brain Node packaging;
- optional VPS/Tailscale control-plane deployment;
- future StateStore backends such as Postgres/DynamoDB;
- optional AgentCore runtime/gateway/memory adapters;
- migration/export/import semantics and extension/plugin SDK.

Exit gate: another user can deploy the lean core without Office/MacBook-specific
code or personal paths, and the control plane can later move off the Office Mac
without changing the domain model.

## Phase H0 — long-duration hardening

**Status:** final soak/release gate; safety and recovery conformance run in every earlier phase

The relevant H0 soak/security gates must pass before broader unattended or
distributed release, even when D0 packaging work is developed earlier.

Test provider outage, Bedrock budget exhaustion, Codex quota exhaustion, host
loss/reconnect, process crash/restart, stale leases, duplicate events, stuck or
spawning agents, sandbox/tool denial, corrupted sessions, multi-hour autonomous
soak behavior, security, and auditability.

Controlled write capability expansion remains separately approval-gated. Each
new write capability requires exact scope, lease, policy, expiry, rollback,
verification, evidence, and kill switch. Production, credential-sensitive,
financial, deployment, and destructive actions remain outside this roadmap until
separately authorized.

## Local non-text inference classification

The cloud-only decision applies to general-purpose/text LLM reasoning, not to all
local ML capabilities.

Current Office-side evidence classifies the known non-text stack as follows:

| Capability | Current evidence | Consumer | Roadmap treatment |
|---|---|---|---|
| FluidVoice local MLX voice stack | active external process/private model state in discovery inventory; user confirms active use | FluidVoice | **Keep** |
| MLX Whisper `mlx-community/whisper-large-v3-mlx` | explicit `mlx_whisper` invocation plus nightly scheduler path | Bible Studies transcription pipeline | **Keep while consumed**; migrate first if later removed |
| `faster-whisper` | installed in Video Orchestrator environment and referenced by subtitle/transcription worker docs | Video Orchestrator | **Separate media capability**; do not remove in text-LLM cleanup |
| ComfyUI/local image generation | registered on-demand local application plus Video Orchestrator/image-generation references | Video/media workflows | **Separate media capability**; current-use audit before any removal |
| historical local image/video skills/models | repository contains Stable Diffusion/Wave/FLUX/Roop-era references | historical or product-scoped | classify individually before cleanup |

MacBook media state remains unresolved until read-only host inventory succeeds.
Do not infer MacBook absence/presence from Office findings.

Phase C0 may remove only confirmed local **text LLM** dependencies. Any non-text
speech/image/video deletion requires a separate consumer check and explicit
classification. This prevents the oMLX/Gemma cleanup from accidentally sweeping
FluidVoice, MLX Whisper, or other media assets into the same deletion set.

## Required state locations

Configure a private Agent Mode state root outside Git checkouts and synced vaults
(for example through `BRAIN_AGENT_MODE_STATE_DIR`, resolved per installation):

```text
<configured-private-state-root>/
  agent-mode.db
  evidence/
  exports/
```

SQLite is local to one active controller. Database transactions own leases;
ad-hoc lock files are not a second authority. A future VPS can host the same
controller/store with nodes connected by API. Backup/restore must capture a
consistent database and referenced evidence; schema versions, retention and
redaction are required before rollout. A future backend must pass the same
transactional conformance suite, not merely implement generic CRUD.

Do not store authoritative Agent Mode state in the Mind vault. Do not overwrite
the existing `~/.local/video-orchestrator/state` snapshots during migration.
Compatibility readers may project old state until the new store is proven.

## Immediate handoff

The completed slices are A1.1 canonical provider identity migration, A1.2
selector/access-evidence separation, A1.3 provider-neutral repo/session
launchers, K0.1's SQLite foundation, K0.2's durable execution journal,
budget settlement and crash recovery, K0.3's local portable BrainNode
command/receipt envelope with one bounded read-only capability, and K0.4's
mock AgentRuntime plus durable read-only observer projection. K0 is complete
for its offline fixture/kernel gate. K1.1 is complete for the native Amazon
Bedrock ModelGateway and account/model access verification; see
`operations/reports/agent-mode-k1-1-evidence-2026-09-08.md`. The exact next
task is K1.2: model-tier routing, budget, health, and escalation policy. Do not
begin K1.2 automatically; live and billable access remain separately admitted.
A0.2's restricted ephemeral overlay ran through the SDK child-process boundary
and passed the replay-backed read-only, denied-shell, single-provider,
cancellation, crash-after-effect, and reconciliation checks. The shipped
`sdk-minimal` base remains unsafe for Brain adoption because it activates
unrestricted filesystem, subprocess, persistent shell/editor, and jobs rows.
The canonical provider migration must preserve a bounded `claude-bedrock`
compatibility alias and must not invoke live providers. Native
`amazon-bedrock` stays the reference gateway; OmniRoute is not a blocking
prototype. Evidence: `operations/reports/agent-mode-a0-2-evidence-2026-09-08.md`.

After A0, run A1's staged consumer migration alongside K0's fixture-backed
durable kernel/local node envelope. Both must meet their relevant gates before
K1/K2 live use. No billable model probe, AWS access mutation, host deletion or
provider installation is implied by A0.1 or this review.

The separate C0 local-text cleanup lane may proceed only manifest-first and must
preserve FluidVoice, MLX Whisper, and other separately classified non-text media
capabilities. MacBook cleanup remains blocked until read-only inventory succeeds.
