# Master MCP Setup — Central Registry for All IDEs

**Purpose:** Single source of truth for MCP server configuration across all IDEs and LLMs.

**Status:** Google Stitch MCP fully centralized and documented.

---

## Quick Access

| MCP Server | Status | Setup Location |
|-----------|--------|-----------------|
| **Google Stitch** | ✅ Active | `stitch/` — Centralized setup for all IDEs |

---

## Installation Pattern (For All MCP Servers)

### 1. Create Centralized Folder
```bash
mkdir -p operations/system-configs/mcp/<server-name>
cd operations/system-configs/mcp/<server-name>
```

### 2. Create Required Files
Each server folder must contain:

```
<server-name>/
├── README.md                      # Full setup instructions + troubleshooting
├── codex-config.template.toml     # Codex MCP block (if applicable)
├── claude-code-config.template.json  # Claude Code MCP block (if applicable)
├── kiro-config.template.json      # Kiro MCP block (if applicable)
├── cursor-config.template.json    # Cursor MCP block (if applicable)
└── setup-<server>-all-ides.sh     # Automated setup script (optional)
```

### 3. Register in Codex Central Config
```bash
# Add to ~/.codex/config.toml (symlinked from operations/system-configs/codex/config.toml)
[mcp_servers.<server>]
command = "..."
args = [...]

[mcp_servers.<server>.env]
KEY = "VALUE"
```

### 4. Update MCP Centralization Runbook
```bash
# Update operations/runbooks/mcp-centralization.md with server-specific steps
```

### 5. Document in This File
Add entry to the registry above with setup location.

---

## Google Stitch MCP — Complete Setup

**Location:** `stitch/`

### Quick Start
```bash
# Run automated setup for all IDEs
bash operations/system-configs/mcp/stitch/setup-stitch-all-ides.sh

# Verify all IDEs
claude mcp list
codex mcp list
npx -y @_davideast/stitch-mcp doctor
```

### Manual Setup by IDE

#### Claude Code
1. Read: `stitch/claude-code-config.template.json`
2. Merge into `~/.claude.json` under `mcpServers.stitch`
3. Restart Claude Code
4. Verify: `claude mcp list | grep stitch`

#### Codex
1. Already configured in `~/.codex/config.toml`
2. Verify: `codex mcp list | grep stitch`

#### Kiro
1. Read: `stitch/kiro-config.template.json`
2. Merge into `~/.kiro/settings.json` under `mcpServers.stitch`
3. Restart Kiro
4. Verify: Settings → Extensions → MCP Servers

#### Cursor
1. Read: `stitch/cursor-config.template.json`
2. Merge into `~/.cursor/settings.json` under `mcpServers.stitch`
3. Restart Cursor
4. Verify: Settings → Extensions → MCP Servers

#### Antigravity
1. Read: `stitch/mcp-http-config.template.json`
2. Create symlink: `~/Library/Application Support/Antigravity/User/mcp.json` → `operations/system-configs/antigravity/User/mcp.json`
3. Populate runtime file with tokens
4. Restart Antigravity

#### Gemini CLI
1. Automatic via context-mode
2. No config needed

### Full Documentation
**→ See: `stitch/README.md`**

---

## MCP Centralization Standard

**See:** `README.md` (in this directory)

Key principles:
- All MCP servers documented in their own folder
- Templates for all client types (Codex TOML, Claude Code JSON, IDE JSON, HTTP)
- Runtime secrets stored only in ignored files, never in templates
- Symlinks used where clients expect local files
- Single canonical source for all setup steps

---

## IDE Configuration Locations

| IDE | Config File | Format | Symlink Support |
|-----|------------|--------|---|
| Claude Code | `~/.claude.json` | JSON | No (manual merge) |
| Codex | `~/.codex/config.toml` | TOML | Yes (symlink from brain) |
| Kiro | `~/.kiro/settings.json` | JSON | No (manual merge) |
| Cursor | `~/.cursor/settings.json` | JSON | No (manual merge) |
| Antigravity | `~/Library/Application Support/Antigravity/User/mcp.json` | JSON | Yes (central ignored file) |
| Gemini CLI | Via context-mode | N/A | N/A |

