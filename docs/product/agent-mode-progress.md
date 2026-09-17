# Agent Mode Progress

## Current status — 2026-09-17

The foundational Agent Mode roadmap is **COMPLETE through H0**, including K0–K5,
U0, V0 and D0. The H0 release gate passed through the corrected disposable
provider and remote-node evidence. The selected post-H0 direction is **NO NEW
FOUNDATION PHASE / RELEASE-MAINTENANCE MODE**. Historical phase entries below
retain their original chronology; the current next bounded task is the release
maintenance baseline recorded in the post-H0 decision report.

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

## Current K4.1-C1 CI workflow-run event source — 2026-09-10

K4.1-C1 is **COMPLETE** for its bounded gate. The provider-neutral
`ci.workflow-run` adapter stores bounded versioned workflow-run state in the
existing EventSource watermark, bootstraps without history replay, emits only
typed started/completed semantic events, keeps rerun attempts distinct, and
orders bounded catch-up oldest-first. GitHub Actions normalization is isolated
behind an injected read-only page-reader seam; raw provider metadata is not
retained, and no credentials, network client, webhook, listener, daemon, CI
logs/artifacts/YAML reader, worker, or model path was added.

Provider failures, malformed responses/cursors, pagination failures, stale
observations, and repository/workflow binding mismatches fail closed without
advancing the prior watermark or inventing scheduler work. The observer exposes
safe CI state and scheduler origin. Evidence:
`operations/reports/agent-mode-k4-1-c1-ci-event-source-evidence-2026-09-10.md`.

K4 remains **IN PROGRESS**. Exact next task: **K4.1-C2 — Event-Source Closure
Audit and K4.2 Readiness Gate**. Do not start it automatically.

## Current K4.1-C2 EventSource closure and K4.2 readiness — 2026-09-10

K4.1-C2 is **COMPLETE** and K4.1 is **COMPLETE**. The four source adapters
share one finite durable contract while retaining source-specific cursor
authority: Git ancestry, lifecycle sequence, host-health semantic state, and
CI provider/run-attempt state. Bootstrap, deduplication, failure isolation,
restart, observer, feedback-loop, disabled-source, identity-drift, and
malicious-metadata gates passed.

The combined poll is bounded to 16 registered/processed sources, 100 emitted
events per source, and a 15-second observation timeout, for a maximum 1,600
source-pass events; scheduler ticks remain capped at 64 items. Deterministic
full-pass ordering prevents starvation within that registered bound. No
external network or model call is required; no workers are created. Evidence:
`operations/reports/agent-mode-k4-1-c2-event-source-closure-evidence-2026-09-10.md`.

K4 remains **IN PROGRESS**. K4.2-A, K4.2-B, and K4.2-C are now **COMPLETE** for
their bounded gates, and K4.2 is **IN PROGRESS**. Exact next task: **K4.2-D —
Bounded AgentRuntime Dispatch, Cancellation Propagation and Child Settlement**.
Do not start it automatically.

## Current K4.2-A deterministic spawn admission — 2026-09-10

K4.2-A is **COMPLETE**. The pure policy layer consumes only a bounded,
pre-normalized scheduler event request and evaluates versioned policy and
static role-template manifests with explicit source/event/capability/scope
allowlists. It enforces root-goal binding, same-root parent lineage,
cancellation, durable global/root kill switches, finite TTL/depth, deadline,
fact-based concurrency and total-creation ceilings, and root/role/policy
budget and step ceilings. Unknown policy/template/capability/scope, malformed
manifests, and unavailable authority facts deny by default. Spawn intent keys
are deterministic and exclude prompts, payloads, commands, credentials,
provider responses, and model identity. The existing StateStore persists the
global/root control seam and the observer exposes only bounded persisted
control state.

The focused K4.2-A matrix passes 63 tests. No Agent, child task, runtime,
ModelGateway call, worker, reservation, live scheduler wiring, or network
call was added. Evidence:
`operations/reports/agent-mode-k4-2-a-spawn-policy-admission-evidence-2026-09-10.md`.

K4.2-B and K4.2-C are now complete. K4.2 remains **IN PROGRESS**. Exact next
task: **K4.2-D — Bounded AgentRuntime Dispatch, Cancellation Propagation and
Child Settlement**. Do not start it automatically.

## Current K4.2-B durable child reservation — 2026-09-10

K4.2-B is **COMPLETE**. The existing SQLite StateStore now persists bounded
child Agent identity and immutable creation material with exact root/parent
lineage, policy and role-template versions, authoritative depth, scope and
capability snapshots, child step/cost allocation, expiry, and truthful
reserved/retired/cancelled/expired status. Child identity is controller-owned;
this gate creates no child task, run, attempt, runtime, worker process, or
model call.

The StateStore exposes one atomic `reserveSpawnAndCreateChild` transaction. It
rechecks durable kill switches, cancellation, lineage, deadlines, policy
versions, active/total ceilings, and root aggregate step/cost reservations
inside the transaction. A root aggregate row is the authoritative counter and
allocation source; child insert, counter update, bounded event, and durable
receipt commit together. Spawn-intent retries return the same receipt and
child, conflicting immutable material fails closed, retirement releases active
allocation without decrementing total creations, and bounded expiry
reconciliation is idempotent across restart and races. Observer output is
bounded and excludes prompts, raw provider data, and secrets.

The focused K4.2-B matrix passes 47 tests. The build and K4.0/K4.1/K4.2-A
regression set passes 189 tests. Evidence:
`operations/reports/agent-mode-k4-2-b-child-agent-reservation-evidence-2026-09-10.md`.

K4.2-C is recorded below. K4.2 remains **IN PROGRESS**. Exact next task:
**K4.2-D — Bounded AgentRuntime Dispatch, Cancellation Propagation and Child
Settlement**. Do not start it automatically.

## Current K4.2-C runtime binding and child assignment — 2026-09-10

K4.2-C is **COMPLETE** for its bounded durable StateStore gate. A typed child
assignment request binds a reserved child to a deterministic assignment intent
and a known runtime/profile pair without selecting a model or invoking a
runtime. The transaction rechecks child/root/parent lineage, cancellation and
kill switches, expiry/deadline, policy/template identity, capability and
repository/resource scopes, allocation ceilings, and runtime-profile
admission before any canonical write.

The atomic write creates the canonical child Task, Run, and Attempt, links
them to the child and intent, creates a child budget suballocation in the
existing ledger, advances the child to `assigned`, persists one bounded
receipt/assignment row, and emits one lifecycle event. The root aggregate is
not reserved twice. Task/Run/Attempt remain pre-dispatch (`admitted`/`created`/
`admitted`), with deferred route/model references and no AgentRuntime,
ModelGateway, worker process, scheduler, Workcell, Git, network, or UI path.
A prepared dispatch is data only and is not execution authority; K4.2-D must
freshly recheck authority before dispatch.

Deterministic retries after lost response or reopen return the same receipt and
canonical entities, while conflicting material and concurrent competing
assignments fail closed. Assigned-child cancellation/expiry invalidates the
prepared dispatch and cancels canonical entities atomically. Observer output
exposes bounded safe linkage and runtime/profile identifiers only. The focused
K4.2-C matrix passes 58/58; the build and expanded K4.0/K4.1/K4.2 regression
set passes 268/268. Evidence:
`operations/reports/agent-mode-k4-2-c-runtime-binding-assignment-evidence-2026-09-10.md`.

K4.2-D1 is now **COMPLETE**. K4.2 remains **IN PROGRESS**. Exact next task:
**K4.2-D2 — Restricted Harness Process Dispatch, Runtime Cancellation and
Reconciliation**. Do not start it automatically.

## Current K4.2-D1 mock-backed runtime dispatch — 2026-09-10

