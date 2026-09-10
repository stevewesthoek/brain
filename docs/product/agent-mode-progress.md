# Agent Mode Progress

## Agent Mode architecture handoff — 2026-09-08

The next Brain phase is Agent Mode / Bring Brain Alive. The authoritative plan is
`operations/specs/agent-mode-runtime-roadmap.md`; the discovery evidence is
`operations/reports/agent-mode-discovery-2026-09-08.md`. Principal review:
`operations/reports/agent-mode-astra-review-2026-09-08.md` — **APPROVE WITH CHANGES**.

### Agreed architecture

- Brain is the deterministic control plane: durable agents/tasks/runs/attempts,
  append-only events/evidence, scheduling, leases, budgets, approvals, recovery,
  node/capability registry, and agent-spawn policy.
- Jarvis is the persistent human-facing executive agent, not the kernel. Jarvis
  may eventually create worker identities autonomously, but deterministic policy
  limits roles, capabilities, budget, TTL, spawn depth, concurrency, scope, and
  kill switches.
- Auto root/planning intelligence always begins with a MiniMax M2.5 scout;
  Brain-owned quality/validation escalation is MiniMax M2.5 → GLM-5 → Claude
  Opus 4.6. Completed planning packages receive fresh cheapest-capable
  execution admission; provider failures do not count as reasoning failures.
- Autonomous work defaults to Amazon Bedrock. Codex remains a separate
  ChatGPT-subscription-backed runtime/resource whose quota state is observable;
  automatic Codex use must preserve a configurable reserve for manual use.
  Unknown/stale quota denies automatic admission; Bedrock errors never silently
  spend the Codex reserve.
- The generic Bedrock provider/transport must migrate away from legacy
  `claude-bedrock` naming toward `amazon-bedrock`, with
  vendor/model identity separated from transport.
- Core portability seams are `StateStore`, `ModelGateway`, `AgentRuntime`,
  `ExecutionResource`, `CapabilityProvider`, and `BrainNode/NodeTransport`.
  SQLite WAL is the first StateStore implementation, not the architecture.
  ExecutionResource and BrainNode are descriptors; NodeTransport stays thin.
  Reuse infrastructure resource/account/runtime-profile/credential identities
  rather than creating a second catalog. Use one controller with private local
  state outside checkouts; remote nodes never share its SQLite files.
- Enforce every model/tool/child operation at the gateway/broker/node boundary,
  including runtime built-ins and auxiliary model calls. Atomically record
  claims, budget reservations, fenced leases and dispatch outbox entries;
  deduplicate receipts and preserve uncertain outcomes without blind replay.
  Safety/recovery gates apply from the first fixture, not only final hardening.
  Opaque subscription runtimes use declared whole-attempt resource controls;
  deny tasks needing finer controls their supported interface cannot enforce.
- Office is the first BrainNode. MacBook must be the second instance of the same
  portable protocol after read-only inventory/connectivity succeeds. A future
  VPS/macOS/Linux deployment must not require domain-model rewrites.
- Brain Console is the primary dashboard/control surface; Obsidian/Mind, IDEs,
  CLIs, and optional specialist UIs remain complementary clients over durable
  Brain APIs/events. Voice is a transport over Jarvis, not a parallel agent
  control plane.

### Upstream reuse policy

- DeepSeek Harness decision: **USE PARTIALLY**, through a pinned, restricted SDK
  composition only after admission fixtures and an integration spike pass.
  Default/minimal profiles are not safe Brain policy boundaries as shipped.
  Reuse loop/tool/context/session mechanisms, not its scheduling/organization
  authority. If conformance fails, build only the missing minimal runtime.
- OmniRoute is an optional `ModelGateway` candidate/reference for quota/cost/
  health-aware routing. Native Amazon Bedrock remains the v1 reference gateway
  without requiring an OmniRoute prototype in A0. Current bearer-key Bedrock
  authentication and feature fidelity need proof before any later adapter use.
- Orca contributes fleet/worktree/remote/usage UX patterns; Brain Console remains
  the control plane.
- Omarchy contributes agent-friendly OS/event integration patterns, not Brain's
  orchestration kernel.

### Local inference policy

Cloud-only applies to general-purpose/text LLM reasoning, not to every local ML
capability.

Cleanup targets after exact dependency checks are Ollama, MTPLX/Qwen local text
routes/tooling, oMLX/Gemma text serving, LM Studio text-model residue, local
text-model weights/caches, stale launchers, and current operational references.
Video Orchestrator's previous oMLX text dependency is not a retention reason; it
will use cloud text inference when that product is resumed.

Known non-text capabilities are separate:

- FluidVoice local MLX voice stack: **keep**; active personal voice use.
- MLX Whisper large-v3: **keep while consumed**; the nightly Bible Studies
  transcription pipeline explicitly invokes it.
