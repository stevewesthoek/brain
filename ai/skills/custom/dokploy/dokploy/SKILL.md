---
name: dokploy
description: Use when the user asks to deploy, manage, or inspect applications on the Dokploy server. Covers MCP-based direct control, CLI operations, and CI/CD pipeline setup via GitHub Actions. Server: https://dokploy.prochat.tools
---

# Dokploy

## What this skill is for
Help Claude manage deployments, applications, databases, and projects on the self-hosted Dokploy server at `https://dokploy.prochat.tools` — via MCP tools (direct), CLI commands (scripted), or GitHub Actions (automated CI/CD).

## Use this skill when
- Deploying or redeploying an application on Dokploy
- Creating or managing projects, apps, or databases on Dokploy
- Setting up a CI/CD pipeline that deploys to Dokploy on push
- Checking deployment status, logs, or health
- Managing environment variables on a Dokploy app
- Adding a custom domain to a Dokploy application

## Do not use this skill for
- Managing the Dokploy server infrastructure itself (use SSH/server runbooks)
- Deploying to platforms other than Dokploy
- Any production data mutations without explicit confirmation

## Safety rules
1. **Confirm before deploy.** Always state which app and which environment before triggering a deployment. Wait for confirmation.
2. **Never log or commit API keys.** The `DOKPLOY_API_KEY` must never appear in code, logs, or committed files.
3. **Test deploys first.** Use dry-run or staging apps where available before touching production.
4. **Confirm destructive actions.** Deleting apps, databases, or projects requires explicit user confirmation.
5. **Verify server URL.** All operations target `https://dokploy.prochat.tools`. Double-check before targeting a different server.

## Layer stack

### Layer 1 — MCP (direct Claude control)
The `@ahdev/dokploy-mcp` MCP server is registered at user scope. Claude can directly call 67 Dokploy tools without leaving the conversation.

Config:
- `DOKPLOY_URL`: `https://dokploy.prochat.tools/api`
- `DOKPLOY_API_KEY`: stored in `~/.claude.json` (never in repo)
- Stable binary: `~/.local/bin/dokploy-mcp`

### Layer 2 — CLI (scripted operations)
```bash
~/.local/bin/dokploy-cli   # use this path to avoid the 'dokploy' ssh alias
```

Common commands:
```bash
~/.local/bin/dokploy-cli --help
~/.local/bin/dokploy-cli authenticate
~/.local/bin/dokploy-cli app deploy --appId <id>
~/.local/bin/dokploy-cli app list
~/.local/bin/dokploy-cli project list
```

> Note: `dokploy` in terminal is aliased to `ssh dokploy` (SSH shortcut to the server).
> Always call the CLI via `~/.local/bin/dokploy-cli` or its full nvm path.

### Layer 3 — GitHub Actions (automated CI/CD)
Reusable workflow template: `brain/operations/deploy/dokploy-deploy.yml`

Required GitHub secrets per repo:
- `DOKPLOY_API_KEY` — generate in Dokploy dashboard → Settings → API
- `DOKPLOY_APP_ID` — found in app settings in the Dokploy dashboard

## Recommended workflow — new app deployment

```
1. Create project in Dokploy dashboard (or via MCP)
2. Create application under the project
3. Set environment variables in app settings
4. Add custom domain if needed
5. Add DOKPLOY_API_KEY and DOKPLOY_APP_ID as GitHub secrets
6. Copy brain/operations/deploy/dokploy-deploy.yml into the repo
7. Push to main → auto-deploy triggers
```

## Recommended workflow — manual redeploy
```bash
# Via CLI
~/.local/bin/dokploy-cli app deploy --appId <your-app-id>

# Via REST API
curl -X POST https://dokploy.prochat.tools/api/application.deploy \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"applicationId": "<your-app-id>"}'
```

## Notes
- MCP binary: `~/.local/bin/dokploy-mcp` (v npm @ahdev/dokploy-mcp)
- CLI binary: `~/.local/bin/dokploy-cli` (v npm @dokploy/cli@0.2.8)
- MCP registered at user scope via `claude mcp add -s user`
- API key and URL stored in `~/.claude.json` — never in brain repo
- Dokploy server: `https://dokploy.prochat.tools`
