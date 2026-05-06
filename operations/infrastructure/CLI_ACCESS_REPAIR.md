# BuildFlow CLI Access Diagnostics & Repair

**Last tested**: 2026-05-03
**Status**: Dokploy API access restored; Supabase DB auth restored; both networks reachable

This document captures the state of Dokploy and Supabase CLI/API access as of the last diagnostic run and provides repair procedures.

---

## Dokploy CLI/API Access

### Current Diagnostic Results

| Check | Result | Status |
|-------|--------|--------|
| Binary path | `~/.local/bin/dokploy-cli` | ✅ Found |
| Version | `@dokploy/cli/v0.2.8 darwin-arm64 node-v25.9.0` | ✅ OK |
| Credentials file | `~/.config/dokploy/.env` | ✅ Present |
| DOKPLOY_URL | `https://dokploy.prochat.tools` | ✅ Present |
| DOKPLOY_API_KEY | Present (non-empty) | ✅ Present |
| API endpoint | `https://dokploy.prochat.tools/api` | ✅ Reachable |
| **API authentication** | **HTTP 200 via `/api/project.all`** | ✅ **RESTORED** |
| **CLI verify** | `401 Unauthorized` despite direct API success | ⚠️ **CLI COMPAT ISSUE** |
| **Direct project/app listing** | Works via Dokploy API using `~/.config/dokploy/.env` | ✅ **WORKING** |

### Current State

The Dokploy API key stored in `~/.config/dokploy/.env` was rotated and direct API access is working. The verified read-only endpoint is:

```bash
source ~/.config/dokploy/.env
curl -sS "$DOKPLOY_URL/project.all" -H "x-api-key: $DOKPLOY_API_KEY"
```

A previous `dokploy-cli verify` call still returned `401 Unauthorized`, so agents should treat the packaged CLI verifier as unreliable until the CLI config/endpoint behavior is fixed. Use the direct Dokploy API with the single central credential file for inventory and cleanup tasks.

### Central Credential Location

Use only:

```text
~/.config/dokploy/.env
```

Expected variables:

```text
DOKPLOY_API_KEY=[REDACTED]
DOKPLOY_URL=https://dokploy.prochat.tools/api
DOKPLOY_API_HEADER=x-api-key
GHCR_DOKPLOY_PULL_PAT=[REDACTED]
```

Do not copy the Dokploy API key into repo docs, scripts, or additional `.env` files.

### Verification after credential updates

**For Dokploy:**
```bash
source ~/.config/dokploy/.env
curl -sS "$DOKPLOY_URL/project.all" -H "x-api-key: $DOKPLOY_API_KEY" | python3 -m json.tool | head -80
# Expected: JSON list of projects
```

**For Supabase (self-hosted):**
```bash
PGSSLMODE=disable ~/.local/bin/supabase-cli migration list \
  --db-url "postgresql://supabase_admin:PASSWORD@100.71.31.88:5433/postgres"
# Expected: Migration history table (may be empty)
```

### References

- Dokploy Skill: `ai/skills/custom/dokploy/dokploy/SKILL.md`
- Dokploy Runbook: `operations/runbooks/dokploy.md`
- Build Flow Deployment: `operations/runbooks/buildflow-deployment.md`

---

## Supabase CLI/API Access

### Current Diagnostic Results (Updated 2026-05-03)

| Check | Result | Status |
|-------|--------|--------|
| Binary path | `~/.local/bin/supabase-cli` | ✅ Found |
| Version | `v2.84.2` (update available: v2.95.4) | ✅ OK |
| Network: DB port (5433) | Reachable to `100.71.31.88` | ✅ Connected |
| Network: API port (8000) | Reachable to `100.71.31.88` | ✅ Connected |
| API health check | `{"message":"Unauthorized"}` | ✅ Responds (auth required) |
| Supabase config file | `~/.config/supabase/.env` | ✅ Present |
| SUPABASE_HOST | `100.71.31.88` (correct) | ✅ OK |
| **Database password** | **AUTHENTICATION SUCCESS** | ✅ **RESTORED** |
| **Direct DB access** | Works via self-hosted connection pattern | ✅ **WORKING** |
| **CLI `migration list` command** | Connects and responds | ✅ **WORKING** |
| **CLI Cloud commands** | Requires SUPABASE_ACCESS_TOKEN | ⚠️ Not configured (expected for self-hosted) |

### Current State (2026-05-03)

✅ **Resolved:** Supabase admin password was rotated and verified working. Direct database access is now operational.

**Self-hosted Supabase connection pattern:**
```bash
PGSSLMODE=disable ~/.local/bin/supabase-cli migration list \
  --db-url "postgresql://supabase_admin:PASSWORD@100.71.31.88:5433/postgres"
```

**Central credential location:**
```text
~/.config/supabase/.env
```

Expected variables:
```text
SYSTEM_DATABASE_URL="postgresql://supabase_admin:PASSWORD@100.71.31.88:5433/postgres?schema=public"
SUPABASE_HOST="100.71.31.88"
SUPABASE_PORT="5433"
SUPABASE_ADMIN_USER="supabase_admin"
```

### Important Notes

**Supabase CLI modes:**

1. **Self-hosted (Local Production)** — ✅ **WORKING**
   - Use direct database URL with `--db-url` flag
   - Requires `PGSSLMODE=disable` (TLS not configured on self-hosted)
   - Commands: `migration list`, `migration up`, `migration down`, `db pull`, `db push`
   - Example: See above

