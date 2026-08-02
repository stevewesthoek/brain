# BS0.1 Mutable Capability Containment — 2026-07-13

**Task:** BS0.1 — Inventory and contain mutable Brain Core capabilities  
**Verdict:** complete  
**Scope:** `projects/brain-core` HTTP boundary only. No Mind, n8n workflow, deployment, schedule, credential store, `.env`, runtime configuration artifact, or generated output was accessed or changed.

## Executive result

Brain Core exposed all HTTP routes behind a loopback-only check. There was no
authenticated service identity, authorization middleware, or reliable origin
boundary. Loopback and `Origin` are therefore treated as transport hints, not
authorization.

The smallest safe BS0.1 containment is now a route-boundary fail-closed gate
for every confirmed Critical or High mutable capability. It runs before request
body parsing and returns a generic `503 mutable_capability_contained` response.
It accepts no caller-supplied header as a bypass. Read-only routes retain their
existing behavior. The future authenticated service-identity contract belongs
to BS0.5; this task does not design it.

## Planning evidence and inputs

- [Runtime roadmap](../specs/infinite-brain-runtime-roadmap.md)
- [Implementation plan](../specs/infinite-brain-runtime-implementation-plan.md)
- [Live capability status](../runbooks/infinite-brain-roadmap-status.md)
- [Stabilization planning report](pre-1-0-architecture-stabilization-planning-2026-07-13.md)
- [Mind folder compatibility final audit (2026-07-07)](../specs/mind-folder-compatibility-final-audit-2026-07-07.md): Brain Core path compatibility evidence; it does not establish an HTTP authorization boundary.

The requested Sol Ultra architecture audit, B1.x migration audit, and B1.y
decision matrix do not exist as matching repository artifacts after a bounded
search under `operations/reports` and `operations/specs`. The prior B1.x/B1.y
work supplied in the task context is therefore recorded as an external planning
input; no repository path is invented.

## Worktree and inspection boundary

Initial command:

```text
git status --short
```

The worktree already contained extensive unrelated changes, including
operations-system configuration, n8n workflow/runbook, Mind Steward, and
planning artifacts. No `projects/brain-core/**` path was modified before this
task, so the required router and test files had no overlapping user change.
Those unrelated paths were not edited.

Files inspected:

- `projects/brain-core/src/api/server.ts`
- `projects/brain-core/src/api/routes.ts`
- `projects/brain-core/src/security/localhost.ts`
- `projects/brain-core/src/security/redaction.ts`
- focused route, production-hardening, agent, and approval tests
- only the directly called Brain Core adapters needed to establish process,
  publish, approval, and credential effects

Files changed:

- `projects/brain-core/src/api/routes.ts`
- `projects/brain-core/src/tests/mutable-capability-containment.test.ts`
- `projects/brain-core/src/tests/video-orchestrator-thumbnail-route.test.ts`
- `operations/specs/infinite-brain-runtime-implementation-plan.md`
- this report

## Trust-boundary findings

1. `isLocalRequest()` accepted loopback socket addresses as the sole global
   HTTP admission check. It is not authentication or authorization.
2. The router had no service/session authentication or authorization middleware.
   Caller-supplied `Origin` and authorization-looking headers were not verified.
3. Generic CORS preflight advertised `POST`; a contained route now advertises
   `GET, HEAD, OPTIONS` instead.
4. Credential/OAuth handlers still contain legacy query parsing, including
   values that must never be accepted from a request URL. The containment gate
   blocks those handlers before they run; removing the obsolete endpoint
   contract and defining a credential contract are BS0.4/BS0.5 work.
5. Process routes use fixed executables, but several pass caller-controlled
   values to a subprocess or a workflow/external publisher. They are contained
   before body parsing. No arbitrary executable, script path, environment
   override, redirect, pipe, or command chain is accepted by the new boundary.
6. A duplicate YouTube publish branch exists inside the non-POST router branch
   but is unreachable for a POST because POST is dispatched earlier. It is
   historical/dead duplicate handling, not an active bypass; remove only under
   the later router-simplification/contract work.

## Capability inventory

Legend: **Boundary** records current `AuthN/AuthZ; approval; Origin/LH`.
`none; route-specific; L` means no verified identity or authorization, only the
global loopback admission check. **Exec input** means caller influence over a
process or external action; `fixed + data` is not arbitrary shell dispatch but
still requires a trust boundary. **I/R/Receipt** means idempotence, rollback,
and immutable receipt as observed from the route contract: `unknown` is not
assumed to exist.

