# Stitch MCP

This folder holds repo-safe documentation and templates for the Stitch MCP server.
Runtime auth state should stay in your home directory and must not be committed to this repo.

For the global MCP installation standard, see:
`Operations/system-configs/mcp/README.md`

## Repo contents
- codex-config.template.toml
  Template MCP block for Codex config.
- mcp-http-config.template.json
  Template for clients that connect directly to Stitch's HTTP MCP endpoint
  and expect top-level `mcpServers`.

## Runtime locations (outside repo)
- ~/.stitch-mcp/ (helper-managed gcloud/sdk + config by default)
- ~/.stitch-mcp/config/
- ~/.stitch-mcp/google-cloud-sdk/
- ~/.config/gcloud/ (optional, if using system gcloud mode)

## Codex project config
Canonical config lives at `Operations/system-configs/codex/config.toml`.
Do not duplicate MCP definitions per repo. Repos should consume central config via
the `.codex -> ~/.codex` symlink pattern.

`stitch` entry:

[mcp_servers.stitch]
command = "npx"
args = ["-y", "@_davideast/stitch-mcp", "proxy"]

## Setup flow
Recommended helper:
  npx -y @_davideast/stitch-mcp init

Manual OAuth/project setup:
  gcloud auth application-default login
  gcloud config set project <PROJECT_ID>
  gcloud components install beta
  gcloud beta services mcp enable stitch.googleapis.com --project=<PROJECT_ID>

## Verify
- npx -y @_davideast/stitch-mcp doctor
- codex mcp list

## Notes
- The proxy mode avoids storing API keys in repo config and uses gcloud auth.
- `init` can install/manage gcloud in `~/.stitch-mcp` if system gcloud is absent.
- Optional system gcloud mode:
  - Add `STITCH_USE_SYSTEM_GCLOUD = "1"` under `[mcp_servers.stitch.env]`.
  - Then use your existing `~/.config/gcloud` auth/project settings.
- If using direct HTTP auth in Antigravity, keep token-bearing config in the centralized
  ignored file: `Operations/system-configs/antigravity/User/mcp.json`, symlinked from
  `~/Library/Application Support/Antigravity/User/mcp.json`.
- Antigravity runtime JSON uses top-level `servers` (not `mcpServers`).
  Use `Operations/system-configs/antigravity/mcp.template.json` as the tracked safe template.
