# Brain Agent Mode Runtime Roadmap

**Status:** authoritative direction; principal review approved with changes; A0.2/A1 offline gates plus K0.1–K0.4 fixture gates passed; K0–N0, K3.0–K3.4, K3.5-A–D, K3.6, and K3.7 are complete for their bounded gates; the K3 exit gate is complete; K4.0, K4.1-A, K4.1-B1, K4.1-B2, and K4.1-C1 are complete, K4.1-C2 is complete, K4.1 is complete, K4.2-A, K4.2-B, K4.2-C, K4.2-D1, K4.2-D2, K4.2-E1, and K4.2-E2 are complete for their bounded gates, K4.2 is complete, K4.3-A is complete for its bounded live acceptance gate, K4.3-B is complete for its closure gate, K4 is complete, K5-A, K5-B, K5-C, and K5 are complete, and U0 is the next planned phase
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
Auto root/planning scout: MiniMax M2.5
quality escalation:       MiniMax M2.5 → GLM-5 → Claude Opus 4.6
execution package:        cheapest capable admitted tier
```

No silent model substitution is permitted. Auto begins every root/planning
admission with MiniMax, including statically senior/principal work. A bounded
quality or validation signal may request escalation, but Brain owns the
decision, budget, quota, and maximum depth. Manual model choices remain
available for expert/debug use and are still policy-gated.

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

**Status:** complete for the offline K1.1/K1.2/K1.3 gates. Live/billable
invocation remains separately admitted; K2.1-R1 live acceptance is now
complete under its separate authorization.

**K1.1 status:** complete for the native Amazon Bedrock ModelGateway and
identity/region/route-scoped access gate. MiniMax M2.5, GLM-5, and Claude Opus
4.6 were verified against the current AWS catalog/model cards in `us-east-1`.
One tiny authorized Converse probe was completed for each target, with
redacted evidence recorded in
`operations/reports/agent-mode-k1-1-evidence-2026-09-08.md`. The gateway is
admitted-only, transport-swappable, deadline-bounded, and normalizes final
text/usage without leaking MiniMax reasoning content. Selection remains
disabled in the legacy selector; Agent Mode selection is now governed by the
Brain-owned K1.2 policy. K2.1 live completion remains separately gated.

**K1.2 status:** complete for the offline policy gate. The fixed ladder is
MiniMax M2.5 → GLM-5 → Claude Opus 4.6, with quality escalation only; provider
failures do not switch resources. All escalations and children reuse the root
`budgetScopeId`. Opus pricing is fail-closed until AWS publishes a usable
current token-rate row.

**K1.3 status:** complete for the human/runtime integration surface. `repos.sh`
and `sessions.sh` always show the model/runtime selector with Auto first and
preselected; their optional five-entry switch is Auto, MiniMax M2.5, GLM-5,
Opus 4.6, Codex; historical
Claude Code launch/resume support remains internal but is not a normal selector
entry. Brain is
the control harness, while DeepSeek Harness is internal optional runtime
machinery, Claude Code and Codex remain specialist runtimes, and Herdr launches
Brain without becoming an authority. Evidence is recorded in
`operations/reports/agent-mode-k1-3-runtime-surfaces-evidence-2026-09-09.md`.

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

**Status:** K2 is complete for the bounded one-Jarvis/one-worker read-only
vertical slice. K2.1-R1 live acceptance and K2.2 operator-control/recovery
gates pass. The original bounded live acceptance remains historical incomplete
evidence; it is not rewritten.

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

### K2.1 historical initial implementation state

The pinned DeepSeek Harness SDK is bootstrapped at commit
`c389f96bf3a9b6807cb71ed6bdad5849be0df6d8` (`0.1.3-alpha.2`) and Brain owns
the restricted child launch, explicit environment, Unix-socket model/tool
bridge, K1.2 MiniMax admission, K0 outbox/lease/receipt path, and durable
`run`/`inspect`/pre-dispatch `cancel` CLI surfaces. Keyless end-to-end tests
prove one child model/tool loop, exactly one BrainNode read, and close/reopen
durability.

The bounded live MiniMax acceptance attempts reached the real route but did not
produce a verified tool call/final response. The transport defect identified
from that evidence (`toolSpec.inputSchema.json`) is fixed and covered
deterministically; no further live attempt is being made in this bounded
tranche. That initial tranche was superseded by the separately authorized R1
acceptance below. K2.2 must not begin without separate authorization.

### K2.1-R1 current implementation state

R1 supersedes the initial-selection semantics without rewriting the historical
K2.1 live report. The versioned policy is now Auto-first: root and planning
admissions always start with the MiniMax M2.5 scout; structured escalation is
an untrusted model intent interpreted by Brain; provider failures do not count
as reasoning failures; completed planning packages receive fresh execution
admission; and escalation depth is bounded. The principal Bedrock Opus resource
remains fail-closed when current dollar pricing is unverified. Codex Astra is a
separate fixture/policy resource only; no Astra or Luna model identifier is
invented or executed.

The normal `repos` and `sessions` paths always open a model/runtime selector
with Auto first and preselected; pressing Enter accepts Auto. `--choose-model`
remains a compatibility alias and `--model VALUE` is available for
non-interactive callers. Both expose exactly `Auto`, `MiniMax M2.5`, `GLM-5`,
`Opus 4.6`, and `Codex`. Selecting a Brain session exposes durable inspect,
pause, resume, cancel, and kill controls, also available through
`brain-agent <action> RUN_ID` from another terminal. The R1 deterministic
policy/selector evidence and the single fresh live acceptance are recorded in
`operations/reports/agent-mode-k2-1-r1-auto-and-live-unblock-2026-09-09.md`.
No other live model, failover loop, remote transport, C0 cleanup, or K2.2 work
is authorized by R1. R1 completion evidence confirms one successful MiniMax
tool-call/final-response path, actual settlement, and reopened observation.

### K2.2 operator controls and process-loss recovery — 2026-09-09

K2.2 is complete. Normal `repos` and `sessions` invocations first show exactly
`Auto`, `MiniMax M2.5`, `GLM-5`, `Opus 4.6`, and `Codex`, with Auto first and
preselected. `--model` is the only non-interactive selector; `--choose-model`
is retained as an alias. Brain session rows expose inspect, pause, resume,
cancel, and kill against durable run IDs.

The StateStore records owned runtime PID plus start-time/command/token identity.
Kill signals only an identity-verified owned `brain-agent`; resume requires the
same check or a new controller re-admission. Normal cancellation is a request
until the controller truthfully acknowledges termination/reconciliation. A
lost controller clears its old lease and classifies the durable effect boundary:
safe work can be re-admitted on the same Task/Run/Attempt lineage with fresh
access evidence, budget checks, and a new fence; uncertain or receipt-pending
effects are never replayed automatically. Ten deterministic controller/runtime
loss fixtures and denial cases are recorded in
`operations/reports/agent-mode-k2-2-operator-controls-evidence-2026-09-09.md`.

N0.2 is complete. The deterministic clock regression, generic enrollment,
cross-process duplicate delivery, truthful reconnect uncertainty, synthetic
macOS/Linux portability, and Office/MacBook parity gates all passed. N0 is
complete for the approved bounded scope. No model call was made for N0.1 or
N0.2.

## Phase N0 — generic Brain Node

**Status:** complete for N0.1/N0.2; K3 is next. Generic local/SSH delivery,
enrollment, bounded reconnect semantics, cross-process deduplication, and
two-node parity are proven without adding write, shell, public-listener, or
daemon behavior.

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

### N0.1 authenticated remote BrainNode transport — 2026-09-09

N0.1 is complete for its bounded scope. `NodeTransport` now supports the local
perimeter and a thin SSH transport using the canonical `host:macbook` /
`node-instance:host:macbook` identities. Negotiation checks protocol, runner
version, identity, health freshness, platform metadata, and exactly `repo.read`.
Commands use node-local HMAC provenance over strict SSH; receipts preserve
lineage, fence, status, and integrity hashes. Disconnects are nonterminal and
reconnect performs a fresh handshake without replay.

The MacBook preflight and one harmless live `repo.read` succeeded, with the
receipt reconciled into the Office StateStore. The runner is short-lived and
uses temporary node-local state; no database is shared or copied. Evidence is
in `operations/reports/agent-mode-n0-1-remote-node-evidence-2026-09-09.md`,
with operating details in `operations/runbooks/agent-mode-node-transport.md`.

### N0.2 generic enrollment, reconnect safety and parity — 2026-09-09

N0.2 is complete. Transport clocks are injectable while production defaults use
the real clock, so deadline validation remains enabled and deterministic. The
generic enrollment type uses opaque configuration-driven identities validated
against trusted resource sets; SSH requires explicit enrollment and the runner
trusts only its node-local configured resource. Synthetic Darwin and Linux
enrollments use the same code without Office/MacBook branches.

The node-local dedup store is a bounded, mode-0600 atomic file containing only
schema version, operation ID, immutable command hash, receipt, and retention
timestamps. Corruption fails closed. Separate runner processes return the same
semantic result for identical operations and reject conflicting replay. A
disconnect before send remains retryable; after send it is represented through
the existing effect-observed-without-receipt recovery state, never as a false
failure or blind replay. Office remains the sole authoritative StateStore.

The same logical harmless read passed through Office local transport and
MacBook SSH transport with identical content, distinct correct identities, and
both receipts reconciled in Office. Full evidence is in
`operations/reports/agent-mode-n0-2-multi-node-evidence-2026-09-09.md` and
operational details are in `operations/runbooks/agent-mode-node-transport.md`.

N0 completion gate: **COMPLETE**. The next roadmap phase was **K3 — safe coding
autonomy**; K3.0 is now complete and K3.1 is the exact next task.

## Phase K3 — safe coding autonomy

**Status:** K3.0–K3.3 foundations complete for their bounded gates; broader autonomy remains separately gated

### K3.0 safe coding Workcell foundation — 2026-09-09

K3.0 adds the first isolated coding Workcell control-plane foundation without
granting direct repository writes. Workcell identity, status, repository
binding, owner, branch, and worktree path are durable in the existing SQLite
WAL StateStore. The only lifecycle actions are `create`, `prepare`, `inspect`,
and `destroy`; merge, approval, deployment, coding agents, shell, and
arbitrary commands remain outside this tranche.

Git access is behind a fixed non-shell adapter with allowlisted repository,
worktree, status, and removal operations. A Workcell target must be an exact
child of an explicitly configured workcells root outside the primary checkout;
generated branches are unique `codex/workcell/<uuid>` branches and protected
branches cannot be selected. Ownership checks prevent another agent from
preparing or destroying a Workcell.

Every lifecycle action records a durable receipt. Creation, preparation, and
destruction use `WorkcellCreatedReceipt`, `WorkcellPreparedReceipt`, and
`WorkcellDestroyedReceipt`; inspection and crash recovery use
`ValidationReceipt`. Receipts carry task/run/attempt/workcell/repository/actor
lineage, timestamp, operation hash, and result state, without secrets.
Interrupted preparation is cleaned up only for an exact target that was absent
before the operation; stale durable rows are detected and can reconcile a
valid Git worktree or fail closed without deleting foreign paths.

The foundation names `repo.read` and future `repo.write(workcell)` only.
`repo.write(main)`, shell, arbitrary process execution, and direct write
commands are not admitted. Full evidence is recorded in
`operations/reports/agent-mode-k3-0-workcell-evidence-2026-09-09.md`.

K3.0 completion gate: **COMPLETE**. At that completion point the exact next
task was **K3.1 — controlled Workcell writer lease, deterministic validation,
and diff/evidence admission**.

### K3.1 active Workcell writer lease, fencing, and diff admission — 2026-09-09

K3.1 is complete for its bounded safety layer. The existing StateStore now
persists Workcell writer lease history with one active lease per Workcell,
owner agent/attempt, expiry, lifecycle status, and monotonically increasing
per-Workcell fence tokens. Active leases cannot be stolen; expired leases can
be replaced; old owners and old fence tokens are rejected at the admission
boundary. Lease grant, release/expiry, and rejected write decisions are
durable and restart-safe.

The `repo.write(workcell)` boundary is admission-only. It requires a prepared
or active/testing Workcell, exact repository/worktree binding, active lease,
matching owner and attempt, and matching fence token. It does not expose an
editing operation, shell, arbitrary process execution, or `repo.write(main)`.

Diff evidence is captured through the fixed Git adapter, including Workcell,
repository, branch, base/current revisions, tracked and untracked changed
files, and a deterministic hash of the complete tracked/untracked diff state.
Validation admission stores the requested validation result and can produce
`validation_ready` only after diff evidence exists; no test runner is invoked.
Writer lease, rejection, diff, and validation receipts include task/run/attempt/
Workcell/lease/fence/timestamp/operation-hash lineage. Full evidence is in
`operations/reports/agent-mode-k3-1-writer-lease-evidence-2026-09-09.md`.

K3.1 completion gate: **COMPLETE**. Exact next task: **K3.2 — bounded
Workcell-local write execution with preimage/snapshot validation**.

### K3.2 bounded Workcell-local text mutation — 2026-09-09

K3.2 is complete for its bounded gate. The single typed primitive is
`workcell.file.patch`, exposed by `WorkcellFileMutationManager`; it modifies
one existing regular UTF-8 text file in an admitted Workcell. File creation and
deletion are intentionally not implemented. The conservative file and
replacement bound is 256 KiB. Binary data, invalid UTF-8, directories, special
files, symlinks, traversal, absolute/Windows paths, reserved metadata/runtime
components, the primary checkout, and another Workcell are rejected.

The primitive resolves the durable Workcell path, then requires exact
`repo.write(workcell)` admission, the current matching writer lease, owner and
attempt, and fence token. The StateStore records an immutable operation before
filesystem effects, expected preimage hash/state, verified preimage hash,
replacement hash, postimage hash, phase, and operation hash. The current file
must still match the expected SHA-256 immediately before atomic rename. Writes
use an exclusive temporary sibling, preserve the existing mode, fsync and
close the temporary file, then rename it over the target. Full content is never
persisted.

Applied, rejected, and reconciled receipts bind task/run/attempt/Workcell,
operation, repository reference, relative target, lease/fence, preimage,
postimage, timestamp, result, and operation hash. Same-operation replay returns
the durable result without rewriting. A crash before rename is classified as
safe to resume; a crash after rename is reconciled from the durable postimage;
postimage drift rejects without overwrite. K3.1 Git diff capture remains the
separate evidence step after a successful write; a write is not validation,
review, commit, merge, or deployment.

The mutation manager uses the existing local StateStore/Workcell writer seam.
It does not add a parallel BrainNode authority or unrestricted CLI; BrainNode's
current envelope remains read-only, so remote/future-node write execution is
explicitly not claimed by K3.2. Portability is provided by the fixed local
filesystem/Git adapter boundary, with no Office/MacBook-specific write branch.
Evidence: `operations/reports/agent-mode-k3-2-workcell-write-evidence-2026-09-09.md`.

K3.2 completion gate: **COMPLETE**. Exact next task: **K3.3 — controlled
Workcell validation with an allowlisted validator registry**.

### K3.3 controlled Workcell validation framework — 2026-09-09

K3.3 is complete for its bounded gate. The typed capability
`validation.run(workcell)` is admitted only for a durable Workcell with exact
repository/worktree binding, an active matching writer lease, owner/attempt,
and current fence token. The existing SQLite WAL StateStore remains the sole
authority and now persists validation lifecycle, evidence, result, and receipt
history; no second database or control plane was added.

`WorkcellValidatorRegistry` contains one built-in profile,
`git.diff.integrity`. Profiles identify a fixed allowed operation, repository
type, timeout, evidence bound, and evidence format; they contain no caller
supplied command, shell text, package script, or executable path. The validator
re-runs the existing fixed non-shell Git diff adapter against the durable
Workcell and compares base/current revisions, changed files, and diff hash to
the latest K3.1 diff evidence. It produces bounded deterministic evidence and
an evidence hash. No arbitrary execution, LLM, coding agent, shell, or package
execution path was added.

Validation emits `ValidationStartedReceipt`, then either
`ValidationCompletedReceipt` with passed/failed evidence or
`ValidationRejectedReceipt` for unknown profile, missing diff, invalid
capability/binding/lease, timeout, interruption, stale, or destroyed Workcell.
Completed and rejected requests are idempotent; a started validation recovered
after interruption is classified as interrupted and cannot become an
ambiguous success. StateStore close/reopen preserves lifecycle and evidence.

K3.3 completion gate: **COMPLETE**. K3.4 is the next bounded gate: the first
real coding worker must exercise the Brain-owned Workcell read → patch → diff →
validation path under the pinned restricted runtime. K4 remains blocked until
K3.4 and K3.5 (concurrent workers plus explicit review/commit/merge authority)
are complete. Evidence:
`operations/reports/agent-mode-k3-3-validation-evidence-2026-09-09.md`.

### K3.4 first bounded live coding worker — 2026-09-09

K3.4 is complete for its bounded gate. The implementation now has one durable Jarvis-delegated
worker identity and one attempt bounded to one disposable Workcell, one active
writer lease/fence, two typed bridge tools (`brain_read` and
`brain_workcell_patch`), three MiniMax-only model turns, and a 768-token model
output ceiling. Brain constructs the Workcell binding, preimage hash, mutation
operation, diff capture, `git.diff.integrity` validation, budget settlement, and
result state. The restricted child receives no filesystem, shell, subprocess,
arbitrary Git, package/test execution, commit, merge, push, or deploy surface.

Deterministic fixtures prove the successful path, main-checkout isolation,
absolute-path rejection, failed validation non-promotion, durable restart
state, and observer visibility. One authorized MiniMax M2.5 live acceptance
was completed after the deterministic gate; K3.5 is the exact next task and K4
must not begin before the K3 exit gate is satisfied. Evidence:
`operations/reports/agent-mode-k3-4-first-coding-worker-evidence-2026-09-09.md`.

### Historical broader K3.5 concurrency, review, commit, and merge record — 2026-09-09

K3.5 adds exactly two statically admitted bounded workers under one root budget.
They use distinct attempts, Workcells, branches, writer leases, fences, and
mutation lineage while sharing only the pinned immutable base revision. A
durable review request/decision boundary and separate fixed Git commit/merge
effects prevent a coding model from approving itself or mutating the target
branch directly. Commit admission requires passed current validation and an
exact approved diff; merge admission separately binds the source commit and
expected target head, with durable target-ref fencing and reconciliation.

The broader K3.5 deterministic gate and one authorized two-worker MiniMax
acceptance are retained in
`operations/reports/agent-mode-k3-5-concurrency-review-merge-evidence-2026-09-09.md`.
This is historical context for the previously attempted broader tranche; it is
not the current K3.5-A completion claim.

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

### K3.5-A concurrent worker isolation foundation — 2026-09-09

K3.5-A is complete for its bounded concurrency gate. A deterministic,
disposable Git fixture proves that exactly two statically admitted workers can
overlap while using separate identities, attempts, Workcells, branches, writer
leases, fences, mutation histories, and result records. Both workers share only
the pinned immutable base revision. Cross-Workcell writes, lease theft, same-
Workcell contention, and stale fences fail closed; SQLite WAL restart and the
observer reconstruct the durable state. The main checkout remains unchanged.

Evidence: `operations/reports/agent-mode-k3-5-a-concurrency-evidence-2026-09-09.md`.

K3 remains **IN PROGRESS**. The later K3.5 promotion gates—review, approval,
Workcell commit, target-ref fencing, merge authorization, and promotion
restart/reconciliation—remain separate work. K3.5-B has now completed only the
review and approval portion. K4 must not begin automatically.

### K3.5-B review and approval authorization boundary — 2026-09-09

K3.5-B is complete for its bounded review gate. The existing SQLite WAL
StateStore now durably binds each review request to one worker, Workcell,
branch, exact diff, and passed validation evidence. Explicit Brain-controlled
decisions persist with requested/approved/rejected receipts; coding workers and
models cannot approve, and duplicate decisions replay idempotently.

Candidate drift or validation-evidence drift marks a request `stale` and cannot
be silently refreshed or reapproved. The observer exposes bounded review state
without secrets, paths, or model reasoning. Evidence:
`operations/reports/agent-mode-k3-5-b-review-evidence-2026-09-09.md`.

K3 remains **IN PROGRESS**. Workcell commit, target-ref fencing, merge
authorization, and promotion restart/reconciliation remain separate K3.5 work.

### K3.5-C durable Workcell commit authorization boundary — 2026-09-09

K3.5-C is complete for its bounded commit gate. Brain now requires the exact
approved Workcell candidate, passed matching validation evidence, an unexpired
writer lease and current fence, unchanged repository binding, and the approved
Workcell state before any Git mutation. The fixed Git adapter accepts only a
bounded commit message and exact changed-file scope; it has no shell, reset,
force, push, or arbitrary Git surface.

Commit operations and requested/completed/rejected/reconciled receipts persist
through SQLite WAL. The operation moves through `approved → committing →
committed`; a pre-Git crash leaves a prepared operation without a commit, while
a post-Git crash is reconciled from the recorded parent and resulting Workcell
revision. Replays are idempotent and a different candidate under the same
operation ID rejects. Deterministic disposable fixtures cover approval,
rejection, drift, fencing, restart, crash recovery, independent Workcells, and
observer visibility. Evidence:
`operations/reports/agent-mode-k3-5-c-commit-evidence-2026-09-09.md`.

K3 remains **IN PROGRESS**. Target-ref fencing, merge authorization, and merge
restart/reconciliation remain separate K3.5 work. K4 is not started.

### K3.5-D merge authorization and target branch safety boundary — 2026-09-09

K3.5-D is complete for its bounded merge gate. A merge approval is a separate
durable authority from commit approval and binds one merge operation to the
repository, source Workcell and branch, source commit, review and validation
evidence, target ref, expected target HEAD, approving actor, timestamps, and
one-use expiry state. Brain verifies the source and current target immediately
before acquiring the target-ref lease and again before invoking the fixed
non-shell merge adapter.

Target-ref authority is scoped only to the shared repository/ref pair; it is
not a global lock, so independent Workcells remain isolated. The monotonic
target fence and expected-head preimage reject competing or stale operations.
No rebase, automatic conflict resolution, force operation, push, or model
selected Git strategy exists.

Merge operations persist `MergeRequestedReceipt`, `MergeCompletedReceipt`,
`MergeRejectedReceipt`, and `MergeReconciledReceipt` with source and target
identity, review/validation IDs, actor, and operation hash. A pre-merge crash
leaves a prepared operation and no target mutation; a post-merge crash is
reconciled only while the recorded target authority remains valid and the
source commit is observed in the target. Duplicate candidates replay
idempotently; different candidates reject. Evidence:
`operations/reports/agent-mode-k3-5-d-merge-evidence-2026-09-09.md`.

K3 exit gate: **COMPLETE**. The two-worker isolation and failed-validation
non-promotion requirements are covered by K3.5-A/B, and the explicit review,
commit, merge, target-fencing, durability, and restart requirements are now
covered by K3.5-B–D. K4 remains planned and must not start automatically.

## Phase K4 — event-driven autonomy and dynamic workers

**Status:** K4.0 and K4.1 complete; K4.2-A, K4.2-B, K4.2-C, K4.2-D1, K4.2-D2, K4.2-E1, and K4.2-E2 complete for their bounded gates; K4.2 is complete; K4.3-A and K4.3-B are complete for their bounded gates; K4 is complete; K5 is planned next

### K4.0 — deterministic event queue, scheduler tick, and no-op heartbeat

K4.0 is complete for its bounded acceptance gate. The authoritative SQLite WAL StateStore now contains the
durable scheduler event/schedule queue, source-watermark seam, queue claims
using the existing lease/fence table, retry/dead-letter settlement, and a
singleton latest-tick observer record. `brain-agent heartbeat --once` and
`brain-agent scheduler tick` perform exactly one finite pass and exit.

The only K4.0 handler is the internal `agent_mode.test.noop` fixture. It has no
model, runtime, worker, shell, network, or repository effect. Dynamic event
sources, debounce/catch-up, worker creation, autonomous model calls, and K4.1
remain out of scope. Evidence:
`operations/reports/agent-mode-k4-0-scheduler-heartbeat-evidence-2026-09-10.md`.

### K4.1-A — durable EventSource seam and local Git revision source

K4.1-A is complete for its bounded gate. A source-neutral
`EventSourceAdapter` contract now returns bounded observations containing
source identity, previous/observed watermark, typed events, `hasMore`, time,
and status. One fixed-argv read-only `git.repository.revision` adapter binds a
stable source/repository identity to an injected installation path, bootstraps
at current HEAD without historical replay, emits bounded oldest-first commit
events for future ancestry advances, and detects divergence without resetting
the watermark.

Source configuration/status lives in the existing Agent Mode StateStore.
Successful event ingestion and watermark advancement are transactional.
Deterministic debounce-group identity and persisted cooldown/not-before state
are exposed without timers. Source errors preserve watermarks, record bounded
retry eligibility, and do not block other sources. The observer exposes safe
source state without paths or credentials. Evidence:
`operations/reports/agent-mode-k4-1-a-git-event-source-evidence-2026-09-10.md`.

### K4.1-B1 — internal Task/Run/Attempt lifecycle event source

K4.1-B1 is complete for its bounded gate. The `brain.task.lifecycle` adapter
reads only the canonical append-only Agent Mode `events` table and uses
monotonic event `sequence` as its durable watermark. Bootstrap records the
current sequence without replaying history; later finite observations use
bounded scan and emit limits, filter a narrow Task/Run/Attempt lifecycle set,
preserve sequence order, and map each source event to one typed
`task.lifecycle.observed` scheduler event. Transactional ingestion, failure
preservation, restart recovery, deduplication, observer origin metadata, and
structural feedback-loop prevention are covered by the B1 evidence report.
No host-health source, worker, model, daemon, or network path is included.

Evidence: `operations/reports/agent-mode-k4-1-b1-lifecycle-event-source-evidence-2026-09-10.md`.

Exact next task: **K4.1-B2 — Host-Health Event Source Using Existing
Infrastructure Health Bindings**. Do not start it automatically.

### K4.1-B2 — Host-Health Event Source Using Existing Infrastructure Health Bindings

K4.1-B2 is complete for its bounded observation gate. The
`infrastructure.host-health` adapter consumes normalized observations from the
existing infrastructure health plane, verifies canonical host resources and
provider bindings, recomputes freshness with the existing helpers, and keeps
per-binding semantic state in a bounded versioned source-owned watermark.
Bootstrap establishes a baseline without an alert flood; only meaningful
status, freshness, or condition-code transitions emit bounded
`infrastructure.host-health.changed` scheduler events. Multiple providers stay
provenance-distinct, missing/invalid evidence fails closed, and scheduler rows
cannot recursively feed the source. Evidence:
`operations/reports/agent-mode-k4-1-b2-host-health-event-source-evidence-2026-09-10.md`.

K4 remains in progress. Exact next task: **K4.1-C — CI Event Source and K4.1
Event-Source Closure Audit**. Do not start it automatically.

### K4.1-C1 — CI workflow-run event source

K4.1-C1 is complete for its bounded observation gate. The `ci.workflow-run`
source reuses the shared `EventSourceAdapter` contract and existing durable
source watermark. It stores a versioned, size-bounded cursor containing only
provider-neutral workflow-run semantic state and pagination continuation.
Bootstrap records historical runs without replay; later observations emit
typed `ci.workflow.started` and `ci.workflow.completed` events, preserve
run/attempt identity for reruns, order oldest-first, and suppress stale or
equivalent observations.

GitHub Actions is the first provider adapter. Its raw status/conclusion fields
are normalized at an injected page-reader boundary; the adapter owns no token,
HTTP client, webhook, listener, daemon, CI log/artifact/YAML reader, or network
side effect. Page count, item count, cursor size, and emitted catch-up are
bounded, and repository/workflow mismatches, malformed responses, invalid
cursors, pagination failures, and provider errors fail closed while preserving
the previous watermark. The observer exposes safe CI run state and scheduler
origin metadata. Evidence:
`operations/reports/agent-mode-k4-1-c1-ci-event-source-evidence-2026-09-10.md`.

K4 remains in progress. Exact next task: **K4.1-C2 — Event-Source Closure
Audit and K4.2 Readiness Gate**. Do not start it automatically.

### K4.1-C2 — Event-Source Closure Audit and K4.2 Readiness Gate

K4.1-C2 is complete. The four-source observation layer is closed on the
existing `EventSourceAdapter` contract: Git uses immutable commit ancestry,
lifecycle uses append-only event sequence, host health uses bounded semantic
binding state, and CI uses a bounded provider cursor plus run/attempt state.
Each source bootstraps without historical flood, emits finite typed scheduler
events, preserves its cursor transactionally, isolates failures, and remains
restart-safe. The combined poll is bounded to 16 registered/processed sources,
up to 100 emitted events per source, and a 15-second observation timeout; its
maximum source-pass event volume is therefore 1,600, while scheduler ticks
remain independently capped at 64 items. The full enabled set is observed in
deterministic source order, so one source cannot starve another within the
registered bound.

The closure audit proves disabled-source retention/re-enable behavior, identity
drift conflict, payload and metadata inertness, observer reconstruction,
combined restart, scheduler destination-only routing, and no model/runtime or
worker behavior. The fixed Git subprocess remains read-only, fixed-argv,
non-shell. No webhook, listener, watcher, daemon, network client, CI logs,
artifacts, or workflow YAML was added. Evidence:
`operations/reports/agent-mode-k4-1-c2-event-source-closure-evidence-2026-09-10.md`.

K4.1 is **COMPLETE**. K4 remains **IN PROGRESS**. K4.2 readiness is
**CONDITIONALLY READY FOR POLICY-ONLY WORK**: K4.2-A may consume the frozen
scheduler-event envelope and bounded typed payload, but must require an
explicit root-goal binding when one exists, check durable task/run cancellation
state, and add a deterministic global/root admission-deny (kill-switch) seam
before any worker creation. No root goal is fabricated from source events.
### K4.2-A — AgentSpawnPolicy Domain, Static Role Templates and Deterministic Spawn Admission

K4.2-A is **COMPLETE** for its policy-only gate. The implementation adds a
versioned pure `AgentSpawnPolicy` evaluator, static role-template manifest,
bounded `SpawnRequest`/`SpawnDecision` contracts, deterministic intent keys,
explicit source/event/capability/scope allowlists, root and parent lineage
checks, cancellation/deadline gates, finite TTL/depth/budget/step checks, and
fact-based concurrency/total-creation ceilings. Unknown or unsafe manifests,
authority read failures, missing roots, and unavailable durable facts deny by
default. Durable global and root admission controls live in the existing
SQLite StateStore and are visible only as bounded observer state. The layer
does not create child Agent records, call ModelGateway, start AgentRuntime,
reserve slots, or wire live scheduler events to workers. Evidence:
`operations/reports/agent-mode-k4-2-a-spawn-policy-admission-evidence-2026-09-10.md`.

K4.2-B and K4.2-C are now complete. K4.2 remains **IN PROGRESS**. Exact
next task: **K4.2-D — Bounded AgentRuntime Dispatch, Cancellation Propagation
and Child Settlement**. Do not start it automatically.

### K4.2-B — Durable Child Agent Identity, Atomic Spawn-Slot Reservation and Root Aggregate Limits

K4.2-B is **COMPLETE**. The existing SQLite StateStore now persists bounded
child Agent identity and immutable creation material: role-template and policy
versions, exact parent/task/run and root lineage, source event, authoritative
depth, repository/resource scope, capability snapshot, requested/reserved child
step and cost ceilings, creation time, expiry, and truthful reserved/retired/
cancelled/expired status. The controller derives the child ID; no runtime,
model, task, run, or attempt is created by this gate.

`reserveSpawnAndCreateChild` is the single atomic transaction boundary. It
rechecks the durable kill switches, root and parent lineage/cancellation,
deadline, policy/template, active and total ceilings, and root aggregate
reservations before a guarded root-row update, child insert, bounded lifecycle
event, durable receipt, and commit. The root aggregate row is the sole source
of active/total counters and reserved child step/cost allocation. Durable
`spawnIntentKey` receipts make retries idempotent, conflicting immutable
material fails closed, retirement releases active allocation without reducing
monotonic total creation count, and bounded expiry reconciliation is
restart-safe and race-safe. Observer output exposes only bounded child/root
state without prompts, raw provider data, or secrets. Evidence:
`operations/reports/agent-mode-k4-2-b-child-agent-reservation-evidence-2026-09-10.md`.

K4.2-B focused tests pass 47/47 and the prior K4.0/K4.1/K4.2-A regression
set passes 189/189. K4.2 remains **IN PROGRESS**. K4.2-C is recorded below.

### K4.2-C — Runtime Binding and Durable Child Task/Run Assignment

K4.2-C is **COMPLETE** for its bounded StateStore gate. A typed child
assignment request is validated against a finite runtime-profile registry and
derives a deterministic assignment intent from immutable logical material.
The `assignChildAgent` transaction rechecks the child reservation, root and
parent lineage, cancellation and kill switches, expiry/deadline, policy and
template identity, capability and repository/resource scope, allocation
ceilings, and known runtime/profile admission before writing anything.

One transaction creates the canonical child Task, Run, and Attempt, links
them to the child and assignment intent, creates a child budget suballocation
in the existing ledger, advances the child from `reserved` to `assigned`,
persists a bounded receipt/assignment row, and appends one bounded lifecycle
event. The root aggregate reservation is reused rather than reserved again.
Task/Run/Attempt remain pre-dispatch (`admitted`/`created`/`admitted`), with
deferred route/model references and no runtime identity, process, AgentRuntime
call, ModelGateway call, scheduler wiring, Workcell, Git, network, or UI
behavior. A prepared dispatch is an immutable data projection only; K4.2-D
owns the fresh execution-time authority recheck and actual dispatch.

Retries after a lost response or reopen return the same receipt and canonical
entities; conflicting immutable material fails closed. Unique child, task,
run, attempt, and reservation constraints plus the StateStore transaction
make concurrent duplicate and competing assignments converge safely.

Cancellation, kill-switch changes, and expiry cannot create a new assignment;
assigned-child retirement/expiry invalidates the prepared dispatch and cancels
the canonical entities while releasing the child ledger reservation and root
aggregate allocation atomically. Observer output exposes bounded linkage and
runtime/profile identifiers without prompts, payloads, or secrets. Evidence:
`operations/reports/agent-mode-k4-2-c-runtime-binding-assignment-evidence-2026-09-10.md`.

K4.2-C focused tests pass 58/58 and the expanded K4.0/K4.1/K4.2 regression set
passes 268/268. K4.2 remains **IN PROGRESS**. Exact next task: **K4.2-D —
Bounded AgentRuntime Dispatch, Cancellation Propagation and Child Settlement**.
Do not start it automatically.

### K4.2-D1 — Mock-backed bounded AgentRuntime dispatch, cancellation and child settlement

K4.2-D1 is **COMPLETE** for its bounded in-process gate. The existing SQLite
StateStore now owns the fresh execution-time authority recheck, fenced runtime
dispatch lease, durable `effects`/`dispatch_outbox` intent, bounded
`AgentRuntime` request/result seam, runtime receipt persistence, receipt
verification, settlement, cancellation propagation, and uncertain/reconcile
classification. Only `MockAgentRuntime` is callable in this tranche; no
restricted Harness, OS process, model/provider, BrainNode, Workcell, scheduler
worker, network, or replacement worker is launched.

The state sequence is truthful: `dispatchable → dispatched → receipt_recorded →
verified → settled`, with failed/cancelled/uncertain paths. Fences prevent stale
dispatch and settlement. Duplicate dispatch invokes the runtime once; duplicate
receipts and settlement are idempotent; uncertain runtime outcomes retain
budget and active-slot allocation until explicit reconciliation. Success,
failure, and acknowledged cancellation settle the child Attempt/Run/Task,
assignment, Agent, budget, root allocation, and runtime lease exactly once.
Observer output exposes bounded runtime dispatch state without hidden reasoning,
prompts, provider payloads, credentials, or secrets. Evidence:
`operations/reports/agent-mode-k4-2-d1-mock-runtime-dispatch-evidence-2026-09-10.md`.

The focused D1 matrix passes 57/57 and the Agent Mode regression set passes
304/304. The package-wide `brain-core` command separately reports three
unrelated `OrchestrationExecutor` timeout failures. K4.2-D1 is complete; K4.2
remains **IN PROGRESS**. Exact next task:
**K4.2-D2 — Restricted Harness Process Dispatch, Runtime Cancellation and
Reconciliation**. Do not start it automatically.

### K4.2-D2 — Restricted Harness process dispatch, cancellation and reconciliation

K4.2-D2 is **COMPLETE** for its bounded process-boundary gate. The
`RestrictedHarnessAgentRuntime` implements the existing D1 `AgentRuntime`
contract and admits only the pinned DeepSeek Harness version `0.1.3-alpha.2`
at commit `c389f96bf3a9b6807cb71ed6bdad5849be0df6d8` through the existing
`runtime:deepseek-harness:<commit>` / `brain-agent-mode-restricted` binding.
The injected root and package manifests are checked before launch; executable
and argv authority cannot come from task, event, model or runtime data.

The existing Harness SDK owns one stdio child per attempt. Brain supplies a
fixed profile/patch composition, an explicit complete environment, isolated
HOME/TMPDIR/cwd, and a local Unix-socket fixture bridge. SDK initialization is
the bounded readiness handshake; Brain verifies the pinned version, restricted
topology, separate-child boundary, sanitized environment, and normalized
process identity before delivering the admitted attempt. SDK shutdown retains
the bounded graceful-then-terminate-and-reap ladder. Parent sentinel variables
are absent from the child; the child receives no Agent Mode database path,
credentials, external network, BrainNode, Workcell, or scheduler authority.

The deterministic fixture returns `BRAIN_K4_2_D2_HARNESS_PROCESS_PASS`, uses
zero model/provider calls and zero executable tools, and supports known
failure, in-flight cancellation, child crash, oversized/malformed bridge
rejection, and durable parent-owned evidence reconciliation. Startup failures
before attempt delivery are known failures; a child crash after admitted
input is `uncertain`; disappearance without durable evidence stays uncertain;
durable identity-bound evidence can resolve without relaunch. D1 effects,
outbox, fence, receipt verification, settlement, and observer state remain
authoritative. Observer exposes only bounded runtime/profile, process state,
PID/start time, identity verification, dispatch phase, exit classification,
cancellation and reconciliation fields.

The focused D2 matrix passes 12/12. D1 and affected K4.2/K4.1/K4.0
regressions remain green; the package-wide `brain-core` suite passes 2444/2444.
Evidence:
`operations/reports/agent-mode-k4-2-d2-restricted-harness-dispatch-evidence-2026-09-11.md`.

K4.2-D1 and K4.2-D2 are complete; K4.2 remains **IN PROGRESS**. K4.2-E1 is
recorded below.

### K4.2-E1 — Deterministic Scheduler-to-Spawn Orchestration and End-to-End Dynamic Worker Lifecycle

K4.2-E1 is **COMPLETE** for its bounded scheduler-to-worker gate. A closed,
versioned scheduler event-action rule registry now expresses the only allowed
event-to-action intent and is separate from `AgentSpawnPolicy`: policy and role
allowing a child does not itself create work. Unknown, disabled, malformed, or
payload-selected rules produce bounded `NO_ACTION`/denial outcomes. The default
registry remains disabled, and the fixture rule is the only enabled positive
path in this tranche.

The orchestrator claims each durable scheduler event through the existing
StateStore lease/fence, reads source type from authoritative source
configuration, derives the root binding and all immutable lifecycle identities
from the event plus the static rule, and composes the existing K4.2-A policy,
K4.2-B atomic reservation, K4.2-C assignment, and K4.2-D1 dispatch/settlement
boundaries. It does not insert child/task/run/attempt records directly, mutate
budgets directly, or create a replacement worker. A bounded pass orders events
deterministically and caps the batch.

The positive path invokes only `MockAgentRuntime`. It reaches one durable
child, assignment, Task/Run/Attempt, D1 operation/outbox, runtime receipt and
settlement. Harness, ModelGateway, BrainNode, Workcell, OS process, network,
and external-provider counts remain zero. Ten redeliveries and concurrent
claimers converge on one lifecycle. Crash points before policy, before child
commit, after child creation, after assignment, and after worker settlement
resume safely; uncertain runtime state is retryable for the scheduler but is
never blindly replayed by D1. Cancellation, kill-switch, deadline, root
concurrency, total-creation, aggregate-budget, recursive-spawn, and no-op
heartbeat behavior are covered. Observer output exposes bounded causation and
action/child/assignment/runtime linkage without prompts, raw payloads, or
secrets.

Evidence:
`operations/reports/agent-mode-k4-2-e1-scheduler-dynamic-worker-evidence-2026-09-11.md`.
Focused E1 validation is 23/23; the Agent Mode regression set is 339/339; the
package-wide `brain-core` suite was 2467/2467 at that gate. E2 is recorded
below.

### K4.2-E2 — Restricted-Harness Scheduler-to-Worker Acceptance and K4.2 Closure Gate

K4.2-E2 is **COMPLETE**. The same E1 orchestrator and D1 dispatcher now drive
the actual D2 `RestrictedHarnessAgentRuntime` through one deterministic,
disabled-by-default, read-only E2 action rule. The rule is separate from
spawn permission, root-bound, finite, and has zero executable capabilities;
the E1 rule remains unchanged.

The positive path proves exactly one child, one Task/Run/Attempt, one D1
runtime-dispatch outbox, one pinned Harness launch, and one exact Harness reap.
No replacement worker, ModelGateway/Bedrock/live model call, BrainNode,
Workcell, repository write, or external network effect occurs. The Harness is
pinned to `0.1.3-alpha.2` at commit
`c389f96bf3a9b6807cb71ed6bdad5849be0df6d8` with profile
`brain-agent-mode-restricted`; D2 environment, topology, identity, and
reconciliation controls remain enforced.

Redelivery, concurrent claims, crash/restart at each tested phase, uncertain
dispatch with durable evidence, no-evidence uncertainty, cancellation and
reaping, kill switches, deadlines/TTL, root concurrency/creation/budget,
recursive-spawn prevention, malicious metadata, bounded batches, quiet no-op,
and observer reconstruction all pass. The K4.2 closure audit conditions 1–23
all pass. Evidence:
`operations/reports/agent-mode-k4-2-e2-harness-dynamic-worker-closure-evidence-2026-09-11.md`.

Focused E2 validation is 16/16; the Agent Mode regression set is 355/355; the
package-wide `brain-core` suite is 2483/2483, with typecheck and build green.
**K4.2: COMPLETE. K4: IN PROGRESS.** Exact next task:
**K4.3-A — One Bounded Live MiniMax Dynamic-Worker Acceptance**. Do not start
it automatically.

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

## K4.3-A — One Bounded Live MiniMax Dynamic-Worker Acceptance

**Status:** COMPLETE for the bounded live gate. R3 used one fresh authorized
MiniMax M2.5 inference through the scheduler-created restricted Harness and
Brain-owned ModelGateway path. The canonical live output allowance is `1024`
tokens, while the deterministic D2 fixture allowance remains separate at `64`
tokens. The exact visible response was accepted, one durable identity-bound
provider receipt was verified, and usage/cost settled once at `61 / 119 / 180`
tokens and `$0.000161`. No tools, BrainNode, Workcell, repository,
replacement-worker, fallback, or escalation effects occurred.

R3 evidence:
`operations/reports/agent-mode-k4-3-a-r3-live-minimax-acceptance-evidence-2026-09-12.md`.
The full K4.3-A chronology, including the R1 prompt-contract failure and R2
output-budget exhaustion, remains in
`operations/reports/agent-mode-k4-3-a-live-minimax-dynamic-worker-evidence-2026-09-11.md`.

K4 remains **IN PROGRESS**. Exact next task: **K4.3-B — K4 Live Autonomy
Closure Audit and Phase Exit Gate**. Do not start it automatically.

## K4.3-B — K4 Live Autonomy Closure Audit and Phase Exit Gate

**Status:** COMPLETE. The closure audit verified the complete K4 control plane:
durable scheduler/event authority, separate action intent and spawn permission,
atomic child reservation, deterministic assignment, fenced runtime dispatch,
restricted Harness process security, cancellation/kill/deadline authority,
bounded budgets/concurrency, recursive-spawn prevention, provider ownership and
effect journaling, uncertainty no-replay, observer reconstruction, and quiet
heartbeat behavior.

K4.3-A R3 remains the one canonical bounded live MiniMax acceptance. It used one
fresh direct `amazon-bedrock` inference through the scheduler-created
restricted Harness and Brain-owned ModelGateway path; the exact response was
accepted, the provider receipt was durable and verified, and usage/cost settled
once. No additional live call was made for this audit. Broad production live
autonomy remains disabled by default.

All 30 K4 closure invariants are **PASS**. K4.3-B and K4 are **COMPLETE**. The
closure evidence is
`operations/reports/agent-mode-k4-3-b-k4-live-autonomy-closure-evidence-2026-09-12.md`.

The exact next roadmap milestone is **Phase K5 — multi-agent organization**,
which is planned after K4. Do not start it automatically.

## Phase K5 — multi-agent organization

**Status:** K5 complete; U0 is the next planned phase

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

### K5-A — Durable Multi-Agent Organization Contracts and Delegation DAG Foundation

**Status:** COMPLETE for the bounded offline foundation; K5 remains IN PROGRESS

K5-A adds Brain-owned, versioned logical organization-role manifests for Jarvis /
CEO, Engineering, Research, Operations, Memory / Archivist, and Independent
Auditor. It adds a bounded durable `OrganizationPlan` with deterministic plan
and work-item identities, `requires_success` dependency edges, finite result /
evidence contracts, authoritative root/supervisor binding, and SQLite
transactional persistence in the existing Agent Mode StateStore.

Plan creation is idempotent and conflict-safe across restart and concurrent
controllers. The readiness projection is pure/deterministic and consumes only
supplied authoritative terminal result facts; cancelled, killed, or expired
roots/plans remain blocked. Requested work-item envelopes are declarations only:
K5-A does not reserve K4 budget, create children, create Tasks/Runs/Attempts,
dispatch runtimes, call models, or create a second result ledger. Observer output
exposes bounded ownership, dependency, readiness, and future child/task binding
identity without prompts, hidden reasoning, provider payloads, credentials, or
unbounded text.

Evidence: `operations/reports/agent-mode-k5-a-organization-contracts-evidence-2026-09-13.md`.

K5-B composes these contracts through the existing K4 SpawnRequest / SpawnPolicy
/ Task / Run / Attempt / runtime and structured result paths; its bounded gate
is recorded below.

### K5-B — Deterministic Supervisor Delegation Orchestrator with Mock Workers

**Status:** COMPLETE for the bounded deterministic/mock-worker execution gate;
K5 remains IN PROGRESS

K5-B adds a closed Brain-owned organization delegation mapping. Organization
roles remain identity-only; the mapping separately selects the existing K4
read-only policy/template and the deterministic `MockAgentRuntime` fixture.
Ready work items derive stable delegation and K4 spawn identities, pass through
K4 SpawnPolicy, atomic child reservation, child assignment, runtime dispatch,
leases, cancellation, deadlines, budgets, and settlement, then derive bounded
structured result/evidence facts from authoritative K4 receipts. K5 persists
only ownership binding (`work item → child/task`); it does not create a second
Task/Run/Attempt or result ledger.

The supervisor API is one finite `advanceOrganizationPlanOnce` pass with a
maximum of four declared-order-by-key work items. It gates dependents with the
K5-A DAG, preserves root concurrency/creation/budget limits, and converges
under redelivery, restart, concurrent controllers, child-before-binding
crashes, failures, cancellation, kill-switch, deadline, and uncertain runtime
states. The three-item Research → Auditor / Engineering → Auditor fixture
creates exactly three worker lifecycles and invokes only MockAgentRuntime;
Harness, ModelGateway, providers, network, BrainNode, Workcells, and repository
effects remain zero.

Evidence: `operations/reports/agent-mode-k5-b-supervisor-delegation-mock-workers-evidence-2026-09-13.md`.

Exact next bounded slice: **K5-C — Structured Supervisor Aggregation, Auditor
Gate, and Organization Final Result**. K5-C should prove deterministic,
evidence-backed organization aggregation and final-result semantics. Do not
start K5-C automatically.

### K5-C — Structured Supervisor Aggregation, Auditor Gate, and Organization Final Result

**Status:** COMPLETE; K5 phase exit gate PASSED

K5-C adds a versioned, bounded organization aggregation derived exclusively from
K4 Task/Run/Attempt, runtime receipt/evidence, settlement, K5-A graph, and
K5-B ownership bindings. Work-item entries are canonically ordered references
and terminal facts; no prompt, hidden reasoning, provider payload, runtime log,
or duplicate K4 ledger is stored. Each K5-A result contract is enforced,
including required status, result-reference presence, and bounded evidence.

The Independent Auditor is exactly one structurally downstream
`agent-mode.org-role.independent-auditor.v1` item. Its own K4 lifecycle and
successful result contract are necessary but not sufficient: failed, cancelled,
dependency-failed, uncertain, cancelled-root, or expired-plan facts cannot
produce organization success. Known terminal failures may persist one failed
organization receipt; uncertainty remains explicitly unfinalizable until K4
reconciliation resolves it.

`AgentModeOrganizationFinalizer` derives a deterministic aggregate digest and
final-result ID from plan version, canonical work-item terminal references,
auditor reference, and settled cost. One SQLite transaction inserts the
immutable organization receipt and transitions the plan lifecycle; repeated or
concurrent finalization converges on that receipt, while conflicting material
fails closed. Total cost is reconstructed from settled K4 reservations, not
requested envelopes. Restart and observer projections reconstruct ownership,
dependencies, evidence, cost, auditor gate, and final status.

The K5-B three-worker fixture remains exactly three child Agents, Tasks, Runs,
Attempts, and MockAgentRuntime calls, with zero live model, Harness, tool,
network, BrainNode, Workcell, or repository effects. K5 is structured
supervisor-owned organization under Brain policy/control; it does not imply
unrestricted Jarvis/CEO reasoning. Agents communicate through structured
tasks, events, results, evidence, review requests, and escalations.

Evidence: `operations/reports/agent-mode-k5-c-organization-final-result-evidence-2026-09-13.md`.
K5 is COMPLETE. The exact next roadmap phase is **Phase U0 — unified Brain
Console control surface**. Do not start U0 automatically.

## Phase U0 — unified Brain Console control surface

**Status:** COMPLETE; U0-A, U0-B, U0-C1, U0-C2, U0-C3A, U0-C3B, U0-D, U0-E, U0-F, and U0-G are complete; U0 exit gate passed

Borrow Orca-like fleet/worktree/usage/notification patterns while keeping Brain
Console as the primary control/dashboard surface. Show Jarvis intake, agent
hierarchy, tasks/runs/attempts, node/worktree/runtime/model, budgets and Codex
quota state, approvals, evidence, schedules, failures, escalations, and unread
notifications. Obsidian/Mind, IDEs, CLIs, and optional Orca-like specialist
surfaces remain complementary tools over the same Brain APIs/events.

Exit gate: UI state is fully reconstructible from durable Brain state and never
becomes a competing source of truth.

### U0-A — Canonical Agent Mode Console Projection and Read-Only Operations Surface

**Status:** COMPLETE for the bounded read-only projection gate.

Brain Core now exposes one versioned `agent-mode-console-v1` projection at
`GET /agent-mode/console`. It is derived at request time from the existing
Agent Mode observer and durable StateStore, with bounded collections,
deterministic operational ordering, and explicit fresh/empty/unavailable
freshness. It does not create Console-owned tables, copy lifecycle ledgers, or
probe providers.

Brain Console exposes this contract at `/agents` through the existing
`brainCoreRequest()` and TanStack Query client path. The page is read-only and
has Overview, Agents, Organizations, Tasks, and Failures views. Zod validates
the exact response shape; query refresh state is visibly stale/error-aware and
the browser remains non-authoritative.

U0-A surfaces durable Agent Mode/K5 lifecycle, organization final-result,
runtime/model facts, root budget reservations/settlement, scheduler metadata,
pending Agent Mode review approvals, bounded evidence metadata, and failures.
Jarvis intake, notifications, richer node/worktree/quota inventory, detail
drill-down, and lifecycle control mutations remain later U0 slices. Legacy
`/agent-console` remains compatible and is not the canonical Agent Mode page.

Evidence: `operations/reports/agent-mode-u0-a-console-projection-evidence-2026-09-13.md`.
Exact next bounded slice: **U0-B — Agent Detail, Evidence, Budget, Schedule,
and Failure Drill-Down**. Do not start it automatically.

### U0-B — Agent Detail, Evidence, Budget, Schedule, and Failure Drill-Down

**Status:** COMPLETE for the bounded read-only detail gate.

Brain Core now exposes `GET /agent-mode/console/detail/:kind/:id` with the
versioned `agent-mode-console-detail-v1` contract. The closed detail kinds are
Agent, Task, Run, Attempt, Organization, Budget, Schedule, Failure, and
Evidence. Brain Core derives every response from the existing Agent Mode
observer and durable StateStore; no Console database or second lifecycle,
result, budget, or evidence ledger exists.

Responses are bounded, deterministically ordered, and explicit about fresh,
not-found, and unavailable StateStore conditions. Evidence is metadata-only,
with no prompts, hidden reasoning, provider payloads, credentials, or raw
logs. The `/agents` page provides ephemeral clickable cross-links and a
read-only detail panel using the existing Brain Core client, strict Zod schema,
and side-effect-free TanStack Query refresh. No lifecycle mutation or provider
probe is exposed.

Evidence: `operations/reports/agent-mode-u0-b-console-drilldown-evidence-2026-09-13.md`.
Exact next bounded slice: **U0-C — Guarded Agent Lifecycle Controls and
Approval Actions**. Do not start it automatically.

### U0-C1 — Brain-Owned Lifecycle Control Service and CLI/HTTP Safety Boundary

**Status:** COMPLETE for the Brain-owned control-service foundation; U0-C
remains IN PROGRESS.

Brain Core now has a versioned `AgentModeControlService` for pause, resume,
cancel, kill, and review decisions. It validates bounded trusted-actor
commands, derives stable control receipt identities, persists receipts in the
existing durable `events` stream, and composes the existing StateStore
lifecycle methods plus `recordReviewDecision`. Resume and kill remain bound to
fresh verified durable runtime identity; kill never accepts an arbitrary PID or
redelivers a signal after a durable signal receipt. Existing worker/model
self-approval restrictions remain authoritative.

`brain-agent pause|resume|cancel|kill` now uses this service while preserving
its existing output and recovery semantics. No Agent/Task/Run/Attempt ledger,
budget ledger, runtime control plane, HTTP mutation handler, or Brain Console
mutation control was added. BS0.1 remains active: because the repository has no
usable authenticated HTTP service identity, `/agent-mode/control/run/:runId`
and `/agent-mode/control/review/:reviewId` remain contained before request-body
read with the existing fail-closed response. U0-C1 therefore lands the shared
domain control foundation without claiming authenticated network authority.

Clarification: canonical BS0.5 — **Create the contract registry** — remains
COMPLETE and is not being reopened. The missing item identified by BS0.1 was a
trusted authenticated service identity; U0-C1 recorded that residual gap, and
U0-C2 below resolves it as a U0 prerequisite rather than relabeling BS0.5.

Evidence: `operations/reports/agent-mode-u0-c1-guarded-controls-evidence-2026-09-14.md`.
Exact next bounded prerequisite: reconcile/implement the authoritative BS0.5
authenticated service identity contract, then add the authenticated HTTP and
Console mutation gate. Do not substitute UI polish or unauthenticated browser
headers for service identity.

### U0-C2 — Authenticated Brain Core Service Identity and Agent Mode Mutation Admission

**Status:** COMPLETE for the authenticated server-to-server Agent Mode
mutation boundary; U0-C remains IN PROGRESS.

Canonical BS0.5 remains the completed descriptive contract-registry milestone.
U0-C2 fulfills the unresolved trusted-service identity requirement originally
identified by BS0.1 without changing historical BS0 evidence or reopening BS0.5.

Brain Core now uses the separate versioned `brain-service-auth-v1` HMAC
protocol. Configured server-only `BRAIN_CORE_SERVICE_ID` and
`BRAIN_CORE_SERVICE_SECRET` material form a bounded identity registry entry
with the explicit `agent-mode.control` capability. Requests bind protocol,
service ID, method, canonical pathname, request ID, freshness timestamp, and
SHA-256 body digest in timing-safe HMAC verification. Authentication and
capability admission happen before request-body read; the bounded body is then
hashed and compared before the trusted service actor is passed to
`AgentModeControlService`.

Only `POST /agent-mode/control/run/:runId` and
`POST /agent-mode/control/review/:reviewId` are promoted. Caller actor, PID,
signal, model, and retry fields are not accepted. All other routes covered by
`isContainedHighImpactMutation()` remain contained, and mutation responses do
not enable wildcard CORS. Missing configuration, stale/future requests,
invalid signatures, missing capability, and digest mismatch fail closed without
secret disclosure. Browser and human/operator authentication remain deferred.

Evidence: `operations/reports/agent-mode-u0-c2-service-identity-evidence-2026-09-14.md`.
Exact next bounded slice: **U0-C3 — Brain Console Guarded Mutation Proxy and
Lifecycle/Approval Controls**. Do not start U0-C3 automatically.

### U0-C3A — Server-Only Brain Core Control Client and Operator Boundary Audit

**Status:** COMPLETE for the bounded security prerequisite; U0-C remains IN
PROGRESS.

The existing Brain Console tree has no middleware, session, operator identity,
CSRF/session binding, server action, or documented human/browser authentication
boundary. It is therefore classification **C — no authenticated operator
boundary exists**. U0-C3A does not invent OAuth, password storage, or a broad
identity system, and it does not create an unauthenticated power proxy.

Brain Console now contains a server-only `brainCoreControlRequest()` helper
using the `server-only` boundary. It reads `BRAIN_CORE_SERVICE_ID` and
`BRAIN_CORE_SERVICE_SECRET` only on the server, signs the existing
`brain-service-auth-v1` method/path/request/timestamp/content contract, sends
only bounded Agent Mode control bodies, and parses strict bounded control
responses. Missing service configuration, invalid paths/bodies, transport
failure, and malformed responses fail closed without revealing configuration.

No browser signing, same-origin mutation route, lifecycle button, review button,
CSRF token, operator claim, or Console mutation control is enabled. Existing
`/agents` and U0-A/U0-B reads remain available without mutation credentials.
U0-C3A proves the Brain Console→Brain Core service boundary independently but
does not claim human/operator authentication.

Evidence: `operations/reports/agent-mode-u0-c3-console-guarded-controls-evidence-2026-09-14.md`.
Exact next bounded task: **U0-C3B — Authenticated Operator Session and Console
Control Admission**. Do not start it automatically.

### U0-C3B — Authenticated Operator Session and Console Control Admission

**Status:** COMPLETE for the bounded authenticated local-operator gate; U0-C3
is complete and U0 remains IN PROGRESS.

The U0-C3A audit found no existing Brain Console Ory/Clerk/session integration
or compatible operator cookie boundary. U0-C3B therefore adds the deliberately
small `brain-console-operator-v1` fallback: one server-configured operator
identity (`BRAIN_CONSOLE_OPERATOR_ID` plus server-only
`BRAIN_CONSOLE_OPERATOR_SECRET`), a signed HKDF/HMAC session cookie with an
eight-hour maximum lifetime, and a session-bound CSRF nonce. The cookie is
HttpOnly, SameSite=Strict, scoped to `/api`, never returned with the secret,
and only accepted over the loopback Brain Console transport.

The same-origin Console proxy admits only the existing Agent Mode run and
review control paths. It validates bounded lifecycle/review bodies, requires
the authenticated session and CSRF nonce, and forwards to the server-only
`brainCoreControlRequest()` helper; the helper remains the sole holder of the
`brain-service-auth-v1` service identity. Pause, resume, cancel, kill, approve,
and reject are explicit controls with confirmation for destructive/review
actions, no optimistic state or automatic mutation retry, and stable
operation IDs for a mounted control intent. Brain Core rechecks all existing
lifecycle, runtime-identity, cancellation, kill, deadline, review, and policy
authority; no browser field widens it. Unknown actions and authority fields
are rejected before delegation.

The positive and denial tests cover session tamper/expiry/key separation,
generic login failures, loopback/origin/CSRF admission, strict request bounds,
review forwarding, no downstream call on denial, and browser-safe bundling.
The existing `/agents` projection/detail reads remain read-only apart from
these explicitly guarded Agent Mode controls. Other high-impact Core routes
remain contained, and Ory/Clerk integration, revocation storage, multi-user
identity, notifications, and richer authorization are explicitly deferred.

Evidence: `operations/reports/agent-mode-u0-c3b-operator-session-controls-evidence-2026-09-14.md`.
Exact next bounded slice: **U0-D — Agent Mode Control Audit, Evidence, and
Operator Session Hardening** (or the exact successor recorded after the next
roadmap review). Do not start it automatically.

### U0-D — Agent Mode Control Audit, Evidence, and Operator Session Hardening

**Status:** COMPLETE for the bounded local-operator audit and session-hardening gate; U0-C and U0-D are complete and U0 remains IN PROGRESS.

U0-D closes the local control-audit gap without adding a second ledger. The
existing Brain Core `AgentModeControlService` receipts/events now carry bounded
operator attribution (`operatorId` plus a non-secret session audit hash) and
the authenticated service actor separately. The observer and Console expose a
bounded, metadata-only control-audit projection and run-detail audit list;
session identifiers, CSRF values, secrets, process IDs, prompts, provider
payloads, and raw logs are never projected.

The six promoted controls remain the existing pause, resume, cancel, kill,
approve, and reject paths. Brain Core remains authoritative for runtime
identity, kill signaling, cancellation, review restrictions, deadlines, and
all other lifecycle checks. The Console proxy injects operator attribution
after local session admission; browser bodies cannot provide actor, PID,
runtime, model, or attribution authority. A bounded five-failure login
cooldown was added. Session cookies remain finite HKDF/HMAC-signed,
HttpOnly/SameSite=Strict and `/api` scoped. In the current local loopback
threat model logout is stateless cookie clearing; token revocation storage is
explicitly not claimed. The proxy rejects all forwarded headers because no
trusted proxy is configured, requires a direct Host match, same-origin Origin,
session, and CSRF nonce, and retains strict bounded bodies.

Evidence: `operations/reports/agent-mode-u0-d-control-audit-session-hardening-evidence-2026-09-14.md`.
Exact next bounded U0 slice: inspect the remaining roadmap gaps and define the
next explicitly authorized U0 task; do not start it automatically.

### U0-E — Root, Workcell, Node, Runtime, Model, and Execution-Resource Visibility Gap Closure

**Status:** COMPLETE for the bounded durable read-model visibility gate; U0
remains IN PROGRESS.

U0-E extends the canonical `agent-mode-console-v1` projection at
`GET /agent-mode/console` with bounded Root Goals, Workcells, and distinct
execution-resource records. Root/Jarvis ownership is derived from durable
spawn-root and Agent Mode facts. Workcell views reuse the existing observer's
safe repository reference, branch, base reference, lifecycle, lease,
validation, diff, review, commit, and merge metadata; absolute paths and lease
fences remain excluded. Nodes are represented only by existing durable
host-health source facts, with no provider or host probes.

The `/agents` read-only surface now provides Roots, Workcells, and Resources
views in addition to the existing operational tabs. Runtime, model/provider,
node, and execution-resource records remain separate types and are displayed
only when durable facts exist. Codex quota, richer inventory, and Jarvis intake
are explicitly unavailable/not yet surfaced where no canonical durable Brain
source exists. The browser continues to read Brain Core through the existing
Zod-validated client and owns no authoritative state.

All new collections are bounded to 100 records and use active-before-terminal,
newest-updated, stable-ID ordering. Root and Workcell detail uses the existing
versioned detail route with metadata-only validation/diff/lease disclosures.
Repeated projection reads remain side-effect free: no AWS, provider, runtime,
BrainNode, Workcell, scheduler, or mutation call is performed. StateStore and
observer facts remain the only authority; no Console database or inventory
ledger was added.

Evidence: `operations/reports/agent-mode-u0-e-resource-visibility-evidence-2026-09-14.md`.
Exact next bounded U0 slice: **U0-F — Durable Escalations, Unread
Notifications, and Remaining Resource/Quota Visibility Gaps** (subject to the
next roadmap review); do not start it automatically.

### U0-F — Durable Escalations, Unread Notifications, and Remaining Resource/Quota Visibility Gaps

**Status:** COMPLETE for the bounded durable operator-attention and quota-gap
slice; U0 remains IN PROGRESS.

U0-F adds Brain-owned, bounded escalation and notification contracts backed by
the existing Agent Mode StateStore. A deterministic reconciliation seam indexes
uncertain Attempts, scheduler dead letters, failed Workcell validations, and
pending review requests. Ordinary worker failures, root cancellation, maximum
escalation depth, and model-request escalation remain visible through existing
failure/review state and do not automatically become operator escalations.
GET projections never reconcile or write state.

Escalation and notification identities are deterministic and immutable by
source transition. Notifications contain only closed kind/severity/source
codes and durable object references; they never contain prompts, reasoning,
provider payloads, credentials, or raw result bodies. A separate composite-key
notification-read receipt is operator-scoped. Reading is not resolving,
approving, cancelling, or settling an item.

Personalized unread state is available only through authenticated
`GET /agent-mode/notifications` and the Brain Console same-origin proxy
`GET /api/agent-mode/notifications`; individual acknowledgement uses the
CSRF-protected `POST /api/agent-mode/notifications/:notificationId/read` proxy.
Brain Core service authentication uses the narrow `agent-mode.notifications`
capability, never a wildcard or the lifecycle-control capability. The public
`agent-mode-console-v1` projection exposes only non-personal attention
metadata, with `read: null` when no operator identity is present.

Codex quota, Jarvis intake, richer node/worktree inventory, and durable
notifications before this slice remain explicitly unavailable/not yet
surfaced where no canonical durable producer exists. U0-F records quota as
`unavailable` with reason `no_canonical_durable_source`; it does not probe,
scrape, guess, or create a parallel inventory ledger. The exact next bounded
slice is **U0-G — Unified Brain Console Phase Exit Audit**; do not start it
automatically.

### U0-G — Unified Brain Console Phase Exit Audit

**Status:** COMPLETE; U0 phase exit gate PASSED.

The final audit verifies that Brain Console is one bounded observer over durable
Brain authority. U0-A through U0-F contracts and implementation seams were
reconciled against source and focused/full regression evidence. The audit
confirmed request-time projections and detail responses derive from StateStore,
observer, and bounded Brain-owned derivations; the browser owns no Agent Mode,
control, organization, budget, evidence, attention, or runtime authority.

Jarvis intake is satisfied for the current operator surface by durable accepted
Root Goal/Jarvis ownership visibility; conversational intake remains later V0
work. Codex quota remains explicitly unavailable because Brain has no canonical
durable telemetry source, and the Console does not probe or synthesize it.
The audit found and repaired one bounded-attention omission bug: an open
escalation is now resolved only after its exact canonical source is inspected
and found non-qualifying, never merely because it fell outside a scan window.

Evidence: `operations/reports/agent-mode-u0-g-unified-console-exit-audit-2026-09-14.md`.
Exact next phase: **Phase V0 — Jarvis voice gateway**. Do not start it
automatically.

## Phase V0 — Jarvis voice gateway

**Status:** V0-A, V0-B, V0-C1, V0-C2, V0-C, and V0-D COMPLETE; V0 COMPLETE; local non-text inference remains allowed

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

### V0-A — Jarvis voice transport contracts and deterministic gateway fixture

V0-A establishes the provider-neutral `agent-mode.jarvis-voice-gateway.v1`
contracts for input/session correlation, bounded STT transcripts, canonical text
intake, Jarvis-only TTS output, and transport-only interruption. The deterministic
fixture maps `fixture://voice/hello-jarvis` to the bounded transcript
`Jarvis, summarize the current task.` and the bounded Jarvis response
`The current task is ready.`; it produces no Agent Mode, K4, ModelGateway,
runtime, Harness, network, or provider side effects.

