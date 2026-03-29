# Dokploy MCP

This folder holds repo-safe documentation for the Dokploy MCP server.
Runtime credentials (API key) must stay in `~/.claude.json` and must never be committed.

---

## Package

**The correct package is `@ahdev/dokploy-mcp` (npm).**

> Note: despite the official Dokploy org repo being at `github.com/dokploy/mcp`,
> the published npm package is under the `@ahdev` scope, not `@dokploy`.

```bash
npm install -g @ahdev/dokploy-mcp
```

Binary: `dokploy-mcp`

---

## Install

```bash
npm install -g @ahdev/dokploy-mcp
ln -sf $(which dokploy-mcp) ~/.local/bin/dokploy-mcp
```

Register with Claude Code at user scope:
```bash
claude mcp add -s user dokploy ~/.local/bin/dokploy-mcp \
  -e DOKPLOY_URL=https://dokploy.prochat.tools/api \
  -e DOKPLOY_API_KEY=YOUR_KEY_HERE
```

> This writes to `~/.claude.json`. The API key is stored there — never in the brain repo.

---

## Configuration

| Env var | Value | Notes |
|---|---|---|
| `DOKPLOY_URL` | `https://dokploy.prochat.tools/api` | Always include `/api` suffix |
| `DOKPLOY_API_KEY` | (secret) | Generate in Dokploy → Settings → API |
| `MCP_TRANSPORT` | `stdio` (default) | Do not change unless running in HTTP mode |

---

## Where to generate the API key

1. Go to `https://dokploy.prochat.tools`
2. Settings → API (left sidebar)
3. Generate a new token
4. Paste it only in the `claude mcp add` command above — never in chat or files

---

## Verify

```bash
# Check binary resolves
~/.local/bin/dokploy-mcp --version 2>/dev/null || echo "binary ok (no --version flag)"

# Check MCP is registered
claude mcp list
```

---

## CLI (companion tool)

```bash
npm install -g @dokploy/cli
ln -sf /Users/Office/.nvm/versions/node/v24.12.0/bin/dokploy ~/.local/bin/dokploy-cli
```

> Important: `dokploy` in the shell is aliased to `ssh dokploy` (SSH shortcut).
> Always invoke the CLI via `~/.local/bin/dokploy-cli` to avoid the alias conflict.

---

## GitHub Actions

Reusable deploy workflow: `brain/operations/deploy/dokploy-deploy.yml`

Required secrets per repo:
- `DOKPLOY_API_KEY`
- `DOKPLOY_APP_ID`

---

## Runtime locations (outside repo, never commit)

- `~/.claude.json` — MCP server registration including env vars (API key lives here)
