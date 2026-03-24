# Antigravity Config Centralization

This folder holds Antigravity-related centralized config.

## MCP config location
- Canonical (in Brain): `operations/system-configs/antigravity/User/mcp.json`
- Runtime path expected by Antigravity:
  `~/Library/Application Support/Antigravity/User/mcp.json`
- Tracked template (no secrets): `operations/system-configs/antigravity/mcp.template.json`

Use a symlink so Antigravity behavior stays unchanged while config is centralized.
Antigravity's runtime format uses top-level `servers` (not `mcpServers`).

## Symlink command
```bash
mkdir -p "$HOME/Library/Application Support/Antigravity/User"
ln -sfn \
  "/path/to/brain/operations/system-configs/antigravity/User/mcp.json" \
  "$HOME/Library/Application Support/Antigravity/User/mcp.json"
```

## Git safety
`operations/system-configs/antigravity/User/` is ignored in repo `.gitignore`.
This allows token-bearing MCP config (for example temporary bearer tokens) to remain local-only.
