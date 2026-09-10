# Agent Mode K3.1 Writer Lease Evidence — 2026-09-09

## Decision

**K3.1 status: COMPLETE for the Active Workcell Writer Lease, Fencing, and
Diff Admission foundation.**

This tranche adds controlled write ownership and evidence admission only. It
does not add an editing operation, autonomous coding agent, model/LLM call,
shell, arbitrary command, merge, approval, deployment, commit, or push.

## Architecture and authority

The existing Office-authoritative `AgentModeSqliteStateStore` remains the only
state authority. K3.1 extends that database with durable Workcell writer lease
history, writer receipts, diff evidence, and validation evidence. No second
database, ledger, or control plane was introduced.

`WorkcellWriterManager` is the deterministic seam over the StateStore and the
fixed Git adapter from K3.0. It performs lease lifecycle, write admission, and
read-only diff capture. The write-admission method returns a decision; it does
not modify a Workcell.

## Lease and fencing model

Each lease stores:

```text
leaseId, workcellId, ownerAgent, ownerAttempt, createdAt, expiresAt,
fenceToken, status
```

Allowed lease statuses are `active`, `expired`, `released`, and `revoked`.
The StateStore enforces one active lease per Workcell with a unique partial
index. Fence tokens are allocated as `MAX(previous fence) + 1` per Workcell and
never reset. Active leases cannot be stolen. An expired lease is durably closed
before a replacement is granted. Release requires the matching owner agent and
attempt.

Write admission requires all of:

1. an existing Workcell in a write-eligible state (`prepared`, `active`, or
   `testing`);
2. exact `repo.write(workcell)` capability;
3. exact durable repository-root and Workcell worktree binding;
4. active, unexpired lease;
5. matching owner agent and attempt; and
6. matching current fence token.

Missing lease, expiry, wrong owner/attempt, stale fence, wrong Workcell, main
checkout, invalid capability, or invalid Workcell state fails closed and emits
`WriteRejectedReceipt`. No direct repository write is available.

## Diff evidence and validation admission

After successful write admission, the fixed Git adapter captures:

```text
workcellId, repositoryRef, branch, baseRevision, currentRevision,
changedFiles, diffHash
```

The evidence includes tracked and untracked files. The hash is deterministic
for the same complete Git diff state, including untracked file names and bytes.
`DiffCapturedReceipt` records the lease and fence lineage.

`requestValidation` stores a requested result (`passed`, `failed`, or
`unknown`) against an existing diff. Only a stored passing result produces the
separate evidence state `validation_ready`; failed and unknown results remain
`rejected`. This is an evidence seam only: no tests or arbitrary validation
commands are executed.

## Receipts

The following durable receipt types are implemented:

```text
WriterLeaseGrantedReceipt
WriterLeaseReleasedReceipt
WriteRejectedReceipt
DiffCapturedReceipt
ValidationAdmissionReceipt
```

Each includes task ID, run ID, attempt ID, Workcell ID, lease ID (or explicit
null for a rejection without a lease), fence token (or explicit null),
timestamp, operation hash, and result state. Receipts contain no secrets and
survive StateStore close/reopen.

## Crash and restart behavior

- A crashed or abandoned writer cannot continue after its lease expires.
- Lease recovery is deterministic and closes expired leases before replacement.
- A replacement lease always receives a higher fence token.
- Old lease IDs and old fence tokens remain invalid at write admission.
- StateStore restart preserves lease history, receipts, diff evidence, and
  validation evidence; no in-memory ownership authority is required.
- Active leases are not stolen merely because another writer requests access.

## Validation

Focused test file: `projects/brain-core/src/tests/workcell-writer.test.ts`

| Gate | Result |
|---|---:|
| K3.1 writer/diff/validation tests | 13/13 passed |
| K3.0 Workcell tests after K3.1 changes | 14/14 passed |
| StateStore + Workcell compiled focused tests | 37/37 passed |
| TypeScript typecheck | passed |
| Brain Core build | passed |
| Diff whitespace check | passed |
| Full Brain Core suite | 2,073/2,079 passed; 6 unrelated failures |
| Model calls / Bedrock spend | 0 |
| Commits / pushes | 0 |

The K3.1 tests prove one writer per Workcell, second-writer rejection, expiry
recovery, stale-fence rejection, crash/abandonment behavior, monotonic fencing,
old-agent rejection, wrong-Workcell and main-checkout rejection, receipt
restart persistence, deterministic diff hashing, and validation readiness
gating.

The six full-suite failures remain limited to five existing orchestration
executor tests and one existing Video Orchestrator metadata expectation; no
K3.1 test failed and those areas were not changed by this tranche.

## Files changed for K3.1

- `projects/brain-core/src/agent-mode/sqlite-state-store.ts`
- `projects/brain-core/src/agent-mode/workcell.ts`
- `projects/brain-core/src/agent-mode/workcell-writer.ts`
- `projects/brain-core/src/tests/workcell.test.ts`
- `projects/brain-core/src/tests/workcell-writer.test.ts`
- `projects/brain-core/src/tests/sqlite-state-store.test.ts`
- `operations/specs/agent-mode-runtime-roadmap.md`
- `docs/product/agent-mode-progress.md`
- `operations/runbooks/agent-mode-runtime-surfaces.md`
- this evidence report

## Remaining K3

K3.2 remains unstarted. The remaining K3 work is a bounded Workcell-local
write executor, preimage/snapshot drift validation, deterministic validation
execution where separately admitted, diff review evidence, and the explicit
human commit/merge approval boundary. These must preserve the same lease,
fence, capability, StateStore, and no-production-write constraints.

**Exact next task:** K3.2 — implement bounded Workcell-local write execution
with preimage/snapshot validation. Stop before autonomous coding agents,
merge, deploy, or production repository writes.
