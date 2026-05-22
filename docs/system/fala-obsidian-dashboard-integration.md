# Fala Obsidian Dashboard Integration

## Status

Fala is registered in the Brain Core local-app registry consumed by the Brain Console Obsidian plugin.

Registry entry:

```text
operations/infrastructure/local-apps.json
```

Canonical app:

- Name: `Fala`
- Repo: `/Users/Office/Repos/prochattools/saas/fala`
- App URL: `http://localhost:3050`
- Health URL: `http://localhost:3050/api/health`
- Start command: `bash scripts/dev/start-local.sh`
- Stop command: `bash scripts/dev/stop-local.sh`
- Database: external local PostgreSQL / OrbStack, `fala` database on host port `5432`

## Dashboard contract

Fala owns its repo-local dashboard contract in:

```text
/Users/Office/Repos/prochattools/saas/fala/OBSIDIAN_DASHBOARD_CONTRACT.md
```

The dashboard can safely call this Fala command for read-only metadata:

```bash
npm run dashboard:status
```

That command returns JSON with:

- desktop URL
- LAN phone URL candidates
- safe command labels
- local AI provider flags
- model-router fallback flags
- router-owned Amazon Bedrock policy state

## Runtime model policy

Fala should prefer local Ollama for learner runtime by default.

Paid fallback should flow through the model router, not direct provider APIs from Fala. Amazon Bedrock credentials, model selection, cost policy, and paid fallback routing belong behind the router.

Codex CLI and similar coding agents are not learner-runtime chat providers. They may be used only for supervised development or offline automation jobs with a separate approval model.

## Safety

- Brain Console must not execute arbitrary shell entered from the UI.
- Brain Console start/stop buttons call Brain Core allowlisted local-app actions only.
- Fala secrets stay in Fala `.env.local` or approved local secret storage, not in the Brain registry.
- Fala database and Ollama remain local prerequisites; the dashboard may surface readiness but should not invent credentials.
