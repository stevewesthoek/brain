# Agent Mode U0-D Control Audit, Evidence, and Operator Session Hardening

Date: 2026-09-14
Starting HEAD: `1c5aaead feat(brain-console): authenticate guarded agent controls`
Branch: `codex/cloudflare-tooling-normalization`

## Decision

U0-D is complete for the bounded local-operator audit and session-hardening
gate. U0-C is complete. U0 remains in progress. The implementation preserves
Brain Core and the existing Agent Mode StateStore as authority; it adds no
second control, lifecycle, result, budget, or session-revocation ledger.

The earlier U0-C3A classification remains valid: before U0-C3B there was no
authenticated operator/session boundary in the existing Brain Console tree
(classification C). U0-C3B supplied the deliberately narrow local fallback
`brain-console-operator-v1`. U0-D hardens and audits that boundary; it does not
claim Ory/Clerk, multi-user IAM, public exposure, or copied-token revocation.

## Durable audit contract

`AgentModeControlService` receipts in the existing Agent Mode `events` stream
now retain bounded `operatorId` and a SHA-256 session audit ID separately from
the authenticated `serviceActor`. The server-only Console proxy derives this
metadata from the verified session after browser admission and before signing
the existing `brain-service-auth-v1` request. Browser bodies cannot provide
actor, PID, runtime, model, or operator authority.

The observer derives a bounded `controlAudits` projection from receipt and
signal events. The canonical Console projection exposes at most 100 entries;
run detail exposes at most 50 matching entries. Exposed fields are action,
target, status, reason code, receipt reference, operator ID, service actor,
occurrence time, and bounded kill identity/signal facts. Session audit hashes,
CSRF values, cookies, secrets, PIDs, prompts, hidden reasoning, provider
payloads, and raw logs are not projected.

The six existing controls remain the same Brain-owned paths: pause, resume,
cancel, kill, approve, and reject. Core continues to enforce runtime identity,
kill signaling, cancellation, review/self-approval restrictions, deadline,
idempotency, and all other lifecycle authority. The audit path records those
operations; it does not create authority or a replacement runtime ledger.

The durable receipt inventory is:

| Control | Durable reconstruction |
| --- | --- |
| Pause | operator, service actor, operation ID, run target, request time, previous/resulting state, typed reason/result, receipt event |
| Resume | the same fields, with runtime-ownership re-admission evidence and no retry/replacement authority |
| Cancel | the same fields, including durable cancellation result and recovery reason where applicable |
| Kill | the same fields plus the paired signal event's identity-verification and signal outcome |
| Approve | review target, `approved` decision, actor attribution, reason/evidence hash, and review receipt |
| Reject | review target, `rejected` decision, actor attribution, reason/evidence hash, and review receipt |

Review decisions are carried explicitly in the existing versioned control
receipt; lifecycle receipts carry `decision: null`. The observer pairs receipt
and signal events without copying raw request, process, or provider data.

## Session and request hardening

- Session crypto remains finite HKDF/HMAC signing with purpose separation,
  eight-hour maximum lifetime, HttpOnly, SameSite=Strict, and `/api` scope.
- Login errors remain generic. Five failures for one bounded operator ID in a
  30-second window trigger a five-second cooldown; the in-memory bucket is
  capped at 256 entries and is not an authority ledger.
- Logout clears the cookie. Under the current single-operator loopback threat
  model, revocation is intentionally stateless and no copied-token revocation
  guarantee is claimed.
- Login, session, and mutation routes require loopback and an exact direct
  Host match. Because no trusted proxy is configured, any
  `x-forwarded-for`, `x-forwarded-host`, or `x-forwarded-proto` header is
  rejected rather than interpreted.
- Mutation routes additionally require same-origin `Origin`, a verified
  session cookie, the matching session-bound CSRF nonce, strict JSON bodies,
  bounded content length, and contained route/path identifiers.
- Brain Core authenticates the service request before body read, checks its
  signed digest, and then validates operator attribution shape and bounds.

## Adversarial control audit

