# Agent Mode H0-C Security and Live-Acceptance Evidence — 2026-09-17

## Decision

**H0-C: AUDIT COMPLETE. H0: IN PROGRESS; release gate INCOMPLETE.**

This review is against current HEAD `c9b73dfd` (`test(agent-mode): add
wall-clock hardening soak`). The protected unrelated worktree state was
preserved: `operations/accounts/credentials-index.md` was not read or changed,
and the Firecrawl and unrelated roadmap paths were not changed, staged, or
cleaned. No history was rewritten and no external service was contacted.

H0-A and H0-B remain complete for their bounded gates. H0-B's six-hour run is
not relabeled as provider or remote-host acceptance. H0-C adds a test-only
security review contract, performs the safe local current-build checks, and
records exactly which remaining classes require external authorization or are
not safely exercisable.

## Review contract

The test-only `agent-mode.security-release-review.v1` contract has a closed
shape, bounded review IDs/build revisions/findings/evidence references, closed
severity/status vocabularies, and an explicit list of reviewed trust-boundary
surfaces. It is evidence metadata only. It is not imported by production API,
does not add a policy, and cannot grant runtime, provider, tool, repository,
budget, lease, or operator authority.

The contract test covers all ten `liveAcceptanceRequired` H0 classes, requires
non-sensitive bounded evidence references, rejects unknown fields and
incomplete surface coverage, and refuses to pass an open HIGH/BLOCKER finding
or a missing review.

## Trust-boundary review

The current source and focused tests were reviewed across these boundaries:

| Surface | Result |
|---|---|
| Browser / Brain Console | Read-only projection through `brainCoreRequest`; no SQLite, shell, AWS, provider, or browser authority. |
| Console server | Operator identity is server-derived; service secret is server-only; mutation proxy requires loopback, same-origin, session, and CSRF. |
| Core API | Local transport is checked; contained Agent Mode mutations authenticate before body authorization; read projection is GET-only and side-effect-free. |
| Service auth | Versioned HMAC, bounded request timestamp, request identity, content digest, timing-safe comparison, explicit capability allowlist, and no wildcard capability. |
| Operator/control/review | Closed actions, trusted actor derivation, operator attribution, durable idempotency/conflict handling, pending review path, and verified runtime identity. |
| StateStore | Existing durable tables and transaction paths remain authoritative; no H0 result or control ledger was added. |
| Scheduler/lease/fence | Existing K4 monotonic lease/fence and stale-owner denial remain authoritative; H0-B exercised the current implementation in an isolated process. |
| Budget/spawn | Existing atomic K4 admission/reservation, root cancellation/kill/deadline, concurrency, and aggregate budget checks remain authoritative. |
| ModelGateway/AgentRuntime | No new routing or runtime path; unsupported or missing authority fails closed. |
| Restricted Harness / Workcells | Pinned restricted topology, explicit environment/tool allowlist, separate process, and no broadening are covered by existing tests; no live Harness was launched. |
| BrainNode/NodeTransport | Fixed SSH argv, strict host enrollment, negotiated identity/capability, HMAC command proof, receipt lineage, reconnect and dedup remain covered; no node was contacted. |
| Jarvis typed/voice | Bounded authenticated intake and canonical response/speech boundaries do not grant lifecycle authority to caller text, STT, worker, or TTS. |
| D0 relocation | Snapshot ownership, fresh target, path/schema verification, no PID transplant, stale-fence rejection, and uncertain-effect blocking remain covered. |
| H0 fault surfaces | Hardening actions remain test-fixture-only; no public chaos endpoint, environment weakening, or alternate control plane exists. |

No BLOCKER or HIGH finding was identified. The only accepted note is that
provider and remote-host live acceptance need separately authorized disposable
resources; this is an explicit release prerequisite, not a bypass.

## Safe local current-build acceptance

After `npm run typecheck` and `npm run build`, a foreground `node dist/index.js`
was started with a fresh temporary HOME, StateStore directory, and port 4897.
The bounded local probe observed:

- `GET /agent-mode/console`: version `agent-mode-console-v1`, explicit
  `unavailable` freshness for the empty isolated store;
- ten total projection reads: completed successfully, with no runtime,
  provider, scheduler, budget, task, agent, BrainNode, or Workcell mutation;
- unauthenticated `POST /agent-mode/control/run/run:fixture`: HTTP 401,
  `service_identity_missing`;
- the Core process was session-owned and stopped after the probe;
- no Office StateStore, credential file, provider, remote host, SSH/Tailscale,
  service manager, or network outside loopback was used.

This is local security-boundary evidence, not authorization for production
mutation or live-provider testing.

## H0 live-acceptance matrix

The matrix is the complete 15-class H0 inventory. `fixture_pass` and
`wall_clock_pass` are not silently treated as live evidence. For five classes,
H0-C accepts the H0-B current-build isolated-process evidence as class-specific
live process evidence; it does not claim provider, Office, or distributed-host
readiness.

