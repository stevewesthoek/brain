# API & Credential Conventions

## File layout

All credentials live under `~/.config/<service>/` as `.env` files or `.json` keys. Never in-repo.

| Pattern | Example | Used by |
|---------|---------|---------|
| `<service>/.env` | `~/.config/n8n/.env` | Single-role services |
| `<service>/<profile>.env` | `~/.config/azure-ai/credentials/apps-provisioner.env` | Multi-role services |
| `<service>/<file>.json` | `~/.config/gws/service-account.json` | Google service accounts, OAuth |

## Role separation

Azure and Cloudflare use a **provisioner/destroyer** pattern — separate credentials per role, per account. This limits blast radius.

## Permissions

All `.env` and credential files: `chmod 600` (owner read/write only).

## Master index

`operations/accounts/credentials-index.md` — metadata only (variable names, file paths, rotation notes, regeneration links). Never actual values.

## Sync workflow

1. `sync-credentials` scans `~/.config/` for `.env` files and appends untracked entries to the Pending section of the credentials index.
2. A PostToolUse hook auto-runs `sync-credentials` whenever Claude writes or edits a `.env` file.
3. New entries land in "Pending" — manually move them to the correct section and fill in Purpose, Rotation, and Regenerate.

## Intentionally not in-repo

These contain secrets and are NOT symlinked or tracked:

- `~/.claude.json` (MCP registrations with secrets). Safe template: `operations/system-configs/claude/claude.json.template`
- `~/.config/dokploy/.env`
- `~/.config/n8n/.env`
- All `~/.config/<service>/*.env` files
