# Obsidian-First Brain Core Roadmap

**Date:** 2026-05-16
**Status:** superseded dashboard direction; retained for historical Brain Core/Obsidian architecture context
**Superseded by:** `docs/system/brain-console-center-roadmap.md`
**Scope:** brain, mind, ProBot dashboard, Video Orchestrator, Claude Code skills, local machine control

> 2026-06-03 update: Brain Console Center is now the single leading operational dashboard. Obsidian, Brain Console Web, and ProBot dashboard are legacy/reference dashboard surfaces. Brain Core remains the operational API and safety boundary.

## Decision

Obsidian is the only primary human dashboard for the machine, personal knowledge, business operations, workflows, and orchestrators.

The ProBot dashboard is deprecated as a primary UI. It should not continue as a parallel dashboard beside Obsidian. Existing ProBot code may be reused only as backend capability where it is clean, tested, and useful.

The replacement foundation is a small local Brain Core service that exposes safe machine, repo, session, skill, and orchestrator APIs. Obsidian consumes those APIs through native markdown dashboards and, later, a small Obsidian plugin.

## North Star

```text
Obsidian = cockpit
mind     = human memory, strategy, tasks, projects, research
brain    = machine logic, skills, configs, automations, local control
Brain Core = local API and safety boundary
orchestrators = durable domain runtimes
skills   = execution workflows
```

The machine should have one human cockpit: Obsidian. All dashboards outside Obsidian are deprecated unless they are temporary diagnostics for a specific service.

## Why this replaces the ProBot dashboard

The ProBot dashboard grew during an earlier phase when the machine needed a visual control center quickly. It now duplicates the role that Obsidian should own and increases the number of places where state, workflow, and decisions can drift.

The dashboard is not the right long-term foundation because it mixes too many responsibilities:

- UI rendering
- local API routing
- machine service controls
- session visibility
- Video Orchestrator panels
- Viral Flow panels
- account/OAuth UI
- runtime status
- local app lifecycle controls
- operational diagnostics

The long-term system needs one interface, but not one blob. Obsidian owns the interface. Brain Core owns the machine boundary. Domain orchestrators own their runtime state.

## Target Architecture

```text
mind/
  HOME.md
  KANBAN.md
  dashboards/
    machine.md
    video.md
    workflows.md
    sessions.md
    business.md
  workflows/
    research.md
    design.md
    code.md
    video.md
    deploy.md

brain/
  projects/brain-core/
    api/
    adapters/
      sessions/
      repos/
      local-apps/
      skills/
      video-orchestrator/
      scheduler/
      deploy/
    approvals/
    events/
    security/
    cli/

  projects/probot/
    legacy dashboard and selected reusable code during transition

video-orchestrator/
  queue
  scheduler
  packages
  account health
  platform readiness
  publishing boundaries
```

## Responsibility Boundaries

### Obsidian / mind

Obsidian is responsible for:

- daily command center
- project/task visibility
- strategy and business context
- workflow launch pages
- status dashboards
- human decisions and approvals
- links to current handoffs and outputs

Obsidian must not be responsible for:

- storing secrets
- broad shell execution
- OAuth callback logic
- direct platform uploads
- database writes for runtime systems
- service lifecycle internals
- duplicated machine state

### Brain Core / brain

Brain Core is responsible for:

- safe local API surface
- session discovery and resume helpers
- local app status and controlled lifecycle actions
- repo status adapters
- skill profile/status adapters
- orchestrator status adapters
- approval gates
- event/audit trail
- Slack and Telegram fallback client support if retained

Brain Core should return structured data. It should not become a new dashboard monolith.

### ProBot

ProBot dashboard is legacy UI.

During migration, ProBot may provide reusable components:

- Slack adapter
- Telegram adapter
- session ranking/resume logic
- local app lifecycle logic
- approval model
- selected status adapters

New dashboard features should not be added to ProBot. New work should target Brain Core and Obsidian.

### Video Orchestrator

Video Orchestrator owns production runtime state:

- queue
- scheduler
- packages
- account health
- platform readiness
- publishing gates
- execution logs

Obsidian shows the operator view. Brain Core supplies safe status/action APIs. Video Orchestrator remains the runtime authority.

### Skills

Skills remain execution workflows, not dashboard tabs. Obsidian should expose them as workflow launchers and status pages.

Important workflow families:

- research
- design
- code
- video
- deploy
- memory

## Minimal Dashboard Set

The Obsidian cockpit should start with a small number of durable pages:

```text
HOME.md
KANBAN.md
dashboards/machine.md
dashboards/video.md
dashboards/workflows.md
dashboards/sessions.md
dashboards/business.md
```

Avoid creating many small status notes. Each dashboard should answer a human operating question.

## Brain Core API Shape

Initial read-only API targets:

```text
GET /status
GET /sessions
GET /repos
GET /skills
GET /local-apps
GET /orchestrators
GET /video/status
GET /video/queue
GET /approvals
```

Later controlled action targets:

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

All mutation endpoints must be local-only, approval-aware, auditable, and safe by default.

## Obsidian Integration Strategy

Phase one can use markdown dashboards, local links, and existing Obsidian capabilities.

The long-term integration should be a small Obsidian plugin, tentatively named `brain-console`, that renders native Obsidian panels from Brain Core APIs.

The plugin should support read-first widgets such as:

```text
brain-status
brain-sessions
brain-local-apps
brain-video-queue
brain-approvals
brain-skill-profile
```

And command palette actions such as:

```text
Brain: Open machine dashboard
Brain: Resume latest Claude session
Brain: Switch skill profile
Brain: Start video workflow
Brain: Request service restart
Brain: Open current handoff
```

The plugin must not contain broad shell execution or secret handling.

## Migration Principles

1. Obsidian is the only primary dashboard.
2. ProBot dashboard receives no new product features.
3. Brain Core is built as a local API and safety boundary, not a UI.
4. Reuse ProBot code only when it is clean and reduces risk.
5. Start read-only before adding actions.
6. Keep the number of Obsidian dashboards small.
7. Runtime truth belongs to services, not notes.
8. Human decisions belong to mind, not runtime state.
9. Actions require explicit approval when destructive, sensitive, or externally visible.
10. Slack and Telegram are secondary clients, not architecture drivers.

## Success Criteria

The roadmap is successful when:

- Obsidian is the daily command center for personal, business, machine, and workflow operation.
- ProBot dashboard is no longer used as a primary interface.
- Brain Core exposes small, tested, structured APIs.
- Video Orchestrator status and decisions appear in Obsidian without a separate primary dashboard.
- Skill workflows are launched and tracked from Obsidian workflow pages.
- Slack/Telegram remain optional fallback clients over the same Brain Core boundary.
- There is less duplicated state, fewer notes, fewer dashboards, and fewer points of failure.

## Non-Goals

- Do not merge mind and brain into one repo.
- Do not store secrets in mind.
- Do not make Obsidian execute arbitrary shell commands.
- Do not build another large dashboard inside Brain Core.
- Do not create a separate primary Video Orchestrator dashboard.
- Do not keep adding features to the ProBot dashboard while migration is underway.
