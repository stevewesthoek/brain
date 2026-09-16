# Agent Mode H0-A Hardening Harness Evidence — 2026-09-16

## Decision and starting state

Starting HEAD: `2d6bc8b4 test(agent-mode): prove control-plane relocation cutover`.
The initial worktree contained only the three protected unrelated paths:
`tools/firecrawl/logs/firecrawl.log`,
`operations/specs/mindcontrol-product-roadmap.md`, and
`operations/specs/nevermind-release-pipeline-roadmap.md`. They were not read for
content, edited, staged, or included. No H0 harness existed at start.

D0 is **COMPLETE** and was not reopened. D0-F's committed evidence records its
own full Core result as 2,600/2,600. Earlier D0-E evidence remains unchanged at
2,596/2,596; this report does not rewrite that historical count. H0 is the
authoritative current phase and remains **IN PROGRESS**.

## H0-A harness contract

New test-only fixture module:
`projects/brain-core/src/tests/fixtures/agent-mode-hardening-harness.ts`.
It is not imported by the production API and adds no CLI, HTTP route, scheduler,
recovery classifier, StateStore, ledger, or fault control surface.

- `agent-mode.hardening-scenario.v1` validates a closed action/fault vocabulary,
  IDs, ordered logical timestamps, a bounded duration, deterministic seed, and
  a complete set of finite collection/operation bounds. Unknown fields,
  shell/provider/credential-shaped authority, unsupported actions, mismatched
  action/fault pairs, oversized scenarios, and invalid step order fail closed.
- `agent-mode.hardening-result.v1` carries status/reason codes, logical time,
  iteration/fault counts, checked invariants, bounded StateStore references,
  lifecycle counts, budget summaries, and recovery classifications. It excludes
  raw exception text, prompts, provider payloads, credentials, and environment.
- `agent-mode.hardening-gate.v1` requires exactly one evidence-bearing entry
  per fault class. Any failed class is FAIL. Missing/blocked/not-run evidence,
  live acceptance for marked classes, wall-clock soak, or security release
  review leaves the gate INCOMPLETE. Fixture passes cannot close the release
  gate.
- The injected `HardeningLogicalClock` moves monotonically within the declared
  duration. It does not patch global `Date` or sleep.
- The runner executes only bounded steps and passes each closed action to a
  test-injected fixture adapter. It checks safety signals, budget ceilings,
  agent/event/evidence bounds, liveness requirements, safe evidence refs, and
  audit completeness at every observation. Liveness is checked at the scenario
  boundary so transient expected blocked states do not become false failures.

The 24-step accelerated fixture creates/re-delivers scheduler events in a
temporary SQLite StateStore, crosses 24 logical hourly boundaries, closes and
reopens the store, and verifies 23 unique durable events and 23 duplicate
deliveries. This is a deterministic StateStore/scheduler seam test, not 24 hours
of wall-clock operation and not a full production workload.

## Fault inventory and evidence status

Existing suites remain the authority for their underlying behavior. The new
matrix records the reusable seam, existing tests, known composition gap,
expected outcome, safety/liveness criterion, audit evidence, and whether later
live acceptance is required. This avoids treating a unit test as proof of the
whole H0 exit gate.

| Fault class | Existing deterministic fixture evidence | Remaining composed/live acceptance |
|---|---|---|
| Provider outage | `amazon-bedrock-model-gateway.test.ts` classifies errors and now proves fixture outage then a later request succeeds without fallback. | Compose with durable worker state and outage backoff/recovery; no live provider required for H0-A. |
| Bedrock budget exhaustion | `agent-mode-contracts.test.ts`, `agent-mode-spawn-reservation.test.ts`, `sqlite-state-store.test.ts`. | One combined steps/tokens/cost exhaustion scenario across restart. |
| Codex quota exhaustion | `agent-mode-contracts.test.ts`, `agent-mode-model-tier-policy.test.ts`. | Exhausted/stale quota plus manual-reserve boundary; never invoke real Codex. |
| Host loss/reconnect | `agent-mode-node-transport.test.ts`, including fresh negotiation and dedup/corruption behavior. | Compose reconnect with controller restart; no SSH/Tailscale or personal host. |
| Process crash/restart | `agent-mode-process-recovery.test.ts`, `agent-mode-runtime-dispatch.test.ts`, `agent-mode-state-relocation.test.ts`, D0-F. | One H0 schedule spanning representative crash points; no blind replay. |
| Stale lease/fence | admission contracts, process recovery, scheduler heartbeat, Workcell mutation/validation. | Cross-resource monitor composition; never reset fence counters. |
| Duplicate delivery | scheduler heartbeat, NodeTransport, runtime dispatch, K5 redrive, plus the new 24-logical-hour durable event scenario. | Combine event, receipt, and command redelivery in a single scenario. |
| Stuck Agent | spawn TTL/deadline/reservation reconciliation and observer suites. | Compose a never-completing runtime with deadline/attention projection. |
| Spawn limit | SpawnPolicy, reservation, K5 delegation and scheduler orchestration. | Simultaneous depth/concurrency/budget stress schedule. |
| Sandbox denial | restricted Harness profile and restricted runtime suites. | H0 result linkage to zero-effect evidence in a combined run. |
| Tool denial | attempt admission and restricted Harness allowlist suites. | Shared monitor cross-check against runtime/effect counts. |
| Corrupted state | Node dedup corruption and relocation snapshot tamper/rejection fixtures. | Broader supported parser/state corruption catalogue; production SQLite is never mutated. |
| Accelerated soak | New H0 runner/clock and durable 24-logical-hour StateStore scenario. | Compose the representative K4/K5/scheduler/node workload; this is not the wall-clock soak. |
| Security | admission, SpawnPolicy, service auth/control, Harness restrictions, Console projection security tests. | Dedicated H0 security release review remains not run. |
| Auditability | observer, runtime receipts, durable events, D0 snapshots, and H0 bounded evidence/result checks. | Wire evidence completeness to composed subsystem observations. |

