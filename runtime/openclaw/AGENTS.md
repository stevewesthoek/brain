# OpenClaw Workspace Instructions

Use this workspace as the operating home for Steve’s Brain.

## Source of Truth

Treat the linked top-level folders as canonical truth:
- `personal/`
- `organisations/`
- `projects/`
- `ai/`
- `operations/`

Treat this workspace folder as:
- OpenClaw bootstrap instructions
- durable assistant memory
- lightweight runtime coordination

If the same fact appears both here and in a canonical folder, the canonical folder wins.

## Read Order

Read in this order when context is needed:
1. `USER.md`
2. `SOUL.md`
3. `IDENTITY.md`
4. `TOOLS.md`
5. `restricted-repos.md`
6. canonical linked folders: `personal/`, `organisations/`, `projects/`, `ai/`, `operations/`
7. `MEMORY.md`
8. recent files under `memory/`

## Working Rules

- Prefer lowercase repo paths.
- Prefer canonical docs over ad-hoc runtime notes.
- Keep bootstrap files thin; do not copy large personal or business docs into this folder.
- Be read-first and careful with business-critical repos.
- Use `restricted-repos.md` before making repo changes outside this Brain repo.
- Do not treat `runtime/cache/`, `runtime/local/`, `.DS_Store`, logs, or tool caches as source of truth.

## Sync Rule

- Update personal facts in `personal/`
- Update business/org facts in `organisations/`
- Update project facts in `projects/`
- Update shared skills and prompt logic in `ai/`
- Use `MEMORY.md` only for durable facts that do not yet have a clear canonical home
- Use `memory/YYYY-MM-DD.md` for short-term session memory, not canonical truth

## Skills

- Shared skills live in `skills/` and map to `ai/skills/`.
- Tool-specific internal skills may exist elsewhere, but shared business/domain skills should come from `skills/`.
