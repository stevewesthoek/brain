---
name: supabase
description: Use when the user asks to manage Supabase — running migrations, generating TypeScript types, diffing schemas, managing local dev stack, or inspecting the self-hosted Supabase instance. Assumes Supabase CLI is installed globally via Homebrew and the target is a self-hosted instance.
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/bin/check-db-prod.sh"
          statusMessage: "Checking database context safety..."
---

# Supabase CLI

## STOP — DB Context Check (run before every operation)

Before executing any database command, state this out loud:

> "I am working on **[APP NAME]** — **[LOCAL / PRODUCTION]** database."

Identify the target from the connection string:

| Connection | Environment | Rules |
|---|---|---|
| `localhost:5432` or `localhost:5433` | **LOCAL** | Safe to reset, push, drop |
| `100.71.31.88:5433` (Tailscale VPS) | **PRODUCTION** | Read-only unless user explicitly confirms write |
| `$SUPABASE_DB_URL_READONLY` | **PRODUCTION READ-ONLY** | Never pass to write commands |
| `$SUPABASE_DB_URL` | **PRODUCTION WRITE** | Schema migrations only — requires confirmation |

**If the target is ambiguous — ask before running anything.**

### Operation risk levels

| Operation | Local | Production |
|---|---|---|
| `migration list`, `db diff`, `gen types` | ✅ proceed | ✅ proceed (read-only) |
| `db push`, `migration apply` | ✅ proceed | ⚠️ confirm with user first |
| `db reset` | ✅ proceed | 🚫 NEVER |
| `DROP TABLE/DATABASE`, `TRUNCATE` | ✅ proceed | 🚫 NEVER |
| `prisma db push`, `prisma migrate dev` | ✅ proceed | 🚫 NEVER |

---

## What this skill is for
Help Claude use the Supabase CLI safely for database migrations, schema diffing, type generation, and local development against a self-hosted Supabase instance.

## Use this skill when
- Running or managing database migrations (`db push`, `db pull`, `migration`)
- Generating TypeScript types from the database schema
- Diffing local vs remote schema
- Inspecting the local or remote database (read-only)
- Linking a project to the self-hosted instance

## Do not use this skill for
- Supabase Cloud management — this setup is self-hosted only
- `supabase login` — Cloud auth, not needed here
- `supabase start` / `supabase stop` — the local Supabase stack runs in Docker Desktop independently; the CLI's own stack would conflict on the same ports
- Edge Functions deployment — Cloud-only feature
- Any write operation against the production database from the Mac

## Safety rules
1. **`SUPABASE_DB_URL_READONLY` is for inspection only.** Never pass it to `db push`, `db reset`, or any write command.
2. **Never run migrations from the Mac against production.** The only migration path to production is the Dokploy build pipeline (`prebuild-sync.mjs` → `prisma migrate deploy`).
3. **Never run `db reset` against production.** It wipes the entire database. Only use it against the local dev stack.
4. **Never commit database credentials.** Keep all DB URLs and service role keys in `~/.zshrc`, never in repo files.
5. **Dry-run before any write.** Use `--dry-run` or `db diff` before `db push` in any context.
6. **Migrations alter schema only.** `prisma migrate deploy` (what runs in production) only changes table structure — it never deletes or overwrites row data.

## Allowed from Mac (read-only against production)
```bash
PGSSLMODE=disable ~/.local/bin/supabase-cli migration list --db-url "$SUPABASE_DB_URL_READONLY"
PGSSLMODE=disable ~/.local/bin/supabase-cli gen types typescript --db-url "$SUPABASE_DB_URL_READONLY"
PGSSLMODE=disable ~/.local/bin/supabase-cli db diff --db-url "$SUPABASE_DB_URL_READONLY"
```

## Forbidden against production from Mac
```bash
supabase db push        # ← NEVER — applies schema changes to production
supabase db reset       # ← NEVER — wipes database
prisma db push          # ← NEVER — bypasses migration files
prisma migrate dev      # ← NEVER against production (guard script enforces this)
prisma migrate deploy   # ← NEVER manually — runs only via Dokploy build
```

## CLI path
```bash
~/.local/bin/supabase-cli   # use this — 'supabase' in shell is aliased to ssh supabase (VPS shortcut)
```
Always call the CLI via `~/.local/bin/supabase-cli` or `/opt/homebrew/bin/supabase` to avoid the alias conflict.

## Self-hosted connection

Reachable directly from the Mac via Tailscale — no tunnel or subnet routing needed.

| Endpoint | Address |
|---|---|
| PostgreSQL | `100.71.31.88:5433` |
| Supabase API | `http://100.71.31.88:8000` |
| Tailscale IP (Dokploy) | `100.83.38.48` |

Required env vars — store in `~/.zshrc`, never in the repo:
```bash
export SUPABASE_DB_URL_READONLY="postgresql://supabase_admin:<password>@100.71.31.88:5433/postgres?sslmode=disable"
export SUPABASE_URL="http://100.71.31.88:8000"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
export PGSSLMODE=disable   # required — Supabase CLI ignores sslmode in URL, needs this env var
```

The `_READONLY` suffix is intentional and enforced. Never use this URL with write commands.

Credentials source: `SYSTEM_DATABASE_URL` (for the password) and `SUPABASE_SERVICE_ROLE_KEY` from the Dokploy production env for each app.

Note: `10.0.2.4` is the internal LAN IP — only reachable from the Dokploy machine. Always use `100.71.31.88` from the Mac.

## Recommended workflow — push migration

```bash
# 1. Check what migrations are pending
~/.local/bin/supabase-cli db push --dry-run --db-url "$SUPABASE_DB_URL"

# 2. Review output, then apply
~/.local/bin/supabase-cli db push --db-url "$SUPABASE_DB_URL"
```

## Recommended workflow — generate TypeScript types

```bash
~/.local/bin/supabase-cli gen types typescript \
  --db-url "$SUPABASE_DB_URL" \
  > src/types/database.types.ts
```

## Example commands

```bash
# Version
~/.local/bin/supabase-cli --version

# Schema diff (local vs remote)
~/.local/bin/supabase-cli db diff --db-url "$SUPABASE_DB_URL"

# Pull remote schema to local migration files
~/.local/bin/supabase-cli db pull --db-url "$SUPABASE_DB_URL"

# Push pending migrations to remote
~/.local/bin/supabase-cli db push --db-url "$SUPABASE_DB_URL"

# Generate TypeScript types
~/.local/bin/supabase-cli gen types typescript --db-url "$SUPABASE_DB_URL"

# Create a new migration file
~/.local/bin/supabase-cli migration new <migration-name>

# List applied migrations
~/.local/bin/supabase-cli migration list --db-url "$SUPABASE_DB_URL"

```

## Environment architecture
| Environment | PostgreSQL | Managed by |
|---|---|---|
| Local | `localhost:5433` | Docker Desktop (independent stack) |
| Production | `100.71.31.88:5433` | VPS, reachable via Tailscale |

**Do not use `supabase start` / `supabase stop`** — the local Supabase stack runs as its own Docker Compose setup in Docker Desktop. The CLI commands would start a conflicting second instance on the same ports.

## Notes
- CLI installed at: `/opt/homebrew/bin/supabase` (v2.75.0, via `brew install supabase/tap/supabase`)
- Stable symlink: `~/.local/bin/supabase-cli`
- Upgrade: `brew upgrade supabase/tap/supabase`
- Production Tailscale IP: `100.71.31.88` (PostgreSQL :5433, API :8000)
- No Supabase Cloud account required for any self-hosted operation
