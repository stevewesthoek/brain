# Agent Mode K4.2-B Child Agent Reservation Evidence

**Date:** 2026-09-10
**Status:** COMPLETE for the K4.2-B durable reservation gate
**Scope:** Durable Child Agent Identity, Atomic Spawn-Slot Reservation and Root Aggregate Limits

## Result

K4.2-B is complete in the existing SQLite StateStore. The gate adds a bounded
child identity record without adding runtime dispatch, model selection, child
task/run/attempt creation, scheduler-to-worker wiring, Workcell/Git mutation,
network access, or UI/daemon behavior.

The controller derives the child Agent ID from the durable spawn intent. Each
spawned child persists the exact root and optional parent/task/run lineage,
role-template and policy versions, source event, authoritative depth,
repository/resource scopes, capability snapshot and hash, requested/reserved
step and cost ceilings, creation time, expiry, and truthful reserved,
retired, cancelled, or expired status. Existing non-spawned Agent rows remain
valid and are not included in child aggregates.

## Atomic authority

`reserveSpawnAndCreateChild` is the sole K4.2-B creation operation. It runs one
`BEGIN IMMEDIATE` StateStore transaction and rechecks the current durable
global/root admission controls, root and parent lineage, cancellation,
deadline, policy/template versions, active count, monotonic total count, and
root aggregate reserved step/cost ceilings. A guarded root-row update, child
insert, bounded `child_agent_created` event, and durable receipt commit or roll
back together. The root aggregate row is the sole source of active/total
counters and reserved child allocation.

`spawnIntentKey` is durable and idempotent. A retry with the same immutable
creation material returns the original child and receipt without another slot,
count, or allocation. A conflicting immutable request fails closed. Retirement
and bounded expiry reconciliation are transactional and idempotent: active
slot and unused allocation are released, while total creation count is never
decremented. Expiry reconciliation processes at most 64 rows per pass.

Observer output exposes bounded safe child and root aggregate state only. No
prompts, raw provider payloads, credentials, secrets, or execution details are
retained in the child receipt or lifecycle event.

## Verification

Focused K4.2-B source test:

```text
tsx --test projects/brain-core/src/tests/agent-mode-spawn-reservation.test.ts
47 tests, 47 passed, 0 failed
```

The focused run also passed TypeScript no-emit checking. The build plus the
K4.2-B, K4.2-A, K4.0, K4.1, observer, contract, and control regression set
passed:

```text
npm run build
189 tests, 189 passed, 0 failed
```

The concurrent cases cover two distinct callers racing for a final active
slot and two callers retrying the same intent. Restart cases cover active and
retired aggregate recovery and retry after a lost response. The matrix also
covers root isolation, kill switches, stale admission decisions, root budget
and total-creation ceilings, lineage/scope/capability snapshots, bounded
expiry, no partial writes, and receipt redaction.

## Explicit boundary

K4.2-B does not create or bind a child Task, Run, Attempt, AgentRuntime,
ModelGateway call, worker process, or live scheduler dispatch. The exact next
task is **K4.2-C — Runtime Binding and Child Task/Run Assignment**.
