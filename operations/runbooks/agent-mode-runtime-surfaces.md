# Agent Mode Runtime Surfaces

## One harness principle

Brain is the single control/orchestration harness. It owns durable tasks, runs,
attempts, routing admission, budgets, permissions, leases, capabilities,
evidence, scheduling, and recovery. The other entries are execution or
navigation surfaces, not competing authorities.

```text
USER → repos.sh / sessions.sh / Herdr
     → Brain control harness
       → K1.2 policy + StateStore + ModelGateway
         → MiniMax M2.5 | GLM-5 | Claude Opus 4.6
       → optional restricted DeepSeek Harness AgentRuntime
       → Claude Code runtime (specialist)
       → Codex runtime (specialist/subscription)
```

## Normal operation

Run `repos` (the `tools/scripts/repos.sh` shell entry point). It first opens
the model/runtime selector below, with Auto first and preselected. Press Enter
to accept Auto, or move down before the repository picker appears.
`--choose-model` remains a compatibility alias; `--model VALUE` is available
for non-interactive callers.

```text
Auto
MiniMax M2.5
GLM-5
Opus 4.6
Codex
```

Auto invokes the canonical `brain-agent run` entrypoint. Explicit Brain model
choices invoke the same entrypoint with an admitted model request; Brain still
performs access, health, budget, capability, safety, and admission checks.
Opening the optional menu performs no AWS probe. Claude Code remains supported
by its dedicated launcher and resume code, but is intentionally absent from
the normal selector.

`Claude Code` remains a dedicated Claude coding runtime and continues to use
`claude-bedrock-env.sh` when launched. `Codex` remains a separate
subscription-backed coding/runtime resource with Brain quota/reserve policy.

## Sessions and authority

Run `sessions` to inspect Brain sessions. It first opens the same selector,
with Auto first and preselected; pressing Enter opens the Brain/Auto view.
`sessions --choose-model` remains a compatibility alias and `--model VALUE` is
available for non-interactive selection. Brain rows
are read from the durable Brain Core `/agent-console` observer and show the
Auto view plus the actual latest model reference, runtime, status, and last
activity when available. If the Brain StateStore/API is missing, the script
shows no Brain rows; it never manufactures a session from terminal history.
Selecting a Brain row opens the durable control menu: `inspect`, `pause`,
`resume`, `cancel`, or `kill`. Claude and Codex retain their native resume
commands.

The same controls are available from another terminal with the canonical run
identifier:

```text
brain-agent inspect RUN_ID
brain-agent pause RUN_ID
brain-agent resume RUN_ID
brain-agent cancel RUN_ID
brain-agent kill RUN_ID
```

`inspect` is read-only. `pause` and `resume` durably transition the active
run/attempt and append audit events; resume fails closed when the owned runtime
identity cannot be verified. `cancel` records a durable cancellation request;
the active controller acknowledges only after it stops dispatch and reconciles
its work. If no owned controller remains, the operator surface may acknowledge
the request and finish the run after recording that recovery fact. `kill` is
the explicit force path. It uses the durable run ID plus PID/start-time/command
identity and sends `SIGTERM` only when all identity checks pass. PID-only or
stale-identity signals are never sent.

For a non-interactive observer check, use `sessions.sh --list-brain`. A missing
or unreachable Brain Core returns no rows rather than a fabricated session.

The durable Brain StateStore is authoritative. CLI/harness session files,
provider logs, Herdr views, and Console projections are observers or runtime
evidence. A model selection is performed by Brain K1.2 policy, not by Herdr,
Claude Code, Codex, or the shell scripts.

## DeepSeek Harness and Herdr

DeepSeek Harness is an internal optional `AgentRuntime` implementation behind
Brain. Its stock application/profile is not a normal user-facing choice and it
does not own tasks, budgets, routing, or permissions.

Herdr is a workspace/terminal/fleet surface. Its canonical agent command is:

```toml
# Herdr application-local configuration; do not copy secrets into Brain.
[agents.brain]
name = "Brain"
command = "brain-agent"
args = ["run"]
```

If the installed Herdr version uses a different agent-definition schema, map
the same command/arguments through its local UI/configuration rather than
mutating external/private Herdr state. Herdr must launch Brain; it does not
need one agent type per Bedrock model and is not Brain's source of truth.

`jump.sh` remains repository navigation-only and contains no model or runtime
routing.

## K3.0 Workcell lifecycle

K3.0 provides a safe foundation for future coding workers. A Workcell is a
durable StateStore record bound to one task/run/attempt, repository reference,
canonical repository root, owner agent, generated branch, and worktree path.
The path is created only below an explicitly configured workcells root outside
the primary checkout. The primary checkout is never a valid Workcell target.

The lifecycle is intentionally narrow:

```text
brain-agent workcell create \
  --task-id TASK --run-id RUN --attempt-id ATTEMPT \
  --repository-ref REPOSITORY --repository-root /path/to/repo \
  --workcells-root /path/outside/repo/workcells --owner-agent AGENT
brain-agent workcell inspect --workcell-id WORKCELL --actor ACTOR
brain-agent workcell destroy --workcell-id WORKCELL --actor OWNER
```

`create` durably reserves identity and emits `WorkcellCreatedReceipt`.
`prepare` is the library lifecycle action that creates the fixed Git worktree
and emits `WorkcellPreparedReceipt`; the current CLI keeps creation and
preparation separate so an orchestrator must explicitly prepare a recorded
Workcell. `inspect` validates Git binding and emits `ValidationReceipt`.
`destroy` removes only a matching clean Workcell and emits
`WorkcellDestroyedReceipt`; dirty or foreign paths fail closed. No merge,
approval, deploy, direct write, shell, or arbitrary command exists in K3.0.

The StateStore is the sole authority. Receipts are durable rows plus append-only
events and contain lineage, actor, timestamp, operation hash, and result state,
not secrets. A process interruption before Git preparation leaves a durable
`created` row; stale recovery either reconciles an exact matching worktree or
marks the row failed without removing a foreign path. Failed creation cleanup
removes only an exact target that was absent before that attempt.

The capability boundary admits `repo.read` and the future scoped name
`repo.write(workcell)` only. It does not implement repository-writing commands,
and there is no `repo.write(main)` or shell/arbitrary-process capability.

## K3.1 writer lease and diff admission

K3.1 adds the durable ownership boundary for future Workcell writers. The
StateStore persists lease ID, Workcell ID, owner agent, owner attempt, creation
and expiry times, fence token, and lease status (`active`, `expired`, `released`,
or `revoked`). A Workcell has at most one active lease. Active leases cannot be
stolen; an expired lease is closed before a replacement is granted, and the
replacement receives a strictly higher per-Workcell fence token.

Future write admission must provide:

```text
Workcell + repo.write(workcell) + repository/worktree binding
          + owner agent/attempt + active lease + current fence token
```

