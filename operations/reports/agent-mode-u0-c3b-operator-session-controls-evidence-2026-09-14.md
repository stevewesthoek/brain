# Agent Mode U0-C3B Operator Session and Console Controls Evidence

**Date:** 2026-09-14
**Starting HEAD:** `65ff9db7 feat(brain-console): add server control boundary`
**Scope:** U0-C3B only; no K0-K5 reopening, live model call, Harness launch,
BrainNode operation, Workcell, deployment, or unrelated-worktree cleanup

## Reconciliation

U0-A, U0-B, U0-C1, U0-C2, and U0-C3A were present and complete. K4 and K5
were complete. K4 remains authoritative for Agent Mode lifecycle, runtime
identity, cancellation, kill, review, budget, and policy decisions. The K5
three-worker organization/final-result implementation remains intact.

The U0-C3A audit classified the existing operator boundary as **C**: the
Brain Console had no usable Ory/Clerk SDK integration, compatible session
cookie, middleware, or other authenticated human/operator contract. The Ory
runbook is a generic infrastructure/integration reference, not a Brain Console
session implementation. This slice therefore uses the explicitly bounded
single-operator fallback rather than inventing a multi-user identity system.

## Operator session contract

`brain-console-operator-v1` is implemented in the server-only
`operator-session-server.ts` module and session route:

- configuration is server-only `BRAIN_CONSOLE_OPERATOR_ID` and
  `BRAIN_CONSOLE_OPERATOR_SECRET`; no real secret is committed;
- login is `POST /api/operator/session`, session inspection is `GET`, and
  logout is `DELETE`;
- the session cookie is signed with an HKDF-SHA256 purpose-separated key and
  HMAC-SHA256 payload signature;
- session lifetime is finite and capped at eight hours;
- the cookie is HttpOnly, SameSite=Strict, scoped to `/api`, and never contains
  the operator secret;
- each session carries a bounded CSRF nonce; logout clears the stateless
  cookie. This does not claim retroactive revocation of a copied token;
- login failures are generic and bounded, while missing configuration is an
  explicit unavailable response;
- session and control requests accept only loopback transport with consistent
  forwarding headers.

Tampered, expired, malformed, and differently keyed cookies fail closed. The
server tests also verify that the configured secret is absent from response
bodies and cookie values.

## Control admission and Brain Core composition

The same-origin proxy exposes only:

```text
POST /api/agent-mode/control/run/:runId
POST /api/agent-mode/control/review/:reviewId
```

Admission requires loopback transport, same-origin `Origin`, a valid session,
and the exact session-bound `x-brain-console-csrf` nonce. Request bodies are
strict and bounded. Lifecycle actions are only `pause`, `resume`, `cancel`, or
`kill`; review decisions are only `approved` or `rejected` with a bounded
evidence hash. Browser actor, PID, signal, runtime, model, retry, and other
authority fields are rejected before the Core call.

The proxy calls the existing server-only `brainCoreControlRequest()` helper.
That helper alone holds the Brain Core service identity and signs
`brain-service-auth-v1`; the browser never signs requests, sees the service
secret, or calls Brain Core directly. Brain Core now also rejects an unknown
lifecycle action before selecting a control method. All other high-impact Core
routes remain under the existing containment boundary.

The Agents page integrates six read-through controls: pause, resume, cancel,
kill, approve, and reject. Cancel, kill, and review decisions require an
explicit confirmation panel. Mutation requests have no automatic retry or
optimistic domain update, and a mounted target/action intent reuses its stable
operation ID. Successful responses invalidate the existing read projections;
there is no browser authority cache or Console ledger.

## Validation evidence

Focused Console validation: **16/16 pass**. This covers strict session
schemas, signed finite cookies, tamper/expiry/key rejection, generic login
failures, session reconstruction/logout, same-origin and CSRF admission,
unknown/extra-field rejection before Brain Core, and bounded review forwarding.

Brain Core Agent Mode/security regressions after the action-validation cleanup:
**423/423 pass**. The full Brain Core package suite completed **2544/2544
pass**, including K5-C, K5-B, K5-A, K4 dispatch/assignment/reservation,
cancellation/kill/deadline, observer, and security tests. The previously noted
unrelated timing failure did not recur in this run.

Brain Core typecheck: **PASS**. Brain Core build: **PASS**. Brain Console
typecheck: **PASS**. Brain Console production build: **PASS**. The build emitted
only the existing autoprefixer mixed-flex-end warnings; no build artifact is
part of this change. `git diff --check`: **PASS**.

The canonical projection was read from a fresh isolated Core instance 10 times:
**10/10 HTTP 200**. The projection is request-time durable-state observation;
the implementation and tests provide zero runtime/provider/tool effects. No
BrainNode, Workcell, Harness, ModelGateway, AWS, or external network operation
was invoked by the control-boundary tests or projection reads.

## Browser/rendered QA

The freshly built `/agents` page was inspected at desktop width. The existing
navigation remains usable; the Agents entry is visible; the operator-session
card, sign-in fields, summary cards, tab group, and unavailable/empty state do
not overlap. The operator card clearly presents a Read-Only state until a
valid local session exists. The browser surface shows no control until the
server session query is authenticated. A narrow in-app-browser snapshot of
the existing shell also remained legible; a dedicated viewport override was
not needed or added.

## Security and containment review

Static client-bundle scan found no `BRAIN_CORE_SERVICE_SECRET`,
`BRAIN_CONSOLE_OPERATOR_SECRET`, fixture secret, HMAC implementation, or
server-only control module in `.next/static`. Client components do not import
the server-only session, proxy, or Core control modules. The response contract
contains no prompt, hidden reasoning, provider payload, credential,
environment, PID, signal, or raw runtime output.

No second Task/Run/Attempt/result ledger, provider probe, scheduler mutation,
budget mutation, runtime call, model call, Harness launch, BrainNode operation,
Workcell operation, repository mutation, or network side effect was added.
K4 control service, StateStore, runtime identity, review authority, and
containment remain the only mutation authorities.

## Decision

**U0-C3B: COMPLETE** for the bounded authenticated local-operator gate.
**U0-C3: COMPLETE.**
**U0: IN PROGRESS.**

This does not claim Ory/Clerk integration, multi-user identity, revocation
storage, notifications, Jarvis chat/intake, or broader authorization. The
exact next bounded slice is **U0-D — Agent Mode Control Audit, Evidence, and
Operator Session Hardening**. Do not start it automatically.
