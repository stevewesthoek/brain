# Agent Mode K3.2 Workcell Write Evidence

**Date:** 2026-09-09
**Scope:** bounded Workcell-local text mutation only
**Decision:** COMPLETE for the K3.2 gate

## Implemented primitive

`WorkcellFileMutationManager` exposes one typed primitive,
`workcell.file.patch`, in
`projects/brain-core/src/agent-mode/workcell-file-mutation.ts`.

The primitive modifies one existing regular UTF-8 text file. It is
modification-only: create and delete are not implemented. The file and
replacement are each capped at 256 KiB. Binary data, invalid UTF-8, directories,
special files, symlinks, traversal, absolute/Windows paths, reserved metadata
and runtime components, the primary checkout, and another Workcell are
rejected.

## Admission, containment, and mutation sequence

The caller must provide the durable Workcell ID, repository reference, bound
repository/worktree inputs, operation ID, owner agent/attempt, active lease,
fence token, relative target, expected preimage SHA-256, exact old-text anchor,
and replacement text. Lexical path screening occurs before admission; canonical
Workcell resolution and file inspection occur only after the
`repo.write(workcell)` writer gate. The StateStore rechecks the Workcell,
repository/worktree binding, lease, owner/attempt, expiry, and fence token in
its atomic mutation-preparation transaction.

The operation records a durable mutation row before filesystem effects. It
stores only relative target metadata, preimage state/hash, replacement hash,
postimage hash, phase, lease/fence, lineage, timestamps, and operation hash.
The current file must match the expected preimage before preparation and again
immediately before rename. Mutation uses an exclusive temporary sibling,
preserves mode bits, fsyncs and closes it, and atomically renames it over the
target. Full content is not persisted.

## Receipts and recovery

The StateStore schema is version 5 and adds durable mutation and receipt tables.
`WorkcellWriteAppliedReceipt`, `WorkcellWriteRejectedReceipt`, and
`WorkcellWriteReconciledReceipt` bind task/run/attempt/Workcell, operation ID,
lease/fence, repository reference, relative target, preimage/postimage hashes,
timestamp, result, and operation hash.

Same operation ID plus the same immutable mutation is idempotent: a durable
completed receipt is returned without rewriting. Reusing an operation ID for a
different immutable mutation is rejected. A crash before rename is classified
as safe to resume; a crash after rename is reconciled from the durable
postimage phase; changed postimage state is rejected without overwrite. No
`git reset --hard`, delete, commit, merge, push, deploy, shell, or unrestricted
write CLI was added.

K3.1 Git diff capture remains a separate post-write evidence step. A successful
file write is not validation, review, approval, commit, merge, or deployment.

## Verification

Focused command:

```text
npm run typecheck
npm run build
node --test dist/tests/sqlite-state-store.test.js dist/tests/workcell.test.js dist/tests/workcell-writer.test.js dist/tests/workcell-file-mutation.test.js
```

Result: **64 passed, 0 failed** across the K0/K3.0/K3.1/K3.2 focused gate;
the K3.2 fixture file itself contains **27 passed, 0 failed** tests. The K3.2 fixture set uses temporary Git
repositories only and covers successful patching, exact-anchor enforcement,
preimage conflict without overwrite, operation replay and conflict, unsafe and
metadata paths, main-checkout/wrong-Workcell binding, symlink/directory/
binary/oversized-file rejection, stale fences, pre-mutation and temp-file crash
classification, post-rename reconciliation, close/reopen replay, durable
receipt replay, changed postimage protection, and K3.1 diff capture composition.

## BrainNode and portability boundary

BrainNode remains read-only in this tranche. The mutation manager uses the
existing local StateStore and fixed Git/filesystem adapter seam; it does not
create a parallel BrainNode authority or claim remote/future-node write
execution. No Office/MacBook-specific write branch was added. K3.3 remains the
next gate for broader worker orchestration or explicitly approved create/delete
or remote extensions.
