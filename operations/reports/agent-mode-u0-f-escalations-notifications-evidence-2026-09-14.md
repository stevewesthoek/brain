# Agent Mode U0-F — Durable Escalations, Unread Notifications, and Remaining Resource/Quota Visibility Gaps

Date: 2026-09-14

## Starting reconciliation

The implementation continued from `b49b668b feat(brain-console): surface agent
execution resources`, the landed U0-E state. The working tree also contained
the protected unrelated Firecrawl log and two untracked unrelated roadmap
files; none were modified, staged, or committed. K4 and K5 remain complete.
No newer U0-F implementation was present in the starting tree.

## Bounded contract

U0-F adds `agent-mode-attention-v1` as a Brain-owned read model. Escalations
are deterministic from closed kind/source/reason material and have open or
resolved status. Notifications are deterministic from kind/source/transition
material and contain only bounded codes, severity, stable source/lineage
references, timestamps, and read metadata. No prompts, hidden reasoning, raw
provider/runtime payloads, credentials, or unbounded text are persisted.

The existing Agent Mode StateStore is extended with:

- `agent_mode_escalations`;
- `agent_mode_notifications`;
- operator-keyed `agent_mode_notification_reads`.

These are an attention index and read-receipt record, not a Task/Run/Attempt,
provider, runtime, cost, result, or approval ledger. Escalation and notification
records are bounded to 100 visible items. Read acknowledgement is individual,
idempotent, and does not resolve, approve, cancel, or settle the source.

## Source classification and producer boundary

The explicit bounded `reconcileAgentModeAttention()` StateStore seam is the
only producer in this slice and is never called by GET projections. It derives:

| Source | Classification |
| --- | --- |
| uncertain Attempt | critical escalation and notification, `UNCERTAIN_RUNTIME` |
| scheduler dead letter | warning escalation and notification, `SCHEDULER_DEAD_LETTER` |
| failed Workcell validation | warning escalation and notification, `WORKCELL_VALIDATION_FAILED` |
| pending review request | notification only; existing review tables remain authoritative |
| ordinary worker failure/cancellation | existing failure projection; no duplicate escalation |
| model escalation request | `model-untrusted` intent; no authority or notification producer |
| max escalation depth | existing policy reason; no duplicate escalation |
| Codex quota | `unavailable`, `no_canonical_durable_source`; no probe or scrape |
| Jarvis intake / richer inventory | not yet surfaced; no invented source |

An escalation resolves only when the authoritative source is no longer
qualifying. A read receipt never resolves it.

## Authenticated read path

The public `GET /agent-mode/console` projection exposes non-personal attention
metadata with `read: null` and `unreadNotificationCount: null`. Personalized
state uses authenticated `GET /agent-mode/notifications` and individual
`POST /agent-mode/notifications/:notificationId/read`.

The Brain Console browser calls only same-origin Next routes. The server derives
`operatorId` from the signed `brain-console-operator-v1` session; it never
accepts a browser-supplied operator identity. POST admission requires the
existing loopback/origin/session boundary and session-bound CSRF nonce. The
server-to-server request uses the separate non-wildcard
`agent-mode.notifications` Brain service capability. No mark-all endpoint was
added.

## Console surface

`/agents` now has a compact Attention tab showing unread count, open
escalations, uncertain/dead-letter counts, notification codes, severity,
source IDs, and timestamps. The sole attention action is individual Mark read.
There are no resolve, approve, retry, lifecycle, spawn, budget, model, or
provider controls. TanStack Query is temporary cache only; no localStorage or
browser-owned authority was introduced.

## Side-effect and security audit

Repeated projection and personalized GET reads open the StateStore read-only
and do not reconcile. They perform no runtime/provider/AWS/SSH/Tailscale,
BrainNode, Harness, Workcell, scheduler, budget, task, or agent mutation. The
new response types contain no secret, credential, path, prompt, reasoning, or
raw provider fields. The existing model escalation request remains explicitly
untrusted and does not contain execution fields.

## Restart and concurrency evidence

Attention records and per-operator read receipts are reconstructed from SQLite
after close/reopen. Deterministic primary keys and SQLite transactions make
reconciliation idempotent; a second reconciliation does not duplicate records.
The notification read composite key makes repeated acknowledgement converge
for one operator while another operator remains unread. The authenticated Core
route was exercised for missing authentication, signed GET, signed POST, and
repeated signed GET. GET does not open a write StateStore or create attention
rows.

## Validation

Focused Brain Core attention, console projection, StateStore, and service-auth
tests passed: **24 tests, 24 passed** in the combined focused run. The new
attention file contributed **3 tests, 3 passed**. Brain Console schema tests
passed: **8 tests, 8 passed**. The existing operator-session test module is
not a U0-F regression; direct `tsx` execution cannot import its pre-existing
`server-only` dependency under the test runner and was not used as a U0-F
pass claim.

Brain Core typecheck and build passed. Brain Console typecheck and production
build passed; the build lists `/agents`, `/api/agent-mode/notifications`, and
`/api/agent-mode/notifications/[notificationId]/read`. `git diff --check`
passed. The full Brain Core suite passed after the final source edits:
**2,548 tests, 2,548 passed, 0 failed**.

## U0-F decision

U0-F is complete for the bounded durable attention, authenticated read-receipt,
and quota-gap visibility slice. U0 remains in progress. This slice does not
claim Jarvis chat/intake, broader inventory, revocation, or additional control
actions.

Exact next roadmap task: **U0-G — Unified Brain Console Phase Exit Audit**.
Do not start it automatically.
