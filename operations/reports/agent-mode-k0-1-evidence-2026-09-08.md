# Agent Mode K0.1 evidence — 2026-09-08

## Result

**K0.1 SQLite transactional foundation: PASS.** Brain Core now has a
domain-specific `AgentModeSqliteStateStore` using Node's built-in `node:sqlite`
runtime. It creates a private local database root outside checkouts by default,
enables WAL mode, and provides transaction-owned agent, event, lease, and
effect primitives.

This is a fixture-backed foundation only. It is not wired into live routes,
schedulers, LaunchAgents, remote nodes, or provider execution.

## Proven invariants

- schema version is initialized and persisted;
- transaction failure rolls back an appended event completely;
- operation effects are idempotent for the same attempt/scope and reject
  conflicting reuse of an operation ID;
- lease acquisition rejects a live competing owner;
- lease release preserves the fence counter, so a later owner receives a
  strictly newer fencing token;
- state is local to one controller and the database path is configurable via
  `BRAIN_AGENT_MODE_STATE_DIR`.

## Validation

- Brain Core typecheck — pass.
- SQLite StateStore tests — 4 pass.
- The implementation uses no new package dependency and performs no live model,
  AWS, scheduler, or external-state action.

## Remaining K0 work

Add durable task/run/attempt/budget/outbox/receipt projections and recovery
operations, then prove crash recovery, stale-writer rejection, cancellation,
budget reservation, and atomic task/event/effect transitions through the same
transaction boundary.