K4.2-D1 is **COMPLETE** for the bounded in-process gate. The existing SQLite
StateStore performs the fresh execution-time authority recheck, acquires the
fenced runtime-dispatch lease, persists the existing effects/outbox intent,
invokes only `MockAgentRuntime`, records and verifies a bounded runtime
receipt, and settles child lifecycle, budget, root allocation, active slot,
and lease exactly once. Cancellation propagates through `AbortSignal` and a
durable cancellation check; crashes, conflicts, stale fences, invalid results,
and unsupported reconciliation remain uncertain without blind replay.

The truthful stages are `dispatchable → dispatched → receipt_recorded →
verified → settled`, with failed/cancelled/uncertain paths. Observer output
reconstructs bounded runtime dispatch state without prompts, hidden reasoning,
provider payloads, credentials, or secrets. No restricted Harness, OS process,
model/provider, BrainNode, Workcell, scheduler worker, network, or replacement
worker is launched. Evidence:
`operations/reports/agent-mode-k4-2-d1-mock-runtime-dispatch-evidence-2026-09-10.md`.

The focused D1 matrix passes 57/57 and the Agent Mode regression set passes
304/304. The package-wide `brain-core` command separately reports three
unrelated `OrchestrationExecutor` timeout failures. K4.2 remains **IN PROGRESS**. Exact next task: **K4.2-D2 — Restricted
Harness Process Dispatch, Runtime Cancellation and Reconciliation**. Do not
start it automatically.

## Current K4.2-D2 restricted Harness process dispatch — 2026-09-11

K4.2-D2 is now **COMPLETE** for its bounded process-boundary gate.
`RestrictedHarnessAgentRuntime` implements the existing D1 `AgentRuntime`
seam and uses only the pinned DeepSeek Harness `0.1.3-alpha.2` /
`c389f96bf3a9b6807cb71ed6bdad5849be0df6d8` binding. The runtime root is
injected configuration, checked for the pinned directory and package
manifests, and launched through the existing Harness SDK's fixed stdio
subprocess construction.

Brain verifies the bounded SDK readiness handshake, restricted topology,
separate-child process, explicit complete child environment, and normalized
PID/start-identity/command binding before sending the attempt. The fixture
uses a local Unix-socket bridge and returns
`BRAIN_K4_2_D2_HARNESS_PROCESS_PASS` with zero provider/model usage and no
executable tools. Each attempt has bounded startup/execution/shutdown
deadlines and is reaped through the SDK's graceful-then-terminate ladder.
Parent sentinel variables, credentials, StateStore paths, external network,
BrainNode, Workcell, and scheduler authority are not passed to the child.

Known startup/failure, in-flight cancellation, crash-after-admission,
oversized/malformed protocol, environment, PID identity, observer, durable
evidence reconciliation, and no-evidence uncertainty cases are covered.
Uncertain dispatches are never blindly relaunched. D1 durable effects,
outbox, fence, receipt verification, settlement, and restart semantics remain
authoritative. Focused D2 validation is 12/12; affected Agent Mode/K4
regressions remain green, and the package-wide test command passes 2444/2444.

Evidence:
`operations/reports/agent-mode-k4-2-d2-restricted-harness-dispatch-evidence-2026-09-11.md`.

K4.2-E1 is recorded below.

## Current K4.2-E1 scheduler-to-worker orchestration — 2026-09-11

K4.2-E1 is **COMPLETE** for its bounded scheduler-to-worker gate. The closed
`SchedulerEventActionRule` registry is separate from `AgentSpawnPolicy`; only
an enabled static rule can express event-to-action intent, while policy and
role admission remain independent. The default registry is disabled and
unknown/disabled/malformed event intent is bounded `NO_ACTION` or denial.

The orchestrator uses the existing scheduler claim/fence and authoritative
source configuration, then composes the existing K4.2-A policy, K4.2-B atomic
child reservation, K4.2-C assignment, and K4.2-D1 runtime dispatch/settlement
contracts. It derives stable action-application, spawn, child, assignment,
operation, and dispatch identities from immutable event/rule material. It does
not copy event-selected runtime, model, scope, role, or task metadata and does
not write canonical lifecycle rows or budgets outside the existing boundaries.

The positive fixture path uses exactly one `MockAgentRuntime` invocation and
zero Harness processes, ModelGateway calls, BrainNode calls, Workcell state,
network calls, or replacement workers. Ten redeliveries, concurrent scheduler
claims, the four-child root concurrency ceiling, total creations, aggregate
budget, cancellation, kill switch, deadline, recursive-spawn prevention,
bounded batches, no-op passes, and crash recovery at each orchestration phase
are covered. Worker settlement crashes resume event completion without runtime
replay; D1 uncertain outcomes remain uncertain and retryable only for durable
reconciliation. Observer state includes bounded action, causation, child,
assignment, operation, dispatch, phase, and terminal outcome linkage.

Evidence:
`operations/reports/agent-mode-k4-2-e1-scheduler-dynamic-worker-evidence-2026-09-11.md`.
Focused E1 validation is 23/23; the Agent Mode regression set is 339/339; the
package-wide `brain-core` suite was 2467/2467 at that gate. E2 is recorded
below.

## Current K4.2-E2 restricted-Harness scheduler-to-worker acceptance — 2026-09-11

K4.2-E2 is **COMPLETE**. The existing E1 scheduler orchestrator now drives the
actual D2 `RestrictedHarnessAgentRuntime` through the same D1 dispatcher and a
single static E2 action rule. Action intent remains separate from spawn
permission; the rule is disabled by default, read-only, root-bound, finite,
restricted-Harness-only, and requests zero executable capabilities. E1 is
unchanged.

One positive event creates exactly one child, one Task/Run/Attempt, one D1
runtime-dispatch outbox, one pinned Harness process, and one exact reap. The
Harness pin is version `0.1.3-alpha.2`, commit
`c389f96bf3a9b6807cb71ed6bdad5849be0df6d8`, profile
`brain-agent-mode-restricted`. No ModelGateway/Bedrock/live model,
BrainNode, Workcell, repository write, external network, or replacement worker
effect occurs.

Redelivery, concurrent claims, phase crashes/restarts, uncertain and durable
or unsupported reconciliation, cancellation/reaping, kill/deadline/TTL,
root limits, recursive-spawn prevention, malicious metadata, bounded batches,
quiet passes, and observer reconstruction are covered. The full K4.2 closure
audit conditions 1–23 pass. Evidence:
`operations/reports/agent-mode-k4-2-e2-harness-dynamic-worker-closure-evidence-2026-09-11.md`.
Focused E2 validation is 16/16; Agent Mode regression is 355/355; the
package-wide `brain-core` suite is 2483/2483. **K4.2 is COMPLETE; K4 remains
IN PROGRESS.** Exact next task: **K4.3-A — One Bounded Live MiniMax
Dynamic-Worker Acceptance**. Do not start it automatically.

## Current K4.3-A live MiniMax acceptance — 2026-09-12

K4.3-A is now **COMPLETE** for its bounded live gate. R3 used fresh durable
identities and one authorized MiniMax M2.5 inference through the existing
scheduler, restricted Harness, Brain-owned ModelGateway, and Bedrock route.
The live output allowance is canonically `1024` tokens; the D2 fixture bound
remains separate. The exact visible response passed, the normalized provider
receipt was persisted and verified, and usage/cost settled once at
`61 / 119 / 180` tokens and `$0.000161`.

The run had one child, Task, Run, Attempt, Harness launch/reap, ModelGateway
call, provider call, and model turn. Tools, BrainNode, Workcell, repository,
replacement-worker, grandchild, fallback, and escalation effects were zero.
StateStore reopen/reconstruction and quiet scheduler redelivery passed with no
additional effects. Evidence:
`operations/reports/agent-mode-k4-3-a-r3-live-minimax-acceptance-evidence-2026-09-12.md`.

**K4.3-A: COMPLETE. K4: IN PROGRESS.** Exact next task: **K4.3-B — K4 Live
Autonomy Closure Audit and Phase Exit Gate**. Do not start it automatically.

## Current K4.3-B K4 live autonomy closure — 2026-09-12

