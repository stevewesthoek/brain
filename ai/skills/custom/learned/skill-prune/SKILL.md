---
name: skill-prune
description: Production-grade monthly skill library pruning — REPORT mode only by default. Identifies staleness, overlap, and quality-gate failures. Quarantine and delete modes are manual-only with confirmation requirements.
---

# skill-prune — Production-Grade Workflow

**Monthly automated task:** REPORT mode only. Never automatically quarantine or delete.

**Manual workflows:** QUARANTINE (requires approval), DELETE (requires prior quarantine + age threshold).

---

## REPORT Mode (Automated — Safe)

**Default mode. Only allowed in scheduler automation.**

REPORT mode:
- Inventories active skills and classifies each
- Identifies candidates for action (unused, redundant, stale, overlapping, project-specific, low-value)
- Protects intentional workflow/design/operational skills (see `prune-config.json`)
- Produces markdown and JSON reports only
- **Never modifies any files**
- **Never deletes symlinks or folders**
- **Never quarantines anything**

### REPORT Output

Writes to `runtime/local/skill-prune/`:

- `latest.md` — human-readable report with candidate table
- `latest.json` — machine-readable report for action buttons/automation
- `YYYY-MM-DD-HHMMSS.md` — timestamped copy (optional archive)
- `YYYY-MM-DD-HHMMSS.json` — timestamped copy (optional archive)

### REPORT Table Format

| Skill | Location | Category | Finding | Recommendation | Risk | Protected | Action |
|-------|----------|----------|---------|----------------|------|-----------|--------|
| example-skill | ai/skills/custom/learned/example | learned-gotcha | Stale (6+ months) + one-off | quarantine | low | false | manual-confirm |

### REPORT JSON Format

```json
{
  "generated_at": "2026-04-26T22:00:00Z",
  "mode": "report",
  "repo": "brain",
  "summary": {
    "active_count": 103,
    "protected_count": 42,
    "candidates_total": 5,
    "keep_count": 0,
    "manual_review_count": 2,
    "quarantine_candidate_count": 2,
    "delete_candidate_count": 1,
    "merge_candidate_count": 0
  },
  "protected_skills": ["design-system", "web-design", "huashu-design", ...],
  "candidates": [
    {
      "skill": "example-skill",
      "active_path": "ai/skills/active/example-skill",
      "source_path": "ai/skills/custom/learned/example-skill",
      "source_type": "custom-learned",
      "category": "learned-gotcha",
      "finding": "Stale 6+ months AND project-specific one-off fix",
      "recommendation": "quarantine",
      "risk": "low",
      "protected": false,
      "actions": {
        "keep": "action://skill-prune/keep?skill=example-skill",
        "quarantine": "action://skill-prune/quarantine?skill=example-skill",
        "delete": "action://skill-prune/delete?skill=example-skill"
      }
    }
  ]
}
```

---

## QUARANTINE Mode (Manual Only)

**Never used by scheduler. Requires explicit user approval.**

Quarantine:
- Disables skill by moving active symlink only
- Preserves source skill folder in `ai/skills/custom/learned/`
- Creates recovery path
- Writes quarantine manifest
- **Never deletes source content**

### Quarantine Workflow

1. User approves quarantine via action button or manual command
2. Symlink moved: `ai/skills/active/<name>` → `ai/skills/quarantine/YYYY-MM/<name>.symlink`
3. Manifest written: `ai/skills/quarantine/YYYY-MM/manifest.md`
4. Source folder preserved at original location

### Quarantine Manifest Format

File: `ai/skills/quarantine/YYYY-MM/manifest.md`

