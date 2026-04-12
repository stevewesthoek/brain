# Firecrawl Port Migration 3002 → 3051 — COMPLETE ✅

**Status:** FULLY OPERATIONAL AND TESTED  
**Date:** 2026-04-12  
**Port:** 3051 (migrated from 3002)  
**API Endpoint:** `http://100.83.38.48:3051`  

---

## What Was Done

### 1. Port Migration (Code & Documentation) ✓
- ✅ Updated docker-compose.yml: PORT, INTERNAL_PORT, and healthcheck
- ✅ Updated DEPLOY_INSTRUCTIONS.md: 7+ port references
- ✅ Updated operations/runbooks/firecrawl.md: Tailscale endpoint and all examples
- ✅ Updated ai/skills/custom/firecrawl/SKILL.md: 40+ API endpoint examples
- ✅ Updated CLAUDE.md: Tailscale endpoint reference
- ✅ Created test-api.sh: Automated verification script

### 2. Infrastructure Fixes ✓

**RabbitMQ Issue:** RESOLVED
- Upgraded from `rabbitmq:3-management` to `rabbitmq:3.12-management-alpine`
- Fixed `.erlang.cookie` permission error
- RabbitMQ now runs healthy and is fully functional

**Database Schema:** INITIALIZED
- Extracted schema from nuq-postgres container
- Fixed pg_cron extension issue (moved to postgres database)
- Created all required tables:
  - `nuq.queue_scrape` — Main scraping job queue
  - `nuq.queue_crawl_finished` — Crawl completion tracking
  - `nuq.queue_scrape_backlog` — Backlogged jobs
  - `nuq.group_crawl` — Group crawl management
- Created 17 indexes for query optimization
- Created 2 custom ENUM types: `job_status`, `group_status`

### 3. Testing & Verification ✓

**API Tests:**
- ✅ API connectivity: HTTP 200
- ✅ Single URL scrape: Working (tested with example.com)
- ✅ Web search: Working (returns 3+ results)
- ✅ Response structure: Correct (contains success + data fields)

**Container Status:**
- ✅ firecrawl-api-1: Running
- ✅ firecrawl-rabbitmq-1: Running (healthy)
- ✅ firecrawl-nuq-postgres-1: Running
- ✅ firecrawl-redis-1: Running
- ✅ firecrawl-playwright-service-1: Running

---

## Key Changes

| Component | Before | After | Status |
|-----------|--------|-------|--------|
| API Port | 3002 | 3051 | ✅ Changed |
| Tailscale Endpoint | http://100.83.38.48:3002 | http://100.83.38.48:3051 | ✅ Updated |
| RabbitMQ Image | rabbitmq:3-management | rabbitmq:3.12-management-alpine | ✅ Fixed |
| Database Schema | Missing | Fully initialized | ✅ Created |
| Documentation | Port 3002 (40+ refs) | Port 3051 (40+ refs) | ✅ Updated |
| Tests | None | test-api.sh | ✅ Added |

---

## How to Use

### Access the API

```bash
# From Tailscale network:
curl -X POST http://100.83.38.48:3051/v1/scrape \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://example.com",
    "formats": ["markdown"]
  }'
```

### Endpoints Available

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/scrape` | POST | Scrape single URL to markdown |
| `/v1/search` | POST | Web search + scrape results |
| `/v1/crawl` | POST | Start async site crawl |
| `/v1/crawl/:id` | GET | Check crawl status |
| `/admin/<BULL_AUTH_KEY>/queues` | GET | Job queue admin UI |

### Test the API

```bash
# Run automated tests:
bash ./operations/deploy/firecrawl/test-api.sh

# Or manual test:
curl -s http://100.83.38.48:3051/v1/scrape \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","formats":["markdown"]}' | jq '.success'
```

---

## No Data Loss Guarantee ✓

- ✅ Fresh database initialized from official Firecrawl schema
- ✅ No existing data was touched (fresh deployment)
- ✅ Database volume is persistent in Docker
- ✅ All initialization scripts executed successfully
- ✅ No rollback needed — deployment is clean and complete

---

## Deployment Location

**Docker Compose:** `~/firecrawl-final` on Dokploy server  
**Database:** PostgreSQL container with persistent volume  
**Configuration:** Optimized for high concurrency (16GB WAL, aggressive background writer)

---

## Next Steps

1. ✅ Verify API works in production (tests passed)
2. ✅ Monitor container memory/CPU (currently stable)
3. ✅ Update any client references from port 3002 → 3051
4. ✅ All code and docs already updated — nothing else needed

---

## Git Commits

| Commit | Description |
|--------|-------------|
| 345ef8d | Migrate Firecrawl API port from 3002 to 3051 |
| ea2d4c9 | Add deployment documentation, test script, troubleshooting guide |
| 157ef6b | Update deployment status: RabbitMQ fixed, database schema needed |
| 96171c7 | Database schema initialized - Firecrawl API fully operational |

---

## Maintenance

**Health Check:**
```bash
curl -s http://100.83.38.48:3051/ && echo "API is up"
```

**View Logs:**
```bash
ssh dokploy 'cd ~/firecrawl-final && docker compose logs api -f --tail 50'
```

**Restart (if needed):**
```bash
ssh dokploy 'cd ~/firecrawl-final && docker compose restart api'
```

**Backup Database:**
```bash
ssh dokploy 'cd ~/firecrawl-final && \
  docker compose exec -T nuq-postgres pg_dump -U firecrawl -d firecrawl > firecrawl_backup.sql'
```

---

## Summary

✅ **Port migration complete and tested**  
✅ **All infrastructure issues resolved**  
✅ **Database fully initialized with zero data loss**  
✅ **API fully operational on port 3051**  
✅ **All documentation updated**  
✅ **Ready for production use**

Firecrawl is now running on port **3051** with all functionality working correctly.

---

**Last Updated:** 2026-04-12  
**Status:** PRODUCTION READY ✅
