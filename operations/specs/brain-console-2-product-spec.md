# Brain Console 2.0 Product Specification

**Status:** accepted release contract — Brain Console 2.0 complete
**Date:** 2026-09-04
**Owner:** Brain product and runtime maintainers
**Implementation posture:** released baseline; maintenance-only; preserve Brain Core safety boundaries

> The 2.0 contract is accepted at release revision
> `9a5719e731f16c4e88bb34720c1679f1e3276be9`. The implementation and acceptance
> evidence are recorded in `operations/reports/brain-console-2-final-product-closeout-2026-09-05.md`.
> Do not reopen completed modernization phases or treat this specification as
> an active feature backlog; separately approved future work belongs to a new
> product version.

## Implementation status — Phase 0/A foundation

As of 2026-09-04, the Phase 0/A read-model foundation is implemented in the Brain source tree: deployment identity diagnostics, `operational-snapshot-v1`, the canonical seven-state vocabulary, bounded attention/activity/active-work projections, Console schemas/client/primitives, and the versioned ten-widget Obsidian contract. The implementation is additive and read-only; it does not redesign the UI, mutate LaunchAgents, or switch the live deployment. Physical source/runtime migration and Command Center presentation remain subsequent work.

## 1. Product mission

Brain Console is the live operational cockpit for Brain. It gives a human a trustworthy answer to four questions:

1. Is Brain healthy and current enough to trust?
2. What needs human attention now?
3. What work is active, blocked, or waiting for a gate?
4. What is the safest useful next action, and where is the evidence?

Brain Console is not a second personal knowledge vault, not a raw infrastructure monitor, and not a manual provider selector. It is a visual read and control surface over Brain Core projections, receipts, safety gates, and bounded operational events.

## 2. Product planes and authority

Brain is a two-plane human product with one headless control boundary:

| Plane | Owns | Does not own |
|---|---|---|
| Brain Console web | Live posture, attention, active work, evidence visibility, infrastructure, scheduler, receipts, safe operational actions | Durable personal meaning, long-form notes, a second decision record |
| Obsidian Brain Console | Durable knowledge context, long-form work, human-authored decisions, Decision Center | Runtime authority, arbitrary shell actions, automatic approval |
| Brain Core | API, adapters, projections, action safety, provenance, receipts, policy | UI layout, personal meaning, unmediated browser/provider access |
| Mind | Personal knowledge, meaning, priorities, protected knowledge writes | Operational process authority and arbitrary runtime execution |

The web Console and Obsidian plugin must use stable entity IDs, revision references, and deep links. They must not copy state into competing stores. An Obsidian decision is a human decision artifact; a Core receipt is an operational fact.

## 3. Users and primary jobs

### Operator

Needs to see whether scheduled work, local apps, services, hosts, and integrations are trustworthy; investigate an anomaly; and run a safe, explicitly gated action.

### Builder or maintainer

Needs to inspect task packets, evidence packets, capability routing, context budgets, source revisions, test/build state, and deployment identity.

### Decision maker

Needs to understand an operational proposal, its evidence and safety gates, then record the durable decision in the Obsidian Decision Center.

### Curious human

Needs to ask “what is happening?” without knowing whether the answer is in Scheduler, Infinite Brain, Local Apps, New Relic, or a provider page.

## 4. Product principles

1. Attention before inventory. The home view prioritizes actionability, not the number of subsystems.
2. Brain chooses capabilities. The UI explains routing and fallback; it does not make the user select providers manually.
3. Every value has a state. Current, stale, degraded, unavailable, error, blocked, and pending are different.
4. Evidence travels with the claim. Show source, age, confidence, uncertainty, and related receipt.
5. One authority per fact. Core owns operational state; Mind and Obsidian own meaning and decisions.
6. Read models are bounded. A home view should not require every provider to be healthy.
7. Actions are explicit. Preview, gate, confirm, execute, and receipt are distinct steps.
8. Healthy is quiet. Green status is compact; anomalies earn visual space.
9. Runtime identity is visible. The operator can see which source revision and deployed runtime produced a result.
10. A blank state is never a success state. Missing, stale, disabled, and not instrumented must be explained.

## 5. Information architecture

### Primary navigation

```text
Command Center
Brain
  Overview
  Active orchestration
  Tasks and evidence
  Quality and safety gates
  Continuity
  Capability routing
Computer
  Overview
  Hosts and services
  Observability
  Network and tunnels
  Providers
Operations
  Attention queue
  Scheduler
  Local Apps
  Activity and receipts
Work
  Video pipeline
  Research
Knowledge
  Obsidian / Decision Center
  Graph and index freshness
Utility
  Search / command palette
  Settings
```

