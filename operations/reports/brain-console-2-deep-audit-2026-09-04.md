# Brain Console 2.0 Deep Product Audit

**Date:** 2026-09-04
**Repository:** Brain
**Mode:** audit, product design, information architecture, runtime modernization blueprint
**Implementation status:** audit only; no Console source, LaunchAgent, or live runtime mutation was performed

## Executive finding

Brain Console is a real, working specialist operations dashboard with a sound high-level safety boundary: the browser calls Brain Core, Brain Core owns operational actions, and projection envelopes provide a promising read-only contract. It is not yet a coherent Brain dashboard or Command Center.

The current experience is a collection of route-specific dashboards that happen to share a shell. It makes the operator read many status cards, remember where a signal lives, and interpret several incompatible freshness and availability vocabularies. The overview is a status wall, Infinite Brain is a mixture of runtime status and a large review console, and the shell exposes provider and implementation details as primary navigation. The product needs a material information-architecture and read-model restructuring, not a framework rewrite.

The most important operational finding is separate from the visual audit. The running Brain Core, Brain Console service, and nightly scheduler point to the detached `/Users/Office/Repos/stevewesthoek/brain-runtime` checkout, while this audit's source baseline is `origin/main` of `/Users/Office/Repos/stevewesthoek/brain` at `33616316369bfa3c1fd1e5a346c1e8f68aa4cdac`. The installed `Brain Console.app` is an `LSUIElement` shell that launches a browser URL, not a visible native window. This explains why a click can appear to do nothing and makes source-to-deployment identity a P1 reliability concern.

## Scope and evidence

The source audit uses exact files from `origin/main` so unrelated dirty checkout work does not become accidental product truth. The working checkout contains drift in Console components, schemas, scheduler files, and telemetry files. Any implementation phase must first resolve which source checkout is authoritative.

The live runtime inspection was read-only at approximately `2026-09-04 00:52 WEST`:

- `com.office.brain-core` was running on `127.0.0.1:4877`.
- `com.office.brain-console` was running on `127.0.0.1:4881`, with the service and Next development server listening.
- `com.office.nightly-scheduler` was loaded as a calendar-triggered LaunchAgent, not continuously running between triggers.
- The latest scheduler run started `2026-09-03T02:00:05.699Z`, ended successfully at `02:00:07.738Z`, executed the four active report-only jobs, and recorded no failed jobs.
- Current Console route requests returned HTTP 200, which proves route delivery but not successful client hydration.
- `GET /ai-model-selector/health-matrix` returned HTTP 502 in approximately three seconds during the probe.
- `GET /infra/telemetry` returned successfully in approximately 1.87 seconds and reported a stale `vm-supabase` host and failed backup state.
- The Mac visual re-inspection could not be completed because the Mac was locked and automatic unlock was unavailable. Earlier functional inspection showed the Console shell, Core Online state, pulse strip, host telemetry, and stale/backup warnings.

The source and runtime facts above are evidence for this audit, not authorization to repair them in this document.

## Scores

Scores use a 0 to 10 product scale, where 10 means coherent, dependable, and ready for the intended role.

| Dimension | Score | Finding |
|---|---:|---|
| Product maturity | 6 | Substantial specialist coverage, weak unification |
| Architecture | 7 | Core boundary and projection contract are strong; route and component seams are not |
| Information architecture | 4 | Flat implementation navigation exposes too many technical surfaces |
| UX and decision support | 4 | Status is visible, attention and next action are not |
| Visual system | 5 | Legible dark admin surface, generic and inconsistent in composition |
| Performance | 5 | Local responses are mostly fast, but polling and duplicate queries are expensive |
| Reliability | 5 | Keepalive services work; identity, dev artifacts, and endpoint variance remain risky |
| Brain coverage | 4 | Many endpoints exist, but task, evidence, context, and continuity are not first-class UI objects |
| Obsidian integration | 5 | Clear boundary and plugin package, but installation and widget contract are incomplete |
| Mac operational UX | 6 | Service autostart is present; app launch behavior is opaque and non-native |

**Overall product readiness:** 5/10.
**Verdict:** `SUBSTANTIALLY RESTRUCTURED`. Keep the stack and Core boundary. Restructure the information architecture, read model, state language, component boundaries, and Mac identity before calling this the primary dashboard.

## Route inventory

The route pages in `origin/main` are thin wrappers around substantial client dashboards. The route count is manageable; the problem is that every domain is promoted to the same navigation level.

