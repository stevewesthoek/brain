# 05 — Tasks (Atomic Execution)

## Purpose
**Atomic, executable tasks.** Each task is small enough to complete in one session and assigned to either you or AI.

**Key insight:** If a task takes more than 1 session, it's too big. Break it down.

## How it works

```
phase deliverables/bullets
       ↓
[Breakdown into atomic tasks]
       ↓
[Assign: you OR ai]
       ↓
[Set due dates]
       ↓
    └─→ Active tasks show on kanban (06)
```

## What lives here

- **"Email design feedback to Sarah"** (small, specific)
- **"Write task spec for billing migration"** (1-2 hours)
- **"Review AI's code diff and approve/request changes"** (30 min)
- **"Research Stripe usage-based pricing API"** (2 hours research spike)
- **NOT** "Build entire billing system" (too big)

## Task types

### 👤 Tasks for You
- Decisions (you're the only one who can decide)
- Reviews (feedback on AI output)
- Specific domain knowledge (code review, design feedback)
- High-risk work (customer comms, legal)

### 🤖 Tasks for AI
- Code generation
- Research & synthesis
- Documentation
- Refactoring & cleanup
- Anything repeatable or pattern-based

## Typical workflow

1. **Task auto-generated** (from phase deliverables or manual breakdown)
2. **You fill in:**
   - **Task name** (verb-noun: "Write task spec", "Review design", "Deploy to staging")
   - **Assigned to** (you or ai)
   - **Due date**
   - **Effort estimate** (1 session, 1 day, 1 week?)
   - **Acceptance criteria** (how do we know it's done?)
3. **You mark status: ready**
4. **Automation pulls into kanban**
5. **Work happens**
6. **Mark status: done**

## Status flow

- `ready` → Waiting to be picked up
- `in-progress` → Work underway
- `blocked` → Waiting for input/dependency
- `in-review` → Submitted for feedback (for AI tasks)
- `done` → Completed and accepted
- `archived` → Cancelled

## Frontmatter

```yaml
---
type: task
assigned_to: you|ai
status: ready|in-progress|blocked|in-review|done|archived
priority: 1|2|3|4|5
due_date: YYYY-MM-DD
effort: 1-session|1-day|1-week
phase: (link to parent phase)
project: (link to parent project)
tags: [list]
---
```

## Task document structure

```markdown
# [Task Name]

## Objective
One line: what's the goal?

## Acceptance Criteria
- [ ] Criterion 1 (specific, measurable)
- [ ] Criterion 2
- [ ] Criterion 3

## Context
- Related to: (phase, project)
- Blocked by: (if any)
- Depends on: (if any)

## For AI Tasks: Instructions
(Detailed prompt for what you want AI to do)

For you tasks, this is usually empty or just:
"Use judgment, follow established patterns."

## Effort Estimate
- Time: ~[1-2 hours / 1 day / etc]
- Complexity: low/medium/high

## Notes
(Decisions, gotchas, reference links)

## Completion Notes
(Filled in when done: what was the result? any surprises?)
```

## What you do here

- **Break down phases** into atomic tasks
- **Assign to you or AI** based on task type
- **Set realistic effort** (not aspirational)
- **Add acceptance criteria** (how do we know it's done?)
- **Review AI task outputs** (AI marks as "in-review", you accept/reject)

## What NOT to do

- Don't create tasks that take > 1 session (break them down)
- Don't assign ambiguous tasks (clear acceptance criteria required)
- Don't assign AI tasks without clear instructions
- Don't micromanage completed tasks (move on)

---

## AI Task Workflow

### You create
```markdown
- assigned_to: ai
- status: ready
```

### AI picks up
```markdown
- status: in-progress
```

### AI completes
```markdown
- status: in-review
- completion_notes: (what I did)
```

### You review
- **Approve:** Mark `status: done`
- **Reject:** Mark `status: ready` + comment on what needs to change

---

## References

- **Previous layer:** [[04-phases|04-Phases]]
- **Next layer:** [[06-kanban|06-Kanban]]
- **Dashboard:** [[home|Command Center]]