The current routes may remain as compatibility URLs during migration. The navigation should expose user jobs and domains, not provider adapters. `/dokploy`, `/monitoring`, `/tunnels`, and `/ai-models` become detail destinations. `/aws-video` and `/video-analyzer` remain specialist workflows under Work.

### Global shell

The shell contains:

- product identity and current location;
- Core availability and operational read-model state;
- source/deployment revision and last update on diagnostic expand;
- global search and command palette trigger, `Cmd/Ctrl-K`;
- theme and density controls after the base layout is stable;
- a compact attention count;
- a visible paused/hidden-tab indicator when live refresh is suspended.

The shell does not contain a permanently expanded metric strip, provider picker, raw logs, or every subsystem's green status.

## 6. Command Center requirements

### Above the fold

The first viewport must communicate one sentence:

> Brain is `[overall state]`; `[N]` items need attention; `[active work summary]`; next safe action: `[action or “none”]`.

Required regions:

1. **Posture header:** overall state, Core state, read-model age, source revision, and a link to diagnostics.
2. **Attention queue:** critical, degraded, stale, blocked, pending approval, and failed backup/job items sorted by severity, age, and actionability.
3. **Active work:** up to five tasks/jobs with current atomic step, owner, specialist, capability route, progress, and next action.
4. **System posture:** compact summaries for Brain, Computer, Operations, and Knowledge.
5. **Recent activity:** bounded normalized events with domain and entity filters.
6. **Recommendation:** one contextual explanation of the highest-value safe next step.

### Command Center behaviors

- A healthy source contributes a compact summary.
- A stale source contributes a warning with age and a refresh path.
- A failed optional source cannot blank the entire home view.
- A blocked action displays the policy or safety gate and does not present a misleading run button.
- An action in progress shows its receipt and timeout policy.
- Any mutation links to its target, request, gate, confirmation, and result.
- The screen remains useful with zero active work and with every optional integration unavailable.
- Home polling is one shared read-model query per refresh window. Hidden tabs pause or lengthen refresh.

## 7. Brain and Infinite Brain views

### Brain overview

The Brain overview explains the operational system by capability and state. It shows counts and exceptions for:

- active orchestration;
- task and evidence packets;
- quality and safety gates;
- continuity and resumability;
- capability routing and fallback;
- context budget and bounded atomicity;
- graph/index freshness;
- recent receipts and failures.

### Active orchestration

For each active item show:

- stable task ID and objective;
- current state and state transition time;
- owner and specialist;
- primary capability and resolved provider path;
- current atomic step and bounded context budget;
- evidence produced and validation status;
- next action, including whether confirmation is required;
- failure, retry, rollback, and continuation policy;
- links to task packet, evidence packet, receipt, source, and Obsidian decision when present.

### Task packet detail

Render the existing task-packet contract as a readable sequence: route, primary adapter, selected capabilities, quality gates, safety gates, context requests, scopes, permissions, plan, state, evidence, artifacts, continuity, next action, failure policy, authority, and execution mode. Make report-only and execution-enabled states visually unambiguous.

### Evidence packet detail

Render bounded atomic-step evidence with input/output references, provider resolution, claims, uncertainty, conflicts, validation references, side effects observed, continuation references, status, and execution mode. A claim without a source reference is visibly incomplete.

### Graph detail

Show composition and relationship graphs on demand. Graph nodes must have authority owner, source revision, freshness, confidence, privacy classification, and relationship references. Graphify is a derived navigation and index capability, never a new runtime authority.

### Quality and safety gates

Show each gate as passed, pending, failed, blocked, or not applicable. Explain the evidence and policy. Preserve the existing Core approval and stale-hash protections. Never render a disabled or policy-blocked action as if it were ready.

### Continuity

Show session, task, worktree, branch, Brain revision, objective, state, artifacts, handoff, freshness, and confirmation requirements. A resume control must explicitly state what will be resumed and which values are stale.

### Capability routing

The user describes a capability or task. Brain resolves it through native provider, shared Brain provider, approved alternative, or unavailable. The Console shows:

- requested capability;
- selected route and reason;
- quality and safety gates;
- fallback path, if used;
- provider health and cost/budget context;
- evidence and receipt.

There is no primary “choose a model” interaction. A diagnostic detail may show the matrix, but it is read-only and subordinate to Brain routing.