| Current route | Current purpose and data | Current quality / duplication | Disposition and 2.0 destination |
|---|---|---|---|
| `/` | Overview, Graphify status, Mind Steward status, Infinite Brain dashboard | Too vertical; mixes health, maintenance, review, and projection cards | Replace with Command Center |
| `/ai-models` | Model/provider health matrix from `/ai-model-selector/health-matrix` | Provider selection framing conflicts with automatic Brain routing; live probe returned 502 | Keep as Brain > Capability Routing detail, read-only |
| `/local-apps` | App dashboard, readiness, action status, lifecycle actions | Useful operational surface; source/docs disagree on page size | Keep as Operations > Local Apps detail |
| `/infrastructure` | Resource catalog, relations, incidents, safety, freshness, backups | Valuable but dense; overlaps telemetry and provider pages | Merge into Computer > Overview |
| `/dokploy` | Dokploy status, applications, compose services, credential metadata | Provider-specific top-level route duplicates infrastructure | Move to Computer > Providers > Dokploy |
| `/monitoring` | New Relic host and synthetic monitoring | External-provider detail overlaps canonical telemetry | Move to Computer > Observability > External telemetry |
| `/tunnels` | Cloudflare tunnel status, hostnames, online state | Narrow connectivity detail | Move to Computer > Network > Tunnels |
| `/scheduler` | Canonical scheduler registry, lifecycle, latest result, receipts, bounded history | Closest to a useful operations detail; table is still wide and unfiltered | Keep as Operations > Scheduler |
| `/video-analyzer` | Research video analysis form and recent history | Specialist workflow, not a system-health concern | Move to Work > Research > Video Analysis |
| `/aws-video` | Video pipeline, jobs, review, generation, publish, activity | 1,711-line stateful workflow with mutations and long waits | Keep as Work > Video Pipeline detail with focused subroutes |
| `/settings` | Core URL, ports, safety boundary, legacy portal wording | Does not describe the real source/runtime identity or app launch model | Replace with Settings > Connections, Safety, Appearance, Runtime |

## Component and implementation inventory

| Component | Evidence in `origin/main` | Audit finding | 2.0 disposition |
|---|---|---|---|
| `components/shell.tsx` | Static nav and Core status query at lines 12-96 | Navigation overload; no global search or command palette; status/header and pulse compete | Rebuild shell around grouped IA and a unified header |
| `components/global-pulse-strip.tsx` | `/ops/system-metrics` every 1s; usage and cost every 5s at lines 34-45 | Global polling and repeated rendering on every route | Replace with read-model summary and opt-in detail polling |
| `components/overview-dashboard.tsx` | Graphify and Mind Steward cards at lines 28-193; mounts Infinite Brain | Status wall and duplicate polling; no attention queue | Thin Command Center consumer |
| `components/infinite-brain-dashboard.tsx` | Runtime, flags, readiness, maintenance, atomizer through report-only pipeline | Too many concepts in one screen; status-centric | Split summary, orchestration, evidence, gates, continuity |
| `components/infinite-brain-projection-overview.tsx` | 13 projection cards, 30s polling | New envelope layer rendered as a card grid instead of a model | Make projections the underlying read model, not the visual structure |
| `components/infinite-brain-proposal-review.tsx` | 2,335 lines; many reads and writes; lines 1-8 show broad schema/action import | Monolithic review/control surface with high cognitive and safety load | Move to Review & Gates; split query, policy, preview, approval, and receipts |
| `components/aws-video-dashboard.tsx` | 1,711 lines; overview/jobs/create/review/publish/activity; long mutations | Monolithic specialist workflow; publish controls mixed with monitoring | Extract workflow routes and action boundary; keep outside Command Center |
| `components/local-apps-dashboard.tsx` | Dashboard, readiness, action status, lifecycle actions | Good domain behavior; JSON and policy details need progressive disclosure | Preserve as focused detail and action center |
| `components/scheduler-dashboard.tsx` | Canonical job table and `JobDetail` lifecycle/receipt/policy model | Strongest existing detail pattern; needs filtering, attention sorting, compact rows | Use as Operations reference implementation |
| `components/infrastructure-dashboard.tsx` | Resource, relation, incident, safety, runtime, freshness, backup data | Useful canonical catalog, but too much in one page | Decompose into Computer subviews |
| `components/canonical-infrastructure-telemetry.tsx` | Three hosts, CPU/memory/storage/network/Docker/systemd/backup | Real observability data; slowest important local endpoint | Use for Computer host detail and anomaly summaries |
| `components/monitoring-dashboard.tsx` | New Relic hosts and synthetics | Provider adapter surfaced as a primary product concept | Fold into external telemetry detail |
| `components/dokploy-dashboard.tsx` | Dokploy apps and compose data | Narrow provider detail | Fold into provider detail |
| `components/tunnels-dashboard.tsx` | Cloudflare tunnel inventory | Narrow network detail | Fold into Computer network detail |
| `components/ai-model-selector-dashboard.tsx` | Provider/model matrix and capabilities | Misleading manual-selector mental model after universal consumer rollout | Rename to Capability Routing and emphasize observed route/health |
| `components/video-analyzer-dashboard.tsx` | Research form and history | Valuable specialist feature, unrelated to home attention | Move to Work > Research |
| `components/status-badge.tsx` | String-to-class mapping | Does not encode canonical freshness, availability, severity, or actionability | Replace with typed state renderer |
| `lib/braincore-client.ts` | Central fetch, timeout, JSON parsing, HTTP and Zod errors at lines 18-67 | Good foundation; lacks request dedupe, tracing, retry policy, cancellation semantics | Extend as read-model client boundary |
| `lib/braincore-schemas.ts` | 1,785 lines and many endpoint schemas | Contract surface is broad and heterogeneous; some permissive records | Organize by domain and validate projection/read-model contracts first |
| `app/globals.css` | 1,860 lines; dark theme, media queries, many colors and effects | CSS and Tailwind dialects mix; visual rules are not tokenized | Consolidate tokens/primitives, then remove ad hoc styling |

## Data-source and authority inventory

The authoritative pattern is `source -> Brain Core adapter or projection -> typed Console client -> view`. The browser must not discover files, run shell commands, or call provider APIs directly.