Missing lease, expiry, wrong owner/attempt, stale fence, wrong Workcell, main
checkout binding, invalid capability, or a Workcell state that does not allow
writing produces a durable `WriteRejectedReceipt`. The admission API performs
no file edit. There is no `repo.write(main)`, shell, or arbitrary command.

Diff capture is a read-only fixed Git operation after successful admission. It
stores base revision, current revision, tracked and untracked changed files,
and a deterministic hash of the complete diff state, with a
`DiffCapturedReceipt`. Validation admission stores a requested result only
after a diff exists. A passing stored result yields the separate evidence state
`validation_ready`; failed or unknown results remain rejected. No test runner,
merge, approval, deploy, or autonomous coding agent is invoked.

Receipts include task/run/attempt/Workcell/lease/fence/timestamp/operation-hash
lineage. Lease expiry, process crash, and machine restart are handled by
reopening the same StateStore and deterministically expiring/replacing leases;
old fencing tokens remain invalid after replacement. K3.1 is complete; K3.2 is
the separate gate for bounded Workcell-local writes and preimage/snapshot
validation.

## K3.2 bounded Workcell-local text mutation

K3.2 exposes exactly one modification-only library primitive:
`workcell.file.patch`. The caller supplies an operation ID, Workcell and
repository binding, lease/fence/owner identity, a canonical relative target,
the expected SHA-256 preimage, one exact old-text anchor, and replacement text.
The operation applies only to an existing regular UTF-8 text file. It does not
create or delete files. The file and replacement are each bounded to 256 KiB.

The manager resolves the durable Workcell path itself. Absolute paths, Windows
drive/UNC forms, traversal, non-canonical components, reserved `.git`/Brain
metadata/runtime components, symlinks or nested symlink components, the primary
checkout, another Workcell, directories, special files, binary data, and
invalid UTF-8 fail closed. The target must remain inside the canonical
Workcell and must match the expected preimage before the temporary sibling is
prepared and again immediately before rename.

The write sequence is durable admission → mutation record → preimage
verification → exclusive temporary sibling → fsync/close → atomic rename →
postimage verification → receipt. Existing mode bits are preserved; file
contents are not persisted. `WorkcellWriteAppliedReceipt`,
`WorkcellWriteRejectedReceipt`, and `WorkcellWriteReconciledReceipt` carry
task/run/attempt/Workcell/repository/relative-target/lease/fence/preimage/
postimage/timestamp/result/operation-hash lineage. Replaying a completed
operation returns its receipt without rewriting. Pre-rename interruption is
safe to resume; post-rename interruption is reconciled from the durable
postimage, and changed postimages are rejected without overwrite.

After a successful patch, use the existing K3.1 diff capture for Git evidence.
A successful write is not validation, review, commit, merge, push, deployment,
or approval. BrainNode remains read-only for this tranche and no unrestricted
`brain-agent write` command exists. K3.3 is the controlled validation gate.

## K3.3 controlled Workcell validation

The typed capability is `validation.run(workcell)`. A validation request binds
the Workcell ID, validator profile ID, repository/worktree authorization,
owner/attempt, active lease, and current fence token. The StateStore is the
sole authority; validation does not create a second database or control plane.

The registry currently allowlists only `git.diff.integrity`. Its profile names
the fixed Git diff integrity operation, repository type, 15-second timeout,
32 KiB evidence bound, and `git-diff-integrity/v1` evidence format. It has no
command string, shell option, package script, executable path, or arbitrary
input channel. The implementation calls the existing fixed non-shell Git
adapter against the durable Workcell and compares its base/current revisions,
changed files, and diff hash with the latest K3.1 diff evidence.

The lifecycle is durable admission → `ValidationStartedReceipt` → bounded
validator → `ValidationCompletedReceipt` (passed/failed evidence) or
`ValidationRejectedReceipt` (unknown profile, missing diff, invalid capability,
binding, lease/fence, timeout, interruption, stale/destroyed Workcell, or diff
drift). Evidence is a bounded deterministic JSON record plus SHA-256; no source
or command output is stored. Completed and rejected requests replay
idempotently. A started validation recovered after interruption is marked
`interrupted` and cannot become an ambiguous success. StateStore restart
preserves lifecycle, evidence, and receipts.

K3.3 is not itself a coding agent, shell, arbitrary command runner, model/LLM
worker, package executor, deployer, merger, pusher, or approval decision. K3.4
and K3.5 are complete for their bounded gates; K3 now has the concurrent
worker and explicit review/commit/merge authority boundary required before K4.

## K3.4 first bounded live coding worker

Run the deterministic gate from `projects/brain-core` before the one authorized
live acceptance. The controller creates one disposable Workcell and exposes
only `brain_read` and `brain_workcell_patch` to the pinned restricted child.
Brain owns the preimage hash, atomic patch, fixed `git.diff.integrity`
validation, budget settlement, and `awaiting_review` terminal state. The worker
is capped at three MiniMax M2.5 turns; no GLM-5, Opus, Codex, package/test
execution, commit, merge, push, deploy, or general write CLI is allowed. If the
live acceptance fails, preserve the durable failure evidence and stop without
retrying.

## K2.1 restricted Harness slice

The K2.1 runtime is bootstrapped reproducibly by
`node tools/scripts/agent-mode-k21-harness-bootstrap.mjs`. It pins DeepSeek
Harness `0.1.3-alpha.2` at commit
`c389f96bf3a9b6807cb71ed6bdad5849be0df6d8` under a machine-local runtime
root. Brain launches the SDK child internally; users launch `brain-agent`, not
the stock `dsh` application.

Each attempt applies an ephemeral restricted patch, injects only the Brain
model/tool bridge, and gives the child a complete allowlisted environment with
an attempt-private `HOME`/`TMPDIR` and isolated working directory. AWS
credentials, repository roots, shell, filesystem, subprocess, scheduler,
editor, job, and subagent services are not provided to the child. Model turns
and `brain_read` requests cross a local Unix socket; Brain owns K1.2 route and
budget admission, K0 outbox/lease/receipt handling, and the single typed
`repo.read`.

`brain-agent inspect RUN_ID` reads the durable observer. The full control set
is durable across terminals. Process loss is classified from the last durable
effect boundary; only `safe_to_resume` runs can be re-admitted, with fresh
access evidence, budget reservation, lease fencing, and owned-runtime
identity. Dispatched-without-receipt and possible external effects are never
replayed automatically. Live acceptance evidence is recorded in
`operations/reports/agent-mode-k2-1-live-slice-evidence-2026-09-09.md`; K2.2
operator-control evidence is recorded in
`operations/reports/agent-mode-k2-2-operator-controls-evidence-2026-09-09.md`.

## Historical broader K3.5 bounded promotion surface

