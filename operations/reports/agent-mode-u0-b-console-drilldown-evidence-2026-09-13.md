# Agent Mode U0-B Console Drill-Down Evidence — 2026-09-13

## Status

**U0-B — Agent Detail, Evidence, Budget, Schedule, and Failure Drill-Down:
COMPLETE.** U0 remains **IN PROGRESS**.

This slice adds a bounded, read-only detail projection and disclosure panel over
the existing Agent Mode observer. It adds no lifecycle controls, autonomous
behavior, live model calls, provider probes, or browser authority.

## Starting reconciliation

- Starting HEAD: `a69c07da feat(agent-mode): add console operations projection`.
- K4, K5-A, K5-B, K5-C, and K5 were already complete.
- U0-A was already complete and its canonical endpoint remained
  `GET /agent-mode/console`.
- K4 remains authoritative for Agent/Task/Run/Attempt, runtime, budget,
  settlement, and evidence facts; K5 remains authoritative for organization
  ownership and final-result references.
- No newer U0-B implementation was present before this slice.
- The protected Firecrawl log and unrelated roadmap paths were preserved and
  never staged.

## Detail contract and API

Brain Core now exposes exactly one read-only detail route:

```text
GET /agent-mode/console/detail/:kind/:id
```

The response is versioned as `agent-mode-console-detail-v1`, strongly typed,
and has explicit `available`, `not_found`, and `unavailable` statuses. The
closed detail kinds are `agent`, `task`, `run`, `attempt`, `organization`,
`budget`, `schedule`, `failure`, and `evidence`.

All detail data is derived at request time from `readAgentModeObserver()` and
the durable Agent Mode StateStore. No Console database or parallel observer was
introduced. The detail bounds are 50 children/tasks/runs/attempts, 16
organization work items, 32 dependencies, 64 evidence references, 100 budget
allocations, 50 scheduler history entries, and 50 related failure events.
Organization work items are returned in lexical work-item order; bounded
related collections use stable ID or newest-durable metadata ordering.

Freshness identifies the StateStore source and presence. An unavailable store
is explicit and never converted into healthy empty data. Missing IDs are
explicit `not_found` responses. Invalid detail kinds/path encoding are rejected
before reading detail state.

## Domain coverage and safety

The detail projection reconstructs Agent hierarchy and K4 Task → Run → Attempt
relationships, runtime/profile/model/provider facts only when durably recorded,
uncertainty and cancellation state, organization work-item dependencies and
final-result metadata, root/attempt budget facts, scheduler metadata/history,
stable failure reason codes, and evidence ownership metadata.

Evidence is metadata-only: bounded IDs/refs, receipt type, verification state,
owner IDs, timestamps, digest, and related operation/result references. It does
not expose prompt content, hidden reasoning, raw provider payloads, credentials,
environment values, or unbounded runtime logs. No Task/Run/Attempt, runtime,
provider, cost, or evidence ledger was duplicated.

The endpoint performs no AWS, Bedrock, MiniMax, GLM, Opus, Codex, SSH,
BrainNode, Harness, Workcell, scheduler, budget, Agent, Task, or runtime
mutation. Repeated reads are side-effect free.

## Brain Console interaction

The existing `/agents` page now makes stable IDs clickable and opens an inline
read-only detail panel. Cross-links cover Agent, Task, Run, Attempt,
Organization, Budget, Evidence, Schedule, and Failure where the durable
projection provides the relationship. Escape and the close control dismiss the
panel. Selection is ephemeral React view state only; it is not persisted and is
not authority.

The panel uses the existing `brainCoreRequest()` client, strict Zod validation,
TanStack Query, and a seven-second refresh. It distinguishes loading, fresh,
stale-with-cached-data, offline/error, not-found, unavailable, and empty
states. There are no pause/resume/cancel/kill/approve/reject/retry/spawn/rerun
or other mutation controls.

## Restart, multi-client, and visual evidence

A real StateStore close/reopen test reconstructs the persisted K5 plan,
supervisor ownership, three work items, lexical ordering, and auditor
dependencies. Repeated request-time reads are equivalent for the same injected
timestamp. Independent callers use the same durable observer source and have no
client-specific authority fields.

Desktop visual inspection of `http://localhost:4881/agents` confirmed the
sidebar, Agents navigation, summary layout, and explicit Brain Core unavailable
state remain usable without overlap. The currently running Core process
predated this route, so the visual smoke showed the intentionally unavailable
state rather than a fabricated populated detail view. A narrow viewport could
not be exercised because the available browser wrapper did not expose a
viewport override; responsive detail CSS and production builds were validated.

## Validation

- U0-B Brain Core detail tests: **5/5 passed**.
- U0-A projection and observer tests: **8/8 passed** in the focused run.
- K5-A organization tests: **10/10 passed**.
- K5-B delegation tests: **9/9 passed**.
- K5-C finalization tests: **8/8 passed**.
- K4-focused regression group: **239/239 passed**.
- Combined selected Brain Core suite including route coverage: **441/441
  passed**.
- Brain Core typecheck: passed.
- Brain Core build: passed.
- Brain Console detail/schema tests: **5/5 passed**.
- Brain Console typecheck: passed.
- Brain Console build: passed; only the existing autoprefixer flex-end warning
  was emitted.
- `git diff --check`: passed.
- Full Brain Core suite: not run.

## U0 gap audit and next slice

U0-A and U0-B now provide the canonical projection and read-only drill-down.
Jarvis intake, durable notifications, richer node/worktree/Codex-quota
inventory, and guarded lifecycle/approval mutations remain unsurfaced or
read-only. The exact next bounded slice is:

**U0-C — Guarded Agent Lifecycle Controls and Approval Actions.**

U0 remains in progress; this slice does not start U0-C.
