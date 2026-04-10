# Firecrawl Deployment to Dokploy — Manual Setup

This document guides you through deploying Firecrawl to Dokploy via the dashboard. API-based deployment is complex; manual setup is more reliable.

## Step 1: Access Dokploy Dashboard

1. Go to `https://dokploy.prochat.tools`
2. Log in with your credentials

## Step 2: Navigate to Ops Project

1. Click on **Projects** (left sidebar)
2. Select **Ops** project
3. Click **Add Application** (or **Add Compose** if you see that option)

## Step 3: Create Compose Deployment

1. **Type**: Select **Compose** (Docker Compose)
2. **Name**: `firecrawl`
3. **Environment**: `production` (default)

## Step 4: Paste Docker Compose File

1. In the Compose editor, paste the full contents of `docker-compose.yml` from:
   ```
   brain/operations/deploy/firecrawl/docker-compose.yml
   ```

2. Click **Next** or **Continue**

## Step 5: Add Environment Variables

Add these env vars in the Dokploy UI (copy-paste each):

```
PORT=3002
HOST=0.0.0.0
USE_DB_AUTHENTICATION=false
BULL_AUTH_KEY=98bee5d87a681f63b8fb800f4f18ff0cc97f5ec279cc347429edc93a954888cd
POSTGRES_USER=firecrawl
POSTGRES_PASSWORD=cb250bc909be0a9a37b69d4916825d28
POSTGRES_DB=firecrawl
NUM_WORKERS_PER_QUEUE=4
BROWSER_POOL_SIZE=3
CRAWL_CONCURRENT_REQUESTS=5
MAX_CONCURRENT_JOBS=3
BLOCK_MEDIA=true
ALLOW_LOCAL_WEBHOOKS=false
LOGGING_LEVEL=warn
```

**Important:** 
- Replace `BULL_AUTH_KEY` and `POSTGRES_PASSWORD` with values from the earlier command output
- Paste all of these into the environment variables section

## Step 6: Add Custom Domain

1. After creating the Compose deployment, click **Settings**
2. Click **Add Domain**
3. **Hostname**: `firecrawl.prochat.tools`
4. **Service**: `api` (the main API service)
5. **Port**: `3002`
6. **SSL**: Enabled (automatic)
7. Click **Add**

## Step 7: Deploy

1. Click **Deploy** button
2. Wait for all 5 containers to start (should take 2–3 minutes):
   - `api` (main API service)
   - `playwright-service` (browser automation)
   - `redis` (cache)
   - `rabbitmq` (job queue)
   - `nuq-postgres` (database)

3. Check status in the **Compose** section — should show `done` or `running`

## Step 8: Verify Deployment

Once deployed, test from your Mac:

```bash
# Health check
curl -s https://firecrawl.prochat.tools/health

# Test scrape
curl -X POST https://firecrawl.prochat.tools/v1/scrape \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://example.com",
    "formats": ["markdown"]
  }' | jq '.success'

# Should return: true
```

If both return `true`, Firecrawl is live!

## Step 9: Verify Admin UI

Test the admin queue UI:

```bash
# Replace with your actual BULL_AUTH_KEY
curl -s https://firecrawl.prochat.tools/admin/98bee5d87a681f63b8fb800f4f18ff0cc97f5ec279cc347429edc93a954888cd/queues
```

Should return the admin UI HTML (not an error).

## Troubleshooting

### Containers won't start

**Symptom:** Some containers show `error` or `failed` status

**Solution:**
1. Check Dokploy logs for each container
2. Common issues:
   - Port 3002 already in use (shouldn't happen with Dokploy routing)
   - Memory limits exceeded (Dokploy server RAM too low)
   - Docker volume `firecrawl_pgdata` permission error

### API returns 503 or timeout

**Symptom:** `curl https://firecrawl.prochat.tools/v1/scrape` returns error

**Solution:**
1. Wait 60 seconds for API container to fully initialize (there's a 60s healthcheck delay)
2. Check Docker logs: `ssh dokploy` then `docker logs firecrawl_api_1 --tail 50`
3. Restart containers via Dokploy dashboard: **Deploy** button again

### Cloudflare DNS not working

**Symptom:** `firecrawl.prochat.tools` doesn't resolve

**Solution:**
1. DNS CNAME was already created in Phase 2
2. Verify: `~/.local/bin/cloudflare-prochat-provisioner dns list prochat.tools | grep firecrawl`
3. If missing, add it again: `~/.local/bin/cloudflare-prochat-provisioner dns upsert prochat.tools CNAME firecrawl dc7bb87e-6a4d-4e3e-8e7d-71a091fcdf3b.cfargotunnel.com --ttl 1 --proxied true`

## Environment Variable Reference

| Variable | Value | Purpose |
|----------|-------|---------|
| `PORT` | 3002 | HTTP port (exposed) |
| `HOST` | 0.0.0.0 | Bind to all interfaces |
| `USE_DB_AUTHENTICATION` | false | No API key auth (self-hosted) |
| `BULL_AUTH_KEY` | (random) | Admin UI security key |
| `POSTGRES_*` | (credentials) | Database access |
| `NUM_WORKERS_PER_QUEUE` | 4 | Job queue workers (tuned for Dokploy) |
| `BROWSER_POOL_SIZE` | 3 | Concurrent browser instances |
| `CRAWL_CONCURRENT_REQUESTS` | 5 | Concurrent crawl jobs |
| `MAX_CONCURRENT_JOBS` | 3 | Max jobs in queue |
| `BLOCK_MEDIA` | true | Skip images/video for speed |
| `ALLOW_LOCAL_WEBHOOKS` | false | Security: don't allow localhost webhooks |
| `LOGGING_LEVEL` | warn | Minimal logs |

---

## Next Steps

Once Firecrawl is live and tested:

1. ✅ Verify all tests pass
2. ✅ Check memory usage on Dokploy (should be ~7–8GB total)
3. ✅ Try a real research task: `/firecrawl` search + markdown output
4. ✅ Run a Gemini Flash preprocess on large results
5. ✅ Document any issues in brain/operations/runbooks/firecrawl.md

---

**Deployment date:** 2026-04-10  
**Docker Compose file:** `brain/operations/deploy/firecrawl/docker-compose.yml`  
**Runbook:** `brain/operations/runbooks/firecrawl.md`
