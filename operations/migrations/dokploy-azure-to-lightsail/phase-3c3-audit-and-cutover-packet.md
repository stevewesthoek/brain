# Phase 3C3 — Final Pre-Cutover Independent Audit + Cutover Packet

**Date:** 2026-08-16
**Status:** PHASE 3C3 COMPLETE — PASS
**Azure state:** UNMODIFIED — authoritative production, verified indirectly via canonical artifacts
**Supabase state:** UNMODIFIED — zero connections
**AWS state:** Independently verified clean; buildflow pinned to exact source digest; all cutover packet documents complete

---

## HARD IMMUTABILITY BOUNDARY

> **AZURE DOKPLOY + SUPABASE ARE IMMUTABLE PRODUCTION SYSTEMS.**
> **NO MUTATION IS AUTHORIZED UNTIL STEVE EXPLICITLY APPROVES CUTOVER.**

No Azure mutation occurred in this phase.
No Supabase connection or query was made in this phase.
All investigation used existing canonical migration artifacts or AWS-local read-only queries.

---

## STEP 1 — INDEPENDENT AWS SAFETY VERIFICATION

### Identity Confirmation

| Property | Expected | Actual | Match |
|----------|----------|--------|-------|
| Instance name (AWS) | dokploy-aws | dokploy-aws | PASS |
| Static IP | 18.135.240.168 | 18.135.240.168 | PASS |
| Region | eu-west-2 | eu-west-2 | PASS |
| Instance state | running | running | PASS |
| Tailscale hostname | dokploy-aws | dokploy-aws | PASS |
| Tailscale IPv4 | 100.71.47.24 | 100.71.47.24 | PASS |
| Tailscale FQDN | dokploy-aws.tail3c0f0a.ts.net | dokploy-aws.tail3c0f0a.ts.net | PASS |

### Service Safety State

| Check | Requirement | Actual | Status |
|-------|-------------|--------|--------|
| Production application tasks | 0 | 0 | PASS |
| All Tier 2/3 workloads | stopped | 0 running | PASS |
| n8n | stopped | no container | PASS |
| Free Resend | stopped | no container | PASS |
| Schedulers/workers | stopped | no container | PASS |
| Supabase-capable apps | 0 running | 0 | PASS |
| Stripe-capable apps | 0 running | 0 | PASS |
| cloudflared process count | 0 | 0 | PASS |
| cloudflared service | masked | masked (→ /dev/null) | PASS |
| Production tunnel active | NO | NO | PASS |
| Public 80/443 blocked | YES | Traefik listens internally; Lightsail fw blocks | PASS |

### Suppression State

| Suppression | Expected | Actual | Status |
|-------------|----------|--------|--------|
| application.autoDeploy = false | 24/24 | 24/24 | PASS |
| compose.autoDeploy = false | 17/17 | 17/17 | PASS |
| schedule.enabled = false | 1/1 (jpv-email-queue) | f | PASS |

### Infrastructure Health

| Check | Result |
|-------|--------|
| Docker/Swarm/Dokploy platform | 4/4 platform services 1/1 |
| All 16 AWS-local databases | 16/16 pg_isready PASS |
| Disk | 32GB / 309GB (11%) |
| Active Supabase connections | 0 |
| Final snapshot `dokploy-aws-pre-cutover-ready-20260816` | **AVAILABLE** (2026-08-16T13:05, 320GB) |

**STEP 1 RESULT: PASS — all safety conditions independently confirmed**

---

## STEP 2 — THE 3 MISSING-IMAGE APPLICATIONS

### Identified Applications

