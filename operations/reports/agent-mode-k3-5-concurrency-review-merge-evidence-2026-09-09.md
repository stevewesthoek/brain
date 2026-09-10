# Agent Mode K3.5 Concurrency, Review, Commit, and Merge Evidence — 2026-09-09

## Status

**K3.5 COMPLETE. K3 COMPLETE.** The final planned K3 gate passed its
deterministic suite and one explicitly authorized live acceptance containing
exactly two concurrent MiniMax M2.5 workers. K4 — event-driven autonomy and
dynamic workers — is the exact next phase and was not started.

## Deterministic validation

From `projects/brain-core`:

- `npm run typecheck`: passed.
- `npm run build`: passed.
- K0/K1/K2/K3/K3.4/K3.5 focused gate: **145 passed, 0 failed**.
- `git diff --check`: passed.
- `node --check tools/scripts/agent-mode-k3-5-live-acceptance.mjs`: passed.

The repository-wide `npm test` run reported 2,123 passed and 6 failures in
pre-existing orchestration/YouTube metadata tests (`OrchestrationExecutor`
and `generateMetadataRequest`). Those tests are outside the Agent Mode/K3
surface; the authoritative K3-scoped gate above passed 145/145.

The focused gate includes the existing Workcell writer, fencing, mutation,
validation, restricted Harness, recovery, cancellation, model-policy,
Codex-separation, observer, and restart fixtures, plus K3.5 coverage for:

1. exactly two statically admitted workers under a bounded root envelope;
2. actual overlap using a deterministic two-worker barrier;
3. distinct attempts, Workcells, branches, leases, fences, and mutation IDs;
4. same pinned base revision and no silent base adoption;
5. same-Workcell writer contention rejection;
6. review request and decision durability;
7. model self-approval and model-created authorization rejection;
8. failed, missing, or stale validation non-promotion;
9. post-review candidate drift rejection;
10. exact Workcell commit admission;
11. commit crash-before-receipt reconciliation;
12. separate merge approval and target-head preimage checks;
13. target-ref lease coordination and stale-target rejection;
14. merge crash-before-receipt reconciliation; and
15. StateStore reopen and observer reconstruction.

## Architecture and authority boundary

K3.5 adds `k3-5-concurrency.ts` with a static `K35_WORKERS` tuple of exactly
two child definitions. It uses the existing K3.4 restricted worker controller
and typed Brain bridge. The child receives only `brain_read` and
`brain_workcell_patch`; it receives no shell, filesystem, arbitrary Git,
package execution, commit, merge, review, approval, or subagent capability.
The root envelope is 16 steps / 12,000 tokens / $0.02, with each child capped
at 6 steps / 6,000 tokens / $0.01. The child envelopes are checked against the
root before dispatch, and no dynamic worker creation exists.

Filesystem edits are Workcell-local. Workcell branches are separate Git refs.
The Git object database and ref registry remain repository-shared. The target
branch is a separate merge-target mutation. Workcell file writes retain the
existing writer lease/fence path; target ref effects use the new durable
`agent_mode_target_ref_leases` table, with one active lease per repository and
target ref and monotonically increasing fence tokens. Different Workcell
writes remain concurrent; only shared target-ref effects coordinate.

## Live two-worker acceptance

The developer-only launcher used a disposable repository, fresh AWS Bedrock
catalog/availability evidence, and exactly two concurrent restricted child
runtimes. It never used Brain or Mind and had no retry or escalation path.

- Base revision: `91aedf4ae6c257e8b6e46d5c9519a8993f8ce5c4`.
- Actual overlap: **passed**.
- Maximum concurrent workers observed: **2**.
- Both Workcells originated from the exact base revision.
- Main checkout stayed unchanged until the explicitly authorized disposable
  fixture merges.

Worker A:

- model: `agent-mode/minimax-m2.5` / `minimax.minimax-m2.5`;
- task/run/attempt: `task:k3-5-worker-a` /
  `run:k3-5-worker-a` / `attempt:k3-5-worker-a`;
