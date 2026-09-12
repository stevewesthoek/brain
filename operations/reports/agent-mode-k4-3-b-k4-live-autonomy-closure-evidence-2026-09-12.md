# Agent Mode K4.3-B — K4 Live Autonomy Closure Evidence — 2026-09-12

## Decision

**K4.3-B COMPLETE. K4 COMPLETE.** The K4 exit gate passes for the bounded
control-plane contract. Brain can admit, create, assign, execute, observe,
interrupt, recover, account for, and retire bounded intelligent workers while
autonomous activity remains policy-, budget-, concurrency-, capability-,
interrupt-, and restart-bounded. This does not claim unrestricted Jarvis
reasoning or production-wide autonomous delegation.

K4.3-A R3 remains the canonical live acceptance. No live provider call was
made during this audit.

## K4 milestone inventory

| Milestone | Audited boundary | Evidence |
|---|---|---|
| K4.0 | Durable scheduler/heartbeat, queue claims, retry/dead-letter, finite no-op tick | `operations/reports/agent-mode-k4-0-scheduler-heartbeat-evidence-2026-09-10.md` |
| K4.1 | Git, Task/Run/Attempt, host-health, and CI EventSources with watermarks and bounded polling | `operations/reports/agent-mode-k4-1-c2-event-source-closure-evidence-2026-09-10.md` |
| K4.2-A | Static action admission and independent `AgentSpawnPolicy` | `operations/reports/agent-mode-k4-2-a-spawn-policy-admission-evidence-2026-09-10.md` |
| K4.2-B | Atomic child identity, slot, total-creation, and root aggregate reservation | `operations/reports/agent-mode-k4-2-b-child-agent-reservation-evidence-2026-09-10.md` |
| K4.2-C | Deterministic Task/Run/Attempt assignment and runtime/profile binding | `operations/reports/agent-mode-k4-2-c-runtime-binding-assignment-evidence-2026-09-10.md` |
| K4.2-D1 | Fenced runtime dispatch, outbox, receipt, verification, settlement, uncertainty | `operations/reports/agent-mode-k4-2-d1-mock-runtime-dispatch-evidence-2026-09-10.md` |
| K4.2-D2 | Restricted Harness process isolation and exact lifecycle control | `operations/reports/agent-mode-k4-2-d2-restricted-harness-dispatch-evidence-2026-09-11.md` |
| K4.2-E1 | Scheduler-to-worker orchestration with MockAgentRuntime | `operations/reports/agent-mode-k4-2-e1-scheduler-dynamic-worker-evidence-2026-09-11.md` |
| K4.2-E2 | Scheduler-to-worker orchestration with the process-backed Harness | `operations/reports/agent-mode-k4-2-e2-harness-dynamic-worker-closure-evidence-2026-09-11.md` |
| K4.3-A | One bounded live MiniMax intelligent worker | `operations/reports/agent-mode-k4-3-a-r3-live-minimax-acceptance-evidence-2026-09-12.md` |

The principal architecture review remains the governing design rationale:
`operations/reports/agent-mode-astra-review-2026-09-08.md`.

## Closure invariant audit

All 30 invariants are **PASS**. Evidence references identify the current
implementation/test boundary; the cited acceptance reports provide the
cross-phase result.

