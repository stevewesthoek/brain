# Workbench MCP Implementation Guide

**For:** Installation and integration across all AI platforms and IDEs  
**Status:** Ready for deployment  
**Brain-Agnostic:** Yes — no assumptions about Claude, Codex, Gemini, or IDE vendor

---

## What This Enables

The Workbench MCP server is now installable across:

✅ **Terminal AI Tools**
- Claude Code CLI
- Codex CLI
- Gemini CLI (via context-mode)

✅ **IDE Extensions**
- VS Code (Claude Code, Codex extensions)
- JetBrains (Codex, Antigravity)
- Cursor
- Kiro

✅ **Web Apps**
- Claude.ai/code
- Codex Web
- Future web AI platforms

**Single admission. Single server. Multiple clients. Zero code duplication.**

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ Brain Repo (Authority)                              │
│                                                     │
│ operations/specs/mcp-provider-admissions.json       │
│   ↑                                                 │
│   (digest-pinned artifacts, exact scope)            │
│   ↓                                                 │
│ operations/system-configs/mcp/workbench/            │
│   ├── README.md                                     │
│   ├── setup-workbench-all-ides.sh                  │
│   ├── *.template.json / *.template.toml            │
│   └── verify-workbench-mcp.sh                      │
│                                                     │
└─────────────────────────────────────────────────────┘
         ↓ generates ↓
         
┌──────────────────────────┬──────────────────────────┐
│ ~/.claude.json           │ ~/.codex/config.toml     │
│ (Claude Code)            │ (Codex)                  │
│                          │                          │
│ + ~/.kiro/settings.json  │ + ~/.cursor/settings.json│
│   (Kiro)                 │   (Cursor)               │
│                          │                          │
│ + Antigravity/User/mcp.json (macOS)                │
│   (Antigravity)          │                          │
└──────────────────────────┴──────────────────────────┘
         ↓ connects to ↓
         
┌─────────────────────────────────────────────────────┐
│ Workbench MCP Server (stdio)                        │
│ packages/mcp/dist/server.js                         │
│                                                     │
│ Enforces:                                           │
│  • Tool scope (3 admitted tools)                    │
│  • Credential validation                           │
│  • Command kind restrictions (n8n_workflow_migration)
└─────────────────────────────────────────────────────┘
```

**Key Principle:** Brain is the admission authority. Workbench is the provider and executor. Clients are interchangeable.

---

## Installation Flow

### Phase 1: Preparation (One-Time)
```bash
# On each machine, create credential file (ignored by git)
mkdir -p ~/.credentials
echo "<your-workbench-mcp-token>" > ~/.credentials/workbench-mcp.token
chmod 600 ~/.credentials/workbench-mcp.token

# Verify it's properly ignored
git check-ignore -v ~/.credentials/workbench-mcp.token
```

### Phase 2: Configuration (Per IDE)
```bash
# Automated (recommended)
cd brain/
bash operations/system-configs/mcp/workbench/setup-workbench-all-ides.sh
# Interactive script handles all IDEs at once

# OR Manual (if needed)
# Copy template from operations/system-configs/mcp/workbench/
# Replace absolute paths with your values
# Merge into IDE config file
# Restart IDE
```

### Phase 3: Verification
```bash
bash brain/operations/system-configs/mcp/workbench/verify-workbench-mcp.sh
```

Verify each IDE:
```bash
claude mcp list | grep workbench
codex mcp list | grep workbench
# Settings → Extensions → MCP Servers (for Kiro, Cursor, Antigravity)
```

---

## Configuration Details

### Environment Variables
All MCP clients pass these to the Workbench server:

| Variable | Purpose | Example |
|----------|---------|---------|
| `WORKBENCH_MCP_CREDENTIAL_FILE` | Credential auth token path | `/Users/joe/.credentials/workbench-mcp.token` |
| `WORKBENCH_MCP_ALLOWED_TOOLS` | Comma-separated tool names | `getWorkbenchStatus,readWorkbenchContext,runWorkbenchCommand` |
| `WORKBENCH_MCP_ALLOWED_COMMAND_KINDS` | Nested suboperations | `n8n_workflow_migration` |

### Transport
- **Type:** stdio (standard input/output)
- **Entrypoint:** `node <path>/packages/mcp/dist/server.js` (no shell)
- **Network:** Loopback-only (no external calls)

### Authentication
- **Mode:** Derived credential file
- **Format:** Text token (workbench-specific)
- **Storage:** Owner-only ignored file outside repositories
- **Policy:** Never in git, never as plaintext in config files

---

## For Each Client

### Claude Code
**Config:** `~/.claude.json`

```json
{
  "mcpServers": {
    "workbench": {
      "type": "stdio",
      "command": "/usr/local/bin/node",
      "args": ["/absolute/path/to/workbench-private/packages/mcp/dist/server.js"],
      "env": {
        "WORKBENCH_MCP_CREDENTIAL_FILE": "/Users/yourname/.credentials/workbench-mcp.token",
        "WORKBENCH_MCP_ALLOWED_TOOLS": "getWorkbenchStatus,readWorkbenchContext,runWorkbenchCommand",
        "WORKBENCH_MCP_ALLOWED_COMMAND_KINDS": "n8n_workflow_migration"
      }
    }
  }
}
```

**Verify:** `claude mcp list`

### Codex
**Config:** `~/.codex/config.toml`

```toml
[mcp_servers.workbench]
command = "/usr/local/bin/node"
args = ["/absolute/path/to/workbench-private/packages/mcp/dist/server.js"]

