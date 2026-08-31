# Tools

Utility scripts and wrappers for local workflows on this machine.

## Contents

- `scripts/` — workflow and utility scripts used on this machine
- `codex-review.sh` — wrapper for Codex second-opinion reviews per the global policy in `~/.claude/CLAUDE.md`
- `n8n-api.sh` — wrapper for the live `n8n.prochat.tools` Public API using local credentials from `~/.config/n8n/.env`
- `../operations/system-configs/bin/hetzner-cli` — wrapper for the Hetzner Cloud CLI using local credentials from `~/.config/hetzner/.env` or native `hcloud` contexts
- `scripts/backup-n8n.sh` — exports live n8n credentials and workflows from the Dokploy-hosted container into the gitignored local backup path
- `scripts/run-n8n-backup-schedule.sh` — manual/approved n8n backup wrapper; the registry entry is blocked/disabled
- `scripts/office-nightly-scheduler.sh` — retained legacy compatibility/rollback wrapper; it is not the installed LaunchAgent target
- `scripts/brain-scheduler-runner.mjs` — canonical LaunchAgent runner; executes only Active report-only jobs from `operations/specs/typed-scheduler-jobs.json`
- `scripts/render-office-scheduler-report.sh` — renders the Brain Scheduler markdown snapshot to `runtime/local/office-scheduler/latest-run.md`
- `scripts/brain-compress.mjs` — explicit reversible compression for large JSON, logs, and text; stores originals under `~/.brain/cache/compression/`
- `scripts/brain-learn-failures.mjs` — dry-run report generator for recurring session failures; supports `/learner` promotion without writing agent config
- `scripts/azure-inventory.sh` — exports a machine-readable inventory of Azure subscriptions, resource groups, and resources for all logged-in Azure accounts
- `scripts/sync-ai-skills.mjs` — syncs active shared skills from `ai/skills/active/` to all configured AI/IDE tool consumers (Claude Code, Codex, Gemini, Cursor, Kiro, Antigravity); run after installing or activating any skill

## Rule

`scripts/` contains machine-specific helpers and should not be deleted without checking whether they are still in active use. See `brain/CLAUDE.md` under "Do not break".

For scheduler identity, lifecycle, receipts, troubleshooting, and deployment
procedure, use [the canonical runbook](../operations/runbooks/brain-scheduler.md)
and [the current production state](../operations/runbooks/brain-scheduler-current-state.md).



## Graphify orchestration

Run the report-only Graphify orchestrator preflight from the Brain repo root.

```bash
cd /Users/Office/Repos/stevewesthoek/brain
npm run graphify:preflight -- --repo /Users/Office/Repos/stevewesthoek/mind --profile mind-knowledge
npm run graphify:preflight -- --repo /Users/Office/Repos/stevewesthoek/brain --profile brain-runtime
```

Fixed smoke-test commands also run from the Brain repo root:

```bash
cd /Users/Office/Repos/stevewesthoek/brain
npm run graphify:preflight:mind
npm run graphify:preflight:brain
```

This preflight validates the selected repo profile and expected Graphify outputs. It does not run Graphify, call AI Model Selector, or modify the target repo.