K3.5 admits exactly two statically defined coding workers. Their Workcells and
writer leases are independent, while the root budget and pinned base revision
are shared durable constraints. Worker tools remain limited to Brain-owned
read and Workcell patch effects; review, commit, and merge are unavailable to
the restricted child.

After diff-integrity validation, Brain creates an immutable review request and
records an explicit non-model decision. `workcell.commit` is a fixed adapter
effect requiring the exact approved diff and passed validation. `workcell.merge`
is a separate fixed adapter effect requiring a one-use merge approval, a target
ref lease, and an immediate expected-head check. No `repo.write(main)`, force,
push, arbitrary Git flags, or shell path exists. Missing receipts after an
external Git effect are reconciled from the recorded candidate, source commit,
and target preimage/postimage evidence. K4 dynamic workers remain out of scope.

### Current K3.5-A gate

The currently authorized K3.5-A gate is concurrency and Workcell isolation
only. A deterministic disposable fixture must prove exactly two bounded workers
overlap with separate identities, attempts, Workcells, writer leases, fences,
and mutation histories while sharing only one pinned base revision. Cross-
Workcell writes, lease theft, same-Workcell contention, and stale fences must
reject, with StateStore restart and observer reconstruction. The main checkout
must remain unchanged.

Evidence:
`operations/reports/agent-mode-k3-5-a-concurrency-evidence-2026-09-09.md`.

Review and approval are now covered by the separate K3.5-B gate. Workcell
commit, target-ref fencing, merge authorization, and promotion
restart/reconciliation remain separate K3.5 work. K3 remains in progress and
K4 must not begin automatically.

### Current K3.5-B gate — review and approval authorization

K3.5-B records one exact candidate per durable review request: worker identity,
Workcell, branch, base/current revision, diff identity, and passed validation
evidence. Explicit Brain-controlled decisions persist as approved or rejected
with review receipts. Coding workers and models cannot create approvals or
approve themselves, and duplicate decisions are idempotent.

Candidate or validation drift marks the request `stale`; no silent refresh or
reapproval is allowed. The observer exposes only bounded review identity and
status. Evidence:
`operations/reports/agent-mode-k3-5-b-review-evidence-2026-09-09.md`.

K3 remains in progress. Workcell commit is now covered by the separate K3.5-C
gate. Target-ref fencing, merge authorization, and promotion
restart/reconciliation remain separate K3.5 work. Do not begin K4 automatically.

### Current K3.5-C gate — durable Workcell commit authorization

K3.5-C requires Brain-owned proof of the exact approved diff, passed matching
validation, unchanged repository binding, and a current unexpired Workcell
writer lease/fence before Git is touched. The fixed commit adapter accepts only
the exact approved changed-file scope and bounded commit message; it cannot
run a shell or arbitrary Git, reset, force, push, or target-ref mutation.

The StateStore durably records the commit operation and
`CommitRequestedReceipt`, `CommitCompletedReceipt`, `CommitRejectedReceipt`,
or `CommitReconciledReceipt`. Workcell state advances through
`approved → committing → committed`. A pre-Git crash leaves no commit and a
prepared operation; a post-Git crash is reconciled from the recorded parent
and Workcell revision. Replaying the same operation is idempotent, while a
different candidate rejects. Evidence:
`operations/reports/agent-mode-k3-5-c-commit-evidence-2026-09-09.md`.

Target-ref fencing, merge authorization, and merge restart/reconciliation
remain separate work. K4 must not begin automatically.

### Current K3.5-D gate — merge authorization and target branch safety

K3.5-D is complete. A merge approval is a one-use, durable binding for the
repository, source Workcell/branch/commit, review and validation evidence,
target ref, expected target HEAD, approver, operation ID, timestamps, and
expiry. It is distinct from commit approval. Brain rechecks the source and
target, acquires the scoped target-ref lease/fence, and rechecks the expected
target head immediately before the fixed merge effect.

Only the bounded non-shell merge adapter is available. It accepts no model
Git command, arbitrary flag, rebase, force operation, conflict-resolution
strategy, or push. A competing operation on the same repository/ref rejects
or becomes stale; Workcells on different refs remain independent.

The StateStore records merge operations plus
`MergeRequestedReceipt`, `MergeCompletedReceipt`, `MergeRejectedReceipt`, and
`MergeReconciledReceipt`. Pre-effect crashes leave no target mutation; post-
effect crashes reconcile only with the recorded operation and current target
authority. Same-candidate replay is idempotent, while different candidates
reject. Evidence:
`operations/reports/agent-mode-k3-5-d-merge-evidence-2026-09-09.md`.

K3 exit gate: **COMPLETE**. K4 remains planned and must not begin automatically.

## K4.0 bounded scheduler and heartbeat

K4.0 is the first event-driven substrate and is intentionally finite. The
existing Agent Mode SQLite WAL StateStore is the sole authority; it contains
durable scheduler events, schedules, claims, retries, dead letters, source
watermarks, and the latest tick observation. There is no second database or
event log.

Ingest only typed `k4.0` payloads with bounded JSON shape and immutable
deduplication identity. Conflicting content for the same source and
deduplication key fails closed. A scheduler tick reads an injected/current
timestamp, considers a bounded eligible set, claims each item with an existing
lease/fence, dispatches the closed internal `agent_mode.test.noop` handler, and
settles completion or deterministic retry/dead-letter state. Expired claims
can be recovered with a fresh fence; stale claimants cannot settle.

Use one pass only:

```text
brain-agent heartbeat --once
brain-agent scheduler tick
```

Both commands open the authoritative StateStore, execute one bounded tick, emit
JSON, and exit. A no-op tick reports `NO_ACTION` and performs zero
ModelGateway, AgentRuntime, model-token, cost, worker, shell, network, or
repository work. No daemon, timer, watcher, external event source, provider
retry, dynamic worker, or autonomous model call is part of K4.0.

K4.0 is complete for its bounded acceptance gate. Evidence:
`operations/reports/agent-mode-k4-0-scheduler-heartbeat-evidence-2026-09-10.md`.
The next task at that historical K4.0 boundary was K4.1; K4.1-A is now tracked
below and K4.1-B must not start automatically.

## K4.1-A local Git event source

K4.1-A is complete for its bounded source-adapter gate. The generic
`EventSourceAdapter` is source-neutral; the only concrete adapter is the
read-only `git.repository.revision` source. Configure it with a stable
`sourceId` and canonical repository resource reference while passing the
installation-specific repository root as a runtime binding. The path is never
stored as source identity.

`brain-agent sources poll --once` performs one bounded observation. First
success records current HEAD as the bootstrap watermark and emits no history.
Later observations verify ancestry, enumerate at most `catchUpLimit` commits in
oldest-first order, and persist each typed `repository.commit.observed` event
plus the new watermark transactionally. `hasMore` continues bounded catch-up.
Repeated polls deduplicate by source/repository/commit identity.

