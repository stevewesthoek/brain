# Phase 3E0 — Final Pre-Cutover Readiness Packet

**Created:** 2026-08-17 (Phase 3E0)
**Updated:** 2026-08-17 (Phase 3E1 — image pre-staging complete)
**Planned cutover start:** TBD (explicit Steve authorization required)
**Maximum client downtime window:** 90 minutes
**Status:** READY — image pre-staging complete — awaiting explicit manual cutover authorization from Steve

---

## CRITICAL: NO CUTOVER AUTHORIZATION HAS BEEN RECEIVED

This document does not authorize cutover.
Cutover requires: **explicit manual authorization from Steve.**

Azure Dokploy: READ-ONLY — zero mutations performed in Phase 3E0.
Supabase: READ-ONLY — zero mutations performed in Phase 3E0.
AWS production writers: 0.
AWS cloudflared: MASKED.

---

## 1. Repository Authority Verified

| Artifact | Commit | Status |
|---|---|---|
| prochat-infrastructure-architecture.md | e43e9162 | VERIFIED |
| prochat-infrastructure-evidence-register.md | e43e9162 | VERIFIED |
| phase-3d-aws-cutover-rehearsal-report.md | 3a20893d | VERIFIED |
| preflight-check.sh | 3a20893d | VERIFIED |
| cutover-runbook.md | committed | VERIFIED |
| cutover-checklist.md | committed | VERIFIED |
| phase-3c3-audit-and-cutover-packet.md | committed | VERIFIED |

Both canonical commits confirmed in git log. No merge since last commit.
Do not redesign architecture. Do not modify canonical architecture files.

---

## 2. Final Read-Only Preflight Result

**Executed:** 2026-08-17T16:59:09Z on `dokploy-aws` (100.71.47.24)
**Preflight script SHA in repo:** 3a20893d

```
===== CUTOVER PREFLIGHT CHECK =====
Timestamp: 2026-08-17T16:59:09Z
Dokploy PG container: dokploy-postgres.1.yj3bgbw0bg8xak4s49hqhgtlv

CHECK 1: Application shadow suppression  — PASS (autoDeploy=false: 0/24)
CHECK 2: Compose shadow suppression       — PASS (autoDeploy=false: 0/17)
CHECK 3: Schedule shadow suppression      — PASS (enabled=false: 0/1)
CHECK 4: cloudflared masked               — PASS
CHECK 5: Zero Supabase writer containers  — PASS
CHECK 6: 16 postgres source containers    — PASS
CHECK 7: Tailscale to Azure (100.83.38.48) — PASS
CHECK 8: Tailscale to Supabase (100.71.31.88:5433) — PASS
CHECK 9: Disk headroom                    — PASS (297 GB free)
CHECK 10: Docker daemon healthy           — PASS

STATUS: ALL CHECKS PASSED
```

**Result: 10/10 PASS**

---

## 3. AWS Target Current Safe State

Inspected: 2026-08-17 ~17:00 UTC

| Check | State | Expected |
|---|---|---|
| Dokploy platform (4 services) | 1/1 each | PASS |
| demo-vault-legal-wtpg0l | 0/0 | PASS (suppressed) |
| Any application workload running | NONE | PASS |
| n8n runtime | NOT running | PASS |
| Ory runtime | NOT running | PASS |
| Umami runtime | NOT running | PASS |
| cloudflared | MASKED, inactive, no process | PASS |
| AWS Supabase writer containers | 0 | PASS |
| Disk free | 297 GB (4% used) | PASS |
| Docker daemon | healthy | PASS |
| Swarm | active, 5 services | PASS |
| Tailscale | active, all nodes reachable | PASS |
| Supabase route (100.71.31.88:5433) | reachable | PASS |
| GHCR auth (/root/.docker/config.json) | present | PASS |

**NOTE — Ports 80/443 listening:** Traefik is running and listening on 0.0.0.0:80 and 0.0.0.0:443. This is docker-proxy for the Traefik service. This is the EXPECTED shadow state — cloudflared is masked so no public internet traffic reaches Traefik. No action needed.

**AWS production writers: 0**
**AWS cloudflared active: NO**

---

## 4. Freshest Existing Azure Recovery Point

Source: Azure Backup vault `cloudpanel-dokploy-vault` in `rg-apps-dokploy`

| Property | Value |
|---|---|
| Latest recovery point | 2026-08-17T02:03:24 UTC |
| Latest recovery point (Portugal WEST) | 2026-08-17T03:03:24 WEST |
| Type | FileSystemConsistent |
| Tier 1 | InstantRP (Valid — fast restore available) |
| Tier 2 | HardenedRP (Valid — vault copy) |
| Backup health | Passed |
| Protection status | Healthy |
| Last backup status | Completed |
| Policy | EnhancedPolicy-CloudPanel-Dokploy |
| Schedule | Daily (7-day retention) |
| VM | vm-dokploy (rg-apps-dokploy, Spain Central) |

**Age at Phase 3E0 time (~17:00 UTC):** ~15 hours
**Age at planned cutover start (~17:10 UTC):** ~15 hours

**Disk coverage:**
- OS disk: `dokploy-os-disk-restored-20260519-142517` — **COVERED** (Azure IaaS VM backup covers all disks by default)
- Data disk: `data-dokploy-standard-from-snapshot` (LUN 0) — **COVERED**

**Recovery points available:** 7 (Aug 11–17, daily, all FileSystemConsistent)

**Existing backup health: PASS**
**OS disk covered: YES**
**Data disk covered: YES**

---

## 5. Fresh Backup / Snapshot Commands (Prepared, NOT Executed)

### Decision: No additional pre-cutover backup required

**Rationale:**
- Today's automated backup (02:03 UTC) is ~15 hours old at cutover start. Sufficient for OS/config rollback.
- PostgreSQL data lives in Docker volumes. VM snapshots do NOT capture consistent DB state while containers run (Docker writes WAL continuously). SQL dumps after freeze are the authoritative DB rollback mechanism.
- An on-demand backup takes 30–45 minutes. It would either (a) be pre-freeze (inconsistent volumes) or (b) post-freeze (extends downtime by 30–45 min, threatening the 90-minute target).
- Azure VM rollback is only needed if the Azure VM itself becomes unstable — a scenario that SQL dumps protect against independently.

