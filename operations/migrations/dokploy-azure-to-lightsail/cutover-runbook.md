# Cutover Runbook — Azure Dokploy → AWS Lightsail

**Prepared:** 2026-08-16
**AWS instance:** dokploy-aws (18.135.240.168, Tailscale 100.71.47.24)
**Azure instance:** dokploy (68.221.139.108, Tailscale 100.83.38.48)
**Supabase:** 100.71.31.88 → 10.0.2.4:5433

Command categories:
- `[AWS SAFE]` — safe to run on AWS at any time
- `[AZURE MUTATION — CUTOVER ONLY]` — mutates Azure; only after approval
- `[CLOUDFLARE CUTOVER ONLY]` — activates production tunnel on AWS
- `[VALIDATION]` — read-only checks
- `[ROLLBACK]` — rollback procedures

---

## PRE-CUTOVER PREPARATION (already done — AWS SAFE)

These have already been completed. Listed for reference.

```bash
# [AWS SAFE] Verify safety state
ssh -i ~/.ssh/[LIGHTSAIL_KEY] ubuntu@18.135.240.168
sudo docker service ls
# Expect: platform 4/4, demo-vault-legal-wtpg0l 0/0

# [VALIDATION] Confirm snapshot available
aws lightsail get-instance-snapshot \
  --instance-snapshot-name dokploy-aws-pre-cutover-ready-20260816 \
  --region eu-west-2 \
  --query 'instanceSnapshot.state' --output text
# Expected: available

# [VALIDATION] Confirm cloudflared masked
sudo systemctl is-enabled cloudflared
# Expected: masked
```

---

## ==================================================
## MANUAL CUTOVER APPROVAL FROM STEVE REQUIRED HERE
## NOTHING BELOW THIS LINE MAY BE EXECUTED YET
## ==================================================

---

## PHASE A — MAINTENANCE WINDOW + TRAFFIC FREEZE

```bash
# [AZURE MUTATION — CUTOVER ONLY]
# A1. Announce maintenance — notify users if applicable

# [AZURE MUTATION — CUTOVER ONLY]
# A2. Freeze production writes: stop Azure Cloudflare tunnel
# (This stops all public ingress to Azure)
ssh master@100.83.38.48  # Azure Tailscale IP
sudo systemctl stop cloudflared
sleep 5
pgrep cloudflared && echo "DANGER: still running" || echo "STOPPED"

# [VALIDATION] A3. Confirm Azure tunnel offline
# Check Cloudflare dashboard — Azure connector should show inactive
# Also verify from Mac:
curl -s --max-time 10 https://status.prochat.tools || echo "down (expected)"
```

**CHECKPOINT A — DO NOT PROCEED until:**
- [ ] Azure cloudflared confirmed stopped
- [ ] No public traffic reaching Azure (verified via access logs or dashboard)

---

## PHASE B — STOP AZURE APPLICATION WRITERS

```bash
# [AZURE MUTATION — CUTOVER ONLY]
# B1. Stop all Supabase-writing application services on Azure
# Run on Azure host (100.83.38.48 via Tailscale):
ssh master@100.83.38.48

# Stop 15 Supabase writers:
sudo docker service scale demo-vault-legal-api-drzgfx=0
sudo docker service scale app-override-online-interface-1wzjpb=0
sudo docker service scale apps-saas-open-fund-vdymfu=0
sudo docker service scale apps-saas-status-link-dw1c6j=0
sudo docker service scale clients-jpv-bootcamp-app-tp9xrk=0
sudo docker service scale saas-proofly-ixcmnz=0
sudo docker service scale web-cedula-b1gepj=0
sudo docker service scale web-public-jpv-bootcamp-l66egq=0
sudo docker service scale web-public-olivetoorganizing-zwthea=0
sudo docker service scale web-public-prochat-accountant-zrekal=0
sudo docker service scale web-public-prochat-avejzq=0
sudo docker service scale web-public-viadieden-kttqn4=0
sudo docker service scale web-says-the-bible-ing7sx=0

# Stop Umami (compose):
cd /etc/dokploy/compose/ops-umami-sqswbj/code
sudo docker compose down

# Stop Ory Kratos (standalone):
sudo docker stop ory-kratos || sudo docker rm ory-kratos

# [AZURE MUTATION — CUTOVER ONLY]
# B2. Stop n8n:
cd /etc/dokploy/compose/apps-internal-n8n-cvjx2s/code
sudo docker compose down

# [VALIDATION] B3. Confirm ZERO Azure application writers
sudo docker ps --format "{{.Names}}" | grep -v -E "postgres|redis|traefik|dokploy\."
# Expected: empty (only DBs + platform)
sudo docker service ls | grep -v -E "dokploy |dokploy-postgres|dokploy-redis|dokploy-traefik"
```

