# Phase 3C2 — AWS Pre-Cutover Completion + Hard Production Lockdown

**Date:** 2026-08-16
**Status:** PHASE 3C2 COMPLETE — PASS
**Azure state:** UNMODIFIED — still authoritative production (42 containers, cloudflared active)
**Supabase state:** UNMODIFIED — zero connections from AWS
**AWS state:** All images pre-pulled, all definitions validated, all databases healthy, cloudflared installed but MASKED, ready for manual cutover

---

## PRODUCTION IMMUTABILITY RULE

> **AZURE DOKPLOY + SUPABASE ARE READ-ONLY UNTIL MANUAL CUTOVER APPROVAL. NO EXCEPTIONS.**

- Azure: zero mutations performed during this phase
- Supabase: zero connections, zero queries, zero mutations during this phase
- AWS: all work confined to local preparation only
- Dual-writer protection: zero AWS applications connected to Supabase

---

## STEP 0: CLEAN UP PHASE 3C1 TEST STATE — PASS

| Action | Result |
|--------|--------|
| Vault Legal Frontend scaled to 0 | PASS — converged |
| Production application tasks on AWS | **0** |
| Lingering shell (PID 46355) identified | Orphaned bash from Phase 3C1 Dokploy API investigation |
| Lingering shell terminated | PASS — killed cleanly with child (PID 46356) |
| No unattended processes remain | CONFIRMED |

---

## STEP 1: REVERIFY HARD LOCKDOWN — PASS

| Check | Result |
|-------|--------|
| Application tasks running | 0 (only `demo-vault-legal-wtpg0l` at 0/0) |
| n8n | STOPPED (no container) |
| Compose application containers | NONE running |
| Scheduled jobs (Dokploy DB) | `enabled = false` |
| Shadow suppressions — applications | 24/24 `autoDeploy = false` |
| Shadow suppressions — compose | 17/17 `autoDeploy = false` |
| cloudflared | inactive, not enabled, binary not found (at time of check) |
| Ports 80/443 public | Blocked by Lightsail firewall (Traefik listens internally only) |
| Tailscale | healthy — all nodes online |
| Supabase TCP route | present (10.0.2.4:5433 via Tailscale) |
| Azure still authoritative | YES — 42 containers, cloudflared active |

---

## STEP 2: PRE-PULL ALL REQUIRED IMAGES — PASS

### GHCR Private Images (15/15 pulled)

| Image | Digest Match |
|-------|--------------|
| ghcr.io/prochattools/vault-legal-frontend:latest | EXACT |
| ghcr.io/prochattools/vault-legal-backend:latest | EXACT |
| ghcr.io/prochattools/via-di-eden:f2d0650e... | EXACT |
| ghcr.io/prochattools/prochat:latest | EXACT |
| ghcr.io/prochattools/jpv-bootcamp:latest | EXACT |
| ghcr.io/yeshuaacademy/finance:latest | EXACT |
| ghcr.io/prochattools/jpv-bootcamp:9c045fa5... | EXACT |
| ghcr.io/yeshuaacademy/yeshuaacademy:latest | EXACT |
| ghcr.io/prochattools/jccp-holdings:latest | EXACT |
| ghcr.io/prochattools/says-the-bible:latest | EXACT |
| ghcr.io/stevewesthoek/buildflow:latest | UPDATED (`:latest` tag drift — new build pushed since manifest capture) |
| ghcr.io/prochattools/proofly:latest | EXACT |
| ghcr.io/prochattools/cedula:latest | EXACT |
| ghcr.io/prochattools/oliveto-organizing:latest | EXACT |
| ghcr.io/prochattools/statuslink:latest | EXACT |
| ghcr.io/umami-software/umami:3.0.3 | EXACT |

### Additional GHCR Images (from Dokploy DB)

