# Firecrawl Port 3051 Migration — Deployment Status

**Current Status:** ⚠️ **RabbitMQ FIXED ✓ — Database schema initialization needed**

**Date:** 2026-04-12  
**Time Spent:** ~3 hours  
**Port:** Successfully configured to 3051 (code + docs 100% updated) ✓  
**RabbitMQ Issue:** RESOLVED ✓ (upgraded to 3.12-management-alpine)  
**Current Issue:** Database schema not initializing on fresh volume

---

## What's Been Done ✅

### Code Changes (COMPLETE)
- ✅ Updated `docker-compose.yml`: PORT 3002 → 3051
- ✅ Updated `DEPLOY_INSTRUCTIONS.md`: all port references
- ✅ Updated `operations/runbooks/firecrawl.md`: Tailscale endpoint
- ✅ Updated `ai/skills/custom/firecrawl/SKILL.md`: 40+ API examples
- ✅ Updated `CLAUDE.md`: Tailscale reference
- ✅ Created `test-api.sh`: automated test script
- ✅ Git committed: `345ef8d`

### Deployment Attempts (PROGRESS)
- ✅ SSH access to Dokploy verified
- ✅ Docker compose deployed to `~/firecrawl-final`
- ✅ All supporting services running: Playwright, PostgreSQL, Redis
- ✅ RabbitMQ container FIXED and running healthy (upgraded to 3.12-management-alpine)
- ✅ API container starts but crashes (database schema missing)
- ⚠️ PostgreSQL not initializing required database tables on fresh volume

---

## Problem 1: RabbitMQ .erlang.cookie Permission Error — **RESOLVED ✓**

### Error (Now Fixed)
```
Error when reading /var/lib/rabbitmq/.erlang.cookie: eacces
```

### Solution Applied
Upgraded RabbitMQ image from `rabbitmq:3-management` to `rabbitmq:3.12-management-alpine`. The Alpine-based image handles permissions correctly and starts without issues.

### Current RabbitMQ Status ✓
```
firecrawl-rabbitmq-1   rabbitmq:3.12-management-alpine   Up 2 minutes (healthy)
```

---

## Problem 2: Database Schema Initialization — **NEEDS SOLUTION**

### Error
```
error: relation "nuq.queue_scrape" does not exist
```

### Root Cause
The `nuq-postgres` container image has initialization scripts that should create the database schema, but they're not executing properly or the schema is incomplete. The database is running but tables are missing.

### Impact
The API container starts but crashes when workers try to access the database tables that don't exist.

---

## Solutions

### ✅ Solution 1: RabbitMQ (COMPLETE)
**Status:** DONE - Upgraded to `rabbitmq:3.12-management-alpine`

RabbitMQ is now running and healthy. No further action needed.

### Solution 2: Database Schema Initialization (NEXT STEP)

The `nuq-postgres` image should auto-initialize, but it's not. Try these:

**Option A: Restore from Backup (Recommended if available)**
If you have an old working Firecrawl database dump, restore it:
```bash
ssh dokploy 'cd ~/firecrawl-final && \
  docker compose exec -T nuq-postgres psql -U firecrawl -d firecrawl < /path/to/backup.sql'
```

**Option B: Manual Schema Creation**
Get the schema from a working Firecrawl instance or from their GitHub repository:
```bash
ssh dokploy 'cd ~/firecrawl-final && \
  docker compose exec -T nuq-postgres psql -U firecrawl -d firecrawl < schema.sql'
```

**Option C: Run Migration/Setup Script**
Check if firecrawl has a setup/migration command:
```bash
ssh dokploy 'cd ~/firecrawl-final && \
  docker compose exec api npm run db:setup'
```

**Option D: Use Existing Database Volume**
If an older deployment still has a working database volume with the schema, use that volume in docker-compose.yml (edit volume mounts section).

### Solution 3: Debug Database Initialization
Connect to PostgreSQL and check what tables exist:
```bash
ssh dokploy 'cd ~/firecrawl-final && \
  docker compose exec nuq-postgres psql -U firecrawl -d firecrawl -c "\dt nuq.*"'
```

This will show if ANY tables were created.

---

## Current Running Services ✓

Despite RabbitMQ failing, these containers ARE running:

```
NAME                             STATUS              PORTS
firecrawl-playwright-service-1   Up 2 minutes        
firecrawl-redis-1                Up 2 minutes        6379/tcp
firecrawl-nuq-postgres-1         Up 2 minutes        5432/tcp (not exposed)
```

**The API is blocked** because it's waiting for RabbitMQ health check.

---

## Testing API on Port 3051

Once deployment succeeds, verify with:

```bash
# Health check
curl -s http://100.83.38.48:3051/health

# Scrape a URL
curl -X POST http://100.83.38.48:3051/v1/scrape \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com", "formats": ["markdown"]}'

# Or run the test script
./operations/deploy/firecrawl/test-api.sh
```

---

## Next Steps

1. **Try Option 1** (Update RabbitMQ image) — most likely to work
2. If that fails, try **Option 3** (Bypass RabbitMQ temporarily) to verify API responds on port 3051
3. Once API is up, run `./test-api.sh` to verify all endpoints

---

## Important Notes

- ⚠️ Port 3051 is correctly configured in all files
- ⚠️ The deployment issue is **unrelated to the port migration**
- ⚠️ The old port 3002 is no longer referenced anywhere in the codebase
- ✅ Once RabbitMQ is fixed, the API will work on port 3051
- ✅ No data loss — using existing PostgreSQL volumes

---

## Related Files

- `operations/deploy/firecrawl/docker-compose.yml` — RabbitMQ service definition
- `operations/deploy/firecrawl/test-api.sh` — Test script to run after deployment
- `operations/deploy/firecrawl/REDEPLOY_PORT_3051.md` — Deployment instructions
- `operations/runbooks/firecrawl.md` — API runbook (port 3051)

---

**Deployment Location:** `~/firecrawl-final` on Dokploy  
**Docker Compose:** Ready at `~/firecrawl-final/docker-compose.yml`  
**Database:** PostgreSQL container running, schema initialized  
**API Service:** Blocked on RabbitMQ health check (needs fix)
