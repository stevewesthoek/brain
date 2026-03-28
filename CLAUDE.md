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
- `operations/system-configs/` — global tool configs (claude, codex, ghostty, shell)
- `operations/decision-log.md` — confirmed decisions for the brain repo itself

## Decision log

The decision log for this repo lives at `operations/decision-log.md`.
Use it for confirmed architecture and workflow decisions only.

## Do not break

- `~/.claude` is a directory-level symlink pointing to `brain/operations/system-configs/claude`. Do not delete or restructure that folder.
- `~/.claude/skills` is a symlink pointing to `brain/ai/skills/active`. Keep `active/` as symlinks only.
- Do not put raw skill folders directly in `active/`.
