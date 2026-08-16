# Phase 3C4 — Read-Only Hygiene Audit + Legacy Inventory + Final-Sync Design

**Prepared:** 2026-08-16  
**Phase:** 3C4 — READ-ONLY AUDIT ONLY. No changes made to Azure, Supabase, or any production system.  
**Target:** AWS Lightsail `dokploy-aws` (18.135.240.168 / 100.71.47.24) + Supabase at 10.0.2.4:5433  
**Supabase connection:** `BEGIN TRANSACTION READ ONLY;` → verified `transaction_read_only = on` before every query.

---

## SAFETY CONFIRMATION

This phase is read-only. No mutations were made to:
- Azure Dokploy (not accessed at all in this phase)
- Supabase (read-only transaction verified on every connection)
- AWS application workloads (only read access to Dokploy DB and Docker state)
- cloudflared (remains masked, no change)
- DNS, Cloudflare, or any routing

---

## STEP 1 — DOKPLOY STRUCTURE INVENTORY

### 1.1 Projects (8 total)

| projectId | Name | Description |
|-----------|------|-------------|
| YMzA8RYJdczAp_KYHONFG | Boilerplates | |
| hXaySDURUd2i0enErtSwx | Clients | |
| C1WHQrOjpC3Ysfc-V6sBU | Databases | Standalone databases — one container per app |
| kNa9UD808a88taxtLmcnQ | Demo | |
| 2VaDvNViTYD_asKA_h6sb | Ops | |
| Weq2uY4KM9IKizVAw_RE- | SaaS | |
| VGUe7AzRsqLFv_wSPDCQ- | WaaS | |
| SPX-3TSitP84hxmp51gDT | Web | |

### 1.2 Applications (24 total)

| appName | Human Name | sourceType | Image | Status | autoDeploy |
|---------|------------|-----------|-------|--------|------------|
| app-index-haptic-port-m88k9z | BuildFlow | docker | ghcr.io/stevewesthoek/buildflow:latest | done | false |
| app-transmit-online-hard-drive-of1m9k | BuildFlow Staging | docker | ghcr.io/stevewesthoek/buildflow:latest | done | false |
| web-cedula-b1gepj | Cedula | docker | ghcr.io/prochattools/cedula:latest | done | false |
| apps-saas-egg-cooker-qtutkp | Egg Cooker | github | (nixpacks build) | idle | false |
| app-override-online-interface-1wzjpb | fala | docker | ghcr.io/prochattools/fala:latest | error | false |
| apps-internal-free-resend-izqnvr | Free Resend | github | (nixpacks build) | done | false |
| web-public-jccp-holdings-pvtist | JCCP Holdings | docker | ghcr.io/prochattools/jccp-holdings:latest | done | false |
| web-public-jpv-bootcamp-l66egq | JPV Bootcamp | docker | ghcr.io/prochattools/jpv-bootcamp:latest | done | false |
| clients-jpv-bootcamp-app-tp9xrk | JPV Bootcamp \| Payload CMS | docker | ghcr.io/prochattools/jpv-bootcamp:a0c32276e403edbcbbab8fb576d91942810f0223 | done | false |
| web-public-olivetoorganizing-zwthea | Oliveto Organizing | docker | ghcr.io/prochattools/oliveto-organizing:latest | done | false |
| web-public-prochat-avejzq | ProChat | docker | ghcr.io/prochattools/prochat:latest | done | false |
| web-public-prochat-accountant-zrekal | ProChat Accountant | docker | ghcr.io/prochattools/accountant:latest | error | false |
| boilerplates-prokit-dev-s5f8yz | ProKit Dev | github | (nixpacks build) | idle | false |
| templates-prokit-kcde8a | ProKit Studio | docker | ghcr.io/prochattools/prokit-studio:latest | error | false |
| saas-proofly-ixcmnz | Proofly | docker | ghcr.io/prochattools/proofly:latest | done | false |
| boilerplates-saaskit-dev-ixnolx | SaaSKit Dev | github | (nixpacks build) | idle | false |
| templates-saaskit-3ynx5a | SaaSKit Studio | docker | ghcr.io/prochattools/saaskit-studio:latest | error | false |
| web-says-the-bible-ing7sx | Says the Bible | docker | ghcr.io/prochattools/says-the-bible:latest | done | false |
| apps-saas-status-link-dw1c6j | Status Link | docker | ghcr.io/prochattools/statuslink:latest | done | false |
| demo-vault-legal-wtpg0l | Vault Legal | docker | ghcr.io/prochattools/vault-legal-frontend:latest | done | false |
| demo-vault-legal-api-drzgfx | Vault Legal API | docker | ghcr.io/prochattools/vault-legal-backend:latest | done | false |
| web-public-viadieden-kttqn4 | Via di Eden | docker | ghcr.io/prochattools/via-di-eden:f2d0650e20f88527fffe1a895844bb1c2da563ed | done | false |
| web-yeshua-academy-ariw56 | Yeshua Academy | docker | ghcr.io/yeshuaacademy/yeshuaacademy:latest | done | false |
| apps-saas-open-fund-vdymfu | Yeshua Academy Finance | docker | ghcr.io/yeshuaacademy/finance:latest | done | false |

**Swarm services running:** Only `demo-vault-legal-wtpg0l` (0/0 replicas — explicitly scaled to 0). All other applications have Dokploy DB records but no active Swarm service. Production application tasks = 0. ✓

### 1.3 Compose Projects (17 total)

