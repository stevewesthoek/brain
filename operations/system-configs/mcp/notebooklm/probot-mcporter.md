# ProBot — NotebookLM Bridge via mcporter

> **Status: future integration.** The current deployed ProBot MVP (brain/projects/probot) does not include exec-tool or MCP bridge support. This document describes the target architecture for when that capability is added.

This document covers the ProBot-specific wiring for NotebookLM.
Workflow logic lives in `ai/skills/notebooklm/SKILL.md` — do not duplicate it here.

---

## Architecture

```
ProBot (exec tool) → mcporter call notebooklm.<tool> → notebooklm-mcp-server (stdio)
```

ProBot invokes NotebookLM tools by running shell commands via `exec`.
`mcporter` is the bridge that launches the MCP server and calls tools.

---

## Components

| Component | Path | Notes |
|---|---|---|
| `notebooklm-mcp-server` | `~/.local/bin/notebooklm-mcp-server` | npm package, Brain-aligned tool surface |
| `notebooklm-mcp-auth` | `~/.local/bin/notebooklm-mcp-auth` | auth CLI, same npm package |
| `mcporter` | `~/.local/bin/mcporter` | MCP CLI bridge |
| mcporter config | `~/.mcporter/mcporter.json` | system-scope, outside Git |
| auth state | `~/.notebooklm-mcp/auth.json` | outside Git, written by auth CLI |

---

## Install (local Mac)

```bash
# MCP server
npm install -g notebooklm-mcp-server

# MCP bridge CLI
npm install -g mcporter
```

---

## mcporter config

System config at `~/.mcporter/mcporter.json`:

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "/Users/Office/.local/bin/notebooklm-mcp-server",
      "description": "NotebookLM MCP server (notebooklm-mcp-server npm, Brain-aligned tool surface)"
    }
  }
}
```

To set via CLI:
```bash
mcporter config add notebooklm \
  --stdio ~/.local/bin/notebooklm-mcp-server \
  --description "NotebookLM MCP server (notebooklm-mcp-server npm, Brain-aligned tool surface)" \
  --scope home
```

---

## Auth

Run once after install, re-run when session expires:
```bash
notebooklm-mcp-auth
```

This opens a browser prompt for Google sign-in and saves cookies to
`~/.notebooklm-mcp/auth.json`.

**Headless note:** If running without a display (e.g. SSH session), `notebooklm-mcp-auth` may need a port-forward for the browser OAuth step. Check whether the auth CLI supports a redirect-URL or token-paste flow.

---

## Verification

```bash
# Tool surface check
mcporter list notebooklm | grep "function "
# Expected: notebook_list, notebook_create, notebook_query, research_start, report_create, etc.

# Functional check (requires auth)
mcporter call notebooklm.notebook_list

```

---

## ProBot call pattern

When ProBot needs to call a NotebookLM tool, it runs:

```bash
mcporter call notebooklm.<tool_name> [key=value ...]
```

Examples:
```bash
mcporter call notebooklm.notebook_list
mcporter call notebooklm.notebook_create title="2026-03-24 - ProChat research"
mcporter call notebooklm.notebook_query notebook_id=<id> query="summarise key themes"
mcporter call notebooklm.research_start notebook_id=<id> query="SaaS onboarding patterns" mode=fast
```
