# 03 — Projects (Commitment & Breakdown)

## Purpose
**Committed projects with clear finish lines.** Here you define the project scope and break it into **phases** (time-bounded chunks).

**Key insight:** A project has a start and end. It's distinct from ongoing areas.

## How it works

```
strategy committed
       ↓
[Project auto-generated from strategy]
       ↓
[You define: phases, timeline, team]
       ↓
[Mark status: in-progress OR on-hold]
       ↓
    └─→ Phases breakdown into 04-phases/
```

## What lives here

- **Product launches** (clear finish line)
- **One-time initiatives** (e.g., "Refactor billing system")
- **Business automations** (e.g., "Build n8n workflow")
- **Operational projects** (e.g., "Set up monitoring for 3 hosts")
- **One-time features** (not ongoing maintenance)

## Typical workflow

1. **Project document auto-generates** (from strategy)
2. **You fill in sections:**
   - **Problem statement** (from strategy)
   - **Success criteria** (from strategy)
   - **Timeline** (start → end date)
   - **Phases** (what are the milestones?)
   - **Team** (who's doing what?)
   - **Dependencies** (what has to happen first?)
3. **You mark status: in-progress**
4. **Automation creates phase folders** and prompts for phase details

## Status flow

- `draft` → Planning, not started
- `in-progress` → Active work
- `blocked` → Waiting on something
- `on-hold` → Paused, will resume
- `completed` → Done
- `archived` → Cancelled or no longer relevant

## Frontmatter

```yaml
---
type: project
para_type: project
status: draft|in-progress|blocked|on-hold|completed|archived
priority: 1|2|3|4|5
area: (SaaS, operations, ministry, etc.)
phase: (current phase, e.g., "02-Design")
start_date: YYYY-MM-DD
target_end_date: YYYY-MM-DD
team: [list of people or AI]
related_strategy: (link)
tags: [list]
---
```

## Project document structure

```markdown
# [Project Title]

## Problem Statement
(From strategy)

## Success Criteria
(From strategy)

## Timeline
- Start: YYYY-MM-DD
- Target End: YYYY-MM-DD
- Current Phase: [phase name]
- Status: [% complete]

## Phases
1. 01-Research: (what are we learning?)
2. 02-Design: (what are we building?)
3. 03-Build: (implementation)
4. 04-Launch: (go-live)
5. 05-Learn: (retrospective, metrics)

## Team
- Owner: [your name or AI task]
- Contributors: [others]
- Dependencies: [external teams/systems]

## Dependencies
- Must complete before: [other projects]
- Blocked by: [impediments]
- Waiting on: [external input]

## Current Status
[Brief paragraph on where we are, what's next]

## Risks & Mitigations
(From strategy, updated if needed)
```

## What you do here

- **Define scope** (phases, timeline)
- **Assign phases** (who does what, when?)
- **Track blockers** (impediments bubble up)
- **Update status** as work progresses

## What NOT to do

- Don't create tasks here (that's 05-tasks/)
- Don't manage detailed day-to-day (that's kanban)
- Don't micromanage phases (phase owners handle that)

---

## References

- **Previous layer:** [[02-strategy|02-Strategy]]
- **Next layer:** [[04-phases|04-Phases]]
- **Dashboard:** [[home|Command Center]]