[mcp_servers.workbench.env]
WORKBENCH_MCP_CREDENTIAL_FILE = "/Users/yourname/.credentials/workbench-mcp.token"
WORKBENCH_MCP_ALLOWED_TOOLS = "getWorkbenchStatus,readWorkbenchContext,runWorkbenchCommand"
WORKBENCH_MCP_ALLOWED_COMMAND_KINDS = "n8n_workflow_migration"
```

**Verify:** `codex mcp list`

### Kiro
**Config:** `~/.kiro/settings.json`  
Use Claude Code format (JSON). Same fields.

**Verify:** Settings → Extensions → MCP Servers

### Cursor
**Config:** `~/.cursor/settings.json`  
Use Claude Code format (JSON). Same fields.

**Verify:** Settings → Extensions → MCP Servers

### Antigravity (macOS)
**Config:** `~/Library/Application Support/Antigravity/User/mcp.json`

Use Claude Code format (JSON) OR HTTP relay format. Same fields.

**Verify:** Main menu → Preferences → MCP Servers

### Gemini CLI
No manual config needed. Integrated via context-mode.

---

## Security Model

### Credentials
✓ **Never committed** — stored in ignored files  
✓ **Per-machine** — each user/system has separate token  
✓ **Passed by reference** — environment variable, not value  
✓ **Validated by provider** — Workbench authenticates

### Scope
✓ **Exactly admitted** — only 3 tools allowed  
✓ **Enforced by server** — invalid tools rejected  
✓ **No expansion** — client cannot add tools  
✓ **Nested operations** — only `n8n_workflow_migration` admitted

### Artifacts
✓ **Digest-pinned** — SHA256 hash validation on admission  
✓ **Source-locked** — exact commit hash recorded  
✓ **Version-tracked** — admission registry updated on provider changes  
✓ **Drift-detected** — hash mismatch fails closed

### Mutations
✓ **Two-phase approval** — runWorkbenchCommand requires explicit confirmation  
✓ **Reconciliation-required** — ambiguous failures need provider readback  
✓ **No blind retries** — failed mutations are never retried automatically  
✓ **Audit trail** — all mutation receipts preserved

---

## Operations & Maintenance

### Adding a New IDE
1. Create template in `workbench/` — follow existing patterns
2. Update `setup-workbench-all-ides.sh` to handle new IDE
3. Update `verify-workbench-mcp.sh` to check new IDE
4. Update README with IDE-specific instructions
5. Test and verify

### Updating Workbench MCP Version
1. Rebuild workbench-private: `pnpm build` → new artifacts generated
2. Compute new SHA256 hashes for artifacts
3. Update `operations/specs/mcp-provider-admissions.json` with new digests and commit hash
4. Run validator: `node tools/validate-mcp-provider-admissions.mjs --provider-root workbench=/path`
5. No client config changes needed — paths and env vars remain the same

### Revoking Access
1. Set admission status to `paused` or `revoked` in admission registry
2. Remove workbench entry from each IDE's config file
3. Delete credential file reference (keep credential file for recovery)
4. Preserve admission entry, source code, and validation output
5. Do NOT delete provider code or historical evidence

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "Command not found" when starting | Node not in PATH | Use absolute path to node executable |
| "File not found" on credential | Path incorrect or file missing | Verify absolute path, check permissions |
| "Permission denied" on credential | Wrong file permissions | `chmod 600 ~/.credentials/workbench-mcp.token` |
| MCP tools not listed | Server failed to start | Check stderr for errors, verify Node version |
| Server lists wrong tools | Scope env vars not passed | Verify all three ALLOWED_* variables set |
| "MCP server not found" in IDE | Config file syntax error | Check JSON/TOML syntax, restart IDE |
| Works in one IDE, not another | Inconsistent config paths | Use templates from this directory |
| Timeout on first call | Server startup slow | Increase startup timeout limit in IDE settings |

Full troubleshooting: See `README.md` in this directory.

---

## Testing & Validation

### Local Testing (Before Deploying)
```bash
# 1. Build the MCP package
pnpm --dir packages/mcp verify