The fixture uses an explicit fixture-only receipt store for replay/conflict
behavior. Brain currently has durable Root Goal/Jarvis ownership but no
canonical conversational text-intake queue, so V0-A does not claim production
exactly-once intake. MLX Whisper and FluidVoice remain separate retained media
capabilities and are not invoked or modified. Voice control intents require a
non-voice confirmation path, and `interrupt_output` can affect only transport
output; it cannot cancel Brain work. Workers cannot emit user-facing voice.

Evidence: `operations/reports/agent-mode-v0-a-voice-transport-contracts-evidence-2026-09-14.md`.
Exact next bounded slice: **V0-B — Push-to-Talk Input and Local Speech-to-Text
Adapter**, including the production durable text-intake prerequisite; do not
start it automatically.

### V0-B — Push-to-Talk Input and Local Speech-to-Text Adapter

**Status:** COMPLETE for the bounded durable intake, authenticated push-to-talk,
and deterministic local STT adapter gate; V0 remains IN PROGRESS

V0-B adds `agent-mode.jarvis-text-intake.v1` as the single Brain-owned domain
service for typed and voice submissions. It persists only canonical text hashes,
root/task ownership, operator identity, and an idempotency record; the root task,
persistent `agent:jarvis` owner, intake record, and acceptance event commit in
one StateStore transaction. Root and task identities are deterministic from the
intake identity, so restart and concurrent retries converge without a process
local ledger. Raw transcripts are not persisted.

