# Agent Mode K0.2 evidence — 2026-09-08

## Result

**K0.2 durable execution journal, budget settlement and crash recovery: PASS.**
The existing SQLite StateStore now durably correlates task, run and attempt
identity with admission, budget reservation, lease/fence ownership, dispatch
outbox state, receipts, cancellation state and append-only transition events.
The implementation remains fixture-backed and local-only.

## Durable invariants proven

- task, run and attempt identities survive close/reopen; duplicate immutable
  creation is idempotent and conflicting content fails closed;
- admission atomically creates/verifies task/run/attempt state, reserves a
  run-scoped steps/tokens/dollars budget, acquires a fenced lease, updates
  projections and appends the admission event;
- oversubscription is rejected without leaving a partially admitted attempt;
  settlement releases the reservation and records actual usage without
  negative or over-limit balances; duplicate and conflicting settlement are
  handled explicitly;
- effect preparation atomically records the operation identity, scope, policy,
  lease fence, effect row, dispatch outbox row and journal event before any
  dispatch transition;
- dispatch progresses only from a durable dispatchable outbox row and rejects
  cancellation-requested or stale-fenced writers;
- identical receipts deduplicate; conflicting receipts are retained as
  explicit conflict evidence and move the effect/outbox to `uncertain`;
- late receipts from a stale attempt are retained as `stale` evidence without
  mutating the effect/outbox state owned by the current fence;
- cancellation request, acknowledgement and terminal cancellation are
  separate durable states; a request alone blocks new dispatch but is not an
  acknowledgement that an external process stopped;
- recovery classification is deterministic and includes safe resume, already
  completed, duplicate, stale fenced writer, awaiting receipt reconciliation,
  uncertain non-idempotent effect, cancelled acknowledgement pending and
  terminal failure;
- injected persistence failures roll back compound transitions, so callers
  cannot proceed as if admission, effect preparation, receipt recording or
  budget settlement were safely persisted.

## Crash/recovery matrix

| Fixture boundary | Durable result after reopen | Recovery classification/action |
|---|---|---|
| before admission transaction | created attempt remains unadmitted | `safe_to_resume` |
| during admission transaction | no partial task/run/attempt survives | retry admission safely |
| after admission commit | admission, reservation, lease and event survive | `safe_to_resume` |
| after outbox commit before dispatch | outbox remains `dispatchable` | `safe_to_resume`; dispatch only from outbox |
| after simulated external effect before receipt | effect is `effect_applied` without receipt | `uncertain_non_idempotent_effect`; never blind replay |
| during receipt transaction | no receipt/settlement half-commit survives | `awaiting_receipt_reconciliation` |
| after receipt commit before caller acknowledgement | accepted receipt and effect state survive | `already_completed` for the operation |
| during budget settlement | reservation remains reserved and receipt is absent | `awaiting_receipt_reconciliation` |
| after cancellation request before acknowledgement | request survives; acknowledgement is absent | `cancelled_ack_pending` |

The stale-writer fixture additionally proves that a released lease followed by
a new owner advances the fence, rejects old preparation, and preserves a late
old-attempt receipt as evidence only.

## Disk-write failure

`injectPersistenceFailureOnce()` provides a bounded deterministic failure
fixture. Admission and effect-preparation failures were injected after their
compound writes but before commit; the reopened database contained no unsafe
partial state. Receipt and budget-settlement injection similarly prevented a
half-recorded receipt/settlement from becoming authoritative.

## Validation

- `sqlite-state-store.test.ts` — 10 tests pass, including reopen/restart and
  all nine required crash boundaries;
- full focused Agent Mode compatibility set — 42 tests pass;
- A0.2 restricted Harness topology tests — 4 pass;
- Brain Core typecheck — pass;
- existing A0/Agent Mode focused compatibility tests — pass;
- `git diff --check` on changed files — pass.

No live LLM, provider runtime, shell capability, AWS action, background service,
or external-state mutation was used.

## Remaining K0 work

K0 overall remains in progress. The local BrainNode command/receipt envelope,
read-only capability perimeter, mocked runtime adapter, observer routes and
their conformance fixtures are not claimed by K0.2.

## Exact next recommended task

K0.3 — implement the local portable BrainNode envelope and one read-only
capability fixture over the durable operation/outbox/receipt boundary. Keep it
local and mocked; do not start live agent/model execution or remote transport.