K4.3-B is **COMPLETE**. The bounded closure audit verified all 30 K4 exit
invariants as **PASS** across the scheduler, EventSources, spawn admission and
reservation, Task/Run/Attempt assignment, D1/D2 runtime dispatch, restricted
Harness process boundary, E1/E2 orchestration, and the K4.3-A R3 live MiniMax
acceptance. The audit found no unresolved runtime/provider uncertainty and no
known duplicate-effect path.

K4 now provides the deterministic runtime/control-plane foundation needed for
bounded autonomous Jarvis delegation: Brain can admit, create, assign, execute,
observe, interrupt, recover, account for, and retire bounded intelligent
workers. Jarvis executive reasoning and multi-agent organization remain later
phases; this does not claim unrestricted Jarvis autonomy.

R3 remains the only canonical live K4.3-A acceptance: one fresh direct Bedrock
call, one child/Task/Run/Attempt, one Harness launch/reap, one ModelGateway and
provider call, exact response acceptance, durable verified receipt, and one
settled cost of `$0.000161` for `61 / 119 / 180` tokens. Redelivery and restart
created no duplicate effects. No live provider call was made during the audit.

Closure evidence:
`operations/reports/agent-mode-k4-3-b-k4-live-autonomy-closure-evidence-2026-09-12.md`.
**K4.3-B: COMPLETE. K4: COMPLETE.** Broad production live autonomy remains
disabled by default. Exact next milestone: **Phase K5 — multi-agent
organization**. Do not start it automatically.

## Current K5-A organization contracts — 2026-09-13

K5-A — **Durable Multi-Agent Organization Contracts and Delegation DAG
Foundation** — is **COMPLETE** for its bounded offline foundation. K5 remains
**IN PROGRESS**.

The existing Agent Mode StateStore now persists a closed Brain-owned registry
of six logical roles and versioned organization plans with deterministic plan /
work-item IDs, finite envelopes, `requires_success` dependency DAGs, and
structured result/evidence contracts. Plans bind to an existing root goal and
root-bound Jarvis supervisor, are created atomically, and converge under
restart or concurrent duplicate requests. Conflicting same-identity material
fails closed.

Readiness is a deterministic projection over the organization graph plus
authoritative terminal result facts. Root cancellation/kill and plan expiry
block readiness; no dependency is executed by this slice. K5-A reserves zero
K4 budget, creates zero children or Tasks/Runs/Attempts, and makes zero runtime,
Harness, ModelGateway, provider, network, Workcell, or BrainNode calls. The
observer exposes bounded ownership/dependency/readiness state and nullable
future child/task bindings without prompts, hidden reasoning, raw provider
payloads, credentials, or free-form agent chat.

Evidence: `operations/reports/agent-mode-k5-a-organization-contracts-evidence-2026-09-13.md`.
K5-B completion is recorded below.

## Current K5-B supervisor delegation — 2026-09-13

K5-B — **Deterministic Supervisor Delegation Orchestrator with Mock Workers** —
is **COMPLETE** for its bounded deterministic execution gate. K5 remains
**IN PROGRESS**.

K5-B composes K5-A readiness through the existing K4 SpawnPolicy, atomic child
reservation, assignment, D1 runtime dispatcher, leases, cancellation, deadline,
budget, and settlement paths. A closed delegation mapping keeps organization
roles separate from K4 execution policy and maps the fixture to the safe
read-only template plus `MockAgentRuntime`; no model is selected. Stable
delegation/spawn/assignment/dispatch identities and a transactional work-item
binding make redelivery, restart, and child-before-binding crashes converge on
one child lifecycle.

The bounded supervisor pass executes at most four work items in canonical key
order. Research and Engineering complete first; only authoritative K4 terminal
receipts satisfying the K5-A result/evidence contract make Independent Auditor
ready. The happy fixture reconstructs three child Agents, Tasks, Runs, Attempts,
structured result/evidence references, ownership, and settled cost. K4 root
concurrency, creation, budget, cancellation, kill-switch, deadline, failure,
and uncertainty remain authoritative. No second result ledger, peer chat,
unbounded loop, Harness, ModelGateway, provider, network, BrainNode, Workcell,
or repository effect is introduced.

Evidence: `operations/reports/agent-mode-k5-b-supervisor-delegation-mock-workers-evidence-2026-09-13.md`.
Exact next task: **K5-C — Structured Supervisor Aggregation, Auditor Gate, and
Organization Final Result**. Do not start it automatically.

## Current K5-C organization final result — 2026-09-13

K5-C — **Structured Supervisor Aggregation, Auditor Gate, and Organization
Final Result** — is **COMPLETE**, and the bounded K5 phase-exit gate PASSED.
K5 is now **COMPLETE**; the next planned phase is U0.

The new versioned `OrganizationAggregation` is a deterministic projection over
authoritative K4 lifecycle/receipt/evidence/settlement facts, the immutable
K5-A DAG, and K5-B work-item bindings. Entries are lexical by work-item key,
bounded to 16 items and 64 evidence references, and contain references/facts
only. Every successful item satisfies its K5-A result contract. The exact one
downstream Independent Auditor is a required success gate; auditor success
cannot override failed, cancelled, dependency-failed, contract-invalid, or
uncertain worker facts.

`AgentModeOrganizationFinalizer` derives a stable aggregate digest and final
receipt ID from plan/version, canonical terminal references, auditor reference,
and settled K4 cost. StateStore persists only one immutable organization-level
receipt and atomically transitions the plan lifecycle. Repeated and concurrent
finalization is idempotent/conflict-safe; known terminal failure may produce a
failed receipt, while uncertainty remains unfinalizable. Close/reopen and the
observer reconstruct the plan → work item → child/task/run/attempt →
result/evidence → auditor → final-result chain without copying raw result
bodies, prompts, reasoning, provider payloads, or runtime logs.

The happy fixture remains exactly three child lifecycles and three
`MockAgentRuntime` invocations, with zero Harness, ModelGateway, live-provider,
network, BrainNode, Workcell, tool, or repository effects. K5 now means
deterministic supervisor-owned organization contracts and evidence-backed
finalization, not unrestricted Jarvis reasoning.

Evidence: `operations/reports/agent-mode-k5-c-organization-final-result-evidence-2026-09-13.md`.
Exact next phase: **Phase U0 — unified Brain Console control surface**. Do not
start it automatically.

## Current U0-A Agent Mode Console projection — 2026-09-13

U0-A — **Canonical Agent Mode Console Projection and Read-Only Brain Console
Operations Surface** — is **COMPLETE** for the bounded read-only projection
gate. U0 remains **IN PROGRESS**.

Brain Core now exposes the strongly typed, versioned `agent-mode-console-v1`
projection at `GET /agent-mode/console`. It derives from the existing durable
Agent Mode observer and StateStore only; every collection is bounded and
ordered by lifecycle activity, update time, and stable ID. Fresh, empty, and
unavailable StateStore conditions are explicit. No Console database, UI ledger,
provider probe, runtime dispatch, model call, or mutation is introduced.

Brain Console adds the read-only `/agents` surface using the existing
`brainCoreRequest()` and TanStack Query client with a strict Zod contract. Its
tabbed Overview, Agents, Organizations, Tasks, and Failures views expose
bounded K0-K5 state, K5 final results, K4 runtime/model facts when durably
known, root budget facts, schedules, pending Agent Mode review approvals,
evidence metadata, and failure/uncertainty state. Browser cache remains a
temporary view cache, never authority; a refresh or second client reconstructs
the domain projection from Brain Core.

Jarvis intake, notifications, detailed evidence/budget/schedule/failure
drill-down, node/worktree/quota inventory gaps, and lifecycle control actions
remain later U0 work. Legacy `/agent-console` remains available for existing
consumers and is not redefined by U0-A.

Evidence: `operations/reports/agent-mode-u0-a-console-projection-evidence-2026-09-13.md`.
Exact next task: **U0-B — Agent Detail, Evidence, Budget, Schedule, and Failure
Drill-Down**. Do not start it automatically.