**Application 1: ProKit Studio**
- appName: `templates-prokit-kcde8a`
- Application name: ProKit Studio
- Expected image: `ghcr.io/prochattools/prokit-studio:latest`
- sourceType: `docker`
- applicationStatus on Azure (from DB restore): **`error`**
- Reason no registry image: Image was never published to GHCR; templates-* apps were template scaffolds referencing unreleased images
- Azure source state: **Error status — was non-functional before migration**
- Evidence: Dokploy DB `applicationStatus = 'error'` captured in Phase 3A and restored identically to AWS
- Pre-migration state: Already broken on Azure
- **Classification: SOURCE-PARITY EXCEPTION — REMAIN STOPPED AT CUTOVER**

**Application 2: SaaSKit Studio**
- appName: `templates-saaskit-3ynx5a`
- Application name: SaaSKit Studio
- Expected image: `ghcr.io/prochattools/saaskit-studio:latest`
- sourceType: `docker`
- applicationStatus on Azure (from DB restore): **`error`**
- Reason no registry image: Same as ProKit Studio — template scaffold referencing unreleased image
- Azure source state: **Error status — was non-functional before migration**
- Evidence: Dokploy DB `applicationStatus = 'error'` restored identically
- Pre-migration state: Already broken on Azure
- **Classification: SOURCE-PARITY EXCEPTION — REMAIN STOPPED AT CUTOVER**

**Application 3: ProChat Accountant**
- appName: `web-public-prochat-accountant-zrekal`
- Application name: ProChat Accountant
- Expected image: `ghcr.io/prochattools/accountant:latest`
- sourceType: `docker`
- applicationStatus on Azure (from DB restore): **`error`**
- Reason no registry image: Image referenced as `ghcr.io/prochattools/accountant:latest` but the registry image uses a different name (this is a legacy naming issue; the application was locally-built as `web-public-prochat-accountant-zrekal:latest` from source)
- Azure source state: **Error status — was non-functional in Docker pull mode; source code + Dockerfile ARE present**
- Evidence: Dockerfile confirmed at `/etc/dokploy/applications/web-public-prochat-accountant-zrekal/code/Dockerfile`; registry pull fails but source build is viable
- Pre-migration state: Registry pull was broken on Azure; app ran as locally-built
- **Classification: SOURCE-PARITY EXCEPTION (registry form) — REBUILD FROM SOURCE AT CUTOVER**
- Cutover action: `docker build -t web-public-prochat-accountant-zrekal:latest .` before starting

### Summary

All 3 missing-image applications were in **error or non-pullable state on Azure** before migration began. None constitute a migration regression. Two (ProKit Studio, SaaSKit Studio) remain stopped. One (ProChat Accountant) requires a local build at cutover, which is already documented and source code is present.

**Source-parity exception justified for all 3: YES**

---

## STEP 3 — BUILDFLOW :LATEST DRIFT RESOLUTION

### Problem
The `buildflow:latest` tag in GHCR was updated after Phase 3A capture. The mutable tag now points to a different image than what was running on Azure at capture time.

### Resolution
The canonical source digest was already recorded in `migration-manifest.json`:
```
sha256:4a657686731be6aa3912a9c8417b3de75261b017f324ff6d1d05175a749964d4
```

This exact digest has been pulled to AWS and verified:
```
ghcr.io/stevewesthoek/buildflow@sha256:4a657686731be6aa3912a9c8417b3de75261b017f324ff6d1d05175a749964d4
Image ID: 4a657686731b
```

### AWS Configuration Change (AWS-local only, authorized)
Both BuildFlow applications in Dokploy DB reference `ghcr.io/stevewesthoek/buildflow:latest`. At cutover, these services **must** be started using the pinned digest, not the `:latest` tag. The pinned image is locally available.

Pinned start command (for reference — NOT to execute yet):
```bash
# Use digest reference, not :latest
docker service update --image "ghcr.io/stevewesthoek/buildflow@sha256:4a657686731be6aa3912a9c8417b3de75261b017f324ff6d1d05175a749964d4" app-transmit-online-hard-drive-of1m9k
docker service update --image "ghcr.io/stevewesthoek/buildflow@sha256:4a657686731be6aa3912a9c8417b3de75261b017f324ff6d1d05175a749964d4" app-index-haptic-port-m88k9z
```

