# Agent Mode K2.1-R1 Auto and Live Unblock Evidence — 2026-09-09

## Status

**K2.1-R1 complete.** The Auto-first policy correction, simplified runtime
selectors, deterministic gates, and the one freshly authorized live acceptance
all passed. The historical initial K2.1 report remains unchanged and records
its two failed bounded attempts; this report records the separately authorized
fresh acceptance after the transport-shape fix.

No live GLM-5, Opus, Codex, Astra, Luna, or other model was called. No retry
was made.

## R1 policy and selector result

The policy version is `agent-mode-tier-policy-v2-auto-first`.

- Auto root and planning admission always starts with the MiniMax M2.5 scout,
  including static senior/principal task classes.
- Quality/validation escalation is Brain-owned and bounded:
  MiniMax → GLM → principal. Provider failure remains a provider failure and
  does not consume a reasoning escalation.
- Completed planning packages receive fresh execution admission under the
  cheapest-capable ladder.
- Model escalation requests are untrusted intent; the policy derives the
  actual next tier from prior attempt evidence and budget/depth gates.
- Opus dollar admission is fail-closed because no current verified pricing row
  was available. The Codex Astra principal resource is separate and
  fixture/policy-only; no Astra/Luna model ID was invented or executed.
- `repos` normal operation defaults to Auto without a model selector.
  `repos --choose-model` exposes exactly: `Auto`, `MiniMax M2.5`, `GLM-5`,
  `Opus 4.6`, `Codex`.
- `sessions` normal operation defaults to the Brain/Auto observer view.
  `sessions --choose-model` exposes the same exact five entries. Brain rows
  show Auto plus the actual latest model; missing StateStore/API state produces
  no synthetic rows. Historical Claude launch/resume support remains internal,
  not a normal selector entry.

## Deterministic validation

| Gate | Result |
|---|---|
| Focused policy suite | **48 passed** |
| Focused gateway/live suite | **8 passed** |
| Brain Core typecheck | **passed** |
| Runtime selector shell gate | **passed** |
| `git diff --check` | **passed** |
| Network-free policy test | **passed** |
| Cross-terminal control suite | **3 passed** |
| Combined current scoped suite | **59 passed** |

The focused suite includes the 20 requested R1 policy cases plus one explicit
untrusted-escalation interpretation case, existing route/evidence/budget/
Codex fixtures, the pinned-child keyless live-loop fixture, and the durable
cross-terminal control integration.

## Fresh live acceptance

Command path: `brain-agent run` with no `--model` flag, proving the normal
default is Auto.

| Field | Evidence |
|---|---|
| Database | `/Users/Office/.local/brain/agent-mode/k2-1-live-2026-09-09-r1.db` |
| Jarvis | `agent:jarvis` |
| Worker | `agent:worker-k2-1` |
| Task | `task:k2-1-live-read` |
| Run | `run:k2-1-live-read` |
| Attempt | `attempt:k2-1-live-read` |
| Model | `agent-mode/minimax-m2.5` / `minimax.minimax-m2.5` |
| Route | `minimax.minimax-m2.5`, direct, `us-east-1` |
| Harness | DeepSeek Harness `0.1.3-alpha.2`, commit `c389f96bf3a9b6807cb71ed6bdad5849be0df6d8` |
| Process isolation | separate child |
| Tool calls | **1** `brain_read` / `repo.read` |
| Model turns | **2** |
| Usage | **561 input / 138 output / 699 total tokens** |
| Settled cost | **$0.000334** |
| Final response | `READ_ONLY_LIVE_SLICE_PASS` |
| NodeReceipt | succeeded; operation `operation:k2-1-repo-read` |
| StateStore reopen | **verified** (`restartVerified: true`) |

## Reopened observer check

`brain-agent inspect run:k2-1-live-read` against the fresh database reopened the
durable state and returned `completed` task/run/attempt records with policy
version `agent-mode-tier-policy-v2-auto-first`. The event stream contained:

```text
attempt_admitted
policy_admitted_model
restricted_harness_topology_verified
jarvis_result_returned
attempt_finished
```

The observer did not create or reconstruct state. The result, usage/cost
settlement, BrainNode receipt, and terminal state were already durable.

## Cross-terminal controls

The durable StateStore control suite and CLI integration test pass for:

```text
brain-agent inspect RUN_ID
brain-agent pause RUN_ID
brain-agent resume RUN_ID
brain-agent cancel RUN_ID
brain-agent kill RUN_ID
```

`sessions` exposes those same actions after selecting a Brain row. Pause and
resume transition the run/attempt and append `run_paused`/`run_resumed` events.
Cancel and kill append their own audit events and finish the run durably as
cancelled. Kill only signals a PID previously recorded by Brain and verified
as a `brain-agent` process; otherwise the durable action remains visible while
the signal fails closed.

## Completion decision

K2.1-R1 is **complete and verified**. The exact next task is **K2.2 only after
separate authorization**. K2.2 is not started here. Remaining non-goals are
unchanged: no live all-model matrix, automatic Codex execution, remote node
transport, C0 local-text cleanup, production/deploy changes, extra workers,
or commit/push.