Commit metadata is inert bounded data. The fixed Git reader uses only
non-shell read operations for HEAD/ref, ancestry, bounded revision listing, and
immutable metadata. It never fetches, pulls, pushes, changes refs, checks out,
resets, merges, reads diffs, or writes repository files.

The source records deterministic debounce-group identity and cooldown
not-before state. Repository failures preserve the watermark and record finite
retry eligibility. Divergence is surfaced as durable `diverged` source state;
the watermark is preserved and history is not replayed or reset. The observer
exposes safe source status, watermark, last observation/error, cooldown,
catch-up, and emitted counts without paths or credentials.

Evidence:
`operations/reports/agent-mode-k4-1-a-git-event-source-evidence-2026-09-10.md`.
## K4.1-B1 internal Task/Run/Attempt lifecycle event source

K4.1-B1 is complete. The `brain.task.lifecycle` adapter reads only the existing
append-only Agent Mode `events` table; it never reads K4 scheduler rows,
heartbeat ticks, or source bookkeeping. Its watermark is the highest durable
event `sequence`, not a status snapshot or wall-clock timestamp. First
observation records the current sequence with zero historical emissions.

Later finite observations use bounded scan and emit limits and map only the
eligible Task/Run/Attempt transitions to `task.lifecycle.observed` scheduler
events. Non-eligible rows advance the cursor safely; malformed rows fail
closed. Ingestion and watermark advancement are one transaction, so conflicts
or failures preserve the previous cursor. Repeated polls deduplicate and
restart resumes from the stored sequence. Scheduler rows remain a separate
destination, making recursive feedback structurally impossible.

Use the existing finite operator surface:

```text
brain-agent sources poll --once --source-type brain.task.lifecycle
```

Polling may enqueue durable scheduler work but stops before any model, runtime,
worker, repository, daemon, listener, or network action. K4.1-B2 must reuse
this contract and the existing infrastructure health provider/catalog
bindings; it is not implemented here. Evidence:
`operations/reports/agent-mode-k4-1-b1-lifecycle-event-source-evidence-2026-09-10.md`.
K4 remains in progress. Next task: **K4.1-B2 — Host-Health Event Source Using
Existing Infrastructure Health Bindings**. Do not start it automatically.

## K4.1-B2 host-health event source

K4.1-B2 is complete. The `infrastructure.host-health` adapter consumes the
existing normalized `readInfrastructureHealth` plane, canonical host resources
from the infrastructure catalog, and the authoritative health provider
bindings. It does not call provider APIs or duplicate normalizers.

The source maintains a bounded versioned watermark containing current semantic
state per `resourceId|providerId|bindingId`. Status, freshness, and sorted
condition-code changes produce `infrastructure.host-health.changed`; observation
IDs, timestamps, and metric-only changes do not. Existing freshness helpers
drive deterministic stale/unknown transitions and later recovery. Bootstrap
stores a baseline without emitting an alert flood. Multiple providers remain
distinct, and missing/invalid snapshots, unknown resources, mismatched
bindings, or older observations fail closed without inventing outages.

Polling is finite and uses the existing command:

```text
brain-agent sources poll --once --source-type infrastructure.host-health
```

Scheduler rows are destination-only, so no feedback loop is possible. The
observer exposes bounded source/channel state without private selectors or
payloads. The source is observation-only: it creates no workers, models,
remediation, host mutation, daemon, listener, or network path. K4.1-B2 evidence:
`operations/reports/agent-mode-k4-1-b2-host-health-event-source-evidence-2026-09-10.md`.
K4 remains in progress. Next task: **K4.1-C — CI Event Source and K4.1
Event-Source Closure Audit**. Do not start it automatically.

## K4.1-C1 CI workflow-run event source

K4.1-C1 is complete. The `ci.workflow-run` source uses the shared
`EventSourceAdapter` seam and the existing durable EventSource watermark. Its
versioned cursor is bounded to semantic workflow-run state plus pagination
continuation. Historical bootstrap is quiet; later queued/in-progress/
completed observations produce only meaningful `ci.workflow.started` and
`ci.workflow.completed` scheduler events. Run ID and attempt are part of the
identity, so reruns cannot collapse into one run.

The first provider is GitHub Actions, isolated behind the injected
`GitHubActionsCiObservationReader` page-reader boundary. Only normalized
provider-neutral fields enter Agent Mode. Page/items/cursor/emission limits are
enforced, ordering is oldest-first, and stale observations, malformed provider
data, invalid cursors, pagination errors, provider failures, and repository or
workflow mismatches preserve the previous watermark and create no fake event.
There is no provider credential handling, direct network call, webhook,
listener, daemon, CI log/artifact/YAML reader, worker, or model invocation.

The source is exercised by the finite injected-reader fixture suite. Its
observer projection exposes safe CI state and scheduler source origin. Evidence:
`operations/reports/agent-mode-k4-1-c1-ci-event-source-evidence-2026-09-10.md`.
K4 remains in progress. Next task: **K4.1-C2 — Event-Source Closure Audit and
K4.2 Readiness Gate**. Do not start it automatically.

## K4.1-C2 EventSource closure and K4.2 boundary

K4.1-C2 is complete and K4.1 is closed. The four source types are
`git.repository.revision`, `brain.task.lifecycle`, `infrastructure.host-health`,
and `ci.workflow-run`. They share the finite `EventSourceAdapter` lifecycle and
existing transactional source watermark, but keep their correct cursor forms:
Git SHA ancestry, lifecycle event sequence, bounded health channel state, and
bounded CI provider cursor/run-attempt state.

The combined source pass registers and processes at most 16 sources, emits at
most 100 events per source, and times out an injected observation after 15
seconds. The global source-pass ceiling is therefore 1,600 events; the
scheduler heartbeat/tick separately processes at most 64 queue items. Sources
are processed in deterministic source-ID order in a full pass, so a failing or
backlogged source cannot starve another source within the registered bound.
Each source bootstraps quietly, advances only after transactional ingestion,
preserves its watermark on failure, and remains destination-separated from
the scheduler rows it creates. Disabled sources retain state and re-enable from
their cursor; changed immutable identity conflicts rather than inheriting
another cursor.

The observer exposes bounded safe source state and typed scheduler origin for
all four classes. The fixed Git subprocess is read-only, fixed-argv, and
non-shell. There is no model/runtime/worker dispatch, provider network client,
webhook, listener, watcher, daemon, CI log/artifact/YAML reader, or second
event store. Evidence:
`operations/reports/agent-mode-k4-1-c2-event-source-closure-evidence-2026-09-10.md`.

K4.2 is conditionally ready for policy-only work. The frozen scheduler-event
input is the bounded envelope `eventId`, `eventType`, `source`, `occurredAt`,
`receivedAt`, nullable `causationId`, nullable `correlationId`, bounded
`deduplicationKey`, `payloadVersion`, bounded typed `payload`, deadline and
not-before, plus delivery attempt/status identity. K4.2 must not need provider
credentials, raw provider data, Git access, or mutable source internals. It
must require explicit root-goal binding where applicable, check durable task /
run cancellation before admission, and add the global/root admission-deny
seam before any worker creation. No root goal is inferred from source events.

