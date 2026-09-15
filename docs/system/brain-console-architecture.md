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
U0-B are the read-only projection/detail foundations; guarded lifecycle and
review controls are defined below, and individual notification acknowledgement
is covered by U0-F. Legacy `/agent-console` remains compatible and continues
to include its legacy summary adapter; it is not the canonical Agent Mode
projection.

### U0-E resource visibility

The `agent-mode-console-v1` contract now includes bounded `rootGoals`,
`workcells`, and `executionResources` collections, in addition to the existing
separate runtime, model, and node-resource collections. Root Goals derive
Jarvis/supervisor ownership and root policy/deadline/budget facts from durable
Agent Mode state. Workcells derive safe repository reference, branch/base,
owner, lifecycle, current lease metadata, latest validation, diff metadata,
and durable review/commit/merge status from the existing observer. Absolute
paths, lease fences, raw diffs, prompts, provider payloads, and credentials are
not part of this API.

The `/agents` page exposes Roots, Workcells, and Resources tabs as read-only
operational views. New collections are capped at 100 and ordered active before
terminal, newest updated first, then stable ID. Missing host, runtime, model,
execution-resource, Codex quota, or Jarvis intake facts are shown as
unavailable/not yet surfaced rather than synthesized or probed. The projection
performs no AWS/provider/SSH/Tailscale/BrainNode/Harness calls and adds no
Console database or inventory ledger. StateStore reopen and independent API
callers reconstruct the same domain state; generated timestamps are request
metadata only.

### V0-C Jarvis response visibility

The current voice work has a narrow Brain Core response boundary, not a Console
speech player. `GET /agent-mode/jarvis/responses/:rootGoalId` exposes only a
bounded, immutable `agent-mode.jarvis-user-response.v1` record after a
Brain-owned caller has published Jarvis text against an authoritative K5
organization final-result reference. It does not expose raw worker results,
prompts, reasoning, provider payloads, credentials, or evidence bodies.

V0-C1 provides the canonical Brain-owned deterministic response-generation and
finalization producer. V0-C2 adds the read-only page's client-local speech
effect: it fetches that response through Brain Core, validates the closed
schema, and uses browser `SpeechSynthesis` with exact response text. The
versioned speech request/receipt identity is derived from response identity and
transport version; playback is explicitly interruptible and a late callback
cannot defeat an interrupt.

No TTS provider credential, server playback ledger, audio file, provider probe,
model/runtime call, network effect, or Brain lifecycle mutation is introduced.
Unsupported speech is shown as unavailable, and re-speaking reuses the same
canonical response rather than replaying any worker or K5 operation. The
`/agents` surface remains an observer with no voice control mutations. The
V0-D exit audit confirms the complete typed/voice gateway over durable
Jarvis/K4/K5 state, replaceable STT/TTS transports, structured response/evidence
references, transport-only interruption, and explicit denial of voice control
phrases. No live provider, network, lifecycle, or browser-authority effect is
introduced. V0 is **COMPLETE**; browser/OS SpeechSynthesis remains privacy
classification B and physical audible acceptance is a manual device check.
Exact next phase: **Phase D0 — distribution and always-on options**; do not
start it automatically.

### D0-A portable Core configuration boundary

D0-A defines the host-neutral `brain-runtime-config-v1` contract for the
deployable Core and its Console/Core URL boundary. Portable and host-local JSON
profiles layer over safe defaults, followed by known environment overrides;
secret material remains server-local and is never sent to the browser. Core
defaults derive runtime/SQLite/BrainNode paths from `HOME` or explicit
configuration and do not require Office, MacBook, Mind, Bible Studies,
FluidVoice, Video Orchestrator, or personal provider paths.

The browser continues to know only the configured public Core URL where needed;
filesystem roots, service/operator secrets, node secrets, AWS identity, and
provider credentials remain server-side. Configuration validation is read-only
and performs no provider/network/runtime probe. Missing optional voice/model/node
capabilities are reported unavailable while the lean Core remains bootable.
The current `NEXT_PUBLIC_BRAIN_CORE_URL`/server-side `BRAIN_CORE_URL` Console
configuration remains compatible; installer/bootstrap and deployment packaging
are later D0 work. Exact next bounded slice: **D0-B — Reproducible Lean-Core
Bootstrap and Dry-Run Installer**; do not start it automatically.

### D0-B reproducible bootstrap boundary

D0-B adds the Brain Core-owned `brain-bootstrap-plan-v1` dry-run contract and
CLI for a future portable installation workflow. It describes fixed Core and
Console lockfile/build actions, source/release provenance, safe install/state
layout, startup/smoke checks, and an explicit `not-installed` service plan.
Brain Console is not an installer: no package command, file staging, service
registration/start, provider probe, runtime launch, or browser-side filesystem
operation occurs. Optional staging, rollback execution, and deployment
packaging remain later D0 work. The exact next bounded slice is **D0-C —
Portable Runtime Packaging Contract**; do not start it automatically.

