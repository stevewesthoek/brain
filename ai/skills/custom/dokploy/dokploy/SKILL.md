---
name: dokploy
description: "Use when the user asks to deploy, manage, or inspect applications on the Dokploy server. Uses direct Dokploy API (curl) or GitHub Actions workflows. Server: https://dokploy.prochat.tools"
---

# Dokploy

## What this skill is for
Help manage deployments, applications, databases, and projects on the self-hosted Dokploy server at `https://dokploy.prochat.tools` — via direct **REST API** (curl, GitHub Actions) or programmatic operations.

For discovery and inspection tasks, use the **direct Dokploy API** with curl (most reliable). The packaged `dokploy-cli` binary exists but has compatibility issues with `verify` and `list` commands — use direct API instead. Do not use or reference any MCP server for Dokploy.

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

## Layer 1 — Direct API (all discovery and scripted operations)

The direct Dokploy API via curl is the most reliable method for inspection and scripted operations:
```bash
# List all projects and apps
source ~/.config/dokploy/.env
curl -sS "$DOKPLOY_URL/project.all" \
  -H "x-api-key: $DOKPLOY_API_KEY" | python3 -m json.tool | head -80

# Get specific app details
source ~/.config/dokploy/.env
curl -sS "$DOKPLOY_URL/application.one?applicationId=<app-id>" \
  -H "x-api-key: $DOKPLOY_API_KEY" | python3 -m json.tool

# Deploy an application
source ~/.config/dokploy/.env
curl -sS -X POST "$DOKPLOY_URL/application.deploy" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"applicationId": "<app-id>", "title": "Deploy via API", "description": "Triggered by agent"}'
```

### Packaged CLI status

The `~/.local/bin/dokploy-cli` binary (v0.2.8) exists but has compatibility issues:
- `dokploy-cli verify` returns 401 Unauthorized
- `dokploy-cli project list` returns 401 Unauthorized
- **Do not rely on CLI for discovery tasks.** Use direct API calls instead.

## Layer 2 — GitHub Actions (automated CI/CD)

For CI/CD deployments that trigger automatically on push:

Reusable workflow template: `brain/operations/deploy/dokploy-image-deploy.yml`

Required GitHub secrets per repo:
- `DOKPLOY_API_KEY` — set once from `~/.config/dokploy/.env` (do not commit)
- `DOKPLOY_APP_ID` — found via direct API call or Dokploy dashboard UI

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

## Recommended workflow — manual redeploy (without code change)

```bash
source ~/.config/dokploy/.env
curl -sS -X POST "$DOKPLOY_URL/application.deploy" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "<your-app-id>",
    "title": "Manual redeploy",
    "description": "Triggered via API"
  }'
```

## Reference

- **Credentials file**: `~/.config/dokploy/.env` (local, never committed)
  - Contains: `DOKPLOY_API_KEY`, `DOKPLOY_URL`, `DOKPLOY_API_HEADER`, `GHCR_DOKPLOY_PULL_PAT`
  - Single source of truth — do not copy API key into repos, scripts, or docs
- **Dokploy server**: `https://dokploy.prochat.tools`
- **API base**: `https://dokploy.prochat.tools/api`
- **CLI binary**: `~/.local/bin/dokploy-cli` (v0.2.8) — installed but unreliable for verify/list
- **Runbook**: `operations/runbooks/dokploy.md` (deployment pipeline, app setup)
- **App inventory**: See `operations/runbooks/dokploy.md` for Dokploy app IDs
- **CLI diagnostics**: See `operations/infrastructure/CLI_ACCESS_REPAIR.md`
- **Family Finance constraint**: Local-only app — must not be added to Dokploy (app deleted 2026-05-03)

This skill applies to both Claude Code and Codex — both use direct API, not MCP or packaged CLI.
