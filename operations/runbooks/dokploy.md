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
curl -sS "$DOKPLOY_URL/project.all" \
  -H "x-api-key: $DOKPLOY_API_KEY" | python3 -m json.tool | head -100

# Specific app status
source ~/.config/dokploy/.env
curl -sS "$DOKPLOY_URL/application.one?applicationId=<app-id>" \
  -H "x-api-key: $DOKPLOY_API_KEY" | python3 -m json.tool

# Docker Swarm replicas
ssh dokploy "docker service ls --format 'table {{.Name}}\t{{.Image}}\t{{.Replicas}}'"

# Container logs
ssh dokploy "docker service logs <service-name> --tail 50"
```

---

## Dokploy API reference

All Dokploy API calls use the central credential file `~/.config/dokploy/.env` and the header `x-api-key`.

**Central credential location:**
```
~/.config/dokploy/.env
```

Required variables:
```text
DOKPLOY_API_KEY=[your-api-key]
DOKPLOY_URL=https://dokploy.prochat.tools/api
DOKPLOY_API_HEADER=x-api-key
```

**Safe, non-secret discovery pattern:**

```bash
source ~/.config/dokploy/.env

# List all projects and apps (no secrets in output)
curl -sS "$DOKPLOY_URL/project.all" \
  -H "$DOKPLOY_API_HEADER: $DOKPLOY_API_KEY" \
  | python3 -m json.tool | head -80