| appName | Human Name | Type | Status | autoDeploy | Service |
|---------|------------|------|--------|------------|---------|
| apps-internal-n8n-cvjx2s | n8n | docker-compose | done | false | n8n + postgres:17-alpine |
| compose-bypass-optical-alarm-tb4ukd | prochat | docker-compose | done | false | postgres:15 (tenant_prochat) |
| compose-connect-wireless-application-d1n939 | viadieden | docker-compose | done | false | postgres:15 (tenant_viadieden) |
| compose-copy-auxiliary-protocol-3gfh3x | statuslink | docker-compose | done | false | postgres:15 (tenant_statuslink) |
| compose-copy-cross-platform-bus-wojn3n | prokitstudio | docker-compose | done | false | postgres:15 (tenant_prokitstudio) |
| compose-copy-open-source-interface-fkhqrw | saysthebible | docker-compose | done | false | postgres:15 (tenant_saysthebible) |
| compose-copy-redundant-capacitor-zc4esw | prokit | docker-compose | done | false | postgres:15 (tenant_prokit) |
| compose-generate-mobile-microchip-tksvis | openfund | docker-compose | done | false | postgres:15 (openfund) |
| compose-generate-wireless-bandwidth-v7bvut | cedula | docker-compose | done | false | postgres:15 (tenant_cedula) |
| compose-hack-open-source-driver-mmchh4 | jpvbootcamp | docker-compose | done | false | postgres:15 (tenant_jpvbootcamp) |
| compose-index-haptic-firewall-rlwj48 | ory | docker-compose | done | false | oryd/kratos:v1.3.1 → Supabase ory_prod |
| compose-input-open-source-bandwidth-droye2 | jpvbootcamp | docker-compose | done | false | postgres:15 (jpvbootcamp) |
| compose-navigate-optical-monitor-vi714i | olivetoorganizing | docker-compose | done | false | postgres:15 (tenant_olivetoorganizing) |
| compose-quantify-1080p-system-tp1q5f | saaskitstudio | docker-compose | done | false | postgres:15 (tenant_saaskitstudio) |
| compose-reboot-cross-platform-driver-6l6dun | resend | docker-compose | done | false | postgres:15 (tenant_resend) |
| compose-synthesize-bluetooth-panel-tg5mhy | saaskit | docker-compose | done | false | postgres:15 (tenant_saaskit) |
| ops-umami-sqswbj | umami | docker-compose | done | false | ghcr.io/umami-software/umami:3.0.3 → Supabase analytics |

**Compose app containers running:** NONE. Only postgres backend containers are running (14 tenant postgres:15 + 1 n8n postgres:17-alpine). The n8n service container, ory-kratos container, and umami container are all stopped. ✓

### 1.4 Scheduled Jobs (1 total)

| scheduleId | name | cron | enabled | applicationId |
|------------|------|------|---------|---------------|
| vyN0X3Y6OpO5b_cZbS0r3 | jpv-email-queue | `*/2 * * * *` | **false** | I_2Vukga3cc3ZhaG-mUzU (clients-jpv-bootcamp-app-tp9xrk) |

Schedule suppressed: `enabled=false` ✓

### 1.5 Domains (29 total, with anomalies)

| Domain | App? | Compose? | Notes |
|--------|------|----------|-------|
| accountant.prochat.tools | ✓ fRoNSpV489MMEd_713Gee | — | |
| auth-admin.prochat.tools | — | ✓ DpMDhd91-YVUbHCxTD3Mx (ory) | |
| auth.prochat.tools | — | ✓ DpMDhd91-YVUbHCxTD3Mx (ory) | |
| buildflow-staging.prochat.tools | ✓ enij_FshYINrDID8QGpZX | — | HTTPS on port 3054 |
| cedula.prochat.tools | ✓ WESe1NAxTlCgcnj-YiutJ | — | |
| eggcooker.app | ✓ cf7F4hFlpqUQegFF85oG_ | — | |
| fala.prochat.tools | ✓ BIeyZvkQLl-VJ45X-jujb | — | |
| finance.yeshua.academy | ✓ rUyCCZYOE0TIKoUKkqSGQ | — | |
| finance.yeshua.academy | — | — | **ORPHANED DOMAIN** — no app or compose link |
| getproofly.app | ✓ ub3NVzkB14Q-i3mNrIp0W | — | |
| jccpholdings.com | ✓ HydSqf1OVKTELDuRW_KM3 | — | **DUPLICATE** (same applicationId appears twice) |
| jccpholdings.com | ✓ HydSqf1OVKTELDuRW_KM3 | — | **DUPLICATE** |
| jpvbootcamp.com | ✓ aPR9SvYn_JvGdMTk3CzeI | — | |
| legal-api.prochat.tools | ✓ Hd18-225OdSlij_temjnB | — | Port 3001 |
| legal.prochat.tools | ✓ 7Kc9FJwjAzcx2472QBu3y | — | Port 3051 |
| n8n.prochat.tools | — | ✓ qAkxTPJO7bSXDyO8cjXup (n8n) | |
| olivetoorganizing.com | ✓ xBuP3eoiwNO5l2qY_N_1h | — | |
| onestatus.link | ✓ 1hooC9kE4Yn5SXmYI9DLg | — | |
| preview.jpvbootcamp.com | ✓ I_2Vukga3cc3ZhaG-mUzU | — | JPV Bootcamp Payload CMS preview |
| prochat.tools | ✓ QmLMK77LC0zEKE_qxGQ4L | — | |
| prokit-dev.prochat.tools | ✓ GF-p4cw0g0It0OrWUqIJX | — | |
| prokit-studio.prochat.tools | ✓ dvDkO1YAdgip1EM_BUTFQ | — | Port 3000 |
| resend.prochat.tools | ✓ xqkEuvn1EegwoqcX6ec2Z | — | |
| saaskit-dev.prochat.tools | ✓ ZswMGfANz_ljGPK_RBYLv | — | |
| saaskit-studio.prochat.tools | ✓ ZzSy31q9pWSWX3OyqXiFs | — | |
| saysthe.bible | ✓ FKwPG6tveeYFrbSsLmQA1 | — | |
| umami.prochat.tools | — | ✓ r1nNP-90j_NhAQQ5eqhGQ (umami) | |
| viadieden.it | ✓ 34heLjzG-klSB3ja7ZSG5 | — | |
| yeshua.academy | ✓ kPspytKHjCLuis1ijCnhB | — | |

**Domain anomalies:** 1 orphaned domain record (finance.yeshua.academy with no links), 1 duplicate domain pair (jccpholdings.com × 2 for same app).

### 1.6 Mounts

| Type | hostPath / volume | mountPath | Entity |
|------|------------------|-----------|--------|
| bind | /var/backups/pgdump | /var/backups/pgdump | 16 applications (backup receiver) |
| volume | buildflow-data-staging | /var/lib/buildflow | 2 applications (BuildFlow + BuildFlow Staging) |
| volume | (buildflow-data-staging) | /app/public/media | clients-jpv-bootcamp-app-tp9xrk |

### 1.7 Images (28 total on AWS)

All images confirmed present. Three source-parity-exception images NOT present (by design):
- `ghcr.io/prochattools/accountant:latest` — missing (applicationStatus=error on Azure before migration)
- `ghcr.io/prochattools/prokit-studio:latest` — missing (applicationStatus=error on Azure)
- `ghcr.io/prochattools/saaskit-studio:latest` — missing (applicationStatus=error on Azure)

Buildflow pinned digest confirmed present: `sha256:4a657686731be6aa3912a9c8417b3de75261b017f324ff6d1d05175a749964d4` ✓

---

## STEP 2 — WORKLOAD CLASSIFICATION

### Applications