## Current U0-B Agent Mode detail drill-down — 2026-09-13

U0-B — **Agent Detail, Evidence, Budget, Schedule, and Failure Drill-Down** —
is **COMPLETE** for the bounded read-only detail gate. U0 remains **IN
PROGRESS**.

Brain Core now exposes the versioned `agent-mode-console-detail-v1` response at
`GET /agent-mode/console/detail/:kind/:id`. It supports bounded Agent, Task,
Run, Attempt, Organization, Budget, Schedule, Failure, and Evidence details,
derived from the existing durable Agent Mode observer/StateStore. Detail
responses preserve K4/K5 authority, expose safe cross-links and evidence
metadata, and explicitly report unavailable or missing state.

Brain Console `/agents` now opens these details from stable IDs in a read-only
panel. The panel uses the existing client, strict Zod validation, ephemeral
selection state, and visible loading/stale/error states. It adds no controls,
provider probes, Console ledger, raw prompt/result material, or browser
authority.

Evidence: `operations/reports/agent-mode-u0-b-console-drilldown-evidence-2026-09-13.md`.
Exact next task: **U0-C — Guarded Agent Lifecycle Controls and Approval
Actions**. Do not start it automatically.

## Current U0-C1 Agent Mode control-service foundation — 2026-09-14

U0-C1 — **Brain-Owned Lifecycle Control Service and CLI/HTTP Safety Boundary**
— is **COMPLETE** for its bounded shared-control foundation. U0-C remains **IN
PROGRESS**.

Brain Core now exposes the versioned `AgentModeControlService` domain seam for
pause, resume, cancel, kill, and review decisions. Commands use bounded
trusted-actor identities and deterministic operation material. Receipts are
durable records in the existing Agent Mode events stream, so repeated commands
are idempotent and conflicting operation reuse fails closed. The service calls
the existing StateStore lifecycle methods and `recordReviewDecision`; it does
not create a second task/run/attempt/result ledger or mutate budget authority.

Resume requires verified recorded runtime ownership. Kill accepts only the
durably recorded run identity and never an arbitrary PID; a durable signal
receipt prevents blind redelivery. Existing controller-absent cancellation
recovery and worker/model self-approval restrictions remain intact. The CLI
`brain-agent pause|resume|cancel|kill` routes through this service and retains
its established output semantics.

BS0.1 remains the network boundary. The repository still has no usable
authenticated HTTP service identity: the new lifecycle/review control paths
are explicitly rejected before request-body read, and no functional HTTP or
Brain Console mutation controls are enabled. Localhost, Origin, or a caller
header is not treated as authorization. This is a deliberate completion of the
shared Brain-owned control foundation, not a claim that U0-C network/operator
actions are available.

Evidence: `operations/reports/agent-mode-u0-c1-guarded-controls-evidence-2026-09-14.md`.
Exact next task: the authoritative **BS0.5 authenticated service identity
prerequisite**, followed by the authenticated HTTP/Console mutation gate. Do
not start that gate until the identity contract is usable.

Clarification: canonical BS0.5 — **Create the contract registry** — is already
COMPLETE and is not reopened by U0-C work. The trusted-service identity noted
as future work by BS0.1 was absent from that descriptive registry; U0-C2 below
implements that unresolved U0 prerequisite without rewriting historical BS0
evidence.

## Current U0-C2 authenticated Agent Mode mutation boundary — 2026-09-14

U0-C2 — **Authenticated Brain Core Service Identity and Agent Mode Mutation
Admission** — is **COMPLETE** for the server-to-server Agent Mode boundary. U0-C
remains **IN PROGRESS**.

Brain Core now verifies the separate versioned `brain-service-auth-v1` HMAC
contract. A configured server-only service identity is loaded from
`BRAIN_CORE_SERVICE_ID` and `BRAIN_CORE_SERVICE_SECRET`; it receives only the
explicit `agent-mode.control` capability. Signed method, pathname, request ID,
freshness timestamp, and SHA-256 body digest are checked with timing-safe HMAC
comparison. Invalid identity/signature/freshness/capability requests are
rejected before body read. After authentication, a bounded body digest check
precedes typed command parsing and trusted service-actor mapping.

Only the Agent Mode run-control and review-control paths are promoted. They
call the U0-C1 service and preserve K4 StateStore/runtime identity/review
authority. Caller-supplied actor, PID, signal, model, retry, Origin, Referer,
and localhost values cannot widen authority. Credentials, publishing,
deployment, local-app, legacy approval, webhook, and other mutable routes
remain under the existing BS0.1 containment boundary. Mutation responses do not
enable wildcard CORS.

No service secret enters Brain Console/browser code, URLs, logs, responses, or
repository fixtures. Human/browser authentication and the same-origin
server-held mutation proxy are intentionally deferred to **U0-C3 — Brain
Console Guarded Mutation Proxy and Lifecycle/Approval Controls**.

Evidence: `operations/reports/agent-mode-u0-c2-service-identity-evidence-2026-09-14.md`.

## Current U0-C3A Console control-boundary prerequisite — 2026-09-14

U0-C3A — **Server-Only Brain Core Control Client and Operator Boundary Audit**
— is **COMPLETE** for its bounded security prerequisite. U0-C remains **IN
PROGRESS**.

The complete Brain Console tree was audited for middleware, sessions, operator
identity, CSRF/session binding, server actions, cookies, and security
documentation. None provides an authenticated browser/operator boundary, so
the result is classification **C — no authenticated operator/session boundary
exists**. Localhost, Origin, Referer, CORS, a CSRF token alone, browser IDs,
and caller-supplied actor fields are not operator authentication.

Per that classification, no unauthenticated browser→Console→Brain Core power
proxy was added and no mutation buttons are rendered. Brain Console now has a
server-only `brainCoreControlRequest()` helper protected by `server-only`.
It reads the server-held Brain Core service identity, signs the existing
`brain-service-auth-v1` contract, sends bounded Agent Mode lifecycle/review
commands, and parses strict bounded responses. Missing identity, invalid
path/body, transport failure, and malformed response fail closed. The helper
is not imported by client components, and the existing read-only `/agents`
surface remains credential-free.

Evidence: `operations/reports/agent-mode-u0-c3-console-guarded-controls-evidence-2026-09-14.md`.
Exact next task: **U0-C3B — Authenticated Operator Session and Console Control
Admission**. Do not start it automatically.

## Current U0-C3B authenticated operator session and Console controls — 2026-09-14

U0-C3B — **Authenticated Operator Session and Console Control Admission** — is
**COMPLETE** for the bounded local-operator gate. U0-C3 is complete and U0
remains **IN PROGRESS**.

The prerequisite audit found no existing Brain Console Ory/Clerk/session
integration, so this slice uses the intentionally narrow
`brain-console-operator-v1` fallback. A server-only operator ID and secret
configure an eight-hour maximum signed HttpOnly, SameSite=Strict `/api` cookie;
its HMAC key is HKDF-derived with a separate purpose and the session carries a
CSRF nonce. Login failures are generic and bounded, logout clears the cookie,
and no operator secret enters responses, browser storage, client code, or
logs. The transport accepts only loopback requests with consistent forwarding
headers.

The same-origin proxy admits only the promoted Agent Mode run and review paths.
It requires the authenticated cookie and matching session-bound CSRF header,
validates strict bounded bodies, and calls the existing server-only
`brainCoreControlRequest()` client. The Agents page now exposes pause, resume,
cancel, kill, approve, and reject controls; destructive/review actions require
confirmation, operation IDs remain stable for a mounted intent, mutations do
not retry automatically or update optimistically, and Brain Core rechecks
current authority. Unknown actions/extra authority fields are rejected before
the Core client. Core's other high-impact routes remain contained.

