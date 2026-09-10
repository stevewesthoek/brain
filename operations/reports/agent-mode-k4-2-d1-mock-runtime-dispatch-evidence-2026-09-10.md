# Agent Mode K4.2-D1 — Mock-Backed Bounded Runtime Dispatch Evidence

Date: 2026-09-10
Status: COMPLETE for the D1 bounded gate

## Scope

This tranche implements only the in-process `MockAgentRuntime` dispatch seam.
It does not launch the restricted Harness, an operating-system process, a
model/provider, BrainNode, Workcell, scheduler worker, network request, or
replacement worker. The existing SQLite StateStore remains the sole authority.

## Durable protocol

`AgentModeRuntimeDispatcher` validates the bounded request, performs a fresh
execution-time authority recheck, acquires a fenced `runtime-dispatch:<attempt>`
lease, and durably prepares the existing `effects` and `dispatch_outbox` rows
before invoking the runtime. Runtime results are bounded typed values. The
existing `receipts` table records the generic receipt while the bounded runtime
receipt is retained in the effect JSON. Verification precedes settlement.

The truthful state sequence is `dispatchable → dispatched → receipt_recorded →
verified → settled`, with `failed`, `cancelled`, and `uncertain` terminal or
reconciliation states. A runtime crash, conflicting receipt, invalid result,
stale fence, or unavailable authority does not trigger blind replay. Supported
reconciliation may record deterministic runtime evidence; unsupported
reconciliation remains uncertain.

Success, failure, and acknowledged cancellation settle Attempt/Run/Task, child
assignment, child Agent, budget reservation, root active-slot/allocation, and
the runtime lease exactly once. Cancellation uses an `AbortSignal` plus a
durable cancellation check, with a deterministic Mock runtime barrier fixture.
Observer output reconstructs bounded runtime dispatch state and excludes prompt,
provider, trace, credential, and secret payloads.

## Verification

- Build/typecheck: `npm run build` — PASS.
- Focused D1 matrix: 57/57 — PASS.
- The focused matrix covers fresh authority, identity/runtime/profile/policy
  and scope checks, deadlines/expiry, kill switches, cancellation, budgets and
  allocations, fenced lease ownership, duplicate dispatch, receipt
  idempotency/conflict, verification ordering, crash/restart windows,
  uncertainty/reconciliation, bounded results, observer reconstruction, and
  no process/model/Workcell/network/scheduler side effects.
- Existing Agent Mode, K4.0, K4.1, K4.2-A, K4.2-B, and K4.2-C regression
  suite: 304/304 — PASS. The package-wide `brain-core` command separately
  reports three unrelated `OrchestrationExecutor` timeout failures.

## Explicit non-goals

Restricted Harness process dispatch is not implemented here. The next task is
`K4.2-D2 — Restricted Harness Process Dispatch, Runtime Cancellation and
Reconciliation`.
