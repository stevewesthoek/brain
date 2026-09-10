# Agent Mode K2.2 operator controls evidence — 2026-09-09

## Status

K2.2 is complete for the bounded one-Jarvis/one-worker, one read-only
capability vertical slice. The full K2 gate is complete. The exact next task
is N0 — generic Brain Node; N0 was not started here.

No new live model call was made in K2.2. The existing, separately authorized
K2.1-R1 MiniMax acceptance remains the live evidence and is not rewritten:
`operations/reports/agent-mode-k2-1-r1-auto-and-live-unblock-2026-09-09.md`.

## Selector and runtime flows

Normal `repos` and `sessions` first open the exact five-entry selector below;
Auto is first and fzf preselects it. Enter accepts Auto before the repository
or session list is shown.

```text
Auto
MiniMax M2.5
GLM-5
Opus 4.6
Codex
```

`--model auto|minimax-m2.5|glm-5|opus-4.6|codex` is the non-interactive
selector. `--choose-model` remains an alias. The normal menu contains no
Claude Code, DeepSeek, local, or provider-specific text. Auto routes to
`brain-agent run`; explicit Brain entries remain policy-gated overrides;
Codex remains a separate native runtime.

`sessions` lists only durable Brain attempts from `/agent-console`. Brain rows
show the selected view, actual model, runtime, status, attempt ID, and run ID.
Selecting a Brain row opens `inspect`, `pause`, `resume`, `cancel`, or `kill`.

## Durable controls and recovery

- `inspect` is read-only and works against the existing K2.1-R1 database schema.
- `pause` transitions run/task/attempt state to `paused`; dispatch is rejected
  until resume.
- `resume` requires a verified owned runtime identity. If the controller is
  gone, the CLI reports `re-admission_required` and does not revive the run.
- `cancel` records a durable request. The active controller acknowledges only
  after it stops future dispatch and reconciles termination. If no owned
  controller remains, the operator path records that fact before terminal
  cancellation.
- `kill` is the explicit force path and uses durable `runId` plus PID,
  process-start time, command, and a derived identity token. PID-only signals
  and stale identities fail closed.

Controller loss clears the old runtime identity and lease binding, preserving
the Task/Run/Attempt lineage. Recovery classifies the last durable effect
boundary; safe work can be re-admitted only with fresh access evidence, an
available budget reservation, a new lease ID/fence, and a newly owned runtime.
Receipt-pending or possibly externally applied effects are never replayed
automatically.

The deterministic ten-fixture matrix covers: no effect; model outbox before
invocation; persisted model result; tool before dispatch; tool after known
receipt; possible external effect without receipt; paused run; cancellation
requested; unexpected runtime-child exit; and stale runtime metadata with no
owned process. Re-admission denial fixtures cover stale/live lease, uncertain
effect, cancellation, exhausted reservation, and missing access evidence.

## Portability and evidence boundaries

The implementation has no `/Users/Office` or fixed host path in the runtime
control code. Provider account, harness root, route evidence, and model access
evidence are explicit inputs/environment values. Fixture account/evidence and
fixture process identity are available only when `fixtureMode` is explicitly
enabled. Production execution fails closed when these values are absent.

## Validation

- Brain Core typecheck: PASS.
- Focused Agent Mode policy, gateway, live fixture, controls, and recovery
  suite: 62 tests, 62 passed, 0 failed.
- Full Brain Core suite: 2,040 tests, 2,034 passed, 6 failed in unrelated
  existing OrchestrationExecutor/VO metadata tests; none are in the K2.2
  control, recovery, selector, policy, gateway, or live-fixture scope.
- Runtime selector shell gate: PASS.
- `git diff --check`: PASS.
- Existing K2.1-R1 live database inspect/reopen compatibility: PASS; completed
  MiniMax run remains `READ_ONLY_LIVE_SLICE_PASS` with one verified read,
  699 total tokens, and `$0.000334` settled cost.

## K2 gate decision

PASS. K2 is marked complete for its explicitly bounded scope. N0 is the next
task and is intentionally not started by this tranche.