| appName | Classification | Reason |
|---------|---------------|--------|
| app-index-haptic-port-m88k9z (BuildFlow) | CANONICAL-ACTIVE | Primary build system, images pulled, status=done |
| app-transmit-online-hard-drive-of1m9k (BuildFlow Staging) | CANONICAL-ACTIVE | Staging instance of BuildFlow; separate deployment slot |
| web-cedula-b1gepj (Cedula) | CANONICAL-ACTIVE | Production app, image pulled, Supabase writer |
| apps-saas-egg-cooker-qtutkp (Egg Cooker) | CANONICAL-INACTIVE | GitHub source, status=idle, not actively deployed |
| app-override-online-interface-1wzjpb (fala) | KNOWN-BROKEN-SOURCE-PARITY | Image present but error status; broken on Azure pre-migration |
| apps-internal-free-resend-izqnvr (Free Resend) | CANONICAL-ACTIVE | GitHub build, used internally for email |
| web-public-jccp-holdings-pvtist (JCCP Holdings) | CANONICAL-ACTIVE | Production client site |
| web-public-jpv-bootcamp-l66egq (JPV Bootcamp) | CANONICAL-ACTIVE | Production public site, mutable :latest, actively developed |
| clients-jpv-bootcamp-app-tp9xrk (JPV Bootcamp Payload CMS) | CANONICAL-ACTIVE | Payload CMS backend, pinned SHA, Supabase writer |
| web-public-olivetoorganizing-zwthea (Oliveto Organizing) | CANONICAL-ACTIVE | Production client site |
| web-public-prochat-avejzq (ProChat) | CANONICAL-ACTIVE | Core platform, Supabase writer |
| web-public-prochat-accountant-zrekal (ProChat Accountant) | KNOWN-BROKEN-SOURCE-PARITY | Image missing + error on Azure; source-parity exception |
| boilerplates-prokit-dev-s5f8yz (ProKit Dev) | CANONICAL-INACTIVE | GitHub source, status=idle |
| templates-prokit-kcde8a (ProKit Studio) | KNOWN-BROKEN-SOURCE-PARITY | Image missing + error on Azure; source-parity exception |
| saas-proofly-ixcmnz (Proofly) | CANONICAL-ACTIVE | Production SaaS app |
| boilerplates-saaskit-dev-ixnolx (SaaSKit Dev) | CANONICAL-INACTIVE | GitHub source, status=idle |
| templates-saaskit-3ynx5a (SaaSKit Studio) | KNOWN-BROKEN-SOURCE-PARITY | Image missing + error on Azure; source-parity exception |
| web-says-the-bible-ing7sx (Says the Bible) | CANONICAL-ACTIVE | Production SaaS app |
| apps-saas-status-link-dw1c6j (Status Link) | CANONICAL-ACTIVE | Production SaaS app |
| demo-vault-legal-wtpg0l (Vault Legal) | CANONICAL-ACTIVE | Production frontend, Swarm service at 0/0 replicas |
| demo-vault-legal-api-drzgfx (Vault Legal API) | CANONICAL-ACTIVE | Production API backend |
| web-public-viadieden-kttqn4 (Via di Eden) | CANONICAL-ACTIVE | Production client site, pinned SHA |
| web-yeshua-academy-ariw56 (Yeshua Academy) | CANONICAL-ACTIVE | Production site |
| apps-saas-open-fund-vdymfu (Yeshua Academy Finance) | CANONICAL-ACTIVE | Production finance app |

**Summary:** 18 CANONICAL-ACTIVE, 3 CANONICAL-INACTIVE, 4 KNOWN-BROKEN-SOURCE-PARITY (fala, accountant, prokit-studio, saaskit-studio)

### Compose Projects

| appName | Classification | Reason |
|---------|---------------|--------|
| apps-internal-n8n-cvjx2s | CANONICAL-ACTIVE | Core automation platform; postgres running, n8n service stopped on AWS |
| compose-index-haptic-firewall-rlwj48 (ory) | CANONICAL-ACTIVE | Auth service; Supabase ory_prod writer; container stopped on AWS |
| ops-umami-sqswbj (umami) | CANONICAL-ACTIVE | Analytics; Supabase analytics writer; container stopped on AWS |
| 14 × compose-* tenant postgres | CANONICAL-ACTIVE | Local tenant databases; postgres containers running; no app services |

---

## STEP 3 — CONTROL-PLANE HYGIENE AUDIT

### Issue H1: ORPHANED APPLICATION DIRECTORY (low severity)

**Location:** `/etc/dokploy/applications/compose-index-haptic-firewall-rlwj48`  
**Finding:** This directory exists in the applications filesystem path but has no `/code` subdirectory. The corresponding workload is correctly registered in Dokploy as a compose project (not an application). The orphaned directory in `/applications/` is a stale artifact from a likely project type change.  
**Risk:** None active. No code, no container, no Swarm service.  
**Action (post-cutover only):** Remove stale directory as part of hygiene cleanup.

### Issue H2: ORPHANED COMPOSE FILESYSTEM ENTRY — FIRECRAWL (medium severity — audit only)

**Location:** `/etc/dokploy/compose/compose-quantify-cross-platform-matrix-1xuzkz/`  
**Finding:** A Firecrawl compose configuration exists on disk with a `/code` subdirectory containing a complete `docker-compose.yml`. This compose project is NOT registered in the Dokploy database (no DB record). Therefore it cannot be started through the Dokploy UI or auto-deploy mechanism.  
**Firecrawl services defined:** `firecrawl`, `playwright-service`, `api`, `redis`, `rabbitmq`, `nup-postgres`  
**Supabase risk:** The Firecrawl compose references `SUPABASE_URL`, `SUPABASE_ANON_TOKEN`, `SUPABASE_SERVICE_TOKEN` as environment variables. If these were populated and the compose were started manually via `docker compose up`, it would connect to Supabase.  
**Current state:** No Firecrawl containers are running. No Supabase connections from this host. `docker ps` confirms zero firecrawl processes.  
**Risk:** LOW given no DB record and no running containers. NOT part of the 15-app dual-writer matrix.  
**Action (post-cutover only):** Either register in Dokploy properly (if Firecrawl is intended to run) or remove the orphaned filesystem entry.

### Issue H3: DUPLICATE COMPOSE NAME (low severity)

**Finding:** Two compose projects share the human-readable name `jpvbootcamp`:
- `compose-hack-open-source-driver-mmchh4` — jpvbootcamp (name=jpvbootcamp, DB=tenant_jpvbootcamp)
- `compose-input-open-source-bandwidth-droye2` — jpvbootcamp (name=jpvbootcamp, DB=jpvbootcamp)

Both have distinct appNames, distinct databases, and serve different purposes (tenant schema data vs. application schema data). The naming overlap is confusing in the Dokploy UI but has no operational impact.  
**Action (post-cutover only):** Rename one to differentiate (e.g., "jpvbootcamp-tenant" vs "jpvbootcamp-app").