The session/proxy tests cover tamper, expiry, key separation, generic failure,
loopback/origin/CSRF admission, bounded body rejection, review forwarding, and
zero downstream calls on denial. The Core regression suite remains green after
explicit unknown-action rejection. This is authenticated local operator
access, not Ory/Clerk integration, multi-user identity, revocation storage, or
broader authorization; those and control auditing/hardening remain later U0
work. U0-A/U0-B projection/detail reads remain available and the browser still
has no direct Brain Core, SQLite, provider, filesystem, or runtime access.

Evidence: `operations/reports/agent-mode-u0-c3b-operator-session-controls-evidence-2026-09-14.md`.
Exact next bounded slice: **U0-D — Agent Mode Control Audit, Evidence, and
Operator Session Hardening**. Do not start it automatically.

## Current U0-D control audit and session hardening — 2026-09-14

U0-D — **Agent Mode Control Audit, Evidence, and Operator Session Hardening** —
is **COMPLETE** for the bounded local-operator gate. U0-C and U0-D are complete;
U0 remains **IN PROGRESS**.

The existing durable control receipt/event path now preserves bounded trusted
operator attribution separately from the authenticated Brain Console service
actor. The observer and `/agent-mode/console` projection expose at most 100
metadata-only control audits, and run detail exposes at most 50 matching
receipts. They contain action, target, outcome, reason code, operator ID,
service actor, receipt reference, and kill signal metadata only; session hashes
are not exposed in the Console projection and no secrets, CSRF values, PIDs,
prompts, hidden reasoning, provider payloads, or raw logs are returned.

All six existing guarded controls remain Brain Core-owned: pause, resume,
cancel, kill, approve, and reject. Core continues to enforce runtime identity,
kill/cancellation/review restrictions, deadlines, and idempotent operation
identity. The local session boundary now rejects any forwarded headers in the
absence of a trusted proxy, requires a direct loopback Host match and same
Origin, applies strict body limits, and uses a bounded five-failure cooldown.
Cookie logout is intentionally stateless clearing under the current local-only
threat model; no revocation ledger is claimed. Repeated reads or denied
requests perform no downstream control call.

The browser cannot supply operator attribution: the server-only proxy adds it
from the verified session before signing the existing Brain Core service
request. Existing K4 lifecycle/runtime authority and the single durable Agent
Mode event stream remain the sources of truth.

Evidence: `operations/reports/agent-mode-u0-d-control-audit-session-hardening-evidence-2026-09-14.md`.
Exact next U0 task: inspect the remaining U0 gaps and record one bounded next
slice after this audit; do not start it automatically.

## Current U0-E durable resource visibility — 2026-09-14

U0-E — **Root, Workcell, Node, Runtime, Model, and Execution-Resource
Visibility Gap Closure** — is **COMPLETE** for the bounded read-model gate. U0
remains **IN PROGRESS**.

The canonical `agent-mode-console-v1` response at `GET /agent-mode/console`
now includes bounded Root Goals, Workcells, and execution resources. Root and
Jarvis ownership comes from durable Agent Mode root/agent facts. Workcell
records expose only safe repository references, branch/base metadata, status,
lease ownership/currentness, latest validation, diff metadata, and durable
review/commit/merge status; absolute paths, lease fences, raw diffs, prompts,
provider payloads, and credentials are excluded. Existing durable host-health
facts remain the only node-resource source.

The `/agents` page adds read-only Roots, Workcells, and Resources views while
retaining existing Overview, Agents, Organizations, Tasks, and Failures views.
Runtime, model/provider, node, and execution-resource records remain distinct.
No probes, inventory database, browser authority, scheduler action, lifecycle
mutation, or new runtime behavior was added. Codex quota, richer node/
worktree inventory, Jarvis intake, and notifications remain explicitly not yet
surfaced where no canonical durable Brain source exists.

Evidence: `operations/reports/agent-mode-u0-e-resource-visibility-evidence-2026-09-14.md`.
Exact next bounded slice: **U0-F — Durable Escalations, Unread Notifications,
and Remaining Resource/Quota Visibility Gaps**; do not start it automatically.

## Current U0-F durable operator attention — 2026-09-14

U0-F — **Durable Escalations, Unread Notifications, and Remaining
Resource/Quota Visibility Gaps** — is **COMPLETE** for its bounded gate. U0
remains **IN PROGRESS**.

Brain now owns a small immutable attention index in the existing Agent Mode
StateStore. The explicit bounded reconciliation seam derives escalations from
uncertain Attempts, scheduler dead letters, and failed Workcell validations;
pending review requests produce notification metadata only and remain subject
to the existing review authority. Ordinary failures, cancellation, model
escalation requests, and maximum-depth conditions retain their existing
canonical classifications rather than generating noisy duplicate escalations.
Model-originated `AgentModeEscalationRequest` remains `model-untrusted` intent
and has no execution authority.

Notification and escalation IDs are deterministic from bounded source and
transition material. Records contain codes, severity, stable source/lineage
references, and timestamps only. Operator read receipts are keyed by the
authenticated server-side operator identity; read is not resolution or
approval. The canonical public console projection exposes non-personal
attention metadata, while personalized unread counts and individual mark-read
acknowledgements use the authenticated service boundary:
`GET /agent-mode/notifications` and
`POST /agent-mode/notifications/:notificationId/read`, proxied by the local
Console under `/api/agent-mode/notifications`.

The `/agents` page adds a compact read-only Attention tab with durable unread
state and individual Mark read acknowledgement. It adds no mark-all, resolve,
approve, retry, or lifecycle action. Repeated reads do not reconcile, mutate
budgets, advance scheduling, launch runtimes, call providers, or write browser
storage. Codex quota remains explicitly `unavailable` with reason
`no_canonical_durable_source`; no provider probe or guessed quota was added.

Evidence: `operations/reports/agent-mode-u0-f-escalations-notifications-evidence-2026-09-14.md`.
Exact next bounded slice: **U0-G — Unified Brain Console Phase Exit Audit**; do
not start it automatically.

## Current U0-G unified console phase-exit audit — 2026-09-14

U0-G — **Unified Brain Console Phase Exit Audit** — is **COMPLETE** and the
authoritative U0 exit gate **PASSED**. U0 is **COMPLETE**; V0 is planned and
has not started.

The audit reconciled U0-A through U0-F against their implementation seams,
durable StateStore/observer authority, bounded versioned APIs, authenticated
control paths, attention/read receipts, restart behavior, and full regression
evidence. The Console remains a non-authoritative observer: it owns no Agent,
Task, Run, Attempt, organization, budget, evidence, runtime, provider,
notification, or escalation ledger.

Durable accepted Root Goal/Jarvis ownership visibility satisfies the current
operator intake requirement; conversational Jarvis intake remains later voice
work. Codex quota is explicitly unavailable with reason
`no_canonical_durable_source`; no provider or subscription probe is performed.
The audit also repaired bounded attention reconciliation so an omitted source
cannot falsely resolve an open escalation.

Evidence: `operations/reports/agent-mode-u0-g-unified-console-exit-audit-2026-09-14.md`.
Exact next phase: **Phase V0 — Jarvis voice gateway**; do not start it
automatically.

## Current V0-A deterministic Jarvis voice gateway — 2026-09-14

V0-A is **COMPLETE** for the provider-neutral transport-contract and
deterministic fixture gate. V0 remains **IN PROGRESS**. Brain now defines a
versioned voice session/input/transcript/turn/output/interrupt contract and a
`JarvisVoiceGateway` seam that composes STT, the canonical-text-intake port,
and Jarvis-only TTS without creating Agent Mode work or selecting a model.

The fixture deterministically transcribes `fixture://voice/hello-jarvis`, routes
the bounded text through an explicit fixture-only `JarvisTextIntake`, and emits
`fixture://voice/jarvis-response`. Replay uses deterministic intake/output
identities and returns a duplicate without replaying logical intake or TTS;
conflicting material fails closed. STT/TTS failure, uncertainty, transport-only
interruption, worker speech, and voice control intents are all typed and tested.