```markdown
# Quarantine Manifest — 2026-04

## example-skill

- **Quarantined at:** 2026-04-26T22:00:00Z
- **Operator:** (user or scheduler)
- **Skill name:** example-skill
- **Active symlink moved:** ai/skills/active/example-skill → ai/skills/quarantine/2026-04/example-skill.symlink
- **Symlink target:** ../custom/learned/example-skill
- **Reason:** Stale 6+ months + project-specific one-off
- **Risk:** low
- **Source folder:** ai/skills/custom/learned/example-skill (PRESERVED)
- **Recovery command:**
  ```bash
  ln -s ../custom/learned/example-skill ai/skills/active/example-skill
  ```
- **Recovery command (if vendor):**
  ```bash
  ln -s ../vendors/<vendor>/<skill-name> ai/skills/active/<skill-name>
  ```
- **Status:** quarantined
```

### Quarantine Safety Rules

- Cannot quarantine protected skills (validation blocks)
- Symlink only; source unchanged
- Manifest provides instant recovery
- No symlink deletion

---

## DELETE Mode (Manual Only, Requires Quarantine First)

**Never used by scheduler. Requires explicit user approval + age threshold.**

Delete mode requirements:
- Skill must have been quarantined for `delete_min_quarantine_days` (default 30 days)
- User must confirm deletion
- Scope: `ai/skills/custom/learned/<skill>` only by default
- Cannot delete vendor skills or workflow/design/operational skills
- Updates quarantine manifest with deletion timestamp
- Never deletes anything outside `ai/skills/custom/learned/` unless explicitly approved

### Delete Workflow

1. Check quarantine age (>= 30 days by default)
2. User confirms deletion
3. Delete source folder: `rm -rf ai/skills/custom/learned/<skill>`
4. Update manifest: set status = deleted, deletion_timestamp = now
5. Verify symlink is already removed (from quarantine)

### Delete Safety Rules

- Delete only after quarantine age threshold
- Quarantine manifest must exist
- Manifest must show skill was quarantined (not just deleted directly)
- Cannot delete protected skills (validation blocks)
- Cannot delete workflow/design/operational tools by default
- Scope limited: learned skills only unless explicitly approved
- All actions logged

---

## Classification Rules

### Category: `learned-gotcha`

Recurring platform-specific problem that is:
- NOT Googleable (specific to this codebase/stack)
- NOT generic advice (not a tutorial)
- Describes a distinct recurring problem (not one-off fix)

**Deletion candidate if:**
- Not touched in 6+ months AND
- Project-specific one-off (not recurring platform gotcha) OR
- Fails any one quality gate (not Googleable, not specific, not recurring)

### Category: `workflow`

Intentional skill for design, review, session, model-routing, or operational workflow.

**Always protected.** Deletion candidate: never unless explicitly approved and removed from protected list.

### Category: `operational-tool`

CLI wrapper, infrastructure tool, integration helper (dokploy, gh, aws, cloudflare, etc.).

**Always protected.** Deletion candidate: never unless tool becomes obsolete and is removed from protected list.

### Category: `design`

Design system, web design, UI/UX, taste/critique, redesign.

**Always protected.** Deletion candidate: never; part of permanent design stack.

---

## Stale Check (macOS-Compatible)

Portable stale detection — works on macOS BSD `find` and GNU `find`:

```bash
# Find SKILL.md files in custom/learned, get modification times, sort by staleness
cd /Users/Office/Repos/stevewesthoek/brain

# macOS/BSD version (using stat -f):
find ai/skills/custom/learned -name "SKILL.md" -print0 | \
  xargs -0 stat -f "%m %N" 2>/dev/null | \
  sort -n | \
  awk -v cutoff="$(date -v-6m +%s)" '{
    mtime=$1; path=$2
    skill=substr(path, index(path, "custom/learned/") + 15)
    skill=substr(skill, 1, index(skill, "/") - 1)
    if (mtime < cutoff && skill != "") print skill " last_modified=" mtime
  }'

# Alternative Python version (most portable):
import os, time
cutoff = time.time() - 6 * 30 * 24 * 3600  # 6 months
for root, dirs, files in os.walk("ai/skills/custom/learned"):
    if "SKILL.md" in files:
        skill_md = os.path.join(root, "SKILL.md")
        mtime = os.path.getmtime(skill_md)
        if mtime < cutoff:
            skill = os.path.basename(root)
            print(f"{skill}: {time.ctime(mtime)}")
```