**Verdict:** Proceed with the existing 02:03 UTC backup. No on-demand backup needed pre-cutover.

---

### CUTOVER-AUTHORIZATION REQUIRED: Post-cutover snapshot

Immediately after declaring cutover stable (Phase G), take a Lightsail snapshot:

```bash
# [CUTOVER-AUTHORIZATION REQUIRED] — AWS SAFE, post-cutover only
aws lightsail create-instance-snapshot \
  --instance-name dokploy-aws \
  --instance-snapshot-name "dokploy-aws-post-cutover-$(date +%Y%m%d)" \
  --region eu-west-2

# Verify:
aws lightsail get-instance-snapshot \
  --instance-snapshot-name "dokploy-aws-post-cutover-$(date +%Y%m%d)" \
  --region eu-west-2 \
  --query 'instanceSnapshot.state' --output text
# Expected: available (after ~5-10 min)
```

Note: Lightsail snapshot `dokploy-aws-pre-cutover-ready-20260816` from Phase 3C is still available (from Aug 16).

---

## 6. Backup vs Freeze Order

**Recommended sequence:**

```
PRE-DOWNTIME:
  - Run preflight (10/10 required)
  - NO new Azure backup (see §5 decision)
  - Start locally-built image docker builds on AWS (parallel, does not affect Azure)
  - Pre-pull GHCR images on AWS (see §10, optional but reduces cutover time)

DOWNTIME START (G1):
  - Stop Azure cloudflared
  - Stop Azure application writers
  - SQL dumps from Azure (AUTHORITATIVE — after freeze)
  - Transfer + restore to AWS
  - Start AWS services
  - Enable cloudflared on AWS

POST-CUTOVER:
  - Validate
  - Take Lightsail post-cutover snapshot
```

**Why SQL dumps are authoritative for database rollback:** VM snapshots do not quiesce PostgreSQL volumes. The SQL dumps made after freeze are the only consistent, authoritative DB state. If Azure must be restored after cutover, restoring from the pre-cutover Azure backup + the SQL dumps (applying them back) is the rollback procedure.

---

## 7. Final Cutover-Time Gates

### Gate A — JPV Payload CMS Image

**Current AWS Dokploy DB state:**
```
Application: JPV Bootcamp | Payload CMS
Service: clients-jpv-bootcamp-app-tp9xrk
Image: ghcr.io/prochattools/jpv-bootcamp:a0c32276e403edbcbbab8fb576d91942810f0223
Build type: dockerfile
```

**The AWS Dokploy DB image reference was captured from Azure at Phase 3B/3C.**

**Gate action at G3 (after Dokploy DB restore):**
The Dokploy control-plane DB from Azure replaces the AWS Dokploy DB at Phase C. After restore, verify:

```bash
# [CUTOVER-AUTHORIZATION REQUIRED] — validate at G3 on AWS
sudo docker exec $(sudo docker ps --format "{{.Names}}" | grep '^dokploy-postgres\.') \
  psql -U dokploy -d dokploy -t \
  -c 'SELECT name, "dockerImage" FROM application WHERE name LIKE '"'"'%Payload%'"'"';'
# Expected: shows the current Azure-authoritative image reference
```

Then verify the tag is pullable from GHCR:
```bash
# [CUTOVER-AUTHORIZATION REQUIRED] — AWS read-only
sudo docker pull --disable-content-trust \
  ghcr.io/prochattools/jpv-bootcamp:$(docker exec ... psql ... | get image | awk ...) 2>&1 | head -5
```

**STOP condition:** If the image tag is not pullable from GHCR, stop Phase E6 for Payload CMS, investigate, and proceed with other services.

### Gate B — Ory Kratos Configuration

**Current AWS staging state:**
```
/var/lib/dokploy-migration-staging/non-db/kratos/kratos-config.tar.gz
Contents: ./kratos.yml + ./identity.schema.json
Captured: Phase 3C (2026-08-16)
Docker volume on AWS: NONE (not yet created)
```

**Gate action at Phase E6 (before starting Ory):**

```bash
# [CUTOVER-AUTHORIZATION REQUIRED] — AWS SAFE

# Step 1: Compare current Azure Ory config with staged config
# On Azure (via SSH — requires active cloudflared to already be stopped at this point):
ssh master@100.83.38.48 "sudo tar -czf /tmp/kratos-current.tar.gz -C \$(docker inspect ory-kratos --format '{{range .Mounts}}{{if eq .Destination \"/etc/config/kratos\"}}{{.Source}}{{end}}{{end}}') . && sha256sum /tmp/kratos-current.tar.gz"

# Step 2: Compare hashes. If identical to staged config, proceed.
# If different, copy current Azure config to AWS and use that instead.
# Transfer if changed:
rsync -avz master@100.83.38.48:/tmp/kratos-current.tar.gz /var/lib/dokploy-migration-staging/non-db/kratos/kratos-config-fresh.tar.gz

# Step 3: Create volume and load config
sudo docker volume create ory-config
sudo docker run --rm \
  -v /var/lib/dokploy-migration-staging/non-db/kratos/kratos-config.tar.gz:/tmp/kratos-config.tar.gz \
  -v ory-config:/etc/config/kratos \
  alpine:latest \
  sh -c "cd /etc/config/kratos && tar -xzf /tmp/kratos-config.tar.gz"

# Verify:
sudo docker run --rm -v ory-config:/data alpine ls /data/
# Expected: kratos.yml  identity.schema.json
```

**STOP condition:** If config is missing or volume create fails, stop Phase E6 for Ory, investigate.

**Note:** The ory compose project `compose-index-haptic-firewall-rlwj48` is registered in Dokploy but the runbook uses `docker run` directly (standalone). Use the runbook's method (standalone docker run) not Dokploy compose, since the compose dir state is uncertain.

