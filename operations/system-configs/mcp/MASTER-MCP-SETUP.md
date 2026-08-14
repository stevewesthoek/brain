# Master MCP Setup — Central Registry for All IDEs

**Purpose:** Brain-owned admission and configuration index for MCP providers consumed by local AI clients.

**Status:** Provider admission standard active; client files are derived configuration, not authority.

---

## Quick Access

| MCP Server | Status | Setup Location |
|-----------|--------|-----------------|
| **Google Stitch** | ✅ Active | `stitch/` — Centralized setup for all IDEs |
| **Workbench** | ✅ Active, Brain-scoped | `workbench/` — Centralized setup for all IDEs + admission registry |
| **B1.0a Guarded Save-to-Mind** | Disabled compatibility source | `b1-0a-guarded-save-to-mind/` — retained for evidence, not an active mutation path |
| **Open Design** | 📋 TBD | TBD — needs architecture decision |

---

## Admission Pattern (For All MCP Providers)

Read `MCP-PROVIDER-ADMISSION-STANDARD.md` first. Provider-owned code is not
copied into Brain. Brain admits a provider by identity, digest, exact scope,
authentication reference, limits, evidence, and revocation. Then a client
registration is generated from that admission.

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

### 3. Register the provider admission

Add the provider to `operations/specs/mcp-provider-admissions.json`, validate
the installation-local provider root, and generate the project registration.

Project-specific consumers belong in `<consumer>/.codex/config.toml`, not the
global Codex config. Global registration requires a separate explicit admission.

### 4. Register a truly global provider in Codex only when admitted
```bash
# Add the durable setting to operations/system-configs/codex/config.toml, then
# regenerate the physical ~/.codex/config.toml with codex-home-managed-root.sh
[mcp_servers.<server>]
command = "..."
args = [...]

[mcp_servers.<server>.env]
KEY = "VALUE"
```

### 5. Update MCP Centralization Runbook
```bash
# Update operations/runbooks/mcp-centralization.md with server-specific steps
```

### 6. Document in This File
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

## Workbench MCP — Complete Setup

**Location:** `workbench/`  
**Admission:** `operations/specs/mcp-provider-admissions.json` (B1.0a)

### Quick Start
```bash
# Run automated setup for all IDEs
bash operations/system-configs/mcp/workbench/setup-workbench-all-ides.sh

# Verify setup
bash operations/system-configs/mcp/workbench/verify-workbench-mcp.sh

# Check MCP registration
claude mcp list | grep workbench
codex mcp list | grep workbench
```

### Prerequisite: Create Credential File
```bash
# 1. Obtain Workbench MCP credential token from your admin
# 2. Create credential file (ignored by git)
mkdir -p ~/.credentials
echo "<your-workbench-mcp-token>" > ~/.credentials/workbench-mcp.token
chmod 600 ~/.credentials/workbench-mcp.token
```

### Manual Setup by IDE (if not using automated script)

#### Claude Code
1. Read: `workbench/claude-code-config.template.json`
2. Replace placeholders with absolute paths
3. Merge into `~/.claude.json` under `mcpServers.workbench`
4. Restart Claude Code
5. Verify: `claude mcp list | grep workbench`

#### Codex
1. Read: `workbench/codex-config.template.toml`
2. Replace placeholders with absolute paths
3. Merge into `~/.codex/config.toml` under `[mcp_servers.workbench]`
4. Restart Codex
5. Verify: `codex mcp list | grep workbench`

#### Kiro, Cursor, Antigravity
1. Same pattern as stitch (see stitch section above)
2. Use templates from `workbench/` instead of `stitch/`
3. Restart IDE

### Full Documentation
**→ See: `workbench/README.md`**

### Admitted Tools (B1.0a)

Only these three tools are admitted for Brain consumption:
- `getWorkbenchStatus` (read-only)
- `readWorkbenchContext` (read-only)
- `runWorkbenchCommand` (external mutation, n8n_workflow_migration only, two-phase approval required)

All other Workbench commands and file mutations are **not admitted** and will be rejected by the MCP server.

---

## MCP Centralization Standard

**See:** `README.md` (in this directory)

Key principles:
- Brain owns admission, scope, drift response, and revocation
- Providers own their server and domain policy
- Project registrations are generated from the admission registry
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
| Codex | `~/.codex/config.toml` | TOML | Generated physical copy; not a symlink |
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
- [ ] Add an admission to `operations/specs/mcp-provider-admissions.json`
- [ ] Validate exact provider artifacts and scope
- [ ] Generate a project registration; use the global Codex config only for separately admitted global providers
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

1. **Never commit API keys, tokens, or cookies** — Not in admissions, templates, or tracked files
2. **Do not trust localhost** — Every downstream local HTTP boundary still authenticates
3. **Use exact tool and nested-operation scopes** — Descriptions and annotations are not authorization
4. **Store secrets only in owner-only ignored runtime files** — Pass only references into stdio
5. **Use OAuth with audience binding for remote HTTP** — Token passthrough is forbidden
6. **Pin and verify provider artifacts** — Drift pauses admission
7. **Never blindly retry ambiguous mutations** — Reconcile through provider receipts/readback

---

## Related Documentation

- **Centralization Runbook:** `operations/runbooks/mcp-centralization.md`
- **Codex Config:** `operations/system-configs/codex/config.toml`
- **Claude Code Template:** `operations/system-configs/claude/claude.json.template`
- **Antigravity Template:** `operations/system-configs/antigravity/mcp.template.json`

---

## Maintenance & Updates

**Last Updated:** 2026-07-15
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
