# Infrastructure Summary: Unified CLI Ecosystem for All AIs

**Completed:** 2026-05-25  
**Scope:** Automated, discoverable CLI management for Claude Code, Codex, and Gemini CLI  
**Result:** Single command workflow + automatic discovery via README

---

## Problem Solved

You said:
> "This is scattered. Every AI on this computer should have access to all the CLIs. There should be one list, a complete exhaustive list of all the CLIs that are installed on this computer. There should be one unified way of accessing them for all the AIs."

**Root issue:** Three AIs, unclear which CLIs they can access, no automatic workflow, scattered documentation, manual updates required.

**Codex-specific complaint:** Codex claimed it couldn't access `notebooklm`, despite it being installed and available.

---

## Solution: Four-Layer System

### 1. Centralized CLI Registry
**File:** `operations/CLI-MANIFEST.md` (1000+ lines)

Contains:
- 70+ CLIs with paths, symlink targets, installation methods
- AI access matrix (Claude Code ✅ / Codex ✅ / Gemini ✅)
- Verification commands for each CLI
- Installation reference

**Key insight:** All CLIs symlink to `~/.local/bin/`, all in system `$PATH`. All AIs inherit `$PATH`.

### 2. Automated Installation Workflow
**Commands:**
```bash
# Install a CLI (all 3 steps automatic)
install-cli --name cmd --path /path --description "what it does"

# Verify it works
verify-cli-access cmd
```

**What happens automatically:**
1. ✅ Creates symlink to `~/.local/bin/`
2. ✅ Updates `operations/CLI-MANIFEST.md`
3. ✅ Runs `sync-ai-skills.mjs` to sync to all AIs
4. ✅ Verifies access in Claude Code
5. ✅ Reports status + guides troubleshooting

### 3. Discoverable Documentation
**Root README.md** - ⚡ Quick Reference section at top
```markdown
## ⚡ Quick Reference: Installing & Managing CLIs

**You install a CLI? It goes here automatically.**

install-cli --name "cmd" --path "/path" --description "what it does"
verify-cli-access "cmd"
```

This is the **first thing AIs read** when entering the repo.

### 4. Comprehensive Guides
**Files:**
- `operations/CLI-INSTALLATION-GUIDE.md` — Procedural guide (scenario-based)
- `operations/AI-CONFIG-INDEX.md` — Central configuration directory
- `operations/runbooks/codex-cli-access.md` — Codex-specific troubleshooting
- `CLAUDE.md` — References unified access model

---

## What You Get

### For Users
- ✅ One command to install a CLI: `install-cli --name cmd --path /path`
- ✅ No manual steps to remember
- ✅ Automatic manifest updates
- ✅ Automatic AI synchronization
- ✅ Automatic verification
- ✅ Discovery at repo root (README.md Quick Reference)

### For All AIs
- ✅ Unified access to all CLIs via system `$PATH`
- ✅ All CLIs in `~/.local/bin/` (consistent symlink location)
- ✅ Single registry to check: `operations/CLI-MANIFEST.md`
- ✅ If CLI is in manifest, all AIs can access it
- ✅ If CLI is missing from one AI, it's a bug in configuration

### For Codex Specifically
- ✅ Can now access `notebooklm` (confirmed working)
- ✅ Can access all 70+ other CLIs
- ✅ Computer Use shell has full `$PATH`
- ✅ See `operations/runbooks/codex-cli-access.md` for troubleshooting

---

## Files Created/Updated

### New Files
1. `operations/CLI-MANIFEST.md` — 1000+ line registry
2. `operations/CLI-INSTALLATION-GUIDE.md` — 180 line procedural guide
3. `operations/AI-CONFIG-INDEX.md` — 280 line configuration index
4. `tools/scripts/install-cli.sh` — 200 line automation script
5. `tools/scripts/verify-cli-access.sh` — 150 line verification script
6. `operations/runbooks/codex-cli-access.md` — 240 line troubleshooting guide

### Updated Files
1. `README.md` — Added ⚡ Quick Reference section
2. `CLAUDE.md` — Added "CLI Manifest — Unified Tool Access" section
3. `Memory MEMORY.md` — Added mem-project-007 entry

---

## How to Use

### Scenario 1: Install a New CLI
```bash
# User installs something new
brew install my-tool

# You (or an AI) runs one command
install-cli --name my-tool --path $(which my-tool) --description "What it does"

# Done. All AIs now have access.
# Verify:
verify-cli-access my-tool
```

### Scenario 2: Codex Claims It Can't Access CLI X
```bash
# Check if it's in the manifest
verify-cli-access X

# If not found → install it
install-cli --name X --path $(which X)

# If already there → Codex can access it
# (See operations/runbooks/codex-cli-access.md for debugging)
```

