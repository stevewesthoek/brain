---
name: dokploy
description: "Use when the user asks to deploy, manage, or inspect applications on the Dokploy server. Uses Dokploy CLI exclusively. Server: https://dokploy.prochat.tools"
---

# Dokploy

## What this skill is for
Help manage deployments, applications, databases, and projects on the self-hosted Dokploy server at `https://dokploy.prochat.tools` — via the **Dokploy CLI** (direct commands) or the **REST API** (curl, GitHub Actions).

The Dokploy CLI is the single, preferred interface. Do not use or reference any MCP server for Dokploy.

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
2. **Never log or commit API keys.** `DOKPLOY_API_KEY` must never appear in code, logs, or committed files.
3. **Test deploys first.** Use dry-run or staging apps where available before touching production.
4. **Confirm destructive actions.** Deleting apps, databases, or projects requires explicit user confirmation.
5. **Verify server URL.** All operations target `https://dokploy.prochat.tools`. Double-check before targeting a different server.

## Authentication

The API key and server URL are stored in `~/.config/dokploy/.env` (local, never committed):

```
DOKPLOY_API_KEY=...
DOKPLOY_URL=https://dokploy.prochat.tools/api
```

Load them in any shell command with:
```bash
source ~/.config/dokploy/.env
```

This file is the single source of truth for Dokploy credentials — used by Claude Code, Codex, and any script.

> Important: `dokploy` in the shell is aliased to `ssh dokploy` (SSH shortcut to the server).
> Always invoke the CLI via `~/.local/bin/dokploy-cli` to avoid the alias conflict.

## Layer 1 — CLI (all interactive and scripted operations)

```bash
~/.local/bin/dokploy-cli --version   # @dokploy/cli v0.2.8
~/.local/bin/dokploy-cli --help
```

Common operations:
```bash
# List all projects and apps
source ~/.config/dokploy/.env
curl -s -X GET "https://dokploy.prochat.tools/api/project.all" \
  -H "x-api-key: $DOKPLOY_API_KEY" | python3 -m json.tool

# Deploy an application
source ~/.config/dokploy/.env
curl -s -X POST "https://dokploy.prochat.tools/api/application.deploy" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"applicationId": "<app-id>"}'

# Get app details
source ~/.config/dokploy/.env
curl -s -X GET "https://dokploy.prochat.tools/api/application.one?applicationId=<app-id>" \
  -H "x-api-key: $DOKPLOY_API_KEY" | python3 -m json.tool
```

## Layer 2 — GitHub Actions (automated CI/CD)

Reusable workflow template: `brain/operations/deploy/dokploy-deploy.yml`

Required GitHub secrets per repo:
- `DOKPLOY_API_KEY` — copy from `~/.config/dokploy/.env`
- `DOKPLOY_APP_ID` — found in app settings in the Dokploy dashboard

## Recommended workflow — new app deployment

```
1. Create project in Dokploy dashboard
2. Create application under the project
3. Set environment variables in app settings
4. Add custom domain if needed
5. Add DOKPLOY_API_KEY and DOKPLOY_APP_ID as GitHub secrets
6. Copy brain/operations/deploy/dokploy-deploy.yml into the repo
7. Push to main → auto-deploy triggers
```

## Recommended workflow — manual redeploy

```bash
source ~/.config/dokploy/.env
curl -s -X POST "https://dokploy.prochat.tools/api/application.deploy" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"applicationId": "<your-app-id>"}'
```

## Notes
- CLI binary: `~/.local/bin/dokploy-cli` → symlink to `@dokploy/cli@0.2.8` (nvm node v24.12.0)
- Credentials: `~/.config/dokploy/.env` — local only, never in any repo
- Dokploy server: `https://dokploy.prochat.tools`
- This skill applies to both Claude Code and Codex — both use CLI/curl, not MCP