- Workcell: `workcell:cd8ae2fb-d921-47e6-b0b9-970d189f1e81`;
- writer lease/fence: `lease:k3-5-worker-a` / `1`;
- 3 turns, 2 typed tool calls, 1,468 input, 515 output, 1,983 total tokens;
- estimated cost: `$0.001058`;
- result: completed, diff-integrity passed, `awaiting_review`;
- commit: `45466c07933057f6a62a575b58e7f6edb6766509`.

Worker B:

- model: `agent-mode/minimax-m2.5` / `minimax.minimax-m2.5`;
- task/run/attempt: `task:k3-5-worker-b` /
  `run:k3-5-worker-b` / `attempt:k3-5-worker-b`;
- Workcell: `workcell:93098aed-688f-4c9c-819d-1e318bec33dd`;
- writer lease/fence: `lease:k3-5-worker-b` / `1`;
- 3 turns, 2 typed tool calls, 1,475 input, 474 output, 1,949 total tokens;
- estimated cost: `$0.001011`;
- result: completed, diff-integrity passed, `awaiting_review`;
- commit: `540886bb526319100cbf0d5e87bf913e3688ef43`.

Aggregate live model usage was 6 turns, 4 typed tool calls, 2,943 input,
989 output, 3,932 total tokens, and approximately `$0.002069`. No other model
was called. No GLM-5, Opus, Codex, or retry was used.

## Review, commit, and merge proof

Each candidate received its own immutable durable review request and explicit
human-attributed decision. Review approval was rejected for missing/failed or
stale validation, drifted candidates, and model actors. A rejected review was
also proven unable to commit.

`workcell.commit` is a fixed non-shell Git adapter operation. It validates the
Workcell branch, parent, staged file set, approved diff hash, passed validation
evidence, review decision, and current filesystem candidate before Git
mutation. It accepts only a bounded validated message and fixed Git argv; it
does not push. A crash after Git commit and before receipt persistence leaves a
durable prepared operation that the next invocation reconciles to the existing
clean commit instead of creating a duplicate.

`workcell.merge` is separate from review and commit. Each merge had its own
one-use durable approval bound to repository, source Workcell/branch/commit,
diff and validation evidence, target `main`, expected target head, approver,
expiry, and operation identity. Merge 1 used target preimage
`91aedf4ae6c257e8b6e46d5c9519a8993f8ce5c4` and produced
`63b16c15bcb7f9eb4e0e73c089ea10b98055b214`. A merge-2 approval created against
the old head was rejected. Merge 2 was then approved against the new head and
produced final target head `fa8e39ec72c32690aab27947bd2ecf3ab87ca6d3`.

The final target contained exactly:

- `src/worker-a.ts` → `K3_5_A_PASS`;
- `src/worker-b.ts` → `K3_5_B_PASS`.

Both worker commits were represented in target history. No conflict
resolution, force operation, rebase, push, or direct `repo.write(main)` path
was used. A target-ref lease contention negative also passed: only one valid
authority can hold the active shared-ref lease.

## Durability, cleanup, and exit decision

The SQLite WAL StateStore persisted workers, Workcells, leases/fences,
mutations, diffs, validations, review requests/decisions, commit operations,
merge approvals/operations, target-ref authority, usage, and events. Close and
reopen reconstructed two review requests, two decisions, two commit records,
and two merge records. The observer exposed those bounded records and two
merged Workcells without exposing absolute paths, secrets, or model reasoning.

The crash/restart fixtures passed for commit and merge effects. Failed
validation remained non-promotable. The live fixture and all exact Workcell
paths were removed after evidence recording; no unrelated path was cleaned.

All roadmap K3 exit criteria are now proven: isolated Git Workcells, one
writer per Workcell, stale fencing, pinned reads/base, deterministic
validation, diff/evidence capture, explicit review/commit/merge boundaries,
stale cleanup, deterministic policy/quotas, no direct main write, and no
uncontrolled shell. Therefore K3 is **COMPLETE**.

Exact next task: **K4 — event-driven autonomy and dynamic workers**. Do not
start K4 automatically from this acceptance.
