# Brain Console Architecture

**Status:** active implementation reference  
**Dashboard:** `projects/brain-console`  
**Primary UI pattern:** shadcn/shadcnblocks-style admin dashboard  
**Backend boundary:** Brain Core API only  
**Default port:** `4881`  
**Brain Core default:** `http://localhost:4877`

## Canonical role

Brain Console is the single leading operations dashboard for the Brain repo.

Legacy dashboards are reference-only:

New dashboard feature work belongs in Brain Console and must be backed by Brain Core API contracts.

## Tech stack

Brain Console uses:

- Next.js App Router
- React
- TypeScript
- TanStack Query for auto-refreshing API state
- Zod for runtime API response validation
- Lucide icons
- shadcn/shadcnblocks-style layout primitives
- CSS variables and utility-style class composition

The browser must never run shell commands. Operational actions must go through Brain Core.

## Canonical Agent Mode operations projection

The read-only Agent Mode operations surface is `/agents` in Brain Console and
uses only `GET /agent-mode/console`. The response is the Brain-owned,
versioned `agent-mode-console-v1` projection. Brain Core derives it at request
time from the existing Agent Mode observer and durable StateStore; the browser
never reads SQLite, filesystem state, AWS, or model providers directly.

The projection is bounded to 100 agents, 50 organizations, 100 tasks, 100
runs, 100 attempts, 100 runtimes, 100 budgets, 50 schedules, 50 approvals, 50
failures, 100 evidence references, 100 model resources, and 100 node resources.
Collections use active-before-terminal ordering, then most-recent update, then
stable ID. `freshness.status` explicitly reports `fresh`, `empty`, or
`unavailable`, with StateStore presence and source status.

The response includes bounded Agent Mode/K5 organization and final-result
metadata, K4 task/run/attempt and runtime/model facts when durably known, root
budget reservations/settlement, scheduler metadata, pending Agent Mode review
approvals, evidence IDs/counts, and stable failure reason codes. It never
contains prompts, hidden reasoning, raw provider payloads, credentials,
environment values, or unbounded logs. It creates no Console-owned ledger and
performs no provider/runtime probe, so repeated reads are side-effect free.

The `/agents` page uses the existing `brainCoreRequest()` client, TanStack
Query, Zod validation, Lucide icons, and the existing compact tabbed layout.
Loading, fresh, stale, offline/error, and empty states are distinct. U0-A and
U0-B remain read-only: lifecycle controls, notification mutations, and
currently unavailable Jarvis intake/node/worktree/quota inventory are deferred
to later U0 slices. Legacy `/agent-console` remains compatible and continues
to include its legacy summary adapter; it is not the canonical Agent Mode
projection.

## Agent Mode detail drill-down

U0-B adds one canonical detail route:

```text
GET /agent-mode/console/detail/:kind/:id
```

The versioned `agent-mode-console-detail-v1` response is derived from the same
durable observer/StateStore authority as the summary projection. Its closed
detail kinds are agent, task, run, attempt, organization, budget, schedule,
failure, and evidence. Every list is bounded and deterministically ordered;
freshness, not-found, and unavailable states are explicit. Evidence is limited
to safe metadata and references, never raw bodies. The route does not create a
Console ledger, read SQLite in the browser, call providers, or mutate runtime
state.

Stable IDs on `/agents` open an ephemeral read-only detail panel with safe
cross-links between ownership objects and visible stale/error/loading states.
No lifecycle, approval, budget, scheduler, spawn, retry, or model controls are
present in U0-A/U0-B. U0-C1 adds the shared Brain Core lifecycle/review control
service and CLI composition. U0-C2 and U0-C3B below provide the authenticated
server-to-server and local-operator boundaries required before the browser can
request the two promoted Agent Mode control paths; all other control surfaces
remain contained.

## U0-C1 control boundary

`AgentModeControlService` is the canonical Brain-owned domain seam for bounded
pause, resume, cancel, kill, and review-decision commands. It composes the
existing StateStore/K4 lifecycle and review authority, persists bounded
operation receipts in the existing Agent Mode events stream, and never creates
a Console-owned ledger. Resume and kill require verified durable runtime
identity; kill does not accept arbitrary process identifiers and does not
blindly redeliver a signal after a durable signal receipt.

The CLI lifecycle commands use this service. Network and Console mutation
surfaces were intentionally deferred at the U0-C1 boundary because the
repository had no usable authenticated HTTP service identity; localhost,
Origin, or caller-supplied headers are not authorization. Evidence:
`operations/reports/agent-mode-u0-c1-guarded-controls-evidence-2026-09-14.md`.