- `faster-whisper`: **separate media capability**; installed/referenced for Video
  Orchestrator subtitle/transcription work, not part of text-LLM cleanup.
- ComfyUI/local image generation: **separate media capability**; registered and
  referenced by video/image workflows, requiring its own current-use audit
  before any removal.
- Historical Stable Diffusion/Wave/FLUX/Roop-era local media references must be
  classified individually rather than swept into text-LLM cleanup.

MacBook local-model/media state is still unresolved. Do not infer its inventory
from Office and do not perform cleanup there until read-only host inventory
succeeds.

### Current implementation order

1. **A0 — minimal contracts + runtime admission spike**
2. **A1 — staged generic Amazon Bedrock/provider normalization**, alongside K0
3. **K0 — durable Brain kernel + local BrainNode envelope**, using canonical IDs/mocks
4. **K1 — model/resource gateway**
5. **K2 — one Jarvis + one worker + one read-only capability**, with minimal human controls
6. **N0 — remote extension of the same BrainNode protocol**
7. **K3 — safe coding autonomy/worktrees**
8. **K4 — event-driven autonomy + bounded dynamic workers**
9. **K5 — multi-agent organization**
10. **U0 — unified Brain Console control surface**
11. **V0 — Jarvis voice gateway**
12. **D0 — distribution / VPS / commercial extraction options**
13. **H0 — long-duration soak/release gate**; safety checks apply throughout

A0.1 **offline attempt-admission contracts and adversarial conformance fixtures**
is complete (principal review, section 14). A0.2's restricted ephemeral
overlay passes the pinned Harness SDK read-only, denied-shell, single-provider,
cancellation, and crash-after-effect reconciliation checks. The shipped
`sdk-minimal` base is still `danger-full-access` and includes
shell/filesystem/jobs surfaces, so upstream base adoption is **denied** while
the restricted replay proof is **passed**. Durable effect journaling belongs
to K0's SQLite StateStore. A1.1 completed the staged canonical provider
migration. A1.2 also keeps Bedrock selection side-effect-free:
selection reads cached evidence only, while explicit health probing remains
separate. A1.3 removed Qwen/Haiku assumptions from repo/session launchers.
K0.1 provided the fixture-backed SQLite-WAL StateStore foundation with
transaction rollback, lease fencing, and effect idempotency tests. K0.2 now
extends that same store with durable task/run/attempt admission, run-scoped
budget reservation and settlement, effect/outbox/receipt journaling,
cancellation state, stale-fence protection, append-only evidence and
restart-safe crash recovery classifications. K0.3 now adds the portable,
non-listening local BrainNode command/receipt envelope, deterministic fixture
authentication, canonical resource/worktree containment, and one bounded
`repo.read` capability with node-side grant/scope/policy/deadline/cancellation/
fence/outbox enforcement plus durable receipt reconciliation. K0.4 now adds a deterministic mock AgentRuntime, typed broker-to-
BrainNode execution, durable verification/settlement/terminal state,
crash/reopen recovery, and a versioned read-only StateStore observer projection.
Existing approval/snapshot surfaces remain explicitly compatibility data. K0 is
complete for the offline fixture/kernel gate; live execution remains gated.
K1.1 and K1.2 are complete for the native Amazon Bedrock ModelGateway,
account/model access verification, and the offline model-tier routing,
budget, health, and escalation policy gate. K0 must pass before
K1/K2 live admission; a full historical rename or paid three-model matrix does
not block mocked kernel work. C0 local-text cleanup is a separate manifest-first
lane and may not remove non-text media capabilities without their own consumer
classification. Tailscale is an optional network overlay, not a node transport;
a VPS is a deployment location. The local envelope exists before live execution.

### K1.1 — native Bedrock gateway and access verification (2026-09-08)

K1.1 is complete for the native gateway/access gate. The exact MiniMax M2.5,
GLM-5, and Claude Opus 4.6 identities were catalog/model-card verified in
`us-east-1`; the US Opus inference profile was active; and one tiny authorized
Converse probe was run for each target. The redacted identity/region/route/
freshness evidence is recorded in
`operations/reports/agent-mode-k1-1-evidence-2026-09-08.md`.

Brain Core now owns an admitted-only, transport-swappable ModelGateway over the
bounded managed AWS CLI Converse transport. It rejects arbitrary model routes,
stale or mismatched access evidence, expired deadlines, and provider failures
with bounded classifications. It normalizes usage/route/region/latency and
final text, explicitly excluding MiniMax reasoning-content blocks. Existing
ordinary model selection remains read-only with no incidental AWS probe;
selection is governed by the new Brain-owned policy layer; the generic selector
remains compatibility-only.

