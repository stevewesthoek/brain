# Brain Console 2.0 Modernization Roadmap

**Date:** 2026-09-04
**Baseline:** Brain `origin/main` at `33616316369bfa3c1fd1e5a346c1e8f68aa4cdac`
**Runtime observed:** `/Users/Office/Repos/stevewesthoek/brain-runtime`, detached at `46bec0626b3d61c35f5f7da3b1a538c17978a4e2`
**Strategy:** incremental restructuring, Core-first, reversible migrations
**Scope:** product architecture, UX, read model, reliability, and Mac operational identity; not a framework rewrite

## Outcome

The roadmap moves Brain Console from a route collection to an attention-first cockpit while preserving Brain Core as the sole operational API and safety boundary. Obsidian remains the durable knowledge and Decision Center plane. The existing routes remain compatibility surfaces until each consumer is migrated.

The work is deliberately sequenced. The read model and state vocabulary come before visual redesign, because a better card layout around fragmented queries would preserve the current problem. Source/deployment identity is addressed before declaring the Mac surface always operational, because the currently running services point at a detached `brain-runtime` checkout while the product source lives in `brain`.

## Priority model

| Priority | Meaning | Examples |
|---|---|---|
| P0 | Trust or operational identity gate | Source/runtime identity, production service mode, Core availability |
| P1 | Required for the Command Center product promise | Operational snapshot, attention queue, IA, state vocabulary, search, Obsidian contract |
| P2 | Required for a polished and maintainable release | Accessibility baseline, component decomposition, design tokens, responsive detail |
| P3 | Valuable after the model is stable | Saved views, advanced customization, deeper visualizations |

## Phase 0, contract and identity freeze

**Priority:** P0
**Goal:** establish what source, runtime, and product authority are being changed.

### Scope

- Record the selected Console source repository, commit, build mode, and deployment path.
- Decide whether the live runtime will be rebuilt from `brain` or whether `brain-runtime` becomes a formally versioned deployment artifact.
- Add a source/deployment identity manifest to the runtime diagnostics contract.
- Confirm the two-plane role: Console for live operations, Obsidian for durable knowledge and Decision Center.
- Version the Obsidian widget contract and reconcile the specified ten IDs with the current eight-ID adapter.
- Freeze new top-level route additions until the new IA is accepted.

### Dependencies

None. This is a gate for all later work.

### Tests and evidence

- Read-only script proves the runtime path, commit, build mode, LaunchAgent labels, and listening ports.
- Contract test compares intended source identity with the running health response.
- Obsidian conformance fixture checks spec, Core adapter, plugin code, and manifest.
- Product sign-off records which surface owns each authority.

### Rollback

No production mutation is required. If a runtime identity change is attempted and fails, retain the existing LaunchAgents and restore the previous pinned deployment artifact using the normal service rollback procedure. Do not use an unpinned working tree as the fallback.

### Exit criteria

- A deployment manifest can answer “what source is running?” without exposing secrets.
- A clean source-to-runtime relationship is documented.
- The Obsidian contract has one versioned widget list and a failing test for drift.
- No new route or UI feature is accepted without naming its IA destination.

### Current progress (2026-09-04)

The contract foundation is implemented on the Phase 0/A branch: deployment identity diagnostics, the canonical state vocabulary, the versioned Obsidian widget contract, and the Core-owned bounded operational snapshot are covered by focused tests. The live `brain-runtime` deployment and LaunchAgents remain unchanged; physical source/runtime migration is still a Phase 0 operational blocker.

## Phase A, canonical operational read model

**Priority:** P1
**First implementation goal:** **Establish the canonical Brain Console operational read model and state vocabulary.**

### Why this is first

Current screens independently poll `/status`, projections, scheduler, telemetry, local apps, Mind maintenance, and provider routes. The global pulse polls system metrics every second and the overview mounts several status-heavy consumers. Until these sources have one bounded read model and common state semantics, any IA or visual redesign will merely rearrange inconsistent data.

### Scope

- Add Core-owned, read-only `operational-snapshot-v1` assembled from existing projection/adapters.
- Preserve `brain-core-projection-v1` envelope fields: authority owner, provenance, freshness, confidence, uncertainty, privacy classification, availability, failure, and safety flags.
- Add typed Console schemas for snapshot sections and the canonical state enum:
  `CURRENT`, `STALE`, `DEGRADED`, `UNAVAILABLE`, `ERROR`, `BLOCKED`, `PENDING`.
- Add a shared state renderer and freshness/age renderer.
- Add bounded attention and activity item shapes.
- Keep existing compatibility routes and do not add mutations.

### Likely files

