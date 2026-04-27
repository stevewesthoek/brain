# Dokploy Runbook

## Architecture overview

All prochattools and yeshuaacademy apps follow the same deployment pipeline:

```
git push → GitHub Actions → Docker build → GHCR push → Dokploy pulls image → container restart
```

- **Nothing builds on the Dokploy VM.** All Docker builds run in GitHub Actions.
- **Dokploy is pull-only.** It pulls pre-built images from GHCR (`ghcr.io`).
- **One workflow per repo.** CI (lint/build check) and Docker build/deploy are merged into a single `Build and Deploy` workflow. No separate `ci.yml`.
- **Commit metadata flows through.** Every deployment in Dokploy's UI shows the real git commit message, author, date, and SHA.

---

## Setting up a new repo for Dokploy deployment

### 1. Create the Dockerfile

Use the standard template in `operations/deploy/dockerfile-standard.md`. Key points:
- Always `output: 'standalone'` in `next.config.js`
- Use the `runtime-deps` stage for newrelic, pg, and prisma (not cherry-picked from builder)
- Never use nixpacks — always `buildType: dockerfile`

### 2. Add the GitHub Actions workflow

Copy `operations/deploy/dokploy-image-deploy.yml` to `.github/workflows/deploy.yml` in the repo.

Adjust the CI env block for the app (APP_SLUG, DATABASE_URL, any SDK keys needed for build).

Remove the `postgres` service and migration steps if the app has no database.

### 3. Create the Dokploy application

In Dokploy dashboard:
- Create application under the correct project
- Source type: **Docker Image**
- Docker image: `ghcr.io/<org>/<repo>:latest`
- Set all runtime env vars (DATABASE_URL, SYSTEM_DATABASE_URL, APP_SLUG, NEW_RELIC_LICENSE_KEY, etc.)
- buildType: `dockerfile` (not nixpacks)

### 4. Set GHCR pull credentials on the app

**Critical: use username/password/registryUrl — NOT registryId.**

`registryId` triggers Registry Swarm mode (Dokploy tries to push the image), causing permission errors.

```bash
source ~/.config/dokploy/.env
curl -s -X POST "https://dokploy.prochat.tools/api/application.update" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "<app-id>",
    "username": "stevewesthoek",
    "password": "<ghp_PAT_with_read:packages>",
    "registryUrl": "ghcr.io",
    "registryId": null
  }'
```

### 5. Set GitHub secrets

```bash
source ~/.config/dokploy/.env
cd /path/to/repo
gh secret set DOKPLOY_API_KEY --body "$DOKPLOY_API_KEY"
gh secret set DOKPLOY_APP_ID --body "<app-id from step 3>"
```

Get the app ID via:
```bash
source ~/.config/dokploy/.env
curl -s "https://dokploy.prochat.tools/api/project.all" \
  -H "x-api-key: $DOKPLOY_API_KEY" | grep -o '"applicationId":"[^"]*","name":"<App Name>"'
```

### 6. Push to main

GitHub Actions builds the image, pushes to GHCR, then calls `POST /api/application.deploy` with:
- `title` = git commit subject
- `description` = author · date + SHA

The Dokploy deployments tab will show the real commit message.

---

## Day-to-day: triggering a redeploy

**Normal flow** — just push to main. The workflow handles everything.

**Manual redeploy** (without a code change):

```bash
source ~/.config/dokploy/.env
curl -s -X POST "https://dokploy.prochat.tools/api/application.deploy" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"applicationId": "<app-id>", "title": "Manual redeploy", "description": "Triggered manually"}'
```

---

## Checking deployment status

```bash
# All app statuses
source ~/.config/dokploy/.env
curl -s "https://dokploy.prochat.tools/api/project.all" \
  -H "x-api-key: $DOKPLOY_API_KEY" | grep -o '"name":"[^"]*","applicationStatus":"[^"]*"'

# Specific app
curl -s "https://dokploy.prochat.tools/api/application.one?applicationId=<app-id>" \
  -H "x-api-key: $DOKPLOY_API_KEY" | grep -o '"applicationStatus":"[^"]*"'

# Docker Swarm replicas
ssh dokploy "docker service ls --format 'table {{.Name}}\t{{.Image}}\t{{.Replicas}}'"

# Container logs
ssh dokploy "docker service logs <service-name> --tail 50"
```

---

## Deploy gate (apps with start-prod.sh)

Apps with `CMD ["bash", "scripts/runtime/start-prod.sh"]` run a deploy gate before starting Next.js. The deploy gate:
1. Checks required env vars (APP_SLUG, SYSTEM_DATABASE_URL, TENANT_DB_PASSWORD or DATABASE_URL)
2. Verifies `/var/backups/pgdump` bind mount exists and is writable
3. Runs `npm run db:init` (provisions tenant DB/schema/user via `pg`)
4. Backs up the database (pre-migration)
5. Runs `npm run db:migrate:prod` (runs `prisma migrate deploy`)
6. Smoke-checks the migration; auto-restores from backup if it fails

If any required env var is missing, the gate skips (setup mode) and starts the app directly.

**Required Dokploy env vars for deploy gate apps:**
- `APP_SLUG` — normalized repo name (lowercase, no separators: `olive-to-organizing` → `olivetoorganizing`)
- `SYSTEM_DATABASE_URL` — connection to shared postgres (system user with createdb privileges)
- `TENANT_DB_PASSWORD` — password for the per-app database user
- Bind mount: `/var/backups/pgdump` host → `/var/backups/pgdump` container (read-write)

---

## Rollback

```bash
# Redeploy a specific image tag (the SHA-tagged image is always available in GHCR)
source ~/.config/dokploy/.env
curl -s -X POST "https://dokploy.prochat.tools/api/application.update" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"applicationId": "<app-id>", "dockerImage": "ghcr.io/<org>/<repo>:<previous-sha>"}'

# Then trigger redeploy
curl -s -X POST "https://dokploy.prochat.tools/api/application.deploy" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"applicationId": "<app-id>", "title": "Rollback to <sha>"}'
```

---

## App inventory (Dokploy IDs)

| App | Repo | Dokploy App ID |
|-----|------|----------------|
| BuildFlow | stevewesthoek/buildflow | (to be assigned on provisioning) |
| Via di Eden | prochattools/via-di-eden | 34heLjzG-klSB3ja7ZSG5 |
| Proofly | prochattools/proofly | ub3NVzkB14Q-i3mNrIp0W |
| Says the Bible | prochattools/says-the-bible | FKwPG6tveeYFrbSsLmQA1 |
| JPV Bootcamp | prochattools/jpv-bootcamp | aPR9SvYn_JvGdMTk3CzeI |
| Olive to Organizing | prochattools/olive-to-organizing | xBuP3eoiwNO5l2qY_N_1h |
| ProChat | prochattools/prochat | QmLMK77LC0zEKE_qxGQ4L |
| Yeshua Academy | yeshuaacademy/yeshuaacademy | kPspytKHjCLuis1ijCnhB |
| Yeshua Finance | yeshuaacademy/finance | rUyCCZYOE0TIKoUKkqSGQ |
| Status Link | prochattools/statuslink | 1hooC9kE4Yn5SXmYI9DLg |

---

## Reference

- Workflow template: `operations/deploy/dokploy-image-deploy.yml`
- Dockerfile standard: `operations/deploy/dockerfile-standard.md`
- Skills: `dokploy-ghcr-pull-auth`, `nextjs-standalone-runtime-deps`, `dokploy-deploy-api-commit-metadata`
- Dokploy API key: `~/.config/dokploy/.env`
- Dokploy server: `https://dokploy.prochat.tools`
