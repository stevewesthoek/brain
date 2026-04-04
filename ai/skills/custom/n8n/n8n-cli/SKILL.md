---
name: n8n
description: Use when the user asks to work with self-hosted n8n without using the UI. Default to the live n8n Public API for workflow and credential automation on `n8n.prochat.tools`, and use the official `n8n` CLI or Dokploy only for break-glass admin, Docker-container, or recovery operations.
---

# n8n

## What this skill is for
Help Claude and Codex create and manage real workflows on the live self-hosted n8n instance at `https://n8n.prochat.tools` without requiring manual UI work.

Default interface order:
1. n8n Public API on the live server
2. Local wrapper script `brain/tools/n8n-api.sh` or `~/.local/bin/n8n-api`
3. Official `n8n` CLI for local or container-only admin tasks
4. Dokploy only for deployment or container lifecycle checks

## Use this skill when
- Creating workflows from a prompt without opening the n8n UI
- Updating, activating, deactivating, or inspecting workflows on the live server
- Creating credentials through the Public API when the integration supports non-interactive secrets
- Inspecting credential schemas, projects, and variables
- Running admin exports, imports, audits, or recovery actions on the self-hosted instance

## Do not use this skill for
- Browser-only n8n Cloud management
- UI-based manual editing when the user asked for full automation
- OAuth integrations that require a fresh interactive consent screen unless the user already has reusable auth material

## Safety rules
1. **Use the Public API by default.** For live workflow CRUD, prefer `~/.local/bin/n8n-api` over `docker exec` or the local npm-installed CLI.
2. **Treat local auth files as secrets.** Never print or commit `~/.config/n8n/.env` or `~/.n8n/config`.
3. **Confirm before destructive admin actions.** Imports, user resets, LDAP reset, DB revert, license clear, or community-node uninstalls still require confirmation.
4. **Export before risky changes.** Backup workflows before large edits or migrations.
5. **Know the OAuth limitation.** Fully headless automation works best for API-key, token, and service-account credentials. Fresh OAuth grants may still require one interactive consent flow.

## Live instance
- Base app URL: `https://n8n.prochat.tools`
- Public API base URL: `https://n8n.prochat.tools/api/v1`
- Webhook base URL: `https://n8n.prochat.tools/webhook`
- Host platform: Dokploy compose app `n8n` in the `Ops` project
- Runtime: Docker Compose on Dokploy

## Local auth and wrappers

### Local auth file
Stored locally only:
```bash
~/.config/n8n/.env
```

Expected values:
```bash
N8N_API_URL=https://n8n.prochat.tools/api/v1
N8N_API_KEY=...
N8N_WEBHOOK_URL=https://n8n.prochat.tools/webhook
```

### Stable wrapper
Primary machine interface:
```bash
~/.local/bin/n8n-api
```

Repo source:
```bash
brain/tools/n8n-api.sh
```

### Backup script
Local recovery export:
```bash
brain/tools/scripts/backup-n8n.sh
```

Output location:
```bash
brain/operations/automations/n8n/n8n_backup/
```

Common commands:
```bash
~/.local/bin/n8n-api list-workflows
~/.local/bin/n8n-api get-workflow <id>
~/.local/bin/n8n-api create-workflow workflow.json
~/.local/bin/n8n-api update-workflow <id> workflow.json
~/.local/bin/n8n-api delete-workflow <id>
~/.local/bin/n8n-api activate-workflow <id>
~/.local/bin/n8n-api credential-schema <credentialTypeName>
~/.local/bin/n8n-api create-credential credential.json
~/.local/bin/n8n-api list-projects
~/.local/bin/n8n-api list-variables
```

## Recommended workflow for prompt-to-workflow automation
```bash
# 1. Inspect existing state
~/.local/bin/n8n-api list-projects
~/.local/bin/n8n-api list-credentials
~/.local/bin/n8n-api list-workflows

# 2. Resolve or create credentials
~/.local/bin/n8n-api credential-schema <credentialTypeName>
~/.local/bin/n8n-api create-credential credential.json

# 3. Create or update the workflow from JSON
~/.local/bin/n8n-api create-workflow workflow.json
# or
~/.local/bin/n8n-api update-workflow <id> workflow.json

# 4. Activate it
~/.local/bin/n8n-api activate-workflow <id>
```

## Automation guidance for Claude/Codex
When the user says "build a workflow in n8n":
1. Infer the target integration and trigger/action pattern from the prompt.
2. Inspect the exact credential schema via `credential-schema`.
3. Generate complete workflow JSON.
4. Create or update the workflow through `~/.local/bin/n8n-api`.
5. Activate the workflow if requested or clearly implied.
6. If the flow depends on a brand-new OAuth grant, stop only at the minimum consent blocker and explain exactly what interactive step is still needed.

## Public API references
- Live docs: `https://n8n.prochat.tools/api/v1/docs/`
- Auth model: `X-N8N-API-KEY`

## Official n8n CLI
The official package is still installed locally and is useful for local/dev or break-glass admin:
```bash
n8n --version
n8n --help
```

For Docker-hosted server-side admin commands:
```bash
docker exec -u node -it <n8n-container-name> n8n --help
docker exec -u node -it <n8n-container-name> n8n export:workflow --backup --output=backups/latest/
docker exec -u node -it <n8n-container-name> n8n audit
```

## Break-glass admin examples
```bash
docker exec -u node -it <n8n-container-name> n8n user-management:reset
docker exec -u node -it <n8n-container-name> n8n ldap:reset
docker exec -u node -it <n8n-container-name> n8n db:revert
```

## Notes
- The local npm-installed `n8n` binary version does not need to match the server version for Public API use.
- The live server currently supports workflow CRUD and credential schema lookup through the Public API.
- On the current API key/build, `GET /projects`, `GET /variables`, and `GET /credentials` are not available for routine automation, so do not depend on them in the default flow.
- Use Dokploy to inspect or redeploy the n8n container, not to manage workflow objects inside n8n.
- Existing credentials and workflows can still be backed up server-side through `docker exec ... n8n export:*`, and the repo-local wrapper for that is `brain/tools/scripts/backup-n8n.sh`.