The authenticated Core route is `POST /agent-mode/jarvis/intake` and requires
the narrow `agent-mode.intake` service capability. Brain Console server routes
enforce the local operator session, same-origin provenance, CSRF, and loopback
transport before proxying a signed Core request. The browser cannot choose the
operator, root, task, Jarvis agent, policy, budget, runtime, or model.

`MlxWhisperSpeechToTextProvider` is a local `SpeechToTextProvider` adapter with
explicit argv (`shell: false`), bounded stdout/stderr, timeout handling, WAV
header/duration/size validation, private temporary audio cleanup, and a
fail-closed resource lock. Executable/model/lock paths are server configuration;
there is no auto-download or provider/network probe. Deterministic process
fixtures prove the adapter seam; live MLX inference remains deferred until host
resource coordination with the retained Bible Studies transcription pipeline is
explicitly verified.

`/agents` adds explicit push-to-talk. Recording starts only after a user click,
returns a bounded transcript for review, and requires a separate Submit action
before durable intake. Failed, rejected, or discarded audio never creates a
root. No voice control phrase reaches lifecycle control authority.

Evidence: `operations/reports/agent-mode-v0-b-push-to-talk-local-stt-evidence-2026-09-15.md`.
Exact next bounded slice: **V0-C — Jarvis Text-to-Speech Output and Interruptible
Playback**; do not start it automatically.

