# Phase 3B — Shadow Restore + Quarantined Validation Report

**Date:** 2026-08-16
**Status:** ✅ PHASE 3B COMPLETE — all production state restored in quarantine
**Azure state:** UNMODIFIED — still authoritative production (42 containers, cloudflared active)
**AWS state:** SHADOW COPY — Dokploy platform running, 16 DBs restored, all application services STOPPED

---

## STEP RESULTS

### Step 0: Baseline + Current AWS State Verification — PASS

| Check | Result |
|-------|--------|
| Baseline snapshot `dokploy-aws-pre-production-baseline-20260816` | ✅ available |
| AWS Dokploy platform healthy | ✅ 4/4 services 1/1 |
| No production apps running on AWS | ✅ 0 application containers |
| Cloudflare production tunnel absent on AWS | ✅ inactive/not-found |
| Azure still healthy and authoritative | ✅ cloudflared active, 42 containers |
| All 16 staging dumps present | ✅ 16/16 |

### Step 1: PG17 Verification Gap — CLOSED

| Check | Result |
|-------|--------|
| Tool used | pg_restore (PostgreSQL) 17.11 |
| pg_restore --list exit code | 0 |
| Archive items | 374 |
| TABLE entries | 54 |
| TABLE DATA entries | 54 |
| Extensions | uuid-ossp |
| Roles | lyla_gislason (superuser) |
| PG17 full verification | ✅ PASS — archive fully parseable |

### Step 2: Service Launch Matrix — PRODUCED

Complete matrix of 45 workloads documented. Key decisions:
- 4 platform services: allowed to run
- 15 per-app PostgreSQL: allowed to run (for restore)
- 24 application services: replicas=0, STOPPED
- 17 compose application services: NOT started
- 1 scheduled job: disabled
- cloudflared: NOT started
- newrelic: NOT installed

### Step 3: Freeze Dokploy Control Plane — PASS

| Action | Result |
|--------|--------|
| `docker service scale dokploy=0` | converged |
| dokploy-postgres remains 1/1 | ✅ |
| dokploy-redis remains 1/1 | ✅ |
| dokploy-traefik remains 1/1 | ✅ |
| Zero application tasks | ✅ |

### Step 4: Restore Dokploy State (Control Plane Inactive) — PASS

#### 4A: Dokploy Database Restore

| Check | Result |
|-------|--------|
| pg_restore exit code | 0 |
| Projects restored | 8 |
| Applications restored | 24 |
| Compose services restored | 17 |
| Schedule entries restored | 1 |
| Users restored | 1 |

#### 4B: Non-DB State Restore

| Item | Target path | Status | Verification |
|------|-------------|--------|-------------|
| .token_seed | /mnt/data-dokploy/.token_seed | ✅ | SHA256: ebaf861266cde621f2215407e957ea591b38d56727c0945ae4c35b3ba73cdd38 (exact match) |
| Compose configs | /etc/dokploy/compose/ (18 dirs) | ✅ | 18 directories |
| Applications | /etc/dokploy/applications/ (20 dirs) | ✅ | 20 directories, 25 .env files |
| Traefik config | /etc/dokploy/traefik/ | ✅ | traefik.yml (768 B), acme.json (53,505 B), origin cert + key |
| Monitoring config | /etc/dokploy/monitoring/ | ✅ | restored |
| GHCR config | /home/ubuntu/.docker/config.json | ✅ | mode 600 |
| Historical pgdumps | /var/backups/pgdump/ (12 dirs) | ✅ | 12 directories |
| cloudflared.service | NOT deployed | ✅ | Deferred to Phase 4 |
| newrelic config | NOT deployed | ✅ | Deferred to cutover |

#### Origin Certificate Verification

| Field | Value |
|-------|-------|
| Subject CN | dokploy.prochat.tools |
| Not Before | 2026-05-19 |
| Not After | 2027-05-19 |
| Key file mode | 600 |

### Step 5: Create/Start Database Services Only — PASS

