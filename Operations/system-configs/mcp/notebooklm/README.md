# NotebookLM MCP

This folder holds repo-safe documentation and templates for the NotebookLM MCP server.
Runtime state (cookies, session, Chrome profile) should stay in your home directory and
must not be committed to this repo.

## Repo contents
- notebooklm-config.template.json
  Template config for the NotebookLM MCP server. Copy to
  ~/.notebooklm-mcp/notebooklm-config.json and edit paths if needed.

## Runtime locations (outside repo)
- ~/.notebooklm-mcp/notebooklm-config.json
- ~/.notebooklm-mcp/auth.json
- ~/.notebooklm-mcp/chrome_profile_notebooklm

## Codex project config
Canonical config lives at `Operations/system-configs/codex/config.toml`.
Copy/sync this block into each repo's `.codex/config.toml` (project-scoped) so the MCP entry is present:

[mcp_servers.notebooklm]
command = "/Users/Office/.local/bin/notebooklm-mcp"
args = ["--config", "/Users/Office/.notebooklm-mcp/notebooklm-config.json"]

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