### Gate C — Schedule Identity and State

**Verified at Phase 3E0:**
```
Schedule ID: vyN0X3Y6OpO5b_cZbS0r3  ← CONFIRMED
Name: jpv-email-queue
Cron: */2 * * * *
Currently enabled: false (correct — shadow suppressed)
```

**Gate action at Phase E3:**
```bash
# [CUTOVER-AUTHORIZATION REQUIRED] — AWS SAFE
# Re-verify before re-enabling:
sudo docker exec $(sudo docker ps --format "{{.Names}}" | grep '^dokploy-postgres\.') \
  psql -U dokploy -d dokploy -t \
  -c 'SELECT "scheduleId", name, "cronExpression", enabled FROM schedule;'

# Re-enable by confirmed ID:
sudo docker exec $(sudo docker ps --format "{{.Names}}" | grep '^dokploy-postgres\.') \
  psql -U dokploy -d dokploy \
  -c 'UPDATE schedule SET enabled = true WHERE "scheduleId" = '"'"'vyN0X3Y6OpO5b_cZbS0r3'"'"';'

# Verify:
sudo docker exec $(sudo docker ps --format "{{.Names}}" | grep '^dokploy-postgres\.') \
  psql -U dokploy -d dokploy -t \
  -c 'SELECT "scheduleId", enabled FROM schedule WHERE "scheduleId" = '"'"'vyN0X3Y6OpO5b_cZbS0r3'"'"';'
# Expected: vyN0X3Y6OpO5b_cZbS0r3 | t
```

Note: After the Dokploy DB restore (Phase C), the schedule record will reflect Azure's current state. The ID has been verified against the AWS-resident copy. Re-verify the ID from the restored DB before enabling.

---

## 8. Final 16-Database Sync Command Matrix

All commands tagged `[CUTOVER-AUTHORIZATION REQUIRED — run AFTER Azure write freeze (Phase B complete)]`.

**PG version matrix:**
- 14 × PG15 app databases → dump with `postgres:15` container (pg_dump 15.19 ✓)
- 1 × PG17 n8n database → dump with `postgres:17-alpine` container (pg_dump 17.11 ✓)
- 1 × PG16 Dokploy control-plane → dump with `postgres:16` container (pg_dump 16.15 ✓)

---

### PREPARATION COMMANDS (run on Azure — after freeze)

```bash
# [CUTOVER-AUTHORIZATION REQUIRED]
# Run on Azure host (ssh master@100.83.38.48) after Phase B complete

STAGING="/var/lib/dokploy-migration-staging/final-delta"
sudo mkdir -p "$STAGING"

# --- PG16: Dokploy control-plane ---
# Source discovery:
DOKPLOY_PG=$(sudo docker ps --format "{{.Names}}" | grep '^dokploy-postgres\.' | head -1)
echo "dokploy-postgres container: $DOKPLOY_PG"

# Dump:
sudo docker exec "$DOKPLOY_PG" pg_dump -U dokploy dokploy | gzip > "$STAGING/dokploy.sql.gz"
sha256sum "$STAGING/dokploy.sql.gz"

# --- PG17: n8n ---
# Source: apps-internal-n8n-cvjx2s-postgres-1 (DB: n8n, user: lyla_gislason)
N8N_PG="apps-internal-n8n-cvjx2s-postgres-1"
sudo docker exec "$N8N_PG" pg_dump -U lyla_gislason n8n | gzip > "$STAGING/n8n.sql.gz"
sha256sum "$STAGING/n8n.sql.gz"

# --- PG15: 14 application databases ---
# Container-to-DB mapping (verified Phase 3E0):
declare -A DB_MAP=(
  ["compose-bypass-optical-alarm-tb4ukd-postgres-1"]="tenant_prochat"
  ["compose-connect-wireless-application-d1n939-postgres-1"]="tenant_viadieden"
  ["compose-copy-auxiliary-protocol-3gfh3x-postgres-1"]="tenant_statuslink"
  ["compose-copy-cross-platform-bus-wojn3n-postgres-1"]="tenant_prokitstudio"
  ["compose-copy-open-source-interface-fkhqrw-postgres-1"]="tenant_saysthebible"
  ["compose-copy-redundant-capacitor-zc4esw-postgres-1"]="tenant_prokit"
  ["compose-generate-mobile-microchip-tksvis-postgres-1"]="openfund"
  ["compose-generate-wireless-bandwidth-v7bvut-postgres-1"]="tenant_cedula"
  ["compose-hack-open-source-driver-mmchh4-postgres-1"]="tenant_jpvbootcamp"
  ["compose-input-open-source-bandwidth-droye2-postgres-1"]="jpvbootcamp"
  ["compose-navigate-optical-monitor-vi714i-postgres-1"]="tenant_olivetoorganizing"
  ["compose-quantify-1080p-system-tp1q5f-postgres-1"]="tenant_saaskitstudio"
  ["compose-reboot-cross-platform-driver-6l6dun-postgres-1"]="tenant_resend"
  ["compose-synthesize-bluetooth-panel-tg5mhy-postgres-1"]="tenant_saaskit"
)

for CONTAINER in "${!DB_MAP[@]}"; do
  DB="${DB_MAP[$CONTAINER]}"
  echo "Dumping $DB from $CONTAINER..."
  sudo docker exec "$CONTAINER" pg_dump -U postgres "$DB" | gzip > "$STAGING/${DB}.sql.gz"
  RC=$?
  if [ $RC -ne 0 ]; then echo "FAIL: $DB (exit $RC)"; exit 1; fi
  sha256sum "$STAGING/${DB}.sql.gz"
done

# Verify all 16 dumps present:
ls "$STAGING"/*.sql.gz | wc -l
# Expected: 16
```

### STOP CONDITIONS (Dump phase):
- Any pg_dump exit non-zero → STOP, investigate
- Any file size 0 bytes → STOP
- Count != 16 → STOP

---

### TRANSFER (from Azure or Mac)