**CHECKPOINT B — DO NOT PROCEED until:**
- [ ] All 15 Supabase writers confirmed stopped on Azure
- [ ] n8n confirmed stopped on Azure
- [ ] Umami confirmed stopped on Azure
- [ ] Ory Kratos confirmed stopped on Azure
- [ ] `docker ps` on Azure shows ZERO application containers (only DB + platform)

---

## PHASE C — FINAL DATABASE CAPTURE AND RESTORE

```bash
# [AZURE MUTATION — CUTOVER ONLY] (read-only mutation — dump only)
# C1. Capture final authoritative state from Azure (run on Azure host)
ssh master@100.83.38.48

STAGING="/var/lib/dokploy-migration-staging/final-delta"
sudo mkdir -p "$STAGING"

# Dump all 16 databases:
# Platform (PG16)
sudo docker exec dokploy-postgres.1.* pg_dump -U dokploy dokploy | gzip > "$STAGING/dokploy.sql.gz"

# n8n (PG17) — use pg17 pg_dump
sudo docker exec apps-internal-n8n-cvjx2s-postgres-1 pg_dump -U lyla_gislason n8n | gzip > "$STAGING/n8n.sql.gz"

# 14 tenant DBs (PG15):
for SLUG in compose-bypass-optical-alarm-tb4ukd compose-connect-wireless-application-d1n939 \
  compose-copy-auxiliary-protocol-3gfh3x compose-copy-cross-platform-bus-wojn3n \
  compose-copy-open-source-interface-fkhqrw compose-copy-redundant-capacitor-zc4esw \
  compose-generate-mobile-microchip-tksvis compose-generate-wireless-bandwidth-v7bvut \
  compose-hack-open-source-driver-mmchh4 compose-input-open-source-bandwidth-droye2 \
  compose-navigate-optical-monitor-vi714i compose-quantify-1080p-system-tp1q5f \
  compose-reboot-cross-platform-driver-6l6dun compose-synthesize-bluetooth-panel-tg5mhy; do
  CONTAINER=$(sudo docker ps --format "{{.Names}}" | grep "${SLUG}-postgres")
  DB=$(sudo docker exec "$CONTAINER" psql -U postgres -t -c \
    "SELECT datname FROM pg_database WHERE datname NOT IN ('postgres','template0','template1');" \
    | tr -d " " | head -1)
  sudo docker exec "$CONTAINER" pg_dump -U postgres "$DB" | gzip > "$STAGING/${SLUG}.sql.gz"
  echo "Dumped $SLUG ($DB)"
done

# [AWS SAFE] C2. Transfer dumps to AWS
# Run from Mac or from Azure:
rsync -avz --progress \
  master@100.83.38.48:/var/lib/dokploy-migration-staging/final-delta/ \
  ubuntu@100.71.47.24:/var/lib/dokploy-migration-final-delta/

# [AWS SAFE] C3. Restore final deltas to AWS
ssh ubuntu@18.135.240.168

# Drop and recreate each DB, then restore
# (Same method as Phase 3B — truncate existing data first)
for SLUG in compose-bypass-optical-alarm-tb4ukd ...; do
  CONTAINER=$(sudo docker ps --format "{{.Names}}" | grep "${SLUG}-postgres")
  # ... restore commands (same as Phase 3B)
done

# [VALIDATION] C4. Validate restores
# Check table counts match Phase 3B + expected delta
```

