# Phase 3F — Post-Cutover Closure Report

**Date:** 2026-08-17
**Phase:** 3F — Post-Cutover Closure + Normal Operation Restoration
**Status:** COMPLETE

---

## Summary

Phase 3F closed the Azure → AWS Dokploy migration by verifying production health,
resolving one migration parity defect (auth.prochat.tools routing), restoring
normal operational controls (schedule + autoDeploy), and updating canonical
authority documents.

---

## Cutover Timeline

| Event | Timestamp (UTC) |
|-------|-----------------|
| Cutover authorized | 2026-08-17 ~17:30 |
| Azure writers frozen | 2026-08-17 ~17:35 |
| 16 DB dumps captured + transferred | 2026-08-17 ~17:40–17:55 |
| AWS services deployed | 2026-08-17 ~17:50–17:57 |
| Cloudflare tunnel handoff | 2026-08-17 ~18:00 |
| All domains verified responding | 2026-08-17 ~18:05 |
| Post-cutover snapshot initiated | 2026-08-17 ~18:06 |
| Post-cutover snapshot AVAILABLE | 2026-08-17 ~18:50 |
| Phase 3F closure completed | 2026-08-17 ~18:55 |

**Total downtime:** ~28 minutes

---

## Final Authority State

| Component | Authority |
|-----------|-----------|
| Production runtime | AWS Lightsail dokploy-aws (eu-west-2, London) |
| Azure VM | Powered on, quiesced, rollback source only |
| Cloudflare tunnel | AWS connector active, Azure connector stopped |
| Supabase PostgreSQL | Same server (100.71.31.88:5433), reached from AWS |
| Writer authority | AWS workloads active, Azure writers at 0/0 |
| Rollback class | B (production writes accepted on AWS) |

---

## Azure Fallback State

| Component | State |
|-----------|-------|
| VM | RUNNING |
| cloudflared | INACTIVE (stopped during cutover) |
| Supabase-writing services (13) | ALL at 0/0 replicas |
| Non-writer services (6) | Running but unreachable (no tunnel) |
| Platform (Dokploy, Traefik, Redis, PG) | Running |
| Disks/volumes/files | INTACT |
| Databases | INTACT (frozen at cutover point-in-time) |

---

## Post-Cutover Snapshot

| Field | Value |
|-------|-------|
| Name | dokploy-aws-post-cutover-20260817 |
| Status | AVAILABLE |
| Created | 2026-08-17T19:06:04+01:00 |
| Size | 320 GB |

---

## Database Restore Results

16/16 databases restored successfully during cutover:
- 14 × PostgreSQL 15 (application databases)
- 1 × PostgreSQL 16 (Dokploy control-plane)
- 1 × PostgreSQL 17 (n8n)

All restores verified with SHA-256 checksums at transfer time.

---

## Production Domain Validation

| Domain | Status | Type |
|--------|--------|------|
| prochat.tools | 200 | PRODUCTION |
| yeshua.academy | 200 | PRODUCTION |
| jpvbootcamp.com | 200 | PRODUCTION |
| olivetoorganizing.com | 200 | PRODUCTION |
| jccpholdings.com | 200 | PRODUCTION |
| getproofly.app | 200 | PRODUCTION |
| saysthe.bible | 200 | PRODUCTION |
| viadieden.it | 200 | PRODUCTION |
| cedula.prochat.tools | 200 | PRODUCTION |
| finance.yeshua.academy | 200 | PRODUCTION |
| resend.prochat.tools | 200 | PRODUCTION |
| onestatus.link | 200 | PRODUCTION |
| preview.jpvbootcamp.com | 200 | PRODUCTION |
| auth.prochat.tools/health/alive | 200 | PRODUCTION (API) |
| legal-api.prochat.tools/health | 200 | PRODUCTION (API) |
| legal.prochat.tools | 307 | PRODUCTION (redirect) |
| auth-admin.prochat.tools | 307 | PRODUCTION (admin) |
| buildflow-staging.prochat.tools | 502 | STAGING (Cloudflare config issue) |

**Production-critical: 17/17 PASS**

---

## Normalized Operational Controls

### Schedule

| Schedule | Pre-freeze | Post-normalization |
|----------|------------|-------------------|
| vyN0X3Y6OpO5b_cZbS0r3 (jpv-email-queue) | enabled=true | enabled=true |

Cron: `*/2 * * * *` — processes JPV Bootcamp email queue via preview.jpvbootcamp.com API.

### autoDeploy

| Type | Pre-freeze | Post-normalization |
|------|------------|-------------------|
| Application (24) | ALL true | ALL true (24/24) |
| Compose (17) | ALL true | ALL true (17/17) |

---

## Migration Parity Defect Resolved

**auth.prochat.tools** — Traefik file-provider dynamic config (`ory.yml`) was not migrated.

- **Source evidence:** Azure `/etc/dokploy/traefik/dynamic/ory.yml`
- **Fix applied:** Created identical file on AWS at `/etc/dokploy/traefik/dynamic/ory.yml`
- **Verification:** `auth.prochat.tools/health/alive` → 200 externally
- **Rollback:** Delete file (Traefik auto-removes routes)

---

## Known Pre-Existing Broken Apps

These were in error state BEFORE migration and are NOT migration closure blockers:

| App | Issue | Migration-caused? |
|-----|-------|-------------------|
| web-public-prochat-accountant-zrekal | Needs local image build | NO |
| app-override-online-interface-1wzjpb (fala) | Needs local image build | NO |
| templates-prokit-kcde8a | Unused template, error state | NO |
| templates-saaskit-3ynx5a | Unused template, error state | NO |

---

## Non-Blocking Post-Migration Follow-Ups

1. **buildflow-staging.prochat.tools 502** — Internal routing works (Traefik → container → 200). Issue is Cloudflare tunnel public hostname configuration (remotely managed). Needs Cloudflare Zero Trust dashboard investigation.

2. **Traefik Docker provider not detecting compose containers** — The `docker` provider in `traefik.yml` is configured but only `@swarm` routes appear. Ory was fixed via file provider. Investigation needed for root cause (socket mount, provider priority, or Swarm-mode limitation).

3. **Build locally-built images on AWS** — `prochat-accountant` and `fala` need `docker build` on AWS to restore from error state. Non-critical (pre-existing).

4. **Azure decommission planning** — Azure remains powered on as rollback source. Future decision needed on retention period and eventual teardown.

5. **Lightsail firewall ports** — Verify HTTP/HTTPS ports are open in Lightsail networking (currently working via Cloudflare tunnel, but direct access policy should be documented).

---

## Phase 3F Actions Taken (AWS Only)

1. Terminated 2 orphaned local SSH shells (harmless stale clients)
2. Confirmed post-cutover snapshot AVAILABLE
3. Created `/etc/dokploy/traefik/dynamic/ory.yml` (parity fix)
4. Enabled schedule `vyN0X3Y6OpO5b_cZbS0r3` (pre-freeze parity)
5. Set `autoDeploy=true` for 24 applications (pre-freeze parity)
6. Set `autoDeploy=true` for 17 compose services (pre-freeze parity)
7. Updated `prochat-infrastructure-architecture.md` header + invariants

---

## Azure Mutations Beyond Cutover Quiescing

**ZERO.** Azure was not modified during Phase 3F. All Azure reads were inspection-only.

## Supabase Administrative Mutations

**ZERO.** No schema changes, no administrative queries. Only normal production writes from live AWS applications.

---

## CORE MIGRATION CLOSED: YES

The Azure → AWS Dokploy production cutover is complete. AWS is the authoritative
production runtime. Azure remains intact as a quiesced rollback source.