| # | Invariant | Result | Evidence |
|---:|---|---|---|
| 1 | Scheduler events are durably claimed and fenced; concurrent claims and redelivery converge on one logical worker. | PASS | `projects/brain-core/src/agent-mode/scheduler.ts`, `sqlite-state-store.ts`; `k4-0-scheduler-heartbeat.test.ts` claim/fence tests; E1/E2 concurrent-claim and redelivery tests. |
| 2 | Event intent is distinct from `AgentSpawnPolicy` permission. | PASS | `dynamic-worker-orchestrator.ts` action-rule registry plus `spawn-policy.ts`; E1 “action intent is a separate closed registry from spawn permission”. |
| 3 | Unknown/disabled actions and malicious event metadata do not spawn workers; production live rules are disabled by default. | PASS | `dynamic-worker-orchestrator.ts` closed registry and disabled defaults; E1/E2 disabled-rule, unknown-event, and malicious-metadata tests. |
| 4 | Root binding is authoritative and cancellation/kill authority remains root-owned. | PASS | `spawn-policy.ts` root/cancellation/kill/deadline checks; A/E1/E2 root-binding, cancellation, and kill-switch tests. |
| 5 | Child identity, slot, total count, and aggregate allocation are created atomically and idempotently. | PASS | `sqlite-state-store.ts` spawn reservation transaction; K4.2-B report and spawn-reservation tests. |
| 6 | Active child concurrency cannot race past the configured maximum, and retirement releases the active slot. | PASS | `sqlite-state-store.ts` root aggregate updates; spawn-reservation and E1/E2 concurrency/retirement tests. |
| 7 | Total child creation is monotonic, includes retired children, and cannot be bypassed by replay. | PASS | K4.2-B monotonic counter implementation/tests; E1/E2 total-creation and redelivery tests. |
| 8 | Root aggregate step/cost budget is atomic, settles once, and is not oversubscribed or double-charged. | PASS | `sqlite-state-store.ts` budget reservation/settlement; D1/E1/E2 budget tests; R3 receipt/accounting evidence. |
| 9 | Assignment is deterministic/idempotent: one child maps to one Task, Run, and Attempt. | PASS | `child-assignment.ts`, `sqlite-state-store.ts`; child-assignment concurrency/restart/idempotency tests; E1/E2 accepted counts. |
| 10 | Agent role, runtime, and model remain separate policy-controlled identities. | PASS | `child-assignment.ts`, `spawn-policy.ts`, `model-tier-policy.ts`; role/runtime/model separation and model-policy tests. |
| 11 | Runtime dispatch is fenced and follows authority → outbox → invocation → receipt → verify → settle. | PASS | `runtime-dispatch.ts`, `sqlite-state-store.ts`; D1 outbox/fence/ordering tests and report. |
| 12 | Possible runtime effects without durable results become `UNCERTAIN` and are never blindly replayed. | PASS | `runtime-dispatch.ts` uncertainty/reconcile path; D1/E1/E2 uncertain-runtime and no-relaunch tests. |
| 13 | Restricted Harness topology, environment, bounds, identity, and exact reap are enforced. | PASS | `restricted-harness-agent-runtime.ts`, `runtime-process-identity.ts`; D2 process-security/identity tests and E2 evidence. |
| 14 | Harness has no executable tool authority from model output. | PASS | Restricted Harness bridge and manifest in `restricted-harness-agent-runtime.ts`; E2 read-only/recursive/tool-boundary tests; R3 recorded zero tools, BrainNode, and Workcell effects. |
| 15 | Cancellation propagates root → child → Attempt → dispatcher → Harness and acknowledges only after exact reap. | PASS | `runtime-dispatch.ts` and `restricted-harness-agent-runtime.ts`; D1/E1/E2 in-flight cancellation/reaping tests. |
| 16 | Global and root kill switches are rechecked between phases. | PASS | `spawn-policy.ts`, assignment and dispatch authority reads; A/C/D1/E1/E2 stale-kill tests. |
| 17 | Root/event/child deadlines and TTL remain authoritative between phases; runtime deadlines are finite. | PASS | `spawn-policy.ts`, `child-assignment.ts`, `runtime-dispatch.ts`; A/C/D1/E1/E2 expiry/deadline tests. |
| 18 | Dynamic-worker lifecycle cannot recursively create uncontrolled descendants. | PASS | Closed action registry and bounded role/depth policy; E1/E2 recursive-spawn and grandchild-count tests. |
| 19 | Provider ownership is Brain-side: Harness → bounded parent bridge → ModelGateway → Bedrock. | PASS | `restricted-harness-agent-runtime.ts`, `k4-3-a-live-minimax.ts`, `amazon-bedrock-model-gateway.ts`; R3 topology and zero Harness credential evidence. |
| 20 | Live provider intent is durable before invocation; the R3 result is normalized, identity-bound, verified, and settled. | PASS | `k4-3-a-live-minimax.ts` operation/receipt path; R3 evidence: receipt present/durable/verified and operation verified/settled. |
| 21 | Possible provider effects without durable results become `UNCERTAIN`; no automatic replay, fallback, escalation, or replacement occurs. | PASS | `k4-3-a-live-minimax.ts` effect-observed path; R1/R2 known failures preserved as history; D1/provider tests and R3 no-replay evidence. |
| 22 | Provider failure is not intelligence-quality failure and does not trigger automatic escalation. | PASS | `model-tier-policy.ts`; model-policy “provider failure does not escalate” test and Astra review fallback/escalation boundary. |
| 23 | R3 usage/cost is measured from provider metadata, settled once against root budget, and remains stable on restart/redelivery. | PASS | R3 evidence (`61 / 119 / 180`, `$0.000161`); `sqlite-state-store.ts` budget settlement; D1/E1/E2 accounting tests. |
| 24 | R3 redelivery creates no duplicate child, Harness, gateway/provider call, or spend. | PASS | R3 evidence; E1/E2 redelivery tests and orchestrator idempotency path. |
| 25 | StateStore restart reconstructs the complete tested lifecycle and terminal state. | PASS | `sqlite-state-store.ts`; D1/E1/E2 observer/reopen tests; R3 restart reconstruction evidence. |
| 26 | Observer exposes bounded causal/resource state without credentials, raw payloads, hidden reasoning, or unbounded logs. | PASS | `agent-mode-observer.ts`; observer redaction/bounded-state tests; E2 and R3 evidence. |
| 27 | Parent waiting does not retain unnecessary scarce worker/write resources. | PASS | Astra review deadlock rule; roadmap K4 execution invariant; E1/E2 orchestration settlement and resource-release tests/report. This is directly covered by the bounded orchestration design and is non-blocking for K4. |
| 28 | Quiet heartbeat is `NO_ACTION` with zero worker/runtime/model/network work. | PASS | `scheduler.ts`; K4.0 no-op test/report and E1/E2 quiet-pass tests. |
| 29 | Broad production live autonomy remains disabled by default. | PASS | `dynamic-worker-orchestrator.ts` disabled default action rules; E2 disabled-by-default test; roadmap/runbook production gate language. |
| 30 | K4 domain state and runtime contracts are portable beyond personal host identity. | PASS | `sqlite-state-store.ts`, `child-assignment.ts`, `runtime-dispatch.ts`; `agent-mode-contracts.test.ts` installation-root portability test; Astra portability decision. |

