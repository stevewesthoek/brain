# Tools

Utility scripts and wrappers for local workflows on this machine.

## Contents

- `scripts/` — workflow and utility scripts used on this machine
- `codex-review.sh` — wrapper for Codex second-opinion reviews per the global policy in `~/.claude/CLAUDE.md`
- `n8n-api.sh` — wrapper for the live `n8n.prochat.tools` Public API using local credentials from `~/.config/n8n/.env`
- `../operations/system-configs/bin/hetzner-cli` — wrapper for the Hetzner Cloud CLI using local credentials from `~/.config/hetzner/.env` or native `hcloud` contexts
- `scripts/backup-n8n.sh` — exports live n8n credentials and workflows from the Dokploy-hosted container into the gitignored local backup path
- `scripts/run-n8n-backup-schedule.sh` — daily scheduler guard for the n8n backup job using Europe/Lisbon cutoff logic
- `scripts/office-nightly-scheduler.sh` — serialized nightly batch runner for the Office Mac (`stb` batch -> `n8n` backup -> Claude cleanup)
- `scripts/render-office-scheduler-report.sh` — renders a markdown snapshot of the latest nightly scheduler state and durations to `runtime/local/office-scheduler/latest-run.md`
- `scripts/brain-compress.mjs` — explicit reversible compression for large JSON, logs, and text; stores originals under `~/.brain/cache/compression/`
- `scripts/brain-learn-failures.mjs` — dry-run report generator for recurring session failures; supports `/learner` promotion without writing agent config
- `discover-capabilities.mjs` — shared read-only natural-language inventory for skills, CLIs, MCP servers, profiles, and runbooks
- `check-cli-access-health.mjs` — redacted live checks that separate PATH availability from CLI authentication/session readiness; supports `--write --notify`
- `runtime-profile-manager.mjs` — account-agnostic, CLI-only Codex runtime-profile list/doctor/create/config-materialize/login-handoff/launch plans; configuration is profile-local and Brain-owned, while auth and runtime state remain Codex-owned
- `codex-cli-pilot.mjs` — machine-checkable operator-assisted two-profile plan/check/acceptance proof with exact-profile ownership gates; unrelated global processes and the shared default root are not admission gates
- `runtime-profile-manager/codex-app-server-observer.mjs` — bounded profile-local `account/read(refreshToken=false)` observation with allowlisted redaction; never reads auth files or returns provider secrets
- `runtime-profile-manager/codex-webgpt-adapter.mjs` — read-only v5.0.2 source analysis for WebGPT production/DEV boundaries and route isolation; it does not start or mutate WebGPT
- `scripts/runtime-profiles` — discoverable wrapper for the Codex runtime-profile manager
- `scripts/cli-access-health` — discoverable management wrapper for the central redacted access-health check
- `scripts/cli-access-health-watch.sh` — LaunchAgent runner for deduplicated 15-minute access-health notifications
- `validate-agent-capability-onboarding.mjs` — repository-wide onboarding consistency gate
- `scripts/azure-inventory.sh` — exports a machine-readable inventory of Azure subscriptions, resource groups, and resources for all logged-in Azure accounts
- `scripts/sync-ai-skills.mjs` — syncs active shared skills from `ai/skills/active/` to all configured AI/IDE tool consumers (Claude Code, Codex, Gemini, Cursor, Kiro, Antigravity); run after installing or activating any skill

## Rule

`scripts/` contains machine-specific helpers and should not be deleted without checking whether they are still in active use. See `brain/CLAUDE.md` under "Do not break".



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