## K4.2-A deterministic spawn admission

K4.2-A is complete for its policy-only boundary. Use
`projects/brain-core/src/agent-mode/spawn-policy.ts` as the pure evaluator
boundary. Callers must first normalize a durable K4.1 scheduler event into the
bounded `SpawnRequest`; the evaluator does not inspect provider adapters,
payload internals, Git, prompts, commands, credentials, or model responses.
Unknown policy/template versions, unknown capabilities, unsafe scopes,
missing root binding, cross-root parents, cancellation, expired deadlines,
ceiling violations, and unavailable authority facts return `DENY` with a stable
reason code. The deterministic `spawnIntentKey` excludes request identity so a
retry of the same logical request remains the same intent while a scope or
lineage change conflicts.

Global and root admission-deny controls are durable rows in the existing
StateStore (`setSpawnAdmissionControl` / `getSpawnAdmissionControls`) and
survive reopen. A control read failure is `AUTHORITY_UNAVAILABLE`; there is no
allow fallback. Observer output exposes at most 32 persisted control rows and
does not invent recent decisions. Concurrency and total-creation checks read
authoritative facts but are deliberately non-atomic; K4.2-B owns slot
reservation and aggregate enforcement.

K4.2-A creates no child Agent records, workers, runtime processes, model calls,
reservations, or live scheduler-to-spawn wiring. K4.2-B and K4.2-C are now
complete. K4 remains in progress. Exact next task: **K4.2-D — Bounded
AgentRuntime Dispatch, Cancellation Propagation and Child Settlement**. Do not
start it automatically.

## K4.2-B durable child identity and atomic reservation

K4.2-B is complete. `reserveSpawnAndCreateChild` is the only creation
operation for this gate and runs under the existing StateStore `BEGIN
IMMEDIATE` transaction. It rechecks the current durable controls, root and
parent lineage/cancellation, policy/template versions, deadline, active and
total limits, and root aggregate reservations rather than trusting an earlier
ALLOW decision. The guarded root aggregate update, child Agent row, bounded
`child_agent_created` event, and durable spawn receipt commit or roll back as
one unit.

Child rows carry controller-owned deterministic identity, exact root and
parent/task/run references, role/policy versions, source event, depth,
repository/resource scope, capability hash/set, requested/reserved step and
cost ceilings, creation time, expiry, and truthful reserved/retired/cancelled/
expired status. `retireChildAgent` is idempotent and releases active slot and
unused allocation without decrementing total creation count.

The `agent_mode_spawn_roots` row is the authoritative root aggregate source;
total creation count is monotonic and includes retired/cancelled/expired
children. `agent_mode_spawn_receipts` makes a durable `spawnIntentKey` retry
return the original receipt and child while conflicting immutable material
fails closed. `reconcileExpiredChildAgents` is bounded to 64 rows per pass and
uses the same transaction, so expiry races cannot double-release a slot.
Observer output exposes bounded safe child/root aggregate state only. This
gate creates no child task/run/attempt, runtime, model call, worker process,
live scheduler wiring, Workcell, Git write, or network path. Evidence:
`operations/reports/agent-mode-k4-2-b-child-agent-reservation-evidence-2026-09-10.md`.

K4.2-C is recorded below. K4.2 remains in progress. Exact next task:
**K4.2-D — Bounded AgentRuntime Dispatch, Cancellation Propagation and Child
Settlement**. Do not start it automatically.

## K4.2-C runtime binding and durable child assignment

K4.2-C is complete for the durable assignment boundary. The typed
`assignChildAgent` request uses a deterministic intent key derived from
immutable logical material, and the existing SQLite StateStore is the sole
authority. One `BEGIN IMMEDIATE` transaction rechecks the reserved child,
root and parent lineage, cancellation, global/root kill switches,
expiry/deadline, policy/template versions, capability and scope ceilings,
allocation, and finite runtime-profile admission.

The transaction creates exactly one canonical child Task, Run, and Attempt,
links them to the child and intent, creates a child budget suballocation in
the existing ledger, moves the child to `assigned`, persists one bounded
assignment receipt, and appends one bounded event. The root aggregate is not
reserved a second time. Task/Run/Attempt stay pre-dispatch
(`admitted`/`created`/`admitted`); route and model are deferred identities, not
runtime or model selection. No AgentRuntime, ModelGateway, worker process,
scheduler wiring, Workcell, Git, network, or UI path is invoked.

Retries, reopen, unique constraints, and the transaction make duplicate and
competing assignments converge safely; conflicting immutable material fails
closed. Assigned-child retirement/expiry invalidates prepared data and
cancels canonical entities atomically. Observer output exposes only bounded
safe linkage and runtime/profile identifiers. `getPreparedChildDispatch` is a
non-executable projection; K4.2-D must freshly recheck authority and perform
dispatch/cancellation/settlement.

Evidence:
`operations/reports/agent-mode-k4-2-c-runtime-binding-assignment-evidence-2026-09-10.md`.
Focused K4.2-C validation is 58/58; the expanded regression set is 268/268.
K4.2 remains in progress. Exact next task: **K4.2-D — Bounded AgentRuntime
Dispatch, Cancellation Propagation and Child Settlement**. Do not start it
automatically.

## K4.2-D1 — Mock-backed bounded runtime dispatch

K4.2-D1 is complete for the in-process MockAgentRuntime gate. Dispatch uses
the existing StateStore authority boundary and existing `effects`,
`dispatch_outbox`, `receipts`, `leases`, budget, cancellation, and lifecycle
records. At execution time, recheck child/assignment/task/run/attempt/root
identity, runtime/profile and role/policy bindings, scopes, allocations,
deadlines, cancellation, kill switches, and budgets before taking the fenced
`runtime-dispatch:<attempt>` lease.

Persist the dispatch intent before invoking the runtime. Advance only through
`dispatchable`, `dispatched`, `receipt_recorded`, `verified`, and `settled`, or
truthful failed/cancelled/uncertain states. Verify the bounded runtime receipt
before settlement. Duplicate dispatch must not invoke twice; stale fences must
not dispatch or settle; uncertain outcomes must not be blindly replayed.
Cancellation observes both `AbortSignal` and durable cancellation state, and
terminal cancellation requires runtime acknowledgement. Success/failure/
cancellation release budget, root allocation, active slot, child state, and
lease exactly once. Observer output exposes bounded state only and excludes
prompts, hidden reasoning, provider payloads, credentials, and secrets.

