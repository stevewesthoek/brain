# Obsidian-First Brain Core Implementation Plan

**Date:** 2026-05-16
**Status:** ready for execution
**Related roadmap:** `docs/system/obsidian-brain-core-roadmap.md`

## Objective

Replace the ProBot dashboard as the primary machine UI with an Obsidian-first operating cockpit backed by a small local Brain Core service.

This plan does not start by refactoring the old ProBot dashboard. It creates the clean foundation first, migrates proven backend capabilities, and then freezes/decommissions the dashboard.

## Execution Summary

```text
Phase 0: Freeze direction and inventory existing code
Phase 1: Create Brain Core skeleton and read-only API
Phase 2: Create minimal Obsidian dashboards in mind
Phase 3: Add Brain Console Obsidian plugin or integration layer
Phase 4: Move controlled actions behind approvals
Phase 5: Convert Slack/Telegram to thin Brain Core clients
Phase 6: Freeze and decommission ProBot dashboard
Phase 7: Harden, document, and simplify notes/state
```

## Phase 0 — Direction, Inventory, and Freeze

### Goal

Lock the architectural direction and stop expanding the ProBot dashboard.

### Tasks

- [ ] Record roadmap in `docs/system/obsidian-brain-core-roadmap.md`.
- [ ] Add this implementation plan.
- [ ] Add a ProBot dashboard freeze notice to the relevant ProBot docs.
- [ ] Inventory reusable ProBot code:
  - Slack adapter
  - Telegram adapter
  - session ranking/resume logic
  - local app lifecycle logic
  - approval model
  - status adapters
  - Video Orchestrator adapter code
- [ ] Identify code that should not be migrated:
  - HTML dashboard rendering
  - browser JavaScript dashboard state
  - dashboard-specific CSS
  - server-rendered panel HTML
  - duplicated Video Orchestrator UI logic

### Exit Criteria

- Roadmap and implementation plan are committed.
- ProBot dashboard is documented as deprecated for new product work.
- Reusable backend capabilities are listed before code migration begins.

## Phase 1 — Brain Core Read-Only Foundation

### Goal

Create a small, testable local service that returns structured machine state without becoming a dashboard.

### Proposed location

```text
projects/brain-core/
```

### Initial structure

```text
projects/brain-core/
  README.md
  package.json
  src/
    index.ts
    api/
      server.ts
      routes.ts
    adapters/
      status.ts
      sessions.ts
      repos.ts
      skills.ts
      local-apps.ts
      video-orchestrator.ts
    security/
      localhost.ts
      redaction.ts
    types/
      api.ts
    tests/
```

### Initial read-only endpoints

```text
GET /status
GET /sessions
GET /repos
GET /skills
GET /local-apps
GET /video/status
GET /video/queue
GET /approvals
```

### Rules

- Return JSON only.
- No HTML rendering.
- No broad shell execution.
- No secrets in responses.
- No writes in Phase 1.
- Use localhost-only binding.
- Add tests for every adapter.

### Reuse candidates from ProBot

- session discovery/ranking logic
- local app registry/status logic
- redaction helpers
- selected Video Orchestrator status adapters

Reuse by extracting clean modules, not by importing the dashboard.

### Exit Criteria

- Brain Core starts locally.
- Read-only endpoints return structured data.
- Tests pass.
- No dependency on `projects/probot/src/bot/dashboard.ts`.

## Phase 2 — Minimal Obsidian Dashboards

### Goal

Make Obsidian the daily cockpit with the fewest possible durable notes.

### Target repo

`mind`

### Proposed pages

```text
HOME.md
dashboards/machine.md
dashboards/video.md
dashboards/workflows.md
dashboards/sessions.md
dashboards/business.md
workflows/research.md
workflows/design.md
workflows/code.md
workflows/video.md
workflows/deploy.md
```

### Rules

- Keep dashboards human-facing and sparse.
- Avoid duplicating runtime state into markdown.
- Link to source systems or render live state through the integration layer.
- Do not store secrets.
- Do not create a separate note for every service unless it has durable human meaning.

### Exit Criteria

- `HOME.md` points to the new dashboards.
- Machine, video, workflows, and sessions have a single clear place in Obsidian.
- Existing kanban/task flow remains intact.

## Phase 3 — Brain Console Obsidian Integration

### Goal

Connect Obsidian to Brain Core without embedding the old ProBot dashboard.

### Preferred solution

Build a small Obsidian plugin named `brain-console`.

### Plugin responsibilities

- Fetch Brain Core JSON APIs.
- Render native Obsidian cards/panels.
- Provide command palette actions.
- Open terminal/session helpers when requested.
- Request actions through Brain Core approval endpoints.

### Plugin non-responsibilities

- No arbitrary shell execution.
- No OAuth secret handling.
- No credential storage.
- No service lifecycle internals.
- No platform uploads.

### Initial widgets

```text
brain-status
brain-sessions
brain-local-apps
brain-video-queue
brain-approvals
brain-skill-profile
```

### Initial commands