### V0-C — Jarvis response boundary, generation, and interruptible playback

**Status:** V0-C COMPLETE through V0-C2; V0 remains IN PROGRESS; V0-D phase
exit audit is not started

The V0-C response-boundary slice established the immutable,
`agent-mode.jarvis-user-response.v1` publication and read path. The V0-C1
prerequisite now adds two narrow Brain-owned source seams:
`agent-mode.jarvis-task-input.v1` retains bounded canonical original intent for
the root lifecycle, and `agent-mode.jarvis-readable-result.v1` retains bounded,
explicitly Jarvis-readable business facts linked to an authoritative successful
K5 organization final result. Neither seam is a chat history, raw runtime
output archive, or duplicate K4 result ledger.

`JarvisResponseFinalizer` is the only production response-text producer in
this slice. It uses deterministic strategy A because the fixture's explicit
task intent and bounded structured facts contain meaningful user-facing
content. It requires a completed successful K5 result, exact root/task
lineage, valid source/evidence linkage, and durable source records; it accepts
no caller response text, model, provider, speaker, or worker authority. It
generates bounded natural text and publishes only through
`JarvisUserResponseService`, with deterministic operation identity and
restart/concurrency-safe idempotency.

K4 receipts remain execution evidence and K5 final results remain aggregate
authority; neither is stringified into an answer. Workers cannot publish
user-facing responses. No model call, ModelGateway path, TTS provider, playback
loop, interrupt mutation, provider probe, or external effect is introduced.

