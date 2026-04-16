# CLAUDE.md — brain

## Purpose

Claude Code instructions for the `brain` repo — the central source of truth for personal config, skills, and operations.

## Session lifecycle

1. **Start** — If `.ai/current.md` exists in the target repo, run `/handoff resume`.
2. **Work** — Route by cost (Haiku → Sonnet → Opus → Codex). Use skills only when they add clear, measurable value over doing the task directly.
3. **End** — Run `/handoff pause`. If a non-obvious pattern was solved, run `/learner`.

`.ai/current.md` is the recovery point (auto-written by Stop hook). `decision-log.md` is durable — commit before switching devices.

## Universal capability install

Before installing ANY skill, CLI, or MCP server: run `/brain-universal-capability-install`. All three engines (Claude, Codex, Gemini) must be configured simultaneously.

## Workspace rules

1. Do not work in brain root unless the task is about the brain repo itself.
2. Project work: start in the target repo under `~/Repos/`.
3. Claude/system maintenance: `brain/operations/system-configs/claude`.
4. Skill maintenance: `brain/ai/skills`.

## Repo layout

Local repos at `~/Repos/` by GitHub account:

- `prochatdemo/` — demos
- `prochattools/` — tools, SaaS, clients, ops (`boilerplates/`, `clients/`, `ops/`, `saas/`, `waas/`, `web/`)
- `stevewesthoek/` — personal (this repo)
- `yeshuaacademy/` — Yeshua Academy

## Repo structure

| Directory | Purpose |
|-----------|---------|
| `ai/skills/` | Skill management (active symlinks → vendors/custom) |
| `tools/scripts/` | Automation scripts. See runbooks for per-script docs. |
| `operations/system-configs/` | Global tool configs, symlinked from home directory |
| `operations/runbooks/` | Procedures for tools and workflows |
| `operations/accounts/` | Credential metadata, billing, inventories |
| `operations/deploy/` | Deployment configs (Dokploy) |
| `tools/firecrawl/` | Local on-demand Firecrawl: docker-compose, wrapper script, logs |
| `operations/google-ads/` | Google Ads config, data, and reports |
| `docs/` | Reference documentation (google-ads, standards) |
| `vault/` | Obsidian-managed notes |
| `organisations/` | Brand truth, positioning, playbooks |
| `projects/` | Project context, specs, execution docs |
| `personal/` | Profile, writing style, values |

## Reference docs

For credential conventions, see `docs/api-standards.md`. For testing/QA procedures, see `docs/testing.md`. For deployment rules, see `docs/deploy.md`. For model tracking and cost transparency, see `docs/model-tracking-reference.md`.

## Symlink map (home → brain)

| Home path | Target |
|-----------|--------|
| `~/.claude` | `operations/system-configs/claude/` |
| `~/.codex` | `operations/system-configs/codex/` |
| `~/.gemini` | `operations/system-configs/gemini/` |
| `~/.kiro` | `operations/system-configs/kiro/` |
| `~/.docker` | `operations/system-configs/docker/` |
| `~/.config/starship.toml` | `operations/system-configs/starship/starship.toml` |
| `~/.config/ghostty/config` | `operations/system-configs/ghostty/config` |
| `~/.config/git/ignore` | `operations/system-configs/git/ignore` |

`~/.claude.json` is NOT symlinked (contains secrets). Template: `operations/system-configs/claude/claude.json.template`.

## Credentials

Master index (metadata only): `operations/accounts/credentials-index.md`. Run `sync-credentials` to scan for new `.env` files. A PostToolUse hook auto-runs it when `.env` files are written.

## Decision log

`operations/decision-log.md` — confirmed decisions only.

## Model tracking

Claude Code model routing is now **fully transparent** — your status line shows which model is running and why in real-time.

- **Status line display:** Dynamic badges show escalations, modes, preprocessing (`↑`, `⊙`, `◊`, `⚙`, etc.)
- **Tracking file:** `~/.claude/model-tracking.json` — readable state of current model + reason
- **Cost awareness:** See when tasks escalate from Haiku → Sonnet → Opus
- **Runbook:** `operations/runbooks/model-tracking.md` — full operational guide
- **Reference:** `docs/model-tracking-reference.md` — user-facing quick reference

This system runs automatically via hooks in `~/.claude/settings.json`. No user action needed — just look at your status line.

## Local LLMs

**QWEN 2.5 coder 14b** — local, free alternative to Claude/Codex. Ollama-based, runs on port 11435 (separate instance).

- **Start service:** `qwen-service start`
- **Stop service:** `qwen-service stop`
- **Check status:** `qwen-service status`
- **CLI:** `qwen "your prompt"` or `qwen` for interactive mode
- **Integration:** Added to `repos` and `sessions` pickers alongside Claude, Codex, Gemini
- **Configuration:** 
  - Ollama binary: `/opt/homebrew/opt/ollama/bin/ollama` (Homebrew)
  - Models dir: `~/.ollama-qwen`
  - Service script: `tools/scripts/qwen-service.sh`
  - CLI wrapper: `tools/scripts/qwen`
  - LaunchD service: `operations/system-configs/launchd/com.office.qwen-ollama.plist`

**Auto-start (optional):**
```bash
ln -sf ~/Repos/stevewesthoek/brain/operations/system-configs/launchd/com.office.qwen-ollama.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.office.qwen-ollama.plist
```

## Do not break

- `~/.claude` → `brain/operations/system-configs/claude`. Do not delete or restructure.
- `~/.claude/skills` → `brain/ai/skills/active`. Keep `active/` as symlinks only.
- `~/.claude/model-tracking.json` — Do not delete. Hooks depend on it.
- `~/.claude/hooks/model-*.sh` — Model tracking hooks. Do not delete.
- `~/.claude/settings.json` — Model tracking hooks registered here in UserPromptSubmit, PostToolUse, Stop sections.
- `~/.codex` → `brain/operations/system-configs/codex`. Do not delete or restructure.
- `~/.gemini` → `brain/operations/system-configs/gemini`. Do not delete or restructure.
- `~/.kiro` → `brain/operations/system-configs/kiro`. Do not delete or restructure.
- `~/.docker` → `brain/operations/system-configs/docker`. Docker Desktop fails if target is missing.
- `~/.config/ghostty/config`, `~/.config/git/ignore`, `~/.config/starship.toml` are symlinks → brain. Do not delete sources.
- `~/.ollama-qwen` — QWEN models directory. Do not delete.
- `tools/scripts/qwen-service.sh`, `tools/scripts/qwen` — QWEN CLI and service management.
- `tools/scripts/` — check usage before deleting any script.
- `~/Library/LaunchAgents/com.office.nightly-scheduler.plist` may symlink into brain. Keep repo file as source of truth.