| Source / projection | Brain Core surface | Authority and data | Refresh observed/current | Risk and 2.0 treatment |
|---|---|---|---|---|
| Core health and status | `/health`, `/status` | Brain Core runtime health | 5s in shell; probe sub-millisecond | Make header source for availability, separate service health from product attention |
| System resources | `/ops/system-metrics` | Derived local machine metrics | 1s in global pulse | Move to read model; pause when hidden; use anomaly-triggered refresh |
| AI usage and cost | `/ops/ai-usage-windows`, `/ops/ai-costs` | Derived provider accounting | 5s | Show budget risk summary, detail on demand; do not make provider choice manual |
| Projection health | `/projections/health` | Core-owned read-only projection envelope | 30s Console; probe fresh/available | Canonical freshness/availability source for dashboard summaries |
| Projection topology/services/contracts | `/projections/topology`, `/projections/services`, `/projections/contracts` | Derived infrastructure and contract views | 30s, some freshness unknown | Use for Brain/Computer drilldowns with provenance |
| Projection review/intelligence/evolution | `/projections/review`, `/projections/intelligence`, `/projections/evolution` | Derived Infinite Brain read models | 30s; live samples were empty/unavailable | Render explicit unavailable/not instrumented states, never blank zeros |
| Infinite Brain runtime | `/infinite-brain/status` and capability routes | Brain-owned runtime state | 30s | Build a bounded summary projection, retain detail routes |
| Mind maintenance | `/api/mind-maintenance/latest?mindRoot=...` | External Mind reference via environment path | 30s when configured | Remove direct Mind-root dependency from the client; Core should mediate reference and privacy |
| Graphify | `/graphify/status` | Derived repository graph status | 15s | Surface as index freshness, not a homepage card |
| Mind Steward | `/scheduler/mind-steward/status` | Scheduler job/runtime status | 15-30s | Fold into scheduler and attention read model |
| Local Apps | `/local-apps/dashboard`, readiness, action status | Brain-owned app catalog and safe lifecycle state | 5-10s | Preserve typed detail and explicit action receipts |
| Infrastructure catalog | `/infra/status` | Brain-owned resource and safety catalog | 15s | Computer overview and relations detail |
| Canonical host telemetry | `/infra/telemetry` | Adapter-backed hosts, systemd/Docker/backup signals | 15s UI; probe ~1.87s | Cache/aggregate; report stale host and failed backup as attention events |
| New Relic | `/infra/monitoring` | External telemetry provider through Core | 15s; probe ~0.28s | Provider detail under Observability |
| Dokploy | `/infra/dokploy` | External deployment provider through Core | 15s; probe ~0.166s | Provider detail under Computer |
| Cloudflare tunnels | `/infra/tunnels` | External network provider through Core | 15s; probe ~0.001s | Network detail; summarize offline tunnel only |
| Scheduler registry and receipts | `/infra/scheduler`, `/scheduler/*` | Canonical job registry, policy, receipts, history | 15s; live payload ~69.7KB | Use registry projection and event summaries; paginate history |
| Video analyzer | `/research/video-analysis/history`, `/research/video-analysis` | Brain research workflow | 20s/history | Keep specialist workflow |
| AWS video pipeline | `/api/video-orchestrator/*`, related routes | Brain-owned workflow state and gated actions | 5-120s by action | Keep detail; normalize job events and long-running action state |
| Obsidian plugin | Shared Core endpoints plus `/api/infinite-brain/decisions` | Obsidian is the long-form knowledge and Decision Center surface | Aggregate attention max 5m by spec | Deep-link to Console details; no second decision authority |

## Current data flow and target shape

```text
local runtime, scheduler, hosts, providers, Mind references
                    |
                    v
        Brain Core adapters and projections
        authority, provenance, freshness, privacy
                    |
                    v
     bounded operational read model / event ledger
                    |
          +---------+----------+
          |                    |
          v                    v
   Brain Console web      Obsidian plugin
   live visual cockpit    knowledge and decisions
          |                    |
          +---- deep links ----+
```

Today, most views skip the bounded middle layer and independently poll heterogeneous routes. That is the central source of duplication, inconsistent loading states, and a visually noisy dashboard. The projection envelope already contains the required safety and provenance vocabulary: contract, authority owner, freshness, confidence, privacy classification, availability, failure, and read-only flags. The product should make that contract the UI's model.

## Legacy, stale, and duplicated behavior

