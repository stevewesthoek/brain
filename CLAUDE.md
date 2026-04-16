# CLAUDE.md — machine-brain

## Purpose

Claude Code instructions for the `machine-brain` repo — AI infrastructure, system config, and skills. This is part of a split repo structure (see "Repo split" section below).

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

## Repo split

**Two independent repos with symlink connection:**

```
personal-brain/                    ← iOS Obsidian vault (200MB)
  01-inbox/, 02-strategy/, etc.
  kanban.md, home.md
  .obsidian/
  .git/

machine-brain/                     ← AI infrastructure, system config
  ai/skills/
  machine/
  operations/system-configs/       ← symlinked to home (~)
  personal-brain/ → symlink to ../personal-brain/
  .git/
```

**Sync:**
- `personal-brain`: Obsidian Git (iOS + Mac bidirectional)
- `machine-brain`: Development workflow (Mac only, houses AI context)
- Symlink: `machine-brain/personal-brain` → `../personal-brain` (AI agents read vault content)

## Repo structure (machine-brain)

| Directory | Purpose |
|-----------|---------|
| `ai/skills/` | Skill management (active symlinks → vendors/custom) |
| `machine/` | Config, scripts, prompts, software settings |
| `operations/system-configs/` | Global tool configs, symlinked from home directory |
| `operations/runbooks/` | Procedures for tools and workflows |
| `operations/accounts/` | Credential metadata, billing, inventories |
| `operations/deploy/` | Deployment configs (Dokploy) |
| `operations/google-ads/` | Google Ads config, data, and reports |
| `docs/` | Reference documentation (google-ads, standards) |
| `personal-brain/` | Symlink to ../personal-brain (vault for AI context) |
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

**QWEN 2.5 coder 14b** — local, free alternative to Claude/Codex. Ollama-based, runs on port 11435 (separate instance). **Repo-aware with file context support.**

- **Start service:** `qwen-service start`
- **Stop service:** `qwen-service stop`
- **Check status:** `qwen-service status`
- **CLI:**
  - `qwen "your prompt"` — regular query
  - `qwen file:path/to/file "question"` — read file + ask question
  - `qwen @"*.js" "question"` — find files matching pattern + ask
  - `qwen` — interactive mode (supports file syntax too)
- **Integration:** Added to `repos` and `sessions` pickers alongside Claude, Codex, Gemini
- **File context:** ~8000 char limit per query; use when in a repo directory
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

**CRITICAL: Symlink-dependent folders (NEVER MOVE OR DELETE):**
- `operations/system-configs/` (17 symlinks from home ~)
- `tools/scripts/sync-credentials.sh` (→ ~/.local/bin/sync-credentials)
- `tools/n8n-api.sh` (→ ~/.local/bin/n8n-api)
- `ai/skills/custom/apify/` (2 symlinks)
- `personal-brain/` symlink (→ ../personal-brain)

**Symlinks map (home → machine-brain):**
- `~/.claude` → `machine-brain/operations/system-configs/claude`
- `~/.codex` → `machine-brain/operations/system-configs/codex`
- `~/.gemini` → `machine-brain/operations/system-configs/gemini`
- `~/.kiro` → `machine-brain/operations/system-configs/kiro`
- `~/.docker` → `machine-brain/operations/system-configs/docker`
- `~/.ollama-qwen` — QWEN models directory. Do not delete.
- `tools/scripts/qwen-service.sh`, `tools/scripts/qwen` — QWEN CLI and service management.
- `~/.config/ghostty/config`, `~/.config/git/ignore`, `~/.config/starship.toml` are symlinks → machine-brain
- `~/Library/LaunchAgents/com.office.nightly-scheduler.plist` may symlink into machine-brain

**If you touch these symlink folders, it breaks everything:**
- NEVER move `operations/system-configs/`
- NEVER move/delete symlinked scripts
- NEVER change the `personal-brain/` symlink
- NEVER modify any symlink paths