2. **Supabase Cloud Projects** — ⚠️ Not configured (expected)
   - Requires `SUPABASE_ACCESS_TOKEN` environment variable
   - Commands: `projects list`, `projects info`, `projects create`
   - Only needed if managing Supabase Cloud projects (we don't use Cloud)

**Shell alias caveat:**
- `supabase` is aliased to `ssh supabase` (SSH shortcut to server)
- Always invoke CLI via `~/.local/bin/supabase-cli` or full path to avoid alias conflict

### Current Network & API Status

✅ Self-hosted Supabase at `100.71.31.88:5433` and `100.71.31.88:8000` is fully reachable and responsive. Admin database authentication has been restored and verified.

### References

- Supabase Skill: `ai/skills/custom/supabase/supabase-cli/SKILL.md`
- Supabase Runbook: `operations/runbooks/supabase.md`
- Canonical Supabase host: Azure VM `vm-supabase` at Tailscale `100.71.31.88`

---

## Expected Paths & Credentials Locations

| System | Expected Path | Credential File | Status |
|--------|---------------|-----------------|--------|
| Dokploy CLI | `~/.local/bin/dokploy-cli` | `~/.config/dokploy/.env` | Correct path ✅; API key restored ✅; CLI verify/list commands unreliable ⚠️ |
| Supabase CLI | `~/.local/bin/supabase-cli` | `~/.config/supabase/.env` | Correct path ✅; Password restored ✅; Use PGSSLMODE=disable ⚠️ |

---

## Family Finance Impact

Family Finance is **local-only** and does not require:
- Dokploy credentials (no production deployment)
- Supabase production credentials (local OrbStack only at `localhost:5452/family_finance`)

These CLI access repairs are for **other apps only** (ProChat, Says the Bible, Yeshua Academy, etc.).

---

## Manual Recovery Procedure (Owner Action)

1. **SSH to Dokploy** to generate or rotate Dokploy API key (if needed):
   ```bash
   ssh dokploy  # Uses Tailscale 100.83.38.48
   # Navigate Dokploy admin UI or CLI to generate new key
   ```

2. **SSH to Supabase** to rotate database password (if needed):
   ```bash
   ssh supabase  # Uses Tailscale 100.71.31.88
   # Access psql or admin interface to change supabase_admin password
   ```

3. **Update local config files** with new credentials (after step 1-2):
   ```bash
   # Update ~/.config/dokploy/.env with new DOKPLOY_API_KEY
   # Update ~/.config/supabase/.env with new password or inject env vars
   ```

4. **Verify Dokploy API access** (recommended over CLI verify):
   ```bash
   source ~/.config/dokploy/.env
   curl -sS "$DOKPLOY_URL/project.all" -H "x-api-key: $DOKPLOY_API_KEY" | python3 -m json.tool | head -80
   ```

5. **Verify Supabase access** (after fresh credentials are set):
   ```bash
   PGSSLMODE=disable ~/.local/bin/supabase-cli migration list --db-url "$SUPABASE_DB_URL_READONLY"
   ```

---

## Repair Blockers (As of 2026-05-03)

| Blocker | Severity | Resolution |
|---------|----------|-----------|
| Dokploy API key restoration | High | ✅ RESOLVED (2026-05-03): New API key provisioned, direct `/api/project.all` access verified working |
| Supabase DB password restoration | High | ✅ RESOLVED (2026-05-03): Password rotated, CLI `migration list` verified working with PGSSLMODE=disable |
| Shell alias `supabase=ssh supabase` | Low | Workaround: Always use `~/.local/bin/supabase-cli` or full path |
| Supabase CLI version outdated | Low | Optional: Run `supabase-cli upgrade` to v2.95.4 |

---

## Completed Actions (2026-05-03)

**Dokploy cleanup:**
- ✅ Family Finance app ID `uMrNEbM2ROMb8z6PD3-O0` identified in Dokploy project "SaaS"
- ✅ Family Finance app deleted via API using `/api/application.delete`
- ✅ Verification scan confirmed no Family Finance app remains in Dokploy
- ✅ Local Family Finance database verified intact at localhost:5452/family_finance
- ✅ Dokploy cleanup complete — no further action needed

**Supabase cleanup pending:**
- Family Finance Supabase cleanup is deferred to next phase (database password rotation still needed separately)

## Future Agent Guidance

For future discovery or cleanup tasks:
1. Use direct Dokploy API calls (not `dokploy-cli verify/list`) — more reliable
2. Central credential: `~/.config/dokploy/.env` — do not duplicate keys
3. Family Finance must remain local-only — do not re-create Dokploy app or Supabase database

---

---

## Supabase Family Finance Database Check (2026-05-03)

**Task:** Query production Supabase to verify Family Finance has no database  
**Date:** 2026-05-03  
**Result:** ✅ **COMPLETE** — Database check successful with restored credentials  

**Findings:**

Two databases with "finance" in name found on production Supabase:
1. **`finance`** (11.1 MB) — Belongs to Yeshua Academy Finance app
   - Contains tables: Account, AccountGroup, Category, RecurringPayment, Transaction, BunqConnection
   - All tables empty (0 rows)
   - Prisma migrations present (recent schema updates)

2. **`finance_shadow`** (8.0 MB) — Shadow/mirror database
   - Completely empty (no tables)

**Family Finance Check:**
- ✅ **NO `family_finance` database found**
- ✅ **NO `family-finance` database found**
- ✅ **NO Family Finance resources on production Supabase**
- ✅ **Confirmed:** Family Finance has zero production databases

**Conclusion:**
Family Finance local-only constraint is verified. All finance data remains on OrbStack localhost:5452/family_finance. The `finance` database on production belongs to Yeshua Academy Finance (different app).

**Access Status:**
- ✅ Supabase CLI operational with self-hosted connection pattern
- ✅ Direct database queries working
- ✅ Password restored and verified
- ✅ No Family Finance production data found or accessed

Last updated: 2026-05-03 WEST (Dokploy finalized; Supabase check blocked by expired password)