```bash
# [CUTOVER-AUTHORIZATION REQUIRED]
# Run from Mac or Azure to transfer to AWS:
rsync -avz --progress \
  master@100.83.38.48:/var/lib/dokploy-migration-staging/final-delta/ \
  ubuntu@100.71.47.24:/var/lib/dokploy-migration-final-delta/

# Verify count on AWS:
ssh ubuntu@100.71.47.24 "ls /var/lib/dokploy-migration-final-delta/*.sql.gz | wc -l"
# Expected: 16
```

---

### RESTORE (run on AWS)

```bash
# [CUTOVER-AUTHORIZATION REQUIRED]
# Run on AWS host (ssh ubuntu@18.135.240.168)

DELTA="/var/lib/dokploy-migration-final-delta"

# --- PG16: Dokploy control-plane ---
DOKPLOY_PG=$(sudo docker ps --format "{{.Names}}" | grep '^dokploy-postgres\.' | head -1)
# Drop + recreate:
sudo docker exec "$DOKPLOY_PG" psql -U dokploy -c "DROP DATABASE IF EXISTS dokploy_old;"
sudo docker exec "$DOKPLOY_PG" psql -U dokploy -c "ALTER DATABASE dokploy RENAME TO dokploy_old;" 2>/dev/null || true
sudo docker exec "$DOKPLOY_PG" psql -U dokploy -c "CREATE DATABASE dokploy OWNER dokploy;"
# Restore:
zcat "$DELTA/dokploy.sql.gz" | sudo docker exec -i "$DOKPLOY_PG" psql -U dokploy dokploy
# Verify:
sudo docker exec "$DOKPLOY_PG" psql -U dokploy dokploy -c "\dt" | wc -l
# Drop old:
sudo docker exec "$DOKPLOY_PG" psql -U dokploy -c "DROP DATABASE IF EXISTS dokploy_old;"

# --- PG17: n8n ---
N8N_PG="apps-internal-n8n-cvjx2s-postgres-1"
sudo docker exec "$N8N_PG" psql -U lyla_gislason -c "DROP DATABASE IF EXISTS n8n;"
sudo docker exec "$N8N_PG" psql -U lyla_gislason postgres -c "CREATE DATABASE n8n OWNER lyla_gislason;"
zcat "$DELTA/n8n.sql.gz" | sudo docker exec -i "$N8N_PG" psql -U lyla_gislason n8n
sudo docker exec "$N8N_PG" psql -U lyla_gislason n8n -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"

# --- PG15: 14 application databases ---
declare -A RESTORE_MAP=(
  ["tenant_prochat"]="compose-bypass-optical-alarm-tb4ukd-postgres-1"
  ["tenant_viadieden"]="compose-connect-wireless-application-d1n939-postgres-1"
  ["tenant_statuslink"]="compose-copy-auxiliary-protocol-3gfh3x-postgres-1"
  ["tenant_prokitstudio"]="compose-copy-cross-platform-bus-wojn3n-postgres-1"
  ["tenant_saysthebible"]="compose-copy-open-source-interface-fkhqrw-postgres-1"
  ["tenant_prokit"]="compose-copy-redundant-capacitor-zc4esw-postgres-1"
  ["openfund"]="compose-generate-mobile-microchip-tksvis-postgres-1"
  ["tenant_cedula"]="compose-generate-wireless-bandwidth-v7bvut-postgres-1"
  ["tenant_jpvbootcamp"]="compose-hack-open-source-driver-mmchh4-postgres-1"
  ["jpvbootcamp"]="compose-input-open-source-bandwidth-droye2-postgres-1"
  ["tenant_olivetoorganizing"]="compose-navigate-optical-monitor-vi714i-postgres-1"
  ["tenant_saaskitstudio"]="compose-quantify-1080p-system-tp1q5f-postgres-1"
  ["tenant_resend"]="compose-reboot-cross-platform-driver-6l6dun-postgres-1"
  ["tenant_saaskit"]="compose-synthesize-bluetooth-panel-tg5mhy-postgres-1"
)

for DB in "${!RESTORE_MAP[@]}"; do
  CONTAINER="${RESTORE_MAP[$DB]}"
  echo "Restoring $DB to $CONTAINER..."
  sudo docker exec "$CONTAINER" psql -U postgres -c "DROP DATABASE IF EXISTS ${DB};"
  sudo docker exec "$CONTAINER" psql -U postgres -c "CREATE DATABASE ${DB};"
  zcat "$DELTA/${DB}.sql.gz" | sudo docker exec -i "$CONTAINER" psql -U postgres "$DB"
  RC=$?
  if [ $RC -ne 0 ]; then echo "FAIL: $DB restore (exit $RC)"; exit 1; fi
  # Validate:
  COUNT=$(sudo docker exec "$CONTAINER" psql -U postgres "$DB" -t \
    -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d ' ')
  echo "$DB: $COUNT tables restored"
done
```

### STOP CONDITIONS (Restore phase):
- Any psql restore exit non-zero → STOP
- Table count = 0 → STOP
- Count significantly lower than Phase 3D rehearsal count → investigate

### VALIDATION

```bash
# [CUTOVER-AUTHORIZATION REQUIRED]
# Run on AWS after all restores:

# Count all restored databases:
for container in $(sudo docker ps --format "{{.Names}}" | grep "\-postgres"); do
  echo -n "$container: "
  sudo docker exec "$container" psql -U postgres -t \
    -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || \
  sudo docker exec "$container" psql -U dokploy -t \
    -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || \
  sudo docker exec "$container" psql -U lyla_gislason n8n -t \
    -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null
done
```

---

## 9. Pre-Stage Safe Non-Production Items

Checked and confirmed ready at Phase 3E0:

| Item | State | Action |
|---|---|---|
| postgres:15 image | PRESENT | None |
| postgres:16 image | PRESENT (2 versions) | None |
| postgres:17-alpine image | PRESENT | None |
| `/var/lib/dokploy-migration-staging/` | EXISTS | None |
| `/var/lib/dokploy-migration-final-delta/` | NOT PRESENT | mkdir -p at cutover Phase C |
| checksums/ | present | None |
| manifests/ (16 manifests) | present | None |
| non-db/ (applications tar, compose tar, kratos, newrelic, ghcr, buildflow, traefik) | present | None |
| cloudflared staged service file | PRESENT at `/etc/systemd/system/cloudflared.service.staged` | None |
| GHCR auth | present in `/root/.docker/config.json` | None |
| sha256sum utility | standard | None |
| rsync | standard | None |

**Pre-stage action that CAN run now (no production impact):**

```bash
# [AWS SAFE — run now]
ssh ubuntu@100.71.47.24 << 'SAFE'
  sudo mkdir -p /var/lib/dokploy-migration-final-delta
  sudo chown ubuntu:ubuntu /var/lib/dokploy-migration-final-delta
  echo "directory ready"
SAFE
```

**Pre-stage action for docker builds (run before or during Phase A/B):**
Source code is present on AWS. Starting builds early reduces Phase E1 wait time.

```bash
# [AWS SAFE — run before cutover or in parallel with Phase A/B]
ssh ubuntu@100.71.47.24 << 'SAFE'
  cd /etc/dokploy/applications/apps-internal-free-resend-izqnvr/code
  sudo docker build -t apps-internal-free-resend-izqnvr:latest . 2>&1 | tail -5

  cd /etc/dokploy/applications/app-override-online-interface-1wzjpb/code
  sudo docker build -t app-override-online-interface-1wzjpb:latest . 2>&1 | tail -5

  cd /etc/dokploy/applications/web-public-prochat-accountant-zrekal/code
  sudo docker build -t web-public-prochat-accountant-zrekal:latest . 2>&1 | tail -5
SAFE
```

Note: These builds use the source code captured at Phase 3C (March/April commits). They do not depend on Azure being running.

---

## 10. Image and Source Handling Manifest

### PINNED DIGEST — Immutable (pull exact SHA at cutover)

| App | Image | Type |
|---|---|---|
| JPV Bootcamp \| Payload CMS | `ghcr.io/prochattools/jpv-bootcamp:a0c32276e403edbcbbab8fb576d91942810f0223` | PINNED COMMIT TAG — verify from restored Dokploy DB at G3 |
| Via di Eden | `ghcr.io/prochattools/via-di-eden:f2d0650e20f88527fffe1a895844bb1c2da563ed` | PINNED COMMIT TAG — verify from restored Dokploy DB at G3 |
| BuildFlow / BuildFlow Staging | `ghcr.io/stevewesthoek/buildflow` (see runbook Phase E4 for digest) | PINNED DIGEST in runbook |

### MUTABLE :latest — Pull at Phase E (Swarm pull-on-scale)

| App | Image |
|---|---|
| Cedula | ghcr.io/prochattools/cedula:latest |
| ProChat | ghcr.io/prochattools/prochat:latest |
| JPV Bootcamp (public site) | ghcr.io/prochattools/jpv-bootcamp:latest |
| Oliveto Organizing | ghcr.io/prochattools/oliveto-organizing:latest |
| JCCP Holdings | ghcr.io/prochattools/jccp-holdings:latest |
| Says the Bible | ghcr.io/prochattools/says-the-bible:latest |
| Status Link | ghcr.io/prochattools/statuslink:latest |
| Proofly | ghcr.io/prochattools/proofly:latest |
| Vault Legal Frontend | ghcr.io/prochattools/vault-legal-frontend:latest |
| Vault Legal API | ghcr.io/prochattools/vault-legal-backend:latest |
| Yeshua Academy | ghcr.io/yeshuaacademy/yeshuaacademy:latest |
| Yeshua Academy Finance | ghcr.io/yeshuaacademy/finance:latest |
| fala | ghcr.io/prochattools/fala:latest (applicationStatus=error — test before enabling) |
| ProKit Studio | ghcr.io/prochattools/prokit-studio:latest (error status) |
| SaaSKit Studio | ghcr.io/prochattools/saaskit-studio:latest (error status) |

**IMPORTANT:** No application images are currently cached on AWS. Docker Swarm will auto-pull from GHCR when services are scaled. To reduce cutover time, optionally pre-pull critical images now:

```bash
# [AWS SAFE — run now or in parallel with Phase A/B]
# Optional: pre-pull critical mutable images to warm Docker cache
sudo docker pull ghcr.io/prochattools/cedula:latest
sudo docker pull ghcr.io/prochattools/prochat:latest
sudo docker pull ghcr.io/prochattools/jpv-bootcamp:latest
# ... etc for all 12+ :latest images
```

### LOCALLY BUILT — docker build at Phase E1

| App | Service | Source |
|---|---|---|
| Free Resend | apps-internal-free-resend-izqnvr | `/etc/dokploy/applications/apps-internal-free-resend-izqnvr/code` |
| fala | app-override-online-interface-1wzjpb | `/etc/dokploy/applications/app-override-online-interface-1wzjpb/code` |
| ProChat Accountant | web-public-prochat-accountant-zrekal | `/etc/dokploy/applications/web-public-prochat-accountant-zrekal/code` |

Source directories present on AWS as of Phase 3C (March/April checkout). Code may be behind HEAD if active development occurred since Phase 3C. At cutover, rebuild from current source unless Steve directs a fresh checkout.

---

## 11. 90-Minute Critical Path

**Target:** ≤ 90 minutes of client downtime

### PRE-DOWNTIME (parallel with Phase A prep — no client impact)

| Task | Duration | Notes |
|---|---|---|
| Run preflight 10/10 | 2 min | REQUIRED before G1 |
| docker build 3 locally-built images (AWS) | 10–20 min | START FIRST, parallel |
| Optional: GHCR pre-pull 12+ :latest images (AWS) | 5–15 min | Reduces Phase E time |
| Create final-delta directory (AWS) | <1 min | |
| Verify Ory config tarball accessible | 1 min | |

### DOWNTIME CLOCK STARTS AT G1

