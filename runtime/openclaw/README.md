# OpenClaw Workspace

This folder is the dedicated OpenClaw workspace for the Brain repo.

## Why it exists

- keeps OpenClaw bootstrap files out of the repo root
- gives OpenClaw one clear home
- still exposes the canonical Brain folders through symlinks
- keeps OpenClaw bootstrap files thin instead of duplicating the real docs

## Expected workspace files

- `AGENTS.md`
- `SOUL.md`
- `USER.md`
- `IDENTITY.md`
- `TOOLS.md`
- `MEMORY.md`
- `HEARTBEAT.md`
- `memory/`
- `skills/`

These files are bootstrap/control files for OpenClaw.
They should point to canonical repo docs instead of copying personal or business truth.

## Linked canonical folders

This workspace links to:
- `personal/`
- `organisations/`
- `projects/`
- `ai/`
- `operations/`
- `skills/`

## Source-of-truth rule

- `personal/`, `organisations/`, `projects/`, `ai/`, `operations/` are canonical
- `skills/` is an alias to `ai/skills/`
- `MEMORY.md` and `memory/` are for durable ProBot memory that does not yet have a better canonical home
- if a fact already belongs in a canonical folder, update it there instead of duplicating it here

## Recommended config

Set OpenClaw workspace to this folder in `~/.openclaw/openclaw.json`.
