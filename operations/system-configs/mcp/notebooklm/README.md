# NotebookLM MCP

This folder holds repo-safe documentation and templates for the NotebookLM MCP server.
Runtime state (auth, cookies) must stay in `~/.notebooklm-mcp/` outside the repo and
must never be committed.

For the global MCP installation standard, see:
`operations/system-configs/mcp/README.md`

---

## Package — IMPORTANT

**The correct package is `notebooklm-mcp-server` (npm).**

`notebooklm-mcp` and `notebooklm-mcp-server` are NOT interchangeable.

| Package | Registry | Binary | Tools | Use? |
|---|---|---|---|---|
| `notebooklm-mcp-server` | npm | `notebooklm-mcp-server` | Full Brain-aligned surface (notebook_list, notebook_create, research_start, etc.) | ✅ YES |
| `notebooklm-mcp` (v2.x) | PyPI | `notebooklm-mcp` | Limited 8-tool surface (chat_with_notebook, navigate_to_notebook, etc.) | ❌ NO |

The Brain skill (`ai/skills/notebooklm/SKILL.md`) and `tools.md` were written against the
`notebooklm-mcp-server` tool surface. Installing the wrong package results in a broken
integration with no visible error — the server starts but no Brain-documented tools exist.

---

## Install

```bash
npm install -g notebooklm-mcp-server
```

Installs two binaries to `~/.local/bin/`:
- `notebooklm-mcp-server` — MCP stdio server
- `notebooklm-mcp-auth` — interactive auth CLI

---

## Repo contents

- `README.md` — this file
- `notebooklm-config.legacy-python-package.json` — config template written for the wrong Python package (`notebooklm-mcp` PyPI v2.x). Kept for reference only. Not used by `notebooklm-mcp-server`.
- `openclaw-mcporter.md` — OpenClaw/ProBot bridge instructions

---

## Runtime locations (outside repo, never commit)

- `~/.notebooklm-mcp/auth.json` — Google auth cookies (written by `notebooklm-mcp-auth`)
- `~/.notebooklm-mcp/` — runtime state directory

---

## Client adapters

### Codex (Mac)

Canonical Codex config: `operations/system-configs/codex/config.toml`

The committed config uses:
```toml
[mcp_servers.notebooklm]
command = "/Users/Office/.local/bin/notebooklm-mcp"
```

Note: on the Mac, `/Users/Office/.local/bin/notebooklm-mcp` may resolve to the
`notebooklm-mcp-server` binary depending on how the package was installed (npm global
install can place binaries at that path). Verify with:
```bash
readlink $(which notebooklm-mcp) 2>/dev/null || ls -la ~/.local/bin/notebooklm-mcp
```

If the Mac binary does not point to `notebooklm-mcp-server`, update the Codex config to:
```toml
[mcp_servers.notebooklm]
command = "/Users/Office/.local/bin/notebooklm-mcp-server"
```

Auth:
```bash
notebooklm-mcp-auth   # or: ~/.local/bin/notebooklm-mcp-auth
# then restart Codex and verify:
codex mcp list
```

### ProBot / OpenClaw (VPS)

ProBot reaches NotebookLM through `mcporter` as the runtime bridge:

```
ProBot (exec) → mcporter call notebooklm.<tool> → notebooklm-mcp-server (stdio)
```

ProBot does NOT use native OpenClaw MCP tool injection.
`mcp.servers` in `openclaw.json` feeds ACPX (coding agent) only, not the main ProBot agent.

mcporter system config: `~/.mcporter/mcporter.json`

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "/home/ubuntu/.local/bin/notebooklm-mcp-server",
      "description": "NotebookLM MCP server (notebooklm-mcp-server npm, Brain-aligned tool surface)"
    }
  }
}
```

Full bridge instructions: `openclaw-mcporter.md`

---

## Auth flow (any client)

Run once after install:
```bash
notebooklm-mcp-auth
```

Follow the browser prompt to sign in with your Google account.
Auth is saved to `~/.notebooklm-mcp/auth.json`.

Re-run when the session expires.

---

## Verify

```bash
# Check binary is correct package
notebooklm-mcp-server --version   # should be 3.x

# Via mcporter (ProBot path)
mcporter list notebooklm           # should show notebook_list, notebook_create, etc.
mcporter call notebooklm.notebook_list  # requires auth to be done first
```