## 8. Computer requirements

Computer groups operational observability into a correlated hierarchy:

```text
Computer overview
  Hosts and services
  Containers and deployments
  Backups and storage
  Network and tunnels
  External telemetry
  Providers
```

### Computer overview

Show only exceptions and compact posture: host count, stale hosts, failed backups, unhealthy services, offline tunnels, deployment/source drift, and last telemetry update.

### Hosts and services

Join host identity, process/service/container state, endpoint health, scheduler identity, Core/Console identity, source revision, and service dependencies. A service is not “healthy” solely because its process exists.

### Runtime identity

The diagnostic panel must show:

- source repository and commit;
- build mode and build timestamp;
- deployed/runtime path;
- LaunchAgent label and plist path where applicable;
- listening port and owning process;
- endpoint readiness;
- visible app/window launch result;
- last restart and last failed start;
- drift between intended and running identity.

### External telemetry and providers

Provider details must preserve provenance and failure reason. New Relic, Dokploy, Cloudflare, and similar adapters are detail pages. Their latency or failure must not block the base Computer overview.

## 9. Operations requirements

### Scheduler

The scheduler page is the reference detail pattern. It must provide:

- canonical registry version and validity;
- active, disabled, policy-blocked, deprecated, running, successful, failed, timeout, skipped, and never-run counts;
- next trigger and last run;
- filtered job table with owner, entrypoint, schedule, dependency, safety, mode, and last result;
- job detail with receipt, artifacts, human review, runbook, and latest error;
- explicit policy-blocked explanation;
- bounded history pagination.

The home view shows only scheduler exceptions, not every job row.

### Local Apps

Preserve Core-mediated lifecycle actions and action receipts. The detail page supports apps, actions, and policy. Raw JSON is collapsed by default and available as a diagnostic view. Resolve the documented page-size mismatch before finalizing the layout contract.

### Activity and receipts

Activity is an operational event view, not a raw log viewer. It supports filters by time, severity, domain, entity, status, and source. Receipts link to the originating task/action and show result, evidence, and rollback information.

### Work specialist surfaces

Video pipeline and research remain accessible but do not compete with Command Center attention. Long-running video actions show progress, timeout policy, and receipt. Publish actions remain dry-run and approval-gated according to existing contracts.

## 10. Obsidian and Knowledge requirements

The Obsidian plugin remains external to the live Mind vault until a separate explicit installation gate. The plugin must:

- use Brain Core as its endpoint;
- render a versioned widget contract;
- expose aggregate attention with a conservative refresh budget;
- link to Console detail pages using stable IDs and revisions;
- link to Decision Center records without copying sensitive proposal text;
- never write generated runtime state to Mind Markdown;
- never call automatic approval from a notice;
- display unavailable and stale Core states explicitly.

Reconcile the ten-widget specification with the current eight-widget adapter before release. The conformance test must cover the spec, Brain Core adapter, plugin code, and installed plugin manifest.

Knowledge views in the web Console are link and freshness views. They do not reproduce all of Mind or Obsidian.

## 11. Operational read model contract

### Contract name

`operational-snapshot-v1`

This is a derived, read-only Core projection. It is not a new authority and must retain the provenance and safety fields of its inputs.

### Required envelope

```json
{
  "contract": "operational-snapshot-v1",
  "snapshotId": "stable-or-unique-snapshot-id",
  "generatedAt": "ISO-8601 timestamp",
  "sourceRevision": "Core projection revision",
  "overall": {
    "state": "current|stale|degraded|unavailable|error",
    "severity": "info|warning|critical",
    "freshness": "fresh|stale|unknown|unavailable|not_instrumented",
    "availability": "available|empty|unavailable|invalid|not_instrumented"
  },
  "sections": {
    "attention": [],
    "activeWork": [],
    "brain": {},
    "computer": {},
    "operations": {},
    "knowledge": {}
  },
  "activity": [],
  "errors": [],
  "safety": {
    "readOnly": true,
    "writesToMind": false,
    "executionEnabled": false
  }
}
```

Each section item must carry entity ID, domain, display label, state, severity, occurred/observed time, freshness, availability, authority owner, provenance, confidence, uncertainty, privacy classification, failure details when present, and safe deep links. `data` may be domain-specific, but the state wrapper is stable.

### Existing contracts to reuse

