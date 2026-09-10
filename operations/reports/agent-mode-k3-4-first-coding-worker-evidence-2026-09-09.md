# Agent Mode K3.4 First Coding Worker Evidence — 2026-09-09

## Status

**K3.4 COMPLETE.** The original authorized live MiniMax M2.5 attempt failed
before model dispatch because Brain could not establish the owned
runtime-process identity required by the K0 authority boundary; that zero-spend
failure and its root cause remain preserved below. A later, separately
authorized K3.4-R1 acceptance passed the runtime-identity gate and exercised
the live Workcell read → patch → diff → validation path. No retry or model
escalation was used for the original failure.

## Deterministic gate

From `projects/brain-core`:

- `npm run typecheck`: passed.
- `npm run build`: passed.
- Focused K0/K1/K2/K3/K3.4 gate: **140 passed, 0 failed**.
- `git diff --check`: passed.

The focused gate includes the new pinned-child worker fixtures and existing
K3.0–K3.3 crash, cancellation, idempotency, stale-fence, validation-drift,
escalation, Codex-separation, observer-redaction, and restart fixtures. The
new K3.4 fixtures prove:

1. one bounded worker reads and patches only its Brain-created Workcell;
2. the primary checkout remains unchanged;
3. exactly three or fewer MiniMax-only model turns are admitted;
4. a failed diff-integrity validation is durable and cannot promote a result;
5. an absolute-path patch is rejected before mutation;
6. successful Workcell state ends at `awaiting_review`;
7. StateStore close/reopen preserves the completed result; and
8. observer output exposes Workcell lifecycle while redacting absolute paths.

The child Harness is the pinned DeepSeek Harness
`0.1.3-alpha.2` at commit
`c389f96bf3a9b6807cb71ed6bdad5849be0df6d8`, launched as a separate child with
an explicit complete environment. It receives only the typed
`brain_read` and `brain_workcell_patch` bridge tools. Shell, filesystem,
subprocess, arbitrary Git, package/test execution, scheduler, editor, jobs,
subagents, commit, merge, push, and deploy surfaces remain denied.

## Live acceptance attempt

The developer-only acceptance fixture first collected fresh, non-generative
AWS evidence: the MiniMax model was `ACTIVE`, authorization was `AUTHORIZED`,
and agreement, entitlement, and region availability were `AVAILABLE` in
`us-east-1`. The controller then admitted:

| Field | Durable value |
|---|---|
| Jarvis | `agent:jarvis` |
| Worker | `agent:worker-k3-4` |
| Task | `task:k3-4-first-coding-worker` |
| Run | `run:k3-4-first-coding-worker` |
| Attempt | `attempt:k3-4-first-coding-worker` |
| Model admission | `agent-mode/minimax-m2.5` → `minimax.minimax-m2.5` |
| Runtime pin | DeepSeek Harness `c389f96bf3a9b6807cb71ed6bdad5849be0df6d8` |
| Budget | 8 steps / 6,000 tokens / $0.01 ceiling |
| Model turns | 0 |
| Tool calls | 0 |
| Usage | 0 input / 0 output / 0 total |
| Workcell | not created |
| Final state | `failed` |

The durable failure event recorded the exact reason:
`owned brain-agent runtime identity could not be established`.
The observer reopened the same database and showed one Jarvis identity, one
worker identity, one task, one run, one failed attempt, four events, zero
Workcells, zero writes, zero validations, and zero verified Workcell results.

Root cause was isolated to the developer-only acceptance launcher: it ran as a
generic Node command, while the existing K0 identity guard intentionally
requires the owned process command to carry the `brain-agent` marker. The
launcher now sets its explicit `brain-agent k3-4-live-acceptance` process title
for a future separately authorized acceptance. The live attempt was not
replayed under that fix.

## Boundary and next action

The failure is a runtime-launch prerequisite failure, not a model-quality or
Workcell-integrity result. The correct next action is to repair or explicitly
provide the owned runtime identity in the acceptance launcher, then obtain new
authorization for one fresh live acceptance. This evidence does not authorize
that future retry. K3.5 concurrent workers and K4 event-driven autonomy remain
blocked.

The exact disposable fixture was outside the Brain repository and was removed
after this evidence was captured. Historical K3.0–K3.3 reports were not
rewritten.

## K3.4-R1 fresh live acceptance — 2026-09-09

This section is separate from the original failed acceptance above. The
previous failure remains historical and was not mutated into success. A new
authorization was supplied by the K3.4-R1 objective for one fresh MiniMax
acceptance. The corrected developer launcher passed its no-model identity
preflight before the provider was contacted:

| Preflight check | Result |
|---|---|
| Current PID observable | passed |
| `ps` command marker | `brain-agent k3-4-live-acceptance` |
| Real `readRuntimeProcessIdentity(process.pid, runId)` | non-null, passed |
| Normal StateStore runtime attachment | preserved identity, passed |
| Bedrock/model invocation during preflight | none |
| Generic Node negative identity case | rejected, passed |

The fresh live acceptance then completed exactly once through the existing Auto
policy. It used MiniMax M2.5 only; no GLM-5, Claude Opus, Codex, Astra, Luna,
or other model was called.

| Field | Result |
|---|---|
| Jarvis | `agent:jarvis` |
| Worker | `agent:worker-k3-4` |
| Task | `task:k3-4-first-coding-worker` |
| Run | `run:k3-4-first-coding-worker` |
| Attempt | `attempt:k3-4-first-coding-worker` |
| Workcell | `workcell:0182a3da-c9bf-4ce9-b9e0-84373b7d92c3` |
| Model | `agent-mode/minimax-m2.5` → `minimax.minimax-m2.5` |
| Runtime | pinned DeepSeek Harness `0.1.3-alpha.2`, separate child |
| Writer fence | lease `lease:k3-4-first-coding-worker`, fence `1` |
| Model turns | `3` |
| Tool calls | `2` (`brain_read`, `brain_workcell_patch`) |
| Usage | `1,434` input / `343` output / `1,777` total tokens |
| Estimated cost | `$0.000842` |
| Workcell result | `awaiting_review` |
| Mutation result | `applied`; exact `src/message.ts` patch |
| Diff | `diff:538c8bcc7bb9ba6fe734497ad158a91df902db2f42134e39216f5d9ed814229f` |
| Validation | `git.diff.integrity` passed |
| StateStore restart | passed (`restartVerified: true`) |

The post-run audit independently read the disposable fixture and confirmed the
primary checkout remained `export const message = "BEFORE";` while the
Workcell contained `export const message = "K3_4_PASS";`. The Workcell had one
dirty tracked file and its latest commit was still the fixture base commit;
there was no commit, merge, or push operation. The reopened observer reported
one completed attempt, one Workcell, one active writer-lease history, one file
mutation, one diff, one passed validation, one returned result, and the same
`1,434 / 343 / 1,777` usage plus `$0.000842` cost.

The accepted live result proves the K3.4 path: Brain-created Workcell,
Brain-owned lease/fence, restricted child, admitted read, typed patch,
K3.2 mutation, K3.1 diff, K3.3 validation, bounded result, and durable
observer/reopen evidence. The developer-only launcher has no retry path and no
general-purpose write command.

The exact disposable repository, dirty Workcell, temporary acceptance
artifacts, and preflight database were removed after this section was recorded;
durable Brain evidence remains in the StateStore-derived report. K3.4 is now
**COMPLETE**. K3 remains **IN PROGRESS**; the exact next task is K3.5 — two
bounded concurrent coding workers plus the explicit review/commit/merge
authorization boundary. K4 is not started.
