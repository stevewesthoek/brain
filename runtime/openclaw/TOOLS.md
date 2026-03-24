# Tools and Workspace Notes

## Workspace Shape

This OpenClaw workspace is intentionally separate from the repo root.

The canonical Brain content is exposed here through symlinks:
- `personal/`
- `organisations/`
- `projects/`
- `ai/`
- `operations/`
- `skills/` (cross-tool shared skills, alias to `ai/skills/`)

## Brain Context — Always Loaded

The workspace root `AGENTS.md` instructs OpenClaw to read the Brain bootstrap files at session start.
This means ProBot always has full Brain context without needing a dedicated skill.

Files auto-read every session:
1. `runtime/openclaw/SOUL.md`
2. `runtime/openclaw/USER.md`
3. `runtime/openclaw/IDENTITY.md`
4. `runtime/openclaw/TOOLS.md`
5. `runtime/openclaw/restricted-repos.md`
6. `runtime/openclaw/MEMORY.md`
7. `personal/profile.md`
8. `personal/style.md`
9. `organisations/prochat/README.md`
10. `organisations/prochat/growth/posting.md`
11. Recent `runtime/openclaw/memory/` files

The old `brain` skill was removed because this auto-loading makes it obsolete.

## OpenClaw Active Skills

OpenClaw discovers active skills from:
`~/.openclaw/workspace/skills/`

That folder contains flat namespaced symlinks pointing into the Brain repo:

| Workspace symlink | Canonical Brain path | Skill name |
|---|---|---|
| `skills/google-calendar` | `runtime/openclaw/active-skills/google/calendar` | `google_calendar` |
| `skills/x-comment` | `runtime/openclaw/active-skills/x/comment` | `x_comment` |
| `skills/x-reply` | `runtime/openclaw/active-skills/x/reply` | `x_reply` |
| `skills/x-schedule` | `runtime/openclaw/active-skills/x/schedule` | `x_schedule` |
| `skills/x-tweets` | `runtime/openclaw/active-skills/x/tweets` | `x_tweets` |

### Structure rules

- **Brain repo** = canonical source of truth for all skill content
- **Workspace skills/** = execution layer only (flat symlinks)
- **active-skills/** is organized by domain (`google/`, `x/`)
- **Workspace symlinks** are flat with namespaced names (e.g. `x-comment`)
- Do not create real directories in `workspace/skills/` — always symlink to Brain
- Do not nest skill folders in `workspace/skills/` — OpenClaw expects a flat layout

### Separate from shared skills

- `runtime/openclaw/skills` → `ai/skills/` (cross-tool shared skills: notebooklm, ui-ux-pro-max, web-design)
- `runtime/openclaw/active-skills/` (OpenClaw-specific active skills)

These are intentionally separate. Shared skills are tool-agnostic. Active skills are OpenClaw-specific.

## Interpretation Rules

- `skills/` (in runtime/openclaw) is the shared skill library alias to `ai/skills/`.
- `active-skills/` (in runtime/openclaw) is the OpenClaw-specific skill source.
- `personal/`, `organisations/`, and `projects/` contain durable context.
- `operations/` contains runbooks, scripts, and curated system config.
- `runtime/cache/` and `runtime/local/` are not canonical truth.

## OpenClaw Notes

- Standard workspace files live in this folder.
- Optional OpenClaw files like `BOOT.md` and `BOOTSTRAP.md` are intentionally omitted unless needed.
- The workspace root (`~/.openclaw/workspace`) is NOT a Git repo. The Brain repo is the only Git-backed store.
- Repo-local Git identity: `ProBot <info@prochat.tools>`