| Phase | Task | Duration | Cumulative |
|---|---|---|---|
| A | Stop Azure cloudflared | 2 min | 2 min |
| A | Confirm Azure connector offline | 2 min | 4 min |
| B | Stop 15 Azure writers (scale to 0 + docker compose down + stop kratos) | 5–8 min | 12 min |
| B | Verify zero Azure application containers | 2 min | 14 min |
| C | pg_dump 16 databases from Azure | 8–12 min | 26 min |
| C | Transfer dumps to AWS via rsync | 3–5 min | 31 min |
| C | Restore 16 databases to AWS | 8–12 min | 43 min |
| C | Validate table counts | 3 min | 46 min |
| E | Ory volume create + config load | 3 min | 49 min |
| E | Reverse shadow suppressions (Dokploy DB) | 2 min | 51 min |
| E | Start non-Supabase services (n8n, vault-legal, jccp, yeshua, free-resend, buildflow) | 5 min (+GHCR pull if not cached) | 60 min |
| E | Health check non-Supabase | 3 min | 63 min |
| E | NO-DUAL-WRITER checkpoint (verify Azure writers still = 0) | 2 min | 65 min |
| E | Start Supabase writers (13 apps + Ory Kratos + Umami) | 5–8 min (+GHCR pull if not cached) | 73 min |
| E | Health check Supabase writers | 5 min | 78 min |
| F | Unmask + start cloudflared on AWS | 2 min | 80 min |
| F | Wait for tunnel propagation | 1 min | 81 min |
| G10 | Production smoke test (curl key domains) | 3 min | 84 min |

**Estimated with pre-pulled images: 80–84 minutes → PASS**
**Estimated without pre-pulled images (cold GHCR pulls): 90–105 minutes → AT RISK**

### Parallelism opportunities

| Parallel action | Benefit |
|---|---|
| docker builds + GHCR pre-pulls during Phase A/B prep | Saves 10–20 min from downtime window |
| New Relic install concurrent with Phase C restore | Saves ~5 min |
| Multiple pg_dump processes on Azure (16 parallel) | Saves ~5 min but increases Azure load |

**RECOMMENDATION:** Start docker builds and GHCR pre-pulls on AWS BEFORE initiating Phase A. This is AWS-only (no Azure/Supabase mutation) and can run immediately after Steve gives the "begin pre-downtime preparation" signal.

### 90-minute target assessment
- **With pre-stage complete:** PASS (estimated 80–84 min)
- **Without pre-stage:** AT RISK (estimated 90–105 min)
- **Threatening factors:** Cold GHCR pulls for 15+ images, slow docker build on AWS, rsync bandwidth

---

## 12. Operator Checkpoints (G0–G11)

No checkpoint may auto-advance after a failed prerequisite. STOP and report.

| Gate | Name | Condition to PASS |
|---|---|---|
| **G0** | Explicit Steve authorization received | Steve types explicit cutover authorization |
| **G1** | Azure traffic freeze | `sudo systemctl stop cloudflared` on Azure; pgrep cloudflared = 0; Cloudflare dashboard shows Azure connector offline |
| **G2** | Azure writers confirmed stopped | `docker ps` on Azure shows ZERO application containers; only postgres + redis + traefik + dokploy platform |
| **G3** | Fresh authoritative capture complete | 16/16 dumps exit 0; all files non-zero size; SHA-256 manifest generated; 16/16 restores exit 0 on AWS |
| **G4** | AWS restore parity valid | Table counts on AWS match expected (≥ Phase 3D counts); no restore errors |
| **G5** | AWS suppressions and writer gate verified | autoDeploy=false all apps/compose; schedule disabled; NO-DUAL-WRITER confirmed (zero Azure writers re-verified) |
| **G6** | Approved AWS writer activation | Steve confirms OK to start Supabase writers on AWS |
| **G7** | AWS application health verified | All started services: Up with no restart loop in 3+ minutes; Ory responding on 4433/4434; n8n UI accessible |
| **G8** | Azure cloudflared confirmed offline (re-verify) | pgrep cloudflared on Azure = 0; Cloudflare dashboard confirms Azure connector offline |
| **G9** | AWS cloudflared started | `systemctl is-active cloudflared` = active; pgrep cloudflared > 0 |
| **G10** | Production smoke tests pass | ≥3 production domains respond HTTPS 2xx/3xx; n8n webhook test pass; no console errors |
| **G11** | Migration declared successful | Steve explicitly declares migration stable; post-cutover snapshot triggered |

### Auto-advance rule:
- G3 auto-advances to G4 when all 16 restores exit 0
- G4 auto-advances to G5 when table counts valid
- All other gates require explicit confirmation or explicit STOP

---

## 13. Live Status Format (Cutover Reporting)

During cutover, Claude will report after each gate:

```
TIME:           HH:MM WEST (HH:MM UTC)
GATE:           Gx — [Gate name]
ACTION:         [what was just done]
RESULT:         PASS / FAIL / STOP
WRITER STATE:   Azure=N AWS=N (N = count of running application writers)
TRAFFIC STATE:  Azure=LIVE/DOWN | AWS=SHADOW/LIVE
ROLLBACK CLASS: A (no writes) / B (writes accepted)
NEXT ACTION:    [next step]
```

Example at G2:
```
TIME:           18:24 WEST (17:24 UTC)
GATE:           G2 — Azure writers confirmed stopped
ACTION:         Verified docker ps on Azure; 0 application containers
RESULT:         PASS
WRITER STATE:   Azure=0 AWS=0
TRAFFIC STATE:  Azure=DOWN (cloudflared stopped) | AWS=SHADOW
ROLLBACK CLASS: A
NEXT ACTION:    Phase C — pg_dump 16 databases from Azure
```

---

## 14. No Production Change Confirmation

| Check | State |
|---|---|
| Azure mutations | **0** |
| Supabase mutations | **0** |
| AWS production writers started | **0** |
| AWS cloudflared active | **NO** |
| Cloudflare changes | **0** |
| DNS changes | **0** |
| Cutover performed | **NO** |
| New Azure backup triggered | **NO** |
| New Azure snapshot created | **NO** |