This slice does not claim production durable conversational intake: the existing
Brain source has Root Goal/Jarvis ownership but no canonical intake queue. The
production adapter and push-to-talk/local STT integration are the exact next
V0-B prerequisite. MLX Whisper, FluidVoice, video Polly/Azure TTS, K4, and the
Console remain unchanged.

Evidence: `operations/reports/agent-mode-v0-a-voice-transport-contracts-evidence-2026-09-14.md`.
Exact next bounded slice: **V0-B — Push-to-Talk Input and Local Speech-to-Text
Adapter**; do not start it automatically.

## Current V0-B durable Jarvis intake and push-to-talk — 2026-09-15

V0-B is **COMPLETE** for its bounded gate. Brain now has one durable
`JarvisTextIntakeService` shared by typed and voice submissions. It creates the
canonical root task and persistent `agent:jarvis` ownership atomically with the
intake record, stores only bounded hashes and IDs, and returns deterministic
duplicate/conflict outcomes across restart and concurrent retry.

The authenticated Brain Core route is `POST /agent-mode/jarvis/intake` with the
narrow `agent-mode.intake` capability. Console server routes derive operator
identity from the signed local session and proxy typed/voice submissions; no
browser-supplied root/task/policy/runtime/model fields are accepted. The
canonical Agent Mode console projection discovers intake-created `root.goal`
tasks even before K4 spawn-root state exists.

Local STT uses `MlxWhisperSpeechToTextProvider` only when explicitly configured
with an installed executable, local model, and resource lock. WAV is capped at
8 MiB and 30 seconds; process argv, output, timeout, and private-temp cleanup
are bounded. No network or model/provider gateway is used. Deterministic process
fixtures cover successful JSON parsing, malformed output, timeout, and resource
denial. Live MLX acceptance remains deferred until safe coordination with the
retained Bible Studies MLX pipeline is proven.

The `/agents` page provides click-to-record push-to-talk, transcript review,
explicit submit, and discard. It does not expose voice control actions or
always-on/wake-word behavior. V0 remains **IN PROGRESS**.

Evidence: `operations/reports/agent-mode-v0-b-push-to-talk-local-stt-evidence-2026-09-15.md`.
Exact next bounded slice: **V0-C — Jarvis Text-to-Speech Output and Interruptible
Playback**; do not start it automatically.

## Current V0-C1 canonical Jarvis response generation — 2026-09-15

V0-C1 is **COMPLETE** for the bounded deterministic response-generation and
finalization prerequisite. V0-C remains **IN PROGRESS**. The repository has no
live model or speech path in this slice; V0-A's `responseText` remains
fixture-only, and the Video Orchestrator Polly adapter remains a separate
narration surface.

Brain now retains the smallest bounded source material needed for a meaningful
answer: `agent-mode.jarvis-task-input.v1` stores canonical original intent for
the root lifecycle, and `agent-mode.jarvis-readable-result.v1` stores explicitly
Jarvis-readable structured facts linked to the authoritative successful K5
organization final result. These are not chat history, raw worker output, or a
second K4 ledger. Facts and evidence references are bounded and linkage is
validated against the K5 receipt.

`JarvisResponseFinalizer` is the only production user-facing response producer.
It uses deterministic strategy A over those durable facts, requires completed
successful K5 state, rejects caller-supplied text/model/provider/speaker
authority, and publishes only through `JarvisUserResponseService`. The fixture
answers `Summarize the completed research.` with meaningful research,
engineering, and audit content rather than IDs or hashes. Replay, concurrency,
and StateStore reopen produce one immutable response.

V0-C2 is now **COMPLETE** for the bounded browser-local speech transport. The
`/agents` page reads the canonical published response from Brain Core, validates
the strict Jarvis-owned schema, and speaks exactly that text through feature-
detected browser `SpeechSynthesis`. The versioned speech request/receipt uses a
deterministic response/transport identity; explicit Stop speaking interrupts
only the local browser effect, with generation fencing so late completion or
error callbacks cannot overwrite interruption. Re-speaking reuses the same
response and output identity.

No server TTS ledger, audio file, provider credential, network/probe, model,
runtime, worker, or Brain lifecycle effect is added. Unsupported browser speech
is explicit and the canonical text remains readable. Automated deterministic
transport/schema tests pass; live audible device acceptance remains a manual
follow-up. V0-C is **COMPLETE** and V0 remains **IN PROGRESS**.

Evidence: `operations/reports/agent-mode-v0-c-jarvis-tts-interruptible-playback-evidence-2026-09-15.md`.
Exact next bounded task: **V0-D — Jarvis Voice Gateway Phase Exit Audit**; do not
start it automatically.

## Current V0-D Jarvis voice gateway phase-exit audit — 2026-09-15

V0-D is **COMPLETE** and V0 is **COMPLETE**. The exit gate passes: voice is a
transport over the same durable Jarvis, task, K4, and K5 contracts and can be
replaced without changing identity or orchestration. The deterministic offline
fixture proves STT → production durable Jarvis intake → the existing three-worker
K5 fixture → authoritative structured results/evidence → canonical Jarvis
response → replaceable fake speech transport. Typed and voice intake share the
same durable authority; `approve` and `reject` voice phrases are explicitly
denied and make no control-service calls.

The audit confirms bounded audio/transcript/response retention, MLX safety
guards, preservation of the separate Bible Studies transcription capability,
transport-only interruption with late-callback fencing, Jarvis-only speech, and
no model/provider/network/Harness/BrainNode/Workcell effects. Browser/OS
SpeechSynthesis is classified privacy **B** because the application makes no
provider request but the platform engine may be managed; physical audible output
remains a manual device check. Wake word remains a non-blocking future deferral.

Evidence: `operations/reports/agent-mode-v0-d-voice-gateway-exit-audit-2026-09-15.md`.
The prior C2 evidence link was corrected to the actual canonical report
`operations/reports/agent-mode-v0-c-jarvis-tts-interruptible-playback-evidence-2026-09-15.md`.

The exact next roadmap phase is **Phase D0 — distribution and always-on
options**. D0 has not started.

## Current D0-A portable core configuration — 2026-09-15

D0-A is **COMPLETE** and D0 remains **IN PROGRESS**. Brain now has one strict,
versioned `brain-runtime-config-v1` contract for the lean Core deployment.
Built-in defaults, portable profile, host-local profile, and known environment
overrides resolve deterministically. StateStore, Core bind/port, Console Core
URL, BrainNode roots, runtime/temp roots, provider/resource references, and
optional capability availability are explicit; secrets remain external and
runtime-generated state remains outside configuration.

The lean profile is independent of Office/MacBook paths, personal Mind,
Bible Studies, FluidVoice, Video Orchestrator, Tailscale, and private provider
state. Missing optional integrations are unavailable rather than startup-fatal.
The existing `BRAIN_AGENT_MODE_STATE_DIR`, `BRAIN_CORE_HOST`, and
`BRAIN_CORE_PORT` behavior remains compatible. `brain-agent config validate` is
read-only, strict, redacted, and performs no network/provider/runtime probes.
Temporary HOME and fake-install-root tests prove host-neutral semantics without
changing Agent/Task/Run/Attempt, K4/K5, Jarvis, review, or voice contracts.

Evidence: `operations/reports/agent-mode-d0-a-portable-core-config-evidence-2026-09-15.md`.
Exact next bounded slice: **D0-B — Reproducible Lean-Core Bootstrap and Dry-Run
Installer**; do not start it automatically.

## Current D0-B reproducible lean-core bootstrap — 2026-09-15

D0-B is **COMPLETE** and D0 remains **IN PROGRESS**. Brain now emits the
versioned, bounded `brain-bootstrap-plan-v1` contract through the read-only
`brain-agent bootstrap plan --dry-run` command. The plan covers fixed Core and
Console package-lock/build actions, startup/smoke checks, source versus
release provenance, safe installation/state separation, existing-install
detection, and external secret handoff without printing secret values.

