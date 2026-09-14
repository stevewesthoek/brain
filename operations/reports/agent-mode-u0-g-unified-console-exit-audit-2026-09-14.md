# Agent Mode U0-G — Unified Brain Console Phase Exit Audit

Date: 2026-09-14

## Starting reconciliation

The audit started at `873404ba feat(agent-mode): add durable operator
attention`, after `b49b668b feat(brain-console): surface agent execution
resources`. The current tree contained the expected protected Firecrawl log
and two unrelated untracked roadmap files. They were not modified, staged, or
committed. No newer U0-G implementation was present.

U0-A through U0-F are genuinely landed, not documentation-only claims:

| Slice | Durable/source seam verified | Evidence |
| --- | --- | --- |
| U0-A | `agent-mode-console-v1`, `GET /agent-mode/console`, observer/StateStore projection, `/agents` | `agent-mode-u0-a-console-projection-evidence-2026-09-13.md` |
| U0-B | `agent-mode-console-detail-v1`, bounded detail route and read-only disclosure | `agent-mode-u0-b-console-drilldown-evidence-2026-09-13.md` |
| U0-C1/C2/C3 | Brain-owned control service, service HMAC, Console proxy, operator session/CSRF | the C1, C2, C3, and C3B reports listed in the roadmap |
| U0-D | durable control-audit events, operator attribution, runtime identity hardening | `agent-mode-u0-d-control-audit-session-hardening-evidence-2026-09-14.md` |
| U0-E | roots, Workcells, nodes, runtimes, models, and execution resources | `agent-mode-u0-e-resource-visibility-evidence-2026-09-14.md` |
| U0-F | durable escalations, notifications, operator read receipts, narrow auth capability | `agent-mode-u0-f-escalations-notifications-evidence-2026-09-14.md` |

K0-K5 remain complete. K4 remains the lifecycle, runtime, budget, cancellation,
kill, review, receipt, and evidence authority; U0 adds no competing control or
result plane.

## Original U0 requirement crosswalk

| Requirement | Status | Canonical source and Console surface | Reconstruction evidence | Limitation | Blocking |
| --- | --- | --- | --- | --- | --- |
| Jarvis intake | COMPLETE | durable Root Goals/Jarvis ownership in observer; `/agents` Roots | U0-E projection/detail tests and StateStore reopen | conversational intake transport is later V0 work | No |
| Agent hierarchy | COMPLETE | Agent rows, parent/root/depth/child projections | U0-A/U0-E projection and detail tests | bounded visible collections | No |
| Tasks/Runs/Attempts | COMPLETE | K4 StateStore/observer; `/agent-mode/console` and detail | U0-A/B and K4 regression suites | bounded operational views | No |
| Node | COMPLETE | durable host-health event-source facts; Resources | U0-E tests and projection contract | no live probe; absent facts are unavailable | No |
| Worktree | COMPLETE | Workcell repository/branch/base and lease metadata | U0-E Workcell/detail tests | absolute paths, fences, and raw diffs are redacted | No |
| Runtime | COMPLETE | K4 dispatch/receipt facts; Resources and detail | U0-A/B/E and runtime identity tests | no provider probe | No |
| Model | COMPLETE | durable attempt/dispatch model/provider route facts | observer/projection tests | unknown when no durable fact exists | No |
| Budgets | COMPLETE | K4 budget scopes/reservations/settlement | K4/K5 and U0-E projection tests | no Console-side accounting | No |
| Codex quota state | COMPLETE — EXPLICITLY UNAVAILABLE BECAUSE NO CANONICAL SOURCE EXISTS | U0-F/U0-E projection documentation | source audit and unavailable reason contract | `no_canonical_durable_source`; no probe/scrape/guess | No |
| Approvals | COMPLETE | existing review requests/decisions/receipts; guarded Console controls | C3/C3B/D and review regression suites | no unrelated approval systems are merged | No |
| Evidence | COMPLETE | K4/K5 evidence references and metadata-only detail | K5 finalization and U0-B/E tests | bodies/raw logs are not projected | No |
| Schedules | COMPLETE | durable scheduler StateStore/event observer | K4 scheduler and U0-A/E tests | bounded metadata only | No |
| Failures | COMPLETE | observer failure projection and bounded `/agents` Failures tab | U0-A/B and full Core suite | no retry action in this phase | No |
| Escalations | COMPLETE | U0-F StateStore attention index and Attention tab | U0-F tests plus U0-G boundary regression | only closed Brain-owned source classes produce escalations | No |
| Unread notifications | COMPLETE | operator-keyed durable reads and authenticated notification route | U0-F auth/read/idempotency tests | individual Mark read only; no mark-all | No |
| Guarded controls | COMPLETE | operator session/CSRF → Console server → service HMAC → Core control service → K4 StateStore | C1/C2/C3B/D, kill identity, review, and full regressions | local loopback single-operator threat model; no public IAM claim | No |