### Scenario 3: You Need to Know What CLIs Are Available
```bash
# Read the manifest
cat operations/CLI-MANIFEST.md

# Or check access to specific CLI
verify-cli-access notebooklm

# Or check all critical CLIs
verify-cli-access
```

---

## Why This Matters

### Before
- ❌ No centralized CLI registry
- ❌ Manual symlink creation required
- ❌ Manual manifest updates required
- ❌ Manual sync to AIs required
- ❌ No verification procedure
- ❌ Codex claimed lack of access (but had it)
- ❌ Each AI had unclear capabilities

### After
- ✅ One centralized registry (CLI-MANIFEST.md)
- ✅ One command (install-cli)
- ✅ Three steps automated (symlink, manifest, sync)
- ✅ Automatic verification
- ✅ All AIs confirmed to have same access
- ✅ Codex confirmed can access notebooklm + all other CLIs
- ✅ Discoverable at repo root (README.md)

---

## Integration Points

### When AIs Start
1. Read `brain/README.md` (includes ⚡ Quick Reference)
2. See CLI management section
3. Understand: `install-cli` and `verify-cli-access` are the commands

### When Users Install a CLI
1. One command: `install-cli --name cmd --path /path`
2. Everything else is automatic
3. Commit: `git add -A && git commit`

### When Codex Can't Find Something
1. Check: `verify-cli-access cmd`
2. If not in manifest: `install-cli --name cmd --path $(which cmd)`
3. See: `operations/runbooks/codex-cli-access.md` for detailed troubleshooting

### When Debugging AI Access Issues
1. Consult: `operations/AI-CONFIG-INDEX.md` (central directory)
2. Check: `operations/CLI-MANIFEST.md` (registry)
3. Reference: `operations/CLI-INSTALLATION-GUIDE.md` (procedures)

---

## Key Principles Established

1. **Single Source of Truth:** CLI-MANIFEST.md is the canonical registry
2. **Unified Access Model:** All AIs access same CLIs via system `$PATH`
3. **No Manual Steps:** `install-cli` handles all three steps automatically
4. **Discoverable:** README.md Quick Reference is entry point
5. **Verifiable:** `verify-cli-access` confirms everything works
6. **No Scattered Knowledge:** All docs point to same files

---

## Technical Architecture

### How It Works
```
User installs CLI
           ↓
User runs: install-cli --name X --path /path/to/X
           ↓
Script: Creates symlink to ~/.local/bin/X
Script: Updates operations/CLI-MANIFEST.md
Script: Runs sync-ai-skills.mjs
Script: Verifies in PATH
           ↓
Manifest updated ✅
All AIs synced ✅
Verified working ✅
```

### Access Model
```
System $PATH includes ~/.local/bin/
           ↓
All CLIs symlink to ~/.local/bin/
           ↓
All three AIs inherit system $PATH:
  - Claude Code: Bash tool → system shell → PATH ✅
  - Codex: Computer Use → system shell → PATH ✅
  - Gemini: context-mode shell → system shell → PATH ✅
           ↓
All AIs can access all CLIs automatically
```

---

## Next Steps (For Future)

1. **When new CLI is needed:** Use `install-cli` command
2. **When troubleshooting access:** Use `verify-cli-access` command
3. **When onboarding new AI:** Point to README.md Quick Reference
4. **When adding automation:** Reference CLI-MANIFEST.md
5. **When scaling to more machines:** All CLIs already documented

---

## Files to Reference

| What | Where |
|------|-------|
| Quick start | README.md ⚡ Quick Reference (top) |
| Full registry | operations/CLI-MANIFEST.md |
| Installation guide | operations/CLI-INSTALLATION-GUIDE.md |
| AI config directory | operations/AI-CONFIG-INDEX.md |
| Codex troubleshooting | operations/runbooks/codex-cli-access.md |
| AI instructions | CLAUDE.md (CLI Manifest section) |
| Installation script | tools/scripts/install-cli.sh |
| Verification script | tools/scripts/verify-cli-access.sh |
| Memory entry | memory/project_cli_manifest_2026_05.md (mem-project-007) |

---

## Status

✅ **Complete** — All infrastructure in place

- [x] CLI-MANIFEST.md created (70+ CLIs)
- [x] install-cli.sh created (automated installation)
- [x] verify-cli-access.sh created (verification)
- [x] CLI-INSTALLATION-GUIDE.md created (procedures)
- [x] AI-CONFIG-INDEX.md created (config directory)
- [x] README.md updated (discovery at repo root)
- [x] CLAUDE.md updated (unified access model)
- [x] codex-cli-access.md created (troubleshooting)
- [x] Both scripts tested and working
- [x] Memory entry created (mem-project-007)
- [x] All commits documented

**Result:** 
When you install a CLI, it's automatically available to all AIs. No remembering steps. No manual updates. Single command. Done.

---

**Created:** 2026-05-25  
**Maintainer:** Steve Westhoek  
**For:** Claude Code, Codex, Gemini CLI
