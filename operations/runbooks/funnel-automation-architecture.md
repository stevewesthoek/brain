# Funnel Automation Architecture

**Status:** Planning Phase  
**Created:** 2026-04-09  
**Next:** Implement Step 4 (Multi-stream routing n8n workflows)

---

## What We've Built (Steps 1-3)

### ✅ Step 1: Folder Structure
- 7-layer funnel: `00-inbox/` → `06-kanban/`
- Stream separation: `00-inbox/{high-value,review-queue,junk}/`
- Support folders: `areas/`, `resources/`, `daily/`, `archive/`
- Each layer has comprehensive README explaining routing

### ✅ Step 2: Templates
- `capture.md` — frontmatter + metadata for raw captures
- `brainstorm.md` — elaboration + context gathering
- `strategy.md` — strategic decision + constraints
- `project.md` — scope + phases + timeline
- `phase.md` — time-bounded milestones + deliverables
- `task.md` — atomic executable work (you or AI)

### ✅ Step 3: Gemini Signal Scoring
- Gemini classifies captures with two scores:
  - `confidence`: How sure about PARA classification?
  - `signal_quality`: How actionable/valuable?
- Scoring factors documented with +/- examples
- v2 n8n workflow ready with signal_quality field

---

## What Still Needs Automation (Step 4)

### Flow Logic to Implement

```
[Capture arrives]
       ↓
[Gemini scores: confidence + signal_quality]
       ↓
[Route to stream]
  ├─→ high-value (> 0.8 both) → auto-promote through funnel
  ├─→ review-queue (0.5-0.8) → sits, optional weekly review
  └─→ junk (< 0.5 either) → invisible, auto-delete after 30 days
       ↓
[If high-value: auto-promote]
  ├─→ Move to 01-brainstorm/
  ├─→ Set status: new
  ├─→ Wait for you to mark reviewed
       ↓
       └─→ If reviewed: suggest move to 02-strategy/
           └─→ Auto-generate strategy template
               └─→ Wait for you to mark committed
                   └─→ If committed: create project + phases
```

### Workflows Needed

| Workflow | Trigger | Action | Owner |
|----------|---------|--------|-------|
| **Stream Router** | Capture written to GitHub | Route based on signal scores | n8n |
| **High-Value Promoter** | Nightly job | Move high-value captures to brainstorm | n8n |
| **Brainstorm → Strategy** | You mark status: reviewed | Generate strategy template, propose move | n8n |
| **Strategy → Project** | You mark status: committed | Create project folder + phase templates | n8n |
| **Junk Cleanup** | Daily job | Delete junk older than 30 days | n8n |
| **Pattern Detector** | Weekly job | If 5+ similar junk items, send digest | n8n |

---

## Implementation Plan (Step 4)

### Phase A: Core Routing (1-2 workflows)
1. **Update v2 workflow** to automatically move high-value captures to `01-brainstorm/` nightly
2. **Create Stream Router** that monitors `00-inbox/high-value/` and moves to brainstorm

### Phase B: Layer Transitions (2-3 workflows)
3. **Brainstorm → Strategy** auto-promotion when you mark reviewed
4. **Strategy → Project** auto-generation when you mark committed
5. **Phases → Tasks** breakdown when you fill in phase details

### Phase C: Maintenance (2 workflows)
6. **Junk Cleanup** — auto-delete after 30 days
7. **Pattern Detector** — weekly digest of similar low-signal items

### Phase D: Metrics (optional)
8. **Weekly Metrics** — count captures by stream, completion rates

---

## Key Design Decisions

- **No manual file movement** — automation handles 95% of routing
- **You control the funnel** — each layer needs explicit status change to promote
- **Signal quality drives stream** — Gemini decides, not you
- **Junk is invisible** — doesn't clutter your view
- **Weekly cleanup** — removes noise automatically

---

## Testing Strategy

### Test 1: High-Value Path
1. Send capture with high confidence (0.9) + high signal (0.8)
2. Verify: lands in `00-inbox/high-value/`
3. Verify: auto-moves to `01-brainstorm/` overnight
4. Verify: you can mark `status: reviewed`

### Test 2: Review-Queue Path
1. Send capture with medium scores (0.6)
2. Verify: lands in `00-inbox/review-queue/`
3. Verify: sits there; doesn't auto-promote
4. Verify: weekly audit can promote or delete

### Test 3: Junk Path
1. Send generic/low-signal capture
2. Verify: lands in `00-inbox/junk/`
3. Verify: invisible from dashboard
4. Verify: auto-deletes after 30 days

### Test 4: Strategy Transition
1. Mark high-value brainstorm as `status: reviewed`
2. Verify: automation proposes move to strategy
3. Verify: strategy template auto-generates
4. Verify: you can mark `status: committed`

### Test 5: Project Generation
1. Mark strategy as `status: committed`
2. Verify: project folder auto-creates in `03-projects/`
3. Verify: phase templates (01-Research, 02-Design, etc.) auto-generate
4. Verify: you can fill in phase details

---

## Success Criteria

- ✅ All 7-layer structure exists with READMEs
- ✅ All templates exist with correct frontmatter
- ✅ Gemini scores captures with confidence + signal_quality
- ✅ Captures auto-route to correct stream folder
- ✅ High-value captures auto-promote to brainstorm nightly
- ✅ Status transitions (reviewed → reviewed, committed → committed) trigger next steps
- ✅ You never manually move files between layers
- ✅ Junk is invisible by default
- ✅ Dashboard only shows today's kanban + blockers

---

## Notes for Implementation

- All workflows should use **GitHub as source of truth** — check file system, not a separate database
- Use frontmatter status fields for routing decisions
- Implement **weekly job for cleanup**, not hourly (to reduce n8n execution cost)
- **Pattern detection** is optional Phase D — can be added later if valuable
- Consider **notification system** — tell you when high-value item ready for review, or when strategy template generated