### Issue H4: DUPLICATE DOMAIN RECORD (low severity)

**Finding:** `jccpholdings.com` appears twice in the domain table, both linked to the same `applicationId` (HydSqf1OVKTELDuRW_KM3 = JCCP Holdings). This creates a redundant Traefik routing rule but does not break routing.  
**Action (post-cutover only):** Remove the duplicate domain record via Dokploy UI.

### Issue H5: ORPHANED DOMAIN RECORD (low severity)

**Finding:** A second record for `finance.yeshua.academy` has no `applicationId` and no `composeId`. It is a disconnected domain record.  
**Action (post-cutover only):** Remove the orphaned domain record.

### Issue H6: VAULT-LEGAL SWARM SERVICE AT 0/0 REPLICAS

**Finding:** `demo-vault-legal-wtpg0l` is the only non-infrastructure Swarm service present. It has desired replicas = 0 (explicitly scaled to 0 during Phase 3C2 shadow preparation). This is correct behavior — the shadow suppression was achieved by scaling to 0, not just autoDeploy=false.  
**All other 23 applications** have no Swarm service created at all on AWS — they are represented only in the Dokploy DB. This is consistent with Phase 3C2 findings (production application tasks = 0).  
**No action required.**

---

## STEP 4 — LOCK / STALE-RUNTIME AUDIT

### Application shadow suppressions

All 24 applications: `autoDeploy=false` ✓  
All 17 compose projects: `autoDeploy=false` ✓  
1 schedule: `enabled=false` ✓

### Running containers

ONLY these containers are running on AWS (verified via `docker ps`):

**Dokploy infrastructure (Swarm):**
- `dokploy.1.*` — Dokploy platform (healthy)
- `dokploy-traefik.1.*` — Traefik reverse proxy
- `dokploy-postgres.1.*` — Dokploy control-plane DB (postgres:16)
- `dokploy-redis.1.*` — Dokploy Redis

**Tenant local databases (Compose postgres backends only):**
- All 14 `compose-*-postgres-1` containers (postgres:15) — local tenant data, no Supabase connections
- `apps-internal-n8n-cvjx2s-postgres-1` (postgres:17-alpine) — n8n local DB, no Supabase connections

**NOT running (confirmed via docker ps):**
- `apps-internal-n8n-cvjx2s-n8n-1` — n8n service container ✓ STOPPED
- Any ory-kratos container ✓ STOPPED  
- Any umami container ✓ STOPPED
- Any application service containers ✓ ALL STOPPED

### Supabase connections from AWS

```
Active TCP connections to 10.0.2.4:5433 from 100.71.47.24: ZERO
```
Verified via `ss -tn | grep 10.0.2.4:5433` — no connections. ✓

**AWS is not writing to Supabase.** All active Supabase connections are from Azure production.

### Supabase active connections (from Azure production — read-only observation)

| Database | Connections | Source |
|----------|-------------|--------|
| _supabase | 21 | Supabase infrastructure |
| postgres | 10 | System/infrastructure + Azure apps |
| finance | 9 | Yeshua Academy Finance (active production use) |
| jpvbootcamp | 7 | JPV Bootcamp (active development — expected) |
| saysthebible | 5 | Says the Bible (active production use) |
| vault_legal | 1 | Vault Legal API |

### cloudflared

- Status: `masked` (symlink to /dev/null) ✓
- Service file: `/etc/systemd/system/cloudflared.service.staged` ✓ (451 bytes, unchanged)
- No cloudflared process running ✓

---

## STEP 5 — CONFIGURATION QUALITY AUDIT

### 5.1 Mutable :latest tags (drift risk at cutover)

Applications using `:latest` mutable tag (image will drift between now and cutover):

| Application | Image |
|-------------|-------|
| app-index-haptic-port-m88k9z (BuildFlow) | ghcr.io/stevewesthoek/buildflow:latest ⚠ |
| app-transmit-online-hard-drive-of1m9k (BuildFlow Staging) | ghcr.io/stevewesthoek/buildflow:latest ⚠ |
| web-cedula-b1gepj | ghcr.io/prochattools/cedula:latest ⚠ |
| app-override-online-interface-1wzjpb (fala) | ghcr.io/prochattools/fala:latest ⚠ |
| web-public-jccp-holdings-pvtist | ghcr.io/prochattools/jccp-holdings:latest ⚠ |
| web-public-jpv-bootcamp-l66egq | ghcr.io/prochattools/jpv-bootcamp:latest ⚠ (active development) |
| web-public-olivetoorganizing-zwthea | ghcr.io/prochattools/oliveto-organizing:latest ⚠ |
| web-public-prochat-avejzq | ghcr.io/prochattools/prochat:latest ⚠ |
| saas-proofly-ixcmnz | ghcr.io/prochattools/proofly:latest ⚠ |
| web-says-the-bible-ing7sx | ghcr.io/prochattools/says-the-bible:latest ⚠ |
| apps-saas-status-link-dw1c6j | ghcr.io/prochattools/statuslink:latest ⚠ |
| demo-vault-legal-wtpg0l | ghcr.io/prochattools/vault-legal-frontend:latest ⚠ |
| demo-vault-legal-api-drzgfx | ghcr.io/prochattools/vault-legal-backend:latest ⚠ |
| web-yeshua-academy-ariw56 | ghcr.io/yeshuaacademy/yeshuaacademy:latest ⚠ |
| apps-saas-open-fund-vdymfu | ghcr.io/yeshuaacademy/finance:latest ⚠ |

**Pinned (drift-safe):**
- `web-public-viadieden-kttqn4` → `via-di-eden:f2d0650e20f88527fffe1a895844bb1c2da563ed` ✓
- `clients-jpv-bootcamp-app-tp9xrk` → `jpv-bootcamp:a0c32276e403edbcbbab8fb576d91942810f0223` ✓
- `ghcr.io/stevewesthoek/buildflow` (pinned digest also pulled alongside :latest) ✓
- Umami: `ghcr.io/umami-software/umami:3.0.3` (explicit version tag) ✓

**Pre-cutover action required:** Re-pull all `:latest` images immediately before activating services (see Step 12, Final Sync Design).

### 5.2 Healthcheck coverage

**Docker Swarm healthchecks:** Only Dokploy infrastructure services have healthchecks defined. Application Swarm services have no healthcheck policy in the current configuration. This is pre-existing state from Azure.

**Compose healthchecks:** n8n postgres (postgres:17-alpine) has a healthcheck defined. The 14 tenant postgres:15 containers do not have healthchecks (postgres:15 base image has none configured).