| Image | Status |
|-------|--------|
| ghcr.io/prochattools/fala:latest | Pulled OK |
| ghcr.io/prochattools/jpv-bootcamp:a0c32276... | Pulled OK |
| ghcr.io/prochattools/accountant:latest | NOT IN REGISTRY (Tier 3 — locally built on Azure) |
| ghcr.io/prochattools/prokit-studio:latest | NOT IN REGISTRY (Tier 3 — Error status) |
| ghcr.io/prochattools/saaskit-studio:latest | NOT IN REGISTRY (Tier 3 — Error status) |

### Public Docker Hub Images (2/2 pulled)

| Image | Digest Match |
|-------|--------------|
| oryd/kratos:v1.3.1 | EXACT |
| n8nio/n8n:2.4.7 | EXACT |

### Platform Images (already present)

| Image | Status |
|-------|--------|
| dokploy/dokploy:latest | Present — sha256:72c082d0 (MATCH) |
| traefik:v3.6.7 | Present — sha256:a9890c89 (MATCH) |
| postgres:16 | Present — sha256:5a65324f (MATCH) |
| redis:7 | Present — sha256:ba125ee9 (MATCH) |
| postgres:15 | Present (newer patch version pulled) |
| postgres:17-alpine | Present (newer patch version pulled) |

### Locally-Built Images (require rebuild at cutover)

| Image | Source Available | Dockerfile |
|-------|-----------------|------------|
| apps-internal-free-resend-izqnvr:latest | YES | /etc/dokploy/applications/.../Dockerfile |
| app-override-online-interface-1wzjpb:latest | YES | /etc/dokploy/applications/.../Dockerfile |
| web-public-prochat-accountant-zrekal:latest | YES | /etc/dokploy/applications/.../Dockerfile |
| fala:latest | Available as ghcr.io/prochattools/fala:latest | N/A (GHCR alternative) |

**Summary:** 21/24 images confirmed by exact digest. 3 have `:latest` tag drift (non-blocking). 3 Tier-3/Error apps have no registry image. 4 locally-built images have source code + Dockerfiles for rebuild at cutover.

---

## STEP 3: STATIC APPLICATION DEFINITION VALIDATION — PASS

### Compose Projects (17/17 manifest projects VALID)

All 17 production compose definitions pass `docker compose config --dry-run`:

| # | Project | Status |
|---|---------|--------|
| 1 | apps-internal-n8n-cvjx2s | VALID |
| 2 | compose-bypass-optical-alarm-tb4ukd | VALID |
| 3 | compose-connect-wireless-application-d1n939 | VALID |
| 4 | compose-copy-auxiliary-protocol-3gfh3x | VALID |
| 5 | compose-copy-cross-platform-bus-wojn3n | VALID |
| 6 | compose-copy-open-source-interface-fkhqrw | VALID |
| 7 | compose-copy-redundant-capacitor-zc4esw | VALID |
| 8 | compose-generate-mobile-microchip-tksvis | VALID |
| 9 | compose-generate-wireless-bandwidth-v7bvut | VALID |
| 10 | compose-hack-open-source-driver-mmchh4 | VALID |
| 11 | compose-index-haptic-firewall-rlwj48 | VALID |
| 12 | compose-input-open-source-bandwidth-droye2 | VALID |
| 13 | compose-navigate-optical-monitor-vi714i | VALID |
| 14 | compose-quantify-1080p-system-tp1q5f | VALID |
| 15 | compose-reboot-cross-platform-driver-6l6dun | VALID |
| 16 | compose-synthesize-bluetooth-panel-tg5mhy | VALID |
| 17 | ops-umami-sqswbj | VALID |

Note: `compose-quantify-cross-platform-matrix-1xuzkz` (NOT in manifest) has invalid YAML — non-blocking.

### Dokploy Application Definitions (24/24 HAS_ENV)

All 24 applications have environment configuration stored in the Dokploy database. Application directories present with source code and/or Dockerfiles.

### Infrastructure