- `projects/brain-core/src/adapters/` and projection types;
- `projects/brain-core/src/api/routes.ts` or an extracted route module;
- `projects/brain-console/lib/braincore-schemas.ts` or domain schema modules;
- `projects/brain-console/lib/braincore-client.ts`;
- new Console state primitives;
- contract and fixture tests under the existing test locations;
- the product spec in `operations/specs/brain-console-2-product-spec.md`.

### Tests

- Core route tests for complete, partial, stale, unavailable, and source-error aggregation.
- Zod contract tests for every section and safety field.
- Fixtures for zero active work, blocked scheduler jobs, stale host telemetry, failed backup, unavailable provider, and pending approval.
- Verify one optional provider failure does not prevent a valid snapshot.
- Verify no Mind writes, external mutations, or execution are possible from the snapshot route.
- Console typecheck and production build.

### Performance gates

- Home summary is one shared request per refresh window.
- Snapshot payload is bounded and smaller than the unpaginated scheduler payload.
- No hidden route continues high-frequency polling.
- Cached posture is visible under one second locally in a representative fixture run.

### Migration

Add the snapshot consumer behind a feature flag or route-level switch. Compare old route values and snapshot values in development and diagnostic mode. Do not delete old routes until parity evidence exists.

### Rollback

Disable the snapshot consumer and return Command Center to the existing overview route. Keep the Core endpoint and schemas versioned; do not silently reinterpret old routes. If the new route fails validation, show an explicit diagnostic error and retain compatibility data.

### Exit criteria

- Snapshot and state contracts pass in Core and Console.
- Command Center can render without direct card-level queries for its summary.
- Current, stale, degraded, unavailable, error, blocked, and pending fixtures are visibly distinct.
- Source, provenance, privacy, and safety fields survive aggregation.

### Current progress (2026-09-04)

`operational-snapshot-v1` and Console validation/state primitives are implemented. Command Center rendering, shared refresh ownership, and old-card migration have not started; Phase A is contract-ready but not presentation-complete.

## Phase B, Command Center and shell restructuring

**Priority:** P1
**Dependency:** Phase A

### Scope

- Replace the flat top-level nav with the grouped IA from the product spec.
- Replace the global pulse strip with a compact read-model header.
- Build attention queue, active work summary, system posture summaries, bounded activity, and next-action callout.
- Add global `Cmd/Ctrl-K` search/command palette entry point.
- Add route-level error boundary and a consistent unavailable/stale/error panel.
- Retain compatibility URLs and redirect or deep-link them into grouped destinations.

### Tests

- Navigation route map and deep-link tests.
- Snapshot fixture rendering tests for healthy and degraded states.
- Keyboard tests for navigation, palette opening, escape, focus return, and attention item activation.
- No duplicate read-model request when header and page consume the same query.
- Visual QA at desktop and narrow-window widths, including reduced motion.

### Migration

Ship the new Command Center at `/` while leaving specialist routes intact. Use links from old pages to new detail destinations. Remove old shell items only after route analytics or direct acceptance confirms discoverability.

### Rollback

Feature-flag the shell and home consumer. Re-enable the existing shell and overview without changing Core contracts.

### Exit criteria

- One viewport answers health, attention, active work, and next action.
- A provider outage produces a visible bounded degradation, not a blank page.
- The operator can reach any current specialist surface through the grouped IA or search.
- No global one-second polling remains on every route.

## Phase C, Brain and Infinite Brain drilldowns

**Priority:** P1
**Dependency:** Phase A; Command Center summary from Phase B recommended

### Scope

- Split `infinite-brain-dashboard.tsx` into summary, orchestration, evidence, gates, continuity, capability routing, and context views.
- Split `infinite-brain-proposal-review.tsx` into query/read, preview, policy, approval, execution readiness, and receipt modules.
- Move proposal and metadata writer controls out of home.
- Render task packets, evidence packets, composition graphs, quality/safety gates, and continuity using the existing versioned contracts.
- Rename AI Models concept to Capability Routing and make the matrix read-only.

### Tests

- Contract fixtures for the task-packet, evidence-packet, universal-consumer, continuity, and observation-projection schemas.
- Verify report-only and approval-gated actions cannot become execution-enabled through a UI state change.
- Verify stale hash, policy blocked, pending, and receipt states.
- Query and mutation tests ensure all actions continue through Core.
- Component tests prove the home view contains only aggregates, not proposal write controls.

### Migration

Keep the old proposal route available as a compatibility detail route while the new detail modules reach parity. Preserve action IDs and receipts.

### Rollback

Restore the previous detail component behind a feature flag. Do not roll back Core safety checks or delete generated evidence/receipts.