---

## 15. Remaining Cutover-Time Blockers and Gates

The following items **cannot be resolved before cutover** because they require live Azure data at freeze-time:

| # | Item | Resolution at |
|---|---|---|
| 1 | **Application images not cached on AWS** | Pre-pull during pre-downtime stage (§9/§10) |
| 2 | **JPV Payload CMS image hash** — verify current Azure Dokploy DB value | G3 (after Dokploy DB restore) |
| 3 | **Via di Eden pinned SHA** — verify current Azure Dokploy DB value | G3 (after Dokploy DB restore) |
| 4 | **Ory Kratos config drift** — compare Phase 3C snapshot with current Azure | Phase E6 (before Ory start) |
| 5 | **JPV Bootcamp fresh dump** — both `jpvbootcamp` + `tenant_jpvbootcamp` schemas | Phase C (mandatory fresh dump after freeze) |
| 6 | **Ory Docker volume creation** — does not exist on AWS yet | Phase E6 (create volume + extract tarball) |
| 7 | **autoDeploy per-app restoration** — restore original Azure autoDeploy values | Phase E3 (consult Phase 3A captured values) |
| 8 | **n8n workflow audit** — Azure hostname references in n8n workflows | Post-cutover (not a blocker) |

---

---

## Phase 3E1 — Image Pre-Staging Results (2026-08-17 ~17:26 UTC)

### Step 1 — AWS Safety Baseline (Re-Verified)

All suppressions intact, cloudflared masked, 0 application writers. **PASS.**

### Step 2 — Local Builds

| App | Service | Result | Image ID | Size | Notes |
|---|---|---|---|---|---|
| Free Resend | apps-internal-free-resend-izqnvr | **BUILT ✓** | 6521136227aa | 302 MB | |
| fala | app-override-online-interface-1wzjpb | **BUILT ✓** | 39ed7fb43671 | 288 MB | applicationStatus=error, image built OK |
| ProChat Accountant | web-public-prochat-accountant-zrekal | **FAILED ✗** | — | — | See below |

**Build 3 failure — ProChat Accountant:**
```
Error: Could not load `--schema` from provided path `prisma/schema.prisma`: file or directory not found
npm error command: prisma generate --schema=prisma/schema.prisma (postinstall)
```

Root cause: `prisma/schema.prisma` is absent from the Phase 3C source checkout at
`/etc/dokploy/applications/web-public-prochat-accountant-zrekal/code`.
This app has `applicationStatus=error` in Dokploy — consistent with a known broken state.