This tranche launches no restricted Harness, OS process, model/provider,
BrainNode, Workcell, scheduler worker, network request, or replacement worker.
Evidence:
`operations/reports/agent-mode-k4-2-d1-mock-runtime-dispatch-evidence-2026-09-10.md`.
Exact next task: **K4.2-D2 — Restricted Harness Process Dispatch, Runtime
Cancellation and Reconciliation**. Do not start it automatically.

## K4.2-D2 — Restricted Harness process dispatch

K4.2-D2 is complete for the process-boundary gate. Use
`RestrictedHarnessAgentRuntime` behind the existing D1
`AgentModeRuntimeDispatcher`; do not call the Harness SDK as a second
control plane and do not wire scheduler-created workers here.

The only admitted runtime is the configured DeepSeek Harness root pinned to
version `0.1.3-alpha.2`, commit
`c389f96bf3a9b6807cb71ed6bdad5849be0df6d8`, and profile
`brain-agent-mode-restricted`. The runtime validates the injected root and
manifests, constructs a fixed `sdk-minimal` SDK launch, disables the denied
service rows, injects only the Brain fixture LLM adapter, and supplies an
explicit complete child environment. Never inherit `process.env`, accept
executable/argv values from task or model data, or expose the Agent Mode
SQLite path to the child.

SDK initialization is the finite readiness handshake. Before the admitted
attempt is sent, verify the pinned version, allowlisted topology, separate
child boundary, explicit environment policy, and normalized PID/start-time/
command identity. Persist the run process identity while live; the SDK owns
EOF → graceful termination → forced termination and returns only after the
exact child exits. Use the runtime's AbortSignal to trigger this bounded
shutdown. Cancellation is acknowledged only after the child is reaped.

The D2 fixture uses one local Unix-domain socket bridge. Its response is
bounded and deterministic, with zero model/provider calls and zero executable
tools. Parent sentinel variables are probed as presence booleans only; never
log sentinel values. Child stdout/stderr and fixture evidence are bounded.
Known startup failures are safe pre-effect failures. A crash after attempt
delivery is `uncertain`; an uncertain dispatch is never relaunched blindly.
Reconciliation resolves only identity-bound parent-owned evidence and remains
uncertain when process disappearance is the only fact.

Observer output includes only bounded runtime/profile, process state, PID/start
time, identity verification, dispatch phase, exit classification, cancellation
and reconciliation fields. It excludes raw environment, full argv, prompts,
hidden reasoning, provider payloads, credentials, and unbounded diagnostics.

Evidence:
`operations/reports/agent-mode-k4-2-d2-restricted-harness-dispatch-evidence-2026-09-11.md`.
Focused D2 validation is 12/12. K4.2-E1 is recorded below.

## K4.2-E1 — Deterministic scheduler-to-worker orchestration

K4.2-E1 is complete for the bounded scheduler-to-worker gate. Use the closed
`SchedulerEventActionRule` registry to express event-to-action intent. Keep it
separate from `AgentSpawnPolicy`: a policy/role allowlist is permission, not an
instruction to spawn. The default action registry is disabled; unknown,
disabled, malformed, or payload-selected action data must remain bounded
`NO_ACTION`/denial.

The orchestrator must claim through the existing scheduler event lease/fence,
read source type from durable source configuration, require an authoritative
root binding, and derive all lifecycle identities from immutable event and
static-rule fields. It then calls the existing K4.2-A `evaluateSpawnAdmission`,
K4.2-B `reserveSpawnAndCreateChild`, K4.2-C `assignChildAgent`, and K4.2-D1
`AgentModeRuntimeDispatcher` boundaries in that order. Do not insert canonical
child/task/run/attempt rows, reserve budgets, or launch runtimes directly from
the orchestrator. The bounded pass sorts by eligible time and event ID and
limits the number of events it advances.

The accepted E1 fixture is read-only and invokes only `MockAgentRuntime`.
Harness, ModelGateway, BrainNode, Workcell, OS process, network, and recursive
spawn paths remain absent. Redelivery and concurrent claims must converge on
one lifecycle and one runtime invocation. Temporary denials fail the scheduler
event for bounded retry; terminal quota/deadline denials complete without a
replacement worker. D1 uncertain outcomes must never be blindly relaunched.
Cancellation, kill switch, deadline, crash recovery, root concurrency/total
creation/budget, and quiet no-op behavior are all covered by the E1 evidence.

Evidence:
`operations/reports/agent-mode-k4-2-e1-scheduler-dynamic-worker-evidence-2026-09-11.md`.
Focused E1 validation is 23/23; Agent Mode regression is 339/339; package-wide
`brain-core` validation was 2467/2467 at that gate. K4.2-E2 is recorded below.

## K4.2-E2 — Restricted-Harness Scheduler-to-Worker acceptance and closure

K4.2-E2 is **COMPLETE**. The existing E1 orchestrator composes the same D1
`AgentModeRuntimeDispatcher` with the actual D2 `RestrictedHarnessAgentRuntime`
through one disabled-by-default static E2 rule. Action intent remains
distinct from `AgentSpawnPolicy`; the rule is read-only, root-bound, finite,
restricted-Harness-only, and requests zero executable capabilities. The E1
rule is unchanged.

The deterministic positive path creates one child and one Task/Run/Attempt,
one D1 runtime-dispatch outbox, launches one pinned Harness child, and reaps
that exact child once. The pinned version is `0.1.3-alpha.2` at commit
`c389f96bf3a9b6807cb71ed6bdad5849be0df6d8`, profile
`brain-agent-mode-restricted`. No ModelGateway/Bedrock/live model,
BrainNode, Workcell, repository write, external network, or replacement worker
is involved.

The E2 evidence covers redelivery, concurrent claims, crash/restart phases,
uncertainty and durable/no-evidence reconciliation, cancellation/reaping,
kill-switch and deadline/TTL gates, root limits, recursive-spawn prevention,
malicious metadata, bounded/no-op passes, and observer causation/resource
reconstruction. All 23 K4.2 closure conditions pass. Evidence:
`operations/reports/agent-mode-k4-2-e2-harness-dynamic-worker-closure-evidence-2026-09-11.md`.
Focused E2 validation is 16/16; Agent Mode regression is 355/355; package-wide
`brain-core` validation is 2483/2483. **K4.2 is COMPLETE; K4 remains IN
PROGRESS.** Exact next task: **K4.3-A — One Bounded Live MiniMax
Dynamic-Worker Acceptance**. Do not start it automatically.

## K4.3-A live MiniMax acceptance — 2026-09-12

K4.3-A is **COMPLETE** for its bounded live gate. R3 used one fresh authorized
MiniMax M2.5 call through the scheduler-created restricted Harness and
Brain-owned ModelGateway path. The canonical live output allowance is `1024`
tokens; D2 fixture runs retain their separate `64`-token bound. The exact
response passed, one provider receipt was durably verified, and usage/cost
settled once at `61 / 119 / 180` tokens and `$0.000161`.

