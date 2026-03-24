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

Skills live **exclusively in the Brain**. `workspace/skills/` must stay empty — never place skills there.

OpenClaw loads them via `extraDirs` in `~/.openclaw/openclaw.json`, pointing directly at Brain paths:

```json
"skills": {
  "load": {
    "extraDirs": [
      "/home/ubuntu/.openclaw/workspace/brain/runtime/openclaw/active-skills/x",
      "/home/ubuntu/.openclaw/workspace/brain/runtime/openclaw/active-skills/google"
    ]
  }
}
```

### Active skills

| Brain path | Skill name |
|---|---|
| `runtime/openclaw/active-skills/google/calendar` | `google_calendar` |
| `runtime/openclaw/active-skills/x/comment` | `x_comment` |
| `runtime/openclaw/active-skills/x/reply` | `x_reply` |
| `runtime/openclaw/active-skills/x/schedule` | `x_schedule` |
| `runtime/openclaw/active-skills/x/tweets` | `x_tweets` |

### Adding a new skill

1. Create `brain/runtime/openclaw/active-skills/<domain>/<skill-name>/SKILL.md`
2. If the domain isn't already in `extraDirs`, add it to `~/.openclaw/openclaw.json`
3. Run `openclaw gateway restart`

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