V0-C2 completes the remaining bounded speech-output slice with a browser-local
`SpeechSynthesis` transport. It consumes only the canonical published Jarvis
response from `GET /agent-mode/jarvis/responses/:rootGoalId`, validates the
closed response schema, and uses the exact Brain-owned response text. The
speech request/receipt contract is versioned, its output identity is derived
from response identity plus transport version, and playback states are bounded
and interruptible. `Stop speaking` calls only the browser transport cancel
operation; it cannot cancel, pause, retry, or otherwise mutate Brain work.

The transport is feature-detected and unavailable is explicit when browser
speech is unsupported. It has no credentials, provider probe, server TTS
ledger, audio-file path, network call, model/runtime effect, or worker speech
path. Late completion/error callbacks are fenced after interruption, and
explicit replay reuses the same canonical response and output identity.

Evidence: `operations/reports/agent-mode-v0-c-jarvis-tts-interruptible-playback-evidence-2026-09-15.md`.
V0-C is complete for the bounded response and speech-output contract; live
audible acceptance remains a manual browser/device check classified B. V0-D
audits the complete gateway over the durable Jarvis/K4/K5 path, including typed
and voice parity, replaceable transports, explicit non-authoritative voice
approval semantics, interruption races, bounded retention, and a deterministic
offline STT → K5 → Jarvis response → speech fixture. The audit passes: no live
model/provider, network, BrainNode, Harness, Workcell, or lifecycle-control
effect is introduced, and wake word remains a non-blocking future deferral.

