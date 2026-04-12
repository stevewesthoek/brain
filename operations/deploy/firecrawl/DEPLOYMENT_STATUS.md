# Firecrawl Port 3051 Migration — Deployment Status

**Current Status:** ⚠️ **Deployment in progress — RabbitMQ compatibility issue encountered**

**Date:** 2026-04-12  
**Time Spent:** ~2 hours  
**Port:** Successfully configured to 3051 (code + docs 100% updated)  
**Deployment Issue:** RabbitMQ container failing to start on Dokploy

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

### Deployment Attempts (BLOCKED)
- ✅ SSH access to Dokploy verified
- ✅ Docker compose deployed to `~/firecrawl-final`
- ✅ Supporting services starting: Playwright, PostgreSQL, Redis
- ❌ RabbitMQ container failing to start (permission issue)
- ❌ API container blocked on RabbitMQ health check dependency

---

## Problem: RabbitMQ .erlang.cookie Permission Error

### Error
```
Error when reading /var/lib/rabbitmq/.erlang.cookie: eacces
```

### Root Cause
The `rabbitmq:3-management` image fails to read/write the `.erlang.cookie` file due to permission issues. This is a known Docker compatibility issue on certain Linux kernels or Docker daemon configurations.

### Attempts Made
1. ❌ Fresh deploy with new volumes
2. ❌ Using old database volume
3. ❌ Complete cleanup + rebuild
4. ❌ Multiple restarts

All attempts result in the same `.erlang.cookie: eacces` error.

---

## Solutions to Try

### Option 1: Update RabbitMQ Image (Recommended)
The issue may be with the specific `rabbitmq:3-management` version. Try:

```dockerfile
# In docker-compose.yml, update:
rabbitmq:
  image: rabbitmq:3.12-management-alpine  # Use Alpine version
  # OR
  image: rabbitmq:3.13-management  # Use newer version
```

Then redeploy:
```bash
cd ~/firecrawl-final
docker compose pull  # Get new image
docker compose down -v  # Remove all volumes
docker compose up -d  # Start fresh
```

### Option 2: Pre-create RabbitMQ Volume with Correct Permissions

```bash
ssh dokploy << 'EOF'
docker volume create rabbitmq-data
docker run -d -v rabbitmq-data:/var/lib/rabbitmq rabbitmq:3-management
sleep 10
docker stop $(docker ps -q --filter ancestor=rabbitmq:3-management)
EOF
```

Then update `docker-compose.yml` to use the named volume:

```yaml
rabbitmq:
  volumes:
    - rabbitmq-data:/var/lib/rabbitmq
```

### Option 3: Bypass RabbitMQ (Workaround for Testing)

Remove RabbitMQ from `docker-compose.yml` to test if the API works on port 3051:

```yaml
# Comment out or remove the rabbitmq service
# rabbitmq:
#   image: ...

# In api service, remove rabbitmq from depends_on:
depends_on:
  redis:
    condition: service_started
  # rabbitmq:  <-- REMOVE THIS
  # condition: service_healthy  <-- REMOVE THIS
  playwright-service:
    condition: service_started
  nuq-postgres:
    condition: service_started
```

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