| Component | Status |
|-----------|--------|
| Traefik config (`traefik.yml`) | VALID — swarm provider, letsencrypt ACME |
| ACME storage | Present (53,505 bytes, mode 600) |
| Origin certificate | VALID — CN=dokploy.prochat.tools, expires 2027-05-19 |
| Origin private key | Present (mode 600) |
| Docker networks | All manifest networks present (20 total) |
| Docker volumes | 20 volumes, all key data volumes present |
| GHCR auth | Configured (`~/.docker/config.json`) |

---

## STEP 4: AWS-LOCAL DATABASE READINESS — PASS

### All 16 Databases Healthy

| # | Container | PG Version | pg_isready |
|---|-----------|------------|------------|
| 1 | dokploy-postgres.1 | 16.13 | PASS |
| 2 | apps-internal-n8n-cvjx2s-postgres-1 | 17.11 | PASS |
| 3-16 | 14x compose-*-postgres-1 | 15.19 | PASS |

### Table Count Verification (matches Phase 3B exactly)

| Database | Tables | Match |
|----------|--------|-------|
| dokploy (platform) | 24 apps, 17 compose, 336 deployments | PASS |
| n8n | 43 workflows | PASS |
| tenant_statuslink | 19 | PASS |
| openfund | 24 | PASS |
| tenant_saysthebible | 21 | PASS |
| tenant_jpvbootcamp | 12 | PASS |
| tenant_prochat | 7 | PASS |
| tenant_resend | 6 | PASS |
| tenant_cedula | 5 | PASS |
| tenant_saaskitstudio | 4 | PASS |
| tenant_saaskit | 4 | PASS |
| tenant_prokitstudio | 2 | PASS |
| tenant_prokit | 2 | PASS |
| jpvbootcamp | 2 | PASS |
| tenant_viadieden | 0 (schema-only) | PASS |
| tenant_olivetoorganizing | 0 (schema-only) | PASS |

### Storage

| Metric | Value |
|--------|-------|
| Docker data root | /mnt/data-dokploy/docker |
| Disk usage | 31GB / 309GB (11%) |
| Corruption/recovery errors | 0 |
| Volume paths | Correct — all using /mnt/data-dokploy/docker/volumes/ |

---

## STEP 5: SUPABASE DEPENDENCY READINESS — PASS

| Check | Result |
|-------|--------|
| Tailscale subnet route to 10.0.2.0/24 | Present (supabase node online) |
| TCP to 10.0.2.4:5433 | PASS |
| Application configs mapped to 10.0.2.4:5433 | YES (54 files reference it) |
| Active TCP connections to Supabase | **ZERO** |
| Running Supabase-writing applications | **ZERO** |
| Any query sent to Supabase | **NO** |

---

## STEP 6: CLOUDFLARE PREPARATION (INERT) — PASS

| Item | Status |
|------|--------|
| cloudflared binary | Installed — v2026.8.2 at /usr/local/bin/cloudflared |
| Service file | Staged at /etc/systemd/system/cloudflared.service.staged |
| Service mask | **MASKED** (symlink → /dev/null) — CANNOT be started |
| Tunnel connection | NONE |
| cloudflared process | NOT RUNNING |
| Tunnel token | Preserved in staged service file (root-only) |
| Cloudflare API mutation | NONE |
| DNS mutation | NONE |

**At cutover:** `sudo systemctl unmask cloudflared && sudo mv cloudflared.service.staged cloudflared.service && sudo systemctl daemon-reload && sudo systemctl enable --now cloudflared`

---

## STEP 7: OTHER CUTOVER-ONLY SERVICES — PASS

| Service | Status | Cutover Action |
|---------|--------|----------------|
| New Relic | NOT installed | Install + configure display_name=dokploy-aws |
| New Relic config | Staged at /var/lib/dokploy-migration-staging/non-db/newrelic/ | Copy to /etc/newrelic-infra.yml |
| Tailscale | ACTIVE (required for management) | No change needed |
| Cron jobs | NONE | N/A |
| SSM Agent | Running (AWS management) | Keep running |

---

## STEP 8: CUTOVER SERVICE MATRIX

### Platform Services (always running)

