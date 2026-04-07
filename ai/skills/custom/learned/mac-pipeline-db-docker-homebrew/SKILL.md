---
name: mac-pipeline-db-docker-homebrew
description: When a Mac-hosted nightly pipeline fails with "Can't reach database server at localhost:PORT" — diagnose whether Docker Desktop is the culprit and migrate to Homebrew PostgreSQL for always-on, unattended-safe local DB.
---

# Mac Pipeline DB: Docker → Homebrew PostgreSQL

## The insight

Docker Desktop is a GUI application. It requires an active user session, has a known memory leak that can consume all RAM, and cannot be guaranteed to be running at 3 AM when a cron job or launchctl scheduler fires. Any unattended pipeline (nightly batch, scheduler, background job) that depends on a Docker-hosted PostgreSQL is fragile by design.

Homebrew `postgresql@15` registered with `brew services` starts at login via launchctl, runs natively, and has no GUI dependency. It is the correct local DB for pipelines that must run unattended.

## When this applies

- A nightly batch log shows: `Can't reach database server at localhost:PORT`
- The error comes from Prisma: `Invalid prisma.<model>.findFirst() invocation`
- The pipeline ran perfectly during the day but consistently fails overnight
- `docker ps` returns: `failed to connect to the docker API at unix:///var/run/docker.sock`
- `brew services list | grep postgres` shows `none` or `stopped`

## The approach

1. **Read the batch log first** — `/tmp/stb-pipeline-batch.log` (or equivalent). The Prisma error will name the exact host:port.
2. **Check Docker** — `docker ps`. If it can't connect to the socket, Docker Desktop is not running.
3. **Check the `.env` port** — compare `DATABASE_URL` port against `docker-compose.yml` port mapping. Stale `.env` configs often have the wrong port independently of Docker being down.
4. **Decide: fix Docker or migrate to Homebrew** — if Docker Desktop has a memory leak or can't be trusted on this machine, migrate. Homebrew PG is always the safer choice for pipeline infra.

## The fix

### 1. Kill Docker Desktop (if it's leaking memory)
```bash
osascript -e 'quit app "Docker Desktop"'
```

### 2. Start Homebrew PostgreSQL
```bash
brew services start postgresql@15
pg_isready -h localhost -p 5432   # verify
```

This registers with launchctl — it will auto-start at every login.

### 3. Create the missing `postgres` superuser

Homebrew PostgreSQL creates a superuser named after your Mac system user (e.g. `Office`), **not** `postgres`. Prisma's shadow DB config typically uses `postgres`. Create it:

```bash
psql -h localhost -p 5432 -U $(whoami) -d postgres \
  -c "CREATE USER postgres SUPERUSER CREATEROLE CREATEDB;"
```

Without this step, `prisma migrate dev` will fail with `P1010: User was denied access`.

### 4. Create app user and database
```bash
psql -h localhost -p 5432 -U $(whoami) -d postgres <<'SQL'
CREATE USER saysthebible WITH PASSWORD '<password from .env>';
CREATE DATABASE saysthebible OWNER saysthebible;
SQL

psql -h localhost -p 5432 -U $(whoami) -d saysthebible <<'SQL'
CREATE SCHEMA IF NOT EXISTS saysthebible AUTHORIZATION saysthebible;
GRANT ALL PRIVILEGES ON DATABASE saysthebible TO saysthebible;
GRANT ALL PRIVILEGES ON SCHEMA saysthebible TO saysthebible;
GRANT ALL PRIVILEGES ON SCHEMA public TO saysthebible;
SQL
```

### 5. Fix `.env` port

Update `DATABASE_URL`, `SYSTEM_DATABASE_URL`, and `SHADOW_DATABASE_URL` from whatever stale port to `5432`.

### 6. Run migrations
```bash
npm run db:migrate:dev
```

### 7. Verify pipeline connectivity
```bash
node --env-file .env -e "
const { PrismaClient } = require('./node_modules/@prisma/client');
const p = new PrismaClient();
p.<anyModel>.count().then(n => { console.log('DB OK:', n); p.\$disconnect(); });
"
```

## Gotchas

- **Homebrew PG superuser is your Mac username, not `postgres`** — this is the #1 gotcha. Always create `postgres SUPERUSER` after setting up Homebrew PG.
- **`pg_hba.conf` uses `trust` by default** on Homebrew — no password needed for local connections, which is fine for dev/pipeline use.
- **Stale port in `.env` is independent of Docker being down** — even if Docker were running, a wrong port (e.g. 5441 instead of 5433) would still fail. Fix both.
- **Pre-flight YouTube sync restores DB state** — after setting up a fresh DB, the batch runner's pre-flight sync will re-populate records for already-uploaded videos from YouTube. No manual DB restore needed.
- **`restart: unless-stopped` in docker-compose doesn't help** if Docker Desktop itself isn't running. The container policy only applies within the Docker runtime.

## Context
Repo: says-the-bible  
Discovered: 2026-04-07  
Area: `scripts/pipeline/batch-run.mjs`, `.env`, `docker-compose.yml`
