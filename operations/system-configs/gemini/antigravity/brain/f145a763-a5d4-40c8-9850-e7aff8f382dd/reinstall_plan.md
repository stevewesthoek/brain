# NotebookLM MCP Re-installation Plan

Clean installation and configuration of the NotebookLM MCP server to ensure full connectivity and authentication.

## Proposed Changes

### 1. Installation
- Re-install the package using `uv` to ensure the latest version and correct binary paths.
- **Tools installed**: `notebooklm-mcp`, `notebooklm-mcp-auth`.

### 2. Configuration
- Update `~/.config/opencode/opencode.json` with the correct executable path and configuration arguments.
- Use the Antigravity CLI to register the server in the user profile.

### 3. Authentication
- Run `notebooklm-mcp-auth` to trigger the manual login flow.
- Guide the user through the Google login process in the opened browser.

## Verification Plan
1. **List Notebooks**: Run `notebooklm-mcp test` or `list_resources` to confirm the server can see the user's notebooks.
2. **Process Check**: Ensure the server spawns correctly without authentication errors.
