# Skill Prune — Production-Grade Monthly Maintenance

Three-phase workflow for safe, auditable skill library pruning. **Scheduler is REPORT-ONLY by default. Quarantine and delete are manual-only with explicit approval.**

---

## Quick Reference

| Phase | Mode | Trigger | Safety | When |
|-------|------|---------|--------|------|
| **REPORT** | Automated | 7th of month (scheduler) | Report-only, no modifications | Monthly, never stops chain |
| **QUARANTINE** | Manual | User command | Symlink-only, source preserved | After review, requires approval |
| **DELETE** | Manual | User command | Quarantine + 30-day age threshold | Only after quarantine window |

---

## Phase 1: REPORT (Automated)

**Default mode. Monthly scheduler runs this only.**

### What it does
1. Inventories active skills from `ai/skills/active/`
2. Identifies staleness (> 180 days) and checks quality gates
3. Validates protected skills (42 items in config)
4. Generates candidate table with recommendations
5. Outputs reports (markdown + JSON) to `runtime/local/skill-prune/`
6. **Never modifies any files**

### When it runs
- 7th of each month via `office-nightly-scheduler.sh`
- Command: `bash tools/scripts/skill-prune-report.sh`
- Logs: `~/.local/state/office-scheduler/skill-prune.log`

### Output files
- `runtime/local/skill-prune/latest.md` — human-readable report with table
- `runtime/local/skill-prune/latest.json` — machine-readable with action URLs
- `runtime/local/skill-prune/YYYY-MM-DD-HHMMSS.{md,json}` — timestamped archive

### Example output
```
# Skill Prune Report — 2026-04-26 22:19:54 UTC

## Summary
- Active skills: 103
- Protected skills: 44
- Candidates for action: 2
- Stale threshold: 180 days

## Candidates for Quarantine
| Skill | Status |
|-------|--------|
| old-custom-skill | Stale (>180 days) |
```

---

## Phase 2: QUARANTINE (Manual)

**Never automatic. Requires user approval. Symlink-only, source preserved.**

### What it does
1. Validates skill is not protected
2. Prompts for confirmation (unless `--force`)
3. Moves active symlink: `ai/skills/active/<name>` → `ai/skills/quarantine/YYYY-MM/<name>.symlink`
4. Preserves source folder at original location
5. Creates recovery manifest with instant recovery commands
6. Updates `ai/skills/quarantine/YYYY-MM/manifest.md`

### How to run
```bash
# Quarantine a skill (with confirmation)
bash tools/scripts/skill-prune-quarantine.sh old-skill

# Quarantine with automatic confirmation
bash tools/scripts/skill-prune-quarantine.sh old-skill --force
```

### Recovery
Instant recovery command is in the manifest:
```bash
ln -s ../custom/learned/old-skill ai/skills/active/old-skill
```

### Manifest example
```markdown
## old-skill

- **Quarantined at:** 2026-04-26T22:20:00Z
- **Operator:** you
- **Active symlink moved:** ai/skills/active/old-skill → ai/skills/quarantine/2026-04/old-skill.symlink
- **Symlink target:** ../custom/learned/old-skill
- **Reason:** Manual quarantine
- **Source folder:** ai/skills/custom/learned/old-skill (PRESERVED)
- **Recovery command:** ln -s ../custom/learned/old-skill ai/skills/active/old-skill
- **Status:** quarantined
```

---

## Phase 3: DELETE (Manual, Post-Quarantine Only)

**Never automatic. Requires quarantine + 30-day age threshold + user approval.**

### Requirements
1. Skill must be in quarantine
2. Quarantine age ≥ 30 days
3. User must confirm deletion
4. Scope limited to `ai/skills/custom/learned/` by default

### How to run
```bash
# Delete a quarantined skill (with confirmation)
bash tools/scripts/skill-prune-delete.sh old-skill

# Delete with automatic confirmation
bash tools/scripts/skill-prune-delete.sh old-skill --force
```

### What it does
1. Verifies quarantine manifest exists
2. Checks quarantine age ≥ 30 days
3. Prompts for confirmation (`type 'delete <skill>' to confirm`)
4. Deletes source folder: `rm -rf ai/skills/custom/learned/<skill>`
5. Updates manifest with deletion timestamp

### Example
```bash
$ bash tools/scripts/skill-prune-delete.sh old-skill

Delete Confirmation
==================
Skill:          old-skill
Source path:    ai/skills/custom/learned/old-skill
Quarantined:    2026-03-26T22:20:00Z (31 days ago)
Manifest:       ai/skills/quarantine/2026-03/manifest.md

Action:
  1. Delete source folder: ai/skills/custom/learned/old-skill
  2. Update manifest with deletion timestamp

WARNING: This action is NOT reversible. Source files will be permanently deleted.

Confirm deletion? (type 'delete old-skill' to confirm): delete old-skill
✓ Skill deleted successfully
```

---

## Protected Skills (44)

These skills are **exempt from all pruning** — they are intentional workflow/design/operational tools:

- **Design tools (9):** design-system, web-design, huashu-design, ui-ux-pro-max, taste-skill, redesign-skill, design-review, design-consultation, plan-design-review
- **Workflow tools (11):** autoplan, setup-deploy, land-and-deploy, model-router, learner, handoff, codex, gemini, cso, careful, guard
- **Infrastructure tools (15):** dokploy, aws, azure, cloudflare, gcp, gws, hetzner, n8n, orbstack, supabase, stripe, clerk, apify, firecrawl, googleads
- **Operational tools (9):** gh, freeze, unfreeze, keep-alive, benchmark, canary, investigate, setup-browser-cookies, skill-prune
- **Special (1):** probot-app-launcher-diagnostics, probot-dashboard-scheduler-registration