Lost responses are safe because the operation ID and canonical command hash are
durable; resubmission returns the existing receipt and does not repeat a
lifecycle mutation, review decision, or kill signal. Conflicting material under
one operation ID fails closed. Different operation IDs race through the Brain
Core StateStore transaction and current lifecycle/review state; there is no
browser last-write-wins layer or client-side authority. The Console does not
retry mutations automatically, so a stale client can only receive Brain's
typed stale/conflict/forbidden result.

The kill path contains no browser PID, PGID, signal, or executable selector.
Brain Core looks up the recorded runtime identity and signals only after exact
identity verification; a durable signal receipt prevents redelivery. Resume
never creates a process, Task, Attempt, or replacement worker when ownership is
absent. Approve/reject remain pending-review operations, and existing worker or
model self-approval restrictions remain enforced.

After close/reopen, receipt and signal events reconstruct the operation, target,
service actor, operator attribution, review decision, and signal outcome. Two
authenticated Console clients observe the same durable audit projection; a
stale client cannot manufacture an accepted audit entry. Unauthenticated and
transport/CSRF denials are not written to the Agent Mode domain event ledger,
avoiding brute-force event amplification.

## Validation matrix

The focused Core set passed 26/26, including service-actor/operator receipt
attribution, observer audit derivation, redaction, canonical projection/detail,
and authenticated control-route rejection. The focused Console set passed
19/19: six schema/projection tests, three server-only Core-client tests, and
ten operator-session/proxy tests. The server-only tests were run with a
test-only module shim for the Next `server-only` package; the production
boundary itself was verified by the Next build.

Covered hardening cases include tampered/expired/re-keyed sessions, generic
login failure, bounded login cooldown, loopback/Host/forwarded-header/origin
admission, CSRF denial, strict browser authority-field rejection, review
forwarding, session-derived operator attribution, receipt persistence, and no
downstream call on denial. The schema rejects unknown control actions/statuses
and rejects attempts to expose a session audit field in the Console projection.

The pre-existing U0-C/K4 control tests remain green, including runtime identity
checks, kill signal idempotency, no blind resume/replacement, review authority,
and service-auth containment. The full Brain Core suite passed 2,544/2,544
tests with zero failures, skips, or cancellations; the three historical
`agent-orchestrator` timing failures did not recur. No model, Harness,
provider, BrainNode, Workcell, network, repository, scheduler, budget, Agent,
Task, Run, or Attempt side effect is introduced by U0-D.

`npm run typecheck` and `npm run build` pass in both `projects/brain-core` and
`projects/brain-console`. The Console build emits only the existing CSS
autoprefixer warnings. `git diff --check` passes. No `.next`, node_modules, or
protected unrelated path is staged.

## U0-C closure matrix

All U0-C closure items A–T pass: (A) the Brain-owned control service exists;
(B) CLI and HTTP share it; (C) service requests authenticate; (D) the
`agent-mode.control` capability is bounded; (E) the operator session is
authenticated; (F) CSRF/provenance is enforced; (G) the Core service secret is
server-only; (H) the operator secret is server-only; (I) pause is safe and
idempotent; (J) resume preserves runtime ownership; (K) cancel is durable and
idempotent; (L) kill preserves exact process identity; (M) approve/reject use
review authority; (N) self/model approval remains impossible; (O) stale browser
state is non-authoritative; (P) lost responses do not replay; (Q) control
evidence is durable; (R) service actor is reconstructible; (S) operator
attribution is reconstructible for authenticated Console controls; and (T)
unrelated high-impact routes remain contained.

## Remaining roadmap state

Roadmap status is U0-D COMPLETE, U0-C COMPLETE, and U0 IN PROGRESS. The next
step is not started by this slice: inspect the remaining U0 gaps and authorize
one bounded follow-up covering the still-unsurfaced Jarvis intake,
notifications, and richer node/worktree/quota visibility as appropriate. No
U0-E implementation is assumed here.

Remaining priority order is: (1) operationally useful missing visibility such
as Jarvis/root intake metadata and richer node/worktree/Codex-quota surfaces
where canonical durable state exists; (2) durable unread notifications and
escalations; (3) a final U0 exit audit. Multi-user IAM, Ory/Clerk integration,
remote/public deployment, and server-side session revocation remain outside the
current bounded loopback single-operator threat model.