| Area | Classification | Evidence | Recommendation |
|---|---|---|---|
| Flat provider-first navigation | Legacy information architecture | `shell.tsx` nav at lines 20-33 | Replace with domain groups and utility search |
| Global pulse strip | Legacy composition | `/ops/system-metrics` 1s polling at `global-pulse-strip.tsx:34-45` | Replace with compact summary and detail route |
| Status-centric Infinite Brain wall | Legacy presentation | `overview-dashboard.tsx:198` mounts broad dashboard | Replace with attention-first summary and drilldowns |
| Huge proposal review component | Legacy component boundary | 2,335 lines and mixed reads/writes | Split behind review and safety gates |
| Manual AI model selector framing | Stale product language | Universal consumer rollout says Brain owns routing | Rename and make read-only capability health |
| Projection overview card grid | Transitional | Projection envelope is new, presentation is a 13-card grid | Retain contracts, redesign consumer around read model |
| Direct `NEXT_PUBLIC_MIND_ROOT` client dependency | Architectural residue | Infinite Brain dashboard fetches Mind maintenance directly | Core-owned Mind reference adapter with privacy metadata |
| `/monitoring`, `/dokploy`, `/tunnels` as top-level pages | Duplicated provider surfaces | All overlap canonical infrastructure telemetry | Fold into Computer hierarchy |
| Route-specific permissive schemas | Compatibility residue | Broad `z.record(z.unknown())` and 1,785-line schema file | Preserve compatibility, add typed domain/read-model schemas |
| Obsidian widget contract | Spec drift | Spec asks for ten IDs, `brain-core/src/obsidian.ts:15-34` defines eight | Make schema/spec/plugin contract test-driven and versioned |
| `docs/system/brain-console-roadmap.md` reference | Missing planning artifact | Architecture document references absent roadmap/implementation docs on baseline | This audit and modernization roadmap fill the planning gap; implementation should later reconcile references |
| Local Apps page-size rule | Documentation drift | Design docs describe 2x2 / four per page; source uses `APPS_PER_PAGE=8` | Choose one rule and contract-test it |
| “Obsidian primary, web optional” wording | Product contradiction | `projects/brain-console/README.md:4-16` and new vision | Define two-plane product role in this spec |

## What must be human-visible

The home screen should answer, in order: “Is Brain trustworthy right now?”, “What needs my attention?”, “What is active?”, and “Where do I go next?” It should not require the operator to inspect every subsystem.

| Information | Home | Secondary | Detail / search | Default treatment |
|---|---|---|---|---|
| Overall system health | Yes | Computer | Core health | One clear state with explanation |
| Active work | Yes | Brain | Task/job detail | Current, owner, progress, next action |
| Attention and blocked items | Yes | Operations | Event/receipt detail | Sorted by severity and actionability |
| Recent activity | Yes, bounded | Operations | Event history | Last meaningful changes, not raw logs |
| Domain/orchestrator | Summary | Brain | Orchestrator detail | Group by capability and state |
| Task and evidence packets | Count and latest | Brain | Packet detail | Provenance and uncertainty visible |
| Composition graphs | Count/health | Brain | Graph view | On demand, not a card wall |
| Quality and safety gates | Failed/pending count | Brain | Gate detail | Never hide safety state |
| Continuity and resumability | Summary | Brain | Session/task detail | Show next action and confirmation needs |
| Consumer and capability routing | Routing health | Brain | Capability detail | Brain chooses provider; UI explains result |
| Shared capability provider | Health summary | Brain | Provider detail | No manual provider picker on home |
| Context budget and atomicity | Warning/count | Brain | Task packet detail | Explain budget and bounded step |
| Index freshness | Warning/count | Computer / Brain | Index detail | Fresh, stale, unavailable by source |
| Local apps | Incidents only | Operations | App detail/actions | Do not list every app on home |
| Machine, services, scheduler, tunnels | Anomaly count | Computer / Operations | Entity detail | Summarize only non-normal state |
| Repos and Git | Work summary | Brain | Repo detail | Active branch/worktree and drift only |
| Obsidian links | Utility | Knowledge | Deep link | Link to Decision Center/knowledge context |
| Model, cost, performance | Budget/degradation summary | Brain / Computer | Metric detail | Avoid provider operations as home content |
| Errors and degraded states | Yes | Everywhere | Error detail | Never silently collapse to “offline” |

## Information architecture decision

Three options were considered:

1. **Flat navigation:** minimal migration, but preserves technical overload and makes every provider a peer.
2. **Domain navigation:** groups current pages into Brain, Computer, Operations, and Work; improves findability but can still leave the home screen as a dashboard of cards.
3. **Two-plane cockpit:** Console owns live operational state and visual drilldowns; Obsidian owns durable knowledge, long-form context, and Decision Center; both use Core and deep-link to each other.

Option 3 is selected. It honors the current Obsidian boundary without forcing the browser to become a second knowledge vault, and it gives the web Console a clear reason to exist: live operations and attention.

### Proposed navigation

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

Provider pages, individual machine pages, and specialized review packets are detail routes. They are not top-level concepts.

## Command Center design

The above-fold layout should be a single visual sentence: **“Brain is [state]; these [N] items need attention; [active work] is progressing; here is the next safe action.”**

Recommended order:

1. Header: Core availability, read-model freshness, last update, search/command palette, theme, and an explicit “live paused” indicator when the tab is hidden.
2. Attention rail: critical, degraded, stale, blocked, pending approval, and failed backup/job items with source, age, owner, and safe next action.
3. Active work: up to five running tasks/jobs with progress state, current atomic step, selected capability route, and link to evidence.
4. System posture: compact Brain, Computer, Scheduler, and Knowledge summaries. Each summary is actionable and links to a detail view.
5. Recent meaningful activity: bounded event stream with filters, not raw logs.
6. Contextual recommendation: one explanation of the highest-value next step, never an automatic mutation.

The Command Center should be useful when all systems are healthy, but it should spend visual area on anomalies when they exist. A healthy system is a compact baseline, not a wall of green cards.

## Infinite Brain UI blueprint

Infinite Brain should be represented as an orchestration product, not as a list of internal subsystems. The summary view should expose:

