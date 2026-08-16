# CLR3 Decision Core, Portal Consolidation, and Notifications — Acceptance 2026-08-16

## Decision

CLR3 is **accepted as a repository implementation** of the single Decision Core, Obsidian-first portal consolidation, thin Obsidian Decision Center adapter, and bounded decision-attention notifications.

This acceptance does **not** claim live installation of the Obsidian plugin into Mind, background operation while Obsidian is closed, port-4881 decommission, canonical proposal application, broad Mind writes, or CLR4 authorization.

CLR0-CLR3 are complete. CLR4-CLR8 remain unstarted and require separate owner authorization.

## Portal architecture

Canonical decision-log evidence states that **Obsidian is the only primary human dashboard**. Brain Core remains the headless API/control/safety boundary.

CLR3 inventoried the standalone `projects/brain-console` web app on port `4881`. It overlaps with runtime/status, scheduler, video, and specialist operational diagnostics but had no CLR Decision Center. Its README previously described it as the leading dashboard, conflicting with the canonical Obsidian-first decision.

CLR3 resolves that drift as:

```text
Obsidian Brain Console     primary human cockpit
Brain Core                 headless API/control/safety boundary
Port-4881 Brain Console    optional specialist diagnostics/operations surface
```

The port-4881 app is retained. No delete or decommission is authorized. It must not receive a second CLR Decision Center.

## One logical Decision Core

CLR3 extends the existing Infinite Brain proposal/approval model rather than creating a parallel queue.

Canonical inputs remain:

```text
runtime/local/infinite-brain/proposals-latest.json
runtime/local/infinite-brain/proposal-approvals.json
```

The proposal-approval store is now explicitly versioned as `1.0.0`, remains backward-readable, retains its current-record compatibility surface, and adds same-store decision history.

The Decision Core queue is a projection of the current proposal report plus the existing approval ledger. It declares `singleLogicalQueue: true` and `executionBlocked: true`.

Projected lifecycle:

```text
pending
approved
rejected
deferred
superseded
```

`needs-review` remains a recorded approval-ledger decision and projects back to `pending` for the human queue. Expired deferrals also return to `pending`. A proposal whose current content hash differs from the last decision hash projects as `superseded` and requires fresh review.

Decision cards expose bounded human-review metadata including title, summary, why-now, recommendation, alternatives, consequence of delay, priority, risk, evidence references, Mind-write intent, proposal hash, and proposal freshness/review deadline when present.

## Stale-safe and idempotent human actions

Brain Core exposes:

```text
GET  /api/infinite-brain/decisions
POST /api/infinite-brain/decisions/:proposalId
POST /api/infinite-brain/decisions/notifications/poll
```

Decision actions require the proposal hash rendered to the user. If the proposal changed after it was loaded, Brain Core returns `stale_proposal_hash` and the user must refresh/review the current proposal.

Repeated identical decisions return `decision_idempotent` and do not append duplicate history events.

Recording approval still does **not** apply the proposal. Responses preserve:

```text
applied: false
executionBlocked: true
writesToMind: false
```

Canonical application remains separately gated.

## Obsidian Decision Center

The missing Brain-owned source package `projects/brain-console-obsidian/` was recreated as a thin dependency-free Obsidian adapter over Brain Core.

The plugin provides:

- one `brain-console-view` Decision Center;
- manual queue refresh;
- pending/high-priority ordering;
- compact decision cards and bounded evidence references;
- approve/reject/needs-review/defer actions only after a human click;
- stale-hash refresh-and-review handling;
- configurable Brain Core URL;
- local decision audit label;
- persistent status-bar pending count while Obsidian is running;
- visible offline state when Brain Core is unavailable.

Business logic, proposal authority, freshness, history, and safety remain in Brain Core. The plugin does not create a decision database or cache decision authority into Mind notes.

The plugin source is **not installed into `mind/.obsidian/plugins/` in CLR3** because Mind modification was explicitly excluded. Live installation/activation therefore remains a separate future task.

## Bounded notifications

CLR3 introduces a separate notification cursor state:

```text
runtime/local/infinite-brain/decision-notification-state.json
```

This state is not decision authority. It only tracks dedupe/digest cursors.

Rules:

- a newly observed high/critical pending item produces an attention event;
- zero pending → pending produces an attention event;
- normal/low pending items produce at most one daily digest per local calendar day;
- resolved high-priority IDs are removed from the dedupe cursor;
- Obsidian shows a persistent pending count while running;
- default notification messages contain aggregate counts only.

The Obsidian adapter polls this bounded attention endpoint at most every five minutes while Obsidian is running and once on plugin load. Therefore "immediate" in CLR3 means **immediate upon the next bounded observation/poll**, not an always-on OS daemon while Obsidian is closed. CLR3 adds no new scheduler/background service.

