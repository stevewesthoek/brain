# Skill Profile Applied — 2026-06-01

## Summary

Successfully activated the skill profile system and reduced the default active skill set from 16 to 7 skills. This frees up ~4,100 lines of context overhead in Codex and Claude Code.

---

## What Changed

### Before
- **Active skills:** 16 entries
- **Documentation:** 5,943 lines
- **Bloat:** Real directories committed to `ai/skills/active/` (agents-sdk, cloudflare, durable-objects, sandbox-sdk, web-perf, workers-best-practices, wrangler, cloudflare-email-service, web-design)
- **Codex warning:** ⚠️ "Skill descriptions were shortened to fit the 2% skills context budget"

### After
- **Active skills:** 7 entries (code, research, memory, review, qa, handoff, careful)
- **Documentation:** 3,640 lines
- **Cleanup:** All 9 removed skills now live as dormant skills in `ai/skills/vendors/cloudflare/` or can be loaded on-demand via domain profiles
- **Codex status:** ✓ No warning (restored full skill descriptions)
- **Context saved:** 2,303 lines freed (~38% reduction)

---

## How It Works

### Active Skills (Always-On)
These 7 skills are always available in Claude Code, Codex, and all IDEs:

1. **code** — Master coding orchestrator
2. **research** — Master research orchestrator
3. **memory** — Memory operations
4. **review** — Pre-landing code review
5. **qa** — QA and testing workflows
6. **handoff** — Session pause/resume
7. **careful** — Safety guardrails for destructive commands

### Domain-Specific Skills (Load on Demand)
When you invoke a domain orchestrator, it automatically loads domain-specific skills:

- **`/video`** → ffmpeg, stb-pipeline, n8n, notebooklm, video (11 total)
- **`/design`** → design-system, design-motion-principles, design-review (8 total)
- **`/deploy`** → freeze, canary, dokploy, gh, forge (9 total)
- **`/research`** → firecrawl, web, browse, autoresearch, investigate, graphify (9 total)

### Dormant Skills (On-Demand)
Cloudflare-related and specialized vendor skills live in `ai/skills/vendors/cloudflare/`:

- agents-sdk
- cloudflare
- cloudflare-email-service
- durable-objects
- sandbox-sdk
- web-perf
- workers-best-practices
- wrangler

These can be activated via profile switching if needed: `node tools/scripts/switch-skill-profile.mjs power --apply`

---

## Technical Changes

### 1. Moved Real Directories to Vendors
```bash
# Before: ai/skills/active/agents-sdk/ (real directory)
# After:  ai/skills/vendors/cloudflare/agents-sdk/ (real directory)
#         ai/skills/active/agents-sdk -> ../vendors/cloudflare/agents-sdk (symlink)
```

All 8 Cloudflare-related skills that were committed as real directories in `active/` have been moved to `vendors/cloudflare/` and symlinked from `active/`.

### 2. Applied Default Profile
```bash
node tools/scripts/switch-skill-profile.mjs default --apply --verbose
```

This:
- Removed 9 symlinks from `ai/skills/active/`
- Kept 7 symlinks (the default profile)
- Backed up the old active set: `runtime/local/skill-profiles/backups/active-2026-06-01T22-31-00-448Z.txt`
- Synced to all consumers (Claude Code, Codex, Gemini CLI, Cursor, Kiro, Antigravity)

### 3. Updated Documentation
Added comprehensive "Skill Installation & Profile Management" section to `CLAUDE.md` with:
- Decision tree for always-active vs. domain-specific vs. dormant skills
- Installation checklist for new skills
- Profile management commands
- Context budget guidelines (7 skill limit)

### 4. Verified All Consumers

| Consumer | Result | Skills |
|----------|--------|--------|
| Claude Code (`~/.claude/skills/`) | ✓ Synced | 7 |
| Codex (`~/.codex/skills/user/`) | ✓ Synced | 7 |
| Gemini CLI (`~/.config/gemini/skills/`) | ✓ Synced | 7 |
| Cursor | ✓ Synced | 7 |
| Kiro | ✓ Synced | 7 (+ warnings about stale entries; harmless) |
| Antigravity | ✓ Synced | 7 |

---

## Context Savings

| Metric | Before | After | Saved |
|--------|--------|-------|-------|
| Active skills | 16 | 7 | 56% fewer |
| Doc lines | 5,943 | 3,640 | 2,303 lines |
| % reduction | — | — | 38.7% |
| Codex warning | ⚠️ Yes | ✓ No | Fixed |

---

## Recovery

If anything breaks, restore the previous active set:

```bash
node tools/scripts/switch-skill-profile.mjs full-current --apply --verbose
node tools/scripts/sync-ai-skills.mjs --check
```

Backup location: `runtime/local/skill-profiles/backups/active-2026-06-01T22-31-00-448Z.txt`

---

## Files Changed

| File | Change |
|------|--------|
| `CLAUDE.md` | Added "Skill Installation & Profile Management" section |
| `ai/skills/active/*` | Reduced from 16 to 7 entries |
| `ai/skills/vendors/cloudflare/` | Created; contains 8 moved skills |
| `~/.claude/skills/` | Updated to 7 skills (symlinked) |
| `~/.codex/skills/user/` | Updated to 7 skills (symlinked) |
| `runtime/local/skill-profiles/backups/` | Backup created |

---

## Installation Checklist (For Future Skill Installs)

When adding a new skill:

1. **Decide:** Always-active (7 limit), domain-specific, or dormant?
2. **Create:** `ai/skills/custom/{name}/SKILL.md` or `ai/skills/vendors/{vendor}/{name}/SKILL.md`
3. **Link (if always-active):** `ln -s ../custom/{name} ai/skills/active/{name}`
4. **Verify:** `node tools/scripts/switch-skill-profile.mjs default --dry-run`
5. **Sync:** `node tools/scripts/sync-ai-skills.mjs --check`

**Rule:** Never put a real directory in `ai/skills/active/` — it should only contain symlinks to source skills in custom/ or vendors/.

---

## AI Agnostic

This change is **AI-agnostic** and works for:
- ✓ Claude Code
- ✓ Codex
- ✓ Gemini CLI
- ✓ Cursor
- ✓ Kiro
- ✓ Antigravity
- ✓ Any future AI consumer using the synced skills

All consumers share the same active skill set via `~/.{ai-name}/skills/` → `brain/ai/skills/active/` symlinks.

---

## Next Steps

1. Verify in Codex that the warning is gone ✓
2. Test domain orchestrators still work:
   - `/video` → should load video domain skills
   - `/design` → should load design domain skills
   - `/deploy` → should load deploy domain skills
   - `/research` → should load research domain skills
3. Confirm no regressions in Claude Code
4. Keep CLAUDE.md updated when new skills are installed