K1.3 is complete for the human/runtime integration surface. `repos.sh` and
`sessions.sh` always show the model/runtime selector with Auto first and
preselected; pressing Enter accepts Auto. Their `--choose-model` compatibility
alias and `--model` override contain exactly Auto, MiniMax M2.5, GLM-5, Opus
4.6, and Codex. Claude Code
launch/resume support remains internal but is not a normal selector entry;
`jump.sh` remains navigation-only.

Validation: the current R1 focused policy/gateway/live/control suite passes (48
policy tests and 59 scoped tests), selector shell checks pass, Brain Core
typecheck passes, and scoped diff checks are clean. K1 is complete for the
offline policy gate.

### K1.2 — deterministic model-tier/resource policy (2026-09-09)

Brain Core now exposes deterministic, cloud-only Agent Mode selection over the
fixed three-model portfolio. It checks Auto-first phase semantics, fit, fresh
evidence, cached health, budget envelopes, quality-only escalation, bounded
depth, and separate Codex quota admission.
No AWS model calls were made for K1.2.

K2 is complete for the bounded one-Jarvis/one-worker read-only vertical slice;
N0 is now complete for N0.1/N0.2. K3 was the exact next task at this
checkpoint. Current K2.1, K2.2, N0.1, and N0.2 evidence is recorded below.

### K1.3 — unified runtime surfaces (2026-09-09)

Brain is documented as the single control harness. DeepSeek Harness is an
internal optional AgentRuntime, Claude Code remains a dedicated Claude coding
runtime, Codex remains a subscription runtime, and Herdr is a workspace/fleet
surface that launches Brain. Explicit model requests are normalized through the
Brain policy before runtime admission.

K2.1-R1 is complete and verified. The pinned restricted Harness child,
parent-owned model/tool bridge, K0 read perimeter, Auto-first policy, durable
result path, simplified selectors, and CLI inspect/pause/resume/cancel/kill
surfaces are implemented and tested. One freshly authorized live default-Auto acceptance completed with
MiniMax, one read-only tool call, a final response, actual usage/cost
settlement, and StateStore reopen verification. The historical initial K2.1
failure evidence remains at
`operations/reports/agent-mode-k2-1-live-slice-evidence-2026-09-09.md`; R1
evidence is at
`operations/reports/agent-mode-k2-1-r1-auto-and-live-unblock-2026-09-09.md`.

The Brain session menu now routes selected durable runs to inspect, pause,
resume, cancel, and kill; the equivalent `brain-agent` commands work from
another terminal against the same StateStore. K2.2 adds mandatory five-entry
selectors, owned-process identity fencing, truthful cancellation, ten
process-loss classifications, safe re-admission, and fail-closed portability.
K2 is complete for its bounded scope.

### N0.1 — authenticated remote BrainNode transport (2026-09-09)

N0.1 is complete for its bounded scope. The thin `NodeTransport` seam now
supports local execution and strict SSH delivery of the same BrainNode
command/receipt contract. MacBook enrollment reuses `host:macbook` and
`node-instance:host:macbook`; negotiation admits only fresh, available
`brain-node-v1` nodes advertising exactly `repo.read`.

The bounded SSH preflight succeeded, and one harmless live MacBook `repo.read`
completed with HMAC provenance and durable Office StateStore reconciliation.
The short-lived runner uses temporary node-local state; no Office database is
copied, no model call was made, and no SSH/Tailscale configuration was changed.
Evidence: `operations/reports/agent-mode-n0-1-remote-node-evidence-2026-09-09.md`.
The focused runbook is `operations/runbooks/agent-mode-node-transport.md`.

### N0.2 — generic enrollment, reconnect safety and Office/MacBook parity (2026-09-09)

N0.2 is complete. The local transport now accepts an injected clock, fixing
the historical fixture-deadline regression without weakening deadline checks.
Enrollment identities are opaque configuration values validated against trusted
resource sets; SSH requires explicit enrollment, and the runner derives trusted
identity from node-local config rather than a compiled host list.

Synthetic Darwin and Linux enrollments pass through the same NodeTransport and
BrainNode code. A bounded atomic node-local dedup file makes identical delivery
safe across separate runner processes and rejects conflicting operation content.
Before-send failures remain retryable; sent-but-unreconciled failures use the
existing effect-observed/receipt-reconciliation state and are never marked
failed merely because SSH disconnected. Office remains the sole authoritative
StateStore.

The same `repo.read` task read `N0_2_MULTI_NODE_PASS` through Office local and
MacBook SSH transports, returned distinct correct node/transport identities,
and reconciled both receipts through Office. No model call, write capability,
shell, daemon, public listener, SSH/Tailscale change, or deployment outside the
bounded node-local scope occurred.

