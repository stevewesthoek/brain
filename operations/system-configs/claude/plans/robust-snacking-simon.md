# Plan: Brain Project Decomposer (Step 3 of GTD Automation)

## Context
The brain repo has a 4-step GTD automation pipeline:
- Step 1: Capture + Classify (n8n webhook → Gemini → inbox) — DONE
- Step 2: Auto-Router (scan inbox every minute, route by scores) — DONE
- Step 3: Project Decomposer — THIS PLAN
- Step 4: Kanban Syncer — LATER

When a high-quality note is routed to `03-projects/` by the Auto-Router, it lands with `type: capture` and `status: ready-for-review` — still in raw capture format. The decomposer reads that file, uses Gemini to expand it into a proper project structure, replaces it with a well-formed project file, and creates atomic task files in `04-tasks/`.

---

## Files to Create

### 1. `/Users/Office/Repos/stevewesthoek/brain/tools/scripts/brain-project-decomposer.py`
Main Python script, follows the exact same patterns as `brain-auto-router.py`:
- Logging: three handlers (main log, error log, console) using the established format
- Git: subprocess calls with `git -C <repo_path>` pattern
- Token: reads `GITHUB_PAT` / `GITHUB_TOKEN` from `~/.config/github/.env`
- Cron: every 5 minutes (`*/5 * * * *`)

**Logic flow:**
1. Scan `notes/03-projects/` using `git ls-tree -r main notes/03-projects` for files ending in `.md`
2. For each file: read content via `git show main:<filepath>`
3. Parse frontmatter — skip if `status != ready-for-review` OR `type != capture`
4. Call Gemini CLI with a structured decomposition prompt
5. Parse Gemini's JSON response into project + tasks structure
6. Write updated project file (convert from capture → project template format)
7. Write N task files to `notes/04-tasks/<project-slug>/`
8. Atomic git commit: `git add` all new/modified files, `git rm` nothing (overwrite project file in place), `git commit`, `git pull --rebase`, `git push`

**Gemini prompt design:**
```
You are a GTD project decomposer. Given a project capture note, return JSON with this exact structure:
{
  "project": {
    "title": "string",
    "goal": "one sentence goal",
    "priority": 1-5,
    "target_end_date": "YYYY-MM-DD or null",
    "tags": ["tag1", "tag2"]
  },
  "tasks": [
    {
      "title": "string",
      "what_to_do": "string",
      "acceptance_criteria": ["checkbox 1", "checkbox 2"],
      "assigned_to": "you | ai",
      "priority": 1-5,
      "effort": "small | medium | large"
    }
  ]
}
Return ONLY valid JSON, no markdown fences, no explanation.
--- PROJECT NOTE ---
<paste note content here>
```

**Output project file format (07-templates/project.md shape):**
```yaml
---
type: project
title: "<title>"
status: in-progress
priority: <1-5>
start_date: <today>
target_end_date: <from gemini or null>
tags: [<tags>]
decomposed: true
source_capture: <original filename>
---
## Goal
<goal>

## What Needs to Happen
<summary from original note>

## Related Tasks
- [[notes/04-tasks/<slug>/001-task-name]]
- ...
```

**Output task file format (07-templates/task.md shape), one file per task:**
```yaml
---
type: task
title: "<title>"
assigned_to: you | ai
status: ready
priority: <1-5>
effort: small | medium | large
project: [[notes/03-projects/<project-slug>]]
tags: [<inherited tags>]
---
## What to Do
<what_to_do>

## Acceptance Criteria
- [ ] <criteria 1>
- [ ] <criteria 2>
```

**Error handling:**
- Gemini timeout: log error, skip file (retry next run)
- Gemini returns invalid JSON: log the raw response, skip file
- Git push failure: log, don't mark file as decomposed (retry next run)
- File already has `type: project`: skip (already decomposed)

### 2. `/Users/Office/Repos/stevewesthoek/brain/operations/runbooks/brain-project-decomposer.md`
Comprehensive runbook following the same structure as `brain-auto-router.md`:
- TL;DR post-reboot section
- What it does / why it exists
- Installation and verification
- Logic walkthrough
- Logging info
- Cron management
- Troubleshooting guide

---

## Cron Schedule
Every 5 minutes: `*/5 * * * *`

Rationale: Decomposition involves a Gemini API call (heavier than routing), and projects don't need sub-minute latency. Every 5 minutes provides a good balance.

Install command:
```bash
(crontab -l 2>/dev/null | grep -v "brain-project-decomposer"; echo "*/5 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/brain-project-decomposer.py >> /dev/null 2>&1") | crontab -
```

---

## Critical Files

| File | Purpose |
|------|---------|
| `tools/scripts/brain-auto-router.py` | Pattern source — replicate git/logging/frontmatter patterns exactly |
| `notes/07-templates/project.md` | Project frontmatter format to output |
| `notes/07-templates/task.md` | Task frontmatter format to output |
| `notes/03-projects/2026-04-10-x-playbook-becoming-a-full-time-creator.md` | First real input file to test against |

---

## Gemini CLI invocation
```python
result = subprocess.run(
    ["gemini", "--model", "gemini-2.5-flash"],
    input=prompt,
    capture_output=True,
    text=True,
    timeout=60
)
```
Auth is via OAuth in `~/.gemini/` — no API key needed. Free tier: ~1500 req/day.

---

## Verification
1. Run script manually: `python3 ~/Repos/stevewesthoek/brain/tools/scripts/brain-project-decomposer.py`
2. Check logs: `tail -20 ~/.local/share/brain/logs/project-decomposer.log`
3. Verify project file in `03-projects/` now has `type: project`, `status: in-progress`
4. Verify task files created in `04-tasks/<project-slug>/`
5. Verify git commit pushed to GitHub
6. Run `crontab -l` to confirm cron job installed
