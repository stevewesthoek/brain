# Stitch MCP — Centralized Setup for All IDEs

This folder holds centralized, repo-safe documentation and templates for the Google Stitch MCP server.
Runtime auth state must stay in your home directory and must not be committed to this repo.

**For the global MCP installation standard, see:**
`operations/system-configs/mcp/README.md`

## Quick Status

| Tool | Status | Config | Setup |
|------|--------|--------|-------|
| **Claude Code** | ✅ Active | `~/.claude.json` | Manual merge or run setup script |
| **Codex** | ✅ Active | `~/.codex/config.toml` | Automatic physical generated copy from Brain |
| **Kiro** | ✅ Active | `~/.kiro/settings.json` | Automatic via setup script |
| **Cursor** | ✅ Active | `~/.cursor/settings.json` | Automatic via setup script |
| **Antigravity** | ✅ Active | `~/Library/Application Support/Antigravity/User/mcp.json` | Automatic via setup script (symlink) |
| **Gemini CLI** | ✅ Active | `~/.gemini/config/mcp_config.json` | Automatic (already configured in brain) |

## Repo Contents

### Centralized Config Templates (tracked in git)
- **`codex-config.template.toml`** — Codex MCP block (TOML format)
- **`claude-code-config.template.json`** — Claude Code MCP block (JSON format)
- **`kiro-config.template.json`** — Kiro MCP block (JSON format)
- **`cursor-config.template.json`** — Cursor MCP block (JSON format)
- **`mcp-http-config.template.json`** — HTTP endpoint config (for direct HTTP clients)

### Runtime Locations (outside repo — git-ignored)
- `~/.stitch-mcp/` — Managed gcloud SDK + credentials
  - `~/.stitch-mcp/config/` — Stitch config
  - `~/.stitch-mcp/google-cloud-sdk/` — Bundled gcloud SDK
  - `~/.config/gcloud/` — System gcloud (optional, if using system mode)
- `operations/system-configs/antigravity/User/mcp.json` (ignored) — Antigravity runtime config
- Individual IDE config files in home directory

## Installation & Setup

### Step 1: Initialize Stitch (One-time setup)

```bash
# Initialize Stitch and authorize Google Application Default Credentials
npx -y @_davideast/stitch-mcp init

# Verify setup
npx -y @_davideast/stitch-mcp doctor
```

This sets up `~/.stitch-mcp/` with Google Application Default Credentials.
The proxy wrapper resolves a short-lived ADC access token at each process
start; it does not persist a token in any MCP configuration file.

### Step 2: Add to Claude Code (~/.claude.json)

```bash
# Manually merge this into ~/.claude.json:
cat > /tmp/stitch-snippet.json << 'EOF'
{
  "mcpServers": {
    "stitch": {
      "type": "stdio",
      "command": "/Users/Office/Repos/stevewesthoek/brain/operations/system-configs/mcp/stitch/stitch-oauth-proxy.sh",
      "args": [],
      "env": {
        "DOTENV_CONFIG_QUIET": "true"
      }
    }
  }
}
EOF

# Then update ~/.claude.json to include the stitch server definition
claude mcp list  # Verify it loaded
```

See `claude-code-config.template.json` in this directory for reference.

### Step 3: Add to Kiro (~/.kiro/settings.json)

```bash
# Manually merge this into ~/.kiro/settings.json:
cat > /tmp/kiro-snippet.json << 'EOF'
{
  "mcpServers": {
    "stitch": {
      "type": "stdio",
      "command": "/Users/Office/Repos/stevewesthoek/brain/operations/system-configs/mcp/stitch/stitch-oauth-proxy.sh",
      "args": [],
      "env": {
        "DOTENV_CONFIG_QUIET": "true"
      }
    }
  }
}
EOF

# Then update ~/.kiro/settings.json with the stitch server definition
```

See `kiro-config.template.json` in this directory for reference.

### Step 4: Add to Cursor (~/.cursor/settings.json)

```bash
# Manually merge this into ~/.cursor/settings.json:
cat > /tmp/cursor-snippet.json << 'EOF'
{
  "mcpServers": {
    "stitch": {
      "type": "stdio",
      "command": "/Users/Office/Repos/stevewesthoek/brain/operations/system-configs/mcp/stitch/stitch-oauth-proxy.sh",
      "args": [],
      "env": {
        "DOTENV_CONFIG_QUIET": "true"
      }
    }
  }
}
EOF

# Then update ~/.cursor/settings.json with the stitch server definition
```

See `cursor-config.template.json` in this directory for reference.

### Step 5: Add to Antigravity

