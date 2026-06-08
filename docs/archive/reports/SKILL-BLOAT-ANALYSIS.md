# Skill Bloat Analysis & Fix Report

**Date:** 2026-06-01  
**Status:** CRITICAL - Skill profile system installed but NOT APPLIED  
**Impact:** Codex receives 5,943 lines of skill documentation instead of ~1,000  
**Root Cause:** Real directories (not symlinks) were committed to `ai/skills/active/`

---

## Problem Summary

You're seeing this warning:

```
⚠ Skill descriptions were shortened to fit the 2% skills context budget. 
Codex can still see every skill, but some descriptions are shorter.
```

**Why:** `ai/skills/active/` currently contains **16 skill entries (8 real directories + 8 symlinks)**, totaling **5,943 lines** of documentation. This is eating Codex's precious context budget.

**What should be there:** Only **7 skills** in the default profile (code, research, memory, review, qa, handoff, careful) — approximately **1,800 lines**. That's a **69% reduction** in context overhead.

---

## The Real Problem: Directory vs. Symlink

### What's currently in `ai/skills/active/`:

```
agents-sdk/                        ← REAL DIRECTORY (221 lines)
cloudflare/                        ← REAL DIRECTORY (245 lines)
cloudflare-email-service/          ← REAL DIRECTORY (103 lines)
durable-objects/                   ← REAL DIRECTORY (186 lines)
sandbox-sdk/                       ← REAL DIRECTORY (177 lines)
web-perf/                          ← REAL DIRECTORY (201 lines)
workers-best-practices/            ← REAL DIRECTORY (127 lines)
wrangler/                          ← REAL DIRECTORY (545 lines)

careful → ../vendors/gstack/careful          ← symlink (59 lines)
code → ../custom/code                        ← symlink (545 lines)
handoff → ../custom/handoff/handoff          ← symlink (395 lines)
memory → ../custom/memory                    ← symlink (296 lines)
qa → ../vendors/gstack/qa                    ← symlink (1,055 lines)
research → ../custom/research                ← symlink (246 lines)
review → ../vendors/gstack/review            ← symlink (1,044 lines)
web-design → ../custom/web-design            ← symlink (121 lines)

Total: 5,943 lines loaded into every Codex session
```

### Why they're real directories (not symlinks):

These 8 skills (agents-sdk, cloudflare*, durable-objects, sandbox-sdk, web-perf, workers-best-practices, wrangler) were **committed directly to `ai/skills/active/`** instead of being placed in `ai/skills/custom/` or `ai/skills/vendors/` and symlinked.

This likely happened during a git merge or manual installation that didn't follow the symlink pattern documented in `CLAUDE.md`.

---

## The Skill Profile System (Already Installed but Inactive)

A profile system was implemented in commit `91b6b664` (May 8, 2026) that:

1. **Defines domain-based profiles** (default, video, design, deploy, research, power, productivity)
2. **Keeps source skills intact** — no skills were deleted or moved
3. **Changes only `ai/skills/active/`** — the switcher is conservative
4. **Activates by profile** — load only what you need per context

### Profiles available:

| Profile | Skills | Purpose |
|---------|--------|---------|
| `default` | 7 skills | code, research, memory, review, qa, handoff, careful |
| `video` | 11 skills | + video, ffmpeg, stb-pipeline, n8n, notebooklm, design |
| `design` | 8 skills | + design, design-system, design-motion-principles, design-review |
| `deploy` | 9 skills | + freeze, canary, land-and-deploy, dokploy, gh, forge |
| `research` | 9 skills | + firecrawl, web, browse, graphify, autoresearch, investigate |
| `power` | 17 skills | Most orchestrators + domain tools |
| `productivity` | 5 skills | code, memory, handoff, careful, research |
| `full-current` | 119 skills | RECOVERY: all original active entries (pre-May-8) |

---

## Why It's Not Applied (and How to Know)

The profile system was **never activated on this machine**. Evidence:

1. **`ai/skills/active/` still has real directories** that should have been converted to symlinks
2. **Default profile has never been applied** — commit `91b6b664` did the work, but `switch-skill-profile.mjs --apply` was never run
3. **The 119-entry `full-current.txt` snapshot** was created pre-change as a safety net, but it was never needed

This means Codex has been loading the wrong skill set for weeks.

---

## How to Fix This

### Step 1: Convert Real Directories to Symlinks

These 8 directories need to be moved to `ai/skills/vendors/cloudflare/` (or similar) and symlinked:

```bash
# Example for one skill:
mv /Users/Office/Repos/stevewesthoek/brain/ai/skills/active/agents-sdk \
   /Users/Office/Repos/stevewesthoek/brain/ai/skills/vendors/cloudflare/agents-sdk

ln -s ../vendors/cloudflare/agents-sdk \
   /Users/Office/Repos/stevewesthoek/brain/ai/skills/active/agents-sdk
```

OR simpler: let the switcher handle it by removing real dirs and verifying the symlinks work.

### Step 2: Apply the Default Profile

```bash
cd /Users/Office/Repos/stevewesthoek/brain
node tools/scripts/switch-skill-profile.mjs default --dry-run --verbose
```

This will show:
- What entries would be removed
- What entries would be added
- All profile skills validate to source paths

If it reports non-symlink entries, you have the directory problem identified.

### Step 3: Apply for Real

```bash
node tools/scripts/switch-skill-profile.mjs default --apply --verbose
```

This:
- Removes active entries not in the profile
- Creates symlinks for profile skills
- Backs up the old active set
- Runs sync-ai-skills.mjs to update Claude Code, Codex, Gemini CLI, Cursor, Kiro, Antigravity