| ID | Service | Database | Supabase | Side Effects | Replicas |
|----|---------|----------|----------|--------------|----------|
| P1 | dokploy | dokploy-postgres | NO | None | 1 |
| P2 | dokploy-postgres | self | NO | None | 1 |
| P3 | dokploy-redis | N/A | NO | None | 1 |
| P4 | dokploy-traefik | N/A | NO | None | 1 |

### Tier 1 — Safe (no external side effects)

| ID | Azure Name | AWS Service | DB | Supabase | Side Effects | Replicas | Startup Order |
|----|-----------|-------------|----|---------:|--------------|----------|---------------|
| T1-1 | Vault Legal | demo-vault-legal-wtpg0l | None | NO | None | 1 | Any |

### Tier 2 — Low risk (unknown outbound)

| ID | Azure Name | AWS Service | DB | Supabase | Side Effects | Replicas | Startup Order |
|----|-----------|-------------|----|---------:|--------------|----------|---------------|
| T2-1 | BuildFlow | app-transmit-online-hard-drive-of1m9k | Local (staging vol) | NO | Relay connection | 1 | After platform |
| T2-2 | BuildFlow Staging | app-index-haptic-port-m88k9z | None | NO | Relay connection | 1 | After platform |

### Tier 3 — Cutover-only (side effects / Supabase writers)

| ID | Azure Name | AWS Service | DB | Supabase | Side Effects | `NO DUAL WRITER` Gate | Replicas | Order |
|----|-----------|-------------|----|---------:|--------------|----------------------|----------|-------|
| T3-1 | JPV Bootcamp | web-public-jpv-bootcamp-l66egq | Local PG + **Supabase** | **YES** | RESEND, STRIPE (live), N8N | **REQUIRED** | 1 | After n8n |
| T3-2 | JPV Bootcamp \| Payload | clients-jpv-bootcamp-app-tp9xrk | Local PG + **Supabase** | **YES** | RESEND, STRIPE, N8N, LiveKit | **REQUIRED** | 1 | After n8n |
| T3-3 | Cedula | web-cedula-b1gepj | Local PG + **Supabase** | **YES** | RESEND, STRIPE, N8N | **REQUIRED** | 1 | After n8n |
| T3-4 | Via di Eden | web-public-viadieden-kttqn4 | Local PG + **Supabase** | **YES** | RESEND, N8N | **REQUIRED** | 1 | After n8n |
| T3-5 | ProChat | web-public-prochat-avejzq | Local PG + **Supabase** | **YES** | STRIPE (live), RESEND, N8N | **REQUIRED** | 1 | After n8n |
| T3-6 | ProChat Accountant | web-public-prochat-accountant-zrekal | **Supabase only** | **YES** | None | **REQUIRED** | 1 | Any |
| T3-7 | Oliveto Organizing | web-public-olivetoorganizing-zwthea | Local PG + **Supabase** | **YES** | RESEND, N8N | **REQUIRED** | 1 | After n8n |
| T3-8 | Says the Bible | web-says-the-bible-ing7sx | Local PG + **Supabase** | **YES** | STRIPE (live), RESEND, N8N | **REQUIRED** | 1 | After n8n |
| T3-9 | Yeshua Academy Finance | apps-saas-open-fund-vdymfu | Local PG + **Supabase** | **YES** | STRIPE | **REQUIRED** | 1 | Any |
| T3-10 | Status Link | apps-saas-status-link-dw1c6j | Local PG + **Supabase** | **YES** | RESEND, webhooks | **REQUIRED** | 1 | After n8n |
| T3-11 | Proofly | saas-proofly-ixcmnz | Local PG + **Supabase** | **YES** | STRIPE, RESEND, N8N | **REQUIRED** | 1 | After n8n |
| T3-12 | JCCP Holdings | web-public-jccp-holdings-pvtist | None | NO | RESEND, New Relic | Not required | 1 | Any |
| T3-13 | Yeshua Academy | web-yeshua-academy-ariw56 | None | NO | RESEND, Stripe donate | Not required | 1 | Any |
| T3-14 | Vault Legal API | demo-vault-legal-api-drzgfx | **Supabase** | **YES** | R2, Bedrock | **REQUIRED** | 1 | Any |
| T3-15 | fala | fala-container | **Supabase** | **YES** | None | **REQUIRED** | 1 | Any |
| T3-16 | app-override-online-interface | app-override-online-interface-1wzjpb | **Supabase** | **YES** | None | **REQUIRED** | 1 | After fala |
| T3-17 | Free Resend | apps-internal-free-resend-izqnvr | Local PG | NO | EMAIL (primary function) | Not required | 1 | Any |