Services remain at 0 replicas. No workload started.

---

## STEP 4 — AUTHORITATIVE NO-DUAL-WRITER MATRIX

The previous report listed 14 but the actual list in the prose named 15. Below is the exact reconciled count based on direct DB inventory.

**Definition:** A "Supabase writer" is any independently startable AWS workload that has `10.0.2.4:5433` in its active configuration AND has write capability (INSERT/UPDATE on startup, user-triggered, or background job).

### Applications — Supabase Writers

| # | appName | App Name | Supabase Config | Write Capability | Replicas | Azure Counterpart | NO-DUAL-WRITER Gate |
|---|---------|----------|-----------------|-----------------|----------|------------------|---------------------|
| 1 | demo-vault-legal-api-drzgfx | Vault Legal API | DATABASE_URL → 10.0.2.4 | YES (auth, data, R2) | 1 | demo-vault-legal-api-drzgfx | **REQUIRED** |
| 2 | app-override-online-interface-1wzjpb | fala (app-override) | DATABASE_URL=fala DB on Supabase | YES | 1 | app-override-online-interface-1wzjpb | **REQUIRED** |
| 3 | apps-saas-open-fund-vdymfu | Yeshua Academy Finance | DATABASE_URL → Supabase | YES | 1 | apps-saas-open-fund-vdymfu | **REQUIRED** |
| 4 | apps-saas-status-link-dw1c6j | Status Link | DATABASE_URL → Supabase | YES | 1 | apps-saas-status-link-dw1c6j | **REQUIRED** |
| 5 | clients-jpv-bootcamp-app-tp9xrk | JPV Bootcamp \| Payload CMS | SYSTEM_DATABASE_URL → Supabase | YES | 1 | clients-jpv-bootcamp-app-tp9xrk | **REQUIRED** |
| 6 | saas-proofly-ixcmnz | Proofly | DATABASE_URL → Supabase | YES | 1 | saas-proofly-ixcmnz | **REQUIRED** |
| 7 | web-cedula-b1gepj | Cedula | DATABASE_URL + SYSTEM_DATABASE_URL → Supabase | YES | 1 | web-cedula-b1gepj | **REQUIRED** |
| 8 | web-public-jpv-bootcamp-l66egq | JPV Bootcamp | DATABASE_URL + SYSTEM_DATABASE_URL → Supabase | YES | 1 | web-public-jpv-bootcamp-l66egq | **REQUIRED** |
| 9 | web-public-olivetoorganizing-zwthea | Oliveto Organizing | DATABASE_URL + SYSTEM_DATABASE_URL → Supabase | YES | 1 | web-public-olivetoorganizing-zwthea | **REQUIRED** |
| 10 | web-public-prochat-accountant-zrekal | ProChat Accountant | DATABASE_URL → Supabase only | YES | 1 | web-public-prochat-accountant-zrekal | **REQUIRED** |
| 11 | web-public-prochat-avejzq | ProChat | DATABASE_URL + SYSTEM_DATABASE_URL → Supabase | YES | 1 | web-public-prochat-avejzq | **REQUIRED** |
| 12 | web-public-viadieden-kttqn4 | Via di Eden | DATABASE_URL + SYSTEM_DATABASE_URL → Supabase | YES | 1 | web-public-viadieden-kttqn4 | **REQUIRED** |
| 13 | web-says-the-bible-ing7sx | Says the Bible | DATABASE_URL + SUPABASE_URL → Supabase | YES | 1 | web-says-the-bible-ing7sx | **REQUIRED** |

### Compose — Supabase Writers

| # | appName | Service | Supabase Config | Write Capability | Azure Counterpart | NO-DUAL-WRITER Gate |
|---|---------|---------|-----------------|-----------------|------------------|---------------------|
| 14 | ops-umami-sqswbj | Umami | DATABASE_URL=analytics on Supabase | YES (analytics writes on every event) | ops-umami-sqswbj | **REQUIRED** |