### D0-C portable runtime package boundary

Brain Console production packaging uses narrowly enabled Next
`output: 'standalone'`. The package builder copies only the generated traced
standalone runtime, required `.next` server assets, `.next/static`, and
existing `public` assets; `.next/cache`, traces, source, and checkout metadata
are excluded. A real staged package served `/agents` from an isolated root
with no source-checkout fallback. Generated absolute build paths are sanitized
in staged text artifacts and the verifier rejects remaining personal paths.

Core remains a prebuilt `dist` runtime with package/lockfile metadata for
deterministic production dependency hydration; it is not falsely advertised as
self-contained. `brain-runtime-package-v1` is verified by an exact bounded
file manifest, hashes, sizes, package identity, and manifest hash. D0-C still
does not install, start/register services, or deploy; the next bounded task is
**D0-D — Local macOS/Linux Runtime Installation and Service Packaging
Contract**.

## Agent Mode detail drill-down

U0-B adds one canonical detail route:

```text
GET /agent-mode/console/detail/:kind/:id
```

The versioned `agent-mode-console-detail-v1` response is derived from the same
durable observer/StateStore authority as the summary projection. Its closed
detail kinds are root, agent, task, run, attempt, organization, workcell,
budget, schedule, failure, and evidence. Every list is bounded and
deterministically ordered;
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

## U0-F operator attention and unread notifications

U0-F adds bounded durable attention state without creating a Console database
or a second Agent Mode result/approval ledger. Brain's existing StateStore is
the source for immutable escalation records, immutable notification references,
and operator-keyed notification read receipts. A bounded explicit
`reconcileAgentModeAttention()` seam derives attention from canonical uncertain
Attempts, scheduler dead letters, failed Workcell validations, and pending
review requests. Console GETs never invoke reconciliation or write state.

The non-personal `agent-mode-console-v1` response includes bounded attention
metadata. Personalized reads use the versioned authenticated endpoint
`GET /agent-mode/notifications` and individual acknowledgement uses
`POST /agent-mode/notifications/:notificationId/read`. The browser reaches
these only through same-origin Next server proxies. The server derives the
operator identity from the authenticated `brain-console-operator-v1` session;
the browser cannot select an operator. POST requests require the session-bound
CSRF nonce and Brain Core service authentication with the narrow
`agent-mode.notifications` capability. There is deliberately no mark-all,
resolve, approve, retry, or lifecycle action in this slice.

Attention payloads contain only bounded codes, severity, source IDs, lineage
references, timestamps, and read metadata. They exclude prompts, hidden
reasoning, raw provider/runtime payloads, credentials, environment values, and
unbounded logs. `read` is `null` for non-personal projections, and unread
counts are `null` without an operator identity rather than being guessed.
The `/agents` page adds a compact Attention tab with explicit loading,
unavailable, empty, stale, and authenticated-session states. Mark read
invalidates the temporary TanStack Query cache and does not alter source
resolution.

Codex quota remains explicitly unavailable with reason
`no_canonical_durable_source`; U0-F does not probe or scrape a subscription.
Jarvis intake, durable notifications from additional domains, richer node /
worktree inventory, and broader operator controls remain later U0 slices.
Evidence: `operations/reports/agent-mode-u0-f-escalations-notifications-evidence-2026-09-14.md`.
Exact next bounded slice: **U0-G — Unified Brain Console Phase Exit Audit**; do
not start it automatically.

## V0-B Jarvis intake and push-to-talk boundary

V0-B adds the durable `agent-mode.jarvis-text-intake.v1` contract behind
`POST /agent-mode/jarvis/intake`. Brain Core is authoritative: the intake
service atomically records the idempotency/ownership record, deterministic root
task, and persistent Jarvis owner, while retaining only bounded hashes and
references. Typed and voice submissions use the same service. The browser never
chooses operator, root, task, policy, budget, runtime, or model.

The Brain Console server enforces the local signed operator session, same-origin
provenance, CSRF, and loopback transport before proxying the signed Core request.
Push-to-talk transcription uses the local `MlxWhisperSpeechToTextProvider` only
when an absolute executable, local model, and explicit resource lock are
configured. It accepts owner-only temporary WAV files capped at 8 MiB and 30
seconds, runs structured argv with `shell: false`, bounds output and timeout,
and removes temporary audio on success or failure. There is no auto-download,
provider probe, ModelGateway path, or network fallback; live MLX acceptance is
deferred pending safe coordination with the retained Bible Studies pipeline.

The `/agents` page starts the microphone only after an explicit click, keeps the
capture in memory, shows a bounded transcript review, and requires explicit
Submit. It has no voice lifecycle controls, wake word, browser authority, or
raw transcript persistence. V0-B is read/submit ingress only; TTS and
interruptible playback are the next V0 slice.
