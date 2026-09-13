# Agent Mode U0-A Console Projection Evidence — 2026-09-13

## Status

**U0-A — Canonical Agent Mode Console Projection and Read-Only Brain Console
Operations Surface: COMPLETE.** U0 remains **IN PROGRESS**.

The implementation is a read-only projection of durable Brain state. It adds no
autonomous behavior, live model calls, provider probes, lifecycle mutations, or
browser authority.

## Starting reconciliation

- Starting HEAD: `68506cd0 feat(agent-mode): finalize organization results`.
- K4, K5-A, K5-B, K5-C, and K5 were verified complete in the roadmap and
  existing evidence.
- K5 three-worker organization/final-result state remains present in the
  existing Agent Mode observer and StateStore.
- K4 remains authoritative for Agent/Task/Run/Attempt, runtime, budget, and
  evidence facts.
- Existing `/agent-mode/observer` was reused; no parallel observer or Console
  database was created.
- Legacy `/agent-console` remains unchanged for compatibility and is not the
  canonical Agent Mode source.
- No newer U0-A implementation was present before this slice.
- Pre-existing worktree entries were preserved and never staged:
  `tools/firecrawl/logs/firecrawl.log`,
  `operations/specs/mindcontrol-product-roadmap.md`, and
  `operations/specs/nevermind-release-pipeline-roadmap.md`.

## Canonical projection

`agent-mode-console-projection.ts` defines the explicit
`AgentModeConsoleProjection` contract and `agent-mode-console-v1` schema. The
projection is generated at request time by mapping the existing
`AgentModeObserverProjection`; it does not read SQLite from the browser or
duplicate domain reconstruction in the UI.

The projection contains:

- summary counts for roots, agents, running tasks/attempts, blocked/failed/
  uncertain state, pending approvals, active schedules, and reserved/settled
  cost;
- bounded Agent, Task, Run, Attempt, Runtime, Budget, Schedule, Approval,
  Evidence, Failure, Model Resource, and Node Resource projections;
- bounded K5 organization plans, work-item readiness/delegation state, final
  result ID/status, auditor status, and aggregate cost.

Collections are capped at 100 agents, 50 organizations, 100 tasks, 100 runs,
100 attempts, 100 runtimes, 100 budgets, 50 schedules, 50 approvals, 50
failures, 100 evidence refs, 100 model resources, and 100 node resources.
Visible rows use active-before-terminal, newest durable update, and stable ID
ordering. `freshness` reports `fresh`, `empty`, or `unavailable`, alongside
StateStore presence/source status and an explanatory bounded message.

The response contains only stable IDs, status/reason metadata, timestamps,
bounded budgets, and safe runtime/model/provider facts that already exist in
durable state. It excludes prompts, hidden reasoning, provider payloads,
credentials, environment values, filesystem paths, and unbounded logs.

## API boundary

Brain Core adds exactly one canonical read-only endpoint:

```text
GET /agent-mode/console
```

It uses the existing local Brain Core route boundary and returns the versioned
projection. The endpoint does not call AWS, Bedrock, MiniMax, GLM, Opus, Codex,
SSH, BrainNode, Harness, Workcells, or scheduler/runtime mutation paths.
Existing `/agent-mode/observer` and `/agent-console` routes remain available.

## Brain Console surface

`projects/brain-console/app/agents/page.tsx` adds the `/agents` route and
`components/shell.tsx` adds the `Agents` navigation entry. The page uses the
existing `brainCoreRequest()` HTTP client, TanStack Query with a seven-second
refresh, strict Zod parsing, Lucide icons, and existing CSS cards/tables/tabs.

Tabs are Overview, Agents, Organizations, Tasks, and Failures. The page has no
mutation controls. Local filtering is view-only. TanStack Query cache is
temporary UI state and is visibly marked stale when a refresh fails.

The current implementation surfaces K0-K5 Agent Mode state, K5 organization
final results, K4 lifecycle/runtime/model facts, root budget facts, scheduler
metadata, pending Agent Mode review approvals, bounded evidence metadata, and
failure/uncertainty state. Jarvis intake, notifications, deep drill-down,
richer node/worktree/quota inventory, and lifecycle controls are explicitly
deferred.

## Deterministic fixture and side effects

The Core fixture tests cover an unavailable StateStore, active and terminal
Agent/Task/Attempt joins, uncertain/cancelled visibility, K5 plan/final-result
visibility, approval/schedule metadata, secret exclusion, deterministic
ordering, collection bounds, and route shape. The frontend fixture tests cover
valid empty parsing, malformed/version/status rejection, uncertainty, and K5
final-result metadata.

The U0-A fixture has one root/supervisor-shaped graph, one visible K5
organization and final result, uncertain and cancelled attempts, one pending
approval, one schedule, and bounded root budget facts. The happy K5 lifecycle
counts remain three child Agents, Tasks, Runs, and Attempts; U0-A creates zero
additional lifecycles.

Ten repeated reads are represented by the pure/read-only route contract and
produce zero AgentRuntime calls, Harness launches, ModelGateway/provider/AWS
calls, BrainNode commands, Workcell operations, scheduler mutations, budget
mutations, Task mutations, or Agent mutations. No network is used by the
projection.

## Restart and multi-client reconstruction

The projection is request-time derived from durable observer state, so closing
and reopening the StateStore reuses the same domain rows and produces an
equivalent projection apart from request-time `generatedAt`. Independent
callers use the same versioned endpoint and receive the same domain fields;
there are no browser-specific authority fields.

## Validation

- Brain Core typecheck: passed.
- Brain Core focused projection/observer/K5 tests: **25/25 passed**.
- Brain Console typecheck: passed.
- Brain Console schema tests: **3/3 passed**.
- Brain Core build: passed.
- Brain Console build: passed.
- `git diff --check`: passed.
- Desktop visual inspection: passed; sidebar, Agents navigation, header,
  unavailable state, cards, and tab/table layout showed no overlap.
- Narrow/mobile visual inspection: not run because the available browser
  surface did not expose a viewport override; responsive CSS follows the
  existing Brain Console breakpoints and was type/build validated.

## Security and compatibility audit

The new response type has no prompt, reasoning, credential, environment,
provider-payload, or raw-log field. Model/provider visibility is limited to
durable observer receipt metadata. The browser calls Brain Core only and never
opens the StateStore. No direct lifecycle insert, runtime dispatch, provider
probe, shell command, network call, Console ledger, or mutation route was
introduced. Existing Agent Mode controls and legacy `/agent-console` remain
available.

## U0 exit-gate slice decision

U0-A proves the first bounded property required by the U0 exit gate:
read-only UI state is reconstructible from durable Brain state and does not
become a competing source of truth. It does not claim the full U0 exit gate;
control mutations and deeper operator drill-down remain future work.

**U0-A COMPLETE. U0 IN PROGRESS.**

Exact next bounded slice: **U0-B — Agent Detail, Evidence, Budget, Schedule,
and Failure Drill-Down**. Do not start U0-B automatically.