**Post-cutover recommendation (NOT urgent):** Add healthchecks to critical application services post-migration.

### 5.3 Resource limits

No memory/CPU limits or reservations are set on any application (`memoryReservation`, `memoryLimit`, `cpuReservation`, `cpuLimit` all null). The AWS Lightsail xlarge instance (4 vCPU / 16 GB) provides adequate headroom for current workload.

---

## STEP 6 — SUPABASE READ-ONLY INVENTORY

**Connection method:** `BEGIN TRANSACTION READ ONLY;` → `SHOW transaction_read_only;` → confirmed `on` before all queries.

### 6.1 Logical databases (24 total)

| Database | Size | Classification |
|----------|------|---------------|
| _supabase | 2079 MB | SUPABASE-INTERNAL |
| accountant | 8197 kB | CANONICAL-ACTIVE |
| analytics | 11 MB | CANONICAL-ACTIVE (Umami) |
| cedula | 8205 kB | CANONICAL-ACTIVE |
| fala | 7957 kB | CANONICAL-ACTIVE |
| finance | 20 MB | CANONICAL-ACTIVE (Yeshua Academy Finance) |
| finance\ | 10 MB | **ANOMALY: backslash in database name** |
| finance_shadow | 7829 kB | SHADOW-DB (Prisma migration tooling) |
| jpvbootcamp | 27 MB | CANONICAL-ACTIVE (most active, under development) |
| olivetoorganizing | 7885 kB | CANONICAL-ACTIVE |
| openfund | 9965 kB | CANONICAL-ACTIVE |
| ory_prod | 9933 kB | CANONICAL-ACTIVE (Ory Kratos) |
| postgres | 117 MB | SUPABASE-SYSTEM (central, multi-schema) |
| prochat | 8333 kB | CANONICAL-ACTIVE |
| prokitstudio | 8061 kB | CANONICAL-ACTIVE |
| proofly | 8205 kB | CANONICAL-ACTIVE |
| resend | 9685 kB | CANONICAL-ACTIVE |
| saaskitstudio | 7989 kB | CANONICAL-ACTIVE |
| saysthebible | 10 MB | CANONICAL-ACTIVE |
| statuslink | 8805 kB | CANONICAL-ACTIVE |
| tenant_prokit | 8013 kB | LEGACY-CANDIDATE (tenant_ prefix at DB level) |
| tenant_saaskit | 8181 kB | LEGACY-CANDIDATE (tenant_ prefix at DB level) |
| vault_legal | 8645 kB | CANONICAL-ACTIVE |
| viadieden | 7949 kB | CANONICAL-ACTIVE |