## U0-C2 server-to-server Agent Mode mutation authentication

Canonical BS0.5 — **Create the contract registry** — remains complete; it is
not relabeled to absorb this work. U0-C2 adds the distinct versioned
`brain-service-auth-v1` HMAC boundary for Brain Core service-to-service calls.
The server-only `BRAIN_CORE_SERVICE_ID` and `BRAIN_CORE_SERVICE_SECRET`
configuration grants only `agent-mode.control`. Signed protocol, identity,
method, exact pathname, request ID, freshness timestamp, and body digest are
verified before bounded request-body read, then typed commands are delegated to
the existing `AgentModeControlService`.

Only the Agent Mode run and review control paths are promoted. The authenticated
service actor is derived by Brain Core; caller actor/PID/signal/model/retry
fields are rejected, mutation responses do not enable wildcard CORS, and all
other high-impact mutation routes remain contained. No browser signing, Console
mutation UI, provider probe, runtime dispatch, or secret exposure is part of
U0-C2. Evidence:
`operations/reports/agent-mode-u0-c2-service-identity-evidence-2026-09-14.md`.
Exact next slice: **U0-C3 — Brain Console Guarded Mutation Proxy and
Lifecycle/Approval Controls**.

## U0-C3A operator-boundary audit and server-only control client

The existing Brain Console has no middleware, session, operator identity,
CSRF/session binding, server action, or authoritative human/browser
authentication design. Its operator boundary is therefore classification
**C — no authenticated operator/session boundary exists**. Localhost, Origin,
Referer, CORS, CSRF alone, browser IDs, and caller-supplied actors are not
authentication.

U0-C3A intentionally does not create an unauthenticated power proxy or invent
OAuth/password identity. It adds only the server-only
`lib/braincore-control-server.ts` helper, protected by `server-only`. The helper
reads the server-held `BRAIN_CORE_SERVICE_ID` and
`BRAIN_CORE_SERVICE_SECRET`, signs the existing `brain-service-auth-v1`
contract, sends bounded Agent Mode lifecycle/review bodies, and parses strict
bounded responses. It is not imported by client components, and its secret,
HMAC, and headers do not cross the browser boundary.

No same-origin mutation route or lifecycle/review control is enabled. The
`/agents` read-only surface remains available without mutation credentials.
The exact next bounded task is **U0-C3B — Authenticated Operator Session and
Console Control Admission**. Evidence:
`operations/reports/agent-mode-u0-c3-console-guarded-controls-evidence-2026-09-14.md`.

## U0-C3B authenticated operator session and guarded Console controls

The U0-C3A audit classified the missing existing operator boundary as C: no
Brain Console Ory/Clerk/session integration or compatible cookie contract was
present. U0-C3B uses the bounded local fallback protocol
`brain-console-operator-v1`, not an invented multi-user identity platform. The
Console server reads `BRAIN_CONSOLE_OPERATOR_ID` and
`BRAIN_CONSOLE_OPERATOR_SECRET` from server-only configuration, and issues an
eight-hour maximum signed session cookie. The signing key is HKDF-derived with
purpose separation, the cookie is HttpOnly, SameSite=Strict, `/api` scoped,
and carries a session-bound CSRF nonce. No secret is returned to or bundled in
the browser; stateless logout clears the cookie and does not claim revocation
of a copied token.

The same-origin, loopback-only proxy accepts only bounded Agent Mode run and
review commands and forwards them through the existing server-only
`brainCoreControlRequest()` HMAC client. The UI exposes pause, resume, cancel,
kill, approve, and reject with confirmation for destructive/review actions,
stable operation IDs per mounted intent, no optimistic state, and no automatic
mutation retry. Brain Core remains authoritative for lifecycle, runtime
identity, cancellation, kill, review, and all K4 policy checks; unknown action
and browser authority fields are rejected before delegation. Existing
projection/detail reads remain read-only and unrelated Core mutation routes
remain contained.

Evidence: `operations/reports/agent-mode-u0-c3b-operator-session-controls-evidence-2026-09-14.md`.
The next bounded U0 gap is **U0-D — Agent Mode Control Audit, Evidence, and
Operator Session Hardening**; do not start it automatically.

## U0-D control audit and operator session hardening

U0-D is **COMPLETE** for the bounded local-operator audit and session-hardening
gate; U0-C is complete and U0 remains **IN PROGRESS**. The existing
`AgentModeControlService` receipt/event stream is the sole control-audit
authority. Receipts retain bounded operator attribution separately from the
authenticated Brain Core service actor. The Console projection exposes at most
100 audit entries and run detail at most 50, with action, target, outcome,
reason code, receipt reference, operator ID, service actor, and kill signal
metadata only. Session audit hashes are intentionally omitted from the Console
projection; CSRF values, cookies, secrets, PIDs, prompts, reasoning, provider
payloads, and raw logs never cross the boundary.