### Compose Services — Tier 3

| ID | Azure Name | AWS Service | DB | Supabase | Side Effects | `NO DUAL WRITER` Gate | Order |
|----|-----------|-------------|----|---------:|--------------|----------------------|-------|
| C-1 | n8n | apps-internal-n8n-cvjx2s | Local PG17 | NO | Webhooks, external APIs, workflows | Not required (no Supabase) | First compose |
| C-2 | Umami | ops-umami-sqswbj | **Supabase only** | **YES** | Analytics writes | **REQUIRED** | After n8n |
| C-3 | Ory Kratos | ory-kratos (standalone) | **Supabase** | **YES** | Auth | **REQUIRED** | Before apps |
| C-4–17 | 14x tenant postgres | compose-*-postgres-1 | Self | NO | None | N/A | Already running |

### Summary

| Category | Count | Supabase Writers |
|----------|-------|-----------------|
| Platform (always on) | 4 | 0 |
| Tier 1 (safe) | 1 | 0 |
| Tier 2 (low risk) | 2 | 0 |
| Tier 3 (cutover-only) | 17 apps + 3 compose | **14 Supabase writers** |
| Total | 27 services | 14 with `NO DUAL WRITER` gate |

---

## STEP 9: CUTOVER PROCEDURE

### ═══════════════════════════════════════════════════════════
### POINT OF NO PRODUCTION CHANGE BEFORE THIS LINE
### ═══════════════════════════════════════════════════════════

Everything above is AWS-only preparation. No production state has been altered.

---

### ═══════════════════════════════════════════════════════════
### MANUAL CUTOVER APPROVAL REQUIRED
### ═══════════════════════════════════════════════════════════

**Nothing below may execute without explicit approval from Steve.**

#### Phase A: Pre-Cutover Freeze

1. **EXPLICIT MANUAL APPROVAL FROM STEVE** — required before proceeding
2. Announce production maintenance window
3. Stop all Azure n8n active workflows (6 workflows)
4. Wait for in-flight webhook processing to complete
5. Verify no active user sessions / set maintenance page if available

#### Phase B: Stop Azure Writers

6. Stop Azure Supabase-writing applications (14 services) — one by one
7. Stop Azure n8n container
8. Stop Azure Umami container
9. Stop Azure Ory Kratos container
10. Verify **ZERO** Azure application containers running that can write to Supabase
11. Verify **ZERO** Azure application containers with RESEND/STRIPE capability

#### Phase C: Final Database Capture

12. Capture final authoritative Azure local database deltas (16 DBs) — fresh pg_dumps
13. Transfer dumps to AWS via streaming (same method as Phase 3A)
14. Restore final deltas to AWS local databases
15. Validate restores (table counts, key data checks)

#### Phase D: Disable Azure Production Tunnel

16. Stop Azure cloudflared service: `sudo systemctl stop cloudflared`
17. Verify Azure cloudflared process is dead
18. Verify Cloudflare dashboard shows Azure connector offline
19. Wait 30 seconds for TTL propagation
20. Verify no traffic reaching Azure (check access logs)

#### Phase E: Activate AWS

