# NotebookLM MCP

This folder holds repo-safe documentation and templates for the NotebookLM MCP server.
Runtime state (cookies, session, Chrome profile) should stay in your home directory and
must not be committed to this repo.

For the global MCP installation standard, see:
`operations/system-configs/mcp/README.md`

## Repo contents
- notebooklm-config.template.json
  Template config for the NotebookLM MCP server. Copy to
  ~/.notebooklm-mcp/notebooklm-config.json and edit paths if needed.

## Runtime locations (outside repo)
- ~/.notebooklm-mcp/notebooklm-config.json
- ~/.notebooklm-mcp/auth.json
- ~/.notebooklm-mcp/chrome_profile_notebooklm

## Codex project config
Canonical config lives at `operations/system-configs/codex/config.toml`.
Do not duplicate MCP definitions per repo. Repos should consume central config via
the `.codex -> ~/.codex` symlink pattern.

[mcp_servers.notebooklm]
command = "/Users/Office/.local/bin/notebooklm-mcp"

## Auth flow
Run:
  /Users/Office/.local/bin/notebooklm-mcp-auth
Then restart Codex and verify:
  codex mcp list

## Refresh auth
If NotebookLM expires your session, re-run:
  /Users/Office/.local/bin/notebooklm-mcp-auth
Then restart Codex and verify:
  codex mcp list

## Verified
As of 2026-01-31, Codex lists the server as enabled using:
  /Users/Office/.local/bin/notebooklm-mcp --config /Users/Office/.notebooklm-mcp/notebooklm-config.json
