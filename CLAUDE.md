# CLAUDE.md — brain

## Purpose
Claude Code instructions for the `brain` repo — the central source of truth for personal config, skills, and operations.

## Session lifecycle

Every session follows this flow — know where you are in it at all times:

1. **Start** — Check for `.ai/current.md` in the target repo. If it exists, run `/handoff resume` to restore goal, status, files touched, and next steps without re-reading everything.
2. **Work** — Route by task weight (Haiku → Sonnet → Opus → Codex). Track what's done and what's pending. Prefer surgical changes; don't widen scope.
3. **End** — Run `/handoff pause` to compress session state. If something non-obvious was solved (tricky bug, codebase gotcha, workaround), run `/learner` to extract it as a reusable skill.

**Resilience:** `.ai/current.md` is the recovery point if a session breaks mid-task. The Stop hook writes it automatically — no manual action needed.
**Cross-device continuity:** `.ai/current.md` is ephemeral and gitignored in this repo — it's auto-regenerated each session. `decision-log.md` is durable and in git; commit it before switching devices.
**Skills:** Only use a skill if it adds clear value. If two skills overlap, merge or delete. No skill for the sake of a skill.

---

## Workspace rules

1. Do not use the root of `brain` as the default working directory unless the task is explicitly about maintaining the `brain` repo itself.
2. For project work, start in the specific target repo under `Repos/`.
3. For Claude/system maintenance, start in `brain/operations/system-configs/claude`.
4. For shared skill maintenance, start in `brain/ai/skills`.

## Repo layout awareness

Local repos live at `~/Repos/` organized by GitHub account / ownership group:

- `prochatdemo/` — demo projects
- `prochattools/` — tools, SaaS, client work, ops
  - `boilerplates/` — product and studio boilerplates
  - `clients/` — client repos
  - `ops/` — operational tools (e.g. freeresend, probot)
  - `saas/` — SaaS products (e.g. proofly, xgrow, statuslink)
  - `waas/` — white-label-as-a-service projects
  - `web/` — web properties (e.g. says-the-bible, prochat, cedula)
- `stevewesthoek/` — personal repos (this one)
- `yeshuaacademy/` — Yeshua Academy projects

When working across repos, treat each Git repo independently. Do not apply one repo's instructions to another.

## Brain repo structure

- `ai/skills/` — skill management (active symlinks, vendors, custom)
- `tools/scripts/` — utility and workflow scripts
  - `brain-auto-router.py` — Auto-Router automation (runs every 1 minute via cron; routes inbox notes based on decision tree). See `operations/runbooks/brain-auto-router.md` for full docs.
  - `brain-project-decomposer.py` — Project Decomposer automation (runs every 5 minutes via cron; uses Gemini to decompose projects into atomic tasks). See `operations/runbooks/brain-project-decomposer.md` for full docs.
  - `brain-automate-verify.sh` — Post-reboot/reinstall verification script (run after OS updates to confirm all systems are working)
  - `repos.sh` — unified repo picker (`repos` shell command): pick Claude or Codex, then pick a repo to open
  - `sessions.sh` — unified session picker (`sessions` shell command): pick Claude or Codex, then resume a session
  - `backup-n8n.sh` — server-side export of live n8n credentials/workflows into the gitignored local backup folder
- `tools/n8n-api.sh` — wrapper for the live `n8n.prochat.tools` Public API (for manual n8n workflow management)
- `operations/system-configs/` — global tool configs, all symlinked from home directory
- `operations/runbooks/` — documentation for key tools and workflows
  - `brain-auto-router.md` — Python Auto-Router script, cron scheduling, decision tree logic, troubleshooting
  - `brain-project-decomposer.md` — Python Project Decomposer script, Gemini integration, task creation, cron scheduling
  - `playwright.md` — Playwright CLI usage, patterns, and nightly scheduler integration
  - `notebooklm.md` — NotebookLM CLI v0.3.4, research workflows, batch operations, nightly scheduler integration
- `operations/decision-log.md` — confirmed decisions for the brain repo itself

### Per-repo AI memory (not in brain itself)

Each project repo uses a conventional `ai/` directory for Claude handoff memory:
- `.ai/current.md` — short-term resumable session handoff (overwritten each session)
- `.ai/handoffs/` — archive of timestamped past handoffs
- `decision-log.md` — long-term durable decisions only (append-only, separate from handoffs)

### Symlink map (home → brain)

| Home path | Points to |
|-----------|-----------|
| `~/.claude` | `operations/system-configs/claude/` |
| `~/.codex` | `operations/system-configs/codex/` |
| `~/.gemini` | `operations/system-configs/gemini/` |
| `~/.kiro` | `operations/system-configs/kiro/` |
| `~/.config/starship.toml` | `operations/system-configs/starship/starship.toml` |
| `~/.config/ghostty/config` | `operations/system-configs/ghostty/config` |
| `~/.config/git/ignore` | `operations/system-configs/git/ignore` |
| `~/.docker` | `operations/system-configs/docker/` |

`~/.claude.json` (Claude Code's MCP registrations) is **not** symlinked — it contains secrets. A safe template lives at `operations/system-configs/claude/claude.json.template`.

Local machine secrets that are intentionally not in-repo:
- `~/.config/dokploy/.env`
- `~/.config/n8n/.env`

## Credentials

All API keys, tokens, and credentials are indexed (no values) at `operations/accounts/credentials-index.md`.
Run `sync-credentials` to scan `~/.config/` for new `.env` files and append untracked entries.
A PostToolUse hook auto-runs `sync-credentials` whenever Claude writes or edits a `.env` file.

## Decision log

The decision log for this repo lives at `operations/decision-log.md`.
Use it for confirmed architecture and workflow decisions only.

## Do not break

- `~/.claude` is a directory-level symlink → `brain/operations/system-configs/claude`. Do not delete or restructure that folder.
- `~/.claude/skills` is a symlink → `brain/ai/skills/active`. Keep `active/` as symlinks only; do not put raw skill folders directly in `active/`.
- `~/.codex` is a directory-level symlink → `brain/operations/system-configs/codex`. Do not delete or restructure that folder.
- `~/.gemini` is a directory-level symlink → `brain/operations/system-configs/gemini`. Do not delete or restructure that folder.
- `~/.kiro` is a directory-level symlink → `brain/operations/system-configs/kiro`. Do not delete or restructure that folder.
- `~/.docker` is a directory-level symlink → `brain/operations/system-configs/docker`. Do not delete or restructure that folder — Docker Desktop will fail to start if the target doesn't exist.
- `~/.config/ghostty/config`, `~/.config/git/ignore`, `~/.config/starship.toml` are individual file symlinks → brain. Do not delete the source files in brain.
- `tools/scripts/` contains workflow and setup scripts that are used on this machine — do not delete without checking if they are still in use.
- `~/Library/LaunchAgents/com.office.nightly-scheduler.plist` may be a symlink into `brain/operations/system-configs/launchagents/com.office.nightly-scheduler.plist`. Keep the repo file as the source of truth.