The exact machine-readable source for this matrix is
`HARDENING_COVERAGE_MATRIX` in the test fixture module. It intentionally labels
gaps rather than overclaiming complete H0 fault coverage.

## Monitors, bounds, and reproducibility

Scenario hard bounds cap steps at 256, evidence refs at 64, logical duration at
31 days, and all declared counts at finite nonnegative safe integers. Each
scenario supplies stricter limits for roots, Agents, Tasks, Runs, Attempts,
runtime/model/node operations, events, fault injections, and evidence. No
randomized scheduling is used; the seed is still recorded and the closed step
order is authoritative. Identical scenario and fixture state produce identical
logical output. Resource metrics are not included in deterministic identity.

Read-only monitors distinguish safety (`duplicate_logical_task`, duplicate
external effect, uncertain replay, budget overspend, stale fence, competing
authority, capability/security violation, terminal reactivation, completed
work replay, agent bound, secret projection) from liveness (safe work reaches a
terminal or blocked result, recovery/outage/stuck state is observable, and
later eligible scheduling progresses). Each fixture adapter reports whether
the existing durable evidence is complete; no second audit ledger is created.
The runner returns bounded reason codes only and deliberately discards raw
adapter exception strings.

## Validation and side effects

The new H0 focused suite: **7/7 passed**. The provider-gateway fixture suite
with the new outage/recovery case: **8/8 passed**; combined targeted invocation:
**15/15 passed**. The focused Agent Mode/K4/K5/D0/Workcell/Console regression
command passed **459/459**.

Final Brain Core `npm test` (which runs the production build before tests):
**2,608/2,608 passed, 0 failed**. `npm run typecheck` passed. A separate
`npm run build` passed. `git diff --check` passed.

All provider tests inject fixture transports. The StateStore/duplicate fixture
uses a temporary local database and removes it after completion. No live model,
Bedrock, Codex, MiniMax, GLM, Opus, network, SSH/Tailscale, Office StateStore,
service-manager mutation, deployment, or production repository mutation was
used. Existing tests may exercise local fixture processes or temporary
Workcells; those are isolated test effects, not live Agent Mode authority.
Brain Console source was not changed, so Console build validation was not
applicable. The architecture doc records that the test harness has no Console
surface.

## H0 gate and next task

Current H0 gate: **INCOMPLETE**, not PASS. The scenario gate requires all
roadmap classes, later live acceptance where marked, a genuine wall-clock soak,
and a dedicated security release review. H0-A proves bounded deterministic
fixture behavior and a small durable restart/re-delivery schedule only; it does
not prove unattended production or multi-hour resource stability.

Proposed H0-B starting envelope (proposal only; not acceptance or authorization
to start): six hours in isolated local Core/StateStore fixtures, one bounded
no-op/fixture workload cycle per minute (360 cycles), deterministic fault
points every 30 minutes, and one controlled process restart per two-hour block.
Record RSS/heap and an open-handle/FD proxy at least once per minute after a
30-minute warm-up, plus StateStore size and event/evidence counts. Set numeric
resource ceilings only after the H0-B preflight baseline is captured; require
no monotonic descriptor growth, no unexplained StateStore growth, zero false
success/duplicate effects/budget or fence violations, and all stalled work to
reach explicit attention or blocked state. This H0-A run collected no
longitudinal resource series, so it makes no memory/FD stability claim.

H0-A is **COMPLETE**; H0 remains **IN PROGRESS**. Exact next bounded task:
**H0-B — Multi-Hour Isolated Autonomous Soak and Resource-Stability
Acceptance**. Do not start it automatically.
