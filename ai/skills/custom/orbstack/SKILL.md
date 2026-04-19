---
name: orbstack
description: OrbStack is the default local container runtime on this Mac. Use when running local services (Supabase, Firecrawl, etc.) in containers. Replaces Docker Desktop.
---

# OrbStack — Local Container Runtime

**OrbStack is the standard container runtime for local development on this Mac.** It replaces Docker Desktop.

## Purpose

OrbStack provides lightweight, fast local container execution for:
- **Local databases** (PostgreSQL via docker-compose)
- **Firecrawl** (web scraping API)
- **Other Docker-based tools** (redis, services, third-party apps)

All workflows use standard `docker` and `docker-compose` commands — they work identically to Docker Desktop but with better performance.

## Prerequisites

- OrbStack installed: `brew install orbstack`
- OrbStack running in background (add to Login Items if needed)
- Docker CLI available: `docker --version`
- docker-compose available: `docker-compose --version`

Verify:
```bash
orbstack info
docker ps
```

## When to use this skill

- Starting or stopping local services (databases, Firecrawl, etc.)
- Running docker-compose files for local development
- Inspecting local containers or volumes
- Troubleshooting local container issues
- Setting up or resetting local development environments

## Local PostgreSQL for development

Local application databases run as plain PostgreSQL containers in OrbStack. This is not a full Supabase server — just PostgreSQL for local development and testing.

**Standard location for app databases:**
```bash
~/Repos/stevewesthoek/brain/operations/database/standalone/<app-name>/docker-compose.yml
```

Each project has its own docker-compose.yml with a unique port. See the `docker-compose.yml` pattern at the end of this section.

**Start local PostgreSQL for an application:**
```bash
cd ~/Repos/stevewesthoek/brain/operations/database/standalone/<app-name>
docker-compose up -d
```

**Check status:**
```bash
docker-compose ps
docker-compose logs -f postgres
```

**Stop:**
```bash
docker-compose down
```

**Reset (wipe all data):**
```bash
docker-compose down -v  # -v removes named volumes
```

**Example docker-compose.yml for a new app:**
```yaml
volumes:
  data:

services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: myapp
    ports:
      - "5445:5432"  # Use a unique port per app
    volumes:
      - data:/var/lib/postgresql/data
```

**Why plain PostgreSQL?**
- Full Supabase server (auth, storage, API) runs in production only
- Local development needs only a database for migrations and testing
- Supabase CLI works against any PostgreSQL database
- One port per app prevents conflicts

## Firecrawl

Firecrawl runs as a multi-container docker-compose stack in OrbStack.

**Start:**
```bash
cd ~/Repos/stevewesthoek/brain/tools/firecrawl
docker-compose up -d
```

**Verify health:**
```bash
curl http://localhost:3051/health
```

**Logs:**
```bash
docker-compose logs api -f --tail 50
```

**Stop:**
```bash
docker-compose down
```

## Docker CLI basics (OrbStack-compatible)

All standard Docker commands work identically under OrbStack:

```bash
# List containers
docker ps
docker ps -a  # including stopped

# List images
docker images

# List volumes
docker volume ls

# Inspect container/volume
docker inspect <container-id>
docker volume inspect <volume-name>

# Execute command in running container
docker-compose exec <service-name> <command>

# View logs
docker-compose logs <service-name>
docker logs <container-id> -f --tail 50

# Remove stopped containers/images
docker container prune
docker image prune
```

## OrbStack vs Docker Desktop

| Feature | OrbStack | Docker Desktop |
|---------|----------|---|
| Performance | ⚡ Faster | Standard |
| Memory usage | 💾 Lower | Higher |
| UI | None (CLI only) | Desktop app |
| Pricing | Free | Free (paid tiers exist) |
| Local stack support | ✅ Full | ✅ Full |
| docker CLI | ✅ Yes | ✅ Yes |
| docker-compose | ✅ Yes | ✅ Yes |

## Troubleshooting

**OrbStack not running:**
```bash
orbstack start
```

**Container won't start:**
```bash
docker-compose logs <service-name>
# Check logs for errors, then fix and retry
```

**Port already in use:**
```bash
# Find what's using port 5433 (e.g.)
lsof -i :5433
# Kill process if safe, or change port in docker-compose.yml
```

**Disk space issues:**
```bash
# Clean up unused images, containers, volumes
docker system prune -a
```

## Local vs Production

| Environment | What runs | Access | Port |
|---|---|---|---|
| **Local** | PostgreSQL only (in OrbStack) | Direct access, safe to reset | Per-app unique port (5440+) |
| **Production** | Full self-hosted Supabase | Read-only from Mac; writes via CI/CD pipeline | Tailscale VPN (100.71.31.88:5433) |

**Never confuse the two.** Always verify which environment you're working with before running migrations.

## Related skills

- `/supabase` — Supabase CLI, migrations, schema management
- `/forge` — Uses OrbStack for local Supabase during product builds
- Docker CLI docs: https://docs.docker.com/engine/reference/commandline/

## Notes

- OrbStack is maintained by the Mac community and performs best on Apple Silicon (M1/M2/M3)
- All docker-compose files in this repo are OrbStack-compatible
- To uninstall OrbStack: `brew uninstall orbstack`
- Data persists in docker-compose named volumes unless explicitly deleted with `docker-compose down -v`