### Exit criteria

- Infinite Brain is understandable by job and lifecycle, not internal module inventory.
- Every action presents its gate, confirmation, and receipt path.
- Brain-owned capability routing is visible without requiring manual model selection.
- Obsidian remains the only durable Decision Center.

## Phase D, Computer and Operations consolidation

**Priority:** P1
**Dependency:** Phase A; source identity work from Phase 0

### Scope

- Combine Infrastructure, canonical telemetry, New Relic, Dokploy, and Tunnels under Computer.
- Add correlated host, service, process, container, deployment, backup, network, and provider identity.
- Keep Scheduler and Local Apps under Operations with compact summaries and focused details.
- Add source/deployment drift, LaunchAgent status, endpoint readiness, and visible app-launch receipt to Computer diagnostics.
- Paginate scheduler history and event activity.

### Missing Core/read-model evidence to add

- service identity and dependency relationships;
- expected versus running source revision;
- build mode and build timestamp;
- stale development artifact/preflight result;
- port ownership and endpoint readiness;
- app activation/window/browser launch result;
- backup age and normalized failure reason;
- scheduler trigger readiness versus process liveness.

### Tests

- Correlation fixtures for healthy host, stale host, failed backup, offline tunnel, provider timeout, and source drift.
- LaunchAgent/readiness diagnostics on a test user session.
- Scheduler receipt count and policy-blocked state parity tests.
- Local App action receipt and rollback tests.
- Payload size and pagination tests.

### Rollback

Keep the existing `/infrastructure`, `/monitoring`, `/dokploy`, `/tunnels`, `/scheduler`, and `/local-apps` routes available. Hide the consolidated navigation only if the new correlation view fails; retain read-only endpoint changes only when backward-compatible.

### Exit criteria

- Computer overview identifies anomalies without requiring the operator to visit five pages.
- A process-alive service with a broken endpoint is not labeled healthy.
- Scheduler shows trigger readiness, last receipt, next trigger, lock state, and policy blocks separately.
- Runtime diagnostics can explain the Mac app’s visible activation result.

## Phase E, search, indexing, and Obsidian integration

**Priority:** P1
**Dependency:** Phase A; Phase B palette shell

### Scope

- Create Core-owned bounded index for entities, routes, tasks, evidence, gates, receipts, activity, and Obsidian references.
- Add `Cmd/Ctrl-K` search with navigation and safe command preview.
- Add freshness and privacy fields to index results.
- Version and reconcile the Obsidian widget contract.
- Add Console-to-Obsidian and Obsidian-to-Console deep links using stable IDs and revisions.

### Tests

- Redaction tests for secrets, credentials, cookies, private keys, raw logs, and sensitive Mind text.
- Search result authority, freshness, privacy, and deep-link tests.
- Command preview tests for target, action, gate, confirmation, and expected receipt.
- Plugin conformance tests across spec, adapter, plugin, and manifest.
- No automatic approval or Mind Markdown runtime writes.

### Rollback

Disable indexing and palette commands while retaining direct navigation and existing Obsidian plugin behavior. Never delete durable Mind or Decision Center content as part of a UI rollback.

### Exit criteria

- A user can find a task, scheduler job, host, receipt, gate, or route without knowing its page.
- Search never exposes forbidden data.
- Deep links preserve entity identity and revision context.
- Obsidian and web roles are clear and non-competing.

## Phase F, Mac runtime and autostart modernization

**Priority:** P0/P1
**Dependency:** Phase 0; Phase A diagnostics; Phase D Computer view

### Scope

- Move Console service to a pinned production build and explicit deployment artifact.
- Decide and implement a visible Mac activation model: reliable browser window/tab activation or a visible native wrapper/menu-bar affordance.
- Add single-instance/reopen behavior and actionable failure feedback.
- Add readiness and launch receipts covering process, endpoint, data model, and visible human surface.
- Add stale build/port ownership preflight and graceful restart behavior.
- Keep scheduler trigger semantics distinct from always-on Core/Console service semantics.

### Tests

- Install/uninstall/upgrade test using a clean user session.
- Click app, verify visible window/tab, verify URL, verify Core online state.
- Kill/restart service and verify keepalive recovery.
- Break Core and verify Console gives a visible actionable state.
- Change source/runtime identity and verify diagnostics detect drift.
- Reboot/login test for LaunchAgent readiness.
- Verify production build does not depend on a stale development `.next` artifact.

### Migration

Run the new service in parallel only on a non-conflicting port or isolated test profile. Capture readiness evidence before changing the live LaunchAgent. Switch the LaunchAgent to the pinned artifact only after rollback files and health checks are staged.