| Route / entrypoint (method) | Handler / target | Classification | Boundary; exec input; secret channel; I/R/receipt | Severity | BS0.1 decision |
|---|---|---|---|---|---|
| Read/status/report/history/catalog GET surfaces, media metadata, health | route switch; local/runtime reads | query-only | none; no mutation; no secret write; n/a | Low | retained read-only |
| `GET /api/video-orchestrator/jobs/:id/video` | fixed `aws s3 cp` artifact read | query-only | none; fixed read command; no write; n/a | Medium | retained; provider read is not a mutation |
| `POST /api/mind-maintenance/run` | `routeMindMaintenanceJob`; Mind/maintenance state | privileged execution | none; body selects Mind root; no verified receipt | High | contained |
| `POST /api/infinite-brain/operator-approval/record`, metadata enablement record, proposal approvals | approval-record writers; Brain report/state | authorization-only | none; caller supplies decision/operator; local record, rollback unknown | High | contained |
| Infinite Brain dry-run, manifest, validation, preview, post-write, application-plan, readiness, executor-dry-run, iOS-safety generators | report writers; Brain local report state | ambiguous | none; no process claimed; no credential channel; I/R/receipt unknown | Medium | retained as report/state-only; record for BS0.5 contract registry |
| `POST /api/infinite-brain/metadata-writer/write/single-file-test` | metadata writer; Mind file | privileged execution | confirmation only, not identity; caller target/value; rollback adapter exists, receipt not immutable | Critical | contained |
| Script approve/request-changes, video-review approve/request-changes | VO provider workflow state | mixed boundary | no identity; approval changes workflow; receipts adapter-defined | High | contained |
| Script generation and job creation from prompt | VO provider/job state | mixed boundary | none; caller prompt/body; no verified receipt | Medium | retained; no external publish/process observed at route boundary |
| YouTube publish/dry-run route families | `runControlledYouTubePublish`; external platform | privileged execution | confirmation is not identity; fixed provider action; publish receipt provider-defined | Critical | contained |
| `POST /api/agent/plan` | planner/plan store; Brain local state | mixed boundary | none; caller goal/context; I/R/receipt unknown | Medium | retained |
| `POST /api/agent/execute` | `OrchestrationExecutor.executeAll`; process/provider work | privileged execution | no verified identity; executor can invoke Codex; rollback/receipt unknown | Critical | contained |
| `POST /api/agent/plan-approval` | approval decision store | authorization-only | no verified identity; decision can influence executor; receipt mutable | Medium | retained because executor is contained |
| `POST /ai-model-selector/control` | selector start/stop; runtime process state | privileged execution | none; query action; rollback process-specific | High | contained |
| `POST /credentials/**`, OAuth exchange/callback, project register/delete, VO account auth method | credential/config adapters; external identity/configuration | mixed boundary | none; legacy query contains credential/code values; receipt/rollback unknown | Critical | contained before parsing; no value reflected |
| `POST /open-url` | returns local URL only | query-only | localhost URL validation; no launch or mutation | Low | retained |
| `POST /actions/request`, on-demand run request, post review/schedule approval request, scheduler/skills/session request kinds | action/approval request stores | authorization-only | no verified identity; records a request only; mutable receipt | Medium | retained; downstream execution remains separately gated/contained |
| `POST /local-apps/:id/start|stop|restart` | local-app command executor; processes | privileged execution | no identity; fixed allowlisted executable/args; process rollback partial | Critical | contained |
| `POST /ops/brain-core/restart` | fixed restart helper; Brain Core process | privileged execution | `confirmation:true` only; fixed script; restart log is not immutable receipt | High | contained |
| `POST /approvals/:id/approve|reject`, infra VO job approve/reject | approval stores / VO job state | authorization-only | no verified identity; decision modifies approval state; replay state mutable | High | contained |
| VO content-item create/update, package edit/cancel/retry | VO local workflow state | mixed boundary | no identity; caller content fields; rollback/receipt adapter-defined | Medium | retained |
| Thumbnail approve/queue/generate/declare winner; metadata generate/approve | thumbnail worker and VO state | privileged execution | no identity; fixed worker plus caller payload; approval is mutable | High | contained |
| Package queue/final-approval/publish/publish-direct/batch-publish | package state and external publishing/n8n fallback | privileged execution | confirmation is not identity; external target/body fields; provider receipt not immutable | Critical | contained |
| Automation rule creation and workflow scheduling | VO rules/schedule state | mixed boundary | no identity; caller condition/action/cron; rollback/receipt unknown | High | contained |
| Webhook register/process/verify/rotate/disable | webhook configuration/event processing | mixed boundary | no identity; caller webhook payload/signature/secret; receipt mutable | High | contained |
| Event emit/acknowledge/subscribe/route | event/workflow state | mixed boundary | no identity; caller event/payload; receipt mutable | High | contained |
| Analytics publish outcome and video metrics writes | VO analytics state | ambiguous | no identity; caller metrics; no external write observed | Medium | retained |
| `POST /research/video-analyze` | fixed Python analyzer + history writer | privileged execution | no identity; fixed executable but caller URL/focus reaches process; rollback unknown | High | contained before parsing |

All discovered mutable route families are represented above. The exact static
route source remains `projects/brain-core/src/api/routes.ts`; GET routes not in
the table are query-only. No PUT, PATCH, or DELETE mutation handler was found.

### Critical and High containment coverage

The central matcher contains every Critical/High family listed above:

- Mind writes and approvals that can authorize them;
- agent execution, model control, local process control, and Brain Core restart;
- credential/OAuth/configuration routes;
- all external publishing, publish approval, external event, webhook, and
  schedule control routes;