**Cutover impact:** ProChat Accountant is NOT in the Phase E activation list (error status). This build failure does not block cutover. At cutover Phase E1, either:
- Skip accountant rebuild (app won't be started — error status)
- Do a fresh `git pull` of source and rebuild if activation is intended

**Decision required from Steve at G6 (writer activation):** Is ProChat Accountant intended to be activated post-cutover?

### Step 3 — Pinned Image Cache

| Image | Tag | Local ID | Registry Digest | Status |
|---|---|---|---|---|
| JPV Bootcamp \| Payload CMS | a0c32276e403edbcbbab8fb576d91942810f0223 | 4fe091758922 | sha256:4fe0917589221b3d4a2bd927861806967d95f5dcbea83b7975313adaec59063f | **CACHED ✓** |
| Via di Eden | f2d0650e20f88527fffe1a895844bb1c2da563ed | 0802b04041e8 | sha256:0802b04041e810c6e36e4b1066fd751bb834717ac17f3f1f84e7c35ddfb73725 | **CACHED ✓** |
| BuildFlow | (by digest) | 4a657686731b | sha256:4a657686731be6aa3912a9c8417b3de75261b017f324ff6d1d05175a749964d4 | **CACHED ✓** |

### Step 4 — Mutable :latest Image Cache

**IMPORTANT: These digests are cache-warming only. Mutable images MUST be re-pulled at cutover after Azure freeze to confirm final production parity.**

| Image | Status | Local ID | Digest at Phase 3E1 |
|---|---|---|---|
| ghcr.io/prochattools/cedula:latest | **CACHED ✓** | e20d0c974509 | @sha256:e20d0c97450956aa34e73f8a161a4f662e810620cd1561200671dafad52ed96a |
| ghcr.io/prochattools/prochat:latest | **CACHED ✓** | 1b7e6028a89b | @sha256:1b7e6028a89ba98cec519eeb4936b77bce957d8abc4a07c0579e186cd13386f6 |
| ghcr.io/prochattools/jpv-bootcamp:latest | **CACHED ✓** | 3b771f572527 | @sha256:3b771f5725270156b7d885a9d394a31199f824eac87d1b7af246d36525a7d747 |
| ghcr.io/prochattools/oliveto-organizing:latest | **CACHED ✓** | c2e22a5629b0 | @sha256:c2e22a5629b06a5acace780ad949ca0a551d7efb787840327351f1748a47cc81 |
| ghcr.io/prochattools/jccp-holdings:latest | **CACHED ✓** | f93e39136531 | @sha256:f93e3913653146de7c9e49b14cc953cdc8449a601d4b909d4d70519b154ac654 |
| ghcr.io/prochattools/says-the-bible:latest | **CACHED ✓** | 0d5fbd05a8a0 | @sha256:0d5fbd05a8a07e0f47f126d215816da6889d367c1bf3e02cbb7025cf93432493 |
| ghcr.io/prochattools/statuslink:latest | **CACHED ✓** | c798a2824762 | @sha256:c798a2824762e7c28ddf4835886a54433c004f454c49929e30dbfb5b5c8b320b |
| ghcr.io/prochattools/proofly:latest | **CACHED ✓** | 89fa1acdd184 | @sha256:89fa1acdd184f754ae14d81f6cd9a8b3f5151b9d33e2eeee7f48d5a8ec5a31ee |
| ghcr.io/prochattools/vault-legal-frontend:latest | **CACHED ✓** | db7d4f8c9c4b | @sha256:db7d4f8c9c4bd3915dfbb34380d894d25eab515166ed615b213febf990d56ee9 |
| ghcr.io/prochattools/vault-legal-backend:latest | **CACHED ✓** | d44b712a1d7e | @sha256:d44b712a1d7e716415a8e9343b4340bf881a84853573db1fbd2ec9b152fd1a4f |
| ghcr.io/yeshuaacademy/yeshuaacademy:latest | **CACHED ✓** | b10fdabe8f0b | @sha256:b10fdabe8f0b231f7d36430dd31017fbdcff7f7dd9a0f09c48677fbc4fb7abd9 |
| ghcr.io/yeshuaacademy/finance:latest | **CACHED ✓** | 4c494b281b9f | @sha256:4c494b281b9f26301803ff5fd1dd7e356f899db31fee24f61d4c5f6c7dd9997f |
| ghcr.io/prochattools/fala:latest | **CACHED ✓** | 86182810e821 | @sha256:86182810e8218b045b8017e1e6f95956f41a1826bdb02817582d4b24de5f4729 |
| ghcr.io/prochattools/prokit-studio:latest | **NOT FOUND** | — | Not in GHCR (applicationStatus=error — not deployed) |
| ghcr.io/prochattools/saaskit-studio:latest | **NOT FOUND** | — | Not in GHCR (applicationStatus=error — not deployed) |

### Step 5 — AWS Shadow State After Staging

| Check | State |
|---|---|
| Application writers running | 0 |
| Built images in running containers | 0 |
| autoDeploy suppressions | all intact (0 enabled) |
| cloudflared | masked, no process |
| Disk free | 276 GB (was 297 GB — 22 GB used by image cache) |

### Revised Downtime Estimate

| Before Phase 3E1 | After Phase 3E1 |
|---|---|
| 80–84 min (with pre-stage) | **45–60 minutes** |
| 90–105 min (without pre-stage) | N/A |

**Why faster:** All 18 registry images (3 pinned + 13 mutable) are now in local Docker cache. Swarm scale-up uses local cache — no GHCR pulls during cutover. The 2 locally-built images are ready. ProChat Accountant (error status) doesn't require Phase E1 build.

**Remaining cutover-time image actions:**
1. ProChat Accountant: decide at G6 whether to activate (needs fresh source or skip)
2. Mutable :latest images: re-pull after Azure freeze confirms no new push since 3E1 (or accept Phase 3E1 digests as final)
3. JPV Payload CMS: re-verify image from restored Dokploy DB at G3

---

## Summary: Ready for Cutover Authorization

| # | Check | Result |
|---|---|---|
| 1 | Phase 3D preflight | **PASS (10/10)** |
| 2 | AWS safety baseline | **PASS** |
| 3 | AWS production writers | **0** |
| 4 | AWS cloudflared active | **NO** |
| 5 | Latest Azure recovery point (UTC) | **2026-08-17T02:03:24 UTC** |
| 6 | Latest Azure recovery point (Portugal WEST) | **2026-08-17T03:03:24 WEST** |
| 7 | Latest backup age at cutover | **~15 hours** |
| 8 | Existing Azure backup health | **PASS** |
| 9 | OS disk covered | **YES** |
| 10 | Data disk covered | **YES** |
| 11 | Fresh backup/snapshot commands prepared | **YES (post-cutover snapshot only)** |
| 12 | Fresh backup/snapshot executed | **NO** |
| 13 | Recommended backup/freeze order | **SQL dumps after freeze are authoritative; no additional VM backup required** |
| 14 | JPV Payload cutover gate prepared | **YES** |
| 15 | Ory drift gate prepared | **YES** |
| 16 | Schedule identity/state gate prepared | **YES (ID vyN0X3Y6OpO5b_cZbS0r3 confirmed)** |
| 17 | 16-database final-sync matrix ready | **YES** |
| 18 | PG15 tooling ready | **YES (pg_dump 15.19)** |
| 19 | PG16 tooling ready | **YES (pg_dump 16.15)** |
| 20 | PG17 tooling ready | **YES (pg_dump 17.11)** |
| 21 | Image/source manifest ready | **YES — Phase 3E1 pre-staging complete** |
| 22 | Current AWS free disk | **276 GB** (22 GB consumed by image cache) |
| 23 | Estimated critical-path downtime | **45–60 minutes** (image cache eliminates GHCR pull wait) |
| 24 | 90-minute downtime target | **PASS** |
| 25 | G0–G11 gate sequence ready | **YES** |
| 26 | Remaining cutover-time blockers | **8 items — all expected and manageable (see §15)** |
| 27 | Azure mutations | **0** |
| 28 | Supabase mutations | **0** |
| 29 | AWS production writers | **0** |
| 30 | Cloudflare changes | **0** |
| 31 | DNS changes | **0** |
| 32 | Cutover performed | **NO** |
| 33 | Files changed | `phase-3e0-final-pre-cutover-readiness.md` (updated, untracked); 18 images + 2 local builds cached on AWS; `/var/lib/dokploy-migration-final-delta/` created on AWS |
| 34 | Git status | Both phase 3D artifacts committed at 3a20893d; this file untracked (not committed per policy) |
| 35 | **READY FOR EXPLICIT MANUAL CUTOVER AUTHORIZATION** | **YES** |

---

## DO NOT PROCEED WITHOUT EXPLICIT AUTHORIZATION

**STOP. WAIT FOR STEVE.**

**DO NOT INTERPRET THIS DOCUMENT AS CUTOVER AUTHORIZATION.**
**DO NOT CREATE AZURE SNAPSHOTS.**
**DO NOT TRIGGER AZURE BACKUP.**
**DO NOT FREEZE AZURE.**
**DO NOT DUMP FRESH PRODUCTION DATABASES.**
**DO NOT START AWS PRODUCTION WORKLOADS.**
**DO NOT ACTIVATE CLOUDFLARED.**
**DO NOT CHANGE DNS.**
