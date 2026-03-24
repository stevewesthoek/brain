# OpenClaw / ProBot — NotebookLM Bridge via mcporter

This document covers the ProBot/OpenClaw-specific wiring for NotebookLM.
Workflow logic lives in `ai/skills/notebooklm/SKILL.md` — do not duplicate it here.

---

## Architecture

```
ProBot (exec tool) → mcporter call notebooklm.<tool> → notebooklm-mcp-server (stdio)
```

ProBot invokes NotebookLM tools by running shell commands via `exec`.
`mcporter` is the bridge that launches the MCP server and calls tools.
ProBot does NOT use native OpenClaw MCP tool injection (`mcp.servers` in openclaw.json
feeds ACPX/coding agents only, not the main ProBot agent turn).

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

## Install (VPS)

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
      "command": "/home/ubuntu/.local/bin/notebooklm-mcp-server",
      "description": "NotebookLM MCP server (notebooklm-mcp-server npm, Brain-aligned tool surface)"
    }
  }
}
```

To set via CLI:
```bash
mcporter config add notebooklm \
  --stdio /home/ubuntu/.local/bin/notebooklm-mcp-server \
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

**VPS note:** `notebooklm-mcp-auth` may need a display or port-forward for the
browser OAuth step. If running headless, check whether the auth CLI supports
a redirect-URL or token-paste flow.

---

## OpenClaw skill loading

The NotebookLM skill is loaded as a shared cross-tool skill via `extraDirs` in
`~/.openclaw/openclaw.json`:

```json
"skills": {
  "load": {
    "extraDirs": [
      "/home/ubuntu/.openclaw/workspace/brain/ai/skills",
      "/home/ubuntu/.openclaw/workspace/brain/runtime/openclaw/active-skills/x",
      "/home/ubuntu/.openclaw/workspace/brain/runtime/openclaw/active-skills/google"
    ]
  }
}
```

The skill is NOT duplicated into `active-skills/`. One canonical skill in `ai/skills/notebooklm/`.

---

## Verification

```bash
# Tool surface check
mcporter list notebooklm | grep "function "
# Expected: notebook_list, notebook_create, notebook_query, research_start, report_create, etc.

# Functional check (requires auth)
mcporter call notebooklm.notebook_list

# OpenClaw skill check
openclaw skills list | grep notebooklm
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