Evidence: `operations/reports/agent-mode-n0-2-multi-node-evidence-2026-09-09.md`.
N0 completion decision: **COMPLETE**. Exact next task: **K3 — safe coding
autonomy**. K3.0 is complete for the isolated Workcell foundation; K3.1 is
now complete for the writer-lease and diff-admission layer.

### K3.0 — safe coding Workcell foundation (2026-09-09)

K3.0 is complete for its bounded scope. The existing Office-authoritative
SQLite WAL StateStore now persists Workcell identities, allowed statuses,
repository bindings, owners, branches, worktree paths, lifecycle timestamps,
and Workcell receipts. `WorkcellManager` implements only `create`, `prepare`,
`inspect`, and `destroy`; it does not merge, approve, deploy, or provide a
coding agent.

The fixed Git adapter creates isolated `codex/workcell/<uuid>` worktrees under
an explicit root outside the primary checkout. It rejects invalid repository
refs, protected branches, in-checkout workcell roots, mismatched Git roots,
foreign Workcells, dirty destruction, and foreign-path cleanup. The future
capability boundary admits `repo.read` and `repo.write(workcell)` only;
`repo.write(main)`, shell, and arbitrary commands are denied.

Each lifecycle operation leaves durable evidence: created, prepared, destroyed,
or validation receipts with complete task/run/attempt/workcell/repository/actor
lineage, timestamp, operation hash, and result state. Interrupted preparation
cleanup and stale-row recovery are covered, and receipt persistence survives a
StateStore close/reopen. The safe CLI surface is `brain-agent workcell
create|inspect|destroy` with explicit arguments.

Evidence: `operations/reports/agent-mode-k3-0-workcell-evidence-2026-09-09.md`.
K3.1 is now complete for the controlled writer-lease and diff-admission layer;
K3.2 is now complete for its bounded local text-mutation gate.

### K3.1 — active Workcell writer lease, fencing, and diff admission (2026-09-09)

K3.1 is complete for its bounded scope. The existing SQLite WAL StateStore now
persists writer lease history, one active writer per Workcell, lease expiry and
release states, and monotonic per-Workcell fence tokens. Expired leases can be
recovered deterministically; active leases cannot be stolen; stale owners,
attempts, leases, and fence tokens fail closed.

The `repo.write(workcell)` boundary is admission-only and requires a valid
Workcell state, active matching lease, exact repository/worktree binding, owner
and attempt match, and current fence token. No editing operation is exposed;
`repo.write(main)`, shell, arbitrary commands, and autonomous coding agents
remain unavailable.

Diff evidence captures the Workcell, repository, branch, base/current revision,
tracked and untracked changed files, and deterministic diff hash. A validation
evidence seam stores requested results and permits `validation_ready` only when
diff evidence exists and the stored result passes; it does not execute tests.
Lease grants/releases, write rejections, diff capture, and validation admission
receipts survive StateStore restart and carry task/run/attempt/Workcell/lease/
fence/timestamp/operation-hash lineage.

Evidence: `operations/reports/agent-mode-k3-1-writer-lease-evidence-2026-09-09.md`.
K3.2 is the exact next task: bounded Workcell-local write execution with
preimage/snapshot validation. K3.2 is now complete for its bounded gate.

### K3.2 — bounded Workcell-local text mutation (2026-09-09)

K3.2 implements one modification-only primitive, `workcell.file.patch`,
through the existing Workcell writer and SQLite StateStore seam. It requires a
durable Workcell, exact `repo.write(workcell)` binding, current owner/attempt,
active lease, and fence token. It accepts only a canonical relative path to an
existing regular UTF-8 text file, with a 256 KiB file/replacement bound. It
rejects traversal, absolute/Windows paths, metadata/runtime components,
symlinks, other Workcells, the primary checkout, binary/invalid text, folders,
and special files.

Each operation is durably prepared before mutation and stores only hashes and
relative target metadata. The current preimage hash is verified again before
an fsync/close/atomic temporary-sibling rename. Applied, rejected, and
reconciled receipts bind the full task/run/attempt/Workcell/repository/target/
lease/fence/pre/post/timestamp/result/operation-hash lineage. Same-operation
replay does not rewrite. Crash injection coverage distinguishes pre-mutation
safe resume, temporary-file interruption, post-rename reconciliation, receipt
replay, stale fencing, preimage conflict, and postimage drift. K3.1 Git diff
capture remains a separate post-write evidence step; no validation, review,
commit, merge, deployment, shell, delete, or autonomous worker was added.

BrainNode remains read-only in this tranche; the exact gap is documented rather
than adding a parallel remote write authority. No unrestricted write CLI was
added. Evidence: `operations/reports/agent-mode-k3-2-workcell-write-evidence-2026-09-09.md`.

### K3.3 — controlled Workcell validation framework (2026-09-09)