Counts were one child, Task, Run, Attempt, Harness launch/reap, ModelGateway
call, provider call, and model turn; zero tools, BrainNode, Workcell,
repository, replacement-worker, grandchild, fallback, and escalation effects.
StateStore restart reconstruction and quiet scheduler redelivery passed with
zero additional effects. Evidence:
`operations/reports/agent-mode-k4-3-a-r3-live-minimax-acceptance-evidence-2026-09-12.md`.

K4 remains **IN PROGRESS**. Exact next task: **K4.3-B — K4 Live Autonomy
Closure Audit and Phase Exit Gate**. Do not start it automatically.

## K4.3-B K4 live autonomy closure — 2026-09-12

K4.3-B and K4 are **COMPLETE** for the bounded phase-exit gate. The closure
audit passed all 30 invariants across event authority, action/spawn separation,
root and aggregate budget authority, deterministic assignment, fenced D1/D2
dispatch, restricted Harness security, cancellation, kill switches, deadlines,
TTL, recursive-spawn prevention, provider ownership, effect journaling,
uncertainty no-replay, accounting, redelivery, restart reconstruction,
observability, quiet heartbeat, default-off autonomy, and portability.

The canonical live proof remains K4.3-A R3: one fresh MiniMax M2.5 call through
the scheduler-created restricted Harness and Brain-owned ModelGateway; one
child/Task/Run/Attempt; one Harness launch/reap; exact response acceptance;
durable verified provider receipt; and one settled `$0.000161` cost. Redelivery
and StateStore restart introduced no duplicate effects. No live call is allowed
or required for this closure surface.

Closure evidence:
`operations/reports/agent-mode-k4-3-b-k4-live-autonomy-closure-evidence-2026-09-12.md`.
Production-wide live autonomy remains disabled by default. The exact next
roadmap milestone is **Phase K5 — multi-agent organization**; do not start it
automatically.

## K5-A durable organization contracts — 2026-09-13

K5-A — **Durable Multi-Agent Organization Contracts and Delegation DAG
Foundation** — is **COMPLETE** for the offline contract/persistence gate;
K5 remains **IN PROGRESS**.

K5 organization sits above K4 and does not create a second control plane. The
closed Brain-owned organization-role registry contains only Jarvis / CEO,
Engineering, Research, Operations, Memory / Archivist, and Independent
Auditor. These are organizational identities, not AgentRoleTemplates,
AgentRuntimes, models, providers, capabilities, credentials, shells, or
repository permissions.

An `OrganizationPlan` binds one existing root goal to one existing root-bound
Jarvis supervisor. It contains bounded delegated work items and only
`requires_success` dependency edges. Plan and work-item IDs are deterministic;
the plan version is explicit; active graph mutation is not supported. Creation
persists the plan, work items, and edges in one existing SQLite StateStore
transaction. Same canonical material is idempotent, while conflicting material
for the same identity fails closed. K5-A does not reserve budget, create child
agents, create Task/Run/Attempt state, assign runtime/model/capability
authority, or dispatch anything.

Readiness is pure/deterministic over the immutable graph and supplied
authoritative terminal result facts. Indegree-zero items are ready, successful
predecessors unlock dependents, failed/cancelled predecessors produce terminal
dependency failure, and cancelled/killed roots or expired plans block the graph.
The observer exposes only bounded plan/work-item ownership, counts, readiness,
roles, and nullable future child/task IDs. No prompt, hidden reasoning, raw
provider response, credential, or free-form agent-to-agent conversation is
stored or exposed.

Evidence: `operations/reports/agent-mode-k5-a-organization-contracts-evidence-2026-09-13.md`.
K5-B completion is recorded below; it routes ready items through the existing
K4 SpawnRequest / SpawnPolicy / reservation / assignment / runtime contracts.

## K5-B deterministic supervisor delegation — 2026-09-13

K5-B is **COMPLETE** for the bounded mock-worker gate; K5 remains **IN
PROGRESS**. `AgentModeOrganizationDelegationOrchestrator` is an explicit,
finite advancement seam. It reads the immutable K5-A plan and readiness,
applies a closed Brain-owned delegation rule, and routes each ready item through
K4 SpawnPolicy → atomic child reservation → assignment → D1 runtime dispatch.
It never inserts an Agent/Task/Run/Attempt, reserves budget directly, invokes a
runtime directly, or creates a second result ledger.

The organization role registry remains identity-only. Delegation rules map the
Research, Engineering, and Independent Auditor fixture roles separately to the
K4 read-only role/policy and `MockAgentRuntime`; Jarvis, Operations, and Memory /
Archivist rules are closed/disabled. The internal source/event pair is
`brain.organization.delegation` / `organization.work-item.ready` and is not an
external event adapter. Delegation identity is deterministic over plan, work
item, rule, and version; K4 spawn, assignment, and dispatch identities remain
stable on restart and redelivery.

After K4 assignment creates the authoritative Task/Run/Attempt, one atomic
StateStore binding records `work item → child Agent/task`. Repeating the binding
is idempotent and conflicting rebinds fail closed. Results are derived from the
existing K4 runtime receipt/effect and settled reservation, exposing only
bounded result/evidence references and cost. The DAG is recomputed after each
bounded pass, so Auditor waits for both predecessor successes; failures,
cancellation, kill-switch, deadlines, concurrency, budgets, and uncertain
runtime state remain K4/K5 readiness gates. The observer exposes bounded plan,
work-item, lifecycle, result/evidence, cost, and organization totals only.

The deterministic fixture creates three worker lifecycles and invokes
`MockAgentRuntime` three times. Harness, ModelGateway, providers, network,
BrainNode, Workcells, tools, and repository effects remain zero. Agents
communicate through durable tasks, events, results, evidence, review requests,
and escalations; K5-B adds no peer chat or supervisor LLM loop.

Evidence: `operations/reports/agent-mode-k5-b-supervisor-delegation-mock-workers-evidence-2026-09-13.md`.
Exact next bounded slice: **K5-C — Structured Supervisor Aggregation, Auditor
Gate, and Organization Final Result**. Do not start K5-C automatically.

## K5-C organization aggregation and finalization — 2026-09-13

K5-C is **COMPLETE** and K5 is **COMPLETE** for the bounded phase-exit gate.
`AgentModeOrganizationFinalizer` is a finite deterministic controller seam;
there is no Jarvis LLM loop, background daemon, or free-form organization
conversation.

The finalizer reads the immutable K5-A graph and K5-B bindings, then derives a
bounded `OrganizationAggregation` from authoritative K4 child Agent,
Task/Run/Attempt, runtime receipt/evidence, and settled reservation facts. It
does not copy raw result bodies, prompts, hidden reasoning, provider payloads,
or runtime logs, and it does not create a Task/Run/Attempt/result/cost ledger.
Work-item references are lexical/canonical, evidence is bounded globally, and
settled cost is summed from K4 facts rather than requested envelopes.