**Anomalies:**
- `finance\` — a database with a literal backslash in its name. Likely a creation error. Contains ~10MB data. DO NOT DROP (audit only).
- `finance_shadow` — Prisma shadow database used during `prisma migrate dev`. Normal artifact of development workflow.
- `tenant_prokit`, `tenant_saaskit` — databases using the legacy `tenant_` prefix at the logical database level (see Step 8).

---

## STEP 7 — SUPABASE SCHEMA CLASSIFICATION (postgres database)

The central `postgres` database (117 MB) contains 64+ schemas across multiple categories:

### 7.1 Supabase Internal Schemas
`_realtime`, `auth`, `extensions`, `graphql`, `graphql_public`, `net`, `pgbouncer`, `public` (partial), `realtime`, `storage`, `supabase_functions`, `vault`

### 7.2 Active Application Schemas (tenant_ naming)

| Schema | Owner | Tables | Notes |
|--------|-------|--------|-------|
| tenant_cedula | supabase_admin | 5 | Active app data |
| tenant_jpvbootcamp | supabase_admin + postgres | 12 | Active app data |
| tenant_olivetoorganizing | postgres | 0 | No data yet |
| tenant_openfund | mcp_manager | 13 | Active app data |
| tenant_prochat | tenant_prochat_user | 7 | Active app data |
| tenant_procore | tenant_procore_user | 2 | Subscription + migrations only |
| tenant_prokit | tenant_prokit_user | 2 | Subscription + migrations only |
| tenant_prokitcore | tenant_prokitcore_user | 2 | Subscription + migrations only |
| tenant_prokitstudio | tenant_prokitstudio_user | 2 | Subscription + migrations only |
| tenant_resend | tenant_resend_user | 6 | Active app data |
| tenant_saaskit | tenant_saaskit_user | 4 | Active app data |
| tenant_saaskitcore | tenant_saaskitcore_user | 4 | Active app data |
| tenant_saaskitstudio | tenant_saaskitstudio_user | 4 | Active app data |
| tenant_saysthebible | saysthebible_user | 21 | Active, rich schema |
| tenant_statuslink | tenant_statuslink_user | 19 | Active, rich schema |
| tenant_viadieden | postgres | 0 | No data yet |

### 7.3 Active Application Schemas (non-tenant_ naming)

| Schema | Owner | Tables | Notes |
|--------|-------|--------|-------|
| finance | supabase_admin | 38 | Yeshua Academy Finance — comprehensive financial schema |
| jpvbootcamp | supabase_admin | 2 | JPV Bootcamp system schema |
| ya_finance_schema | ya_finance_user | 11 | Yeshua Academy Finance variant |

### 7.4 Public Schema Tables

The `public` schema contains:
- `tenants` (postgres-owned) — canonical tenant registry
- `WaitlistSubscriber`, `audiences`, `user_api_keys`, `user_profiles` (supabase_admin)
- `_prisma_migrations` (postgres)
- Legacy tables owned by `financialfreedom_user` (see Step 8)

### 7.5 Orphaned/Legacy Schemas

| Schema | Owner | Classification | Notes |
|--------|-------|---------------|-------|
| tenant_boilerplate | tenant_boilerplate_user | LEGACY-CANDIDATE | 4 tables, no matching active app |
| tenant_prochattools | tenant_prochattools_user | LEGACY-CANDIDATE | 4 tables, no matching active app |
| tenant_rebuildwp | mcp_manager | LEGACY-CANDIDATE | Owner mcp_manager, unusual owner |
| financialfreedom_schema | financialfreedom_user | LEGACY-ORPHAN | Entirely separate user, Laravel-style tables |
| maybe_schema | maybe_user | LEGACY-ORPHAN | Separate user, unknown application |

---

## STEP 8 — TENANT_ LEGACY AUDIT

Per Phase 3C4 authorization: **tenant_ prefix is HISTORICAL LEGACY. Do NOT rename, drop, or delete anything.**

### 8.1 Architecture clarification

The `tenant_` prefix exists at TWO levels in the current system:

**Level A — Logical database names (2 databases):**
- `tenant_prokit` (8013 kB)
- `tenant_saaskit` (8181 kB)

These two databases use the legacy naming convention at the database level. All other canonical application databases use non-prefixed names (e.g., `prochat`, `cedula`, `jpvbootcamp`).

**Level B — Schema names within the `postgres` database (19 schemas):**
- 16 active `tenant_*` schemas (see Step 7.2)
- 3 orphaned/legacy `tenant_*` schemas (`tenant_boilerplate`, `tenant_prochattools`, `tenant_rebuildwp`)

### 8.2 Architecture model (actual)

Despite the `tenant_` prefix convention being described as legacy, the current system still operates with `tenant_` schemas as the standard naming for application data within the central `postgres` database. Each application has:
1. A dedicated Supabase logical database (e.g., `/prochat`) for application-native data
2. A `tenant_*` schema in the central `postgres` database for cross-tenant registry data

This dual-layer architecture is fully operational. The `tenant_` naming is legacy in the sense that it reflects a previous multi-tenancy design decision, but the schemas contain live production data and should NOT be touched.

### 8.3 Legacy findings (audit only — no action)

- `tenant_boilerplate` schema: 4 tables (Audiences, Project, Subscription, _prisma_migrations). No matching active application. Post-cutover candidate for cleanup review.
- `tenant_prochattools` schema: 4 tables. May be associated with an older prochat deployment.
- `tenant_rebuildwp` schema: Owned by `mcp_manager`. Unknown application. No active workload.
- `financialfreedom_schema` + tables in `public`: Owned by `financialfreedom_user`. Appears to be a historical Laravel-based finance application entirely separate from current architecture.
- `maybe_schema`: Owned by `maybe_user`. Unknown legacy application.

---

## STEP 9 — DATABASE / APPLICATION CONSISTENCY MATRIX

### 9.1 Local tenant databases vs. manifests

All 14 local tenant postgres:15 containers verified against Phase 3A manifests:

| Compose | Database Name | Schemas | Live Tables | Manifest Tables | Drift |
|---------|--------------|---------|-------------|-----------------|-------|
| compose-bypass-optical-alarm-tb4ukd | tenant_prochat | public, tenant_prochat | 7 | 7 | **NONE** ✓ |
| compose-connect-wireless-application-d1n939 | tenant_viadieden | public, tenant_viadieden | 0 | 0 | **NONE** ✓ |
| compose-copy-auxiliary-protocol-3gfh3x | tenant_statuslink | public, tenant_statuslink | 19 | 19 | **NONE** ✓ |
| compose-copy-cross-platform-bus-wojn3n | tenant_prokitstudio | public, prokitstudio | 2 | 2 | **NONE** ✓ |
| compose-copy-open-source-interface-fkhqrw | tenant_saysthebible | public, tenant_saysthebible | 21 | 21 | **NONE** ✓ |
| compose-copy-redundant-capacitor-zc4esw | tenant_prokit | public, tenant_prokit | 2 | 2 | **NONE** ✓ |
| compose-generate-mobile-microchip-tksvis | openfund | public, ya_finance_schema, tenant_openfund | 24 | 24 | **NONE** ✓ |
| compose-generate-wireless-bandwidth-v7bvut | tenant_cedula | public, tenant_cedula | 5 | 5 | **NONE** ✓ |
| compose-hack-open-source-driver-mmchh4 | tenant_jpvbootcamp | public, tenant_jpvbootcamp | 12 | 12 | **NONE** ✓ |
| compose-input-open-source-bandwidth-droye2 | jpvbootcamp | public, jpvbootcamp | 2 | 2 | **NONE** ✓ |
| compose-navigate-optical-monitor-vi714i | tenant_olivetoorganizing | public, tenant_olivetoorganizing | 0 | 0 | **NONE** ✓ |
| compose-quantify-1080p-system-tp1q5f | tenant_saaskitstudio | public, tenant_saaskitstudio | 4 | 4 | **NONE** ✓ |
| compose-reboot-cross-platform-driver-6l6dun | tenant_resend | public, tenant_resend | 6 | 6 | **NONE** ✓ |
| compose-synthesize-bluetooth-panel-tg5mhy | tenant_saaskit | public, tenant_saaskit | 4 | 4 | **NONE** ✓ |

**Result: ZERO DRIFT across all 14 local tenant databases.** Table counts exactly match Phase 3A manifests.

Note: Two containers show empty schemas (tenant_viadieden, tenant_olivetoorganizing) — these had 0 tables at Phase 3A and remain 0. Consistent.

Note: `compose-copy-cross-platform-bus-wojn3n` has schema `prokitstudio` (not `tenant_prokitstudio`). This is the actual schema name in that container — consistent with manifest.

### 9.2 n8n database

- Container: `apps-internal-n8n-cvjx2s-postgres-1` (postgres:17-alpine, healthy)
- Database name: `n8n`
- Manifest table count: 54 tables
- n8n service container: NOT running on AWS ✓
- Status: Local DB intact, service suppressed

### 9.3 Dokploy internal database

- Manifest table count: 62 tables
- Status: Running, healthy (infrastructure requirement)

### 9.4 Supabase databases (authoritative, single source of truth)

Supabase is the single authoritative source for all Supabase database data. The local postgres:15 containers are independent data stores — they do NOT replicate to/from Supabase. The cutover final-sync addresses:
1. Local tenant DBs (fresh dump from Azure compose containers → restore to AWS)
2. The `jpvbootcamp` Supabase logical database (Supabase is self-contained, always current)

---

## STEP 10 — JPV BOOTCAMP DRIFT ANALYSIS + FINAL SYNC MANIFEST

### 10.1 Current state

JPV Bootcamp is **actively being developed on Azure**. Multiple indicators:
- 7 active Supabase connections to `jpvbootcamp` database
- `jpvbootcamp_staging` schema with 100+ tables and live data
- New database schemas added since Phase 3A (staging schema not present in original inventory)

### 10.2 Deployed images on AWS

| Tag | Digest | Used By |
|-----|--------|---------|
| `latest` | sha256:3b771f5725270156b7d885a9d394a31199f824eac87d1b7af246d36525a7d747 | web-public-jpv-bootcamp-l66egq (public site) |
| `a0c32276e403edbcbbab8fb576d91942810f0223` | sha256:4fe0917589221b3d4a2bd927861806967d95f5dcbea83b7975313adaec59063f | clients-jpv-bootcamp-app-tp9xrk (Payload CMS) |
| `9c045fa5a5c327014c20fe9377f7d5368b550573` | sha256:2f2481eb409e3b194142984f3ba254b60df50aeb9c42cfd62a4c0b69ddc843a1 | Not used by any app (stale pull from Phase 3C2) |

### 10.3 Drift assessment

**Image drift:** The `:latest` tag on AWS (sha:3b771f57) will have drifted by cutover time. Development is active. The `a0c32276` pinned SHA is stable but may not be the version intended for production at cutover.

**Data drift — Supabase jpvbootcamp database:**
- Production schema (`jpvbootcamp`): partner_sessions=50, customer_provisioning=22, stripe_webhook_events=6
- Staging schema (`jpvbootcamp_staging`): 500+ rows across 100+ tables (active development environment)
- This data CANNOT drift in a problematic sense — Supabase is the single source of truth and remains live throughout the migration. At cutover, Supabase is instantly current.

**Data drift — local tenant databases:**
- `compose-hack-open-source-driver-mmchh4` (tenant_jpvbootcamp): 12 tables, currently matches manifest
- `compose-input-open-source-bandwidth-droye2` (jpvbootcamp): 2 tables, currently matches manifest
- Both local DBs are frozen (no app writing to them on AWS). Azure production will continue writing to its local copies. These WILL drift between now and cutover.

### 10.4 Final sync manifest (JPV Bootcamp specific)

At cutover, immediately before starting writers:

| Item | Action |
|------|--------|
| `ghcr.io/prochattools/jpv-bootcamp:latest` | Re-pull from GHCR to get current production digest |
| `clients-jpv-bootcamp-app-tp9xrk` Payload CMS image | Confirm `a0c32276` is still the intended production version, or re-pull if updated |
| Local DB: tenant_jpvbootcamp | Fresh pg_dump from Azure `compose-hack-open-source-driver-mmchh4` → restore to AWS |
| Local DB: jpvbootcamp | Fresh pg_dump from Azure `compose-input-open-source-bandwidth-droye2` → restore to AWS |
| Supabase jpvbootcamp | **No action** — Supabase is live and authoritative. AWS connects to same instance. |
| Schedule: jpv-email-queue | Re-enable (`enabled=true`) after services are healthy |
| Volume: buildflow-data-staging | Sync from Azure buildflow container if content has changed |
| Volume: /app/public/media | Sync from Azure JPV Bootcamp Payload CMS container if media was uploaded |

---

## STEP 11 — GENERAL FINAL-DRIFT DETECTION

### 11.1 Local database drift (all apps)

All 14 local tenant databases: **ZERO DRIFT** vs. Phase 3A manifests (confirmed in Step 9).

These databases are frozen on AWS (no writers). Azure local DBs will drift as Azure production continues. Full final-sync dumps are required for all 14 before activating any writers.

### 11.2 Image drift

As of 2026-08-16, images on AWS match Phase 3C2/3C3 inventory. All `:latest` tags will drift between now and cutover. The final-sync design (Step 12) requires re-pulling all `:latest` images.

**Buildflow pinned digest:** `sha256:4a657686731b` confirmed present alongside `:latest`. Buildflow uses the pinned digest during cutover per Phase 3C3 design. ✓

### 11.3 Supabase data drift

Supabase is live Azure production. Data drift is continuous and expected — it is NOT a problem because Supabase remains the single authoritative source throughout. At the moment of cutover, Supabase is already current. No Supabase data sync is required.

Active databases with high churn (from connection counts):
- `finance`: 9 connections (actively used)
- `jpvbootcamp`: 7 connections (active development)
- `saysthebible`: 5 connections (active)
- `vault_legal`: 1 connection (active)

### 11.4 n8n workflow drift

n8n stores workflows and credentials in its local postgres container. The n8n volume (`apps-internal-n8n-cvjx2s_n8n_data`) contains n8n workflow state. The Azure n8n postgres contains the live workflow and credential data. This WILL drift.

**Final-sync requirement:** Fresh pg_dump of Azure n8n postgres → restore to AWS `apps-internal-n8n-cvjx2s-postgres-1` before starting n8n service.

### 11.5 Ory Kratos config drift

The `ory-config` volume exists on AWS (`docker volume ls` shows `ory-config`). The Ory Kratos compose uses it as read-only config storage. If the kratos config files have been updated on Azure since Phase 3A, the AWS volume may be stale.

**Final-sync requirement:** Compare kratos config on Azure vs. AWS `ory-config` volume before starting Ory Kratos service.

---

## STEP 12 — FINAL CUTOVER SYNC DESIGN

**DOCUMENTATION ONLY — NOT AUTHORIZED TO EXECUTE.**

This section defines the exact sync operations required immediately before writers are activated. All operations happen during Phase C of the cutover runbook (after Azure writers are stopped, before AWS writers start).

### 12.1 Full final-sync sequence

After Azure writers stopped (Phase C, cutover runbook):

```bash
# [AWS SAFE] Phase C: Final sync — execute IN ORDER