---

## Adding a New MCP Server

Follow this checklist:

- [ ] Read official docs: understand auth method, proxy vs. direct, client support
- [ ] Create folder: `operations/system-configs/mcp/<server-name>/`
- [ ] Write README: Full setup + troubleshooting for all IDEs
- [ ] Create templates:
  - [ ] `codex-config.template.toml` (if Codex supports)
  - [ ] `claude-code-config.template.json` (if Claude Code supports)
  - [ ] `kiro-config.template.json` (if Kiro supports)
  - [ ] `cursor-config.template.json` (if Cursor supports)
  - [ ] `mcp-http-config.template.json` (if direct HTTP is option)
- [ ] Add to central Codex config: `operations/system-configs/codex/config.toml`
- [ ] Create setup script: `setup-<server>-all-ides.sh` (optional)
- [ ] Update MCP centralization runbook: `operations/runbooks/mcp-centralization.md`
- [ ] Update this file: Add entry to registry above
- [ ] Verify: Test each IDE, document gotchas in README
- [ ] Git commit: All files except runtime ignored files

---

## Testing & Verification

### Generic MCP Verification
```bash
# Claude Code
claude mcp list

# Codex
codex mcp list

# Kiro/Cursor/Antigravity
# Check: Settings → Extensions → MCP Servers (or equivalent)

# Gemini
# (Automatic, via context-mode)
```

### Stitch-Specific Verification
```bash
# Health check
npx -y @_davideast/stitch-mcp doctor

# List all available resources
npx -y @_davideast/stitch-mcp list-resources

# Test a tool
claude "Use Google Stitch to list datasets"  # In Claude Code
```

### Troubleshooting Matrix

| Symptom | Cause | Fix |
|---------|-------|-----|
| "MCP server not found" | Config not merged | Check config file syntax, restart IDE |
| "Authorization failed" | gcloud ADC not initialized | Run `npx -y @_davideast/stitch-mcp init` |
| "Proxy requires API key" | `STITCH_API_KEY` not set | Add `STITCH_API_KEY = "gcloud-adc"` to env |
| Dotenv startup banners break JSON-RPC | Noise on stdout | Set `DOTENV_CONFIG_QUIET = "true"` |
| Server appears in one IDE, not others | Inconsistent config | Use templates from this directory |
| Works in proxy mode, not HTTP | Token expired | Refresh with `gcloud auth print-access-token` |

---

## Key Security Rules

1. **Never commit API keys, tokens, or cookies** — Not in templates, not in tracked files
2. **Use proxy mode when possible** — Avoids storing tokens in config
3. **Store secrets only in ignored runtime files** — `~/.stitch-mcp/`, `~/.codex/.env`, centralized ignored files
4. **Use OAuth/ADC when available** — Prefer to static keys
5. **Validate all config before committing** — `git check-ignore` to verify paths are ignored

---

## Related Documentation

- **Centralization Runbook:** `operations/runbooks/mcp-centralization.md`
- **Codex Config:** `operations/system-configs/codex/config.toml`
- **Claude Code Template:** `operations/system-configs/claude/claude.json.template`
- **Antigravity Template:** `operations/system-configs/antigravity/mcp.template.json`

---

## Maintenance & Updates

**Last Updated:** 2026-06-17  
**Stitch MCP Version:** Latest (via `npx -y @_davideast/stitch-mcp`)  
**Next Review:** When any MCP server is added or updated

### When Updating an MCP Server

1. Check official GitHub repo for breaking changes
2. Update command/args in ALL template files
3. Re-test in each IDE
4. Update README if steps changed
5. Run setup script to distribute changes
6. Verify with `claude mcp list`, `codex mcp list`, etc.

---

## Support & Escalation

- **Setup issues:** See specific server README (e.g., `stitch/README.md`)
- **Centralization policy questions:** See `operations/runbooks/mcp-centralization.md`
- **IDE-specific issues:** Check IDE docs or `.ai/decision-log.md` for past issues
- **New MCP server:** Follow "Adding a New MCP Server" checklist above