No D0-B command installs dependencies, stages files, registers services,
starts processes, probes providers, creates runtime state, or invokes
BrainNode/Harness. Node `>=22.5.0` and npm `>=10.0.0` are explicit package
engine requirements. Optional staging, rollback execution, service
registration, and real package installation remain later D0 work.

Evidence: `operations/reports/agent-mode-d0-b-lean-core-bootstrap-evidence-2026-09-15.md`.
Exact next bounded slice: **D0-C — Portable Runtime Packaging Contract**; do not start it automatically.

## Current D0-C portable runtime package — 2026-09-15

D0-C is **COMPLETE** and D0 remains **IN PROGRESS**. Core packages as prebuilt
JavaScript plus exact lockfile/package metadata for later production dependency
hydration. Console packages as verified Next standalone traced runtime plus
required server/static/public assets. Both are represented by strict,
deterministic `brain-runtime-package-v1` manifests with bounded allowlists,
hashes, exact-file verification, no symlinks, normalized modes, and no
personal/secret/mutable-state content.

`brain-agent package build --output PATH --release-revision REV` writes only a
fresh explicit package directory; `brain-agent package verify --root PATH` is
read-only. Neither installs dependencies, starts/registers services, deploys,
or contacts the network. An isolated real package Console startup served
`/agents` successfully from its staged root. The D0-B evidence report did not
include its terminally reported full-suite aggregate; no historical evidence
was rewritten.

Evidence: `operations/reports/agent-mode-d0-c-portable-runtime-packaging-evidence-2026-09-15.md`.
Exact next bounded task: **D0-D — Local macOS/Linux Runtime Installation and Service Packaging Contract**; do not start it automatically.

## Current D0-D local install and user-service packaging — 2026-09-15

D0-D is **COMPLETE** and D0 remains **IN PROGRESS**. Verified runtime packages
can now be explicitly applied into versioned release roots with separate
mutable state, host config, external secret reference, service descriptors,
and bounded install receipts. Repeated same-package applies converge; unknown
or conflicting targets and unverified packages are rejected without writes.
Core hydration is truthfully `npm ci --omit=dev` and may need registry access
only during a future explicitly authorized live installation. Tests use a fake
hydrator with zero network.

macOS LaunchAgent and Linux systemd-user descriptors are rendered as generic,
user-scoped, inert service packages with structured argv, external secret
references, safe restart policy, and no automatic registration/start. Node is
an external prerequisite. The current Office deployment, BrainNode instance,
state, secrets, and service topology remain untouched; this is portable
user-service packaging, not H0 unattended-release certification.

Evidence: `operations/reports/agent-mode-d0-d-local-install-service-packaging-evidence-2026-09-15.md`.
Exact next bounded task: **D0-E — StateStore Export/Import and Control-Plane Relocation Contract**; do not start it automatically.

## Current D0-E StateStore relocation — 2026-09-15

D0-E is **COMPLETE** and D0 remains **IN PROGRESS**. Brain now has a bounded
`brain-state-snapshot-v1` logical export/import contract for a later offline
control-plane move. Final export requires a closed source and read-only
StateStore access; import creates only a fresh current-schema target and
validates hashes and foreign keys transactionally. Domain identities, event
order, exact-once material, reviews, scheduler, Jarvis, and K5 state are
preserved. SQLite pages/WAL files, secrets, install/config metadata, uploads,
service activation, and live migration are outside the contract. Host-local
runtime/PID/lease authority and uncertain effects remain visible evidence for
normal recovery reconciliation and are never blindly reused or replayed.

Evidence: `operations/reports/agent-mode-d0-e-state-relocation-evidence-2026-09-15.md`.
Exact next bounded task: **D0-F — Control-Plane Relocation Cutover and
Recovery Drill**; do not start it automatically.

## Current D0-F control-plane cutover — 2026-09-16

D0-F is **COMPLETE** and D0 is **COMPLETE**. An isolated macOS fixture now
proves the complete offline relocation sequence from quiesced source through
verified target package/install, fresh StateStore import, evidence-backed
readiness, foreground Core/Console startup, restart, and semantic
reconstruction. The source remains inactive; no service manager is invoked and
no automatic failback exists. Readiness validates actual artifacts/config,
secret references, imported state, schema compatibility, and bounded
host-local authority rather than trusting caller booleans. Imported PIDs and
stale lease authority are not reused; uncertain effects remain blocked from
replay. Linux parity is contract-tested metadata only, not a live Linux drill.

Evidence: `operations/reports/agent-mode-d0-f-control-plane-cutover-evidence-2026-09-16.md`.
The next authoritative phase is **H0 — long-duration hardening**; do not start it automatically.

## Current H0-A deterministic hardening harness — 2026-09-16

H0-A — **Deterministic Fault-Injection Matrix and Soak Harness Foundation** —
is **COMPLETE** as a test-only foundation. D0 remains **COMPLETE**. The
Brain Core test fixtures now have a strict versioned scenario/result contract,
closed fault/action vocabulary, injected monotonic logical time, hard scenario
bounds, deterministic fault order, bounded evidence references, and read-only
safety/liveness/audit monitors. Existing K4/K5, ModelGateway, NodeTransport,
restricted Harness, scheduler, StateStore, and relocation fixtures are reused;
the harness adds no production fault endpoint and no second control plane.

The release gate remains deliberately **INCOMPLETE**: accelerated fixture time
does not prove a wall-clock soak. Live provider acceptance and the dedicated
security release review are also not claimed. H0 remains **IN PROGRESS**.
Controlled write-capability expansion remains separately approval-gated.

Evidence: `operations/reports/agent-mode-h0-a-hardening-harness-evidence-2026-09-16.md`.
Exact next task: **H0-B — Multi-Hour Isolated Autonomous Soak and
Resource-Stability Acceptance**; do not start it automatically.

## Current H0-B six-hour wall-clock acceptance — 2026-09-17

H0-B — **Multi-Hour Isolated Autonomous Soak and Resource-Stability
Acceptance** — is **COMPLETE** for the isolated test-only gate. H0 remains
**IN PROGRESS** and the H0 release gate remains **INCOMPLETE**. A measured
30-minute preflight froze bounded resource thresholds, followed by a genuine
`21,600,004.877417 ms` monotonic acceptance with `360/360` completed cycles,
zero missed cycles, twelve fixed and verified fault windows, two scheduled
process restarts, and one final clean reconstruction. All threshold and
invariant checks passed.

The workload stays above the existing K4 control plane: it reuses durable
StateStore/scheduler/reservation/lease/fence/node/restricted-profile fixtures
and one MockAgentRuntime lifecycle. It does not launch a production daemon or
provider. Final reconstruction retained one completed fixture lifecycle and
one expired stuck-child fixture, with one Task/Run/Attempt, one receipt, one
evidence reference, zero active children, zero FK violations, and zero budget
used/reserved. No live model/provider, Harness, BrainNode, Workcell, network,
SSH/Tailscale, Office state, service-manager, or production repository effect
occurred. SQLite main, WAL, and SHM telemetry were tracked separately, with a
frozen bounded main-file ceiling for checkpoint-aware stability measurement.

The earlier calibration failures (checkpoint growth, warm-half RSS startup
headroom, and a future-event post-restart probe) are retained in the evidence
trail; the final fresh preflight and six-hour run passed after narrow repairs.
Evidence:
`operations/reports/agent-mode-h0-b-wall-clock-soak-evidence-2026-09-17.md`.

## Current H0-C security release review — 2026-09-17

H0-C — **Security Release Review and Live Acceptance Audit** — is **COMPLETE as
an audit**. H0 remains **IN PROGRESS** and its release gate remains
**INCOMPLETE**. The review covered the full current-build trust boundary from
Brain Console and operator session provenance through Core service auth,
StateStore, K4 admission/lease/budget/runtime authority, restricted Harness,
NodeTransport, Jarvis typed/voice boundaries, D0 relocation, and H0 test-only
surfaces. No BLOCKER or HIGH security finding was found. A test-only closed
`agent-mode.security-release-review.v1` contract records bounded review
identity, surface coverage, findings, and the ten live-acceptance
classifications; it is not runtime authority.

