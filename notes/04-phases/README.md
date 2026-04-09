# 04 — Phases (Time-Bounded Chunks)

## Purpose
**Break projects into phases.** Each phase is a time-bounded milestone with deliverables. Phases feed tasks into the kanban.

**Key insight:** Phases are "what we deliver this month." Tasks are "what we do today."

## How it works

```
project in-progress
       ↓
[Phases defined from project]
       ↓
[For each phase: set dates, deliverables]
       ↓
[Phase breakdown creates 05-tasks/]
       ↓
    └─→ Active phase tasks show on kanban
```

## What lives here

- **Phase 01-Research** (Sprint 1: 2 weeks, deliverable: competitor analysis + requirements)
- **Phase 02-Design** (Sprint 2-3: 3 weeks, deliverable: figma prototypes + tech spec)
- **Phase 03-Build** (Sprint 4-6: 4 weeks, deliverable: MVP ready for testing)
- **Phase 04-Launch** (Sprint 7: 1 week, deliverable: production-ready)
- **Phase 05-Learn** (Continuous: retrospective, metrics, improvement tasks)

## Typical workflow

1. **Phase document auto-generated** (from project's phase list)
2. **You fill in:**
   - **Phase name** (e.g., "02-Design: Create visual mockups")
   - **Start date, end date**
   - **Deliverables** (what defines "done"?)
   - **Success criteria** (how do we measure?)
   - **Owner** (who's driving this?)
3. **You create task bullets** or let automation generate tasks from deliverables
4. **You mark status: in-progress**
5. **Active phase tasks populate kanban**

## Status flow

- `planned` → Not started
- `in-progress` → Work underway
- `blocked` → Waiting for something
- `review` → Deliverables ready for feedback
- `completed` → Phase done, move to next
- `archived` → Cancelled

## Frontmatter

```yaml
---
type: phase
project: (link to parent project)
phase_number: (e.g., "02")
status: planned|in-progress|blocked|review|completed|archived
start_date: YYYY-MM-DD
end_date: YYYY-MM-DD
owner: (who owns this phase?)
deliverables: (comma-separated list)
tags: [list]
---
```

## Phase document structure

```markdown
# [Project Title] — Phase 0X: [Phase Name]

## Overview
One-line summary: what's the goal of this phase?

## Dates
- Start: YYYY-MM-DD
- End: YYYY-MM-DD
- Duration: X weeks
- Status: [% complete]

## Deliverables
- Deliverable 1: (specific, measurable)
- Deliverable 2: (specific, measurable)
- Deliverable 3: (specific, measurable)

## Success Criteria
- Technical: (tests pass? performance meets targets?)
- Quality: (code review passed?)
- Business: (metrics/goals achieved?)

## Tasks
(Auto-populated from task breakdowns, or list here:)
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

## Blockers
- Currently blocked by: [impediment]
- Waiting on: [person/input]

## Notes
(Status updates, decisions made during this phase)
```

## What you do here

- **Define phase scope** (what's the deliverable?)
- **Set realistic dates** (not aspirational)
- **Assign owner** (who's accountable?)
- **Track blockers** (if stuck, escalate immediately)
- **Update status** as phase progresses

## What NOT to do

- Don't create individual tasks here (that's 05-tasks/)
- Don't manage daily execution (that's kanban)
- Don't change dates mid-phase without documenting why

---

## References

- **Previous layer:** [[03-projects|03-Projects]]
- **Next layer:** [[05-tasks|05-Tasks]]
- **Dashboard:** [[home|Command Center]]
