# Brain Agent Mode Runtime Roadmap

**Status:** authoritative direction; principal review approved with changes; A0.2/A1 offline gates plus K0.1–K0.4 fixture gates passed; K0–N0, K3.0–K3.4, K3.5-A–D, K3.6, and K3.7 are complete for their bounded gates; the K3 exit gate is complete; K4.0, K4.1-A, K4.1-B1, and K4.1-B2 are complete, K4 remains in progress, and K4.1-C is not started
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

**Status:** K4.0 and K4.1-A complete; K4 remains in progress; K4.1-B and dynamic workers not started

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