Edit `ai/skills/prune-config.json` to modify protection list.

---

## Configuration

File: `ai/skills/prune-config.json`

```json
{
  "protected_skills": [
    "design-system",
    "web-design",
    ...
  ],
  "protected_categories": [
    "workflow",
    "design",
    "operational-tool",
    "session-recovery",
    "model-routing",
    "review"
  ],
  "default_mode": "report",
  "scheduler_mode": "report",
  "quarantine_requires_confirmation": true,
  "delete_requires_quarantine": true,
  "delete_min_quarantine_days": 30,
  "delete_scope_default": "custom-learned-only",
  "report_output_dir": "runtime/local/skill-prune",
  "quarantine_dir": "ai/skills/quarantine",
  "scheduled_run_day": 7
}
```

### Customization
- **Stale threshold:** `export SKILL_PRUNE_STALE_DAYS=180` (default)
- **Force quarantine:** `--force` flag (skip confirmation)
- **Force delete:** `--force` flag (skip confirmation)

---

## Classification

### Learned-Gotcha (Deletion Candidate)
Recurring platform-specific problem that is:
- NOT Googleable (specific to this codebase/stack)
- NOT generic advice
- Describes a distinct recurring problem (not one-off fix)

**Deletion candidate if:** Not touched in 6+ months AND (project-specific one-off OR fails quality gate)

### Workflow (Always Protected)
Intentional skill for design, review, session, model-routing, or operational workflow. Never auto-pruned.

### Operational-Tool (Always Protected)
CLI wrapper, infrastructure tool, integration helper. Never auto-pruned.

### Design (Always Protected)
Design system, web design, UI/UX, taste/critique. Part of permanent design stack.

---

## Quality Gates

For each learned skill, confirm ALL THREE:

1. **Not Googleable:** Answer not available via search + SO + official docs
2. **Codebase/Stack-Specific:** Problem unique to this repo or stack (not generic advice)
3. **Recurring Problem:** Solves something that has happened more than once (not one-off fix)

**Fail ANY ONE → deletion candidate.**

---

## Scheduler Integration

### Current setup
- **Runs on:** 7th of each month
- **Mode:** REPORT only
- **Chain behavior:** Never stops main scheduler chain
- **Logs:** `~/.local/state/office-scheduler/skill-prune.log`

### Implementation
`office-nightly-scheduler.sh` runs:
```bash
# REPORT-only — never calls quarantine/delete
bash tools/scripts/skill-prune-report.sh
```

### Email notifications (optional)

Enable email delivery via GWS Gmail API:

```bash
# Set in scheduler config or shell environment
export SKILL_PRUNE_EMAIL_ENABLED=1
export SKILL_PRUNE_EMAIL_TO=your-email@example.com

# Optional: specify GWS binary (defaults to 'gws')
export GWS_BIN=gws
```

Then the report script sends via GWS Gmail:
```bash
# Prepare RFC 2822 format email
# Encode to base64 URL-safe (Gmail raw message format)
# Send via GWS Gmail API
gws gmail users messages send --params '{"userId": "me", "body": {"raw": "base64-encoded-message"}}'
```

**Requirements:**
- GWS CLI installed and authenticated (`gws auth login`)
- Gmail API enabled in Google Cloud project
- User account with Gmail access

### Monthly prevention
Tracks last run month in `~/.local/state/office-scheduler/skill-prune.last-month` to prevent double-runs.

---

## Safety Principles

✓ **Scheduler is REPORT-ONLY** — zero automatic destructive actions
✓ **Quarantine is symlink-only** — source folders always preserved
✓ **Delete requires quarantine precedent** — never direct deletion
✓ **Age threshold enforced** — 30-day minimum post-quarantine
✓ **All actions logged** — manifests provide audit trail
✓ **Protected skills exempt** — intentional tools never pruned
✓ **Recovery paths documented** — instant recovery commands in manifest

---

## Troubleshooting

### Script not found
```bash
# Verify scripts exist and are executable
ls -lh tools/scripts/skill-prune-*.sh
chmod +x tools/scripts/skill-prune-*.sh
```

### Config not found
```bash
# Verify config exists
cat ai/skills/prune-config.json | jq .
```

### Can't quarantine: skill is protected
Normal behavior. Skill is intentional and exempt from pruning.

### Can't delete: not quarantined long enough
Verify quarantine age: `cat ai/skills/quarantine/YYYY-MM/manifest.md | grep "Quarantined at"`

### Stale check not working
Verify `stat -f` is available (macOS BSD). Script falls back to GNU `find` if not available.

---

## Manual Workflow Example

```bash
# 1. Monthly scheduler runs (7th of month)
# Generates report → runtime/local/skill-prune/latest.md

# 2. Review report and identify candidate
# $ cat runtime/local/skill-prune/latest.md
# Shows: old-custom-skill (stale 200+ days)

# 3. Quarantine the skill (manual decision)
bash tools/scripts/skill-prune-quarantine.sh old-custom-skill
# Symlink moved to quarantine/
# Manifest created
# Source preserved

# 4. Wait 30 days (or monitor for confirmation)
# Ensure no unintended side effects

# 5. Delete the skill (manual confirmation)
bash tools/scripts/skill-prune-delete.sh old-custom-skill
# Source folder deleted
# Manifest updated with deletion timestamp

# Done — skill removed cleanly with full audit trail
```

---

## Version

- **Released:** 2026-04-26
- **Status:** Production-grade, stable
- **Maintained by:** Claude Code system