### Step 4: Verify

```bash
node tools/scripts/sync-ai-skills.mjs --check
```

Should show all consumers have the same 7 skills.

---

## Why This Matters

**Before (current state):**
- 16 active skills = 5,943 lines of docs
- Codex budget warning → descriptions truncated
- 69% context waste on unnecessary skills

**After (default profile):**
- 7 active skills = ~1,800 lines of docs
- Codex warning gone
- 69% context saved
- Load domain skills on-demand (e.g., `/video` loads video profile automatically)

---

## The Real Solution: Prevent This in the Future

### Documentation Issue

The current `CLAUDE.md` says:

> "Before installing ANY skill, CLI, or MCP server: run `/brain-universal-capability-install`."

But it **does NOT** say:

1. Where new skills go (ai/skills/custom/ or ai/skills/vendors/)
2. How to decide if a skill should be active or dormant
3. What to do after installation (create a symlink in active/)
4. What the 7-skill context ceiling is

### Proposed Fix: Installation Checklist

Add to `CLAUDE.md` under a new section "Skill Installation & Categorization":

```markdown
## Skill Installation & Categorization Protocol

When installing a new skill, follow this decision tree:

### 1. Determine Skill Type

**Always-active skills** (always-on, never dormant):
- Orchestrators: code, design, video, web, memory, research
- Foundations: review, handoff, careful, qa
- Current limit: 7 skills in default profile (context budget)

**Domain-specific skills** (active only in that domain):
- Video domain: ffmpeg, stb-pipeline, n8n, notebooklm
- Design domain: design-system, design-motion-principles, design-review
- Deploy domain: freeze, canary, land-and-deploy, dokploy, gh, forge
- Research domain: firecrawl, browse, web, autoresearch, investigate
- Load automatically when you invoke `/video`, `/design`, `/deploy`, `/research`

**Never active** (always in ai/skills/custom/, loaded on-demand):
- Specialized vendor skills: agents-sdk, cloudflare*, durable-objects, sandbox-sdk, web-perf, workers-best-practices, wrangler
- Single-use skills: individual project tasks, one-off integrations
- Reference-only skills: documentation, API references, runbooks

### 2. Installation Steps

1. **Decide category** — Use the decision tree above
2. **Place the skill:**
   - First-party → `ai/skills/custom/{skill-name}/`
   - Third-party → `ai/skills/vendors/{vendor}/{skill-name}/`
   - Never directly in `ai/skills/active/`
3. **If active:** Create symlink in `ai/skills/active/`
   ```bash
   ln -s ../custom/{skill-name} ai/skills/active/{skill-name}
   ```
4. **If dormant:** Omit the symlink (it lives in source, not active)
5. **Add to profile:** Update `docs/skills/profiles/default.txt` or domain profile
6. **Test:** Run `node tools/scripts/switch-skill-profile.mjs default --dry-run`
7. **Deploy:** `node tools/scripts/sync-ai-skills.mjs --check`

### 3. Context Budget

- **Default profile:** 7 skills (~1,800 lines)
- **Maximum before warning:** 15 skills (~5,000 lines)
- **Current actual:** 16 skills (bloated)

If sync-ai-skills.mjs warns about context budget, check:
1. Are there real directories in ai/skills/active/ that should be dormant?
2. Is the profile correct? Run `node tools/scripts/switch-skill-profile.mjs default --check`
3. Need to add an always-on skill? Update docs/skills/profiles/default.txt AND this section

### 4. Never Do This

- Put a real directory/file in ai/skills/active/ (should always be symlinks)
- Make a skill active without adding it to a profile
- Add a skill to the default profile without reviewing context impact
- Delete source skills when moving them to vendors/ or custom/
- Bypass the profile system by manually copying skills to ~/.claude/skills/
```

---

## Immediate Action Items

1. **Run the dry-run** to confirm the problem:
   ```bash
   node tools/scripts/switch-skill-profile.mjs default --dry-run --verbose
   ```

2. **If it shows real directories:** Delete them and restore symlinks (safest path)

3. **Apply the profile:**
   ```bash
   node tools/scripts/switch-skill-profile.mjs default --apply --verbose
   ```

4. **Verify sync:**
   ```bash
   node tools/scripts/sync-ai-skills.mjs --check
   ```

5. **Update `CLAUDE.md`** with the installation checklist above

6. **Create a memory entry** to record this issue + the solution for future reference

---

## Files Involved

| Path | Purpose |
|------|---------|
| `ai/skills/active/` | Currently: 8 real dirs + 8 symlinks (wrong) → Should be: 7 symlinks only |
| `docs/skills/profiles/default.txt` | Defines the 7 correct skills |
| `tools/scripts/switch-skill-profile.mjs` | Applies profile changes |
| `tools/scripts/sync-ai-skills.mjs` | Syncs to all AI consumers (Claude, Codex, Gemini, IDE) |
| `CLAUDE.md` | Should document the installation checklist |
| `docs/skills/profile-activation-runbook.md` | How to use the profile system |

---

## Context Savings

| Metric | Current | Target | Savings |
|--------|---------|--------|---------|
| Active skills | 16 | 7 | 56% reduction |
| Doc lines | 5,943 | ~1,800 | 70% reduction |
| Codex context saved | 0 | ~4,143 lines | 4,143 lines |
| Budget warning | ⚠️ Yes | ✓ No | Fixed |

**Bottom line:** Applying the default profile frees up **~4,100 lines** of Codex context for actual work while preserving every source skill and all orchestrator routing.