K3.3 is complete for its bounded scope. The typed capability
`validation.run(workcell)` uses the existing Workcell identity, writer lease,
fence, repository binding, diff evidence, receipts, and SQLite WAL StateStore.
The allowlisted `WorkcellValidatorRegistry` contains only the deterministic
`git.diff.integrity` profile. It re-runs the fixed non-shell Git diff adapter
against the durable Workcell and compares its bounded result with K3.1 diff
evidence. No caller-supplied command, shell, package execution, model, or
coding agent is available.

Validation persists started/completed/rejected lifecycle, evidence JSON/hash,
result, and `ValidationStartedReceipt`, `ValidationCompletedReceipt`, or
`ValidationRejectedReceipt` with Workcell lineage. Unknown profiles, missing
diff evidence, invalid capability/lease/binding, stale or destroyed Workcells,
timeouts, interruptions, and diff drift fail closed. Completed validation is
idempotent; a started validation recovered after a worker crash becomes
interrupted and cannot be promoted as success. StateStore close/reopen was
verified.

Evidence: `operations/reports/agent-mode-k3-3-validation-evidence-2026-09-09.md`.
K3.3 stops here. K3.4 is now the next gate: one bounded coding worker must
exercise the Workcell read → patch → diff → validation path. K4 is not next;
K3.5 still requires concurrent workers plus an explicit review/commit/merge
authority boundary.

## K3.4 first bounded live coding worker

The K3.4 controller and its single authorized live MiniMax acceptance are
complete for the bounded gate. It creates one durable worker attempt and one
Brain-owned Workcell, then exposes only typed `brain_read` and
`brain_workcell_patch` calls to the pinned restricted child. The patch is
constructed from a Brain-verified preimage and goes through the existing K3.2
mutation manager, K3.1 diff capture, and K3.3 `git.diff.integrity` validator.
The successful terminal Workcell state is `awaiting_review`; no commit, merge,
push, deploy, package/test execution, or general write CLI is provided.

Deterministic coverage includes successful isolated patching, absolute-path and
cross-surface rejection, failed-validation non-promotion, bounded MiniMax-only
turns, restart durability, cancellation/crash/idempotency fixtures from the
K3 writer gate, and observer visibility. The live evidence report is complete.
K3.4 is complete. The later broader K3.5 record below is retained as
historical context; the current staged gate is K3.5-A, and K3 remains in
progress until the remaining promotion gates are separately accepted.

No destructive host cleanup, AWS access mutation, billable model probe, or
commit is authorized by this handoff alone.

## Historical broader K3.5 concurrency and explicit promotion record

K3.5 is the final K3 gate. It statically admits exactly two bounded MiniMax
workers under one root budget. Each worker owns a separate Workcell, branch,
writer lease/fence, mutation lineage, diff, and validation record, and both are
created from the same pinned base revision. The durable review boundary rejects
missing, failed, stale, or drifted validation evidence; review approval is
actor-attributed and cannot be created or approved by a coding model.

Commit and merge are separate Brain-controlled effects. Commits are restricted
to the exact reviewed Workcell candidate. Merges require their own approval,
source commit, and target-head preimage; target-ref leases serialize shared Git
ref mutation and stale approvals fail closed. The K3.5 evidence report records
deterministic and live validation, restart reconstruction, observer state,
cleanup, and the K3 completion decision. K4 is not started automatically.

## Current K3.5-A gate — concurrent worker isolation

K3.5-A is complete for the bounded concurrency foundation only. A disposable
deterministic fixture proves two workers overlap while retaining separate
identities, attempts, Workcells, branches, writer leases, fences, mutation
histories, and result records. They share only the pinned base revision. Cross-
Workcell writes, lease theft, same-Workcell contention, and stale fences reject;
StateStore restart and the observer reconstruct the durable state; the main
checkout remains unchanged.

Evidence: `operations/reports/agent-mode-k3-5-a-concurrency-evidence-2026-09-09.md`.

K3 remains **IN PROGRESS**. Review and approval are now covered by the
separate K3.5-B gate; Workcell commit, target-ref fencing, merge authorization,
and promotion restart/reconciliation remain. K4 is not started.

## Current K3.5-B gate — review and approval authorization

K3.5-B is complete for the bounded review boundary. The existing SQLite WAL
StateStore durably records exact review requests, worker identity, diff and
passed-validation bindings, decisions, and requested/approved/rejected
receipts. Only explicit Brain-controlled authority can decide; coding workers
and models cannot approve themselves or create approval state.

Candidate or validation drift marks a request `stale`; duplicate decisions
replay idempotently, conflicting decisions reject, and the observer exposes
bounded review state without secrets, paths, or model reasoning. Evidence:
`operations/reports/agent-mode-k3-5-b-review-evidence-2026-09-09.md`.