The six existing controls are unchanged: pause, resume, cancel, kill, approve,
and reject. The server-only Console proxy injects operator attribution only
after verifying the finite local session and then signs the existing
`brain-service-auth-v1` request. Brain Core remains authoritative for all
runtime identity, kill, cancellation, review, deadline, and idempotency checks.
No direct browser authority or second ledger is introduced.

The local session boundary requires direct loopback transport, an exact Host
match, same-origin Origin, session cookie, and matching CSRF nonce. With no
trusted proxy configured, any forwarded header is rejected. Login failures are
bounded by a five-failure short cooldown; cookies are finite HKDF/HMAC-signed,
HttpOnly, SameSite=Strict, and `/api` scoped. Logout is stateless cookie
clearing under the current local-only threat model; a revocation ledger is not
claimed. Evidence:
`operations/reports/agent-mode-u0-d-control-audit-session-hardening-evidence-2026-09-14.md`.
The next U0 task is to inspect remaining roadmap gaps and define one bounded
slice; do not start it automatically.

## Design reference

Use the shadcnblocks admin dashboard pattern as the visual reference:

```text
https://shadcnblocks-admin.vercel.app/ecommerce/dashboard-1
```

The intended style is:

- compact admin dashboard density
- clear left navigation
- calm dark cards
- tabbed views inside major sections
- small badges
- strong alignment
- fixed gutters
- no overlapping text, buttons, panes, cards, or pagination controls

Do not build long vertical dashboards when a tabbed or paged view is more appropriate.

## Layout rules

All Brain Console pages must follow these rules:

1. **No accidental overlap**
   - Cards may not cover pagination.
   - Buttons may not overflow cards.
   - Labels may not overlap badges.
   - Sidebar brand text may not squash the logo.

2. **Use page-local tabs for dense sections**
   - Prefer tabs for alternate views inside a menu item.
   - Example: Local Apps uses `Apps`, `Actions`, and `Policy` tabs.

3. **Use pagination for dense grids**
   - Dense operational grids should use explicit page controls.
   - Do not require dragging through a long card stack on desktop.

4. **Constrain cards**
   - Cards need deterministic header, metadata, body, and action rows.
   - Action buttons should stay visible inside the card.

5. **Responsive behavior**
   - Desktop/laptop: use compact multi-column grids.
   - Tablet: reduce columns.
   - Mobile: stack cards and allow vertical flow.
   - Mobile must remain usable, but desktop must not require scrolling just to find card actions.

6. **Typography**
   - UI labels should be compact and readable.
   - Code, IDs, logs, ports, and generated data should use:

```text
JetBrainsMono Nerd Font, JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace
```

## Local Apps layout contract

The Local Apps view is intentionally page-based.

Desktop/laptop behavior:

- 4 apps per page
- 2 columns × 2 rows
- horizontal pager below the grid
- running apps sorted first
- no vertical card stack in the main desktop view
- Open, Start/Restart, and Stop buttons visible inside every card

Responsive behavior:

- under narrower breakpoints, the grid can reduce to one column
- mobile may scroll vertically, but card contents still cannot overlap

The Local Apps page uses Brain Core endpoints only:

```text
GET  /local-apps/dashboard
GET  /local-apps/action-readiness
GET  /local-apps/actions/status
POST /local-apps/:id/start
POST /local-apps/:id/stop
POST /local-apps/:id/restart
```

## Operational lifecycle boundary

Brain Core owns lifecycle safety:

- per-app action locks
- start/restart/stop execution
- stale port handling
- service port verification
- database/container phase handling where modeled
- action readiness and action result reporting

Brain Console only renders the state and invokes Brain Core actions.

## Validation

Before marking any Brain Console change complete, run:

```bash
cd projects/brain-core
npm run typecheck

cd ../brain-console
npm run typecheck
npm run build
```

A UI-only change may skip Brain Core typecheck only when it does not touch Brain Core schemas, API contracts, registry data, or operational docs.

## Documentation index

Related docs:

- `docs/system/brain-console-roadmap.md`
- `docs/system/brain-console-design-system.md`
- `docs/system/brain-console-implementation-plan.md`
- `docs/system/brain-console-phase-1-parity-checklist.md`
- `docs/system/brain-console-local-apps-hardening.md`
- `operations/runbooks/brain-console-manual-qa.md`