- Current runtime state and whether execution is report-only, approval-gated, or enabled.
- Active task count, current atomic step, owner, specialist, and next action.
- Evidence confidence, uncertainty, conflicts, source references, and freshness.
- Quality and safety gate outcomes, including why a gate is pending or blocked.
- Continuity state, resumability, confirmation requirements, and rollback/cleanup posture.
- Consumer and capability resolution, showing native, shared provider, approved alternative, or unavailable without asking the user to select a model.
- Context budget used, remaining, and whether the step is bounded.

Each concept drills down to a focused route:

| Detail | Required contents |
|---|---|
| Active orchestration | Task packet, state machine, owner, specialist, next action, timing |
| Task packet | Objective, scopes, permissions, plan, execution mode, evidence refs |
| Evidence packet | Inputs, outputs, claims, uncertainty, validation, side effects, continuation |
| Composition graph | Nodes, edges, source refs, derived status, graph freshness |
| Quality and safety gates | Gate name, result, policy, evidence, human confirmation requirement |
| Continuity | Session/worktree/branch, checkpoint, stale hash, resume action |
| Consumer and capability | Requested capability, resolved provider, fallback path, quality and safety result |
| Context | Bootstrap layers, token/budget accounting, atomic step boundary, omitted context explanation |

The existing proposal review and metadata writer controls remain explicit, gated, and read-only by default. The home screen shows their aggregate attention state only. Obsidian remains the Decision Center; the web Console links to it and must not create a competing decision record.

## Computer observability blueprint

Computer is a hierarchy, not four provider pages:

```text
Computer overview
  -> hosts and services
  -> containers and deployments
  -> backups and storage
  -> network and tunnels
  -> external telemetry
  -> provider details
```

The current telemetry provides host resource, Docker, systemd, network, and backup data, but the operator still needs normalized service identity and correlation. The target read model should join:

- host identity and source revision;
- process/service/container status;
- scheduler and Console/Core LaunchAgent identity;
- endpoint health and response latency;
- backup freshness and failure reason;
- tunnel and hostname reachability;
- external telemetry references;
- source/deployment revision and drift state;
- privacy classification and redaction status.

Missing or insufficient collectors include a first-class Console app launch receipt, LaunchAgent source identity, visible browser/window launch result, stale development artifact detection, port ownership preflight, and a normalized service dependency graph. These are required to make “always operational” observable rather than inferred from one process being alive.

## Telemetry, read model, and event model

### Current state

`braincore-client.ts` already centralizes timeout, JSON parsing, HTTP errors, and Zod validation. The projection envelope is the strongest contract in the repository. Most screens still use direct route-specific queries, and some routes return permissive or incompatible shapes. The result is repeated fetches for the same state, independent failure handling, and no stable home-screen snapshot.

### Target read model

Create a Core-owned, read-only `operational-snapshot-v1` projection assembled from existing adapters. It should not replace compatibility routes immediately. It should contain:

- snapshot ID, generated timestamp, source revision, and read-model revision;
- overall state and severity;
- sections for attention, active work, Brain, Computer, Operations, and Knowledge;
- per-item entity ID, domain, state, severity, age, freshness, availability, provenance, privacy classification, and safe links;
- bounded event summaries and last meaningful activity;
- errors and unavailable sources as explicit typed objects;
- read-only, writes-to-Mind false, and execution-enabled false flags for the snapshot itself.

Use projection envelopes inside sections or preserve their fields when aggregating. Do not flatten away authority owner, uncertainty, privacy, or failure details.

### Request behavior

- Query the snapshot once per visible Command Center, with a shared cache key.
- Pause or lengthen polling when the tab is hidden.
- Use endpoint-specific refresh budgets, not a universal one-second timer.
- Abort requests on navigation and stale response replacement.
- Prefer conditional requests or Core revision checks.
- Use one request for shared header/summary state; do not let each card independently refetch the same source.
- Keep mutations separate from read-model refresh and require receipt-based confirmation.

### Event model

Adopt a Core-owned normalized ephemeral event ledger projection. The UI must not manufacture authoritative events from rendered state. Each event should include `eventId`, `eventType`, `occurredAt`, `severity`, `domain`, `entityRef`, `action`, `status`, `sourceRef`, `provenance`, `privacyClassification`, and related receipt/task/evidence links. Retention should be bounded and privacy-aware. Durable meaning and decisions belong to Mind or the Obsidian Decision Center; operational facts remain in Brain/Core projections.

## Search and indexing

Search should be a global `Cmd/Ctrl-K` palette with keyboard-first navigation and command execution preview. It should search a Core-owned index of:

- routes and capabilities;
- running tasks, jobs, sessions, repos, hosts, services, and local apps;
- evidence packets, receipts, gate names, and event summaries;
- Obsidian deep-linkable decision references and graph/index freshness.

Search results must carry authority, freshness, privacy classification, and deep-link target. Search should not expose raw secrets, full provider credentials, raw logs, or unredacted Mind content. Commands that can mutate state should show intended action, target, safety gate, confirmation requirement, and expected receipt before execution.

Graphify should be represented as index freshness and graph capability. It should not become a second source of truth for runtime state.

## Obsidian relationship

The Console and Obsidian should be complementary surfaces over Brain Core:

- Console: live operational posture, attention, tasks, evidence, infrastructure, receipts, and safe actions.
- Obsidian: durable knowledge, long-form context, personal meaning, Decision Center, and human-authored decisions.
- Brain Core: API, control, safety, provenance, and read-only projection boundary.
- Mind: meaning and personal knowledge, with protected write policy.

