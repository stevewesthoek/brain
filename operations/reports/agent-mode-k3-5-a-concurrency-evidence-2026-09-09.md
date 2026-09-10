# Agent Mode K3.5-A Concurrency Evidence — 2026-09-09

## Status

**K3.5-A COMPLETE. K3 remains IN PROGRESS.** This gate proves only the
concurrent-worker isolation foundation. Review, approval, commit, merge,
target-ref, and Git merge authorization are not part of this acceptance.

## Deterministic proof

From `projects/brain-core`:

- `npm run typecheck` passed.
- `npm run build` passed.
- The K3-scoped deterministic gate, including K3.5-A, passed **142/142**.
- `git diff --check` passed.
- No live model was called; the workers used deterministic mock gateways.

The disposable fixture contains `src/worker-a.ts` and `src/worker-b.ts`.
Both workers use the same pinned base revision and a deterministic two-party
barrier to prove real overlap without timing sleeps.

## Concurrency and isolation

The statically admitted tuple contains exactly two workers. The root budget is
16 steps, 12,000 tokens, and $0.02; each child is bounded to 6 steps, 6,000
tokens, and $0.01. No dynamic worker creation or second runtime was added.

Each worker has a distinct identity, attempt, Workcell, branch, writer lease,
fence, mutation, and result record. Both reach `awaiting_review` through the
existing K3.2/K3.3 path. The measured maximum concurrency is **2**. Worker A
changes only its file and Worker B changes only its file; the main checkout is
unchanged.

## Negative controls

The deterministic gate proves that:

- a worker's lease and owner cannot write another Workcell;
- a worker cannot steal the other Workcell's lease;
- an old fence is rejected before filesystem mutation;
- same-Workcell writer contention is rejected;
- the cross-Workcell attempt leaves the target file unchanged.

No shell, arbitrary command runner, unrestricted Git path, package execution,
or main-checkout write surface was introduced.

## Durability and observer

After SQLite WAL close/reopen, the StateStore retains two Workcells, two
mutation histories, both writer leases, and the durable root-result event. The
observer reconstructs two Workcells, two Workcell writes, two active writer
leases, and two worker results. No secrets or full file contents are persisted
in the evidence.

## Remaining K3.5 work

The separate promotion gate remains: review/approval, Workcell commit,
target-ref fencing, merge authorization, and restart/reconciliation evidence
for promotion. Those paths are not claimed or advanced by K3.5-A.
