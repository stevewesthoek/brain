# Brain Notes Workflow Guide

**Complete reference for capturing ideas, strategizing, and executing tasks.**

**Last updated:** 2026-04-10  
**Version:** 1.0

---

## Quick Start (2 minutes)

1. **Every morning:** Open `notes/kanban.canvas`
2. **Pick 1-3 tasks** from "To Do"
3. **Drag to "Doing"** when you start
4. **Work**
5. **Drag to "Done"** when finished

That's your entire daily interface.

---

## Capturing Ideas (30 seconds)

**From ChatGPT or anywhere:**

Use macOS shortcut to save selected text to brain.

The shortcut POSTs to webhook:
```
https://n8n.prochat.tools/webhook/brain-inbox
```

**That's it.** Gemini does the rest.

---

## What Happens Next (Automated)

1. Gemini receives the text
2. Gemini scores it:
   - `confidence` (0-1): Sure about PARA type?
   - `signal_quality` (0-1): Actionable and valuable?
3. Gemini generates: title, summary, key points, action items
4. Note lands in `notes/01-inbox/`

---

## Reviewing Inbox (5 minutes)

**When:** Daily or weekly, whenever you have time

**Where:** `notes/01-inbox/`

**What to do:**
- Read the auto-generated summary
- Read key points and action items
- Decide: Keep or delete?

**If keep:** Continue to step 3

**If delete:** Move to trash and forget it

---

## Creating Strategy (15-20 minutes)

**When:** You've decided to commit to something

**Where:** `notes/02-strategy/`

**How:**
1. Copy `notes/07-templates/strategy.md`
2. Rename to your strategy title
3. Fill in:
   - **Why:** Why does this matter now?
   - **Decision:** What are we doing?
   - **Constraints:** Time, budget, people, dependencies?
   - **Success Criteria:** How do we know we won?

**When done:** Mark `status: committed` in frontmatter

---

## Creating Project (10-15 minutes)

**When:** After committing to strategy

**Where:** `notes/03-projects/[project-name]/`

**How:**
1. Create folder: `03-projects/[project-name]/`
2. Copy `notes/07-templates/project.md` → `03-projects/[project-name]/README.md`
3. Fill in:
   - **Goal:** What defines "done"?
   - **Timeline:** Start and target end dates
   - **What Needs to Happen:** 4-5 phases/steps (research, design, build, launch, learn)

**Don't create tasks here yet.** Just outline what needs to happen.

---

## Creating Tasks (5 minutes per task)

**When:** You're ready to execute a phase

**Where:** `notes/04-tasks/`

**How:**
1. Copy `notes/07-templates/task.md` → `notes/04-tasks/[task-name].md`
2. Fill in:
   - **What to Do:** One sentence goal
   - **Acceptance Criteria:** How do we know it's done? (2-3 specific items)
   - **For AI:** (Leave blank for you tasks, or detailed instructions for AI tasks)
   - **Effort:** ~1-2 hours, ~1 day, etc.
   - **Due Date:** When should this be done?
   - **Assigned To:** `you` or `ai`
   - **Project:** Link to parent project: `[[03-projects/project-name/README]]`

**Key rule:** One task = one file = one atomic action

If it takes > 1 session, break it down further.

---

## Working on Kanban Board (Daily)

**Where:** `notes/kanban.canvas`

**Daily routine (5 minutes):**

1. **Morning:**
   - Open kanban.canvas
   - Look at "Backlog" column (all ready tasks)
   - Pick 1-3 for today
   - Drag them to "To Do"

2. **When starting work:**
   - Drag task from "To Do" → "Doing"

3. **When finished:**
   - Drag task from "Doing" → "Done"

4. **End of day (optional):**
   - Move done tasks to `notes/08-archive/`

**Keep < 2 tasks in "Doing" at any time.**

---

## Assigning Tasks to AI (For AI Work)

**When you want AI to do something:**

1. Create task in `04-tasks/`
2. Set `assigned_to: ai`
3. In "For AI" section, write detailed instructions:
   ```
   Generate TypeScript types for Stripe usage API response.
   Include pagination fields, rate limit headers, error codes.
   Add JSDoc comments for each field.
   ```

4. Put task on kanban board

**AI workflow (when Step 4 automation is live):**
- AI picks up task
- Marks `status: in-progress`
- Completes work
- Marks `status: in-review` + includes output file link
- You review
- You mark `status: done` if approved, or `status: ready` if it needs changes

---