**Classification totals:** PASS 30; PASS WITH CONDITION 0; FAIL 0.

## R3 live acceptance summary

R3 (`k4.3-a-r3`) used fresh identities and one authorized direct
`amazon-bedrock` call for `agent-mode/minimax-m2.5` / `minimax.minimax-m2.5` in
`us-east-1`. Fresh access evidence was callable. Counts were exactly one child,
Task, Run, Attempt, Harness launch/reap, ModelGateway invocation, provider
invocation, and model turn. Tools, BrainNode, Workcells, repository effects,
replacement workers, grandchildren, fallback, and escalation were all zero.

The visible response was exactly
`BRAIN_K4_3_A_LIVE_MINIMAX_PASS`; stop reason was `end_turn`; usage was
`61 / 119 / 180` input/output/total tokens; settled cost was `$0.000161`; and
latency was `2679 ms`. One identity-bound normalized provider receipt was
durably persisted, verified, and settled. R3 used the pinned Harness
`0.1.3-alpha.2` / commit `c389f96bf3a9b6807cb71ed6bdad5849be0df6d8` with
profile `brain-agent-mode-restricted` and zero AWS credential variables.

## No-replay, budgets, and authority

Runtime no-replay is proven by D1/E1/E2 uncertain dispatch tests and R3’s
terminal redelivery/restart checks. Provider no-replay is proven by the
identity-bound operation journal, receipt-before-settlement path, preserved
R1/R2 known failures, and R3’s single-call result. A possible provider effect
without a durable result remains `UNCERTAIN`; no blind provider replay is
permitted.

