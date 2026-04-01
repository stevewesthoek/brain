# Stitch MCP

This folder holds repo-safe documentation and templates for the Stitch MCP server.
Runtime auth state should stay in your home directory and must not be committed to this repo.

For the global MCP installation standard, see:
`operations/system-configs/mcp/README.md`

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
Canonical config lives at `operations/system-configs/codex/config.toml`.
Do not duplicate MCP definitions per repo. Repos should consume central config via
the `.codex -> ~/.codex` symlink pattern.

`stitch` entry (canonical — keep `config.toml` and `codex-config.template.toml` in sync with this):

[mcp_servers.stitch]
command = "npx"
args = ["-y", "@_davideast/stitch-mcp", "proxy", "--transport", "stdio"]

[mcp_servers.stitch.env]
DOTENV_CONFIG_QUIET = "true"
STITCH_API_KEY = "gcloud-adc"

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
- `STITCH_API_KEY = "gcloud-adc"` is NOT a secret — it is a sentinel value that tells
  the proxy to use Google Application Default Credentials from `~/.stitch-mcp/`.
  Both Claude (`~/.claude.json`) and Codex (`config.toml`) must have this set or the
  proxy will refuse to start with: "StitchProxy requires an API key (STITCH_API_KEY)".
- The proxy mode avoids storing real API keys in repo config and uses gcloud ADC auth.
- Set `DOTENV_CONFIG_QUIET = "true"` to prevent dotenv startup banners on stdout,
  which can break MCP JSON-RPC handshakes.
- `init` can install/manage gcloud in `~/.stitch-mcp` if system gcloud is absent.
- Optional system gcloud mode:
  - Add `STITCH_USE_SYSTEM_GCLOUD = "1"` under `[mcp_servers.stitch.env]`.
  - Then use your existing `~/.config/gcloud` auth/project settings.
- If using direct HTTP auth in Antigravity, keep token-bearing config in the centralized
  ignored file: `operations/system-configs/antigravity/User/mcp.json`, symlinked from
  `~/Library/Application Support/Antigravity/User/mcp.json`.
- Antigravity runtime JSON uses top-level `servers` (not `mcpServers`).
  Use `operations/system-configs/antigravity/mcp.template.json` as the tracked safe template.
