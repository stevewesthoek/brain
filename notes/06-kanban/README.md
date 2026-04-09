# 06 — Kanban (Today's Focus)

## Purpose
**Your daily board.** Only tasks active today or due today. Everything else is noise.

**Key insight:** This is the ONLY view you check daily. Nothing else.

## How it works

```
05-tasks (all tasks across all phases)
       ↓
[Automation filters]
       ↓
[Due today OR assigned to you AND in-progress]
       ↓
    ├─→ To Do
    ├─→ Doing
    ├─→ Done
    └─→ Blocked
```

## Board Columns

### To Do
Tasks ready to pick up today.

```markdown
- [ ] Write task spec for billing migration
- [ ] Review design mockups from AI
- [ ] Email Sarah about blocker
```

### Doing
Currently in progress (should be 1-3 items max).

```markdown
- [x] Code review of billing refactor (50% done)
```

### Done
Completed today. **Move to archive/completed weekly.**

```markdown
- [x] Deploy to staging
- [x] Update documentation
```

### Blocked
Waiting on something external.

```markdown
- [⚠️] Phase 02 design review — waiting for Sarah's feedback
- [⚠️] Stripe API issue — waiting for support response
```

---

## Daily Workflow (5 minutes)

1. **Check Blocked column** — anything critical? Escalate if needed.
2. **Check To Do** — which task matters most today? Pick 1-3.
3. **Move to Doing** — start work.
4. **As you complete** — move to Done.
5. **If stuck** — move to Blocked + note the impediment.

**That's it. Nothing else.**

---

## Weekly Workflow (10 minutes)

1. **Archive Done tasks** — move to `notes/archive/completed/`
2. **Check Blocked tasks** — still blocked? Escalate or deprioritize.
3. **Look at next week's phase** — any prep needed?
4. **Update metrics** — how many tasks completed? AI vs. you?

---

## Frontmatter

Kanban board pulls from `05-tasks/` with these filters:

```yaml
status: ready|in-progress|in-review
due_date <= TODAY OR (assigned_to: you AND status: in-progress)
```

**You don't edit kanban directly.** You edit tasks in `05-tasks/`, and kanban updates automatically.

---

## Daily Kanban Template

```markdown
# Today's Kanban — YYYY-MM-DD

## 🔴 Blocked (⚠️ Escalate if blocking progress)
<!-- Auto-populated from tasks with status: blocked -->

## 📋 To Do (Pick 1-3)
<!-- Auto-populated from tasks with due_date=today and status=ready -->

## ⚙️ Doing (Keep < 3)
<!-- Auto-populated from tasks with status=in-progress -->

## ✅ Done (Archive weekly)
<!-- Auto-populated from tasks with status=done and done_at=today -->

---

## 📊 Today's Metrics
- To Do: X
- Doing: X
- Done: X
- Blocked: X
- AI tasks awaiting review: X

---

## Focus
**What matters most today?**
(Highest priority task from To Do)

## Impediments
**What's stopping progress?**
(All items from Blocked column)
```

---

## What you do here

- **Check daily** (5 min in the morning)
- **Update status** as you work (To Do → Doing → Done)
- **Escalate blockers** immediately
- **Don't add tasks** (add to `05-tasks/` instead)

## What NOT to do

- Don't plan next week here (that's phases/projects)
- Don't overthink priorities (pick the top item)
- Don't let it grow > 5 items (break down or defer)
- Don't ignore blocked tasks

---

## Automation Integration

Kanban auto-updates from `05-tasks/` every morning:
- Filters for `due_date <= today OR status: in-progress`
- Shows AI tasks awaiting review
- Highlights blockers in red
- Counts completed tasks for metrics

---

## References

- **Previous layer:** [[05-tasks|05-Tasks]]
- **Support:** [[home|Command Center]] for 7-day view
- **Archive:** [[notes/archive|Archive]] for completed work
