# Agent Mode K0.4 Evidence — 2026-09-08

## Result

**K0.4 fixture gate: PASS. K0: COMPLETE for the offline kernel/fixture slice.**
Live Bedrock, autonomous Jarvis, remote transport, shell, writes, schedulers,
and external-state changes remain gated and outside this work.

## Mock AgentRuntime and end-to-end proof

`projects/brain-core/src/agent-mode/mock-agent-runtime.ts` defines the smallest
Brain-owned runtime seam: admitted attempt identity, runtime/route/model
identity, declared controls, bounded trace, typed model fixture output,
cancellation observation, typed capability intent, and completion/crash state.
The runtime has no task, grant, lease, budget, effect, receipt, or settlement
authority. Model output is untrusted intent; the controller constructs the
BrainNode command from durable admitted StateStore records.

The happy-path fixture proves:

```text
admit Jarvis/worker attempt → reserve budget → acquire fence →
mock runtime → typed repo.read intent → durable outbox → BrainNode →
bounded fixture read → NodeReceipt → durable receipt + settlement →
verification → completed attempt → reopen → same observer result
```

The integration denies ungranted capability, route/model override, auxiliary
model call, second operation, shell, arbitrary absolute path, stale fence,
cancellation, and operation without durable outbox authority before a
capability read. A crash after durable preparation leaves the outbox
`dispatchable` and derives `safe_to_resume` from the reopened StateStore, not
runtime memory.

## Durable observer projection

`projects/brain-core/src/agent-mode/agent-mode-observer.ts` exposes
`agent-mode-observer-v1` from domain-specific StateStore queries. It includes
durable agents, tasks, runs, attempts, recent events, recovery classifications,
budget summaries, lease currentness, operation state, and verified result/evidence
references. It omits auth proofs, secrets, private provider payloads, and
unnecessary absolute paths. The StateStore has a read-only existing-database
opener; missing state returns explicit `unavailable` without creating a
directory/database.

Existing `/agents`, `/agent-runs`, `/agent-events`, `/recovery`, and
`/agent-console` responses retain their compatibility data and add the clearly
labelled durable `agentMode` projection. `/agent-mode/observer` provides the
versioned projection directly. No legacy approval or Video Orchestrator JSON
snapshot is treated as Agent Mode authority.

## Validation evidence

- Mock AgentRuntime integration tests: **4 passed**.
- Observer projection tests: **3 passed**.
- BrainNode K0.3 tests: **10 passed**.
- SQLite K0.1/K0.2 tests: **10 passed**.
- Focused Agent Mode/Core regression set: **52 passed**.
- Focused route suite: **209 passed**, including durable observer route checks.
- A0.2 restricted Harness regression: **4 passed**.
- Brain Core TypeScript check: **passed**.
- Scoped diff/whitespace checks: **clean**.

All fixtures use temporary synthetic state and filesystem roots. No live model,
AWS, network, shell, subprocess, write capability, DeepSeek Harness process,
LaunchAgent, deployment, or unrelated application suite was used.

## K0 completion decision

K0.1–K0.4 now prove the roadmap’s offline durable kernel gate: versioned
contracts, transactional StateStore, task/run/attempt admission, budgets,
fenced leases, outbox/receipts, cancellation and recovery, local BrainNode
capability enforcement, mock runtime integration, durable verification, and
truthful read-only observer/API projections. Compatibility surfaces remain
distinguishable from durable authority. Therefore **K0 COMPLETE** for the
fixture/kernel scope; live execution remains separately gated.

## Exact next task

**K1.1 — Native Amazon Bedrock ModelGateway and account/model access
verification.** Do not start it automatically. Paid probes and AWS/IAM changes
require separate admission.

## Blockers

None for K0.4 or the offline K0 completion gate.