K3 remains **IN PROGRESS**. Workcell commit is now covered by the separate
K3.5-C gate; target-ref fencing, merge authorization, and promotion
restart/reconciliation remain separate K3.5 work.

## Current K3.5-C gate — durable Workcell commit authorization

K3.5-C is complete for the bounded commit boundary. Brain requires exact
approved diff and passed validation evidence, current writer lease/fence,
unchanged repository binding, and the approved Workcell state before invoking
the fixed non-shell Git commit adapter. Commit messages and file scope are
bounded; reset, force, push, arbitrary Git, and shell execution are not
available.

Commit operations persist with requested/completed/rejected/reconciled
receipts. The durable state is `approved → committing → committed`; prepared
operations remain safe after a crash before Git, and a crash after Git is
reconciled without a duplicate commit. Replays are idempotent and a different
candidate under the same operation ID rejects. Deterministic disposable
fixtures cover the authorization, rejection, drift, fencing, restart, crash,
independent-Workcell, and observer cases. Evidence:
`operations/reports/agent-mode-k3-5-c-commit-evidence-2026-09-09.md`.

K3 remains **IN PROGRESS** until the separate K3.5-D merge and target-ref gate
is accepted. K4 is not started.

## Current K3.5-D gate — merge authorization and target branch safety

K3.5-D is complete for the bounded merge boundary. Merge approval is separate
from commit approval and binds one exact source commit, reviewed diff,
validation evidence, target branch, expected target HEAD, approving actor, and
one-use expiry. Immediately before mutation, Brain rechecks the source and
target and acquires the scoped target-ref lease with a monotonic fence.

The fixed Git adapter performs only a non-shell, non-force, non-push merge.
Target drift becomes stale approval; competing operations cannot both acquire
the same target-ref authority, while independent Workcells remain usable.
Merge operations and requested/completed/rejected/reconciled receipts persist
in the existing SQLite StateStore. Pre-merge crashes produce no target commit;
post-merge crashes reconcile only the recorded operation under current target
authority. Duplicate replays are idempotent and different candidates reject.
Deterministic fixtures cover valid and invalid approval, source/target drift,
target fencing, concurrency, receipts, restart, observer state, and crash
reconciliation. Evidence:
`operations/reports/agent-mode-k3-5-d-merge-evidence-2026-09-09.md`.

K3 exit gate: **COMPLETE**. K4 remains planned and must not start automatically.
K4 is not started.

## Current K3.6 foundation audit — 2026-09-09

K3.6 is complete as an audit and consolidation gate; it does not implement K4.
The current architecture is:

```text
Brain Kernel → Model Gateway → Node Transport → Workcells
→ Validation/Review → Commit → Merge → Observer
```

The audit confirms Auto begins with MiniMax M2.5, Brain owns escalation
through GLM-5 and Claude Opus 4.6, Amazon Bedrock is the default execution
resource, and Codex is a separate manual/subscription resource. `repos.sh` and
`sessions.sh` now expose only Auto, MiniMax M2.5, GLM-5, Opus 4.6, and Codex.
Stale Claude menu/launcher paths were removed.

Local text LLM infrastructure is retired from current routing. FluidVoice,
MLX Whisper, faster-whisper, and ComfyUI remain separate non-text/media
capabilities with consumer-specific retention rules. The audit found no
unrestricted Agent Mode shell, `repo.write(main)`, unsafe model tool, hidden
escalation, or approval bypass in the bounded surfaces.

Readiness: **READY WITH CONDITIONS**. The architecture/security foundation is
ready for a separately planned K4 design, but K4 must not start from the
current intentionally dirty shared worktree; first isolate and review the
existing changes. MacBook local-media state remains unresolved until a
read-only inventory succeeds. Evidence:
`operations/reports/agent-mode-k3-6-foundation-audit.md`.

## Current K3.7 operational baseline — 2026-09-09

K3.7 is complete as a classification and baseline gate; it does not implement
K4. The current 20 modified and 64 untracked status entries are understood:
they are required Agent Mode source, tests, fixtures, runbooks, evidence,
scripts, or documentation. No unknown file was deleted, no reset was run, and
no bulk commit was created.

Local text LLM candidates remain documented as preserve/review/remove-after-
dependency-check decisions. FluidVoice, local speech/TTS, MLX Whisper,
faster-whisper, and required media tooling remain separate retained
capabilities. Both selector scripts still expose exactly Auto, MiniMax M2.5,
GLM-5, Opus 4.6, and Codex. K4 prerequisites are a clean reviewed landing
boundary and completion of the read-only MacBook inventory. Evidence:
`operations/reports/agent-mode-k3-7-operational-baseline-evidence.md`.