```text
Brain: Open machine dashboard
Brain: Resume latest Claude session
Brain: Switch skill profile
Brain: Start video workflow
Brain: Request service restart
Brain: Open current handoff
```

### Exit Criteria

- Obsidian can show machine/session/video status through Brain Core.
- No ProBot dashboard embed is required for daily operation.
- Plugin is small enough to audit.

## Phase 4 — Controlled Actions and Approvals

### Goal

Add action capability only after read-only status is reliable.

### Action API targets

```text
POST /actions/request
POST /approvals/:id/approve
POST /approvals/:id/reject
POST /skills/profile
POST /sessions/:id/resume
POST /local-apps/:id/start
POST /local-apps/:id/stop
POST /local-apps/:id/restart
```

### Safety rules

- Local-only mutation endpoints.
- Approval gates for destructive, sensitive, external, or runtime-affecting actions.
- No raw shell access.
- Structured action records.
- Audit trail for all actions.
- Redacted logs.
- Dry-run first for high-risk actions.

### Exit Criteria

- Obsidian can request and approve safe actions.
- Brain Core owns all action boundaries.
- Actions are auditable and tested.

## Phase 5 — Slack and Telegram as Thin Clients

### Goal

Keep remote control if useful, but stop letting Slack/Telegram drive architecture.

### Plan

- Convert Slack commands to Brain Core API calls.
- Convert Telegram commands to Brain Core API calls.
- Keep only emergency/mobile commands:
  - status
  - sessions
  - resume guidance
  - approvals
  - selected service restart request
- Remove duplicated logic from bot clients once Brain Core owns it.

### Exit Criteria

- Slack and Telegram are optional clients over Brain Core.
- They do not contain independent machine-control logic.

## Phase 6 — ProBot Dashboard Freeze and Decommission

### Goal

Stop maintaining the ProBot dashboard as a product surface.

### Steps

- [ ] Add deprecation banner/documentation to ProBot dashboard docs.
- [ ] Stop adding new dashboard tabs/features.
- [ ] Migrate necessary status adapters to Brain Core.
- [ ] Migrate necessary action/approval adapters to Brain Core.
- [ ] Keep a temporary diagnostic route only if it materially helps migration.
- [ ] Remove or archive `dashboard.ts` after Obsidian + Brain Core cover daily operation.

### Exit Criteria

- Daily operation happens from Obsidian.
- Brain Core serves machine data/actions.
- ProBot dashboard is no longer opened for normal work.
- Legacy dashboard code is deleted, archived, or clearly marked as unsupported.

## Phase 7 — Hardening and Simplification

### Goal

Reduce notes, duplicate state, and operational risk.

### Tasks

- [ ] Audit dashboards and remove duplicates.
- [ ] Verify mind/brain separation remains intact.
- [ ] Verify secrets are not in mind or Brain Core responses.
- [ ] Verify all runtime state remains in runtime services.
- [ ] Add runbook for restoring Brain Core.
- [ ] Add tests for Brain Core API contracts.
- [ ] Add a simple health check for Obsidian integration.
- [ ] Document rollback path.

### Exit Criteria

- Fewer dashboards than before.
- No duplicated runtime truth in notes.
- Brain Core can be restarted independently.
- Obsidian remains usable even when Brain Core is offline.

## Validation Strategy

### Documentation validation

- Confirm roadmap and implementation plan are linked from `README.md` or another relevant index.
- Confirm ProBot dashboard freeze is documented before implementation begins.

### Code validation once Brain Core exists

- Typecheck package.
- Unit-test each adapter.
- Security scan changed files for secret patterns.
- Verify localhost-only binding.
- Verify no dashboard HTML is introduced.

### Operational validation

- Obsidian shows status from Brain Core.
- Brain Core returns useful errors when a service is offline.
- Obsidian remains readable without live API data.
- Actions require approval and produce audit records.

## Rollback Strategy

During migration, ProBot dashboard remains available as a fallback until Brain Core and Obsidian cover the daily workflows.

Rollback does not mean re-investing in the dashboard. It means temporarily using the old dashboard while fixing Brain Core or the Obsidian integration.

## First Execution Slice

The first practical implementation slice should be small:

1. Create `projects/brain-core` package skeleton.
2. Implement `GET /status`.
3. Implement `GET /sessions` using extracted or copied ProBot session logic.
4. Implement `GET /skills` from existing skill profile docs/scripts.
5. Add tests.
6. Add `dashboards/machine.md` in mind with a placeholder/live-link strategy.
7. Do not add actions yet.

## Definition of Done for the Migration

The migration is complete when:

- Obsidian is the only daily dashboard.
- ProBot dashboard is no longer maintained as a product UI.
- Brain Core owns the local API and safety boundary.
- Video Orchestrator appears in Obsidian through Brain Core, not through a separate dashboard.
- Skill workflows are launched/tracked from Obsidian workflow pages.
- Slack and Telegram, if retained, are thin fallback clients.
- There are fewer notes, fewer dashboards, and fewer operational points of failure than before.