**CHECKPOINT C — DO NOT PROCEED until:**
- [ ] All 16 Azure databases dumped successfully (exit 0)
- [ ] All 16 dumps transferred to AWS
- [ ] All 16 restores completed (exit 0)
- [ ] Table counts validated on AWS

---

## PHASE D — DISABLE AZURE PRODUCTION CLOUDFLARE

```bash
# (Already done in Phase A — cloudflared was stopped there)
# [VALIDATION] D1. Re-confirm Azure cloudflared is still stopped
ssh master@100.83.38.48
sudo systemctl is-active cloudflared
# Expected: inactive
pgrep cloudflared && echo "DANGER" || echo "CONFIRMED STOPPED"
```

**CHECKPOINT D — DO NOT PROCEED until:**
- [ ] Azure cloudflared confirmed inactive
- [ ] Cloudflare dashboard confirms Azure connector offline

---

## PHASE E — ACTIVATE AWS SERVICES

```bash
# [AWS SAFE] E1. Rebuild locally-built images
ssh ubuntu@18.135.240.168

cd /etc/dokploy/applications/apps-internal-free-resend-izqnvr/code
sudo docker build -t apps-internal-free-resend-izqnvr:latest . 2>&1 | tail -5

cd /etc/dokploy/applications/app-override-online-interface-1wzjpb/code
sudo docker build -t app-override-online-interface-1wzjpb:latest . 2>&1 | tail -5

cd /etc/dokploy/applications/web-public-prochat-accountant-zrekal/code
sudo docker build -t web-public-prochat-accountant-zrekal:latest . 2>&1 | tail -5

# [AWS SAFE] E2. Install New Relic
sudo cp /var/lib/dokploy-migration-staging/non-db/newrelic/newrelic-infra.yml /etc/newrelic-infra.yml
# Install agent:
curl -s https://download.newrelic.com/infrastructure_agent/gpg/newrelic-infra.gpg | sudo apt-key add -
echo "deb [arch=amd64] https://download.newrelic.com/infrastructure_agent/linux/apt noble main" \
  | sudo tee /etc/apt/sources.list.d/newrelic-infra.list
sudo apt-get update && sudo apt-get install newrelic-infra -y
sudo systemctl enable --now newrelic-infra

# [AWS SAFE] E3. Reverse shadow suppressions
sudo docker exec $(sudo docker ps -q -f name=dokploy-postgres.1) psql -U dokploy -d dokploy -c "
UPDATE schedule SET enabled = true WHERE \"scheduleId\" = 'vyN0X3Y6OpO5b_cZbS0r3';
"
# Note: autoDeploy — restore per-app from source values, not bulk true
# (consult Phase 3A captured autoDeploy values per app)

# [AWS SAFE] E4. Start non-Supabase services first
# n8n:
cd /etc/dokploy/compose/apps-internal-n8n-cvjx2s/code
sudo docker compose up -d
sleep 15
sudo docker ps | grep n8n

# Vault Legal Frontend (already proven in Phase 3C1):
sudo docker service scale demo-vault-legal-wtpg0l=1

# JCCP Holdings, Yeshua Academy, Free Resend (no Supabase):
sudo docker service scale web-public-jccp-holdings-pvtist=1
sudo docker service scale web-yeshua-academy-ariw56=1
sudo docker service scale apps-internal-free-resend-izqnvr=1

# BuildFlow (using pinned digest):
sudo docker service update \
  --image "ghcr.io/stevewesthoek/buildflow@sha256:4a657686731be6aa3912a9c8417b3de75261b017f324ff6d1d05175a749964d4" \
  app-transmit-online-hard-drive-of1m9k
sudo docker service scale app-transmit-online-hard-drive-of1m9k=1
sudo docker service update \
  --image "ghcr.io/stevewesthoek/buildflow@sha256:4a657686731be6aa3912a9c8417b3de75261b017f324ff6d1d05175a749964d4" \
  app-index-haptic-port-m88k9z
sudo docker service scale app-index-haptic-port-m88k9z=1

# [VALIDATION] E5. Verify non-Supabase services healthy
sudo docker service ls
sudo docker ps | grep -v postgres | grep -v redis | grep -v traefik | grep Up

# === NO-DUAL-WRITER CHECKPOINT ===
# Before starting any Supabase writer on AWS:
# - Confirm ZERO Azure Supabase writers running (re-verify Checkpoint B)
# - Confirm ZERO active connections to 10.0.2.4 from Azure
ssh master@100.83.38.48 "sudo docker ps --format '{{.Names}}' | grep -v -E 'postgres|redis|traefik|dokploy\.'"
# Expected: empty

# [AWS SAFE] E6. Start Supabase writers (ONLY after NO-DUAL-WRITER checkpoint above passes)
# Ory Kratos first (auth foundation):
sudo docker run -d --name ory-kratos \
  --restart unless-stopped \
  -p 4433-4434:4433-4434 \
  -v ory-config:/etc/config/kratos \
  oryd/kratos:v1.3.1 \
  serve all --config /etc/config/kratos/kratos.yml

# Supabase-connected applications:
sudo docker service scale demo-vault-legal-api-drzgfx=1
sudo docker service scale apps-saas-open-fund-vdymfu=1
sudo docker service scale apps-saas-status-link-dw1c6j=1
sudo docker service scale clients-jpv-bootcamp-app-tp9xrk=1
sudo docker service scale saas-proofly-ixcmnz=1
sudo docker service scale web-cedula-b1gepj=1
sudo docker service scale web-public-jpv-bootcamp-l66egq=1
sudo docker service scale web-public-olivetoorganizing-zwthea=1
sudo docker service scale web-public-prochat-accountant-zrekal=1
sudo docker service scale web-public-prochat-avejzq=1
sudo docker service scale web-public-viadieden-kttqn4=1
sudo docker service scale web-says-the-bible-ing7sx=1
sudo docker service scale app-override-online-interface-1wzjpb=1

# Umami last (analytics writer):
cd /etc/dokploy/compose/ops-umami-sqswbj/code
sudo docker compose up -d
```