Use stable deep-link IDs, not copied Markdown state. A Console item should link to an Obsidian decision or note only when a valid reference exists. The plugin should link back to Console detail with entity and revision parameters. No automatic approval calls should be initiated by a notice or deep link.

The current Obsidian contract is P1 drift: `operations/specs/brain-console-obsidian-plugin.md` requires ten widget IDs, while `projects/brain-core/src/obsidian.ts:15-34` defines eight, including `brain-skills` and `brain-video-queue` rather than the specified orchestrators, capabilities, video, and runtime-reports IDs. Resolve by versioning the contract and adding conformance tests across spec, adapter, plugin, and installed state.

## Mac app and autostart audit

| Surface | Observed state | Product impact | Required target |
|---|---|---|---|
| Brain Core LaunchAgent | Loaded and running on 4877 with keepalive/run-at-load | Good service baseline | Keep, but expose identity and readiness receipt |
| Brain Console LaunchAgent | Loaded and running on 4881 with keepalive/run-at-load | Service can be alive even when browser is not visible | Keep, add launch receipt and source manifest |
| Nightly scheduler LaunchAgent | Loaded, calendar-triggered, not continuously running | Correct for a scheduled job; “operational” means trigger readiness, not always-running process | Show next trigger, last receipt, lock state, and policy-blocked count |
| Installed `Brain Console.app` | `LSUIElement=true`; wrapper invokes Node launcher and opens URL | Click can appear to do nothing; no visible native app state | Provide visible activation feedback, browser/window receipt, and an explicit reopen action |
| App source path | `/Users/Office/Repos/stevewesthoek/brain-runtime` | Detached runtime identity is hard to audit and can diverge from source | Deploy from pinned commit with manifest and health endpoint |
| Console server mode | Next development server in live process tree | Dev artifacts and hot-reload state can create stale or broken UI | Use production build/server for always-on service |
| Source audit checkout | `brain` at `origin/main` SHA above, with dirty unrelated changes | Audit and deployed behavior can differ | Add source/deployment identity to status and release checklist |

The product requirement “always operational” must be split into four observable states: process alive, endpoint ready, data model healthy, and user surface visible. Current runtime proves the first two for Core and Console at the inspection time. It does not prove that clicking the app will produce a visible window.

## Performance audit

| Measurement | Observed | Interpretation / target |
|---|---:|---|
| Core `/health`, `/status` | ~0.001s | Healthy baseline; preserve |
| Core `/infra/scheduler` | ~0.008s, ~69.7KB | Reduce payload for summary; paginate detail |
| Core `/infra/telemetry` | ~1.87s, ~22.9KB | Cache and aggregate; target summary under 500ms locally |
| Core `/infra/monitoring` | ~0.28s | Acceptable detail; summary should be cached |
| Core `/infra/dokploy` | ~0.17s | Provider latency should not block home |
| Core `/local-apps/dashboard` | ~0.43s | Detail acceptable; home uses counts only |
| Core `/ai-model-selector/health-matrix` | ~3.0s, HTTP 502 | Must degrade explicitly and never block Command Center |
| Global system metrics polling | Every 1s on every route | Primary avoidable cost; budget by visibility and importance |
| Usage/cost polling | Every 5s on every route | Replace with shared summary and detail cadence |
| Infinite Brain / Mind maintenance | 30s per multiple components | Deduplicate through read model |

Initial target budgets: Command Center first meaningful posture under 1s from cached data, no more than one summary request per refresh window, critical attention update within 10s, detail views within 2s or explicit loading progress, and zero hidden-route polling.

## Reliability and state language

Every data-bearing component should use one typed state vocabulary:

| State | Meaning | Required UI |
|---|---|---|
| `CURRENT` | Source responded within its freshness budget | Value, age, provenance |
| `STALE` | Last value exists but freshness budget exceeded | Value, age, refresh action, warning |
| `DEGRADED` | Partially available or policy-limited | What is missing and impact |
| `UNAVAILABLE` | Source intentionally not instrumented or disabled | Reason and expected alternative |
| `ERROR` | Request or validation failed | Human-readable error, retry, source |
| `BLOCKED` | Policy or safety gate prevents action | Gate, evidence, safe next step |
| `PENDING` | Action or confirmation is in progress | Receipt, timeout, cancel/review path |

Blank cards, infinite spinners, `0` for unknown, and “offline” for every failure are prohibited. Add route-level error boundaries, one retry policy, request correlation IDs, and a global “data is paused” indicator.

## Design audit

### Impeccable preflight

`IMPECCABLE_PREFLIGHT: context=pass product=missing design=missing command_reference=pass shape=not_required image_gate=skipped:audit-only mutation=closed`

The project has no `PRODUCT.md` or `DESIGN.md` in `projects/brain-console`. The visual audit therefore uses repository source, current system documentation, and the explicit product goal. No design teaching/documentation files were invented, and no automated Impeccable CLI score is claimed.

### Visual and interaction findings

The current UI is readable and operationally recognizable, but it leans on generic dark admin-dashboard patterns: many bordered cards, gradients/translucent surfaces, duplicated status badges, and dense implementation detail. `globals.css` is 1,860 lines with hard-coded colors and effect rules. Components also use raw Tailwind classes and inline styles, creating two competing visual dialects. The page has responsive breakpoints and reduced-motion handling, but no demonstrated information model for narrow windows, keyboard-first operation, or high-density alert triage.

