# Warp Agent Environment Setup

## Overview

This document describes the **Warp Agent Environment** for running monthly infrastructure health audits on the brain repo.

**What:** Monthly automated health check of the machine-brain infrastructure  
**When:** ~Once per month (uses ~2-4 of your 150 free Warp messages)  
**Where:** Warp Agent Mode (requires Warp free account)  
**Why:** Catch configuration drift, verify symlinks, check documentation, scan for secrets

---

## Warp Environment Configuration

Use these exact values when creating an environment in Warp:

### Name
```
brain-health-audit
```

### Description
```
Monthly infrastructure health check for brain repo - verifies skill sync, symlinks, documentation, git status, and reports issues
```

### Repo(s)
```
stevewesthoek/brain
```

### Docker image reference
```
node:24-alpine
```

**Why Alpine?**
- Lightweight (~150MB vs 900MB+ for standard)
- Includes Node.js, npm, bash, git
- Python available via `apk add python3`
- Fast startup

### Setup command(s)
```bash
apk add --no-cache python3 bash git curl && cd /workspace && npm install
```

**What this does:**
- `apk add --no-cache` — Install Python, bash, git, curl (Alpine package manager)
- `cd /workspace` — Navigate to cloned repo
- `npm install` — Install Node dependencies (if any)

---

## Using the Environment

### Once per month, in Warp Agent Mode:

**Prompt:**
```
Run the comprehensive health audit for the brain repo in the brain-health-audit environment. 
Execute: bash operations/scripts/warp-health-audit.sh

Report findings on: skill sync status, symlink integrity, critical file presence, documentation, 
secrets scan, git status, node health, CLI tools, directory structure, and recent commits.

If any issues are found, explain them clearly.
```

**Expected output:**
- ✓ 10 health checks performed
- ✓ Clear pass/warn/fail status for each
- ✓ Summary showing overall health status
- ✓ Actionable recommendations for any issues

**Time to run:** ~30 seconds  
**Messages used:** 2-4 (depends on issue complexity)

---

## What Gets Checked

The audit script (`operations/scripts/warp-health-audit.sh`) performs 10 comprehensive checks:

| # | Check | What It Does |
|---|-------|------------|
| 1 | Skill Sync | Verifies all skills are synced to all consumers (`sync-ai-skills.mjs --check`) |
| 2 | Symlinks | Checks that all critical symlinks exist (claude, codex, gemini, kiro, skills) |
| 3 | Critical Files | Verifies CLAUDE.md, runbooks, docs, and core directories exist |
| 4 | Documentation | Checks that key docs are present and not empty |
| 5 | Secret Scan | Scans for accidentally committed API keys, tokens, passwords |
| 6 | Git Status | Reports uncommitted changes and unpushed commits |
| 7 | Node/NPM | Verifies Node.js and npm are installed and usable |
| 8 | CLI Tools | Checks that git, bash, node, spark-cli are available |
| 9 | Directory Structure | Validates all key directories exist with expected content |
| 10 | Recent Commits | Shows last 3 commits for context |

---

## When to Run This

### Recommended Schedule
- **Monthly** — run it on the 1st of each month
- **After major changes** — after installing new skills or major infrastructure updates
- **Before travel** — before switching devices to verify everything is synced

### When It Will Catch Issues

This audit will alert you to:
- ✓ Skill sync failures (broken symlinks, missing files)
- ✓ Uncommitted infrastructure changes
- ✓ Accidentally committed secrets or credentials
- ✓ Missing documentation
- ✓ Git divergence (commits not pushed)
- ✓ Broken symlinks from home directory
- ✓ Stale or outdated configurations

---

## Example Scenarios

### Scenario 1: Clean Bill of Health
```
✓ Skill sync check passed
✓ Symlink exists: ~/.claude
✓ Symlink exists: ~/.codex
✓ File/dir exists: CLAUDE.md
✓ All commits pushed to origin/main
✓ Working tree clean
✓ Node.js installed: v24.12.0
✓ npm installed: 10.2.4
✓ spark-cli: 1.1.0

HEALTH: EXCELLENT (0 errors, 0 warnings)
```

### Scenario 2: Minor Issues
```
⚠ $WARNINGS uncommitted changes
  M CLAUDE.md
  M operations/README.md

✓ All other checks passed

HEALTH: GOOD (0 errors, 1 warning) — Commit changes when ready
```

### Scenario 3: Issues Detected
```
✗ Skill sync check failed
✗ Symlink missing: ~/.gemini
⚠ 3 uncommitted changes

HEALTH: NEEDS ATTENTION — Fix issues above
Next step: node tools/scripts/sync-ai-skills.mjs
```

---

## Interpreting Results

### Green (✓ Pass)
System is operating normally. No action needed.

### Yellow (⚠ Warning)
Minor issue detected (uncommitted changes, sparse docs, non-critical tool missing).  
Review and address when convenient.

### Red (✗ Error)
Critical issue detected (broken symlinks, sync failure, secret found).  
Address before next commit/deploy.

---

## Cost Analysis

| Per Run | Frequency | Monthly Cost |
|---------|-----------|--------------|
| 2-4 messages | 1x/month | 2-4 messages |
| **Total available** | — | **150 messages** |
| **Remaining** | — | **~140+ messages** |

**Conclusion:** You have plenty of free credits for this use case.

---

## Files Included

- **Script:** `operations/scripts/warp-health-audit.sh` (8.2KB)
- **Documentation:** `operations/runbooks/warp-agent-setup.md` (this file)

---

## Setting Up the Environment

### Step 1: Go to Warp
Visit your Warp account → Environments

### Step 2: Create Environment
Click "Create environment"

### Step 3: Fill in the form
| Field | Value |
|-------|-------|
| **Name** | `brain-health-audit` |
| **Description** | `Monthly infrastructure health check for brain repo - verifies skill sync, symlinks, documentation, git status, and reports issues` |
| **Repo(s)** | `stevewesthoek/brain` |
| **Docker image reference** | `node:24-alpine` |
| **Setup command(s)** | `apk add --no-cache python3 bash git curl && cd /workspace && npm install` |

### Step 4: Create
Click the "Create" button

### Step 5: Use it
In Warp Agent Mode, select the `brain-health-audit` environment and run:
```
bash operations/scripts/warp-health-audit.sh
```

---

## Troubleshooting

### "Command not found: bash"
The setup command failed. Check that the Docker image has bash installed. Alpine includes bash by default.

### "git: command not found"
The setup command didn't run. Verify the setup command is correct and includes `apk add --no-cache ... git`

### "Module not found: npm"
This is expected if there are no npm dependencies. The script handles this gracefully.

### Symlink checks report missing links
Symlinks only exist on your Mac. On the Warp Docker container, they won't exist. This is expected and safe — the audit reports them as warnings, not errors.

---

## Next: Monthly Reminders

Consider setting a calendar reminder:
- **Monthly on the 1st:** Run health audit in Warp

Or ask Warp Agent directly once per month:
> "Run the brain repo health audit"

---

## Reference

- **Audit script:** `operations/scripts/warp-health-audit.sh`
- **Brain CLAUDE.md:** Main infrastructure docs
- **Skill sync script:** `tools/scripts/sync-ai-skills.mjs`
- **Runbooks:** `operations/runbooks/`

---

**Last updated:** 2026-05-15  
**Cost per run:** ~2-4 Warp messages  
**Frequency:** Monthly  
**Status:** Ready to use