Evidence: `operations/reports/agent-mode-v0-d-voice-gateway-exit-audit-2026-09-15.md`.
**V0-D COMPLETE; V0 COMPLETE.** The exact next phase is **Phase D0 — distribution
and always-on options**. Do not start D0 automatically.

## Phase D0 — distribution and always-on options

**Status:** D0-A COMPLETE; D0-B COMPLETE; D0-C COMPLETE; D0-D COMPLETE; D0-E COMPLETE; D0 remains IN PROGRESS

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

### D0-A — Portable Core Configuration Profile and Host-Neutral Runtime Contract

**Status:** COMPLETE. D0 remains IN PROGRESS.

D0-A establishes the versioned `brain-runtime-config-v1` contract and one strict
Brain Core loader. Its lean-core profile contains the Core API, SQLite reference
StateStore, Brain Console/Core URL boundary, home/config-derived runtime paths,
BrainNode configuration root, scheduler/control surfaces, durable Agent Mode,
and provider/resource interfaces. Personal integrations, secrets, and
runtime-generated state remain separate categories; personal profiles are
opt-in and secret values are never profile material.

Resolution is deterministic: safe built-in defaults, portable profile, host-local
profile, then known environment compatibility/override variables. JSON profiles
are strict and versioned; unknown keys, invalid ports/URLs, unsafe paths, and
unsupported StateStore kinds fail closed. Defaults derive from `HOME`/portable
state roots and contain no Office or MacBook path. `BRAIN_AGENT_MODE_STATE_DIR`,
`BRAIN_CORE_HOST`, and `BRAIN_CORE_PORT` remain compatible overrides. The
read-only `brain-agent config validate` command reports only normalized
non-secret configuration and capability availability; it performs no provider,
network, runtime, scheduler, or StateStore write operation.