Child active-concurrency, monotonic total-creation, step, token, and cost
limits are enforced from durable root authority. R3’s measured cost is below
the `$0.01` acceptance ceiling and was not charged again after redelivery or
restart.

Cancellation, global/root kill switches, deadlines, and TTL are rechecked at
admission, assignment, dispatch, and runtime boundaries. A running Harness is
stopped and reaped before cancellation is acknowledged. The finite heartbeat
and bounded batch contracts prevent background or unbounded work.

## Process security and provider boundary

The Harness is a separate pinned process with explicit sanitized environment,
bounded Unix-socket IPC, bounded output, finite lifetime, process identity
verification beyond PID, and exact reap. Model output cannot add tools or
executable capability. AWS/provider authority remains in Brain’s parent
ModelGateway path; the Harness receives no AWS credentials and cannot call the
provider directly.

## Observer and restart

The observer reconstructs bounded causation and resource state from scheduler
event through action rule, spawn, child, assignment, runtime, provider, and
settlement. R3 StateStore reopen reconstructed the scheduler event, action
rule, spawn intent, child, Task, Run, Attempt, runtime dispatch, Harness
lifecycle, model operation, receipt, usage, cost, worker terminal result, and
scheduler terminal result.

## Production-default and portability status

K4 completion does not enable Git-, CI-, host-remediation-, or continuous
live-worker rules. The live K4.3-A rule remains disabled by default and requires
explicit bounded controller/test admission. K4 proves the deterministic
control plane needed for bounded autonomous Jarvis delegation; Jarvis
executive reasoning and multi-agent organization remain later phases.

The worker/runtime contracts use injected StateStore, ModelGateway,
AgentRuntime, and transport seams rather than a personal host identity. The
current Office deployment is an installation/configuration concern, not a K4
domain requirement.

## Validation

- K4 closure regression: **439/439 passed**.
- Includes K4.3-A, K4.2-E2/E1, D2/D1, C/B/A, scheduler, all four EventSources,
  budget/control/cancellation/kill/deadline, observer, process identity,
  ModelGateway, and model-policy tests.
- Brain Core typecheck: **PASS**.
- Brain Core build: **PASS**.
- `git diff --check`: **PASS**.
- Full Brain Core suite: **2491/2494 passed**; three failures are the existing
  out-of-scope `agent-orchestrator.test.js` timing assertions. No K4-focused
  test failed, and no K4 implementation path was changed during this audit.
- Live provider calls during this audit: **0**.

## Remaining conditions

There are no K4 invariant conditions or failures. The full repository suite
still has the three unrelated `agent-orchestrator.test.js` timing failures
reported above; they are outside this K4 gate and were not repaired under the
user’s bounded scope. They do not change the K4 classification totals.

## Final decision and exact next task

The K4 phase-exit contract passes. Mark **K4.3-B COMPLETE** and **K4 COMPLETE**.
The roadmap has no separate K4.3 parent milestone to mark; K4.3-A and K4.3-B
are the explicit child gates.

The exact next authoritative roadmap milestone is:

> ## Phase K5 — multi-agent organization

Its roadmap status is **planned after K4**. Its exit gate is:

> one supervisor can delegate a multi-step bounded goal to several workers and
> reconstruct ownership, cost, evidence, dependencies, and final result.

K5 is not started automatically.
