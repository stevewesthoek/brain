# MCP Centralization Runbook

Centralized process for installing any new MCP server in Brain.

## Scope
Use this runbook whenever adding or updating MCP servers (Codex, Antigravity, etc.).

## Standard workflow
1. Read official MCP server docs and identify auth method.
2. Add server entry to `operations/system-configs/codex/config.toml`.
3. Create/update `operations/system-configs/mcp/<server>/`:
   - `README.md`
   - `codex-config.template.toml`
   - client templates as needed
4. Keep secrets out of templates and committed files.
5. Put runtime token config in ignored central files (for example Antigravity `mcp.json`).
6. For Antigravity, maintain JSON under top-level `servers` (not `mcpServers`).
7. Use symlinks from client-expected paths to Brain central files.
8. Verify server availability and one real API call.

## Command templates

### Add server to central Codex config
```bash
codex mcp add <server-name> -- <command> <arg1> <arg2>
codex mcp list
```

This writes to `~/.codex/config.toml`, which is centralized at:
`operations/system-configs/codex/config.toml`.

### Create MCP docs/template folder
```bash
mkdir -p operations/system-configs/mcp/<server-name>
```

Required files:
- `README.md`
- `codex-config.template.toml`
- optional client templates (for example `mcp-http-config.template.json`)

### Centralize Antigravity MCP runtime file
```bash
mkdir -p "operations/system-configs/antigravity/User"
mkdir -p "$HOME/Library/Application Support/Antigravity/User"
ln -sfn \
  "/path/to/brain/operations/system-configs/antigravity/User/mcp.json" \
  "$HOME/Library/Application Support/Antigravity/User/mcp.json"
```

Template (safe, tracked):
`operations/system-configs/antigravity/mcp.template.json`

Runtime file (ignored, token-bearing):
`operations/system-configs/antigravity/User/mcp.json`

## Security rules
- Never commit API keys, bearer tokens, cookies, or auth sessions.
- Use OAuth/proxy mode when available.
- If temporary tokens are required (for example direct HTTP mode), store only in ignored runtime files.

## Current canonical files
- Codex config: `operations/system-configs/codex/config.toml`
- MCP docs/templates: `operations/system-configs/mcp/`
- Antigravity runtime MCP config:
  `operations/system-configs/antigravity/User/mcp.json` (ignored)
- Antigravity tracked template:
  `operations/system-configs/antigravity/mcp.template.json`

## Validation checklist
- `codex mcp list` shows server enabled.
- Server has docs + templates under `operations/system-configs/mcp/<server>/`.
- Any runtime secret file is ignored by git (`git check-ignore -v <path>`).
- Client can load MCP config from symlinked path.