**CHECKPOINT E — DO NOT PROCEED to Cloudflare until:**
- [ ] All Supabase writers started without errors
- [ ] Health checks passing
- [ ] Ory Kratos responding on 4433/4434
- [ ] NO-DUAL-WRITER checkpoint confirmed (ZERO Azure writers)

---

## PHASE F — ACTIVATE AWS CLOUDFLARE TUNNEL

```bash
# [CLOUDFLARE CUTOVER ONLY] F1. Unmask and start cloudflared on AWS
ssh ubuntu@18.135.240.168

sudo systemctl unmask cloudflared
sudo mv /etc/systemd/system/cloudflared.service.staged \
        /etc/systemd/system/cloudflared.service
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared

# [VALIDATION] F2. Verify tunnel is up
sudo systemctl is-active cloudflared
pgrep cloudflared
# Expected: process running

# [VALIDATION] F3. Verify Cloudflare connector online
# Check Cloudflare dashboard — AWS connector should appear active
# Wait for tunnel TTL (~30s)
sleep 30

# [VALIDATION] F4. Test production path
curl -I https://legal.prochat.tools 2>&1 | head -5
curl -I https://prochat.tools 2>&1 | head -5
```

**CHECKPOINT F — DO NOT PROCEED until:**
- [ ] cloudflared active on AWS
- [ ] Cloudflare dashboard shows AWS connector
- [ ] At least one production domain responds correctly via HTTPS