Reuse `brain-core-projection-v1` fields and adapters wherever possible. Do not flatten authority owner, source references, privacy classification, confidence, uncertainty, or read-only safety flags. Existing route-specific endpoints remain compatibility surfaces until consumers migrate.

## 12. Event model

Use a Core-owned normalized ephemeral event ledger projection for operational activity. Events are derived from authoritative runtime transitions, scheduler receipts, action receipts, projection failures, and provider observations. The UI does not create events from what it happens to render.

### Event fields

```text
eventId
eventType
occurredAt
severity
domain
entityRef
action
status
sourceRef
provenance
privacyClassification
taskRef, evidenceRef, receiptRef, decisionRef
summary
```

Retention is bounded. Sensitive fields are redacted before indexing. Events explain what changed and where to inspect; they do not become a second durable decision store.

## 13. Search and indexing contract

### Search scope

The index covers routes, capabilities, tasks, evidence packets, sessions, repos, hosts, services, scheduler jobs, local apps, receipts, gates, event summaries, Obsidian decision references, and Graph/index freshness.

### Search result requirements

Every result includes type, stable ID, label, domain, state, freshness, authority owner, privacy classification, and deep-link target. Search never returns secrets, tokens, credentials, unredacted provider payloads, raw logs, or unrestricted Mind content.

### Command palette

Commands may navigate, filter, refresh, open a diagnostic view, or request a gated action. A mutating command must show target, intended action, policy/safety gates, confirmation requirement, and expected receipt before execution. Keyboard navigation, escape, focus return, and screen-reader announcements are required.

## 14. Mac application and always-on requirements

“Always operational” has four separate acceptance states:

1. **Process alive:** LaunchAgent/service exists and process is running.
2. **Endpoint ready:** health and status routes respond within budget.
3. **Data healthy:** the read model reports current/degraded/unavailable states with reasons.
4. **Human surface visible:** clicking the app produces visible activation feedback and a reachable Console window/tab.

The Mac target is:

- production-mode Console service, not an unmanaged development server;
- pinned source commit and build identity visible in diagnostics;
- Core and Console LaunchAgents with explicit readiness and last-failure records;
- app launcher that visibly activates or opens the Console and reports failure;
- single-instance/reopen behavior;
- browser/window launch receipt;
- port ownership and stale artifact preflight;
- graceful restart and bounded recovery;
- scheduler trigger state shown separately from service liveness;
- no credentials or raw runtime secrets in UI or logs.

If a native wrapper is retained, it must provide a visible menu-bar/window affordance and actionable error feedback. If a browser surface is retained, the app must make that browser activation reliable and observable. The product choice can be made during Phase F, but a silent `LSUIElement` URL launcher is not an acceptable final UX.

## 15. Performance targets

| Target | Requirement |
|---|---|
| Cached Command Center posture | Meaningful state visible under 1 second locally |
| Home request count | One shared read-model request per refresh window |
| Critical attention latency | Under 10 seconds while Console is visible |
| Detail response | Under 2 seconds locally, or explicit progress and timeout state |
| Hidden tab | No high-frequency polling; pause or use a long refresh interval |
| Large detail data | Paginated or bounded; scheduler history and event stream never unbounded |
| Provider failure | Optional provider failure does not block base home posture |
| Re-rendering | Shared query/cache and stable list keys; no card-level duplicate fetches |

## 16. Reliability contract

The canonical state enum is:

```text
CURRENT, STALE, DEGRADED, UNAVAILABLE, ERROR, BLOCKED, PENDING
```

Required semantics:

- `CURRENT`: source responded inside its freshness budget.
- `STALE`: last value exists, but its age exceeds the budget.
- `DEGRADED`: some fields or dependencies are unavailable while a useful partial result exists.
- `UNAVAILABLE`: source is disabled, uninstrumented, or intentionally absent.
- `ERROR`: request, provider, or schema failure.
- `BLOCKED`: a policy or safety gate prevents the requested action.
- `PENDING`: an action or confirmation is in progress.

Every state includes age, source, reason when non-current, and a recovery path when one exists. Route-level error boundaries and a consistent retry/cancel/receipt pattern are required.

## 17. Design system direction

### Visual sentence

**A calm, precise instrument panel for a living AI operating system.**

### Principles

- Use tinted neutral surfaces and clear hierarchy.
- Use one semantic accent per state: healthy, warning, critical, blocked, pending, unknown.
- Reserve high-saturation color for state and action.
- Use compact tables for inventory and generous space for attention.
- Keep Geist for interface text and Geist Mono for technical values.
- Prefer simple borders, dividers, and tonal layers over gradients and glass effects.
- Keep motion subtle and honor reduced motion.
- Do not use a card for every field. Use rows, timelines, callouts, and disclosure panels by meaning.

