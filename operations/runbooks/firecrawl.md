# Firecrawl Runbook

Self-hosted web scraping & search API. Deployed on Dokploy, accessible via Tailscale at `http://100.83.38.48:3002`.

## Service Details

| Aspect | Value |
|--------|-------|
| **Tailscale Endpoint** | `http://100.83.38.48:3002` |
| **Tailscale Node** | `dokploy` (100.83.38.48) |
| **Deployment** | Dokploy (Azure `vm-dokploy`) |
| **Docker Compose** | `brain/operations/deploy/firecrawl/docker-compose.yml` |
| **Database** | PostgreSQL in Docker volume `firecrawl_pgdata` |
| **Port (internal)** | 3002 |
| **Access** | Private Tailscale network only (no internet exposure) |

---

## Verify Health

```bash
# Quick health check (via Tailscale)
curl -s http://100.83.38.48:3002/v1/scrape \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","formats":["markdown"]}' | jq '.success'

# Expected response: true (service is healthy)

# Or direct on dokploy server:
ssh dokploy 'curl -s http://localhost:3002/health'
```

---

## Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/search` | POST | Web search (returns markdown content) |
| `/v1/scrape` | POST | Single URL to markdown |
| `/v1/crawl` | POST | Start async site crawl |
| `/v1/crawl/:id` | GET | Check crawl status |
| `/health` | GET | Liveness check |
| `/admin/<BULL_AUTH_KEY>/queues` | GET | Admin UI (job queue monitoring) |

---

## Restart Steps

If Firecrawl service becomes unresponsive:

1. **SSH to Dokploy:**
   ```bash
   ssh dokploy
   ```

2. **Check container status:**
   ```bash
   docker ps | grep firecrawl
   docker logs firecrawl_api_1 --tail 50
   ```

3. **Restart all Firecrawl containers:**
   ```bash
   cd /path/to/docker-compose.yml
   docker compose down
   docker compose up -d
   ```

4. **Wait for health check (30–60 seconds):**
   ```bash
   curl -s http://localhost:3002/health || echo "Not ready yet..."
   ```

5. **Verify from outside:**
   ```bash
   curl -s https://100.83.38.48:3002/health
   ```

---

## Admin Queue UI

**URL:** `http://100.83.38.48:3002/admin/<BULL_AUTH_KEY>/queues` (via Tailscale)  
(Replace `<BULL_AUTH_KEY>` with value from Dokploy environment settings)

**Use for:**
- Monitoring active crawl jobs
- Checking failed job details
- Queue depth / performance metrics
- Manual job retries or cancellations

---

## Database Persistence

Firecrawl uses PostgreSQL (`nuq-postgres` container) with data stored in Docker volume:

```bash
# On Dokploy:
docker volume ls | grep firecrawl_pgdata
docker volume inspect firecrawl_pgdata
```

**Backup:**
```bash
# Manual backup of database
docker exec firecrawl_nuq-postgres_1 \
  pg_dump -U firecrawl -d firecrawl > ~/firecrawl_backup.sql
```

**Restore:**
```bash
docker exec -i firecrawl_nuq-postgres_1 \
  psql -U firecrawl -d firecrawl < ~/firecrawl_backup.sql
```

---

## Resource Constraints

Dokploy server: 4 vCPU, 15 GiB RAM

**Firecrawl memory limits:**
- `api`: 5 GB
- `playwright-service`: 2 GB
- `redis`: 512 MB
- `rabbitmq`: 512 MB
- `nuq-postgres`: 1 GB
- **Total:** ~9 GB

**If OOM errors occur:**
1. Reduce `NUM_WORKERS_PER_QUEUE` (from 4 down to 2)
2. Reduce `BROWSER_POOL_SIZE` (from 3 down to 1)
3. Reduce `CRAWL_CONCURRENT_REQUESTS` (from 5 down to 2)
4. Update in Dokploy environment settings and redeploy

---

## Rollback

If Firecrawl deployment breaks irreparably:

1. **Stop containers:**
   ```bash
   docker compose -f /path/to/docker-compose.yml down
   ```

2. **Verify Dokploy UI shows Firecrawl as offline**

3. **Remove symlink (Firecrawl skill disabled):**
   ```bash
   rm brain/ai/skills/active/firecrawl
   ```

4. **Remove Docker volume (if starting fresh):**
   ```bash
   docker volume rm firecrawl_pgdata
   ```

5. **Redeploy from scratch** (see `/dokploy` skill for deployment steps)

---

## Performance Tuning

### For High-Volume Research

If running multiple concurrent scrapes (10+/day):

1. Increase `NUM_WORKERS_PER_QUEUE` → 6–8 (if RAM allows)
2. Increase `CRAWL_CONCURRENT_REQUESTS` → 10 (Dokploy server permitting)
3. Set `BLOCK_MEDIA=false` to include images (slower but more data)

### For Low-Latency Scraping

Current defaults are optimized for single-user research. No tuning needed.

---

## Monitoring

**Check Dokploy dashboard** for container memory/CPU usage:
- `https://dokploy.prochat.tools` → select `firecrawl` project → monitor metrics

**Check logs:**
```bash
ssh dokploy
docker compose -f /path/to/firecrawl/docker-compose.yml logs api -f --tail 50
```

---

## Known Issues

| Issue | Cause | Workaround |
|-------|-------|-----------|
| "Maximum concurrent jobs" error | Queue depth exceeded | Reduce `MAX_CONCURRENT_JOBS` env var |
| Scrape returns empty markdown | Page is JS-heavy or protected | Try again; Firecrawl retries with Playwright |
| Crawl times out (30 min limit) | Site too large or slow | Reduce `CRAWL_CONCURRENT_REQUESTS` |
| 404 on admin UI | Wrong `BULL_AUTH_KEY` | Check Dokploy env settings |

---

## Upgrade / Update

To update Firecrawl to latest version:

1. Edit `docker-compose.yml`: change `image: ghcr.io/firecrawl/*:latest`
2. Redeploy via Dokploy dashboard or:
   ```bash
   docker compose pull && docker compose up -d
   ```
3. Verify health: `curl -s http://100.83.38.48:3002/health`

---

## Disaster Recovery

**Complete service loss:**

1. Redeploy compose stack to Dokploy
2. Database volume persists — data is not lost
3. Tailscale endpoint remains available: `http://100.83.38.48:3002`
4. Service should be online within 5 minutes

**Data loss (volume deleted):**

1. Recreate volume: `docker volume create firecrawl_pgdata`
2. Restart containers: `docker compose up -d`
3. Database initializes from `nuq-postgres` image
4. All crawl history is lost, but service functions normally

---

Last updated: 2026-04-10