```bash
# Create the ignored runtime config directory
mkdir -p /Users/Office/Repos/stevewesthoek/brain/operations/system-configs/antigravity/User

# Populate the runtime config (NOT tracked in git)
cat > /Users/Office/Repos/stevewesthoek/brain/operations/system-configs/antigravity/User/mcp.json << 'EOF'
{
  "servers": {
    "stitch": {
      "serverUrl": "https://stitch.googleapis.com/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_GOOGLE_STITCH_ACCESS_TOKEN>",
        "X-Goog-User-Project": "<YOUR_GCP_PROJECT_ID>"
      }
    }
  }
}
EOF

# Create symlink from Antigravity app home
mkdir -p ~/Library/Application\ Support/Antigravity/User
ln -sfn \
  /Users/Office/Repos/stevewesthoek/brain/operations/system-configs/antigravity/User/mcp.json \
  ~/Library/Application\ Support/Antigravity/User/mcp.json

# For HTTP-based auth (direct token), fill in:
# - Authorization: Bearer <token from gcloud>
# - X-Goog-User-Project: <your GCP project ID>
```

To get a fresh token for HTTP mode:
```bash
gcloud auth print-access-token
```

**Note:** Proxy mode (all other IDEs) is preferred over HTTP mode because it avoids storing tokens in config files.

### Step 6: Codex (Already Active ✅)

Codex config is already set up in `~/.codex/config.toml` as a physical
mode-`0600` generated copy of `operations/system-configs/codex/config.toml`.

Verify:
```bash
codex mcp list
```

## Universal Verification

After setup, verify Stitch MCP is accessible in all tools:

```bash
# Claude Code
claude mcp list | grep stitch

# Codex
codex mcp list | grep stitch

# Generic Stitch doctor check
npx -y @_davideast/stitch-mcp doctor

# For Kiro, Cursor, Antigravity: Check settings UI → Extensions → MCP Servers
```

## Key Technical Notes

### OAuth proxy authentication
- The installed Stitch SDK treats `STITCH_API_KEY` literally and sends it as `X-Goog-Api-Key`.
- `gcloud-adc` is **not** a valid API-key sentinel for the SDK and must not be configured as one.
- `stitch-oauth-proxy.sh` obtains a short-lived token with `gcloud auth application-default print-access-token` at process start.
- The token is passed as `STITCH_ACCESS_TOKEN` only to the child proxy and is never written to the repository or MCP config.
- **Never** put a real Google API key or OAuth token in a tracked configuration file.

### Proxy vs. HTTP Mode

| Mode | Storage | Best For | Security |
|------|---------|----------|----------|
| **Proxy** (recommended) | `~/.stitch-mcp/` via gcloud ADC | Claude Code, Codex, Kiro, Cursor | Wrapper injects a short-lived OAuth token, no tokens in config |
| **HTTP** | Token-bearing Antigravity config | Antigravity (direct HTTP endpoint) | Store token only in ignored runtime file |

### Environment Variables
- `DOTENV_CONFIG_QUIET = "true"` — Prevent dotenv startup noise on stdout (breaks JSON-RPC)
- `STITCH_GCLOUD_BIN` (optional) — Override the gcloud executable used by the wrapper
- `STITCH_PROJECT_ID` (optional) — Override the quota project; otherwise the wrapper uses the active gcloud project

## Troubleshooting

### Issue: "StitchProxy requires an API key"
**Cause:** The MCP server was launched directly instead of through the OAuth wrapper, or ADC is not initialized.
**Fix:**
```bash
npx -y @_davideast/stitch-mcp init
npx -y @_davideast/stitch-mcp doctor
```
Ensure every stdio client launches `stitch-oauth-proxy.sh`, not `npx ... proxy` directly.

### Issue: MCP server not appearing in tool
**Cause:** Config file not reloaded or syntax error.
**Fix:**
1. Verify JSON/TOML syntax in config file
2. Restart the IDE completely
3. Check `codex mcp list` or `claude mcp list`

### Issue: "Authorization failed" or "Invalid token"
**Cause:** ADC is missing/expired, the quota project is unavailable, or the caller lacks Stitch access.
**Fix:**
```bash
gcloud auth application-default login
gcloud config set project <YOUR_PROJECT_ID>
npx -y @_davideast/stitch-mcp doctor
```

If the proxy returns `403` asking for `serviceusage.services.use`, grant the
selected Google identity `roles/serviceusage.serviceUsageConsumer` on the
quota project, or run the official Stitch `init` flow and accept its IAM/API
configuration prompts. This is a project-permission change and must be
reviewed by the project owner.

### Issue: Works in Codex, not in Claude Code/Kiro/Cursor
**Cause:** Config not added to that IDE's settings file.
**Fix:** Copy the appropriate template from this directory into the IDE's config file and restart.

## Maintenance

When updating Stitch MCP or gcloud:
1. Check for breaking changes in [@_davideast/stitch-mcp](https://github.com/davideast/stitch-mcp) releases
2. Update all template files if command/args changes
3. Re-run `npx -y @_davideast/stitch-mcp init` to refresh gcloud
4. Verify `codex mcp list` and `claude mcp list`
5. Update the status table above if any changes occur

## Related Documentation

- **Global MCP standard:** `operations/system-configs/mcp/README.md`
- **Centralization runbook:** `operations/runbooks/mcp-centralization.md`
- **Stitch GitHub:** https://github.com/davideast/stitch-mcp
- **Google Stitch API docs:** https://developers.google.com/stitch/docs
