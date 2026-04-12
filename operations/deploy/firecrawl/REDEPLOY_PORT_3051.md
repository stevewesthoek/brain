# Firecrawl Port Migration to 3051 — Redeployment Instructions

**Status**: All code and documentation updated. Firecrawl is NOT currently running on Dokploy.

**Old port:** 3002 (no longer used)  
**New port:** 3051 (requires redeployment)

---

## Quick Redeployment Steps

### Option A: Redeploy via Dokploy Dashboard (Recommended)

1. Go to `https://dokploy.prochat.tools`
2. Log in with your credentials
3. Navigate to **Ops** project → find existing **firecrawl** compose deployment
4. Click **Settings** → **Environment Variables**
5. Update these variables:
   ```
   PORT=3051
   ```
   (Other variables remain unchanged)
6. Click **Deploy** button
7. Wait 2–3 minutes for all containers to start
8. Verify health: `curl -s http://100.83.38.48:3051/health`

### Option B: Manual CLI Deployment (if Dokploy doesn't show the deployment)

1. **SSH into Dokploy:**
   ```bash
   ssh dokploy
   ```

2. **Create deployment directory:**
   ```bash
   mkdir -p /root/firecrawl-deployment
   cd /root/firecrawl-deployment
   ```

3. **Copy docker-compose.yml from your local machine:**
   ```bash
   scp brain/operations/deploy/firecrawl/docker-compose.yml dokploy:/root/firecrawl-deployment/
   ```

4. **Start the services:**
   ```bash
   ssh dokploy 'cd /root/firecrawl-deployment && docker compose up -d'
   ```

5. **Monitor startup (takes 60–90 seconds):**
   ```bash
   ssh dokploy 'docker compose -f /root/firecrawl-deployment/docker-compose.yml logs -f api' &
   ```

6. **Verify health (after 60 seconds):**
   ```bash
   curl -s http://100.83.38.48:3051/health
   ```

---

## Verification Tests

### After deployment starts, run these commands:

**Test 1: Health Check**
```bash
curl -s http://100.83.38.48:3051/health
# Expected: "OK" or health status object
```

**Test 2: Single URL Scrape**
```bash
curl -X POST http://100.83.38.48:3051/v1/scrape \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://example.com",
    "formats": ["markdown"]
  }' | jq '.success'
# Expected: true
```

**Test 3: Web Search**
```bash
curl -X POST http://100.83.38.48:3051/v1/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "Claude API",
    "limit": 2,
    "scrape": true
  }' | jq 'length'
# Expected: 2 (or more results)
```

**Test 4: Admin Queue UI**
```bash
# Get BULL_AUTH_KEY from Dokploy env vars, then:
curl -I http://100.83.38.48:3051/admin/<BULL_AUTH_KEY>/queues
# Expected: HTTP 200
```

### Automated Test Script

```bash
./operations/deploy/firecrawl/test-api.sh
```

This script runs all tests and reports pass/fail.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Containers won't start | Check Dokploy logs for memory/resource errors. Dokploy server may need restart. |
| Health check times out | Wait 60 seconds; healthcheck has a 60s startup delay in docker-compose.yml |
| Connection refused on 3051 | Verify Tailscale is connected. Test: `tailscale status` |
| Old port 3002 still responds | Kill old containers: `ssh dokploy 'docker ps \| grep firecrawl \| awk "{print \\$1}" \| xargs docker stop'` |
| Database errors | The volume `firecrawl_pgdata` persists across deployments. If corrupted, delete it: `docker volume rm firecrawl_pgdata` |

---

## Key Changed Files

- ✅ `docker-compose.yml` — PORT, INTERNAL_PORT, healthcheck updated
- ✅ `DEPLOY_INSTRUCTIONS.md` — all references updated
- ✅ `operations/runbooks/firecrawl.md` — Tailscale endpoint and docs updated
- ✅ `ai/skills/custom/firecrawl/SKILL.md` — API endpoint examples updated
- ✅ `CLAUDE.md` — reference updated
- ✅ `test-api.sh` — new test script created

**Git commit:** 345ef8d

---

## Expected Behavior After Deployment

1. **Health endpoint** responds immediately (after 60s startup delay)
2. **Scrape endpoint** returns markdown for any public URL
3. **Search endpoint** returns up to N results with scraped markdown
4. **Admin UI** shows job queue status
5. **Tailscale access** from any device on the network: `http://100.83.38.48:3051`

---

## Important Notes

- ⚠️ The service will NOT work until redeployed with the new `PORT=3051` env var
- ⚠️ Old port 3002 is now unused; remove any hardcoded references if they exist
- ⚠️ Dokploy may cache old environment variables; clear and re-set all vars if needed
- ✅ Database volume persists automatically; no data loss on redeployment

---

**Date**: 2026-04-12  
**Migrated from**: port 3002  
**Migrated to**: port 3051  
**Reason**: Avoid conflicts with development servers (3000–3050 range reserved)