The safe local current-build acceptance read `/agent-mode/console` ten times
with no runtime/provider/tool effect and rejected an unauthenticated lifecycle
mutation with HTTP 401. H0-B's real isolated-process evidence is retained as
live evidence only for process crash/restart, stale lease/fence, duplicate
delivery, stuck-child TTL, and durable auditability. Provider outage and
remote-host loss are explicitly **EXTERNAL_SENSITIVE** and were not exercised;
sandbox/tool live acceptance is **UNSUPPORTED/NOT RUN**. No provider, Office
state, remote host, SSH/Tailscale, service manager, BrainNode, Workcell,
repository, or network effect occurred.

Evidence:
`operations/reports/agent-mode-h0-c-security-live-acceptance-evidence-2026-09-17.md`.
Exact next bounded prerequisite: separately authorize disposable provider and
remote-host boundaries for the remaining live gates; do not start automatically.

## Current H0-D live-boundary readiness audit — 2026-09-17

H0-D — **Restricted Harness Live-Denial Acceptance and External Gate
Authorization Readiness** — is **COMPLETE AS A BOUNDARY AUDIT**. H0 remains
**IN PROGRESS** and its release gate remains **INCOMPLETE**.

The exact pinned Harness is locally present and the current production adapter
has genuine separate-child, explicit-environment, pinned-identity, bounded
protocol, and reaping evidence. The safe local adapter is intentionally a
fixture-only provider bridge with no tools; therefore sandbox and tool denial
remain **UNSUPPORTED / NOT RUN**, rather than being promoted from fixture
coverage. Provider outage and remote-host loss remain **EXTERNAL_SENSITIVE /
BLOCKED** pending separately authorized disposable resources.

H0-D records bounded authorization packets: one zero-cost, zero-retry
disposable Bedrock request, and one disposable remote BrainNode read-only
reconnect test with zero repository writes. No external resource or protected
state was contacted. Evidence:
`operations/reports/agent-mode-h0-d-live-boundary-readiness-evidence-2026-09-17.md`.

Exact next prerequisite: authorize the disposable provider and remote-node
packets and establish a safe supported restricted-runtime denial topology.

## Current H0-E restricted Harness topology audit — 2026-09-17

H0-E — **Restricted Harness Live-Denial Topology Closure** — is **COMPLETE AS
A TOPOLOGY AUDIT**. H0 remains **IN PROGRESS** and its release gate remains
**INCOMPLETE**.

The pinned SDK has a stable `UNKNOWN_TOOL` error for an unregistered tool, but
the Brain production restricted composition has no registered or injected
tools and no sandbox/filesystem service. A synthetic denied request therefore
cannot reach the real child boundary without adding production authority or an
unapproved topology. Sandbox and tool denial remain **UNSUPPORTED / NOT RUN**;
the profile and capability fixtures remain fixture evidence only.

H0-E adds no production fault surface, tool broker, provider path, or network
access. Existing separate-child and environment-isolation evidence remains
valid, while H0-E itself launches zero denial children. Provider outage and
remote-host loss remain **EXTERNAL_SENSITIVE / BLOCKED**. Evidence:
`operations/reports/agent-mode-h0-e-restricted-harness-live-denial-evidence-2026-09-17.md`.

Exact next prerequisite: security-approved support for a harmless restricted
denial topology or a formal review of the live-required classification for
capabilities absent from Brain's production composition, plus authorization of
the existing disposable provider/remote-node packets.

## Current H0-F absent-capability gate classification — 2026-09-17

H0-F — **Absent-Capability Security Gate Classification Review** — is
**COMPLETE**. H0 remains **IN PROGRESS** and its release gate remains
**INCOMPLETE**. The exact pinned Harness SDK was reviewed directly. Its
registry/`UNKNOWN_TOOL`, reserved `run_code` PTC transport, code runtime, and
terminal/filesystem/subprocess package surfaces are real SDK capabilities, but
the Brain production restricted composition does not inject or expose them.

The hardening matrix therefore uses an explicit `acceptanceRequirement`:
`sandbox_denial` and `tool_denial` are `STRUCTURAL_ABSENCE` classes and require
machine-checked `structural_pass` evidence. They are not marked `live_pass`.
The historical H0-C `liveAcceptanceRequired` flags remain unchanged for audit
continuity; the explicit requirement is the current gate authority. Future
production capability, Harness pin, or composition changes invalidate the
structural evidence. Provider outage and remote-host loss remain blocked
external-sensitive live prerequisites. Evidence:
`operations/reports/agent-mode-h0-f-absent-capability-gate-review-evidence-2026-09-17.md`.

Exact next prerequisite: authorize the bounded disposable provider and
remote-node packets; do not start automatically.

## Current H0-G disposable external live acceptance — 2026-09-17

H0-G is **BLOCKED** and H0 remains **IN PROGRESS**. The current task explicitly
authorized both independent disposable packets and their mandatory teardown.
The bounded AWS preflight authenticated through the configured provisioner,
froze the USD 2.00 total-spend/45-minute resource limits, and created an
exact-ID cleanup manifest outside Git. The first required dedicated H0-G IAM
role creation was denied by AWS (`iam:CreateRole`), so no provider role,
instance profile, EC2 host, S3 object, remote BrainNode, live Bedrock request,
or inference was created or run. Exact checks found zero H0-G resources
remaining and the temporary run root was removed.

The two external classes remain `blocked`, not `live_pass`; H0-F's structural
acceptance, H0-B wall-clock gate, and H0-C audit remain valid because no
production runtime or security-sensitive source changed. Evidence:
`operations/reports/agent-mode-h0-g-external-live-acceptance-evidence-2026-09-17.md`.

Exact next prerequisite: grant the approved non-production provisioning path
the dedicated disposable IAM create/policy/profile permissions and rerun the
same bounded H0-G packet. Do not use a shared or production identity/resource.

## H0-G2 corrected disposable external live acceptance — 2026-09-17

H0-G2 is **COMPLETE** and H0 is **COMPLETE**. The final bounded packets used
the approved dedicated `claude-codex-ec2-*` namespace and exact destroyer
teardown. The provider packet passed real MiniMax baseline, exact deny-policy
outage, and recovery requests with zero retries/fallbacks. The remote packet
exercised the real `SshNodeTransport` through SSM, performed one read-only
BrainNode operation, survived one EC2 stop/start cycle, and reconnected to the
same durable duplicate receipt/effect.

No production source or shared IAM state changed, and exact cleanup found zero
remaining disposable resources. H0-B soak and H0-C security-review validity
remain unchanged. Evidence:
`operations/reports/agent-mode-h0-g2-external-live-acceptance-evidence-2026-09-17.md`.

All source-enumerated hardening classes now satisfy their required acceptance.
U0, V0, and D0 are already recorded complete earlier in the roadmap. No
successor foundation phase is created after H0. The dated H0-A through H0-G
entries above preserve historical closure chronology; the current authority is
H0-G2 plus the post-H0 decision below.

## Post-H0 roadmap decision — 2026-09-17

The Agent Mode foundational roadmap is complete through H0. The selected
direction is **NO NEW FOUNDATION PHASE / RELEASE-MAINTENANCE MODE**. No H1/K6
or other sequence-named foundation phase is being invented. Product iteration
and optional platform work remain separately authorizable.

The exact next bounded task is **Agent Mode release-maintenance baseline —
signed release promotion with consistent backup/restore and rollback drill**.
It is not started by this decision. The task will cover supported release
version/provenance, StateStore-plus-evidence backup/restore, isolated
upgrade/rollback, compatibility, monitoring, incident, cost, support and
migration handoff. It must preserve the existing Brain authority boundaries.

Full decision report:
`operations/reports/agent-mode-post-h0-roadmap-decision-2026-09-17.md`.

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