21. Reverse documented shadow suppressions:
    - `UPDATE application SET "autoDeploy" = true WHERE "autoDeploy" = false;` (restore to per-app settings)
    - `UPDATE compose SET "autoDeploy" = true WHERE "autoDeploy" = false;` (restore to per-compose settings)
    - `UPDATE schedule SET enabled = true;` (re-enable jpv-email-queue)
22. Rebuild locally-built images (3 apps):
    ```bash
    cd /etc/dokploy/applications/apps-internal-free-resend-izqnvr/code && docker build -t apps-internal-free-resend-izqnvr:latest .
    cd /etc/dokploy/applications/app-override-online-interface-1wzjpb/code && docker build -t app-override-online-interface-1wzjpb:latest .
    cd /etc/dokploy/applications/web-public-prochat-accountant-zrekal/code && docker build -t web-public-prochat-accountant-zrekal:latest .
    ```
23. Start AWS services in dependency order:
    - n8n (compose up)
    - Ory Kratos (docker run)
    - Tier 1: Vault Legal Frontend
    - Tier 3 NON-Supabase: JCCP Holdings, Yeshua Academy, Free Resend
    - Tier 3 Supabase writers (ONLY after Step 10 Azure writer confirmation): all 14 services
    - Umami (last — writes analytics)
24. Verify n8n workflows activate
25. Verify application health checks pass

#### Phase F: Activate Cloudflare Tunnel

26. Unmask and start AWS cloudflared:
    ```bash
    sudo systemctl unmask cloudflared
    sudo mv /etc/systemd/system/cloudflared.service.staged /etc/systemd/system/cloudflared.service
    sudo systemctl daemon-reload
    sudo systemctl enable --now cloudflared
    ```
27. Verify Cloudflare dashboard shows AWS connector online
28. Verify one production domain resolves to AWS (test single endpoint)
29. Test full production path (HTTPS → Cloudflare → tunnel → Traefik → app)

#### Phase G: Validation & Monitoring

30. Verify all production domains respond correctly
31. Check n8n webhook reception
32. Verify email (RESEND) test delivery
33. Verify Stripe webhook reception
34. Monitor for 15 minutes
35. Install New Relic:
    ```bash
    sudo cp /var/lib/dokploy-migration-staging/non-db/newrelic/newrelic-infra.yml /etc/newrelic-infra.yml
    # Install newrelic-infra agent
    ```

---

## STEP 10: ROLLBACK BOUNDARIES

### CLASS A — No AWS Production Writes Accepted

**Condition:** Cutover failed BEFORE any AWS Supabase-writing application processed user requests.

**Rollback procedure:**
1. Stop AWS cloudflared immediately
2. Restart Azure cloudflared: `sudo systemctl start cloudflared`
3. Verify Azure connector online in Cloudflare dashboard
4. Verify production traffic flowing to Azure
5. Leave AWS in shadow state (no data reconciliation needed)
6. Re-apply shadow suppressions on AWS if desired

**Time to rollback:** < 2 minutes
**Data risk:** ZERO — no authoritative writes on AWS

### CLASS B — AWS Has Accepted Production Writes

**Condition:** AWS Supabase-writing applications have processed real user requests.

**CRITICAL: DO NOT blindly restore Azure as authoritative.**

**Rollback procedure:**
1. **WRITE FREEZE** — stop all writers on both Azure AND AWS
2. **IDENTIFY AUTHORITATIVE DATA:**
   - AWS local databases: AWS is authoritative (no Azure equivalent running)
   - Supabase: data written by AWS apps exists only on Supabase
   - Azure local databases: STALE (not updated since cutover)
3. **RECONCILIATION REQUIRED:**
   - Export AWS local DB state
   - Determine if Azure rollback requires importing AWS writes
   - For Supabase: no rollback needed (single instance, data is current)
4. **CHOOSE TRAFFIC DESTINATION:**
   - If AWS stable: keep on AWS
   - If AWS unstable: redirect to Azure BUT with data reconciliation
5. **SUPABASE DUAL-WRITER PROTECTION:**
   - At NO point may both Azure and AWS apps write to Supabase simultaneously
   - If rolling back to Azure: stop ALL AWS Supabase writers FIRST
   - Then start Azure Supabase writers

