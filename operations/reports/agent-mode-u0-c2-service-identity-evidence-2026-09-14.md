# Agent Mode U0-C2 Service Identity Evidence

Date: 2026-09-14
Starting HEAD: `d20daff9 feat(agent-mode): centralize guarded lifecycle controls`

## Scope and reconciliation

U0-C2 is complete for the authenticated server-to-server Agent Mode mutation
boundary. K4 remains complete and authoritative for lifecycle, runtime,
budget, cancellation, kill, and review state. U0-C1 remains the Brain-owned
`AgentModeControlService` domain seam; this slice composes it and does not add
a second control plane, Console database, runtime ledger, or browser authority.

Canonical BS0.5 — **Create the contract registry** — remains complete and was
not reopened or renamed. BS0.1's residual finding was narrower: the repository
had no usable authenticated HTTP service identity. U0-C2 resolves that U0
prerequisite separately as `brain-service-auth-v1`.

## Service identity contract

Brain Core loads a bounded server-only identity from
`BRAIN_CORE_SERVICE_ID` and `BRAIN_CORE_SERVICE_SECRET`. Missing configuration
fails closed. The configured identity receives exactly the
`agent-mode.control` capability; no wildcard capability is accepted. The
secret is never placed in source fixtures, browser code, URLs, response
bodies, logs, or the trusted actor payload.

Each request carries version, service ID, request ID, timestamp, content
SHA-256, and signature headers. The HMAC-SHA-256 input canonically binds:

- `brain-service-auth-v1`;
- service identity;
- HTTP method;
- exact URL pathname;
- request ID;
- request timestamp; and
- body content digest.

Signature comparison uses `timingSafeEqual` after equal-length validation.
Timestamp freshness uses an injected clock in tests and a maximum 60-second
clock skew. Request ID and operation ID provide deterministic redelivery
identity at their respective boundaries; repeated valid control operations
are handled by the existing durable U0-C1 receipt idempotency.

Authentication and capability admission occur before request-body read. Only
after that gate does Brain Core read a bounded 16 KiB JSON object, recompute
the body digest, and compare it to the signed digest. Body fields are an exact
allowlist: lifecycle commands accept schema version, operation ID, action, and
reason; review commands additionally accept decision and evidence hash. Actor,
PID, signal, model, retry, credential, and arbitrary authority fields are not
accepted.

## Promoted and contained routes

Only these POST routes are promoted after authentication:

- `/agent-mode/control/run/:runId`
- `/agent-mode/control/review/:reviewId`

They derive the trusted service actor from the authenticated service ID and
call `AgentModeControlService`. Existing process-identity checks, kill signal
receipt semantics, cancellation authority, review validation, and worker/model
self-approval restrictions remain in force. Repeated pause control returned
the existing `already_applied` result and left one durable receipt after
restart.

The whole `/agent-mode/control` namespace remains contained by default, so
unknown control paths cannot fall through to ordinary POST routing. All other
`isContainedHighImpactMutation()` routes, including credentials, publishing,
deployment, local-app, webhook, and legacy approval paths, remain fail-closed
and do not read their bodies. Authenticated headers do not unlock them.
Agent Mode mutation responses do not advertise wildcard CORS; the preflight
response likewise does not advertise POST or an origin.

## Validation evidence

The focused U0-C2/auth-control set passed **24/24** tests. It covers HMAC
identity, timing-safe signature comparison, unknown/missing/malformed/stale/
future/tampered requests, method/path binding, explicit capability denial,
pre-body rejection, body digest integrity, trusted actor derivation,
idempotent lifecycle control, caller-field rejection, CORS containment, and
unrelated-route containment.

The Agent Mode/K4 regression set passed **417/417** tests, including U0-C1,
K5, observer, assignment, reservation, D1 dispatch, cancellation, kill,
deadline, uncertainty, and no-replay coverage. The K3.5 review regression set
passed **4/4** tests, including independent review and self/model approval
rejection. Brain Core typecheck passed.

No model, ModelGateway, Bedrock, MiniMax, GLM, Opus, Codex, Harness,
BrainNode, Workcell, provider, network, repository, budget, Agent, Task,
Run, or Attempt effects were introduced by request authentication. K4 and the
existing control service remain the only execution/state authorities.

## Status and next slice

**U0-C2 COMPLETE.** U0 remains **IN PROGRESS**. Human/browser authentication
and a same-origin server-held Console mutation proxy are intentionally not
part of this slice.

Exact next bounded task: **U0-C3 — Brain Console Guarded Mutation Proxy and
Lifecycle/Approval Controls**. Do not start it automatically.