```

**Important:** 
- Never print `$DOKPLOY_API_KEY` in logs or output
- Do not copy the API key into repo docs, scripts, or GitHub secrets (except repo-specific GitHub Actions secrets)
- Use environment variables and redirection to keep credentials out of command history
- The packaged `dokploy-cli verify` command is unreliable (returns 401); use direct API calls instead

**Common endpoints:**
- `GET $DOKPLOY_URL/project.all` — list all projects and apps
- `GET $DOKPLOY_URL/application.one?applicationId=<id>` — get app details
- `POST $DOKPLOY_URL/application.deploy` — trigger app deployment
- `POST $DOKPLOY_URL/application.update` — update app config
- `DELETE $DOKPLOY_URL/application.delete` — delete application (use with caution)

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
- `APP_SLUG` — normalized repo name (lowercase, no separators: `oliveto-organizing` → `olivetoorganizing`)
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

## Updating Dokploy Server (Safe with Rollback)

**CRITICAL: Always capture the current state and backup before updating. You must be logged into the Dokploy server to run these commands.**

Dokploy runs as **Docker Swarm services**, not docker-compose. All commands use `docker service` and require `sudo`.

### Step 1: Delete old backup and create new backup

**Delete the previous backup** (from the last upgrade, if it exists):

```bash
rm -f /var/backups/dokploy-db-backup-*.tar.gz
```

This ensures we only keep one backup at a time — the current one.

Capture the current Dokploy image version (for rollback):

```bash
sudo docker inspect dokploy | grep -i image
```

**Note the version output** — you'll need it if you need to rollback (e.g., `v0.29.2`).

**Create a new backup of the Dokploy database:**

```bash
mkdir -p /var/backups && sudo docker run --rm -v dokploy_postgres:/data -v /var/backups:/backup alpine tar czf /backup/dokploy-db-backup-$(date +%s).tar.gz -C /data . && echo "✓ Backup complete"
```

Wait for the backup to complete (~30 seconds). You'll see `✓ Backup complete` when done.

Verify the backup file exists:

```bash
ls -lh /var/backups/dokploy-db-backup-*.tar.gz
```

You should see exactly **one** backup file.

### Step 2: Pull the latest Dokploy image and update the service

Pull the latest Dokploy image:

```bash
sudo docker pull dokploy/dokploy:latest
```

Update the Dokploy service to use the new image (this triggers a rolling restart):

```bash
sudo docker service update --image dokploy/dokploy:latest dokploy && echo "✓ Service update triggered"
```

Expected output: `dokploy` followed by progress indication, then `verify: Service dokploy converged`.

### Step 3: Wait for the new container to start and verify it's healthy

Wait 15 seconds for the container to start:

```bash
sleep 15
```

Verify the service is running and the image has updated:

```bash
sudo docker service ls --filter name=dokploy
```

Check the IMAGE column — it should now show `dokploy/dokploy:latest` instead of the old version.

Verify the new container is healthy:

```bash
sudo docker ps | grep dokploy
```

The STATUS column should show `Up X seconds (healthy)`.

### Step 4: Verify all deployed apps are still running (run this from your local Mac)

Exit the SSH session:

```bash
exit
```

On your local Mac, verify the API is responding and all apps are still deployed:

```bash
source ~/.config/dokploy/.env && curl -sS "$DOKPLOY_URL/project.all" -H "$DOKPLOY_API_HEADER: $DOKPLOY_API_KEY" | python3 -m json.tool | grep -E '"name"|"applicationStatus"|"composeStatus"' | head -100
```

All apps should show either `"applicationStatus": "done"` or `"composeStatus": "done"`.

### Step 5: Cleanup (after successful upgrade)

**Once you confirm everything is working,** the old backup (from before this upgrade) is now obsolete. At the start of the **next** upgrade, it will be deleted in Step 1.

**You now have:**
- ✅ New Dokploy version running
- ✅ One backup of this new version on disk
- ✅ Ready for the next upgrade

---

## Rollback if update fails

If the new container doesn't start or apps aren't responding, rollback to the previous version.

### Rollback Step 1: Get the previous version

From your captured version in Step 1, identify the version you want to rollback to (e.g., `v0.29.2`).

### Rollback Step 2: Update service to previous image

SSH back into the Dokploy server (or if you're still logged in, just run this):

```bash
sudo docker service update --image dokploy/dokploy:<previous-version> dokploy && echo "✓ Service rollback triggered"
```

Replace `<previous-version>` with the version from Step 1 (e.g., `v0.29.2`).

### Rollback Step 3: Wait and verify

Wait 15 seconds:

```bash
sleep 15
```

Verify the service has rolled back:

```bash
sudo docker service ls --filter name=dokploy
```

The IMAGE column should show the old version again.

Verify the container is healthy:

```bash
sudo docker ps | grep dokploy
```

### Rollback Step 4: Verify apps are running

Exit SSH and check from your local Mac:

```bash
exit
```

```bash
source ~/.config/dokploy/.env && curl -sS "$DOKPLOY_URL/project.all" -H "$DOKPLOY_API_HEADER: $DOKPLOY_API_KEY" | python3 -m json.tool | grep -E '"name"|"applicationStatus"|"composeStatus"' | head -100
```

All apps should show `"done"` status again.

---

## Database recovery (if corrupted after update)

If the Dokploy database is corrupted and you need to restore from backup:

### Recovery Step 1: Stop the service and remove corrupted volume

```bash
sudo docker service update --force dokploy
```

Wait for the service to stop:

```bash
sleep 10
```

Remove the corrupted postgres volume:

```bash
sudo docker volume rm dokploy_postgres
```

### Recovery Step 2: Restore from backup

Restore the database from the backup file (use the timestamp from Step 1, e.g., `1716988800`):

```bash
sudo docker run --rm -v dokploy_postgres:/data -v /var/backups:/backup alpine tar xzf /backup/dokploy-db-backup-<timestamp>.tar.gz -C /data
```

Replace `<timestamp>` with the backup file's timestamp.

### Recovery Step 3: Restart the service

Restart the Dokploy service:

```bash
sudo docker service update --force dokploy
```

Wait 15 seconds:

```bash
sleep 15
```

Verify it's healthy:

```bash
sudo docker ps | grep dokploy
```

### Recovery Step 4: Verify from local Mac

Exit SSH:

```bash
exit
```

Verify the API and apps are responding:

```bash
source ~/.config/dokploy/.env && curl -sS "$DOKPLOY_URL/project.all" -H "$DOKPLOY_API_HEADER: $DOKPLOY_API_KEY" | python3 -m json.tool | grep -E '"name"|"applicationStatus"|"composeStatus"' | head -100
```

---

## App inventory (Dokploy IDs)

| App | Repo | Dokploy App ID | Status |
|-----|------|----------------|--------|
| BuildFlow | stevewesthoek/buildflow | (to be assigned on provisioning) | Pending |
| Via di Eden | prochattools/via-di-eden | 34heLjzG-klSB3ja7ZSG5 | Active |
| Proofly | prochattools/proofly | ub3NVzkB14Q-i3mNrIp0W | Active |
| Says the Bible | prochattools/says-the-bible | FKwPG6tveeYFrbSsLmQA1 | Active |
| JPV Bootcamp | prochattools/jpv-bootcamp | aPR9SvYn_JvGdMTk3CzeI | Active |
| Oliveto Organizing | prochattools/oliveto-organizing | xBuP3eoiwNO5l2qY_N_1h | Active |
| ProChat | prochattools/prochat | QmLMK77LC0zEKE_qxGQ4L | Active |
| Yeshua Academy | yeshuaacademy/yeshuaacademy | kPspytKHjCLuis1ijCnhB | Active |
| Yeshua Finance | yeshuaacademy/finance | rUyCCZYOE0TIKoUKkqSGQ | Active |
| Status Link | prochattools/statuslink | 1hooC9kE4Yn5SXmYI9DLg | Active |

**Deleted (local-only apps):**
- Family Finance (app ID: `uMrNEbM2ROMb8z6PD3-O0`) — deleted 2026-05-03, local-only app maintained at localhost:3060 via ProBot

---

## Reference

- Workflow template: `operations/deploy/dokploy-image-deploy.yml`
- Dockerfile standard: `operations/deploy/dockerfile-standard.md`
- Skills: `dokploy-ghcr-pull-auth`, `nextjs-standalone-runtime-deps`, `dokploy-deploy-api-commit-metadata`
- Dokploy API key: `~/.config/dokploy/.env`
- Dokploy server: `https://dokploy.prochat.tools`