---

## PHASE G — POST-CUTOVER VALIDATION

```bash
# [VALIDATION] G1. Application health sweep
for domain in legal.prochat.tools prochat.tools jpv-bootcamp.com viadieden.com; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://$domain")
  echo "$domain: $STATUS"
done

# [VALIDATION] G2. n8n webhook reception
# Trigger a test webhook and verify n8n receives it

# [VALIDATION] G3. Supabase connectivity from AWS
sudo ss -tnp | grep "10.0.2.4"
# Expected: connections from app containers (healthy)

# [AWS SAFE] G4. Monitor for 15 minutes
# Watch for restart loops:
watch -n 5 'sudo docker ps --format "{{.Names}} {{.Status}}" | grep -v "Up [0-9]* h"'

# [AWS SAFE] G5. Take post-cutover snapshot
aws lightsail create-instance-snapshot \
  --instance-name dokploy-aws \
  --instance-snapshot-name "dokploy-aws-post-cutover-$(date +%Y%m%d)" \
  --region eu-west-2
```

---

## ROLLBACK — CLASS A (no production writes accepted)

```bash
# [ROLLBACK] A1. Stop AWS cloudflared
ssh ubuntu@18.135.240.168
sudo systemctl stop cloudflared
pgrep cloudflared && echo "DANGER" || echo "STOPPED"

# [ROLLBACK] A2. Restore Azure cloudflared
ssh master@100.83.38.48
sudo systemctl start cloudflared
sleep 10
sudo systemctl is-active cloudflared

# [VALIDATION] A3. Verify Azure connector online
curl -I https://prochat.tools 2>&1 | head -3
# Expected: traffic flowing to Azure again

# No data reconciliation required — AWS was shadow only
```

---

## ROLLBACK — CLASS B (AWS accepted production writes)

```bash
# [ROLLBACK] B1. WRITE FREEZE — stop writers on BOTH sides simultaneously
# On AWS:
ssh ubuntu@18.135.240.168
sudo systemctl stop cloudflared
for SVC in demo-vault-legal-api web-public-prochat-avejzq web-cedula web-public-jpv-bootcamp \
  saas-proofly apps-saas-status-link clients-jpv-bootcamp web-public-olivetoorganizing \
  web-public-viadieden web-says-the-bible apps-saas-open-fund app-override web-public-prochat-accountant; do
  sudo docker service scale "${SVC}"*=0 2>/dev/null
done
cd /etc/dokploy/compose/ops-umami-sqswbj/code && sudo docker compose down
sudo docker stop ory-kratos 2>/dev/null

# [ROLLBACK] B2. Identify authoritative data
# AWS local PG = authoritative (Azure copies are stale)
# Supabase = current (single shared instance)
# Azure local PG = STALE from cutover timestamp

# [ROLLBACK] B3. Decision point — consult Steve before proceeding
# Option A: Keep AWS as authoritative target (resume AWS after fixing issue)
# Option B: Roll back to Azure (requires exporting AWS local DB writes to Azure)

# NOTE: Do NOT start any writer on either side until B3 decision is made
# NOTE: Supabase dual-write protection still applies during rollback
```

---

## CREDENTIAL VARIABLES (placeholders — no secrets in this file)

```
LIGHTSAIL_KEY     = path to Lightsail SSH key (downloaded fresh from AWS console)
AZURE_SSH_USER    = master
AWS_SSH_USER      = ubuntu
AWS_TAILSCALE_IP  = 100.71.47.24
AZURE_TAILSCALE_IP= 100.83.38.48
SUPABASE_IP       = 100.71.31.88
SUPABASE_PG       = 10.0.2.4:5433
```

No plaintext secrets. All credentials loaded from environment or vault at runtime.