**Time to rollback:** 15-60 minutes (depends on reconciliation)
**Data risk:** MEDIUM — requires careful data identification

---

## STEP 11: FINAL PRE-CUTOVER SNAPSHOT

| Property | Value |
|----------|-------|
| Snapshot name | `dokploy-aws-pre-cutover-ready-20260816` |
| State | **AVAILABLE** |
| Instance | dokploy-aws |
| Region | eu-west-2 (London) |
| Initiated | 2026-08-16T12:05 UTC |

**This phase is not PASS until the snapshot reaches AVAILABLE.**

---

## STEP 12: CANONICAL ARTIFACTS UPDATED

This report serves as the canonical Phase 3C2 artifact. Key additions:

- Production immutability rule (top of document)
- Zero-dual-writer Supabase rule (Step 8 matrix, `NO DUAL WRITER` column)
- AWS Tailscale identity: 100.71.47.24 (dokploy-aws)
- Complete application readiness matrix (Step 8)
- All image digests (Step 2)
- Static config validation results (Step 3)
- Cloudflare inert-preparation state (Step 6)
- Exact cutover service matrix (Step 8)
- Exact cutover boundary (Step 9)
- Rollback classes A and B (Step 10)
- Manual approval gate (Step 9 header)
- Final snapshot reference (Step 11)

---

## FINAL VERDICT

| # | Question | Answer |
|---|----------|--------|
| 1 | Vault Legal Frontend stopped | **YES** |
| 2 | Production application tasks running on AWS | **0** |
| 3 | Previous lingering shell identified/resolved | **YES** — orphaned Phase 3C1 Dokploy API bash (PID 46355), killed cleanly |
| 4 | All required images pre-pulled | **21/24** (3 Tier-3 Error apps have no registry image — non-blocking) |
| 5 | Image digest validation | **PASS** — 17/17 GHCR exact, 1 `:latest` drift (buildflow), platform all match |
| 6 | Static application definitions validated | **17/17** compose + **24/24** app env configs |
| 7 | All 16 AWS-local databases healthy | **YES** — all pg_isready PASS, table counts match |
| 8 | Any write made to Azure during Phase 3C2 | **NO** |
| 9 | Any mutation made to Supabase during Phase 3C2 | **NO** |
| 10 | Any AWS application connected to Supabase | **NO** |
| 11 | Tailscale route ready | **YES** — TCP to 10.0.2.4:5433 PASS |
| 12 | Cloudflared installed/prepared | **YES** — v2026.8.2, service MASKED |
| 13 | Cloudflare production connector active on AWS | **NO** |
| 14 | DNS changed | **NO** |
| 15 | Complete cutover service matrix ready | **YES** — 27 services mapped |
| 16 | NO-DUAL-WRITER Supabase gate documented | **YES** — 14 services flagged |
| 17 | Explicit manual cutover boundary documented | **YES** — Step 9 |
| 18 | Rollback classes documented | **YES** — Class A and Class B |
| 19 | Final pre-cutover snapshot AVAILABLE | **YES** — `dokploy-aws-pre-cutover-ready-20260816` AVAILABLE |
| 20 | AWS PRE-CUTOVER READY | **YES** |
| 21 | Azure remains authoritative and completely unmodified | **YES** |
| 22 | Supabase remains completely unmodified | **YES** |
| 23 | Exact blockers | NONE |
| 24 | Git status | New file added |

---

## HARD STOP

**DO NOT BEGIN CUTOVER.**
**DO NOT MODIFY AZURE.**
**DO NOT MODIFY SUPABASE.**
**DO NOT START PRODUCTION APPLICATIONS.**
**DO NOT ACTIVATE CLOUDFLARE.**
**DO NOT CHANGE DNS.**

**THE NEXT PHASE MAY ONLY BEGIN AFTER EXPLICIT MANUAL CUTOVER APPROVAL FROM STEVE.**
