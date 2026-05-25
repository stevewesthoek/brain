# AI Configuration Index — Central Directory for All AI Configuration

**Purpose:** Single directory that maps all AI configuration files, CLI access, skills, and operational standards across Claude Code, Codex, and Gemini CLI.

**Status:** Master index for AI infrastructure (created 2026-05-25)

---

## AI Configuration Files

### Claude Code
| File | Purpose | Location |
|------|---------|----------|
| **CLAUDE.md** | Global instructions + startup protocol | `~/.claude/CLAUDE.md` → `brain/operations/system-configs/claude/CLAUDE.md` |
| **settings.json** | Claude Code settings, permissions, hooks | `~/.claude/settings.json` → `brain/operations/system-configs/claude/settings.json` |
| **skills/** | Symlink to active skills | `~/.claude/skills/ → brain/ai/skills/active/` |
| **claude.json** | MCP configuration (secrets — NOT symlinked) | `~/.claude/claude.json` (template: `brain/operations/system-configs/claude/claude.json.template`) |
| **hooks/** | PreToolUse/PostToolUse/UserPromptSubmit hooks | `~/.claude/hooks/` in `brain/operations/system-configs/claude/hooks/` |
| **model-tracking.json** | Real-time model routing state | Auto-generated at `~/.claude/model-tracking.json` |

### Codex
| File | Purpose | Location |
|------|---------|----------|
| **config.toml** | Codex settings, model, plugins, trusted projects | `~/.codex/config.toml` → `brain/operations/system-configs/codex/config.toml` |
| **AGENTS.md** | Codex agent documentation | `~/.codex/AGENTS.md` → `brain/operations/system-configs/codex/AGENTS.md` |
| **RTK.md** | RTK (token reduction) configuration for Codex | `~/.codex/RTK.md` → `brain/operations/system-configs/codex/RTK.md` |
| **auth.json** | Codex authentication (machine state, not symlinked) | `~/.codex/auth.json` |

### Gemini CLI
| File | Purpose | Location |
|------|---------|----------|
| **gstreamer-config.json** | Gemini CLI configuration | `~/.gemini/gstreamer-config.json` → `brain/operations/system-configs/gemini/gstreamer-config.json` |
| **AGENTS.md** | Gemini agent documentation | `~/.gemini/AGENTS.md` → `brain/operations/system-configs/gemini/AGENTS.md` |
| **skills/** | Symlink to active skills | `~/.gemini/skills/ → brain/ai/skills/active/` |

---

## Universal Registries

### 1. CLI Manifest — All Tools in One Place
**File:** `operations/CLI-MANIFEST.md`  
**What:** Exhaustive registry of 70+ CLIs available to all AIs  
**Includes:**
- System tools (git, curl, jq, python3, node, npm, etc.)
- Cloud CLIs (aws-cli, azure-cli, gcp-cli, cloudflare-cli, etc.)
- AI/Media (notebooklm, stable-audio-cli, mlx_whisper)
- Research (firecrawl, spark-cli, apify-multi)
- Custom scripts (mem-search, sync-credentials, ledger-*)
- AI access matrix for Claude Code / Codex / Gemini
- Verification commands for each CLI
- Symlink map and installation reference

**Usage:** When you need to know:
- Is CLI X installed? → Check CLI-MANIFEST.md
- How do I access CLI X from [AI]? → Check AI access matrix
- Where is CLI X located? → Check registry with paths
- How do I verify CLI X is working? → Check verification commands

---

### 2. Skills Registry — Orchestrators & Specialized Tools
**File:** `ai/skills/` with index at `ai/skills/SKILLS-INDEX.md`  
**Structure:**
- `active/` — Symlinks only (what all AIs read)
- `vendors/` — Third-party skills (gstack, cloudflare, etc.)
- `custom/` — First-party skills (memory, apify, spark, firecrawl, etc.)

**Master Skills List (via CLAUDE.md):**
```
/code, /design, /graphify, /memory, /video, /web, /viral-flow,
/notebooklm, /firecrawl, /browse, /playwright, /apify, /cloudflare, /n8n,
/stripe, /ffmpeg, /gh, /dokploy, /supabase, /azure, /hetzner,
/gws, /tailscale, /investigate, /review, /ship, /handoff, /qa, etc.
```

**Access:** All AIs see the same `active/` symlinks, so all AIs have access to all skills.

---

### 3. Model Routing Policy — Cost-Based Escalation
**File:** `ai/policy/routing.md`  
**Defines:**
- Haiku (cheapest) → Sonnet (mid) → Opus (expensive)
- When to escalate (complexity, reasoning depth)
- Codex tiers: low → standard → max
- Gemini tiers: Flash (free) → Pro
- Gemini preprocessing for large contexts (>100k tokens)

**Usage:** Model selection is automatic based on task complexity. Refer to this policy when building orchestrators or making escalation decisions.

---

### 4. Guardrails Policy — Safety & Judgment
**File:** `ai/policy/guardrails.md`  
**Defines:**
- Destructive actions requiring confirmation (rm -rf, DROP TABLE, force-push, etc.)
- Credential handling rules
- Production vs. local-isolated judgment calls
- Decision checklist for risky operations

**Usage:** When in doubt about whether an action is safe, check guardrails.md.

---

## AI Startup Protocol (Common to All)

When any AI starts with `brain` context:

1. **Read:** `AGENTS.md` — agent capabilities and limitations
2. **Read:** `00-start-here.md` — entry point to brain documentation
3. **Read:** `00-current-context.md` — what's happening right now
4. **Read:** `00-memory-map.md` — memory system orientation
5. **Search/Read only relevant files** — Don't load whole repo

This is documented in both `brain/CLAUDE.md` and each AI's config.

---

## Unified AI Access Points

### For Users
- **Claude Code:** Natural language in prompt → auto-routes to right tool
- **Codex:** Natural language + Computer Use for interactive work
- **Gemini CLI:** Natural language + shell access for analysis

### For AI Agents
- **Skills:** Use `/skill-name` directly (all AIs read same `active/` symlinks)
- **CLIs:** Use shell access + $PATH lookup (all AIs inherit system PATH)
- **Memory:** Use `mem-search`, `mem-write`, `mem-facts` (all AIs use same `~/.brain/memory/`)
- **Policies:** Refer to `ai/policy/` (routing.md, guardrails.md — both AIs read)

---

## Configuration Integrity Checks

### Verify All AIs Are Aligned

Run this in each AI to confirm unified configuration:

```bash
# Claude Code (Bash tool)
bash << 'EOF'
echo "=== Claude Code Config ==="
echo "Skills path: $(ls -la ~/.claude/skills | grep ' skills ->')"
echo "CLAUDE.md location: ~/.claude/CLAUDE.md"
echo "Settings.json loaded: $([ -f ~/.claude/settings.json ] && echo '✅' || echo '❌')"
echo "CLI manifest exists: $([ -f ~/Repos/stevewesthoek/brain/operations/CLI-MANIFEST.md ] && echo '✅' || echo '❌')"
echo ""
echo "Verify CLI access:"
for cmd in notebooklm spark-cli aws-cli; do
  echo -n "$cmd: "
  which $cmd || echo "NOT FOUND"
done
EOF
```

```bash
# Codex (Computer Use)
echo "=== Codex Config ==="
echo "Config loaded: $([ -f ~/.codex/config.toml ] && echo '✅' || echo '❌')"
echo "Skills path: $(ls -la ~/.codex/skills 2>/dev/null | head -1)"
echo ""
echo "Verify CLI access:"
for cmd in notebooklm spark-cli aws-cli; do
  echo -n "$cmd: "
  which $cmd || echo "NOT FOUND"
done
```

```bash
# Gemini CLI
echo "=== Gemini Config ==="
echo "Config loaded: $([ -f ~/.gemini/gstreamer-config.json ] && echo '✅' || echo '❌')"
echo "Skills path: $(ls -la ~/.gemini/skills 2>/dev/null | head -1)"
echo ""
echo "Verify CLI access:"
for cmd in notebooklm spark-cli aws-cli; do
  echo -n "$cmd: "
  which $cmd || echo "NOT FOUND"
done
```

**Expected:** All three should show:
- ✅ Config files exist
- ✅ Skills symlinked to `brain/ai/skills/active/`
- ✅ All CLIs accessible via PATH

---

## Troubleshooting

### "AI says it doesn't have access to CLI X"

1. **Check if CLI exists:**
   ```bash
   which X  # Should show path
   ```

2. **Check if CLI is in manifest:**
   - Open `operations/CLI-MANIFEST.md`
   - Search for the CLI name
   - If not found → add it to manifest

3. **Check if CLI is in PATH for that AI:**
   - Claude Code: `bash echo $PATH | grep local`
   - Codex: Computer Use → `echo $PATH | grep local`
   - Gemini: Shell access → `echo $PATH | grep local`

4. **If CLI is installed but not found:**
   - Verify symlink exists: `ls -la ~/.local/bin/X`
   - Verify target exists: `ls -la $(readlink ~/.local/bin/X)`
   - Recreate symlink if needed: `ln -sf /real/path ~/.local/bin/X`

5. **If still broken:**
   - Update CLI-MANIFEST.md with what you found
   - Create issue in `brain/operations/decision-log.md`
   - Reference `mem-project-007` (CLI manifest creation)

### "Codex can't access notebooklm"

This is the specific bug that prompted the unified system. See:
- `operations/runbooks/codex-cli-access.md` — Codex troubleshooting
- `operations/CLI-MANIFEST.md` — notebooklm listed and verified

**Quick fix:**
```bash
# In Codex Computer Use
which notebooklm
notebooklm --version
# Should work. If not, see codex-cli-access.md troubleshooting.
```

---

## Maintenance & Updates

### When You Install a New CLI
1. Install to `~/.local/bin/` (symlink or direct)
2. Add entry to `operations/CLI-MANIFEST.md`
3. Verify in all three AIs
4. If using brain wrapper, run: `node tools/scripts/sync-ai-skills.mjs --check`
5. Update this index if it affects any of the listed files

### When You Add/Update a Skill
1. Place source in `ai/skills/custom/` or `ai/skills/vendors/`
2. Create symlink in `ai/skills/active/`
3. Run: `node tools/scripts/sync-ai-skills.mjs --dry-run && sync-ai-skills.mjs && sync-ai-skills.mjs --check`
4. Verify skill is accessible in all three AIs

### When You Update a Policy
1. Update `ai/policy/routing.md` or `ai/policy/guardrails.md`
2. Note in `operations/decision-log.md` (with date)
3. Notify all AIs via memory if major change

---

## Related Files (Quick Reference)

| Category | Files |
|----------|-------|
| **Configuration** | `operations/system-configs/{claude,codex,gemini}/` |
| **CLI Registry** | `operations/CLI-MANIFEST.md` |
| **Skills** | `ai/skills/` (active/, vendors/, custom/) |
| **Policies** | `ai/policy/{routing.md, guardrails.md}` |
| **Runbooks** | `operations/runbooks/` (notebooklm.md, codex-cli-access.md, etc.) |
| **Decision Log** | `operations/decision-log.md` (all major decisions) |
| **Memory** | `~/.brain/memory/` (shared across all AIs) |
| **Instructions** | `CLAUDE.md`, `00-start-here.md`, `00-current-context.md` |

---

**Last Updated:** 2026-05-25  
**Created by:** Claude Code + Haiku 4.5  
**Purpose:** Unified reference for all AI infrastructure configuration  
**Status:** Active and maintained