## Jarvis intake and Codex quota decisions

The current operator requirement is satisfied by visibility of accepted durable
Root Goals and Jarvis/supervisor ownership. Brain does not have a separate
canonical conversational intake queue. U0-G therefore does not add chat, a
prompt inbox, voice transport, or an intake database; conversational input is
later Jarvis/voice work.

Brain has quota-policy concepts and fixture quota facts, but no canonical
production durable Codex subscription/quota telemetry. The truthful Console
state is unavailable with reason `no_canonical_durable_source`. No Codex,
OpenAI, ChatGPT UI, credential, or undocumented-state probe was performed.

## Canonical-state and API audit

`agent-mode-console-v1` and `agent-mode-console-detail-v1` are request-time
Brain Core projections from the existing observer and StateStore. The Console
has no database or authoritative browser copy of agents, tasks, runs, attempts,
organizations, budgets, Workcells, evidence, failures, attention, or runtime
state. TanStack Query is temporary cache only; local storage is used only by
the unrelated theme/media UI, not Agent Mode authority.

The public console projection and detail routes expose bounded metadata only.
The authenticated notification route is separate because unread state is
operator-specific. The browser reaches it through same-origin Next server
proxies; the server derives the operator identity from the signed local
session. Core service authentication uses the narrow
`agent-mode.notifications` capability. GET never reconciles attention.

## Restart, independent clients, and read side effects

U0-A/B/E/F tests close and reopen StateStore fixtures and compare deterministic
projection/detail/attention domain state, ignoring only request-time freshness
timestamps. Two independent projection calls over the same durable state
produce equivalent domain fields. The Console has no Agent Mode localStorage,
sessionStorage, URL, or RSC authority state, so an empty browser cache or a
second browser can only refetch the same Brain projection; ephemeral tab/detail
selection is non-authoritative.

Repeated public projection, detail, and authenticated notification reads open
read-only StateStore views and cause zero Agent, Task, Run, Attempt, budget,
scheduler, attention-creation, runtime, Harness, ModelGateway, provider,
Codex, BrainNode, Workcell, Git, AWS, or network-probe effects. The browser
inspection showed explicit loading/unavailable state when Core was not serving
the local projection; no healthy or populated state was fabricated.

## Attention bounded-reconciliation audit

The original U0-F implementation had a real boundary bug: it built an active
set from only the first bounded scan results, then resolved every persisted
open escalation not in that set. An active source outside the scan window could
therefore be falsely resolved.

U0-G repaired this narrowly in `sqlite-state-store.ts`:

- uncertain attempts, failed Workcell validations, and pending reviews use
  bounded SQL ID scans rather than unbounded list materialization;
- resolution checks the exact canonical source by source type and source ID;
- an open escalation is resolved only when that exact source is inspected and
  confirmed non-qualifying;
- an omitted, missing, or otherwise unknown source remains open;
- GET projections still never invoke reconciliation.

The new regression creates two qualifying uncertain Attempts, scheduler dead
letters, and Workcell validation failures, reconciles with a limit of one, and
asserts that all six open escalations remain open when the second source is
outside the scan window. Attention tests pass **4/4** after the repair.

Same-source reconciliation is deterministic and idempotent. Notification read
receipts are composite-keyed by notification and operator: operator A can read
while operator B remains unread. Read acknowledgement does not resolve an
escalation, approve a review, cancel or settle work, advance a scheduler, or
change a budget/runtime.