Recommended direction: a calm instrument panel, not a sci-fi control room. Use restrained tinted neutrals, one semantic accent per state, strong typography hierarchy, compact tables for operational lists, purposeful whitespace around attention, and no decorative gradient/glass treatment behind every card. Keep Geist for interface text and Geist Mono for IDs, timestamps, revisions, and machine values. Reserve color for state, not decoration.

### Nielsen heuristic score, manual source audit

Scored 0 to 4 per heuristic, where 0 is absent and 4 is strong.

| Heuristic | Score | Finding |
|---|---:|---|
| Visibility of system status | 2 | Many statuses exist, but freshness and readiness are inconsistent |
| Match to real-world concepts | 2 | Technical route names and provider-first navigation leak implementation concepts |
| User control and freedom | 2 | Actions are gated, but long-running workflows and navigation lack clear cancellation/resume model |
| Consistency and standards | 1 | State vocabulary, CSS dialects, route groupings, and widget contracts drift |
| Error prevention | 3 | Core-only actions, explicit approvals, and safety flags are strong |
| Recognition over recall | 2 | Operator must remember which route contains each signal; no global search |
| Flexibility and efficiency | 1 | No command palette, saved views, or attention-first triage |
| Aesthetic and minimalist design | 1 | Overview and proposal review expose too much simultaneously |
| Error recovery | 2 | Client has timeout and shape errors, but screens vary in recovery UX |
| Help and documentation | 1 | Architecture docs exist, but in-product guidance and source/runtime identity are weak |
| **Total** | **17/40** | **Poor, despite strong underlying safety intent** |

### Technical design score, manual source audit

| Dimension | Score | Finding |
|---|---:|---|
| Accessibility | 2/4 | Native controls exist, but focus-visible, keyboard model, landmarks, and live regions are not systematic |
| Performance | 2/4 | Duplicate polling and slow telemetry are visible risks |
| Theming | 1/4 | Dark mode exists, but colors/effects are not a disciplined token system |
| Responsive behavior | 2/4 | Breakpoints exist; dense operational layouts lack a defined narrow-window strategy |
| Anti-pattern resistance | 1/4 | Long pages, giant components, raw JSON, and card walls remain |
| **Total** | **8/20** | **Poor** |

### Priority findings

| Priority | Finding | Evidence | Consequence |
|---|---|---|---|
| P1 | No attention-first home model | `overview-dashboard.tsx:181-198`; multiple independent status sections | Operator cannot quickly distinguish action from background health |
| P1 | Navigation overload and no global search | `shell.tsx:20-33` | Findability depends on route memory |
| P1 | Heterogeneous read contracts | `braincore-schemas.ts`, route-specific queries | Inconsistent state, refresh, and error semantics |
| P1 | Source/deployment identity drift | Live services use detached `brain-runtime`; audit uses `brain` origin/main | Fixes may not reach the running product; diagnosis becomes ambiguous |
| P1 | Mac app is an invisible URL launcher | `LSUIElement=true`, Node wrapper, `/usr/bin/open` behavior | User click can produce no visible feedback |
| P1 | Obsidian widget contract mismatch | `brain-core/src/obsidian.ts:15-34` versus plugin spec | Plugin health and expected cockpit surface can disagree |
| P1 | Provider health can block or confuse the product | `/ai-model-selector/health-matrix` probe returned 502 in ~3s | Home needs bounded degradation and Brain-owned routing language |
| P1 | Polling cost and slow telemetry | `global-pulse-strip.tsx:34-45`; `/infra/telemetry` ~1.87s | Unnecessary load and delayed first posture |
| P1 | Monolithic workflow components | proposal review 2,335 lines; AWS video 1,711 lines | Changes are risky and visual consistency is expensive |
| P2 | No systematic focus-visible/error boundary model | Source search found hover/input focus patterns but no clear global focus contract | Keyboard and failure recovery are inconsistent |
| P2 | Raw JSON and implementation data in normal views | Local Apps policy/actions and large review screens | Cognitive overload and unclear action affordance |
| P2 | Provider-specific top-level routes | Monitoring, Dokploy, Tunnels | IA mirrors adapters rather than user jobs |
| P2 | Settings has stale portal wording | `app/settings/page.tsx` | Product role is unclear to the operator |
| P2 | Local Apps documentation/source mismatch | Design docs say four per page; source sets eight | Trust and acceptance criteria drift |
| P3 | Customization is absent | No saved layouts or density preference surfaced | Useful later, after information model stabilizes |
| P3 | Mobile is not a primary target | Desktop-first architecture and dense detail | Define tablet/narrow-window behavior, do not promise phone parity yet |

## Keep, remove, and reshape matrix

| Keep | Remove from primary navigation | Reshape |
|---|---|---|
| Brain Core boundary and typed client | Provider-first AI Models label | Command Center from overview/status wall to attention read model |
| Projection envelope and provenance | Separate Dokploy, Monitoring, Tunnels peers | Infinite Brain into orchestration/evidence/gates/continuity |
| Scheduler registry, receipts, policy | Global one-second pulse strip | AWS Video into focused workflow routes |
| Local Apps safe actions | Duplicate decision center in web | Obsidian links and decision refs |
| Canonical host telemetry | Raw JSON as default presentation | Status badge into typed state renderer |
| Core-only mutations and approvals | Direct client Mind-root dependency | CSS/Tailwind into tokenized primitives |
| Obsidian as knowledge and decision plane | Automatic provider/model selection UI | Search/index as first-class utility |