# 2. Test the server directly
node packages/mcp/dist/server.js

# 3. Verify admission in brain
node brain/tools/validate-mcp-provider-admissions.mjs \
  --provider-root workbench=/absolute/path/to/workbench-private

# 4. Generate project registration (if needed)
node brain/tools/generate-mcp-project-registration.mjs \
  --admission workbench-for-brain \
  --provider-root /absolute/path/to/workbench-private \
  --credential-file /absolute/path/to/credential \
  --node /usr/local/bin/node \
  --output /absolute/path/to/output.toml \
  --check
```

### User Acceptance Testing
1. Run setup script for each IDE
2. Restart each IDE
3. Verify MCP server listed: `<ide> mcp list | grep workbench`
4. Call read-only tool: `getWorkbenchStatus` (should succeed)
5. Call context read: `readWorkbenchContext` (should succeed)
6. Attempt invalid tool: should fail with "Unknown or unadmitted"

---

## Deployment Timeline

### Day 1: Preparation
- [ ] Review this guide
- [ ] Review admission standard
- [ ] Create credential file on your machine
- [ ] Test automated setup script

### Day 2: Rollout
- [ ] Run setup for all IDEs on your machine
- [ ] Verify with each IDE
- [ ] Test basic read-only calls
- [ ] Share setup script and README with team

### Day 3+: Support
- [ ] Answer setup questions
- [ ] Collect feedback
- [ ] Fix any IDE-specific issues
- [ ] Document gotchas in README

---

## Key Files & Locations

**Brain Repo:**
- Admission registry: `operations/specs/mcp-provider-admissions.json`
- Setup location: `operations/system-configs/mcp/workbench/`
- Policy standard: `operations/system-configs/mcp/MCP-PROVIDER-ADMISSION-STANDARD.md`
- Centralization runbook: `operations/runbooks/mcp-centralization.md`

**Workbench Repo:**
- MCP server: `packages/mcp/src/mcp-server.ts`
- Entrypoint: `packages/mcp/src/server.ts` → `packages/mcp/dist/server.js`
- Tool contracts: `packages/mcp/src/contracts.ts`
- Scope enforcement: `packages/mcp/src/scope.ts`
- Tests: `packages/mcp/src/tests/`

**Local (User Machine):**
- Credential file: `~/.credentials/workbench-mcp.token` (ignored)
- Claude Code: `~/.claude.json` (merged)
- Codex: `~/.codex/config.toml` (merged)
- Kiro: `~/.kiro/settings.json` (merged)
- Cursor: `~/.cursor/settings.json` (merged)
- Antigravity: `~/Library/Application Support/Antigravity/User/mcp.json` (ignored)

---

## Success Criteria

✅ Setup is complete when:

- [ ] Credential file exists and is ignored by git
- [ ] At least one IDE has workbench MCP configured
- [ ] That IDE reports workbench server in `mcp list`
- [ ] Server lists exactly 3 tools
- [ ] `getWorkbenchStatus` call succeeds (proves auth + connectivity)
- [ ] Invalid tools are rejected
- [ ] No secrets appear in stdout/stderr or config files

---

## Next: Scaling to Team

Once verified on your machine:

1. **Share the setup guide** — Point team to `README.md`
2. **Run setup script once** — Handles all IDEs automatically
3. **Verify with team** — Each person runs `verify-workbench-mcp.sh`
4. **Collect feedback** — Document any IDE-specific issues
5. **Update README** — Add gotchas and solutions
6. **Scale CI/CD** — Optional: automate setup in GitHub Actions

---

**Workbench MCP is now ready for production deployment.**
