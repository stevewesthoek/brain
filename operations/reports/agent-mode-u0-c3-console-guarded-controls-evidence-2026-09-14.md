# Agent Mode U0-C3 Console Guarded Controls Evidence

Date: 2026-09-14
Starting HEAD: `e357c93c feat(agent-mode): authenticate service control requests`

## Decision and operator-boundary classification

U0-C3 was audited against the complete `projects/brain-console` tree and the
Brain Console security/architecture documentation. No middleware, authenticated
session, operator identity, cookie/session binding, CSRF/session mechanism,
server action, or authoritative human-authentication design exists. The
browser-to-Console boundary is therefore classification **C — no authenticated
operator/session boundary exists**.

Localhost, `127.0.0.1`, Host, Origin, Referer, CORS, a CSRF token alone,
browser-generated IDs, and caller-supplied `x-user`/`x-actor` values are not
operator authentication. U0-C2's Brain Console-server-to-Brain-Core service
identity is a separate trust boundary and does not authenticate a human.

Because the operator boundary is absent, U0-C3 did not invent OAuth, password
storage, or a broad identity system. It did not add an unauthenticated
same-origin power proxy, browser signing, lifecycle buttons, review buttons, or
functional mutation routes. The bounded result is **U0-C3A COMPLETE** while
U0-C remains **IN PROGRESS**.

## Server-only Brain Core control client

`projects/brain-console/lib/braincore-control-server.ts` adds the independently
testable `brainCoreControlRequest()` helper. It begins with the Next.js
`server-only` marker and is not imported by any client component. It:

- reads `BRAIN_CORE_SERVICE_ID` and `BRAIN_CORE_SERVICE_SECRET` only on the
  Console server;
- accepts only the exact Agent Mode run/review control path shapes;
- validates strict bounded lifecycle/review bodies with no actor, PID, signal,
  retry, model, credential, or arbitrary authority fields;
- computes the exact JSON body SHA-256 digest;
- generates a request ID and timestamp (with deterministic test injection);
- signs the existing `brain-service-auth-v1` method/path/request/timestamp/
  content contract using HMAC-SHA256; and
- sends the request to Brain Core and parses strict bounded result/error
  responses.

Missing service identity, invalid path/body, oversized body, malformed Brain
Core response, timeout, and transport failure fail closed with bounded error
codes. The helper never returns the service secret, HMAC key, or signed auth
headers to a client component. The existing `brainCoreRequest()` remains the
read-only browser client; no second browser HTTP client was introduced.

The strict response contract covers the existing U0-C1 outcomes:
`completed`, `already_applied`, `conflict`, `stale`, `re_admission_required`,
`runtime_identity_unverified`, `not_found`, `forbidden`, `unavailable`, and
`uncertain`, plus bounded receipt/signal metadata and bounded error responses.

## Proxy and control decision

No `app/api` route, middleware, server action, cookie, operator claim, CSRF
token, mutation hook, or control UI was added. Consequently:

- no browser request can use the server-held Brain Core credential;
- no cross-site mutation can reach Brain Core through a Console proxy;
- no automatic mutation retry or optimistic authority exists;
- `/agents` and U0-A/U0-B read-only views remain credential-free; and
- existing Brain Core direct unsigned mutations remain denied by U0-C2.

Pause, resume, cancel, kill, approve, and reject remain available only through
the existing U0-C1 service/CLI and authenticated U0-C2 server-to-server
boundary. Their runtime identity, process/PID, kill, review, self-approval,
durable receipt, idempotency, stale-state, restart, and unrelated-route
containment authority was not weakened.

## Validation evidence

The Brain Console server-only control/schema tests passed **7/7** under the
React Server package condition. They prove exact signing headers and body
digest construction, strict response parsing, missing-identity fail-closed
behavior before fetch, invalid path/body rejection, malformed response
rejection, and no secret in request body/headers.

The existing Brain Console Agent Mode schema tests passed in the same run. The
U0-C1/U0-C2 Brain Core focused suite passed **24/24**; the direct Agent Mode/K4
regression suite passed **409/409**; the combined Agent Mode/security
containment regression suite passed **423/423**; and the K3.5 review
regression passed **17/17**. Brain Core typecheck and build passed. Brain
Console typecheck and production build passed after the server-only helper was
added.

The production client boundary scan found no `BRAIN_CORE_SERVICE_SECRET`, test
secret, HMAC signer, or signed-header construction in `.next/static`. The
server-only helper appears only in server-side source/test imports. No browser
signing path exists.

No live model, ModelGateway, provider, AWS, Harness, BrainNode, Workcell,
repository, scheduler, budget, Agent, Task, Run, Attempt, or external network
effect was introduced. No unrelated Brain Core mutation route was unlocked.

## Status and next task

```text
U0-C3A: COMPLETE — server-only Brain Core control client and operator-boundary audit
U0-C:  IN PROGRESS — authenticated operator/session boundary is still missing
U0:    IN PROGRESS
```

Exact next bounded task: **U0-C3B — Authenticated Operator Session and Console
Control Admission**. It must establish an authoritative human/operator
identity and CSRF/session-binding design before functional browser mutation
controls or a same-origin Brain Core service proxy are enabled.