### Component primitives

Build and test these primitives before broad page work:

- `StateBadge` and `StateSummary`;
- `FreshnessLabel`;
- `AttentionItem` and `AttentionQueue`;
- `ReadModelHeader`;
- `MetricRow` and `EntityTable`;
- `EvidenceReference`;
- `GateResult`;
- `ActionReceipt`;
- `ProgressAndTimeout`;
- `DeepLink`;
- `EmptyUnavailableError` state panel;
- `CommandPalette`;
- `ActivityEvent`.

### Component-library decision

Adopt the current compatible component foundation selectively. Use Radix/shadcn-compatible primitives where they materially improve dialogs, sheets, popovers, menus, tabs, tooltips, command palette behavior, and resizable panels. Do not migrate the entire application to a new library. The migration cost would be substantial and would not address fragmented data contracts or the current information architecture. Brain-specific state, evidence, gate, receipt, and freshness primitives must remain the product layer above any generic component primitive.

## 18. Accessibility, security, and privacy

### Accessibility minimum

- semantic landmarks and one page heading;
- keyboard access to navigation, filters, tables, dialogs, and command palette;
- visible `:focus-visible` styling;
- focus trapping and focus return for dialogs;
- live-region updates for meaningful state changes, not every metric tick;
- color plus text/icon for all states;
- reduced-motion support;
- readable narrow-window layout with no horizontal scroll for primary actions;
- table headers, row labels, and error associations.

### Security and privacy

- Browser calls Core only for operational data and actions.
- No shell execution, arbitrary path access, or raw log exposure from the browser.
- Preserve Core approval, stale-hash, policy, and receipt protections.
- Preserve `privacyClassification`, authority owner, provenance, confidence, and uncertainty in read models.
- Redact credentials, tokens, cookies, private keys, and sensitive Mind text from UI and index.
- Deep links never bypass safety gates.
- The Mac runtime diagnostic must show identity, not secrets.

## 19. Responsive behavior and customization

Desktop is the primary target because the Console is an operations dashboard, but the layout must support a narrow window:

- navigation collapses into a drawer while retaining current location;
- attention queue remains first;
- wide tables become labeled rows or horizontal detail views;
- secondary metrics collapse into disclosure sections;
- active work and action controls remain visible;
- no critical state is available only via hover.

MVP customization is limited to density and optional section collapse. Saved layouts, custom alert filters, and personalized dashboards are later work, after the read model and semantics are stable.

## 20. Explicit non-goals

Do not build:

- a second web Decision Center;
- unrestricted autonomous execution controls;
- a manual model/provider selection workflow;
- browser-to-shell execution;
- raw log search or unrestricted filesystem browsing;
- a new framework or backend when Core contracts can be extended;
- a mobile-first replica;
- decorative animation that competes with attention;
- a card-grid rewrite without a read-model contract;
- automatic Obsidian installation into the live Mind vault in this product phase.

## 21. Acceptance criteria

The first release of the 2.0 foundation is accepted when:

1. `operational-snapshot-v1` is served by Brain Core and validated in Console with Zod.
2. The snapshot is read-only, preserves projection provenance/privacy/safety fields, and does not write Mind.
3. Command Center makes Core state, read-model freshness, attention, active work, and next action visible in one viewport.
4. Optional provider failure produces an explicit degraded/error item and does not blank the home view.
5. The canonical state enum is used by the header, attention queue, cards, tables, and detail screens.
6. Hidden tabs do not run one-second or equivalent high-frequency polling.
7. Existing compatibility routes continue to work until their consumers migrate.
8. Scheduler, local-app, Infinite Brain, and infrastructure fixtures cover current, stale, degraded, unavailable, error, blocked, and pending states.
9. Source commit, runtime path, build mode, LaunchAgent identity, and endpoint readiness are inspectable in diagnostics.
10. The Obsidian widget contract is versioned and conformance-tested against the spec, adapter, plugin, and manifest.
11. Mutations remain Core-mediated, explicitly gated, and receipt-backed.
12. Keyboard/focus/error-boundary checks pass for the shell, Command Center, queue, palette, and action dialog.
13. Production build and service startup are tested separately from development mode.
14. No secrets, raw credentials, or unredacted sensitive Mind content appear in snapshots, events, search, or UI.