# C0. Pull fresh images for all :latest apps
docker pull ghcr.io/prochattools/jpv-bootcamp:latest
docker pull ghcr.io/prochattools/cedula:latest
docker pull ghcr.io/prochattools/fala:latest
docker pull ghcr.io/prochattools/jccp-holdings:latest
docker pull ghcr.io/prochattools/oliveto-organizing:latest
docker pull ghcr.io/prochattools/prochat:latest
docker pull ghcr.io/prochattools/proofly:latest
docker pull ghcr.io/prochattools/says-the-bible:latest
docker pull ghcr.io/prochattools/statuslink:latest
docker pull ghcr.io/prochattools/vault-legal-frontend:latest
docker pull ghcr.io/prochattools/vault-legal-backend:latest
docker pull ghcr.io/yeshuaacademy/yeshuaacademy:latest
docker pull ghcr.io/yeshuaacademy/finance:latest
docker pull ghcr.io/stevewesthoek/buildflow:latest
# (free-resend, prochat-accountant are github-build — rebuild at cutover)

# C1-C4. For each of 16 local databases: pg_dump on Azure → transfer → restore on AWS
# (As defined in cutover-runbook.md Phase C)
```

### 12.2 Priority sync items by drift risk

| Priority | Item | Drift Risk | Reason |
|----------|------|------------|--------|
| P0 (critical) | n8n postgres DB | High | Active workflows, credentials, in-flight executions |
| P0 (critical) | tenant_jpvbootcamp local DB | High | Active development on Azure |
| P0 (critical) | jpvbootcamp local DB | High | Active development on Azure |
| P1 (high) | All remaining 12 local tenant DBs | Medium | Continued production writes on Azure |
| P1 (high) | JPV Bootcamp :latest image | High | Active development pushes |
| P2 (medium) | All other :latest images | Low-medium | Infrequent pushes |
| P3 (low) | ory-config volume content | Low | Config changes rare |
| P3 (low) | buildflow-data-staging volume | Low | Small, infrequent changes |
| P3 (low) | Payload CMS media volume | Low | Media uploads infrequent |

### 12.3 Supabase (no sync required)

Supabase is NOT synced — it is the live authoritative database. At the moment of cutover:
- Azure Supabase writers are stopped (Phase B)
- AWS Supabase writers connect to the SAME Supabase instance (10.0.2.4:5433)
- No data transfer required

---

## STEP 13 — LEGACY CLEANUP ROADMAP

**Post-cutover only — do not execute until cutover is complete and stable.**

Documented at: `operations/migrations/dokploy-azure-to-lightsail/post-cutover-hygiene-roadmap.md`

### Priority 1 — Safe, non-breaking cleanup (run after 1 week of stable production)

| Item | Action |
|------|--------|
| Orphaned application directory | Remove `/etc/dokploy/applications/compose-index-haptic-firewall-rlwj48` |
| Orphaned domain record | Remove orphaned `finance.yeshua.academy` domain record via Dokploy UI |
| Duplicate domain record | Remove duplicate `jccpholdings.com` domain record |
| Duplicate compose names | Rename `compose-hack-open-source-driver-mmchh4` → "jpvbootcamp-tenant" in Dokploy |
| Stale jpv-bootcamp image | Remove `ghcr.io/prochattools/jpv-bootcamp:9c045fa5` (not used by any app) |

### Priority 2 — Requires investigation before action (run after 2 weeks)

| Item | Investigation Required |
|------|----------------------|
| Orphaned firecrawl compose | Confirm no active use → register in Dokploy OR remove filesystem entry |
| `finance\` database | Identify origin, confirm no application uses it, then drop |
| `finance_shadow` database | Confirm Prisma workflow no longer needs it, then drop |
| `tenant_boilerplate` schema | Identify owner app, confirm abandoned, then drop |
| `tenant_prochattools` schema | Same |
| `tenant_rebuildwp` schema | Same — unusual mcp_manager owner |
| `maybe_schema`, `financialfreedom_schema` | Identify applications, confirm abandoned, then drop (with owner) |
| `tenant_prokit` and `tenant_saaskit` databases | These are legacy DB-level naming — after confirming no active use, drop |

### Priority 3 — Architecture decisions (run after 1 month)

| Item | Decision Required |
|------|------------------|
| Remove fala from deployment | Confirm fala is truly deprecated → archive and delete |
| Rename `Egg Cooker`, `ProKit Dev`, `SaaSKit Dev` | Confirm these are dev-only, add naming convention |
| n8n workflow review | Audit n8n workflows for any that reference Azure hostnames or IPs |
| Healthcheck policy | Add Docker healthchecks to all critical Swarm services |
| Resource limits | Define and apply memory/CPU limits per service |

---

## STEP 14 — NO-OVER-OPTIMIZE FLAG

The following items were observed but intentionally NOT acted on or flagged as immediate blockers:

- Compose project naming (random strings like `compose-bypass-optical-alarm-tb4ukd`) — cosmetic only, Dokploy generates these
- `pg_temp_*` schemas in Supabase postgres DB — normal Supabase behavior, these are session temp schemas
- Multiple postgres versions (15, 16, 17-alpine) running on AWS — expected, different apps use different versions
- buildflow `:latest` also being present alongside pinned digest — Phase 3C3 design decision, not an issue
- Stale image `jpv-bootcamp:9c045fa5` — pulled in Phase 3C2 preparation, not used by active apps, not a risk
- `demo-vault-legal-wtpg0l` Swarm service at 0/0 — correct shadow state

---

## STEP 15 — DOCUMENTATION STATE AFTER PHASE 3C4

### Updated artifact status

| Artifact | Status |
|----------|--------|
| `phase-3c4-hygiene-audit-and-final-sync-design.md` | NEW (this document) |
| `cutover-runbook.md` | Valid — no changes required (final sync design aligns with existing Phase C) |
| `cutover-checklist.md` | Valid — no changes required |
| `phase-3c3-audit-and-cutover-packet.md` | Valid — hygiene findings complement, do not contradict |
| `migration-manifest.json` | Update pending: add phase3c4_validation block |

### Phase 3C4 findings vs. Phase 3C3 claims

All Phase 3C3 claims verified consistent:
- 24 applications ✓ (now identified: 18 canonical-active, 3 inactive, 4 broken-source-parity)
- 17 compose projects ✓
- 15 Supabase writers ✓ (still at 0 active connections from AWS)
- buildflow pinned digest ✓
- cloudflared masked ✓
- Production tasks = 0 ✓

New findings from Phase 3C4 (not in Phase 3C3):
1. Supabase has 24 logical databases with rich schema inventory
2. jpvbootcamp has a staging schema with active development data
3. All 14 local tenant DBs match Phase 3A manifests — zero drift
4. 5 hygiene issues identified (orphaned dirs, duplicate records)
5. Firecrawl orphaned compose config found — low risk, documented
6. `finance\` anomaly in Supabase — noted, no action
7. Legacy schemas inventory: financialfreedom, maybe_schema, tenant_boilerplate, etc.

---

## FINAL VERDICT

| Category | Result |
|----------|--------|
| AWS production isolation | CONFIRMED — zero application containers writing to Supabase |
| AWS shadow suppression | CONFIRMED — all 24 apps, 17 compose, 1 schedule suppressed |
| Local DB integrity | CONFIRMED — all 14 tenant DBs match Phase 3A manifests (zero drift) |
| Supabase read-only audit | COMPLETED — 24 databases, 64 schemas catalogued |
| JPV Bootcamp drift | DOCUMENTED — drift ongoing (expected), final-sync plan defined |
| Hygiene issues | 5 found (all low/medium severity, none blocking cutover) |
| Final sync design | DOCUMENTED (Step 12) |
| Legacy cleanup | DOCUMENTED (Step 13) |
| Cutover readiness | **UNCHANGED** — AWS remains ready, same state as Phase 3C3 verdict |

**AWS is in a clean, documented, production-ready shadow state. All local databases are intact. No Supabase writes from AWS. All suppressions active. Cutover requires only explicit authorization from Steve.**

---

## STOP — CUTOVER IMMUTABILITY CONSTRAINTS REMAIN IN FORCE

> AZURE DOKPLOY AND SUPABASE ARE IMMUTABLE PRODUCTION SYSTEMS.  
> AWS APPLICATION WRITERS REMAIN ZERO.  
> NO CUTOVER, NO DNS CHANGE, NO CLOUDFLARE ACTIVATION, NO SHADOW REVERSAL WITHOUT EXPLICIT MANUAL CUTOVER APPROVAL FROM STEVE.
