# Google Stitch MCP — Quick Reference Card

**Last Updated:** 2026-06-17  
**Status:** ✅ All critical systems operational

---

## Active Now ✅

```bash
# Claude Code
claude mcp list | grep stitch

# Codex
codex mcp list | grep stitch

# Gemini CLI
# (Automatic via context-mode)
```

---

## Manual Setup (Kiro & Cursor)

### Kiro
1. Settings → Extensions → MCP Servers → Add
2. Name: `stitch`
3. Type: `stdio`
4. Command: `npx`
5. Args: `["-y", "@_davideast/stitch-mcp", "proxy", "--transport", "stdio"]`
6. Env: `DOTENV_CONFIG_QUIET=true` | `STITCH_API_KEY=gcloud-adc`

### Cursor
Same as Kiro above.

---

## Centralized Locations

```
All Stitch MCP docs & templates:
└─ operations/system-configs/mcp/stitch/

All MCP servers registry:
└─ operations/system-configs/mcp/MASTER-MCP-SETUP.md

Antigravity centralized config:
└─ operations/system-configs/antigravity/User/mcp.json  (git-ignored)
   ↙ Symlinked from: ~/Library/Application Support/Antigravity/User/mcp.json
```

---

## Verify Setup

```bash
bash operations/system-configs/mcp/stitch/verify-stitch-all-ides.sh
```

Expected: ✅ All critical checks passed (12 passed, 0 failed)

---

## Full Documentation

| Document | Purpose |
|----------|---------|
| `stitch/README.md` | Complete setup guide (step-by-step) |
| `MASTER-MCP-SETUP.md` | Registry + adding new MCP servers |
| `STITCH-CENTRALIZED-SETUP.md` | Full summary + troubleshooting |
| `QUICK-REFERENCE.md` | This card |

---

## Key Values (Memorize These)

| Setting | Value | Type |
|---------|-------|------|
| `command` | `npx` | Proxy mode |
| `args[0]` | `-y` | Skip npm prompts |
| `args[1]` | `@_davideast/stitch-mcp` | Package name |
| `args[2]` | `proxy` | Use proxy mode |
| `args[3]` | `--transport` | Transport flag |
| `args[4]` | `stdio` | Use stdio |
| `STITCH_API_KEY` | `gcloud-adc` | **NOT a secret** |
| `DOTENV_CONFIG_QUIET` | `true` | Suppress startup noise |

---

## Troubleshooting (3-Step Process)

### Step 1: Check gcloud
```bash
npx -y @_davideast/stitch-mcp doctor
```

### Step 2: Check IDE config
```bash
# Claude Code
jq '.mcpServers.stitch' ~/.claude.json

# Codex
grep -A 6 '\[mcp_servers.stitch\]' ~/.codex/config.toml

# Antigravity
cat ~/Library/Application\ Support/Antigravity/User/mcp.json
```

### Step 3: Restart IDE
Hard quit + reopen (Cmd+Q, then relaunch)

---

## One-Time Setup (If Needed)

```bash
# Initialize gcloud ADC
npx -y @_davideast/stitch-mcp init

# Verify
npx -y @_davideast/stitch-mcp doctor
```

---

## When Something Breaks

| Symptom | Command | Fix |
|---------|---------|-----|
| Not in IDE | Check template | Copy from `stitch/<ide>-config.*` |
| Authorization error | `gcloud auth print-access-token` | Refresh auth |
| "Requires API key" | `STITCH_API_KEY` env var | Must be `gcloud-adc` |
| Dotenv noise in output | `DOTENV_CONFIG_QUIET` | Set to `true` |
| Symlink broken | `ls -la` | Recreate with `ln -sfn` |

---

## File Locations (Memorize These Paths)

```
Stitch templates:      ~/Repos/stevewesthoek/brain/operations/system-configs/mcp/stitch/
Master MCP registry:   ~/Repos/stevewesthoek/brain/operations/system-configs/mcp/MASTER-MCP-SETUP.md
Claude Code config:    ~/.claude.json
Codex config:          ~/.codex/config.toml  (physical generated copy from brain)
Antigravity config:    ~/Library/Application Support/Antigravity/User/mcp.json  (symlink)
gcloud ADC:            ~/.stitch-mcp/  (managed by stitch init)
Verification script:   ~/Repos/stevewesthoek/brain/operations/system-configs/mcp/stitch/verify-stitch-all-ides.sh
```

---

## For IDE Setups

### Copy These Commands to Setup Each IDE

**Kiro:**
```
Type: stdio
Command: npx
Args: ["-y", "@_davideast/stitch-mcp", "proxy", "--transport", "stdio"]
Env: DOTENV_CONFIG_QUIET=true, STITCH_API_KEY=gcloud-adc
```

**Cursor:**
```
Type: stdio
Command: npx
Args: ["-y", "@_davideast/stitch-mcp", "proxy", "--transport", "stdio"]
Env: DOTENV_CONFIG_QUIET=true, STITCH_API_KEY=gcloud-adc
```

---

## Testing

After setup:
```bash
# In any IDE
"Use Stitch to list datasets"

# Or
"Show me available Stitch resources"

# Should return resources from Google Cloud Stitch
```

---

## Maintenance

### When Updating Stitch
```bash
npm update @_davideast/stitch-mcp
npx -y @_davideast/stitch-mcp doctor
```

### When Adding New MCP Servers
See: `MASTER-MCP-SETUP.md` → "Adding a New MCP Server" checklist

---

## Key Concept

**`STITCH_API_KEY = "gcloud-adc"` is NOT a secret.** It's a sentinel value that tells the Stitch proxy to use your existing gcloud authentication. Your real credentials come from:
- `~/.config/gcloud/` (system gcloud)
- `~/.stitch-mcp/` (bundled gcloud, managed by init)

---

## Status Dashboard

| Component | Status | Last Check |
|-----------|--------|---|
| Claude Code | ✅ Active | 2026-06-17 |
| Codex | ✅ Active | 2026-06-17 |
| Kiro | ✅ Automated | 2026-06-18 |
| Cursor | ✅ Automated | 2026-06-18 |
| Antigravity | ✅ Active | 2026-06-17 |
| Gemini CLI | ✅ Active | Automatic |

---

**Need more detail?** → Read `stitch/README.md`  
**Ready to use?** → Restart IDEs + test Stitch tools  
**Questions?** → Check `STITCH-CENTRALIZED-SETUP.md`