---

## Overlap Scan

Manual inspection of SKILL.md for each candidate. Current known clusters for evaluation:

- **Dokploy cluster:** `dokploy`, `dokploy-*-*` → consider consolidation into one skill
- **Next.js cluster:** `nextjs-*-*` → evaluate for merge
- **Meta/Facebook cluster:** `meta-*-*` → evaluate for merge
- **GWS cluster:** `gws-*-*` → evaluate for consolidation
- **Playwright cluster:** `playwright-*-*` → consider single skill

---

## Quality Gate Recheck

For each learned skill, confirm it passes ALL THREE:

1. **Not Googleable:** Answer not available via search + SO + official docs
2. **Codebase/Stack-Specific:** Problem unique to this repo or stack, not generic advice
3. **Recurring Problem:** Solves something that has happened more than once, not one-off fix

**Fail on ANY ONE → deletion candidate.**

---

## Scheduler Integration

**Monthly run on the 7th:**

- Mode: REPORT only
- Outputs: `runtime/local/skill-prune/latest.md`, `latest.json`
- Email: Optional via GWS (if `SKILL_PRUNE_EMAIL_ENABLED=1`)
- No file modifications
- No symlink changes
- No quarantine or delete

**Scheduler command:**

```bash
cd $HOME/Repos/stevewesthoek/brain && \
  bash tools/scripts/skill-prune-report.sh
```

**Email (optional):**

Set environment variables in scheduler config or `.env`:

```bash
export SKILL_PRUNE_EMAIL_ENABLED=1
export SKILL_PRUNE_EMAIL_TO=your-email@example.com
export GWS_BIN=gws  # optional, defaults to gws
```

Then the report script automatically sends via GWS Gmail API:
- Prepares RFC 2822 format email (From: me, To: ..., Subject: ...)
- Encodes to base64 URL-safe format (Gmail raw message format)
- Sends via: `gws gmail users messages send --params '{...}'`
- Subject: "Skill Prune Report — April 2026"
- Body: Markdown report content

---

## Manual Action Workflow

1. Scheduler generates report email
2. Email includes action buttons (placeholders for now):
   - `action://skill-prune/keep?skill=<name>`
   - `action://skill-prune/quarantine?skill=<name>`
   - `action://skill-prune/delete?skill=<name>`
3. User clicks button → confirmation page
4. User confirms → backend runs `skill-prune-quarantine.sh` or `skill-prune-delete.sh`
5. Script validates skill, writes manifest, updates symlinks
6. Script reports success/failure

**Until action buttons are wired:**

Manual shell fallback:

```bash
# Quarantine:
bash tools/scripts/skill-prune-quarantine.sh <skill-name>

# Delete (after 30-day quarantine):
bash tools/scripts/skill-prune-delete.sh <skill-name>

# Keep (mark in manifest):
bash tools/scripts/skill-prune-keep.sh <skill-name>
```

---

## Configuration

Source of truth: `ai/skills/prune-config.json`

- Protected skills list
- Protected categories
- Default mode: `report`
- Scheduler mode: `report`
- Quarantine age threshold
- Delete scope
- Report output directory

---

## Summary

**Safety principles:**

- Monthly scheduler is REPORT-ONLY, never destructive
- Quarantine requires manual approval + confirmation
- Delete requires quarantine + age threshold + manual approval
- Protected skills exempt from all automated pruning
- All actions logged and reversible
- No file modifications in REPORT mode

**Cadence:**

- **Automated:** 7th of each month, REPORT only
- **Manual:** Quarantine and delete at operator discretion, with confirmation

**Target steady state:**

- Learned gotchas: < 20 skills, each recurring platform-specific problem
- Workflow/design/operational: all protected, never auto-pruned
- Total active: 80–100 skills (current: 103)