Successful finalization requires exactly one structurally downstream
`agent-mode.org-role.independent-auditor.v1` work item plus successful,
contract-valid authoritative facts for every required work item. Failed or
cancelled predecessors, dependency failure, contract violations, root
cancellation, plan expiry, and auditor absence/ambiguity cannot become success;
known terminal failure may be recorded as a failed organization receipt.
Uncertain K4 state returns an explicit uncertain outcome and is never replayed.

The final-result ID and aggregate digest are deterministic. One StateStore
transaction persists the immutable organization receipt and the plan lifecycle
transition. Same-material retries return the existing receipt; conflicting
material fails closed. Close/reopen and observer reads reconstruct bounded
ownership, dependencies, result/evidence references, auditor gate, aggregate
cost, final status, and finalization metadata.

For the K5-B fixture the finalization gate adds no workers: Research,
Engineering, and Independent Auditor remain three child Agents, Tasks, Runs,
Attempts, and MockAgentRuntime calls. Harness, ModelGateway, live providers,
network, BrainNode, Workcells, tools, and repository effects remain zero.

Evidence: `operations/reports/agent-mode-k5-c-organization-final-result-evidence-2026-09-13.md`.
The exact next roadmap phase is **Phase U0 — unified Brain Console control
surface**. Do not start U0 automatically.

## U0-A canonical Agent Mode Console projection — 2026-09-13

U0-A is **COMPLETE** and U0 remains **IN PROGRESS**. The canonical read-only
Brain Console Agent Mode surface is `/agents`, backed by the single Brain Core
endpoint `GET /agent-mode/console` and schema version
`agent-mode-console-v1`.

Brain Core derives this bounded response from `readAgentModeObserver()` and
the existing durable Agent Mode StateStore. It does not read the legacy
`~/.local/video-orchestrator/state/agent-console.json` snapshot for Agent Mode,
create a Console database, expose a second lifecycle/result ledger, or perform
provider/runtime probes. All visible collections have explicit caps (100
agents/tasks/runs/attempts/runtimes/budgets/model/node resources, 50
organizations/schedules/approvals/failures, and 100 evidence refs). Ordering is
active before terminal, then latest durable update, then stable ID.

The response includes explicit `fresh`, `empty`, or `unavailable` freshness;
durable Agent Mode/K5 organization/final-result state; K4 lifecycle and
runtime/model facts; root budget reservations and safely derived settlement;
schedules; pending Agent Mode review approvals; bounded evidence metadata; and
stable failure/uncertainty reason codes. Secrets, prompts, hidden reasoning,
provider payloads, credentials, environment values, and unbounded logs are not
projected.

Brain Console consumes the response through the existing `brainCoreRequest()`
client, strict Zod validation, and a seven-second TanStack Query refresh. The
`/agents` page is read-only with Overview, Agents, Organizations, Tasks, and
Failures tabs. Loading, fresh, stale, offline/error, and empty states remain
distinct. No pause/resume/cancel/kill/approve/retry/spawn or other mutation
control is exposed in U0-A.

Current coverage intentionally leaves Jarvis intake, durable notifications,
deep evidence/budget/schedule/failure drill-down, richer node/worktree/quota
inventory, and lifecycle controls to later U0 slices. Legacy `/agent-console`
remains available for compatibility and is not redefined.

Evidence: `operations/reports/agent-mode-u0-a-console-projection-evidence-2026-09-13.md`.
Exact next bounded slice: **U0-B — Agent Detail, Evidence, Budget, Schedule,
and Failure Drill-Down**. Do not start U0-B automatically.

## U0-B read-only Agent Mode detail drill-down — 2026-09-13

U0-B is **COMPLETE** and U0 remains **IN PROGRESS**. The canonical detail
endpoint is:

```text
GET /agent-mode/console/detail/:kind/:id
```

It returns `agent-mode-console-detail-v1` for the closed kinds `agent`, `task`,
`run`, `attempt`, `organization`, `budget`, `schedule`, `failure`, and
`evidence`. Responses are request-time projections from the existing observer
and StateStore, with explicit available/not-found/unavailable freshness and
bounded collections. Organization dependencies, K4 lifecycle links, budgets,
schedules, failure reasons, and evidence ownership metadata are visible.

Evidence remains metadata-only. Never add prompts, hidden reasoning, provider
payloads, credentials, environment values, or unbounded logs to this surface.
The route and `/agents` detail panel are read-only and must not perform provider
probes or mutate Agent, Task, Run, Attempt, budget, scheduler, runtime, or
organization state. Existing `/agent-mode/console`, `/agent-mode/observer`, and
legacy `/agent-console` compatibility remain unchanged.

Exact next bounded slice: **U0-C — Guarded Agent Lifecycle Controls and
Approval Actions**. Do not start U0-C automatically.

## U0-C1 Brain-owned lifecycle control service — 2026-09-14

U0-C1 is **COMPLETE** for the shared Brain-owned control-service foundation;
U0-C remains **IN PROGRESS**. The canonical domain seam is
`AgentModeControlService` in Brain Core. It accepts bounded versioned commands
for `pauseRun`, `resumeRun`, `cancelRun`, `killRun`, and `decideReview`.

The service composes the existing StateStore lifecycle operations and
`recordReviewDecision`. It records bounded control receipts in the existing
append-only Agent Mode `events` stream, keyed by operation material. Repeating
the same operation is idempotent; conflicting reuse fails closed. Resume and
kill require fresh verification of the exact durable runtime identity. Kill
does not accept a caller PID and records signal state before attempting the
external process signal, so uncertain or failed signaling is not blindly
redelivered. Existing K4 lifecycle, cancellation, approval, and receipt
authority remains in force.

The CLI `brain-agent pause|resume|cancel|kill RUN_ID` now uses this service and
retains the established output/recovery contract. The CLI may supply explicit
`--operation-id` and `--reason` values. Review decisions retain the existing
worker/model self-approval prohibition and durable review receipts/events.

BS0.1 still contains network mutations before request-body read. Because no
usable authenticated HTTP service identity is implemented (BS0.5 is currently
descriptive contract-registry material only), no functional HTTP control route
or Console mutation button is enabled. `/agent-mode/control/run/:runId` and
`/agent-mode/control/review/:reviewId` are reserved and fail closed with
`mutable_capability_contained`; localhost, Origin, and caller-supplied headers
are not authorization. There are no provider probes, runtime dispatches,
budget mutations, or browser-side authority changes from this slice.

Evidence: `operations/reports/agent-mode-u0-c1-guarded-controls-evidence-2026-09-14.md`.
Exact next bounded prerequisite: implement/reconcile the authoritative BS0.5
authenticated service identity, then add the authenticated HTTP/Console control
gate. Do not expose unauthenticated lifecycle or approval actions.