## Current K3.8 reviewed foundation landing — 2026-09-10

K3.8 is complete. The classified K0–K3.5 implementation and evidence were
reconciled, secret-scanned, validated, reviewed, and landed in five logical
local commits. The final worktree is clean, no unrelated state was discarded,
and no K4 implementation was added.

Foundation landing is **COMPLETE** and K4 is **READY TO START**, subject to
its own scoped authorization/design review. The exact commit paths and SHAs,
rollback guidance, validation counts, and final status are recorded in:
`operations/reports/agent-mode-k3-8-foundation-landing-evidence-2026-09-10.md`.

At the landing boundary K4.0 was the exact next task. It is now recorded below
as complete; K4.1-B must not start automatically.

## Current K4.0 deterministic scheduler and no-op heartbeat — 2026-09-10

K4.0 is **COMPLETE** for its bounded acceptance gate. The existing Agent Mode SQLite WAL StateStore now
contains durable typed scheduler events and schedules, immutable source/key
deduplication, conflict rejection, bounded JSON payload validation, source
watermarks, lease/fence claims, restart recovery, deterministic retry/backoff,
dead-letter settlement, and a singleton latest-tick observer record. The queue
status is durable across close/reopen; completed items are not rerun and stale
claimants cannot settle after a fresh fence is acquired.

`brain-agent heartbeat --once` and `brain-agent scheduler tick` execute one
bounded pass and exit. The only handler is the internal
`agent_mode.test.noop` fixture, which has no model, runtime, worker, shell,
network, token, cost, or repository effect. No daemon, timer, external event
source, provider retry, dynamic worker, or autonomous model call was added.

Focused K4.0 coverage and the no-op zero-call proof are recorded in:
`operations/reports/agent-mode-k4-0-scheduler-heartbeat-evidence-2026-09-10.md`.

K4 remains **IN PROGRESS**. K4.1-A is recorded below; the exact next task is
K4.1-B. Do not start it automatically.

## Current K4.1-A local Git event source — 2026-09-10

K4.1-A is **COMPLETE** for its bounded gate. A generic durable
`EventSourceAdapter` seam and one local read-only `git.repository.revision`
source now observe bounded Git ancestry, bootstrap at current HEAD without
history replay, emit oldest-first typed `repository.commit.observed` events,
advance the existing K4.0 watermark transactionally, deduplicate repeated
polls, and surface divergence without silently resetting history.

Durable source configuration/status includes bounded debounce grouping,
cooldown/not-before, catch-up state, and finite source retry state. The
operator surface is `brain-agent sources poll --once`; there is no watcher,
daemon, network source, model, runtime, worker, Git write, fetch, pull, push,
or semantic commit classification. Observer state is safe and path-free.

Evidence: `operations/reports/agent-mode-k4-1-a-git-event-source-evidence-2026-09-10.md`.

## Current K4.1-B1 internal lifecycle event source — 2026-09-10

K4.1-B1 is **COMPLETE** for its bounded gate. The `brain.task.lifecycle`
adapter consumes the canonical append-only Agent Mode `events` stream, uses
monotonic sequence as its durable watermark, bootstraps without historical
replay, filters a narrow Task/Run/Attempt lifecycle set, and emits bounded
oldest-first `task.lifecycle.observed` scheduler events. Separate scan and
emit limits prevent irrelevant audit rows from blocking the cursor. Transactional
failure handling, restart recovery, deduplication, observer origin metadata,
and structural scheduler feedback-loop prevention are covered by fixtures.
The finite `sources poll --once` command supports explicit internal polling.
No host-health source, worker, model, daemon, listener, or network path was
added. Evidence:
`operations/reports/agent-mode-k4-1-b1-lifecycle-event-source-evidence-2026-09-10.md`.

K4 remains **IN PROGRESS**. Exact next task: **K4.1-B2 — Host-Health Event
Source Using Existing Infrastructure Health Bindings**. Do not start it
automatically.

## Current K4.1-B2 host-health event source — 2026-09-10

K4.1-B2 is **COMPLETE** for its bounded gate. The
`infrastructure.host-health` adapter consumes the existing normalized
infrastructure-health plane and authoritative catalog/provider bindings. It
keeps bounded per-resource/provider/binding semantic state, recomputes
freshness, suppresses metric noise, emits only meaningful transitions and
recovery, preserves multiple-provider provenance, fails closed on missing or
invalid evidence, and exposes safe state through the Agent Mode observer.
Polling is finite and cannot feed scheduler rows back into the source. No
provider client, host mutation, worker, model, daemon, or network path was
added.

Evidence:
`operations/reports/agent-mode-k4-1-b2-host-health-event-source-evidence-2026-09-10.md`.

