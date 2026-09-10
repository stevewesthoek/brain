# Agent Mode K2.1 Live Slice Evidence — 2026-09-09

## Status

**RESTRICTED HARNESS RUNTIME OPERATIONAL.** The pinned DeepSeek Harness SDK
bootstraps and runs as a separate child launched by Brain. Keyless deterministic
end-to-end coverage proves the parent-owned model/tool bridge, one typed
`repo.read`, BrainNode receipt verification, and StateStore close/reopen
durability.

**K2.1 live acceptance: incomplete.** Two bounded MiniMax attempts were made:
the initial acceptance and one evidence-driven retry. Both reached the live
MiniMax route but terminated before a verified tool call/final response. No
GLM-5 or Opus call was made, and no further live retry is being made in this
tranche.

## Fixed runtime and identity

| Field | Evidence |
|---|---|
| Jarvis | `agent:jarvis` — durable persistent orchestrator identity |
| Worker | `agent:worker-k2-1` — durable read-only worker identity |
| Task | `task:k2-1-live-read` — `agent-mode.k2-1.read-only-marker` |
| Run | `run:k2-1-live-read` |
| Attempt | `attempt:k2-1-live-read` |
| Model | `agent-mode/minimax-m2.5` → `minimax.minimax-m2.5` |
| Route | direct, `us-east-1` |
| Capability | one `repo.read` / `brain_read` |
| Runtime | DeepSeek Harness `0.1.3-alpha.2` |
| Harness pin | `c389f96bf3a9b6807cb71ed6bdad5849be0df6d8` |
| Harness launch | Brain SDK child; user-facing entrypoint is `brain-agent run` |

The child receives an explicit complete environment, attempt-private home and
temporary directory, and an isolated working directory. It receives no AWS
credential environment, Brain repository root, shell, local filesystem,
subprocess, scheduler, editor, job, or subagent capability. Model and tool
requests cross a local Unix socket to the Brain parent.

## Deterministic evidence

- `npm run typecheck --silent`: passed.
- Existing K0/K1 focused suite: 62 passed.
- Gateway/tool-transport/live-slice focused suite after the implementation:
  15 passed, including the real pinned-child keyless loop.
- `bash tools/scripts/agent-mode-k1-3-runtime-surfaces.test.sh`: passed.
- Existing pinned A0.2 Harness proof: passed for read-only execution, shell
  denial, cancellation, crash-after-effect, uncertain reconciliation,
  duplicate receipt, and conflicting receipt fixtures.
- The keyless live-slice test proves two model turns, one `brain_read`, one
  successful BrainNode receipt, actual fixture marker propagation, and result
  persistence after StateStore close/reopen.
- Gateway normalization excludes MiniMax reasoning blocks and preserves
  structured `toolUse`, usage, stop reason, and request identity.

## Live attempts

The two attempts used separate dedicated local databases to preserve terminal
state without replaying a failed attempt. Both durable attempts recorded:

| Field | Initial | Evidence-driven retry |
|---|---:|---:|
| Model turns | 1 | 1 |
| Tool calls | 0 | 0 |
| Input/output/total tokens | 0 / 0 / 0 | 0 / 0 / 0 |
| Cost receipt | not settled | not settled |
| Final response | empty | empty |
| Durable attempt state | `failed` | `failed` |
| Verification | no NodeReceipt | no NodeReceipt |

The first failure exposed an error-propagation defect in the child bridge. The
retry was run after fixing that defect. Its unchanged durable symptom led to a
transport-shape audit, which identified and fixed the deterministic mapping of
Brain tool schemas to Bedrock Converse `toolSpec.inputSchema.json`. That fix is
covered by a regression test, but the bounded live retry allowance is now
exhausted, so successful live verification remains outstanding.

## Durable observer behavior

`brain-agent inspect run:k2-1-live-read` reads the persisted task/run/attempt
and redacted event stream. It shows the fixed Jarvis/worker identities, exact
MiniMax model/route, policy admission, restricted topology verification, and
the terminal failed acceptance state. The StateStore is not fabricated or
recreated by the observer. `brain-agent cancel RUN_ID` is available only for
pre-dispatch attempts; full pause/resume belongs to K2.2.

## K2.1 completion audit

Passed: durable identities, bounded task/run/attempt creation, K1.2 MiniMax
policy selection, pre-model budget reservation, pinned Harness bootstrap and
restricted child launch, no child model/filesystem bypass, parent bridge,
deterministic one-read BrainNode path, denial-oriented existing fixtures, CLI
run/inspect/cancel surface, launcher wiring, and deterministic validation.

Not yet passed: one successful live MiniMax tool call plus final response,
actual live usage/cost receipt, live NodeReceipt and result verification, and
the corresponding successful live observer state after reopen. K2.2 is not
authorized by this evidence.

## Blocker

The live acceptance window is incomplete after its initial attempt and one
evidence-driven retry. The next safe action is to obtain explicit authorization
for one fresh acceptance after the transport-shape fix, then run only MiniMax
M2.5 and record usage/cost and reopened observer evidence. Do not run GLM-5,
Opus, Codex, or a model-probing fallback.