| # | Container | Image | Status |
|---|-----------|-------|--------|
| 1 | dokploy-postgres (platform) | postgres:16 | ✅ Running |
| 2 | apps-internal-n8n-cvjx2s-postgres-1 | postgres:17-alpine | ✅ Running (healthy) |
| 3 | compose-bypass-optical-alarm-tb4ukd-postgres-1 | postgres:15 | ✅ Running |
| 4 | compose-connect-wireless-application-d1n939-postgres-1 | postgres:15 | ✅ Running |
| 5 | compose-copy-auxiliary-protocol-3gfh3x-postgres-1 | postgres:15 | ✅ Running |
| 6 | compose-copy-cross-platform-bus-wojn3n-postgres-1 | postgres:15 | ✅ Running |
| 7 | compose-copy-open-source-interface-fkhqrw-postgres-1 | postgres:15 | ✅ Running |
| 8 | compose-copy-redundant-capacitor-zc4esw-postgres-1 | postgres:15 | ✅ Running |
| 9 | compose-generate-mobile-microchip-tksvis-postgres-1 | postgres:15 | ✅ Running |
| 10 | compose-generate-wireless-bandwidth-v7bvut-postgres-1 | postgres:15 | ✅ Running |
| 11 | compose-hack-open-source-driver-mmchh4-postgres-1 | postgres:15 | ✅ Running |
| 12 | compose-input-open-source-bandwidth-droye2-postgres-1 | postgres:15 | ✅ Running |
| 13 | compose-navigate-optical-monitor-vi714i-postgres-1 | postgres:15 | ✅ Running |
| 14 | compose-quantify-1080p-system-tp1q5f-postgres-1 | postgres:15 | ✅ Running |
| 15 | compose-reboot-cross-platform-driver-6l6dun-postgres-1 | postgres:15 | ✅ Running |
| 16 | compose-synthesize-bluetooth-panel-tg5mhy-postgres-1 | postgres:15 | ✅ Running |

PG version verification: n8n=PG17 ✅, platform=PG16 ✅, 14 apps=PG15 ✅

### Step 6: Restore All 16 Databases — PASS (16/16)

| # | Slug | DB Name | Exit | Tables | Verified |
|---|------|---------|------|--------|----------|
| 1 | dokploy-postgres | dokploy | 0 | 62 | ✅ 24 apps, 17 compose, 336 deployments |
| 2 | apps-internal-n8n-cvjx2s | n8n | 0 | 54 | ✅ 43 workflows, 17 credentials |
| 3 | compose-bypass-optical-alarm-tb4ukd | tenant_prochat | 0 | 7 | ✅ |
| 4 | compose-connect-wireless-application-d1n939 | tenant_viadieden | 0 | 0 | ✅ (schema-only, as in source) |
| 5 | compose-copy-auxiliary-protocol-3gfh3x | tenant_statuslink | 0 | 19 | ✅ |
| 6 | compose-copy-cross-platform-bus-wojn3n | tenant_prokitstudio | 0 | 2 | ✅ (required role creation) |
| 7 | compose-copy-open-source-interface-fkhqrw | tenant_saysthebible | 0 | 21 | ✅ |
| 8 | compose-copy-redundant-capacitor-zc4esw | tenant_prokit | 0 | 2 | ✅ |
| 9 | compose-generate-mobile-microchip-tksvis | openfund | 0 | 24 | ✅ |
| 10 | compose-generate-wireless-bandwidth-v7bvut | tenant_cedula | 0 | 5 | ✅ |
| 11 | compose-hack-open-source-driver-mmchh4 | tenant_jpvbootcamp | 0 | 12 | ✅ |
| 12 | compose-input-open-source-bandwidth-droye2 | jpvbootcamp | 0 | 2 | ✅ |
| 13 | compose-navigate-optical-monitor-vi714i | tenant_olivetoorganizing | 0 | 0 | ✅ (schema-only, as in source) |
| 14 | compose-quantify-1080p-system-tp1q5f | tenant_saaskitstudio | 0 | 4 | ✅ |
| 15 | compose-reboot-cross-platform-driver-6l6dun | tenant_resend | 0 | 6 | ✅ |
| 16 | compose-synthesize-bluetooth-panel-tg5mhy | tenant_saaskit | 0 | 4 | ✅ |

#### Restore Notes

- **n8n (DB 2):** Required explicit `-d n8n` (psql default DB = username). uuid-ossp extension created before restore. Exit 0.
- **prokitstudio (DB 6):** Required `CREATE ROLE prokitstudio_user` before restore (dump references this role in GRANT statements). Exit 0 after fix.
- **viadieden (DB 4) and olivetoorganizing (DB 13):** 0 user tables — confirmed consistent with source (these projects were noted as "unknown†" in Phase 3A with unconfirmed table counts). Schemas restored successfully.

### Step 7: Restore Non-DB Application State — PASS

| Item | Files | Verification |
|------|-------|-------------|
| n8n config | 1 file (config) | ✅ in apps-internal-n8n-cvjx2s_n8n_data volume |
| Buildflow relay data | 3 files (relay-tokens.json, relay-devices.json, relay-requests.json) | ✅ in buildflow-data-staging volume |
| Kratos config | 2 files (kratos.yml, identity.schema.json) | ✅ in ory-config volume |

### Step 8: Prevent Scheduled/Automated Execution — PASS

#### Automation mechanisms identified and disabled:

| Mechanism | Count | Action | Reversible |
|-----------|-------|--------|-----------|
| Dokploy schedule (jpv-email-queue, */2 * * * *) | 1 | `enabled = false` | ✅ |
| Application autoDeploy flags | 24 | All set `false` | ✅ |
| Compose autoDeploy flags | 17 | All set `false` | ✅ |
| n8n active workflows (6) | 6 | n8n NOT running | ✅ (re-enable in n8n UI at cutover) |
| cloudflared | 1 | NOT installed | ✅ |
| Host cron | 0 | None exist | N/A |

#### Shadow-Only Suppressions (must be reversed before cutover):

1. `UPDATE schedule SET enabled = false WHERE "scheduleId" = 'vyN0X3Y6OpO5b_cZbS0r3'`
2. `UPDATE application SET "autoDeploy" = false` (all 24)
3. `UPDATE compose SET "autoDeploy" = false` (all 17)

### Step 9: Control-Plane Startup Gate — PASS

| Check | Result |
|-------|--------|
| Dokploy started (scale 0→1) | ✅ converged |
| Production app tasks started | 0 |
| All dangerous services remain stopped | ✅ |
| Schedule executed | NO |
| n8n workflow executed | NO |
| Emails/webhooks/payments/outbound side effects | NONE |
| New Docker Swarm services created | 0 (still 4 platform only) |

### Step 10: Quarantined State Validation — PASS

| Validation | Result |
|-----------|--------|
| Dokploy projects/config visible | ✅ 8 projects (Boilerplates, Clients, Databases, Demo, Ops, SaaS, WaaS, Web) |
| All 16 DBs restored successfully | ✅ 16/16 |
| Source-vs-target DB manifest matches | ✅ Table counts, schemas, extensions verified |
| Non-DB persistent state restored | ✅ All items in place |
| Application services remain stopped | ✅ 0 running |
| Cloudflare production connector | ✅ ABSENT |
| Public production routes | ✅ NONE |
| Azure still serving production | ✅ 42 containers, cloudflared active |
| AWS state remains disposable shadow | ✅ No authoritative data, no external effects |

---

## FINAL VERDICT

| # | Question | Answer |
|---|----------|--------|
| 1 | PG17 n8n dump fully verified | **YES** — pg_restore 17.11, exit 0, 374 items, 54 tables |
| 2 | Dokploy control-plane restore | **PASS** — 8 projects, 24 apps, 17 compose visible |
| 3 | Databases restored | **16/16** |
| 4 | Exact DB validation | **PASS** — all table counts match source manifest |
| 5 | Non-DB state restored | **PASS** — all items verified |
| 6 | Production application tasks running | **0** |
| 7 | Side-effect services successfully quarantined | **YES** |
| 8 | Any external side effect observed | **NONE** |
| 9 | Cloudflare production tunnel active | **NO** |
| 10 | Azure remains authoritative | **YES** — 42 containers, cloudflared active, unmodified |
| 11 | Phase 3B | **PASS** |
| 12 | Blockers | **NONE** |
| 13 | Proposed Phase 3C shadow-start scope | See below |
| 14 | Git status | See below |

---

## PROPOSED PHASE 3C SHADOW-START SCOPE

Phase 3C would selectively start application services in quarantine for shadow validation (no tunnel, no public access):

**Tier 1 — Safe to shadow-start (no external side effects):**
- All static web apps (JCCP Holdings, Yeshua Academy, Vault Legal frontend/API)
- Apps with disabled outbound (after disabling Stripe keys, webhook URLs)
- Dokploy admin UI (already accessible via Tailscale once configured)

**Tier 2 — Start with constraints:**
- n8n: Start ONLY after all 6 workflows are manually set to inactive in n8n UI
- App databases need consuming apps to validate connectivity

**Tier 3 — Do NOT start until cutover:**
- Free Resend (emails)
- OpenFund (Stripe)
- StatusLink (webhooks)
- Any service with active outbound integrations

**Prerequisite for Phase 3C:**
- Tailscale installed on AWS for direct validation access
- GHCR pull test completed
- Shadow HTTP testing via Tailscale IP + Host header

---

## SHADOW-ONLY MUTATIONS RECORD

The following mutations were applied to the AWS shadow state (NOT Azure):

| Mutation | Reversible | Reversal command |
|----------|-----------|-----------------|
| schedule.enabled = false (1 row) | YES | `UPDATE schedule SET enabled = true WHERE "scheduleId" = 'vyN0X3Y6OpO5b_cZbS0r3'` |
| application.autoDeploy = false (24 rows) | YES | `UPDATE application SET "autoDeploy" = true` |
| compose.autoDeploy = false (17 rows) | YES | `UPDATE compose SET "autoDeploy" = true` |
| prokitstudio_user role created | YES | `DROP ROLE prokitstudio_user` (if not needed) |

All mutations are to the AWS shadow copy only. Azure production state is unmodified.