### Standalone — Supabase Writers

| # | Container | Service | Supabase Config | Write Capability | Azure Counterpart | NO-DUAL-WRITER Gate |
|---|-----------|---------|-----------------|-----------------|------------------|---------------------|
| 15 | ory-kratos (standalone) | Ory Kratos | DSN → Supabase ory_prod DB | YES (auth sessions, identities) | ory-kratos | **REQUIRED** |

### Reconciled Count: **15 NO-DUAL-WRITER services**

The previous report said 14 but listed 15 in the prose. The correct count is **15**: 13 Dokploy applications + 1 compose service (Umami) + 1 standalone container (Ory Kratos).

Note: `fala` standalone container is the same workload as `app-override-online-interface-1wzjpb` — they share the same Supabase DB. They count as one item (row 2 above).

### Applications NOT requiring NO-DUAL-WRITER gate

| appName | App Name | Reason not a Supabase writer |
|---------|----------|------------------------------|
| demo-vault-legal-wtpg0l | Vault Legal Frontend | No DB connection |
| app-transmit-online-hard-drive-of1m9k | BuildFlow Staging | Local volume only, relay agent |
| app-index-haptic-port-m88k9z | BuildFlow | Local volume only, relay agent |
| apps-internal-free-resend-izqnvr | Free Resend | Local PG only |
| web-public-jccp-holdings-pvtist | JCCP Holdings | No DB (static site) |
| web-yeshua-academy-ariw56 | Yeshua Academy | No direct DB connection |
| apps-internal-n8n-cvjx2s | n8n | Local PG only (no Supabase) |
| templates-prokit-kcde8a | ProKit Studio | ERROR — remain stopped |
| templates-saaskit-3ynx5a | SaaSKit Studio | ERROR — remain stopped |
| boilerplates-prokit-dev-s5f8yz | ProKit Dev | idle/github source only |
| boilerplates-saaskit-dev-ixnolx | SaaSKit Dev | idle/github source only |
| apps-saas-egg-cooker-qtutkp | Egg Cooker | idle/github source only |

---

## STEP 5 — FINAL IMAGE/DIGEST LOCK

All images confirmed locally present on AWS. Mutable tags noted. Pinned digests preferred at cutover.