## Gap matrix

| Capability | Current state | Expected state | Missing data/API | Missing UI/reliability | Priority |
|---|---|---|---|---|---:|
| Command Center | Overview card stack | Attention-first operational posture | Aggregated snapshot | New home, event summaries | P1 |
| Attention queue | Distributed warnings | One sorted queue with safe next actions | Normalized event/attention projection | Queue, filters, receipts | P1 |
| Freshness semantics | Route-specific values | One typed state vocabulary | Shared freshness policy | State renderer and age | P1 |
| Task/evidence model | Core contracts exist, weak UI | First-class drilldowns | Read-model joins and links | Packet/evidence pages | P1 |
| Capability routing | Matrix / selector framing | Explain Brain route without manual selection | Route receipt and fallback reason | Capability detail | P1 |
| Computer observability | Multiple pages/adapters | Correlated host/service/deployment posture | Service identity and launch receipt | Computer hierarchy | P1 |
| Mac app | Background URL launcher | Visible activation and readiness feedback | Launch result/identity endpoint | App shell or reliable browser surface | P1 |
| Source identity | Detached runtime not surfaced | Pinned deploy manifest | Commit/build/runtime identity | Header/settings diagnostics | P1 |
| Obsidian | Plugin package, uninstalled, contract drift | Versioned conformance and deep links | Contract reconciliation | Plugin health and links | P1 |
| Scheduler | Strong detail, large payload | Attention summary plus filtered detail | Bounded summary/event projection | Operations views | P1 |
| Search | Not present | Global command/search palette | Core index | Keyboard UI and redaction | P1 |
| Performance budget | Independent polling | Shared cache and visibility budgets | Snapshot and revision checks | Query policy | P1 |
| Accessibility | Partial | Keyboard/focus/live region baseline | None, mostly UI contract | QA and primitives | P2 |
| Design system | Mixed CSS/Tailwind | Tokenized semantic primitives | Token inventory | Refactor styles | P2 |
| Customization | None | Saved views/density later | Preferences contract | Settings UI | P3 |

## Security and privacy

The Core-only mutation boundary is correct and must remain. The Console should expose action intent and receipts, not secrets or arbitrary machine logs. Mind references, decision text, provider credential metadata, and evidence should carry privacy classifications. Search indexes must redact sensitive values. Projection envelopes already provide `privacyClassification`, authority, provenance, and read-only safety flags; these fields must survive aggregation. The UI must never infer authority from a display label or allow a deep link to bypass approval, stale-hash, or confirmation gates.

## Final verdict

Brain Console 2.0 should be a **substantial restructuring of the existing product**, not a full rebuild. Keep Next.js, React, TanStack Query, Zod, Lucide, Brain Core, the projection envelope, and the Core-only action model. Change the product center of gravity from route inventory to operator attention.

The first implementation should establish the canonical operational read model and state vocabulary. Once that exists, Command Center, Infinite Brain, Computer, Operations, and Obsidian integrations can become consistent consumers instead of independent polling islands.

**What not to build:** a second Mind/Decision Center in the web app, a manual model/provider picker, a new browser-to-shell path, raw log search, an unrestricted autonomous control panel, or a framework rewrite before the read-model and source-identity contracts are stable.

## Component-library decision

**Decision:** adopt the existing compatible primitives selectively; do not perform a foundation migration.

The current React, TanStack Query, Zod, Lucide, and CSS/Tailwind stack is capable of the target product. A selective Radix/shadcn-compatible foundation is justified for accessible dialogs, sheets, popovers, menus, tabs, command palette, tooltips, and resizable panels, but only as primitives with Brain-specific state and evidence semantics. The cost of a wholesale library migration would be high and would not solve the more important read-model and IA problems. Build the state renderer, attention queue, evidence reference, gate result, receipt, and command primitives first; introduce compatible primitives behind stable interfaces and migrate route-by-route.

## Final report ledger

The required top-level audit counts are:

- **Routes/features audited:** 11 route pages plus the shared shell, pulse strip, projection layer, major domain dashboards, Core contracts, Obsidian plugin, and Mac runtime.
- **Keep:** 8 foundational/domain surfaces, including Brain Core boundary, projection envelope, typed client, scheduler registry, Local Apps actions, canonical telemetry, Core-only mutations, and Obsidian knowledge boundary.
- **Redesign:** 7, including shell, Command Center, state renderer, Infinite Brain summary, capability routing, Computer overview, and visual primitives.
- **Merge:** 5, including Infrastructure with canonical telemetry, New Relic with external observability, Dokploy with providers, Tunnels with Computer network, and scheduler/Mind Steward status with Operations.
- **Remove from primary navigation:** 6 technical/provider-first entries, including standalone AI Models, Dokploy, Monitoring, Tunnels, the global pulse strip, and the status-wall overview pattern. Their useful detail is retained where applicable.
- **Unknown / investigate:** 3 runtime/install questions, including the authoritative deployment checkout, the final visible Mac activation model, and the live Obsidian installation state.

These counts describe product disposition, not mass deletion. Specialist details and compatibility routes remain available until migration evidence and rollback paths exist.