## Controls, kill, review, and authority audit

Pause, resume, cancel, kill, approve, and reject retain the chain:

```text
authenticated local operator + CSRF
  → Brain Console server proxy
  → Brain service HMAC + capability
  → AgentModeControlService
  → durable StateStore/K4 authority
```

The existing control tests prove authenticated admission, strict bodies,
operator attribution, idempotency/conflict behavior, review self-approval
denial, and restart reconstruction. Kill resolves the durable runtime identity
in Core; browser input cannot provide PID, PGID, signal, or executable data.
Only the exact verified owned process may receive SIGTERM, and a durable signal
receipt prevents blind redelivery. Resume returns typed re-admission-required
denial when ownership cannot be verified; it does not create a replacement
Attempt or process.

The current threat model is explicit and bounded: loopback transport, direct
Host validation, same-origin mutation, session-bound CSRF, finite session, and
stateless logout. U0 does not claim Internet-facing security, multi-user IAM,
SSO, remote Tailscale identity, or universal token revocation.

## Bounds, ordering, resources, Workcells, and evidence

Major summary collections use explicit bounds: agents/roots/tasks/runs/attempts,
runtimes/budgets/resources/evidence/workcells are capped at 100; organizations
at 50; schedules/approvals at 50; failures at 50; detail child/evidence/history
collections use their stricter existing bounds. Attention records are capped at
100 visible items. Operational ordering is active before terminal, newest
durable update first, then stable ID; organization work items use canonical
work-item ordering. No map iteration determines domain order.

Resource state distinguishes durable known, stale, unknown, and unavailable
facts. No request probes a provider, host, Codex, or runtime. Workcell detail
contains only safe repository reference, branch/base, owner, lifecycle, lease,
validation, diff, review, commit, and merge metadata; it excludes absolute
paths, lease fences, raw diffs, credentials, prompts, and logs. Evidence and
organization/control/attention receipts remain bounded references and metadata,
not copied bodies or a second result ledger.

## Visual exit check

Desktop inspection of the current `/agents` route verified usable sidebar and
Agents navigation, the operational header, summary/card spacing, visible tab
surface, readable long-ID treatment, and distinct loading/unavailable and
read-only session states. The available browser automation surface did not
expose a viewport override, so a narrow/mobile inspection could not be run;
this limitation is recorded rather than claimed as a pass. The production
Console build completed successfully.

## Validation

- Deliberate U0/Core regression set: **331 tests, 331 passed, 0 failed**.
- New attention tests: **4 passed**.
- Brain Console Agent Mode schema tests: **8 passed**.
- Full Brain Core suite after the repair: **2,549 tests, 2,549 passed, 0 failed,
  0 skipped, 0 cancelled**.
- Brain Core typecheck: passed.
- Brain Core build: passed.
- Brain Console typecheck: passed.
- Brain Console production build: passed; existing CSS autoprefixer warnings
  only.
- `git diff --check`: passed.

No live model, provider, AWS, Codex, Harness, BrainNode, Workcell, Git, or
network effect was required by the audit. The full suite included K4/K5,
control, review, runtime-identity, scheduler, Workcell, projection, detail,
restart, and attention coverage.

## U0 exit-gate decision

The authoritative gate is satisfied:

1. Brain Core is the sole durable authority.
2. `/agents` reconstructs bounded domain state through versioned Brain APIs.
3. Guarded controls remain authenticated and K4-authoritative.
4. K5 organization/final-result state, Workcells, resources, schedules,
   approvals, evidence, failures, escalations, and unread state are visible
   from durable facts.
5. Missing Codex quota telemetry is explicitly unavailable, not fabricated,
   and does not prevent safe operation of the existing control plane.
6. Restart and independent callers reconstruct equivalent domain state.
7. The bounded attention omission bug is repaired and regression-tested.

```text
U0-G: COMPLETE
U0:   COMPLETE
V0:   NOT STARTED
```

Exact next authoritative phase: **Phase V0 — Jarvis voice gateway**. Do not
start it automatically.