### Rollback

Restore the last known pinned service artifact and LaunchAgent configuration. Preserve the previous app bundle until visible launch and restart tests pass. Do not fall back to a detached working tree.

### Exit criteria

- Clicking `Brain Console.app` produces visible, verifiable activation.
- Core and Console survive login/reboot and recover from process failure.
- The runtime reports source commit, build mode, path, LaunchAgent, port, readiness, and last failure.
- Production-mode serving is proven.
- “Always operational” is measured across all four states: process, endpoint, data, and human surface.

## Phase G, design system, accessibility, and performance hardening

**Priority:** P2
**Dependency:** Phases A through D; do not start broad styling before the information model is stable

### Scope

- Consolidate color, spacing, typography, and state tokens in `globals.css` and primitives.
- Remove decorative gradients/glass effects where they compete with attention.
- Replace card walls with tables, rows, timelines, and disclosure panels according to meaning.
- Add consistent focus-visible, landmarks, live regions, keyboard handling, and error boundaries.
- Define narrow-window behavior for tables, filters, and action controls.
- Add density preference only after defaults are validated.

### Tests

- Keyboard-only smoke test of all primary journeys.
- Screen-reader checks for state changes, errors, dialogs, tables, and palette.
- Reduced-motion test.
- Contrast and color-independent state test.
- Lighthouse-like local performance budget or equivalent measured fixture.
- No hidden polling and no unbounded list rendering.

### Rollback

Keep semantic primitives compatible and revert page-level styling independently. Do not revert state semantics or Core contracts with visual changes.

### Exit criteria

- Manual heuristic score improves from the current audit baseline.
- Command Center, Scheduler, Brain detail, and Computer detail pass accessibility and responsive acceptance.
- Performance targets in the product spec are met with representative degraded sources.

## Cross-phase test matrix

| Area | Required test | Release gate |
|---|---|---|
| Source identity | Running path/commit/build/LaunchAgent matches manifest | P0 |
| Core availability | Health, status, snapshot timeout and recovery | P0 |
| Read model | All state/freshness/availability variants | P1 |
| Safety | No browser shell/provider access; mutations remain Core-gated | P0 |
| Infinite Brain | Task/evidence/gate/continuity/consumer contract parity | P1 |
| Scheduler | Registry, receipt, trigger, block, history, lock states | P1 |
| Computer | Process versus endpoint versus data versus visible surface | P0/P1 |
| Mac | Click, reboot/login, kill/restart, Core outage, visible feedback | P0/P1 |
| Obsidian | Widget contract, redaction, deep link, no automatic approval | P1 |
| Search | Index privacy, authority, freshness, command preview | P1 |
| Accessibility | Keyboard, focus, live regions, reduced motion, contrast | P2 |
| Performance | Payload, polling, hidden tab, first posture, provider failure | P1/P2 |
| Compatibility | Existing routes and receipts remain valid during migration | Every phase |

## Top ten product priorities

1. Pin and expose source/deployment identity.
2. Ship `operational-snapshot-v1` from Core.
3. Standardize state, freshness, availability, and severity semantics.
4. Rebuild `/` as the attention-first Command Center.
5. Remove provider-first navigation and add global search.
6. Decompose Infinite Brain into task, evidence, gate, continuity, and capability views.
7. Correlate Computer observability with service and LaunchAgent identity.
8. Make the Mac app visibly activate and recover in production mode.
9. Reconcile and test the Obsidian widget contract and deep links.
10. Harden accessibility, responsive behavior, performance, and component boundaries.

## Recommended implementation sequence

```text
Phase 0 identity and authority
              |
              v
Phase A read model and state vocabulary
       |                    |
       v                    v
Phase B Command Center   Phase D Computer diagnostics
       |                    |
       +---------+----------+
                 v
       Phase C Brain drilldowns
                 |
                 v
       Phase E search and Obsidian
                 |
                 v
       Phase F Mac production surface
                 |
                 v
       Phase G design, accessibility, performance
```

Phase C can begin after the contracts in Phase A are stable, while Phase D can proceed in parallel with B if source identity is frozen. Phase F must not switch live services until the identity and visible activation tests pass.

## Final recommendation

The next Codex implementation task should be a bounded Phase A slice:

> Add `operational-snapshot-v1` as a Core-owned read-only endpoint, define the canonical Console state/freshness schema, and add fixtures for current, stale, degraded, unavailable, error, blocked, and pending states. Do not redesign all pages or change the live Mac LaunchAgents in this task.

This task has a clear blast radius, produces a reusable contract for every later view, and directly reduces the current duplicate polling and inconsistent-state risks.