K4 remains **IN PROGRESS**. Exact next task: **K4.1-C — CI Event Source and
K4.1 Event-Source Closure Audit**. Do not start it automatically.

## Historical maintenance handoff — 2026-08-14

The following records the product-specific maintenance state at that date, not
the new Agent Mode provider policy. Preserve its outstanding retention gates.

The configuration/local-AI and two-host activation tranche is maintenance only.
Infinite Brain remains closed; do not reopen roadmap or feature work from this
handoff.

## Implemented state

- Office and MacBook canonical Brain checkouts contain the same activation line.
- Office application runtime roots are physical, machine-local directories;
  intentional narrow configuration entries are Git-managed.
- Codex keeps a physical `~/.codex` runtime root. Durable entries are symlinked;
  `config.toml` is an owner-only generated copy with the current account home
  rendered locally.
- Codex auth, sessions, thread index, databases, plugins, caches, and Computer
  Use bundles remain local-only.
- Office connectivity has exactly two repository routes: Thunderbolt preferred
  (`office-repos-tb`) and Tailscale fallback (`office-repos-ts`). The obsolete
  Office LAN route was removed from Git and MacBook Codex connection state.
- Brain-managed MTPLX/Ollama always-on text routes are retired. Bedrock is the
  primary managed text route and Codex CLI the secondary route.
- Private Mind classification is pinned to `amazon-bedrock` and
  `us.anthropic.claude-sonnet-4-6`, with private/sensitive flags and no fallback.
- The private Mind request uses a unique mode-`0600` temporary request file;
  capture text is not present in process arguments and cleanup runs in `finally`.
- The active video analyzer uses Bedrock-primary/Codex-secondary routing and no
  local OpenAI-compatible text endpoint.
- Structural Graphify execution is retired. The bounded semantic event gate has
  no default model.
- The retired Mind decomposer remains a fail-closed compatibility stub.
- Mind's unrelated `.obsidian/**` and `kanban.md` working changes were preserved.
- The dirty Video Orchestrator feature worktree was preserved, restored as a
  healthy `feature/video-orchestrator` Git worktree at its original path, and is
  not part of this maintenance closeout.
- Obsolete clean maintenance worktree directories `brain-next` and
  `brain-host-activation` were verified empty of modified/untracked work and
  removed after their commits were confirmed in `main`.
- Herdr `0.8.0` remains application-local; one obsolete
  `ui.agent_panel_scope` key was backed up and removed, and `herdr config check`
  now reports `config: ok`.

## Activation evidence and remaining retention gate

The final activation run ID is `20260814T155610Z-26638`.

- Office receipt state is `8 OFFICE_CONNECTIVITY_PASS`.
- MacBook receipt state is `6 MACBOOK_CONFIG_ACTIVE`.
- The original MacBook application acceptance recorded Codex/Remote SSH as
  failed or declined.
- A later bounded follow-up repaired Codex Remote SSH to the two-route model and
  verified both SSH aliases, but it did not rewrite the original receipt as a
  fabricated phase-10 PASS.

Operational behavior is working, but the formal rollback-retention gate is not
closed. The Video Orchestrator archive dependency has been cleared by the
verified worktree rescue. Retain the final Office and MacBook receipt directories
and the old dirty canonical Brain archive until:

1. manual Codex/Remote SSH acceptance is explicitly recorded;
2. matching final receipt closure is documented honestly; and
3. the setup survives one normal reboot plus a representative application
   update, or 14 days elapse after formal acceptance, whichever is later.

For the 2026-08-14 acceptance window, the calendar component is no earlier than
2026-08-28. Do not delete the final rollback set before the observation and
acceptance conditions above are also satisfied.

Failed pre-mutation and rolled-back run copies are not part of this final
rollback set and may be removed after their exact paths and sizes are recorded.

## Restore model

Git restores intentional, reproducible, non-secret configuration. A rebuilt Mac
still requires normal sign-in or an encrypted external backup for SSH private
keys, AWS credentials, application auth, Codex/Claude sessions, local databases,
and other `LOCAL-ONLY` state. Those items must never be reconstructed from Git.

Use:

- `operations/runbooks/workstation-config-ownership.md`
- `operations/runbooks/codex-managed-runtime-root.md`
- `operations/runbooks/host-activation.md`
- `operations/scripts/brain-configs-link.sh`
- `operations/scripts/codex-home-managed-root.sh`

Application upgrades may change local generated/runtime state. Never replace a
whole runtime root with a symlink and never copy app-build hashes, marketplace
timestamps, caches, auth, or sessions into Git. Promote only reviewed durable
settings into the portable baseline.

## Resume rule

Before any further backup or worktree deletion, inspect current Git status,
receipt state, active worktrees, and the closeout report. Do not delete the final
rollback set or the Video Orchestrator worktree merely to reclaim space.