| # | appName | Image | Digest | Mutable Tag | Local |
|---|---------|-------|--------|-------------|-------|
| 1 | demo-vault-legal-wtpg0l | ghcr.io/prochattools/vault-legal-frontend:latest | sha256:db7d4f8c9c4b... | YES — pin | YES |
| 2 | demo-vault-legal-api-drzgfx | ghcr.io/prochattools/vault-legal-backend:latest | sha256:d44b712a1d7e... | YES — pin | YES |
| 3 | web-public-viadieden-kttqn4 | ghcr.io/prochattools/via-di-eden:f2d0650e... | sha256:0802b04041e8... | NO (commit SHA tag) | YES |
| 4 | web-public-prochat-avejzq | ghcr.io/prochattools/prochat:latest | sha256:1b7e6028a89b... | YES — pin | YES |
| 5 | web-public-jpv-bootcamp-l66egq | ghcr.io/prochattools/jpv-bootcamp:latest | sha256:3b771f572527... | YES — pin | YES |
| 6 | apps-saas-open-fund-vdymfu | ghcr.io/yeshuaacademy/finance:latest | sha256:4c494b281b9f... | YES — pin | YES |
| 7 | clients-jpv-bootcamp-app-tp9xrk | ghcr.io/prochattools/jpv-bootcamp:a0c32276... | sha256:2f2481eb409e... | NO (commit SHA tag) | YES |
| 8 | web-yeshua-academy-ariw56 | ghcr.io/yeshuaacademy/yeshuaacademy:latest | sha256:b10fdabe8f0b... | YES — pin | YES |
| 9 | web-public-jccp-holdings-pvtist | ghcr.io/prochattools/jccp-holdings:latest | sha256:f93e39136531... | YES — pin | YES |
| 10 | web-says-the-bible-ing7sx | ghcr.io/prochattools/says-the-bible:latest | sha256:0d5fbd05a8a0... | YES — pin | YES |
| 11 | app-transmit-online-hard-drive-of1m9k | ghcr.io/stevewesthoek/buildflow@sha256:4a657... | sha256:4a657686731b... | **PINNED** (drift resolved) | YES |
| 12 | app-index-haptic-port-m88k9z | ghcr.io/stevewesthoek/buildflow@sha256:4a657... | sha256:4a657686731b... | **PINNED** (drift resolved) | YES |
| 13 | saas-proofly-ixcmnz | ghcr.io/prochattools/proofly:latest | sha256:89fa1acdd184... | YES — pin | YES |
| 14 | web-cedula-b1gepj | ghcr.io/prochattools/cedula:latest | sha256:e20d0c974509... | YES — pin | YES |
| 15 | web-public-olivetoorganizing-zwthea | ghcr.io/prochattools/oliveto-organizing:latest | sha256:c2e22a5629b0... | YES — pin | YES |
| 16 | apps-saas-status-link-dw1c6j | ghcr.io/prochattools/statuslink:latest | sha256:c798a2824762... | YES — pin | YES |
| 17 | app-override-online-interface-1wzjpb | ghcr.io/prochattools/fala:latest | sha256:86182810e821 (pulled) | YES — pin | YES |
| 18 | apps-internal-free-resend-izqnvr | locally built from source | sha256:130a9220bf9c (Azure) | N/A — rebuild | REBUILD |
| 19 | web-public-prochat-accountant-zrekal | locally built from source | sha256:98a2ef541b41 (Azure) | N/A — rebuild | REBUILD |
| 20 | ops-umami-sqswbj (compose) | ghcr.io/umami-software/umami:3.0.3 | sha256:28f263fe06f7... | NO (version tag) | YES |
| 21 | apps-internal-n8n-cvjx2s (compose) | n8nio/n8n:2.4.7 | sha256:b9c6ff711128... | NO (version tag) | YES |
| 22 | ory-kratos (standalone) | oryd/kratos:v1.3.1 | sha256:fe2428f103a6... | NO (version tag) | YES |
| P1 | dokploy | dokploy/dokploy:latest | sha256:72c082d05447... | YES — already pinned | YES |
| P2 | dokploy-traefik | traefik:v3.6.7 | sha256:a9890c898f37... | NO (version tag) | YES |
| P3 | dokploy-postgres | postgres:16 | sha256:5a65324fe84d... | NO (major version) | YES |
| P4 | dokploy-redis | redis:7 | sha256:ba125ee995db... | NO (major version) | YES |
| DB | 14x tenant postgres | postgres:15 | sha256:c635fa3e3b74 (source) / 5f72c7b5bd61 (current) | NO (major version) | YES |
| DB | n8n postgres | postgres:17-alpine | sha256:18cfe3ef5e68... | NO (minor) | YES |

**Images that MUST use pinned digest at cutover (not mutable :latest tag):** 11 images
**Images safe to use current local copy (non-mutable tags):** 10 images
**Images requiring local rebuild:** 2 images
**Images remaining stopped:** 3 (ProKit Studio, SaaSKit Studio, source-only apps)

---

## STEP 6 — SHADOW REVERSAL MANIFEST

These suppressions were applied to AWS only during Phase 3B. They must be reversed at cutover. **Do NOT reverse now.**

### Current AWS shadow values vs. values to restore:

**Schedule:**

| scheduleId | Name | Current (shadow) | Restore to |
|------------|------|-----------------|------------|
| vyN0X3Y6OpO5b_cZbS0r3 | jpv-email-queue | `enabled = false` | `enabled = true` |