Missing MLX, SpeechSynthesis, Bedrock, Tailscale, Workcell tooling, Mind, Bible
Studies, FluidVoice, and other personal integrations do not prevent the lean
core from being constructed; they are unavailable/optional capability states.
SQLite is the D0-A reference backend behind the existing StateStore abstraction;
Postgres/DynamoDB, installers, packaging, VPS/Tailscale deployment, AgentCore,
and export/import remain later slices. D0 work does not claim H0 unattended or
distributed release readiness.

Evidence: `operations/reports/agent-mode-d0-a-portable-core-config-evidence-2026-09-15.md`.
Exact next bounded slice: **D0-B — Reproducible Lean-Core Bootstrap and Dry-Run
Installer**; do not start it automatically.

### D0-B — Reproducible Lean-Core Bootstrap and Dry-Run Installer

**Status:** COMPLETE. D0 remains IN PROGRESS.

D0-B adds the deterministic `brain-bootstrap-plan-v1` contract and the
read-only `brain-agent bootstrap plan --dry-run` CLI. The planner inspects
only local platform, architecture, Node/npm, source manifests/revision,
installation/state layout, and explicit secret-presence metadata. It emits a
bounded source-development or packaged-release plan with fixed Core/Console
components, `npm ci`/build actions, smoke checks, startup commands, and an
explicit not-installed service plan.

The plan is data only: it never installs packages, copies/stages files,
registers or starts services, creates StateStore data, launches BrainNode or
Harness, contacts a provider/network, or chooses models, credentials,
capabilities, or personal integrations. Installation targets are fresh,
compatible, unknown, or conflict states and are never overwritten. State is
separate from source/install roots; critical runtime paths are absolute or
home-relative; release provenance is supplied rather than inferred from a
mutable checkout. Node `>=22.5.0` and npm `>=10.0.0` are the supported
toolchain contract, with npm lockfile/build actions retained for the future
explicit staging/install slice.

Optional staging/execution is intentionally skipped in D0-B. Existing
installation detection, rollback metadata, service registration, packaging,
and real installation remain later D0 work. The exact next bounded slice is
**D0-C — Portable Runtime Packaging Contract**; do not start it automatically.

Evidence: `operations/reports/agent-mode-d0-b-lean-core-bootstrap-evidence-2026-09-15.md`.

### D0-C — Portable Runtime Packaging Contract

**Status:** COMPLETE. D0 remains IN PROGRESS.

D0-C establishes the versioned `brain-runtime-package-v1` boundary and the
read-only package verifier plus explicit `brain-agent package build` and
`brain-agent package verify` seams. Core uses strategy B: prebuilt JavaScript
`dist` with runtime `package.json`/lockfile metadata for later production
dependency hydration. Console uses narrowly verified Next standalone output,
including its traced runtime, required `.next` server assets, `.next/static`,
and existing `public` assets, while excluding `.next/cache` and build traces.

The package tree is allowlisted, path-normalized, symlink-free, mode-normalized
to non-writable `0644` files, bounded to 20,000 files/100 MiB per file/500 MiB
total, and verified by exact file set, size, SHA-256, package identity, and
manifest hash. It contains only Core runtime JS/metadata, Console standalone
runtime/static assets, and a safe `brain-runtime-config-v1` example template.
Secrets, mutable StateStore/runtime data, logs, credentials, personal
integrations, source checkout metadata, and personal absolute paths are
excluded or sanitized. Package identity includes release revision, component,
runtime, platform, architecture, dependency strategy, and file hashes, never
HOME, staging roots, timestamps, or secrets.

D0-C does not install or activate packages, run npm hydration, register or
start launchd/systemd services, deploy VPS/Tailscale, or start H0. Builds and
verification use local artifacts and no network. The real standalone Console
artifact was started from an isolated package root on a temporary port and
served `/agents` successfully. D0-B evidence did not contain its terminally
reported 2,588/2,588 full-suite aggregate; D0-C records only its own observed
validation. The exact next bounded task is **D0-D — Local macOS/Linux Runtime
Installation and Service Packaging Contract**; do not start it automatically.

Evidence: `operations/reports/agent-mode-d0-c-portable-runtime-packaging-evidence-2026-09-15.md`.

### D0-D — Local macOS/Linux Runtime Installation and Service Packaging Contract

**Status:** COMPLETE. D0 remains IN PROGRESS.

D0-D adds `brain-local-install-v1` and `brain-service-package-v1`. An explicit
local install apply verifies `brain-runtime-package-v1` before copying it into
a versioned release root, keeps state/config/services separate, preserves an
existing config, records a bounded non-domain install receipt, and converges
on repeated installation of the same verified package. Unknown/non-empty
targets and failed verification fail closed without writes; different package
content is never merged into an existing target. Core's production dependency
strategy is explicitly `npm ci --omit=dev` with lockfile enforcement; live
hydration may require registry access, but D0-D tests use a fake hydrator and
perform zero network access. Console's standalone-traced closure requires no
additional hydration.

The service package is host-neutral and user-scoped. macOS renders inert
LaunchAgent plist descriptors (`com.brain.core`, `com.brain.console`); Linux
renders inert `systemd --user` units. Both use structured executable/argv,
target-local config and external mode-protected secret references, bounded
restart policy, and `activation: not-registered`. No launchctl/systemctl/sudo,
service registration, service start, OS-user creation, current Office change,
or Brain lifecycle mutation occurs. Node remains an external validated
`>=22.5.0` prerequisite; no Node bundle or automatic download is claimed.
BrainNode remains a generic optional boundary and the existing `ssh:macbook`
deployment is not reused or encoded.

Temporary macOS/Linux fixtures prove installation, descriptor generation,
separation, idempotency, cleanup, and security. D0-D provides portable
user-service packaging, not H0 unattended-release approval. State migration,
service activation/cutover, and VPS/Tailscale deployment remain later work.
The exact next bounded task is **D0-E — StateStore Export/Import and
Control-Plane Relocation Contract**; do not start it automatically.

Evidence: `operations/reports/agent-mode-d0-d-local-install-service-packaging-evidence-2026-09-15.md`.

### D0-E — StateStore Export/Import and Control-Plane Relocation Contract

**Status:** COMPLETE. D0 remains IN PROGRESS.

D0-E establishes the backend-neutral `brain-state-snapshot-v1` logical
StateStore transfer boundary. Final export is offline/quiesced and read-only;
raw SQLite/WAL copying is not the public contract. Snapshots are bounded,
deterministically identified and hashed, owner-only local artifacts that
preserve domain IDs, event order, exact-once material, review/attention,
scheduler, Jarvis, and K5 state without exporting credentials. Import targets a
fresh current-schema StateStore only, uses one transaction and foreign-key
verification, and performs no service activation, runtime replay, provider
call, or network transfer. Host-local PIDs, leases/fences, dispatch, and
UNCERTAIN effects remain evidence requiring existing recovery/reconciliation;
they are never blindly trusted, reset, or replayed.

Evidence: `operations/reports/agent-mode-d0-e-state-relocation-evidence-2026-09-15.md`.
The D0 exit gate is classification **B**: the relocation contract is proven,
but an isolated local cutover/recovery drill remains. Exact next bounded task:
**D0-F — Control-Plane Relocation Cutover and Recovery Drill**; do not start it automatically.

### D0-F — Control-Plane Relocation Cutover and Recovery Drill

**Status:** COMPLETE. D0 exit gate PASSED; D0 is COMPLETE.

D0-F proves the bounded offline cutover procedure on isolated fixtures:
closed/quiesced source, final logical snapshot, verification, portable target
package/install, fresh import, evidence-backed readiness, foreground target
startup, semantic validation, clean target restart, and source remaining
inactive. Readiness derives actual package/install/config/secret/store and
host-authority evidence; caller-provided booleans cannot authorize activation.
Imported PIDs are never signalled, stale lease/fence evidence is not reused,
safe re-admission uses normal K4 recovery with a fresh fence, and uncertain
effects remain non-replayable. There is no service-manager registration,
automatic source failback, split-brain mode, live Office cutover, or remote
deployment.

Evidence: `operations/reports/agent-mode-d0-f-control-plane-cutover-evidence-2026-09-16.md`.
The next authoritative phase is **Phase H0 — long-duration hardening**; do not start it automatically.

## Phase H0 — long-duration hardening

**Status:** IN PROGRESS; final soak/release gate. D0 remains COMPLETE and is not reopened by H0.

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

### H0-A — Deterministic Fault-Injection Matrix and Soak Harness Foundation

**Status:** COMPLETE for the deterministic, isolated fixture harness only.

H0-A introduces test-only versioned scenario/result contracts, a closed action
vocabulary, monotonic logical clock, bounded deterministic runner, safety and
liveness monitors, and a gate that refuses to infer PASS from missing coverage.
The fault inventory reuses existing Brain fixtures for provider failures,
budget/quota admission, crash/recovery, fencing, duplicate delivery, host/node
reconnect, spawn policy, restricted Harness denial, corruption rejection, and
D0 restart/cutover. The matrix distinguishes existing fixture evidence from
remaining composed coverage and later live acceptance. No production chaos
endpoint, alternate scheduler, recovery policy, or StateStore was added.

Accelerated fixture time is not wall-clock runtime. H0 remains **IN PROGRESS**;
multi-hour wall-clock soak and security release review remain **NOT RUN** and
the H0 gate is **INCOMPLETE** until their explicit evidence is present. No live
provider or Office state is used by H0-A. Exact evidence:
`operations/reports/agent-mode-h0-a-hardening-harness-evidence-2026-09-16.md`.

Exact next bounded task: **H0-B — Multi-Hour Isolated Autonomous Soak and
Resource-Stability Acceptance**. Do not start it automatically.

### H0-B — Multi-Hour Isolated Autonomous Soak and Resource-Stability Acceptance

**Status:** COMPLETE for the isolated six-hour wall-clock acceptance. H0 remains
**IN PROGRESS** and its release gate remains **INCOMPLETE**; live provider
acceptance and the dedicated security release review are not claimed.

H0-B runs only as an explicit test command against a fresh temporary HOME,
TMPDIR, SQLite StateStore, and session-owned foreground fixture worker. It uses
the existing K4 scheduler, StateStore, reservation, lease/fence, node,
restricted-profile, and MockAgentRuntime fixtures. It does not add a production
fault endpoint, alternate control plane, daemon, provider probe, or live
runtime path. The final measured preflight passed 30/30 one-minute cycles and
froze full-sample resource ceilings with explicit headroom. The definitive
acceptance then passed `21,600,004.877417 ms` monotonic elapsed time, `360/360`
cycles, zero missed cycles, twelve verified half-hour fault points, two
scheduled two-hour process restarts plus a final clean reconstruction, zero
threshold failures, and zero invariant failures. SQLite main-file, WAL, and
SHM telemetry are recorded separately so normal WAL checkpoint relocation does
not become a false leak signal; the bounded main-file ceiling remains enforced.

The fixture retained one completed K4 lifecycle and one expired stuck-child
fixture for durable reconciliation checks. Final integrity was one Task, one
Run, one Attempt, one receipt, one evidence ref, zero active children, zero
foreign-key violations, zero reserved/used fixture budget, and no runtime
replay. No live Bedrock/Codex/MiniMax/GLM/Opus call, Harness, BrainNode,
Workcell, SSH/Tailscale, Office StateStore, network, service-manager, or
production repository effect occurred. H0-B is not evidence for live or
security release readiness.

