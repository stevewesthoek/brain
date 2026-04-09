# Notes Folder Structure — The Information Funnel

**Status:** ✅ Live  
**Version:** 1.0  
**Last Updated:** 2026-04-09

---

## The Funnel Concept

```
💧 Wide at top (fuzzy input) → 🔻 Narrow at bottom (sharp output)

Inbox        → Brainstorm → Strategy → Projects → Phases → Tasks → Kanban
(Dump)    (Explore)     (Decide)     (Commit)    (Schedule) (Execute) (Focus)
                                                  
High signal: flows down
Low signal: filtered out
Noise: never reaches you
```

---

## Seven Layers (00–06)

| Layer | Folder | Status | Input | Output | You do |
|-------|--------|--------|-------|--------|--------|
| **00** | `00-inbox/` | Capture & Stream | Raw text | Para + Signal | Dump (don't think) |
| **01** | `01-brainstorm/` | Elaboration | High-value captures | Contextualized ideas | Optionally read + elaborate |
| **02** | `02-strategy/` | Decision | Reviewed brainstorms | Strategic decisions | Write strategy (1-3 hrs) |
| **03** | `03-projects/` | Commitment | Committed strategies | Project scope + phases | Define phases & timeline |
| **04** | `04-phases/` | Breakdown | Projects | Phase milestones + deliverables | Set dates & deliverables |
| **05** | `05-tasks/` | Granularity | Phase deliverables | Atomic executable tasks | Assign to you or AI |
| **06** | `06-kanban/` | Today's Focus | Active tasks | Daily board | Pick 1-3 tasks, execute |

---

## Three Streams in Inbox (00)

Everything captured goes into one of three streams:

### 🟢 high-value/
- **Confidence:** > 0.80
- **Signal:** > 0.70
- **Route:** Auto-promotes to 01-brainstorm/
- **You:** Ignore. Automation handles it.

### 🟡 review-queue/
- **Confidence:** 0.50–0.80
- **Signal:** 0.40–0.70
- **Route:** Stays here. Optional weekly review (5 min).
- **You:** Review once a week or ignore.

### 🔴 junk/
- **Confidence:** < 0.50
- **Signal:** < 0.40
- **Route:** Auto-invisible. Auto-delete after 30 days.
- **You:** Forget this folder exists.

---

## Supporting Folders (Not in Funnel)

| Folder | Purpose |
|--------|---------|
| `areas/` | Ongoing responsibilities (health, finance, ministry, etc). Not time-bound. |
| `resources/` | Reference, templates, how-to, frameworks. Mostly read-only. |
| `daily/` | Ephemeral daily notes. Auto-purge weekly. |
| `archive/` | Completed projects, old notes. Query-able historical record. |

---

## Metadata Schema (Frontmatter)

Every note has:

```yaml
---
type: capture|brainstorm|strategy|project|phase|task|area|resource
status: [layer-specific values]
confidence: 0.0–1.0          # How sure about PARA classification?
signal_quality: 0.0–1.0      # How actionable/valuable?
stream: high-value|review-queue|junk  # (inbox only)
priority: 1|2|3|4|5
assigned_to: you|ai|[person]  # (tasks only)
tags: [domain, category]
---
```

---

## Daily Workflow (5 minutes)

1. **Open kanban** (06)
2. **Check Blocked column** — escalate if critical
3. **Pick 1-3 tasks** from To Do
4. **Work**
5. **Move to Done**

**That's all you see.** Nothing else.

---

## Weekly Workflow (30 minutes)

1. **Archive done tasks**
2. **Review blockers** — still stuck? Deprioritize or escalate
3. **Check review-queue** (optional) — promote good ones, delete rest
4. **Look ahead** — prep for next phase

---

## Monthly Workflow (2 hours)

1. **Review strategy** — are we still committed to active projects?
2. **Check metrics** — how many tasks/projects completed?
3. **Identify patterns in junk** — do we see repeated low-signal items? (e.g., "productivity tips")
4. **Brainstorm on hold** — anything ready to move to strategy?

---

## How Automation Flows

### Capture → Stream (Inbox)
```
1. Raw text arrives via webhook
2. Gemini scores: confidence + signal_quality
3. Auto-route to stream:
   - high-value → (starts auto-promotion cycle)
   - review-queue → (sits, optional review)
   - junk → (invisible, auto-purged)
```

### High-Value → Brainstorm
```
1. (Nightly job)
2. Scan: high-value/ with status=new
3. Move to 01-brainstorm/ + set status=new
4. (If you mark status=reviewed → automation suggests move to strategy)
```

### Strategy → Project
```
1. (When you mark: status=committed)
2. Automation creates project folder + template
3. Suggests phase structure (Research, Design, Build, Launch, Learn)
```

### Project → Phases → Tasks
```
1. (When you fill in phase dates)
2. Automation creates phase folders + templates
3. (When you write task bullets)
4. Automation creates atomic tasks
```

### Tasks → Kanban
```
1. (Every morning)
2. Automation queries: due_date<=today OR (assigned_to=you AND status=in-progress)
3. Populates 06-kanban/ board
4. Highlights blockers in red
```

---

## What You Never See

❌ **Daily notes** (unless you explicitly open them)  
❌ **Archive** (unless searching for something old)  
❌ **Junk** (invisible, auto-deleted)  
❌ **Low-confidence brainstorms** (stays in review-queue)  
❌ **Next week's tasks** (only today matters)  
❌ **Completed projects** (unless historical query)  

---

## What You Always See

✅ **Today's kanban** (5 active tasks, max)  
✅ **Blockers** (highlighted in red, always visible)  
✅ **AI tasks awaiting review** (in review column)  
✅ **Command Center home** (your dashboard)  

---

## Best Practices

### Capture / Inbox (00)
- **Dump everything.** Don't filter. Don't think. Let automation sort it.
- **Include context.** "From ChatGPT about pricing" helps Gemini understand.
- **Add title if you can.** But not required.

### Brainstorm (01)
- **Don't overthink.** 80/20 is enough.
- **Add one link** to related ideas if you think of it.
- **Mark status: reviewed** when decided (automation will help next steps).

### Strategy (02)
- **Write for clarity, not perfection.** 1-3 hours max per strategy.
- **Use the template.** Don't reinvent.
- **Explain reasoning.** Why this, not that?

### Projects (03)
- **Set realistic dates.** Projects expand to fill time; cap it.
- **Assign phase owner** (maybe you, maybe delegate).
- **Revisit monthly.** Are we still committed?

### Phases (04)
- **Define deliverables clearly.** "What does done look like?"
- **Set 2-week boundaries.** Shorter phases = faster feedback.
- **Flag blockers early.** Don't pretend they'll solve themselves.

### Tasks (05)
- **One task = one session.** If > 1 session, break it down.
- **Assign to AI when possible.** Review output, move on.
- **Write acceptance criteria.** No ambiguous tasks.

### Kanban (06)
- **Check once daily.** No exceptions.
- **Keep < 5 items.** More = moving too slow or tasks too big.
- **Move blockers up.** Never leave a blocker sitting.

---

## Queries & Dashboards

### Command Center (home.md)
- 🔴 Overdue tasks
- 📅 Today's focus
- ⚡ Active projects
- 📥 Unprocessed inbox (high-value only)
- 📊 All projects by phase
- 🗄 All areas

### Weekly Review
```dataview
TABLE status, phase, priority
FROM "notes"
WHERE status = "blocked" OR status = "in-review"
```

### Monthly Metrics
```dataview
TABLE count(rows) as "Completed"
FROM "notes/archive"
WHERE type = "task" AND completed_at >= date(today) - duration(30 days)
GROUP BY assigned_to
```

---

## Related Docs

- **Automation:** `operations/runbooks/n8n-brain-inbox.md` — how the webhook works
- **Memory:** Auto-memory has PARA context and signal scoring rules
- **Decision log:** `operations/decision-log.md` — confirmed architecture decisions

---

## Troubleshooting

**Q: My brainstorm isn't auto-promoting to strategy.**  
A: Mark `status: reviewed` in 01-brainstorm/. Automation looks for that signal.

**Q: Kanban is too full.**  
A: Your tasks are too big. Break them down to < 1-session size.

**Q: I keep adding things to the review-queue but never reviewing it.**  
A: That's OK. Weekly auto-archives will clean it up. Don't force it.

**Q: I see too much junk on inbox.**  
A: Junk is invisible (should be in junk/ stream). If you're seeing it, check confidence/signal scoring.

**Q: What if I want to override the automation?**  
A: You can manually move notes between folders. Automation is a guide, not a cage.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-09 | Initial structure + automation scaffolding |