## Archiving Completed Work (Weekly)

**When:** Once a week, after reviewing what's done

**Where:** `notes/04-tasks/` + `notes/03-projects/`

**How:**
1. Move completed task files from `04-tasks/` to `08-archive/`
2. When entire project is done, move project folder from `03-projects/` to `08-archive/`

**Why archive?** Keeps active workspace clean, but preserves history for querying.

---

## Ongoing Areas (Optional)

**For continuous responsibilities:**

Example areas:
- Health (exercise, sleep, nutrition)
- Finance (budgeting, tax planning)
- Ministry work (Yeshua Academy)
- Business operations (team, processes)

**How to use:**
1. Create file in `05-areas/[area-name].md`
2. Copy `07-templates/area.md`
3. Use as a living document tracking this ongoing area
4. No due dates, no "done" status — just ongoing

---

## Resources & Reference (Optional)

**For how-to, frameworks, research:**

Example resources:
- Stripe API documentation
- React patterns and examples
- Design system guidelines
- Pricing strategy frameworks

**How to use:**
1. Create file in `06-resources/[resource-name].md`
2. Copy `07-templates/resource.md`
3. Link from project or task notes when relevant

---

## Structure at a Glance

```
notes/
├── 01-inbox/          ← Raw captures (read-only)
├── 02-strategy/       ← Your decisions (you write these)
├── 03-projects/       ← Active projects (one folder per project)
├── 04-tasks/          ← Your atomic work (one file per task)
├── 05-areas/          ← Ongoing responsibilities
├── 06-resources/      ← Reference material
├── 07-templates/      ← Copy from here, don't edit
├── 08-archive/        ← Completed work
├── home.md            ← Dashboard
├── kanban.canvas      ← Your working board
└── STRUCTURE.md       ← System documentation
```

---

## Common Questions

### Q: Where do I put something I'm not sure about?

**A:** `01-inbox/` → Review → Delete if not valuable

### Q: What if I have an idea but don't want to commit yet?

**A:** Keep it in `01-inbox/` and revisit later. No need to promote to strategy until ready.

### Q: How do I know if a task is too big?

**A:** If it takes > 1 session, break it into smaller tasks. One task = one session of focused work.

### Q: What if I have a question or blocker while working on a task?

**A:** Add it to the task file's notes section. Move task to "Blocked" column on kanban if it's a hard stop.

### Q: How often should I create new tasks?

**A:** As needed. Weekly planning (Sunday night) is ideal, but create them on-demand if inspiration strikes.

### Q: Can I have multiple projects active at once?

**A:** Yes, but keep kanban to 1-3 tasks max per day. Better to focus than to spread thin.

### Q: What happens to tasks assigned to AI?

**A:** (When automation is live) AI picks them up, completes them, marks for review. You review and approve or request changes.

### Q: How do I query/search across everything?

**A:** Use Obsidian's search (Cmd+F) or dataview queries in `home.md`. You can search by tag, type, status, etc.

---

## Automation (Phase 4 - Future)

When Step 4 automation is implemented:

✅ High-confidence captures auto-promote to strategy  
✅ Committed strategies auto-generate projects  
✅ AI tasks auto-flow through your inbox  
✅ Done tasks auto-archive after 1 week  

**For now:** Manual. Same system, hand-operated.

---

## Pro Tips

1. **Use tags liberally** — Tag by domain (SaaS, ministry, ops) and urgency (urgent, backlog)
2. **Link notes** — Use `[[file-name]]` to connect related items
3. **Keep capture text short** — Let Gemini do the processing, not you
4. **Review weekly** — Sunday night: plan next week's tasks
5. **Archive regularly** — Keep `04-tasks/` < 20 files
6. **One kanban per day** — Don't keep old done tasks on the board

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Too many tasks on kanban | Archive completed ones, defer non-urgent ones to backlog |
| Can't decide on a task | Pick the highest priority one, work on that |
| Captured something you don't need | Delete from inbox. No harm, no foul. |
| Task too big | Break it into 2-3 smaller tasks |
| Blocked on a task | Move to "Blocked" column, note the blocker, pick different task |
| Forgot to archive | Do it weekly. Old completed tasks in kanban are just clutter |

---

## References

- `notes/STRUCTURE.md` — System overview and structure
- `notes/07-templates/` — Copy these when creating notes
- `notes/home.md` — Dashboard with queries
- `operations/runbooks/n8n-brain-inbox.md` — How the webhook/Gemini works
