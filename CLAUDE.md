# CLAUDE.md — brain

## Purpose
Claude Code instructions for the `brain` repo — the central source of truth for personal config, skills, and operations.

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
- `tools/scripts/` — utility and workflow scripts (boilerplate sync, cleanup helpers, etc.)
- `operations/system-configs/` — global tool configs, all symlinked from home directory
- `operations/decision-log.md` — confirmed decisions for the brain repo itself

### Symlink map (home → brain)

| Home path | Points to |
|-----------|-----------|
| `~/.claude` | `operations/system-configs/claude/` |
| `~/.codex` | `operations/system-configs/codex/` |
| `~/.kiro` | `operations/system-configs/kiro/` |
| `~/.config/starship.toml` | `operations/system-configs/starship/starship.toml` |
| `~/.config/ghostty/config` | `operations/system-configs/ghostty/config` |
| `~/.config/git/ignore` | `operations/system-configs/git/ignore` |

`~/.claude.json` (Claude Code's MCP registrations) is **not** symlinked — it contains secrets. A safe template lives at `operations/system-configs/claude/claude.json.template`.

## Decision log

The decision log for this repo lives at `operations/decision-log.md`.
Use it for confirmed architecture and workflow decisions only.

## Do not break

- `~/.claude` is a directory-level symlink → `brain/operations/system-configs/claude`. Do not delete or restructure that folder.
- `~/.claude/skills` is a symlink → `brain/ai/skills/active`. Keep `active/` as symlinks only; do not put raw skill folders directly in `active/`.
- `~/.codex` is a directory-level symlink → `brain/operations/system-configs/codex`. Do not delete or restructure that folder.
- `~/.kiro` is a directory-level symlink → `brain/operations/system-configs/kiro`. Do not delete or restructure that folder.
- `~/.config/ghostty/config`, `~/.config/git/ignore`, `~/.config/starship.toml` are individual file symlinks → brain. Do not delete the source files in brain.
- `tools/scripts/` contains workflow and setup scripts that are used on this machine — do not delete without checking if they are still in use.