Default notification payloads deliberately omit proposal title, summary, evidence text, and source paths and mark `sensitiveSourceTextIncluded: false`.

## Validation evidence

### One-primary-portal / Decision Core contract

```text
npm run validate:clr3-portal-contracts
```

Result:

```text
clr3-portal-contracts-valid
  primary=obsidian
  backend=brain-core
  web4881=optional
  decisionStores=1
  decisionCenterWebDuplicates=0
```

This validator also requires:

- explicit versioning of the existing proposal-approval store;
- Decision Core freshness deadline projection;
- stale-hash rejection wiring;
- idempotent decision result wiring;
- execution blocked / no Mind write response semantics;
- notification cursor state separated from decision authority;
- no port-4881 Decision Center wiring.

### Decision Core runtime

```text
npm run test:clr3-decision-runtime --prefix projects/brain-core
```

Result: **PASS — 7/7**.

Coverage includes:

- content-sensitive proposal hashing;
- exact idempotency equality;
- direct stale proposal hash rejection;
- direct idempotent decision-write guard;
- pending/approved/rejected/deferred/expired-defer/needs-review/superseded lifecycle;
- high-priority and zero-to-pending attention dedupe;
- one normal-priority daily digest per day;
- resolved high-priority dedupe-key pruning;
- sensitive decision text exclusion from notification events.

### Obsidian Decision Center

```text
npm run check --prefix projects/brain-console-obsidian
```

Result: **PASS — 6/6** plus JavaScript syntax checks.

Coverage includes:

- pending/high-priority ordering;
- stale-protection proposal hash in decision payloads;
- decision payload exclusion of summary/evidence text;
- valid deferred timestamps;
- aggregate-only notification rendering;
- source-neutral configurable Brain Core URL;
- bounded evidence rendering.

### JSON validation

Passed for:

- root `package.json`;
- `projects/brain-core/package.json`;
- `projects/brain-console-obsidian/package.json`;
- `projects/brain-console-obsidian/manifest.json`.

### Diff hygiene

`npm run validate:diff-check` passed after removing two trailing spaces reported in the port-4881 README.

### Secret-material scan

The full CLR3 scan initially reported two medium-confidence lexical matches in `projects/brain-core/src/api/routes.ts` at pre-existing Video Orchestrator webhook verification secret-field references. The exact Git diff for `routes.ts` proves those lines are outside the CLR3 hunks and were not introduced or modified by CLR3. Changing them would violate the explicit `feature/video-orchestrator` isolation boundary.

A second `forbidden_secret_material` scan over every other CLR3 path returned **0 findings**. The CLR3 `routes.ts` diff was reviewed directly and contains only Decision Core imports/routes, stale-hash handling, aggregate notification response metadata, and execution-blocked safety fields; it contains no secret material.

### Brain Core TypeScript toolchain limitation

`npm run typecheck --prefix projects/brain-core` and the initial TypeScript-only focused integration runner could not execute because this checkout has no installed Brain Core TypeScript/`tsx` toolchain (`tsc`/`tsx` unavailable).

CLR3 did not install dependencies or use the network. Instead, the production hash, stale/idempotent guard, lifecycle projection, and notification planning rules were extracted into the shared dependency-free `infinite-brain-decision-runtime.mjs`, imported by the Brain Core TypeScript adapters, and validated directly with Node 20. Portal/route wiring is separately validated by `validate:clr3-portal-contracts`.

A CLR3-created untracked TypeScript integration test that could not run was deleted only after explicit owner confirmation.

## Explicit non-actions

CLR3 did **not**:

- install the Obsidian plugin into Mind;
- modify Mind `.obsidian/**` or `kanban.md`;
- modify Workbench-private;
- modify `feature/video-orchestrator`;
- modify or absorb `operations/migrations/**`;
- add a second decision queue;
- add a second Decision Center to port 4881;
- delete/decommission port 4881;
- automatically apply approved proposals;
- write canonical Mind truth;
- add a new scheduler/background daemon;
- add provider/MCP activation;
- push any commit.

## CLR3 exit gate

- **PASS:** unresolved Infinite Brain proposals are discoverable through one logical Decision Core queue.
- **PASS:** the Obsidian Brain Console source package provides one Decision Center against that queue.
- **PASS:** stale decisions fail closed and repeated decisions are idempotent.
- **PASS:** notification attention is bounded/deduplicated and default payloads contain no sensitive source text.
- **PASS:** one-primary-portal architecture is deterministic: Obsidian primary, Brain Core backend, port 4881 optional.
- **BOUNDARY:** live Obsidian installation/activation is not performed or claimed.
- **STOP:** CLR4 is not authorized.