Evidence:
`operations/reports/agent-mode-h0-b-wall-clock-soak-evidence-2026-09-17.md`.

Exact next bounded task: **H0-C — Security Release Review and Live Acceptance
Audit**. Do not start it automatically.

### H0-C — Security Release Review and Live Acceptance Audit

**Status:** AUDIT COMPLETE; H0 remains **IN PROGRESS** and its release gate is
**INCOMPLETE**.

H0-C completed the current-build security release review across the Brain
Console/browser boundary, Console server, Core API, service authentication,
operator session/origin/CSRF boundary, control/review authority, StateStore,
lease/fence, budget/spawn, runtime/Harness, NodeTransport, Jarvis ingress and
speech boundaries, D0 relocation, and H0 test-only surfaces. The review found
no BLOCKER or HIGH security finding. The review contract is test-only
`agent-mode.security-release-review.v1`; it is bounded metadata and does not
create a second policy or authority plane.

The local current-build acceptance passed the read-only Console projection ten
times and rejected an unauthenticated lifecycle mutation before body
authorization. H0-B's genuine isolated-process evidence is reused only for
process crash/restart, stale lease/fence, duplicate delivery, stuck-child TTL,
and durable auditability. Provider outage and remote-host loss remain
EXTERNAL_SENSITIVE and require separately authorized isolated resources.
Sandbox/tool live acceptance remains UNSUPPORTED/NOT RUN because no safe live
topology is authorized. Fixture evidence is never relabeled as live evidence.

The H0 gate still requires `live_pass` for every `liveAcceptanceRequired` class;
the security review is not allowed to turn the remaining external or
unsupported classes into PASS. No live provider, Office state, remote host,
SSH/Tailscale, service-manager, BrainNode, Workcell, repository, or network
effect was used. Evidence:
`operations/reports/agent-mode-h0-c-security-live-acceptance-evidence-2026-09-17.md`.

Exact next bounded prerequisite: obtain separate authorization and disposable
resource boundaries for the provider-outage and remote-host loss/reconnect
acceptance, then run only those narrowly scoped H0 live gates. Do not start
automatically.

### H0-D — Restricted Harness Live-Denial Acceptance and External Gate Authorization Readiness

**Status:** COMPLETE AS BOUNDARY AUDIT; H0 remains **IN PROGRESS** and its
release gate remains **INCOMPLETE**.

H0-D verified that the exact pinned DeepSeek Harness is locally available at
commit `c389f96bf3a9b6807cb71ed6bdad5849be0df6d8`, version `0.1.3-alpha.2`.
The existing production `RestrictedHarnessAgentRuntime` and focused tests
prove a separate child process, explicit complete child environment, pinned
process identity, bounded protocol, and deterministic reaping. That proof is
kept distinct from denial acceptance: the current safe adapter exposes only a
fixture provider and no tools, so sandbox/tool live denial cannot be genuinely
exercised without adding an unapproved live topology or widening authority.
Those classes remain `UNSUPPORTED` / `not_run`.

Provider outage and remote-host loss remain `EXTERNAL_SENSITIVE` / `blocked`.
H0-D records exact future packets bounded to one disposable Bedrock request
with zero retries/cost and one disposable remote BrainNode `repo.read` test
with zero repository writes. No provider, credential, remote host,
SSH/Tailscale, Office state, network, BrainNode, Workcell, or production
repository effect was used. The H0 gate continues to require `live_pass` for
every live-required class. Evidence:
`operations/reports/agent-mode-h0-d-live-boundary-readiness-evidence-2026-09-17.md`.

Exact next prerequisite: separately authorize the disposable provider and
remote BrainNode packets, and resolve a safe supported restricted-runtime
denial topology before attempting the remaining H0 live gates. Do not start
automatically.

### H0-E — Restricted Harness Live-Denial Topology Closure

**Status:** COMPLETE AS TOPOLOGY AUDIT; H0 remains **IN PROGRESS** and its
release gate remains **INCOMPLETE**.

H0-E audited the exact pinned SDK's tool registry and error semantics. The SDK
has a stable `UNKNOWN_TOOL` path for names absent from the registry, but Brain's
production restricted composition registers only the fixture LLM adapter,
injects no tools, and exposes no sandbox/filesystem service. The safe fixture
provider cannot synthesize a tool call into a capability surface that is not
present. No production denial flag, tool registration, sandbox authority,
provider/network path, or fault API was added. Sandbox and tool denial remain
`UNSUPPORTED` / `not_run` pending a separately approved supported topology.

The production restricted-runtime and profile import boundary remains closed;
H0-E helpers are test-only. Existing isolated-process evidence continues to
prove the pinned child, explicit environment, identity, bounded protocol, and
reaping, but no H0-E denial child was launched because there was no valid
denial target. Provider outage and remote-host loss remain
`EXTERNAL_SENSITIVE` / `blocked`; their H0-D packets were revalidated without
execution. Evidence:
`operations/reports/agent-mode-h0-e-restricted-harness-live-denial-evidence-2026-09-17.md`.

Exact next prerequisite: obtain security-approved support for a harmless
restricted denial topology, or formally review the live-required classification
for capabilities absent from Brain's production composition; separately
authorize the existing H0-D disposable provider and remote-node packets. Do
not start automatically.

### H0-F — Absent-Capability Security Gate Classification Review

**Status:** COMPLETE; H0 remains **IN PROGRESS** and its release gate remains
**INCOMPLETE**.

H0-F reviewed whether `sandbox_denial` and `tool_denial` can be accepted from
structural absence in the current Brain production composition. The exact
pinned DeepSeek Harness SDK (`c389f96bf3a9b6807cb71ed6bdad5849be0df6d8`,
`0.1.3-alpha.2`) contains a tool registry, reserved `run_code` PTC transport,
code-runtime support, and test-surface terminal/filesystem/subprocess paths.
Brain's production restricted profile does not inject those surfaces: it uses
an explicit patch list, an empty runtime tool allowlist, an explicit complete
child environment, and a fixture-only LLM bridge. The tool and sandbox attack
graphs therefore terminate at structural absence/unreachability in production;
they are not relabeled as `live_pass`.

The hardening matrix now has an explicit `acceptanceRequirement` separate from
the historical H0-C `liveAcceptanceRequired` review dimension. Both absent
capability classes require `structural_pass` plus bounded structural evidence.
Missing structural evidence, fixture evidence, or `live_pass` alone remains
incomplete. Any future production tool/sandbox authority, pinned Harness
change, or production composition/injection change invalidates this evidence
and reopens the relevant live/structural review. Provider outage and remote
host loss remain the only external-sensitive blockers; this review did not
contact either resource or any network/provider/runtime boundary.

Evidence:
`operations/reports/agent-mode-h0-f-absent-capability-gate-review-evidence-2026-09-17.md`.

Exact next prerequisite: separately authorize the existing disposable
provider-outage and remote-BrainNode packets; do not start automatically.

### H0-G — Disposable External Live Acceptance — 2026-09-17

**Status:** BLOCKED; H0 remains **IN PROGRESS** and its release gate remains
**INCOMPLETE**.

The current H0-G task explicitly authorized the existing disposable provider
outage/recovery and remote-BrainNode host-loss/reconnect packets. A bounded
preflight recognized that authorization, froze a USD 2.00 total-spend cap and
an exact-ID cleanup manifest, and selected `us-east-1`, MiniMax M2.5, and the
EC2 `t3.micro`/8 GiB gp3 shape. The first required disposable IAM role create
was denied because the configured provisioner lacks `iam:CreateRole`. No
provider role, instance profile, EC2 instance, S3 object, remote node, live
Bedrock request, or inference was created or run. The temporary run root was
removed and exact-name/tag checks found zero H0-G resources remaining.

The provider and remote packets therefore remain `BLOCKED`, not `live_pass`.
H0-F's `structural_pass` results, H0-B wall-clock evidence, and H0-C security
audit remain valid because no production runtime or security-sensitive source
changed. Evidence:
`operations/reports/agent-mode-h0-g-external-live-acceptance-evidence-2026-09-17.md`.

Exact remaining prerequisite: grant the approved non-production provisioning
path the dedicated disposable IAM create/policy/profile permissions, then
rerun this same bounded H0-G packet. Do not use a shared or production
identity/resource.

### H0-G2 — Corrected Disposable External Live Acceptance — 2026-09-17

**Status:** BLOCKED; H0 remains **IN PROGRESS** and its release gate remains
**INCOMPLETE**.

The corrected rerun used the approved dedicated `claude-codex-ec2-*` IAM
namespace and successfully created and destroyed one bounded `t3.micro` EC2
instance, profile, role, and security group. The real Brain Bedrock gateway
produced one valid MiniMax baseline result from the instance profile. The
temporary exact deny-policy outage attempt unexpectedly succeeded and is
therefore inconclusive, not a live outage pass. The real `SshNodeTransport`
path reached the SSM proxy boundary but could not start because the local
`session-manager-plugin` is unavailable; no inbound SSH was opened and no
BrainNode domain command ran.

No production source, shared IAM, provider configuration, repository, or
protected unrelated path changed. Exact-ID destroyer verification found zero
remaining disposable resources. Full evidence:
`operations/reports/agent-mode-h0-g2-external-live-acceptance-evidence-2026-09-17.md`.

Exact remaining prerequisite: make the approved local SSM session plugin
available and resolve why the exact temporary deny policy did not deny the
instance-profile call, then rerun only the same bounded two external gates.
Do not start automatically.

## Phase K3.6 — foundation audit, consolidation and K4 readiness

**Status:** complete for the 2026-09-09 audit; K4 remains not started

The K3.6 audit verified the current Agent Mode architecture, model policy,
launcher/session selectors, local-AI boundaries, security invariants, naming,
documentation, and extension seams. It consolidated current documentation
around the durable chain:

```text
Brain Kernel → Model Gateway → Node Transport → Workcells
→ Validation/Review → Commit → Merge → Observer
```

Auto starts MiniMax M2.5, Brain-owned escalation is MiniMax M2.5 → GLM-5 →
Claude Opus 4.6, Amazon Bedrock is the default execution resource, and Codex
remains separate/manual. Local text LLM routes are retired; local voice,
speech, image, and media utilities remain separately classified.

The audit found no K4 implementation in the bounded Agent Mode surfaces.
Foundation readiness is **READY WITH CONDITIONS**: the architecture and
security gates pass, but the current shared worktree is intentionally dirty
and must be separated into reviewed commits before any K4 work is landed.
MacBook local-media inventory also remains unresolved and is not inferred from
Office.

Evidence: `operations/reports/agent-mode-k3-6-foundation-audit.md`.

## Phase K3.7 — operational baseline cleanup and K4 readiness

**Status:** complete for the 2026-09-09 baseline audit; K4 remains not started

The K3.7 audit classified all current Git status entries: 20 modified files and
64 untracked files (the audit report itself is included). They are required Agent Mode source, tests, fixtures,
runbooks, evidence reports, scripts, or documentation. No unknown status item,
safe obsolete local-AI artifact, or generated artifact was removed. The
worktree remains intentionally dirty and must be isolated into a reviewed
landing boundary before K4 implementation.

The audit reconfirmed the cloud-only text policy, retained local voice/speech
and media consumers, exact Auto/manual selector choices, current architecture
docs, K4 prerequisites, typecheck/build/focused tests, safety scans, script
validation, and diff checks. MacBook local-media inventory remains unresolved
and must not be inferred from Office.

Evidence: operations/reports/agent-mode-k3-7-operational-baseline-evidence.md.

## Phase K3.8 — reviewed foundation landing boundary

**Status:** complete for the 2026-09-10 landing; K4 ready but not started

The completed K0–K3.5 foundation was reconciled against the K3.7 inventory,
secret-scanned, validated, reviewed, and landed in five local logical commits.
The final worktree is clean and the implementation is reproducible from Git
history. No unrelated path, generated binary, credential, private runtime
state, or K4 implementation was included.

The exact commit grouping, SHA list, validation results, rollback guidance,
remaining-status result, and K4 decision are recorded in:

operations/reports/agent-mode-k3-8-foundation-landing-evidence-2026-09-10.md

At the landing boundary K4 remained separately authorized and K4.0 was the
exact next task. K4.0 and K4.1-A are now recorded in Phase K4; K4.1-B must not
start automatically.

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

## Historical implementation handoff

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
