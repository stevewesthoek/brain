# Family Finance: Local-Only Directive

**Status**: ✅ Documented, Verified, Locked
**Effective**: 2026-05-03
**Applies to**: All AI agents, CLI scripts, and operators managing Family Finance infrastructure

---

## Product Direction

Family Finance is a **local-only household finance tracker** with the following constraints:

| Aspect | Requirement | Enforcement |
|--------|-------------|------------|
| Runtime | Next.js app on local Mac | Verify startup via `cd ~/Repos/stevewesthoek/family-finance && npm run dev` |
| Database | OrbStack PostgreSQL at `localhost:5452/family_finance` | Never use Dokploy or Supabase production |
| Users | Household only (1 family, 2 people) | No multi-tenant, no production deployment |
| Auth | Simple shared password gate | No Ory, no SaaS identity provider |
| Deployment | Local-only; no public domain | No `finance.prochat.tools`, no public HTTPS |
| Dokploy | **No active deployment** | Historical deployment workflow has been removed |
| Supabase | **No production database** | All data is local only |

---

## Canonical Infrastructure

### Local Database

```
Path:    ~/Repos/stevewesthoek/brain/operations/database/standalone/familyfinance/
File:    docker-compose.yml
Image:   postgres:16
Port:    5452 (host) → 5432 (container)
DB:      family_finance
User:    postgres
Status:  OrbStack managed; running as container `familyfinance-postgres-1`
```

### Local Runtime

```
Repo:    ~/Repos/stevewesthoek/family-finance
Start:   npm run dev (development only)
Port:    3060 (local HTTP, no HTTPS)
Build:   Next.js standalone
Type:    TypeScript + Prisma + Tailwind
```

### Migrations & Schema

```
Schema:  prisma/system.prisma (non-default path; do not change)
Migrations: 8 applied (as of 2026-05-03)
Status:  Up to date via `prisma migrate status`
Validation: Schema valid via `prisma validate`
```

---

## What Must NOT Happen

### ❌ Dokploy Deployment

- **No active Dokploy app** for Family Finance
- Historical deployment workflow (`.github/workflows/deploy.yml`) has been removed
- ✅ **Completed (2026-05-03):** Dokploy app ID `uMrNEbM2ROMb8z6PD3-O0` was found and deleted after owner approval
- If a future Dokploy app is found with Family Finance name: it is orphaned and should be deleted after owner confirmation

### ⏳ Supabase Production Database (pending verification)

- **Requirement:** Family Finance must not use production Supabase (Azure at `100.71.31.88:5433`)
- **Status:** Supabase cleanup/verification is pending (database credential access not yet restored)
- **Note:** Production Supabase databases named `finance` or `finance_shadow` are **not necessarily Family Finance** (names are too generic to prove ownership)
- **If future agent finds such databases:** treat as unrelated; do not delete without explicit owner confirmation

### ❌ Public Deployment

- No `finance.prochat.tools` domain
- No public DNS record pointing to Family Finance
- No production HTTPS endpoint
- No Cloudflare Tunnel entry for Family Finance

### ❌ Cloud Migration

- Do not move local OrbStack database to production Supabase
- Do not convert to multi-tenant architecture
- Do not add Vercel or other deployment platform
- Do not reintroduce Ory or other SaaS auth

---

## Verification Checklist

Agents should verify Family Finance local-only state:

```bash
# 1. Local database running
docker ps | grep familyfinance-postgres-1
→ Expected: CONTAINER STATUS "Up"

# 2. Database connectivity
PGPASSWORD=postgres psql -h localhost -p 5452 -U postgres -d family_finance \
  -c "SELECT current_database(), current_user;" 
→ Expected: family_finance | postgres

# 3. Prisma migrations current
cd ~/Repos/stevewesthoek/family-finance && npx prisma migrate status --schema=prisma/system.prisma
→ Expected: "Database schema is up to date!"

# 4. Build succeeds
cd ~/Repos/stevewesthoek/family-finance && npm run build
→ Expected: "Build completed" (no errors)

# 5. Dokploy NOT configured
grep -i "family-finance\|familyfinance" ~/.config/dokploy/.env
→ Expected: No output (not configured)

# 6. No Supabase Cloud link
~/.local/bin/supabase-cli projects list 2>&1 | grep -i "family-finance"
→ Expected: No output (not linked to Supabase Cloud)
```

---

## Production Hygiene Rules

### If you find Family Finance resources on production:

| Finding | Confidence | Action |
|---------|------------|--------|
| Dokploy app named "Family Finance" or "finance" | High | Report as orphaned; candidate for deletion |
| Dokploy app at `finance.prochat.tools` | High | Report as orphaned; candidate for deletion |
| Supabase database `family_finance` | High | Report as orphaned; candidate for deletion |
| Supabase database `finance` or `finance_shadow` | **Low** | Do not delete without explicit owner confirmation (names are generic) |

**Never delete without owner confirmation.**

---

## For Future Developers

When working on Family Finance:

1. **Always use local OrbStack database** (`localhost:5452/family_finance`)
2. **Never commit production credentials** (`.env.production`, cloud keys, etc.)
3. **Never add SaaS dependencies** (Vercel, Clerk, Supabase hosting, etc.)
4. **Keep auth simple**: shared household password gate only
5. **Document local setup**: `docs/` should have local bootstrap guide
6. **Test locally first**: verify `npm run dev` works before any other work

---

## CLI Commands for Verification

Safe, read-only commands to verify local-only status:

```bash
# List Dokploy apps (returns 401 if auth broken; that's expected for this discovery)
dokploy-cli project list

# Check for Family Finance in Dokploy (if auth working)
dokploy-cli app list | grep -i "family\|finance" || echo "Not found (expected)"

# Verify Family Finance local app is registered
cat ~/Repos/stevewesthoek/brain/operations/infrastructure/local-apps.json | jq '.[] | select(.name | contains("Family"))'

# Verify Family Finance database port is reserved
cat ~/Repos/stevewesthoek/brain/operations/infrastructure/local-apps.json | jq '.[] | select(.databasePort == 5452)'
```

---

## Historical Context (For Reference Only)

Family Finance was originally planned as a production SaaS app:
- Domain: `finance.prochat.tools` (planned, never deployed)
- Auth: Ory Kratos (planned, never deployed)
- Database: Supabase Postgres on 5433 (planned, never deployed)
- Deployment: Dokploy (planned, never deployed)

**This plan was explicitly abandoned.** The app is now local-only. Historical planning documents are marked `HISTORICAL` and preserved for reference only. See `operations/system-configs/claude/plans/whimsical-mapping-pine.md`.

---

Last updated: 2026-05-03 WEST