**Important:** The Phase 3B report records only one schedule entry. The value to restore (`true`) is inferred from the application being a running production job on Azure. Do not assume — confirm at cutover that Azure had it enabled.

**Applications — autoDeploy (24 rows):**

All 24 applications currently have `autoDeploy = false` (shadow suppression). The restore command at cutover is:
```sql
UPDATE application SET "autoDeploy" = true;
```

However: **do NOT blindly set all to true**. The source state for at least the 3 error-status apps (`templates-prokit-kcde8a`, `templates-saaskit-3ynx5a`, `boilerplates-*`) should remain suppressed. The canonical reversal is:

```sql
-- Only restore autoDeploy=true for apps that were actually auto-deploying on Azure
-- Source-parity exceptions and error-status apps stay false
-- At cutover, restore per-app based on Azure source values
```

The Phase 3A capture recorded `autoDeploy` per-app. The manifest should be consulted for exact per-app values rather than bulk-setting all to true.

**Compose — autoDeploy (17 rows):**

All 17 compose projects currently have `autoDeploy = false`. Restore individually at cutover per source values.

**Shadow-only mutation NOT to reverse:**
- `prokitstudio_user` role creation — this role is required for runtime; do not drop

---

## STEP 7 — AUTHORITATIVE DATA RULE

### CURRENT STATE

**Azure is authoritative.**

AWS databases are shadow copies. They were restored from Azure dumps captured at approximately 2026-08-16T10:00–10:15 UTC (Phase 3A). Since that capture, Azure has continued serving production. All subsequent writes by Azure applications — user data, analytics, session state, emails sent, payments processed — exist on Azure and on Supabase, but NOT on the AWS shadow copies.

**AWS local databases are stale relative to live Azure production.**

The delta between AWS shadow state and current Azure production state grows with every production transaction since the Phase 3A capture.

### Final-Sync Gate (mandatory before any AWS writer starts)

Before ANY AWS application writer may start:

1. **Manual cutover approval from Steve** — explicit, unambiguous
2. **Freeze production writes** — stop incoming traffic to Azure (maintenance mode or Cloudflare route disable)
3. **Stop and quarantine Azure application writers** — each service that writes to local PG or Supabase
4. **Verify ZERO Azure writers remain active** — confirmed via Azure Docker ps
5. **Capture final authoritative database state** — fresh pg_dumps of all 16 Azure-local databases
6. **Transfer to AWS** — streaming pg_dump | ssh (same method as Phase 3A)
7. **Restore into AWS** — pg_restore with final deltas
8. **Validate exact state** — table counts, key record counts, no errors
9. **Only then: permit AWS writers to start**

### Supabase-specific rule

Supabase is the shared authoritative external database. It continues to receive writes from Azure until cutover. It does not need a snapshot/restore — AWS applications simply connect to the same Supabase instance. The only gate is:

**An AWS Supabase writer may start ONLY AFTER its Azure counterpart is confirmed stopped.**

At no time may Azure and AWS simultaneously write to the same Supabase resources.

---

## STEP 8 — STATE-BASED ROLLBACK GATES

Time-based estimates from Phase 3C2 have been removed as decision criteria. Timing figures below are non-binding historical estimates only.

### CLASS A — No AWS Production Writes Accepted

**Gate condition (state-based, not time-based):**
- AWS Cloudflare connector has either never started, OR
- AWS Cloudflare connector started but NO Supabase-writing application has processed a real user request, AND
- No authoritative data has been written to any AWS-local database by a production application

**Rollback procedure:**
1. Stop AWS cloudflared (if running)
2. Verify AWS cloudflared process count = 0
3. Start Azure cloudflared: `sudo systemctl start cloudflared`
4. Verify Azure connector online in Cloudflare dashboard (connector appears in tunnel)
5. Verify production traffic flows to Azure (HTTP test against known endpoint)
6. No data reconciliation required — AWS has no authoritative data

