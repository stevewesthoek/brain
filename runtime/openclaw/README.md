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
- `skills/` (symlink alias to `ai/skills/` — for cross-tool reference only, not an OpenClaw discovery path)
- `active-skills/` (OpenClaw-specific skills, organized by domain)

These files are bootstrap/control files for OpenClaw.
They should point to canonical repo docs instead of copying personal or business truth.

## Active skills

OpenClaw-specific skills live in `active-skills/` organized by domain:

```
active-skills/
├── google/
│   └── calendar/SKILL.md
└── x/
    ├── comment/SKILL.md
    ├── reply/SKILL.md
    ├── schedule/SKILL.md
    └── tweets/SKILL.md
```

Note: the old `brain` skill was removed. Brain context is now auto-loaded every session
via workspace root `AGENTS.md` instructions.

These are loaded by OpenClaw directly via `extraDirs` in `~/.openclaw/openclaw.json`.
`~/.openclaw/workspace/skills/` must remain empty — skills are not exposed via symlinks.

See `TOOLS.md` for the full `extraDirs` config.

## Linked canonical folders

This workspace links to:
- `personal/`
- `organisations/`
- `projects/`
- `ai/`
- `operations/`
- `skills/` (symlink alias to `ai/skills/` — cross-tool reference only)

## Source-of-truth rule

- `personal/`, `organisations/`, `projects/`, `ai/`, `operations/` are canonical
- `skills/` is an alias to `ai/skills/`
- `active-skills/` contains OpenClaw-specific skill definitions backed by this repo
- `MEMORY.md` and `memory/` are for durable ProBot memory that does not yet have a better canonical home
- if a fact already belongs in a canonical folder, update it there instead of duplicating it here

## Workspace root

The OpenClaw workspace root (`~/.openclaw/workspace`) is NOT a Git repo.
The Brain repo at `~/.openclaw/workspace/brain` is the only Git-backed store.
Git identity: `ProBot <info@prochat.tools>` (repo-local).