- process-backed thumbnail and research routes.

Each returns `503` before `readJsonBody()` or the handler executes. The response
contains no request path, query values, credential material, body, executable
detail, or process output. No header, loopback source, Origin, or confirmation
flag bypasses containment.

## Exact containment change

`projects/brain-core/src/api/routes.ts` adds a narrowly scoped
`isContainedHighImpactMutation()` route matcher and
`rejectContainedHighImpactMutation()` response. It:

1. applies only to POST routes whose effects are Critical or High;
2. returns a generic fail-closed response before body parsing;
3. removes POST from CORS preflight for a contained route;
4. does not add an identity platform, access a credential, change a safe GET
   route, or alter medium/low route behavior.

The response explicitly records that localhost and Origin are not
authentication and that no credential value has been accepted.

## Tests and validation

Added `projects/brain-core/src/tests/mutable-capability-containment.test.ts`.
It proves:

- unauthenticated localhost and Origin-only mutation is rejected;
- caller-supplied authorization-looking header cannot bypass the gate;
- contained CORS preflight does not advertise POST;
- read-only `GET /status` remains available;
- a GET to a publish route does not mutate;
- approval attempts remain rejected on replay;
- credential query input is rejected and not reflected;
- process-backed input is rejected before body parsing;
- non-local requests remain denied before containment.

Commands executed (repository-local tools only; paths without `-C` used the
Brain Core working directory):

```text
git status --short
rg --files projects/brain-core | rg '(^|/)(.*(route|server|security).*(test|spec)|.*test.*\.(ts|mts|cts))$|redaction\.ts$'
rg -n -i 'authorization|authentication|authenticate|authn|authz|csrf|origin|referer|x-...(token|key|session)|trusted...|bearer' projects/brain-core/src --glob '!adapters/**' --glob '!tests/**' --glob '!types/**'
sed -n '290,390p' projects/brain-core/src/api/routes.ts
sed -n '3035,3700p' projects/brain-core/src/api/routes.ts
sed -n '4020,4430p' projects/brain-core/src/api/routes.ts
sed -n '4430,5335p' projects/brain-core/src/api/routes.ts
git diff --check
./node_modules/.bin/tsx --test src/tests/mutable-capability-containment.test.ts
npm run typecheck
./node_modules/.bin/tsx --test src/tests/agent-approval-gates.test.ts src/tests/vo-studio-approval-store.test.ts src/tests/video-orchestrator-publish-gate.test.ts
./node_modules/.bin/tsx --test src/tests/mutable-capability-containment.test.ts src/tests/video-orchestrator-thumbnail-route.test.ts
rg -n '(authorization|authentication|origin|localhost|credential|secret|spawn|exec|approve|execute|restart|publish)' src/api/routes.ts src/tests/mutable-capability-containment.test.ts
git -C /Users/Office/Repos/stevewesthoek/brain status --short
```

Validation output:

```text
mutable-capability-containment: 7 passed, 0 failed
thumbnail route regression/containment: 20 passed, 0 failed
Brain Core typecheck: passed (`tsc --noEmit -p tsconfig.json`)
existing approval/publish focused tests: 15 passed, 0 failed
git diff --check: passed
focused changed-file security scan: passed; reviewed expected route imports,
matcher coverage, and test-only placeholder data; no credential value printed
```

No JSON files changed, so JSON validation was not applicable. Broad tests were
not run because this is a shared router change with a deliberately limited
high-impact guard and the required focused route/security/approval coverage
passed.

## Safety attestations

- No credential, token, private key, `.env` value, raw environment export,
  credential store, browser session, backup, or live API was accessed.
- No credential value was printed. Test input used a non-secret placeholder and
  asserted it was absent from the response.
- No webhook, schedule, deployment, external action, process, or provider was
  invoked by this task.
- Mind was not read or changed. No n8n workflow was read live or edited.
- No commit or push occurred.

## Residual findings and blockers

There are no unresolved Critical or High BS0.1 findings.

Medium findings intentionally remain for their documented follow-up lanes:

- Mutable report, planning, analytics, and request-recording endpoints still
  have no authenticated identity boundary. BS0.5 must define the contract
  registry and trusted-service identity before they can be promoted or
  consistently authorized.
- Legacy credential/OAuth query-parsing code remains unreachable only because
  of this fail-closed gate. BS0.4 audits credential/backup safety; BS0.5
  replaces the absent contract rather than re-enabling the endpoints.
- Duplicate unreachable YouTube publish branch requires later router/contract
  simplification, not a BS0.1 removal while the worktree is dirty.

These are not blockers to BS0.1 completion: the task completion rule permits
explicit Medium/Low residuals, and no active Critical/High route remains exposed.

## Next documented task

`BS0.2 — Quiesce unsafe Mind writes` is the next task in the implementation
plan. It has **not** been started here. It must use this report and retain the
new HTTP containment while independently inventorying non-HTTP Mind write
paths. B1.0a remains separate/incomplete; B2 Context Gateway tasks are
unchanged; M1.3 remains independently continuable; M1.4 remains blocked.
