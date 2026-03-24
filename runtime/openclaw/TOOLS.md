# Tools and Workspace Notes

## Workspace Shape

This OpenClaw workspace is intentionally separate from the repo root.

The canonical Brain content is exposed here through symlinks:
- `personal/`
- `organisations/`
- `projects/`
- `ai/`
- `operations/`
- `skills/`

## Interpretation Rules

- `skills/` is the shared skill library.
- `skills/` is an alias to `ai/skills/`.
- `personal/`, `organisations/`, and `projects/` contain durable context.
- `operations/` contains runbooks, scripts, and curated system config.
- `runtime/cache/` and `runtime/local/` are not canonical truth.

## OpenClaw Notes

- Standard workspace files live in this folder.
- Optional OpenClaw files like `BOOT.md` and `BOOTSTRAP.md` are intentionally omitted unless needed.
