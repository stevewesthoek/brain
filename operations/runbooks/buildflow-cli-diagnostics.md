# BuildFlow Infrastructure CLI Diagnostics

This document guides agents through diagnosing and repairing access to Dokploy and Supabase CLIs when deployment operations are required.

## Dokploy CLI Diagnostics

### Availability

```bash
which dokploy-cli              # Should return /Users/Office/.local/bin/dokploy-cli
dokploy-cli --version         # Should show @dokploy/cli/v0.2.8 or newer
```

### Authentication

Dokploy CLI reads credentials from `~/.config/dokploy/.env`:
- `DOKPLOY_URL` — base URL for API
- `DOKPLOY_API_KEY` — authentication token
- `DOKPLOY_API_HEADER` — header name (should be `x-api-key`)

### Known Issues

**Issue: `dokploy-cli project list` returns 401**
- Symptom: "Failed to fetch project list: Request failed with status code 401"
- Likely cause: API endpoint changed or credential expired
- Test: Direct API call with stored credential to verify if issue is CLI or credential
- Fix: Re-authenticate via Dokploy UI and update `~/.config/dokploy/.env`

**Issue: `dokploy-cli project list` returns 404**
- Symptom: `{"message":"Not found","code":"NOT_FOUND"}`
- Likely cause: API endpoint syntax changed (v0.2.8 may use different path)
- Fix: Check Dokploy API documentation or use `dokploy-cli --help`

**Issue: API key appears in command output**
- Safety issue: Never print API keys in commands or output
- Fix: Use environment variables and redirect stderr
  ```bash
  DOKPLOY_KEY=$(grep DOKPLOY_API_KEY ~/.config/dokploy/.env | cut -d= -f2)
  curl -s -H "x-api-key: $DOKPLOY_KEY" https://dokploy.prochat.tools/api/v1/project
  ```

### Safe Diagnostic Commands

```bash
# Verify CLI is available and working
which dokploy-cli && echo "CLI found"

# Check current version
dokploy-cli --version

# Check help (does not require auth)
dokploy-cli --help

# List projects (requires valid auth)
dokploy-cli project list 2>&1

# Show specific project (requires projectId)
dokploy-cli project info -p <projectId> 2>&1
```

### Post-Fix Verification

After updating credentials:
1. Run `dokploy-cli project list` and confirm success
2. Run `/dokploy` skill to list all apps
3. Verify Family Finance is **not** in the list (confirming no Dokploy deployment)

---

## Supabase CLI Diagnostics

### Availability

```bash
which supabase-cli             # Should return /Users/Office/.local/bin/supabase-cli
supabase-cli --version        # Should show v2.84.2 or newer
```

### Authentication

Supabase CLI requires an access token for production Supabase projects:
- Token is stored per-project or globally via `supabase login`
- For self-hosted Supabase: token may not be required if using direct database URL

### Known Issues

**Issue: `supabase-cli projects list` returns "Access token not provided"**
- Symptom: "Supply an access token by running supabase login or setting SUPABASE_ACCESS_TOKEN"
- Likely cause: Not authenticated to Supabase Cloud (which is not our target; we use self-hosted)
- Fix: Use direct database connection instead (self-hosted Supabase does not use Supabase Cloud CLI auth)

**Issue: Supabase alias conflicts with SSH**
- Symptom: `supabase: aliased to ssh supabase` (in bash/zsh)
- Likely cause: Shell alias is masking the CLI
- Fix: Use full path `/Users/Office/.local/bin/supabase-cli` instead of `supabase`

### Safe Diagnostic Commands

```bash
# Verify CLI is available and working
which supabase-cli && echo "CLI found"

# Check current version
supabase-cli --version

# Check help (does not require auth)
supabase-cli --help

# For self-hosted Supabase (not Cloud), use direct database connection:
supabase-cli db diff --db-url "postgresql://user:pass@100.71.31.88:5433/dbname" --dry-run
```

### Direct Database Access (Self-Hosted)

For self-hosted Supabase on Azure (vm-supabase at `100.71.31.88:5433`), use direct PostgreSQL connection:

```bash
# Admin read-only (from .config/supabase/.env)
PGPASSWORD="[password]" psql \
  -h 100.71.31.88 \
  -p 5433 \
  -U supabase_admin \
  -d postgres \
  -c "SELECT datname FROM pg_database WHERE datname LIKE 'finance%';"
```

**Safety rules:**
- Never print passwords in commands (use environment variables)
- Use read-only operations for discovery
- Do not query production databases without explicit authorization

---

## BuildFlow Operational Constraints

### Family Finance Exception

Family Finance is **local-only** and has explicit constraints:

| Operation | Status | Reason |
|-----------|--------|--------|
| Deploy to Dokploy | ❌ Forbidden | Local-only application; no public deployment |
| Create Supabase project | ❌ Forbidden | Local-only application; use OrbStack only |
| Access production Supabase | ❌ Forbidden | Family Finance databases must not exist on production |
| Use localhost:5452 OrbStack DB | ✅ Canonical | Only valid database connection |

If discovery finds Family Finance resources on production (Dokploy or Supabase), report as **orphaned** and flag for deletion after owner confirmation.

---

## Destructive Operations Procedure

Before deleting any production resources:

1. **List** only (read-only): Verify which resources exist
2. **Confirm ownership**: Match resource name to confirmed application
3. **Owner approval**: Get explicit approval before proceeding
4. **Verify post-delete**: Confirm resource is gone
5. **No secrets in output**: Redact any tokens or connection strings

Example safe flow:
```bash
# Step 1: List Dokploy apps (read-only)
dokploy-cli app list

# Output inspection (no deletion)
# → If family-finance found, record app ID and project

# Step 2: Wait for owner confirmation

# Step 3: Delete (after approval)
dokploy-cli app delete --app-id <id>

# Step 4: Verify
dokploy-cli app list | grep family-finance
```

---

## Recovery & Next Steps

If CLI access issues block operations:

1. **Stop**: Do not attempt destructive operations without working diagnostic access
2. **Diagnose**: Run all safe diagnostic commands above
3. **Report**: Document exact error messages (redact secrets)
4. **Escalate**: Contact infrastructure team for credential rotation or API endpoint updates

Last updated: 2026-05-03