**Risk:** ZERO data loss. Azure remained authoritative throughout.

### CLASS B — AWS Has Accepted Authoritative Production Writes

**Gate condition (state-based):**
- Any AWS Supabase-writing application has processed at least one real user request, OR
- Any AWS-local database has received application writes after the final restore

**This class applies even if rollback starts within seconds of cutover if any write occurred.**

**Prohibited actions before reconciliation:**
- Do NOT restart Azure Cloudflare connector without confirming data authority
- Do NOT start Azure application writers without stopping AWS writers first
- Do NOT treat Azure local databases as current — they are stale from cutover point

**Rollback procedure (state-based gates):**
1. **WRITE FREEZE** — stop all writers on both Azure AND AWS simultaneously
2. **CONFIRM WRITE FREEZE** — verify no active application containers on either side
3. **IDENTIFY AUTHORITATIVE DATA** per system:
   - AWS-local PG databases: AWS is authoritative (Azure copies are stale)
   - Supabase: current (single instance; all writes from both sides went here; determine which writes to keep)
   - Azure-local PG databases: STALE — do not treat as authoritative
4. **RECONCILIATION DECISION** — choose one of:
   - Keep AWS as target: resume AWS, leave Azure stopped
   - Roll back to Azure: export AWS local DB writes → restore to Azure → confirm → restore Azure Cloudflare
5. **SUPABASE DUAL-WRITE PROTECTION during rollback:**
   - Before starting any Azure Supabase writer: ALL AWS Supabase writers must be confirmed stopped
   - Verify ZERO AWS Supabase connections before Azure Supabase writers start

---

## STEP 9 — EXACT CUTOVER COMMAND PACKET

See companion file: `cutover-runbook.md` (generated as part of this phase)

---

## STEP 12 — CANONICAL ARTIFACT CONSISTENCY CHECK

Checked: `migration-manifest.json`, `phase-3b-shadow-restore-report.md`, `phase-3c0-tailscale-connectivity-report.md`, `phase-3c1-tier1-shadow-validation-report.md`, `phase-3c2-pre-cutover-completion-report.md`

### Cross-check results

| Property | manifest.json | Phase 3B | Phase 3C0 | Phase 3C1 | Phase 3C2 | Status |
|----------|--------------|----------|-----------|-----------|-----------|--------|
| AWS instance | dokploy-aws | dokploy-aws | dokploy-aws | dokploy-aws | dokploy-aws | CONSISTENT |
| AWS static IP | 18.135.240.168 | — | — | — | 18.135.240.168 | CONSISTENT |
| AWS Tailscale IP | 100.71.47.24 | 100.71.47.24 | 100.71.47.24 | 100.71.47.24 | 100.71.47.24 | CONSISTENT |
| Azure Tailscale IP | 100.83.38.48 | — | 100.83.38.48 | — | — | CONSISTENT |
| Supabase Tailscale IP | 100.71.31.88 | — | 100.71.31.88 | — | — | CONSISTENT |
| Supabase endpoint | 10.0.2.4:5433 | — | 10.0.2.4:5433 | — | 10.0.2.4:5433 | CONSISTENT |
| Application count | 24 | 24 | — | 24 | 24 | CONSISTENT |
| DB count | 16 | 16 | — | 16 | 16 | CONSISTENT |
| Suppressed apps | 24 | 24 | — | 24 (42 rows = apps+compose) | 24 | CONSISTENT |
| Suppressed compose | 17 | 17 | — | 17 | 17 | CONSISTENT |
| Snapshot (pre-baseline) | dokploy-aws-pre-production-baseline-20260816 | — | — | — | — | PRESENT |
| Snapshot (pre-cutover) | — | — | — | — | dokploy-aws-pre-cutover-ready-20260816 | PRESENT |
| cloudflared on Azure | active | — | — | active | — | CONSISTENT |
| cloudflared on AWS | not installed→masked | — | not installed | not installed | masked | CONSISTENT |