| Fault class | Fixture / wall-clock evidence | Live required | Classification | H0-C live status | Blocker |
|---|---|---:|---|---|---|
| provider_outage | fixture + wall-clock injected transport | yes | EXTERNAL_SENSITIVE | blocked | Real provider outage/recovery requires explicit authorization and disposable provider boundary. |
| bedrock_budget_exhaustion | fixture | no | ALREADY_SATISFIED_BY_H0_B_LIVE_EVIDENCE | not applicable | None; no real Bedrock call is allowed by this slice. |
| codex_quota_exhaustion | fixture | no | ALREADY_SATISFIED_BY_H0_B_LIVE_EVIDENCE | not applicable | None; protected manual Codex reserve remains untouched. |
| host_loss_reconnect | fixture + wall-clock node adapter | yes | EXTERNAL_SENSITIVE | blocked | No second production node or remote host may be exercised without authorization. |
| process_crash_restart | fixture + real isolated process restarts | yes | ALREADY_SATISFIED_BY_H0_B_LIVE_EVIDENCE | live_pass | H0-B recorded three worker generations and durable reopen/reconstruction. |
| stale_lease | fixture + isolated StateStore lease/fence checks | yes | ALREADY_SATISFIED_BY_H0_B_LIVE_EVIDENCE | live_pass | H0-B recorded stale-fence denial and fresh authority behavior. |
| duplicate_delivery | fixture + isolated durable duplicate delivery | yes | ALREADY_SATISFIED_BY_H0_B_LIVE_EVIDENCE | live_pass | H0-B recorded no duplicate effect/settlement or replay. |
| stuck_agent | fixture + isolated stuck-child TTL expiry | yes | ALREADY_SATISFIED_BY_H0_B_LIVE_EVIDENCE | live_pass | H0-B recorded expiry, attention/reconciliation, and released authority. |
| spawn_limit | fixture + wall-clock denial | no | ALREADY_SATISFIED_BY_H0_B_LIVE_EVIDENCE | not applicable | K4 admission remains the authority. |
| sandbox_denial | restricted-profile fixture | yes | UNSUPPORTED | not_run | No safe live restricted-runtime topology is authorized in H0-C. |
| tool_denial | capability fixture | yes | UNSUPPORTED | not_run | No live tool endpoint or repository effect is authorized. |
| corrupted_state | fixture + wall-clock rejection | no | ALREADY_SATISFIED_BY_H0_B_LIVE_EVIDENCE | not applicable | No production state is mutated by corruption checks. |
| accelerated_soak | deterministic fixture | no | ALREADY_SATISFIED_BY_H0_B_LIVE_EVIDENCE | not applicable | Accelerated time is never wall-clock evidence. |
| security | existing negative-boundary tests + current-build local probe | yes | SAFE_LOCAL_LIVE | live_pass | None; no production or external mutation was attempted. |
| auditability | observer + durable StateStore + H0-B reconstruction | yes | ALREADY_SATISFIED_BY_H0_B_LIVE_EVIDENCE | live_pass | Current-build durable references are reconstructible without raw payloads. |

The H0 gate therefore remains `INCOMPLETE`: `wall_clock_pass` does not satisfy
the four external/unsupported live classes, and H0's gate still requires
`live_pass` for every `liveAcceptanceRequired` entry. The H0-C security review
cannot override that requirement.

## Effects and leakage review

Counts for this H0-C work:

| Effect | Count |
|---|---:|
| live model/provider calls | 0 |
| ModelGateway / Bedrock / MiniMax / GLM / Opus / Codex | 0 |
| Harness launches | 0 |
| BrainNode commands | 0 |
| Workcells | 0 |
| external network / SSH / Tailscale | 0 |
| AgentRuntime calls caused by Console reads | 0 |
| scheduler/budget/task/agent mutations caused by reads | 0 |
| repository mutations through Agent Mode | 0 |

A bounded names-only sensitive-pattern scan of the reviewed source, Console,
runbook, architecture, and H0 evidence paths found no hardcoded key, private
key, service secret, raw provider payload, raw prompt, hidden reasoning, or
credential value introduced by H0-C. The credentials index was deliberately
excluded and its contents were not inspected. Console/API projections remain
bounded and redact paths, proof material, prompts, payloads, credentials,
environment values, and raw runtime logs.

## Validation

- H0-C security review contract: **4/4 passed**.
- Focused Core security/control/K4 reservation/spawn/assignment/runtime/
  NodeTransport/Harness/observer/console/hardening suites: **235/235 passed**.
- H0-B wall-clock focused suite recorded: **5/5 passed**.
- Combined H0/K4 focused suite recorded after H0-B: **206/206 passed**.
- Brain Core typecheck: **passed**.
- Brain Core build: **passed**.
- Safe local current-build probe: **passed** (10 reads, 1 rejected mutation).
- H0-B final full Brain Core suite recorded: **2,613/2,613 passed**.
- `git diff --check`: **passed** after the final documentation and source changes.

The H0-B known historical `vo-studio-write` metadata-title mismatch was not
reproduced in its final rerun and remains unrelated to this audit. The six-hour
H0-B soak was not rerun.

## H0-C decision and exact next prerequisite

**H0-C COMPLETE AS AUDIT.** Security review: **PASS**, with no BLOCKER/HIGH
finding. Safe local security and current-build read-boundary acceptance pass.

**H0 remains IN PROGRESS; release gate INCOMPLETE.** The remaining bounded
prerequisite is: separately authorize disposable provider and remote-host
boundaries, then run only the provider-outage and host-loss/reconnect live
acceptance. Sandbox/tool live acceptance remains unsupported/not run until a
safe supported topology exists. No automatic start is permitted.

This does not claim unrestricted autonomy, production unattended operation,
live provider readiness, or distributed node readiness.

## Final gate vocabulary

The H0-A/H0-B gate continues to distinguish `fixture_pass`,
`wall_clock_pass`, and `live_pass`. H0-C adds the separate
`agent-mode.security-release-review.v1` review contract and records its
`PASS` result, but it does not weaken the H0 requirement that every
`liveAcceptanceRequired` fault class have genuine `live_pass` evidence.
