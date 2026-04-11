---
name: brain-universal-capability-install
description: "When installing any new capability (skill, CLI, or MCP server), ensure it's installed AI-agnostic but engine-specific: update all three engine configs (CLAUDE.md, AGENTS.md, GEMINI.md) simultaneously so Claude, Codex, and Gemini can all use it, each in their own way."
---

# Brain: Universal Capability Installation Checklist

## The insight

Claude Code, Codex, and Gemini operate as one unified system. Any capability installed for one should be available to all three — but each engine uses it differently, and each has its own config file where it's documented.

The mistake: Installing features for only one engine, or installing globally but forgetting to document in all three configs. Result: one engine gets the feature, the others don't know about it or can't access it.

**The unified principle:** Install once, configure three times. Any new skill, CLI, or MCP server gets:
1. **One global install** (if applicable — e.g., `pipx install notebooklm-py` runs once)
2. **Three config entries** (CLAUDE.md, AGENTS.md, GEMINI.md) — each documenting how that specific engine uses it
3. **One shared skill/documentation** (AI-agnostic, describing the capability generically)

## When this applies

**Whenever you are installing:**
- A new **skill** → `brain/ai/skills/custom/{skill-name}/`
- A new **CLI** → `pipx install`, `npm install -g`, `brew install`, etc.
- A new **MCP server** → adds a `[mcp_servers.{name}]` entry to a config
- Adding a **capability reference** to the system

**Red flags:**
- You updated CLAUDE.md but forgot AGENTS.md and GEMINI.md
- A skill only mentions "Claude" or "when using Codex"
- A CLI is installed but documented in only one engine's config
- An MCP server entry exists in `claude.json` but not in `codex config.toml`
- A new tool exists but not mentioned in all three engine instructions

## The approach

### Step 1 — Decide: Is this for all three engines, or just one?

- **For all three?** (99% of the time) → follow this checklist
- **Engine-specific?** (rare) → clearly mark it as such and put it in a separate folder or section

### Step 2 — Install globally (if needed)

```bash
# CLI: install once, globally accessible to all three
pipx install tool-name
npm install -g tool-name
brew install tool-name

# MCP server: install once, but configure in each engine's config
pipx install mcp-server-name
npm install -g mcp-server-package

# Skill: add to brain/ai/skills/custom/ (already global)
```

### Step 3 — Write AI-agnostic documentation

Create a shared skill or doc that describes the capability generically:

```markdown
---
name: {tool-name}
description: "What this does, when to use it. Works with Claude, Codex, and Gemini."
---

# {Tool Name}

## What it is
[Generic description — no engine-specific language]

## When to use
[Scenarios where any engine would use this]

## How to use
[Generic usage — not "in Claude, do X; in Codex, do Y"]
```

### Step 4 — Update all three engine configs

For each of the three files, add engine-specific documentation:

#### `CLAUDE.md` (Claude Code instructions)
Add to the integrations section:
```markdown
- {Tool Name}: [yes/no] — use `/skill-name` for [what it does]; configured in settings.json
  or reference the shared skill: `brain/ai/skills/custom/{skill-name}/SKILL.md`
```

#### `operations/system-configs/codex/AGENTS.md` (Codex instructions)
Add to the integrations section:
```markdown
- {Tool Name}: [yes/no] — use `/skill-name` for [what it does]; configured in config.toml
  [mcp_servers.{name}]
```

#### `operations/system-configs/gemini/GEMINI.md` (Gemini instructions)
Add to the integrations section:
```markdown
- {Tool Name}: [yes/no] — use `/skill-name` for [what it does]; reference the shared skill
  at `brain/ai/skills/custom/{skill-name}/SKILL.md`
```

### Step 5 — For MCP servers: Configure in each engine's config

**Claude (`~/.claude/settings.json`):**
```json
{
  "mcp_servers": {
    "tool-name": {
      "command": "/path/to/binary"
    }
  }
}
```

**Codex (`operations/system-configs/codex/config.toml`):**
```toml
[mcp_servers.tool-name]
command = "/path/to/binary"
```

**Gemini (`operations/system-configs/gemini/...`):**
If Gemini uses MCP, add the same pattern. If not, document in GEMINI.md that it's not supported.

### Step 6 — For CLIs: Document in all three engine configs

Even though the CLI is installed once, **all three engines need to know about it**:

- **CLAUDE.md**: "Use `/skill` or call directly via bash"
- **AGENTS.md**: "Use `/skill` or call directly via bash; available to Codex"
- **GEMINI.md**: "Reference the shared skill; CLI available if needed"

### Step 7 — Verify the installation is AI-agnostic

Checklist:

```bash
# 1. Check the shared skill/doc is engine-agnostic
grep -i "claude\|codex\|gemini" brain/ai/skills/custom/{skill-name}/SKILL.md \
  | grep -v "shared\|agnostic\|unified"
# Should return: nothing

# 2. Verify all three configs mention this capability
grep -i "{tool-name}" CLAUDE.md AGENTS.md GEMINI.md
# Should return: 3 matches (one per file)

# 3. For MCP servers: verify config entries exist
grep "{tool-name}" ~/.claude/settings.json operations/system-configs/codex/config.toml
# Should return: 2 matches minimum

# 4. For CLIs: verify binary is accessible
which {tool-name}
# Should return: /path/to/binary (one shared location)
```

### Step 8 — Commit together

All changes — skill, config updates, MCP entries, CLI documentation — **in one commit**:

```bash
git add brain/ai/skills/custom/{skill-name}/SKILL.md \
        CLAUDE.md \
        operations/system-configs/codex/AGENTS.md \
        operations/system-configs/gemini/GEMINI.md \
        ~/.claude/settings.json \
        operations/system-configs/codex/config.toml

git commit -m "Install {tool-name} capability for Claude, Codex, and Gemini

- Added shared skill at brain/ai/skills/custom/{skill-name}/
- Updated CLAUDE.md with Claude-specific usage
- Updated AGENTS.md with Codex-specific usage
- Updated GEMINI.md with Gemini-specific usage
- Configured MCP in Claude settings.json and Codex config.toml
- Documented in all three engine instructions

All three engines can now use {tool-name} immediately."
```

## The fix: Three-part installation ritual

**Every time you install ANY capability:**

### Part 1: Global install (CLI/MCP)
```bash
pipx install / npm install -g / brew install
```

### Part 2: Create/update shared skill
```bash
mkdir -p brain/ai/skills/custom/{name}/
# Create SKILL.md with AI-agnostic description
```

### Part 3: Update all three engine configs
- Edit `CLAUDE.md` → add integrations section entry
- Edit `operations/system-configs/codex/AGENTS.md` → add integrations section entry
- Edit `operations/system-configs/gemini/GEMINI.md` → add integrations section entry
- Edit `~/.claude/settings.json` → add MCP entry (if needed)
- Edit `operations/system-configs/codex/config.toml` → add MCP entry (if needed)

**Do not commit until all three configs are updated.**

## Examples of this pattern (from your system)

### NotebookLM (done wrong, then fixed)
- ❌ MCP server installed but only in Codex config, not Claude
- ❌ Skill mentioned "switching from MCP" → not AI-agnostic
- ✅ Fixed: Removed MCP, documented CLI in all three engine configs

### Firecrawl (done right)
- ✅ Self-hosted instance (global, shared)
- ✅ Skill at `brain/ai/skills/custom/firecrawl/SKILL.md` (AI-agnostic)
- ✅ Documented in all three engine instructions
- ✅ All three engines can use it immediately

### Playwright (in progress)
- ✅ CLI installed globally (`playwright`)
- ✅ Documented in runbooks
- ⚠️ Need to verify: mentioned in all three engine configs?

## Gotchas

1. **Forgetting one config file**
   - If you only update CLAUDE.md, Codex and Gemini won't know to use it the same way
   - Check all three: CLAUDE.md, AGENTS.md, GEMINI.md

2. **Engine-specific language in shared skills**
   - "Use this in Claude" → breaks for Codex/Gemini
   - "Available in Codex only" → defeats the purpose
   - Fix: "Any engine can use this"

3. **MCP server in one config but not others**
   - Claude config has it, Codex doesn't → asymmetric capability
   - Solution: Add to all three config files (or explicitly document why it's engine-specific)

4. **CLI installed but not documented in engine configs**
   - Tool exists globally but engines don't know about it
   - Solution: Add a one-liner to each CLAUDE.md, AGENTS.md, GEMINI.md

5. **Confusing "shared skill" with "engine-specific usage"**
   - The skill description should be shared/generic
   - But each engine config can document how that engine specifically uses it
   - Example: `/handoff` is shared, but Claude has an automatic Stop hook, Codex doesn't

## Context

Repo: brain  
Discovered: 2026-04-11  
Area: Universal capability installation (skills, CLIs, MCP servers)  
Related files:
- Shared skills: `brain/ai/skills/custom/`
- Claude config: `CLAUDE.md`, `~/.claude/settings.json`
- Codex config: `operations/system-configs/codex/AGENTS.md`, `operations/system-configs/codex/config.toml`
- Gemini config: `operations/system-configs/gemini/GEMINI.md`