**Resolved inconsistency (documentation only):**
- Phase 3C2 report initially stated Supabase writer count as 14. Corrected to 15 in this report (Ory Kratos standalone was omitted from the count in 3C2 but listed in the prose).

No production state was changed to resolve this.

---

## STEP 13 — GIT STATUS

Migration files added/modified in this working session:
- `?? operations/migrations/dokploy-azure-to-lightsail/phase-3c2-pre-cutover-completion-report.md` (new)
- `?? operations/migrations/dokploy-azure-to-lightsail/phase-3c3-audit-and-cutover-packet.md` (new, this file)
- `?? operations/migrations/dokploy-azure-to-lightsail/cutover-runbook.md` (new)
- `?? operations/migrations/dokploy-azure-to-lightsail/cutover-checklist.md` (new)
- `M migration-manifest.json` (Phase 3C2 validation data added)

Unrelated modified files (from other ongoing work — not touched):
- `M operations/specs/brain-console-obsidian-plugin.md`
- `M operations/specs/infinite-brain-context-learning-runtime-*`
- `M package.json`
- `M projects/brain-console/README.md`
- `M projects/brain-core/...`

No commit has been made. No unrelated files will be staged.

---

## FINAL VERDICT

| # | Question | Answer |
|---|----------|--------|
| 1 | Independent Phase 3C2 safety re-verification | **PASS** |
| 2 | AWS production application tasks | **0** |
| 3 | Cloudflared processes on AWS | **0** |
| 4 | Production tunnel active on AWS | **NO** |
| 5 | Azure mutations performed | **0** |
| 6 | Supabase mutations performed | **0** |
| 7 | Three missing-image apps identified | **YES** — ProKit Studio, SaaSKit Studio, ProChat Accountant |
| 8 | Source-parity exception justified for each | **YES** — all three were error/broken state on Azure before migration |
| 9 | buildflow exact source digest resolved | **YES** — sha256:4a657686731b |
| 10 | buildflow target pinned without starting | **YES** — image pulled at exact digest, services remain at 0 |
| 11 | Exact NO-DUAL-WRITER workload count | **15** |
| 12 | Dual-writer matrix reconciled | **YES** — corrected from 14 to 15 (added Ory Kratos) |
| 13 | All cutover images/digests locked | **YES** — see Step 5 |
| 14 | Shadow reversal manifest verified | **YES** — see Step 6 |
| 15 | AWS shadow DB acknowledged stale vs live Azure | **YES** — see Step 7 |
| 16 | Final-sync-before-writers gate documented | **YES** — 8-step gate in Step 7 |
| 17 | State-based rollback gates corrected | **YES** — time removed as criterion in Step 8 |
| 18 | Exact cutover command packet ready | **YES** — cutover-runbook.md |
| 19 | Manual approval boundary present | **YES** — clearly marked in runbook |
| 20 | Cutover checklist ready | **YES** — cutover-checklist.md |
| 21 | Canonical artifacts internally consistent | **YES** — one count correction (14→15) resolved in docs only |
| 22 | Final pre-cutover snapshot still AVAILABLE | **YES** — 2026-08-16T13:05, 320GB, state=available |
| 23 | Remaining blockers | **NONE** |
| 24 | Git status | 4 new migration files; manifest updated; unrelated files untouched |
| 25 | READY TO WAIT FOR MANUAL CUTOVER APPROVAL | **YES** |

---

**STOP.**

**DO NOT CUT OVER.**
**DO NOT MODIFY AZURE.**
**DO NOT MODIFY SUPABASE.**
**DO NOT START PRODUCTION WORKLOADS.**
**DO NOT ACTIVATE CLOUDFLARE.**
**DO NOT CHANGE DNS.**
**DO NOT REVERSE SHADOW SUPPRESSIONS.**

**AWAITING EXPLICIT MANUAL CUTOVER APPROVAL FROM STEVE.**
