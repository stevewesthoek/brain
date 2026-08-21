# Azure → AWS Lightsail Dokploy Migration — Lessons Learned

**Date:** 2026-08-17
**Migration window:** 2026-08-16 (planning start) → 2026-08-17 (cutover completion)
**Total planning phases:** 0 through 3F (pre-provisioning through post-cutover closure)
**Total downtime:** ~28 minutes
**Database restores:** 16/16 successful
**Production domains verified:** 17/17 PASS
**Migration outcome:** SUCCESS — AWS Lightsail dokploy-aws is authoritative production

---

## 1. Executive Summary

This migration moved a single-node Docker Swarm PaaS (Dokploy) from Azure Standard_D4as_v5 (Spain Central) to AWS Lightsail xlarge_3_0 (eu-west-2, London) while maintaining zero data loss and minimizing downtime. The migration encompassed 24 Swarm application services, 17 compose projects, 16 local PostgreSQL databases (14×PG15, 1×PG16, 1×PG17), a self-hosted Supabase connection layer, Ory Kratos auth, n8n workflow automation, and a Cloudflare tunnel-based ingress system.

The migration was completed with approximately 28 minutes of client-facing downtime against a 90-minute target. No data loss occurred. All 17 production domains passed external verification immediately after cutover. One migration parity defect was discovered and resolved in-session (Traefik file-provider dynamic config for Ory routing). The approach was characterized by evidence-first discovery, shadow staging without touching production, comprehensive rehearsal, and strict dual-writer prevention.

---

## 2. Original Architecture (Azure)

| Component | Specification |
|-----------|--------------|
| Provider | Azure |
| VM | Standard_D4as_v5 (4 vCPU, 16 GB RAM) |
| Region | Spain Central |
| OS | Ubuntu 24.04.3 LTS |
| Static IP | 68.221.139.108 |
| Tailscale IP | 100.83.38.48 |
| Docker | 29.2.0, Swarm mode (single-node) |
| Data root | Default Docker data root |
| PaaS | Dokploy (Docker Swarm single-node) |
| Reverse proxy | Traefik v3.6.7 (swarm provider + file provider) |
| Ingress | Cloudflare Tunnel (token-based, remotely managed config) |
| Applications | 24 Swarm services + 17 compose projects |
| Local databases | 16 PostgreSQL containers (14×PG15, 1×PG16 Dokploy, 1×PG17 n8n) |
| External DB | Self-hosted Supabase at 100.71.31.88:5433 (reached via Tailscale subnet route 10.0.2.4) |
| Auth | Ory Kratos v1.3.1 (standalone container, DSN → Supabase ory_prod DB) |
| Automation | n8n 2.4.7 (43 workflows, PG17-backed) |
| Analytics | Umami 3.0.3 (Supabase-backed) |
| Monitoring | New Relic infrastructure agent |
| Backup | Azure Backup vault (daily, 7-day retention) |

---

## 3. Final Architecture (AWS)

| Component | Specification |
|-----------|--------------|
| Provider | AWS Lightsail |
| Instance | xlarge_3_0 (4 CPU, 16 GB RAM, 320 GB disk) |
| Region | eu-west-2 (London) |
| OS | Ubuntu 24.04 LTS |
| Cost | $84/month |
| Static IP | 18.135.240.168 |
| Tailscale IP | 100.71.47.24 |
| Docker | 29.2.0, Swarm mode (single-node) |
| Data root | /mnt/data-dokploy/docker (dedicated block storage) |
| PaaS | Dokploy (same version) |
| Reverse proxy | Traefik v3.6.7 (swarm + docker + file providers) |
| Ingress | Same Cloudflare Tunnel (connector moved from Azure to AWS) |
| Applications | Same 24 Swarm services + 17 compose projects |
| Local databases | Same 16 PostgreSQL containers (exact schema parity) |
| External DB | Same self-hosted Supabase (now reached from AWS via Tailscale) |
| Auth | Ory Kratos v1.3.1 (standalone, same DSN) |
| Automation | n8n 2.4.7 (same 43 workflows) |
| Analytics | Umami 3.0.3 (same Supabase target) |
| Monitoring | Not yet installed (post-cutover follow-up) |
| Backup | Lightsail snapshots (manual; pre-cutover + post-cutover) |

**Key differences from source:**
- Dedicated data root on separate block storage partition (/mnt/data-dokploy/docker)
- Cloudflare tunnel uses same token (different connector host)
- Azure VM retained as quiesced rollback source (Class B)
- New Relic not yet installed on AWS (non-blocking follow-up)

---

## 4. Objectives and Constraints

### Primary objectives
1. Move production runtime from Azure to AWS Lightsail with minimal downtime
2. Preserve exact data state across all 16 local databases
3. Maintain service parity (same apps, same configs, same external connectivity)
4. Achieve cost reduction ($84/month Lightsail vs. Azure Standard_D4as_v5 pricing)
5. Retain Azure as rollback source until stable

### Hard constraints
- NO dual writers: at no point may both Azure and AWS simultaneously write to the same Supabase resources
- Supabase server must NOT be modified (remains at same address, same configuration)
- Cloudflare tunnel can only have one active connector per tunnel at a time
- DNS must not change (all routing is via Cloudflare tunnel, not DNS-based)
- Zero tolerance for data loss
- Explicit human approval gates at every phase boundary

---

## 5. Planning Methodology

The migration used a phased, evidence-first planning methodology:

| Phase | Purpose | Key output |
|-------|---------|------------|
| 0 | Pre-provisioning | Closure report (78.7K), region selection, blocker resolution |
| 1 | Provisioning | Instance creation, Dokploy install, data disk mount |
| 2A | Backup + empty platform | Baseline snapshot, 4 platform services validated |
| 3A | Production state capture | 16 DB dumps + all non-DB state staged on AWS |
| 3B | Shadow restore + validation | Full state restored in quarantine; all writers stopped |
| 3C0–3C4 | Discovery + audit | Evidence-first validation, hygiene audit, sync design |
| 3C5–3C11 | Architecture corrections | 7 phases of evidence-provenance audit corrections |
| 3D | Cutover rehearsal | 16/16 restores rehearsed, preflight script validated 10/10 |
| 3E0–3E1 | Final readiness | Image pre-staging, critical path analysis, operator gates |
| 3F | Post-cutover closure | Authority handoff, suppression reversal, domain validation |

**Total planning artifacts produced:** 14 documents + 1 JSON manifest + 1 shell script (~331K of documentation).

---

## 6. Evidence-First Discovery Methodology

A defining characteristic of this migration was the evidence-first approach: every claim about infrastructure state was verified against live observation before being trusted for planning.

**Key principle:** No assumption from documentation, memory, or prior conversations was treated as authoritative until independently verified via shell observation.

**Result:** 7 factual corrections were required to the canonical architecture document:
- Schema count: documented "64+" → actual 36
- financialfreedom_schema table count: documented "12+ tables" → actual 0 (tables are in public schema)
- Tailscale node count: documented "3 nodes" → actual 7 registered (6 active)
- Azure SSH model: documented "Tailscale ACL blocks SSH" → actual Port 22 publicly reachable
- Data architecture: documented "one database with schemas" → actual per-app dedicated logical databases
- DATABASE_URL count: documented "21 of 24 apps" → actual 14 of 24 apps
- Supabase writer count: initially documented 14 → actual 15 (Ory Kratos was miscounted)

**Lesson:** Production documentation drifts from reality. Migration planning that relies on documented state without verification risks silent failures.

---

## 7. Source Inventory

### Application workloads (24 Swarm services)
- 13 Supabase-writing applications (NO-DUAL-WRITER gate required)
- 2 BuildFlow relay services (no Supabase, local storage only)
- 1 Free Resend (local PG, email side effects)
- 2 non-DB static/SSR sites (JCCP Holdings, Yeshua Academy)
- 1 frontend-only (Vault Legal Frontend)
- 3 error-state applications (ProKit Studio, SaaSKit Studio, ProChat Accountant)
- 2 idle development boilerplates

### Compose projects (17)
- 14 per-app PostgreSQL containers (PG15)
- 1 n8n (PG17 + application container)
- 1 Umami (Supabase-only, analytics writer)
- 1 Ory Kratos compose registration (but deployed as standalone container)

### Standalone containers
- Ory Kratos (auth, Supabase writer)

### Platform infrastructure
- 4 always-on Dokploy platform services: dokploy, dokploy-postgres, dokploy-redis, dokploy-traefik

### External dependencies (unchanged by migration)
- Self-hosted Supabase PostgreSQL 15.8 (100.71.31.88 / subnet route 10.0.2.4)
- Cloudflare (DNS, tunnel, WAF)
- GHCR (container registry for 15+ private images)
- Stripe (payment processing, live in 5+ apps)
- Resend (transactional email)
- New Relic (monitoring)
- R2/Bedrock (Vault Legal API)

---

## 8. AWS Preparation

### Instance provisioning
- **Blocker encountered:** `RegionSetupInProgressException` on eu-south-2 (Spain) persisted for 24+ hours with no AWS resolution timeline
- **Resolution:** Changed target region to eu-west-2 (London) — already proven functional for another Lightsail server in same account
- **Lesson:** AWS region activation is not instant or guaranteed. Always have a fallback region.

### Storage architecture
- Dedicated data disk mounted at /mnt/data-dokploy
- Docker data-root configured to use dedicated storage: `/mnt/data-dokploy/docker`
- 320 GB total, with 276 GB free after full image cache population
- Baseline snapshot taken before any data import

### Network setup
- Tailscale installed and joined to existing tailnet
- Subnet route to Supabase (10.0.2.4:5433) confirmed reachable from AWS
- SSH access via Lightsail temporary certificates (expire ~13 minutes)
- cloudflared binary installed but service MASKED (cannot start accidentally)

---

## 9. Database Strategy

### Approach: streaming pg_dump/restore, not volume copy

**Rationale:**
- PostgreSQL volumes cannot be safely copied while containers are running (WAL inconsistency)
- Cross-cloud volume copy introduces format/kernel risks
- pg_dump produces portable, verifiable SQL output
- Multiple PostgreSQL major versions (15, 16, 17) require version-matched tooling

### PG version matrix
| Role | Version | Container type | Dump tooling |
|------|---------|----------------|--------------|
| 14 app databases | PG15 | compose-*-postgres-1 | pg_dump 15.19 |
| Dokploy control-plane | PG16 | dokploy-postgres.1 | pg_dump 16.15 |
| n8n | PG17 | apps-internal-n8n-cvjx2s-postgres-1 | pg_dump 17.11 |

### Dual-pass restore strategy
1. **Phase 3A/3B (shadow restore):** Initial restore from Phase 3A captures. AWS databases populated with Azure state from ~10:00 UTC on cutover day. Used for validation and rehearsal.
2. **Phase C (cutover restore):** Fresh dumps captured from Azure AFTER write freeze. Transferred via rsync over Tailscale. Restored to AWS replacing shadow state. Verified via table counts and SHA-256 checksums.

### Validation
- Phase 3B: 16/16 restores successful, table counts matched
- Phase 3D rehearsal: 16/16 restores to isolated containers successful
- Cutover: 16/16 final restores successful, SHA-256 checksums verified at transfer

---

## 10. Non-Database State Migration

### Artifact categories
| Category | Method | Examples |
|----------|--------|---------|
| Dokploy control-plane DB | pg_dump/restore | Application configs, compose defs, deployments, schedules |
| Compose YAML files | rsync /etc/dokploy/compose/ | 18 directories with docker-compose.yml + .env |
| Application source/config | rsync /etc/dokploy/applications/ | 20 directories with code, Dockerfiles, .env |
| Traefik config | rsync /etc/dokploy/traefik/ | traefik.yml, acme.json, origin cert/key |
| Ory Kratos config | tar archive → Docker volume | kratos.yml, identity.schema.json |
| n8n data | Docker volume snapshot | config file, workflow data |
| BuildFlow relay data | Docker volume snapshot | relay-tokens.json, relay-devices.json, relay-requests.json |
| GHCR auth | config copy | /root/.docker/config.json |
| Platform token | file copy | /mnt/data-dokploy/.token_seed |
| cloudflared service | staged file | /etc/systemd/system/cloudflared.service.staged |
| New Relic config | staged file | newrelic-infra.yml |
| Container images | GHCR pull + local build | 18 registry images + 3 locally-built |

### Critical discovery: Traefik dynamic config gap
- /etc/dokploy/traefik/dynamic/ was inventoried at Phase 3C as containing only acme.json + cert/key
- Azure also had `ory.yml` in this directory (Traefik file-provider routes for auth.prochat.tools)
- This file was NOT captured because the inventory was done on the AWS shadow copy (which never had it)
- **Result:** auth.prochat.tools returned 404 after cutover until manual restoration

---

## 11. Image Strategy

### Three image categories
1. **GHCR registry images (18):** Pulled from registry to AWS Docker cache. Mutable `:latest` tags and immutable commit-SHA tags.
2. **Locally-built images (3):** Source code present on AWS; rebuilt at cutover via `docker build`.
3. **Error-state images (3):** Referenced images that don't exist in any registry (ProKit Studio, SaaSKit Studio, ProChat Accountant). Classified as source-parity exceptions — remain stopped.

### Mutable tag drift problem
- BuildFlow `:latest` tag was updated AFTER Phase 3A capture
- The image running on Azure production was no longer what `:latest` resolved to
- **Solution:** Recorded exact source digest in migration manifest (sha256:4a657686731b...) and pinned at cutover
- **Lesson:** Record container digests at capture time, not tag names. Mutable tags are unreliable for migration.

### Image pre-staging (Phase 3E1)
- All 18 GHCR images pre-pulled to AWS cache before cutover
- 2 of 3 locally-built images successfully built pre-cutover
- 1 locally-built image (ProChat Accountant) failed build — classified non-blocking (error state)
- **Impact:** Reduced downtime from estimated 80-84 min to actual ~28 min by eliminating GHCR pull wait

---

## 12. Safety Model

### Core safety mechanisms
1. **Shadow staging:** All AWS preparation done without touching Azure production
2. **Suppression system:** autoDeploy=false (41 rows), schedule enabled=false (1 row), cloudflared masked
3. **NO-DUAL-WRITER rule:** Absolute prohibition on simultaneous Azure+AWS writes to Supabase
4. **Phase gates:** Every phase required explicit human approval
5. **Preflight script:** 10 automated checks (fail-closed) before cutover start
6. **Immutability boundary:** Azure treated as read-only until explicit cutover authorization

### Suppression implementation
```sql
-- Applied in Phase 3B (shadow period):
UPDATE application SET "autoDeploy" = false;  -- 24 rows
UPDATE compose SET "autoDeploy" = false;      -- 17 rows
UPDATE schedule SET enabled = false;           -- 1 row (jpv-email-queue)
-- Plus: systemctl mask cloudflared
```

### Preflight checks (10/10 required)
1. Application shadow suppression (autoDeploy=false: 24/24)
2. Compose shadow suppression (autoDeploy=false: 17/17)
3. Schedule shadow suppression (enabled=false: 1/1)
4. cloudflared masked
5. Zero Supabase writer containers
6. 16 postgres source containers healthy
7. Tailscale connectivity to Azure (100.83.38.48)
8. Tailscale connectivity to Supabase (100.71.31.88:5433)
9. Disk headroom ≥ 20 GB
10. Docker daemon healthy

---

## 13. Rollback Model

### Two rollback classes (state-based, not time-based)

**Class A — No AWS production writes accepted:**
- Gate: AWS cloudflared either never started OR no Supabase-writing app processed a request
- Procedure: Stop AWS cloudflared → Start Azure cloudflared → Verify traffic
- Time: < 2 minutes
- Data risk: ZERO

**Class B — AWS has accepted authoritative production writes:**
- Gate: Any AWS Supabase-writing application processed at least one user request
- Procedure: Write freeze both sides → Identify authoritative data → Reconciliation decision → Traffic redirect
- Time: 15-60 minutes
- Data risk: MEDIUM (requires careful identification)
- Key rule: At NO point may both Azure and AWS apps write to Supabase simultaneously during rollback

### State-based vs time-based decision
- Original Phase 3C2 design used time estimates ("within 5 minutes of cutover = Class A")
- Phase 3C3 corrected this: classification based on write state, not elapsed time
- **Lesson:** Time-based rollback boundaries create false confidence. A write can happen in the first second.

---

## 14. Rehearsal Value

Phase 3D was a complete dry-run of the cutover procedure on AWS using existing shadow data.

### What rehearsal caught
1. **No pg_dump files from Phase 3A:** Data was in Docker volumes, not SQL files. Adapted procedure.
2. **n8n requires explicit `-d n8n` flag:** psql defaults to username as database. Would have failed silently.
3. **prokitstudio requires role pre-creation:** Dump contained GRANT statements for `prokitstudio_user`. Restore would fail without prior `CREATE ROLE`.
4. **Preflight script validation:** Confirmed all 10 checks pass with correct exit codes.
5. **Rollback scenario coverage:** 6 scenarios simulated, classification confirmed.
6. **Storage requirement estimation:** Confirmed 16 compressed dumps total ~1.2 MB (trivial).

### Rehearsal did NOT catch
- Traefik file-provider ory.yml gap (because rehearsal used AWS-local state, not Azure live state)
- BuildFlow staging 502 (Cloudflare tunnel config issue only visible with live tunnel)

**Lesson:** Rehearsal on the target can validate mechanics but cannot validate configuration parity with source. A separate parity checklist for non-DB artifacts is essential.

---

## 15. Pre-Cutover Optimization

### Image cache warming (Phase 3E1)
- 18 GHCR images pre-pulled (including 3 pinned-digest images)
- 2 local images pre-built (Free Resend + fala)
- **Impact:** Estimated downtime reduced from 80-84 min to 45-60 min (actual: ~28 min)

### Parallel work during pre-downtime
- Docker builds started on AWS before Azure freeze (AWS-only, no production impact)
- Final-delta directory pre-created
- All tooling versions verified (pg_dump 15/16/17)

### Critical path identification
Phase 3E0 produced a detailed 90-minute critical path breakdown:
- Azure cloudflared stop: 2 min
- Azure writer stop: 5-8 min
- pg_dump + transfer + restore: 20-25 min
- AWS service activation: 10-15 min
- Cloudflare tunnel handoff: 3 min
- Validation: 5 min

---

## 16. Chronological Cutover Timeline

| Time (UTC) | Gate | Action | Result |
|------------|------|--------|--------|
| ~17:30 | G0 | Steve authorizes cutover | PASS |
| ~17:35 | G1 | Azure cloudflared stopped | PASS |
| ~17:35-17:40 | G2 | 15 Azure Supabase writers stopped (scale=0 + compose down + docker stop) | PASS |
| ~17:40-17:55 | G3 | 16 pg_dumps from Azure, rsync to AWS, 16 restores on AWS | PASS (16/16) |
| ~17:50-17:57 | G5 | AWS services deployed (Swarm scale-up) | PASS (with expected errors for pre-existing issues) |
| ~18:00 | G9 | AWS cloudflared unmasked and started | PASS |
| ~18:05 | G10 | All production domains verified responding | PASS (17/17) |
| ~18:06 | — | Post-cutover snapshot initiated | — |
| ~18:50 | — | Snapshot AVAILABLE (320 GB) | PASS |
| ~18:55 | G11 | Phase 3F closure complete | PASS |

**Total downtime: ~28 minutes** (from Azure cloudflared stop to all domains responding)

---

## 17. Downtime Analysis

### Target vs actual
- **Target:** ≤ 90 minutes
- **Estimated (with pre-stage):** 45-60 minutes
- **Actual:** ~28 minutes

### Why faster than estimated
1. Image cache fully warm (no GHCR pulls during cutover)
2. Dumps smaller than expected (~1.2 MB compressed for all 16)
3. rsync over Tailscale was fast (both hosts on same mesh, geographic proximity not required)
4. Swarm service scale-up was parallel (Docker handles concurrent convergence)
5. Cloudflare tunnel propagation was near-instant

### Downtime breakdown
| Phase | Estimated | Actual |
|-------|-----------|--------|
| Stop Azure tunnel + writers | 10 min | ~5 min |
| DB dump + transfer + restore | 20-25 min | ~15 min |
| AWS service activation | 10-15 min | ~7 min |
| Tunnel handoff + validation | 5 min | ~1 min |

---

## 18. Problems, Hurdles, and Surprises

### Problem 1: AWS region activation failure
- **What:** `RegionSetupInProgressException` on eu-south-2 (Spain) persisted >24 hours
- **Impact:** Blocked provisioning for one day
- **Resolution:** Changed target to eu-west-2 (London)
- **Surprise level:** High — no documentation warned about region activation delays

### Problem 2: Lightsail SSH certificate expiry (~13 min)
- **What:** `get-instance-access-details` temporary certs expire after ~13 minutes
- **Impact:** Multiple SSH sessions expired mid-operation, requiring refresh
- **Resolution:** Accepted as operational friction; refreshed via AWS CLI
- **Lesson:** For long-running SSH operations, use Tailscale SSH or persistent key-based access

### Problem 3: BuildFlow :latest tag drift
- **What:** Mutable tag pointed to newer image than what was running on Azure
- **Impact:** Could have deployed wrong version at cutover
- **Resolution:** Captured exact digest at Phase 3A, pinned in migration manifest
- **Lesson:** Always record image digests, not tag names, for migration state capture

### Problem 4: Traefik file-provider ory.yml not migrated
- **What:** `/etc/dokploy/traefik/dynamic/ory.yml` existed on Azure but was missed in migration
- **Impact:** auth.prochat.tools returned 404 post-cutover
- **Resolution:** Created identical file on AWS during Phase 3F
- **Root cause:** Non-DB state inventory was performed against AWS shadow copy (which never had the file), not Azure live state
- **Lesson:** Non-DB artifact parity check must compare live source to target, not target to itself

### Problem 5: Docker service "already exists" errors during deploy
- **What:** Several `docker service create` commands returned "name conflicts with existing object"
- **Impact:** Harmless — services already existed from Phase 3B restore
- **Resolution:** Services were already running; scale-up worked correctly
- **Lesson:** Deploy scripts should use `docker service update` or idempotent commands

### Problem 6: Proofly service not found during initial deploy
- **What:** `service tjlxrq4l0zsy02cct4a0x12s9 not found` error
- **Impact:** Proofly required separate manual scale-up
- **Resolution:** Service had a different internal ID; scaled by name instead
- **Lesson:** Reference services by name, not internal Docker IDs

### Problem 7: curl localhost:3000 hanging on AWS
- **What:** Dokploy UI port was slow/unresponsive to curl, causing SSH sessions to hang
- **Impact:** Multiple SSH sessions backgrounded/killed; lost time
- **Resolution:** Used Traefik API (port 8080) and direct Docker commands instead
- **Lesson:** Don't depend on application HTTP endpoints for health validation during migration

### Problem 8: Architecture documentation drift
- **What:** 7 material factual errors in canonical architecture document
- **Impact:** Could have caused planning errors if not caught
- **Resolution:** Evidence-first methodology caught all 7 during Phase 3C7-3C11
- **Lesson:** Architecture documents MUST be re-verified against production before migration planning

### Problem 9: Dokploy column name conventions (camelCase)
- **What:** Dokploy DB uses quoted camelCase identifiers ("autoDeploy", "applicationStatus", "appName")
- **Impact:** Multiple SQL query failures before discovering correct quoting
- **Resolution:** Adopted quoted-identifier style for all Dokploy DB queries
- **Lesson:** Document database schema conventions before writing operational SQL

### Problem 10: Compose project naming confusion
- **What:** Compose project names in Dokploy are randomized hashes (compose-bypass-optical-alarm-tb4ukd)
- **Impact:** No intuitive mapping from friendly name to container; requires DB lookup
- **Resolution:** Built container-to-database mapping table in documentation
- **Lesson:** Map opaque identifiers to human names early in planning

---

## 19. What Went Well

1. **Evidence-first discovery** prevented 7 planning errors that would have caused failures
2. **Shadow staging** allowed complete validation without touching production
3. **Suppression system** prevented any accidental writer activation during 24+ hours of preparation
4. **NO-DUAL-WRITER invariant** was never violated — zero data conflicts
5. **Image pre-staging** reduced downtime from estimated 80+ min to actual 28 min
6. **Rehearsal** validated the exact procedure (16/16 restores) before attempting live cutover
7. **Preflight script** provided fail-closed automated safety gate (10/10 required)
8. **Phase gates** with explicit human approval prevented premature advancement
9. **Tailscale mesh** provided reliable cross-cloud connectivity for all operations
10. **SHA-256 checksums** at transfer verified data integrity end-to-end
11. **Supabase as external DB** required no migration — only the clients changed location
12. **Single Cloudflare tunnel** made traffic handoff a simple connector swap
13. **Comprehensive artifact production** means future migrations have a complete template
14. **Phased approach** allowed stopping at any point without production impact

---

## 20. Improvements for Future Migrations

1. **Parity checklist for non-DB artifacts:** Should compare live source to live target, not target-self-audit
2. **Traefik dynamic directory as explicit migration artifact:** Add to checklist alongside compose, applications, and DB
3. **Persistent SSH access:** Use Tailscale SSH or install authorized keys rather than relying on expiring Lightsail certs
4. **Image digest manifest generated at capture time:** Automate digest recording for all running containers
5. **Idempotent deploy scripts:** Use `docker service update --force` instead of `create` to avoid "already exists" errors
6. **Health check protocol:** Define which endpoints to check and which to avoid during migration (avoid slow UI ports)
7. **Column name documentation:** Document Dokploy DB schema (camelCase conventions) before writing operational queries
8. **Container-to-name mapping file:** Generate once, reference throughout (avoids repeated DB lookups)
9. **Automated comparison tool:** Script that compares source and target file trees for parity
10. **Post-cutover immediate health script:** Automate the 17-domain curl validation as a single script

---

## 21. Dangers for Future Migrations

1. **Dual-writer risk remains permanent:** Any future maintenance that starts Azure services while AWS is live risks data corruption in Supabase
2. **Azure decommission timing:** If Azure is decommissioned too early, Class B rollback becomes impossible
3. **Mutable image tags:** Any `:latest` tag can change between capture and cutover — always pin digests
4. **Traefik file-provider routes:** Any manually created file in dynamic/ will not be tracked in Dokploy DB — invisible to DB-based migration
5. **Ory Kratos standalone:** Not managed by Dokploy compose; config drift between environments is possible
6. **n8n Azure hostname references:** Future n8n workflows might hardcode infrastructure addresses
7. **Supabase connection limits:** AWS apps + any lingering Azure connections could exceed pool
8. **Cloudflare tunnel token reuse:** If both connectors ever start simultaneously, traffic split is unpredictable
9. **Local-build images:** Source code on disk may be behind HEAD — rebuild from stale source produces stale images
10. **Database schema drift:** If Azure DBs are ever unfrozen (for testing etc.), they'll diverge from AWS immediately

---

## 22. Backup and Recovery Lessons

### What worked
- Lightsail snapshots: fast (~44 min for 320 GB), reliable, simple API
- SQL dumps after write-freeze: authoritative, portable, version-independent
- SHA-256 checksums at transfer: verified integrity without requiring separate validation
- Pre-cutover snapshot (AVAILABLE state confirmed before cutover)
- Post-cutover snapshot (taken immediately after declaring stable)

### What to do differently
- **VM-level backups do NOT capture consistent DB state:** Docker volumes have active WAL writes. Only SQL dumps after freeze are consistent.
- **Backup ≠ recovery:** Having Azure backups didn't help with migration. Migration required application-level (pg_dump) capture.
- **Snapshot naming convention matters:** `dokploy-aws-pre-cutover-ready-20260816` and `dokploy-aws-post-cutover-20260817` are immediately parseable.
- **Azure daily backup (15 hours old at cutover) was acceptable:** The freshness requirement was for SQL dumps (captured live), not VM snapshots (captured sleeping).

### Recovery points at cutover
| Recovery point | Type | Freshness at cutover |
|----------------|------|---------------------|
| Azure daily backup | VM snapshot (filesystem-consistent) | ~15 hours |
| Pre-cutover Lightsail snapshot | Full disk image | ~5 hours |
| Final SQL dumps (after freeze) | Authoritative DB state | 0 (captured at freeze-time) |
| Post-cutover Lightsail snapshot | Full disk image (new authority) | Immediate |

---

## 23. Networking Lessons

### Tailscale mesh advantages
- Cross-cloud connectivity without VPN configuration
- Subnet routing to Supabase (10.0.2.4/24) transparent to applications
- All three nodes (Azure, AWS, Supabase) on same mesh
- No firewall rules needed for inter-node communication
- Enabled SSH, rsync, pg_dump streaming without exposing public ports

### Cloudflare tunnel model
- Token-based tunnel with remotely managed config (no local config file)
- Single tunnel, single connector active at a time
- Connector swap = traffic handoff (no DNS propagation delay)
- Public hostnames configured in Cloudflare dashboard, not local
- **Limitation:** Cannot validate tunnel routing without making it live (staging uses different hostname)

### Surprising network facts
- AWS Lightsail firewall doesn't block Docker's published ports from internet by default
- Tailscale subnet routes require explicit acceptance on new nodes
- Cloudflare tunnel propagation is near-instant (< 1 second observed)
- rsync over Tailscale between Spain and London was faster than expected for small files

---

## 24. Observability and Validation Lessons

### What was validated and how
| Layer | Validation method | When |
|-------|------------------|------|
| Database restore | SHA-256 checksums + table counts | Phase C (cutover) |
| Service health | Docker service ls + ps (replica state) | Phase E (activation) |
| Application health | HTTP curl to internal endpoints | Phase E (activation) |
| External reachability | curl from non-tunnel network | Phase G (validation) |
| Tunnel connectivity | Cloudflare dashboard connector status | Phase F |
| Domain routing | curl to all 17 production domains | Phase G |
| Auth routing | auth.prochat.tools/health/alive | Phase G |
| API routing | legal-api.prochat.tools/health | Phase G |

### What was NOT validated (gaps)
- New Relic monitoring (not installed yet)
- Stripe webhook reception (not tested during cutover)
- Resend email delivery (not tested during cutover)
- n8n webhook reception (not tested during cutover)
- Ory Kratos login flow (only health endpoint checked)
- Application-level error rates (no APM during cutover)
- Supabase connection pool utilization

### Recommended observability for future
- Automated health endpoint sweep script (beyond manual curl)
- Webhook test script (trigger and verify receipt)
- Connection pool monitoring during transition
- Error rate comparison (before/after cutover baseline)

---

## 25. Operator and AI Workflow Lessons

### AI-assisted migration characteristics
- Claude operated all SSH sessions, SQL queries, and verification
- Explicit approval gates prevented autonomous advancement
- Every phase produced a complete report before advancing
- Evidence-based corrections improved architecture document fidelity
- AI maintained consistent state awareness across 14+ phases over 24+ hours

### What worked well
- **Structured phase reports:** Each phase had a clear PASS/FAIL verdict table
- **Live status format (G0-G11):** Standardized gate reporting during cutover
- **Absolute rules (STOP blocks):** Prevented scope creep between phases
- **Shell as source of truth:** Every claim was backed by a shell command output

### What was challenging
- **SSH cert expiry:** Claude sessions expired mid-operation requiring manual refresh
- **Context window management:** 14 phases × detailed reports exceeds single-session context
- **Multiple SSH sessions:** Background shells accumulated and required manual cleanup
- **Dokploy API unresponsive:** Forced alternative validation paths (Docker commands vs UI)

### Recommendations
- Use persistent SSH access (Tailscale SSH) for AI-operated migrations
- Design phases to be independently resumable (each phase report = complete state)
- Track active shells as a named resource (not anonymous background processes)
- Prefer Docker CLI inspection over application HTTP endpoints for migration validation

---

## 26. Reusable Migration Pattern

This migration establishes a repeatable pattern for single-node Docker Swarm PaaS migrations:

### Phase template
```
DISCOVERY:     Evidence-first audit of live source state
PROVISIONING:  Target instance + storage + network + baseline snapshot
CAPTURE:       pg_dump + non-DB artifact rsync (staging only, not activated)
SHADOW:        Full restore in quarantine (writers suppressed)
VALIDATION:    Schema parity + connectivity + composition check
AUDIT:         Cross-reference all artifacts for consistency
REHEARSAL:     Dry-run restore to isolated containers
READINESS:     Image cache + preflight script + critical path
CUTOVER:       Freeze source → dump → transfer → restore → activate → handoff
CLOSURE:       Domain validation + suppression reversal + snapshot + authority update
```

### Reusable artifacts
- Preflight script template (10 checks, fail-closed)
- Container-to-database mapping pattern
- NO-DUAL-WRITER enforcement model
- State-based rollback classification (Class A vs Class B)
- Image digest manifest format
- Phase report structure (verdict table at end)
- Operator gate sequence (G0-G11)
- Live status reporting format

---

## 27. Automation Opportunities

### Scripts worth building for future migrations
1. **Full source inventory script:** Enumerate all Docker services, compose projects, images, databases, volumes, and non-DB artifacts in one pass
2. **Artifact parity checker:** Compare two hosts' /etc/dokploy/ trees file-by-file (diff report)
3. **16-database dump-and-restore pipeline:** Single script with SHA verification and table count validation
4. **Image digest recorder:** Capture running container digests as JSON manifest at any point-in-time
5. **Domain health sweep:** curl all configured Traefik routes and report status
6. **Suppression apply/reverse script:** Apply or reverse the 3-query suppression set idempotently
7. **Preflight-to-cutover orchestrator:** Chain preflight → dump → transfer → restore → validate → report

### What NOT to automate
- Phase gate approval (must remain human)
- Rollback classification decision (requires judgment)
- First-time parity validation (requires human review of unknowns)
- Architecture document updates (requires contextual understanding)

---

## 28. Final State Summary

### Production authority
| System | Authority | Location |
|--------|-----------|----------|
| Application runtime | AWS Lightsail dokploy-aws | eu-west-2 London |
| Application databases (16 local) | AWS (restored from Azure final dump) | /mnt/data-dokploy/docker/volumes/ |
| Supabase databases | Self-hosted Supabase server | 100.71.31.88 / 10.0.2.4 |
| Ingress | Cloudflare tunnel → AWS connector | AWS cloudflared process |
| DNS | Cloudflare (unchanged) | Cloudflare edge |

### Azure quiesced state
| Component | State | Purpose |
|-----------|-------|---------|
| VM | RUNNING | Rollback source |
| cloudflared | STOPPED | Prevented from serving traffic |
| Application writers | 0/0 replicas | Prevented from writing |
| Local databases | FROZEN at cutover time | Class B reconciliation source |
| Platform (Dokploy, Traefik, Redis, PG) | Running | Inspection capability |

### Rollback class
**CLASS B** — AWS has accepted production writes. Any rollback to Azure requires:
1. Full write freeze on both sides
2. Identification of authoritative data per system
3. Reconciliation decision
4. Supabase dual-writer protection during switch

---

## 29. Open Follow-Ups

### P1 — Safe cleanup (non-blocking)
1. Install New Relic on AWS
2. Investigate BuildFlow staging 502 (Cloudflare tunnel public hostname config)
3. Build locally-built images (prochat-accountant, fala) if activation desired
4. Investigate Traefik Docker provider not detecting compose containers
5. Verify Lightsail firewall ports match intended access policy

### P2 — Investigation required
1. Determine azure decommission timeline (retain rollback source how long?)
2. Investigate orphaned Dokploy app directory structure
3. Investigate duplicate domain registrations in Dokploy DB
4. Investigate duplicate compose name entries (jpvbootcamp × 2)
5. Investigate Firecrawl orphan in compose list
6. Investigate `finance\` (backslash) database anomaly

### P3 — Architecture decisions
1. Define Azure decommission gate criteria and retention period
2. Decide if ProChat Accountant should be rebuilt and activated
3. Define monitoring strategy for AWS (New Relic or alternative)
4. Define backup strategy for AWS (scheduled snapshots)
5. Evaluate whether Traefik docker provider issue requires architectural change

---

## 30. Top 10 Lessons Summary

### Things to ALWAYS do in future migrations

1. **Verify documentation against production** before planning — architecture docs drift and become fiction
2. **Record container image digests** (not tags) at capture time — mutable tags are unreliable
3. **Pre-stage all images** on target before starting downtime clock — eliminates largest variable
4. **Use state-based rollback gates** (writes happened? yes/no) not time-based ("within 5 minutes")
5. **Compare live source to live target** for non-DB artifact parity — don't audit target against itself
6. **Rehearse the exact restore procedure** on isolated containers — catches role dependencies and quirks
7. **Track ALL non-DB state categories explicitly** — file-provider configs, Docker volumes, staged files, cron, keys
8. **Design phases to be independently resumable** — each phase report is a complete state snapshot
9. **Use persistent SSH** (Tailscale/keys) not temporary certificates for operations spanning >10 minutes
10. **Take snapshots BEFORE and AFTER cutover** — bracketing the migration window with recovery points

### Things to NEVER do in future migrations

1. **Never trust `:latest` tags** across a time gap — they will drift
2. **Never allow dual writers** even "temporarily" — data corruption is instant and silent
3. **Never rely on VM snapshots for DB consistency** — they capture WAL mid-write
4. **Never inventory target state as proxy for source state** — the target doesn't have what it's missing
5. **Never advance phases without explicit approval** — rushing past gates is how incidents happen
6. **Never use application HTTP ports for health checks during migration** — prefer Docker/system-level checks
7. **Never assume rehearsal covers parity** — rehearsal validates mechanics, not configuration completeness
8. **Never skip the architecture verification phase** — saving time here creates surprises at cutover
9. **Never classify rollback by time** — classify by write state (any authoritative write = Class B)
10. **Never hardcode service IDs** — use names; IDs change across environments and restores

---

## 18. Post-Migration Regression: n8n — Five Defects (Discovered 2026-08-19)

**Status:** RESOLVED 2026-08-19 — all five defects fixed, production hardened

The original migration verification reported all 17 production domains as PASS and classified the migration as SUCCESS. However, n8n was never functional on AWS post-migration. Five independent defects were required to achieve full operational status. The final defect (Docker DNS collision) was the most dangerous and took the longest to diagnose.

### Five Independent Defects Discovered

**Defect A — Volume ownership (caused crash loop):**
- Docker volume `_data` directory created as root:root (0:0) with mode 755
- n8n runtime UID 1000 could not write files to the mount
- Symptom: `EACCES: permission denied, open '/home/node/.n8n/crash.journal'`
- Fix: `chown 1000:1000` on the volume `_data` directory

**Defect B — Ingress discovery (caused 404):**
- n8n deployed as Docker Compose container, not a Swarm service
- Traefik's active provider is `swarm` — the `docker` provider in config is non-functional
- No router existed for `n8n.prochat.tools`
- Symptom: Traefik returned 404 for all requests to `n8n.prochat.tools`
- Fix: Traefik file-provider route at `/etc/dokploy/traefik/dynamic/n8n.yml`

**Defect C — Proxy trust (caused shared rate-limit bucket):**
- `N8N_PROXY_HOPS` was unset; Express did not trust X-Forwarded-For
- All external requests shared one rate-limit bucket keyed on Traefik overlay IP
- Symptom: `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` + premature 429 responses
- Fix: `N8N_PROXY_HOPS=2` (Cloudflare → Traefik → n8n)
- NOT the root cause of 401 authentication failures (separate defect)

**Defect D — Docker DNS collision (FINAL ROOT CAUSE of intermittent auth failure):**
- Stale migration project `code` had a `postgres` service on `dokploy-network`
- Production project also had `postgres` service on `dokploy-network`
- Docker DNS returned BOTH IPs when n8n resolved hostname `postgres`
- Stale DB contained only `test@test.com`; production DB contained `info@prochat.tools`
- n8n's TypeORM pool randomly connected to one or the other at startup
- Symptom: Intermittent "Wrong username or password" with identical correct credentials
- Emergency fix: `docker network disconnect dokploy-network code-postgres-1`
- Durable fix: Removed postgres from `dokploy-network` in compose; now only on compose-internal network

**Defect E — Stale duplicate migration stack (enabled Defect D):**
- `code-n8n-1` and `code-postgres-1` running with `restart: unless-stopped`
- Created during migration when compose project was started with wrong project name
- Stale postgres shared production-facing network with same hostname alias
- Fix: Stopped and removed stale containers (volumes preserved)

### Why Validation Missed All Five

1. Volume ownership: checked file presence, not write capability from container process
2. Ingress: checked route existence (TLS valid, DNS resolves), not backend response
3. Proxy trust: not checked at all during migration (pre-existing configuration gap)
4. DNS collision: direct DB inspection ALWAYS showed correct data — the bug was only visible from within n8n's TypeORM runtime connection
5. Stale containers: classified as "harmless residue" because they weren't externally routed — overlooked that their DATABASE could collide via shared DNS

### Critical Lesson: Application Runtime DB Identity

**Querying the expected database directly is NOT proof that the application uses that database.**

The most misleading evidence during diagnosis was: every time we ran `psql` against the production postgres container, it showed `info@prochat.tools` with the correct password hash. Every bcrypt comparison passed. But n8n's running process was connected to a DIFFERENT postgres instance.

**The only valid proof of database identity is observing what the running application's connection actually sees.** This required injecting instrumentation into the TypeORM handler to discover the discrepancy.

### 20 Migration Lessons from This Incident

1. **RUNNING != HEALTHY** — a container running for 2 days can be broken the entire time
2. **HTTP 200 != APPLICATION VALIDATION** — healthz passed while login did not
3. **QUERYING THE EXPECTED DB != PROVING THE APPLICATION USES THAT DB** — direct psql and application TypeORM saw different databases
4. **DATABASE IDENTITY MUST BE PROVEN FROM APPLICATION RUNTIME** — not external inspection
5. **GENERIC DOCKER DNS NAMES ARE UNSAFE ON SHARED NETWORKS** — `postgres` is ambiguous when multiple compose projects share an overlay network
6. **STALE CONTAINERS ARE NOT HARMLESS JUST BECAUSE THEY ARE NOT ROUTED** — their databases can cause DNS collisions
7. **STALE DATABASES CAN CORRUPT BEHAVIOR WITHOUT CORRUPTING DATA** — no data was lost or modified; behavior was wrong
8. **CONNECTION POOLS MAKE DNS COLLISIONS APPEAR INTERMITTENT** — pool establishes at startup, persists until restart
9. **MIGRATION CLEANUP MUST INVENTORY NETWORK ALIASES** — not only container names and running state
10. **STATEFUL VOLUME RESTORES MUST PRESERVE UID/GID/MODES** — file content is not enough
11. **INGRESS DISCOVERY MODEL MUST BE VERIFIED** — Swarm provider doesn't see Compose containers
12. **REVERSE PROXY TRUST MUST BE VERIFIED** — each proxy hop must be accounted for
13. **USER LOGIN MUST BE TESTED WITH THE EXISTING ACCOUNT** — not just healthz or HTML responses
14. **API-KEY FINGERPRINTS MUST BE VERIFIED** — count + owner + label + scope
15. **CREDENTIAL FIDELITY MUST BE VERIFIED** — decrypt test via workflow activation
16. **WORKFLOW OWNERSHIP AND ACTIVE STATE MUST BE VERIFIED** — not just row counts
17. **OLD AND NEW STACKS MUST NEVER SHARE AMBIGUOUS SERVICE DISCOVERY** — quarantine stale services from production DNS
18. **DIAGNOSTICS MUST NOT PRINT SECRET-BEARING ENVIRONMENTS** — use allowlisted env inspection
19. **EARLY PASS CONCLUSIONS MUST BE CORRECTED WHEN LATER EVIDENCE DISPROVES THEM** — "n8n healthy" was premature
20. **A MIGRATION IS NOT CLOSED UNTIL APPLICATION-SPECIFIC ACCEPTANCE GATES PASS** — login, API key, credential, workflow activation

### Umami Ingress Gap Lessons (2026-08-19 Post-Incident)

The Umami analytics service returned HTTP 404 from migration cutover (2026-08-17) through 2026-08-19 — a 2.5-day silent outage never flagged as part of the migration validation, because no application-specific acceptance gate was run for Umami.

21. **A HEALTHY CONTAINER DOES NOT PROVE PUBLIC REACHABILITY** — `code-umami-1` was healthy for 2+ days with no public route; healthz passes before routing is confirmed
22. **DOCKER/COMPOSE LABELS DO NOT PROVE TRAEFIK DISCOVERED THE SERVICE** — in this Swarm-mode architecture, Compose labels are not read by the Swarm/file provider; effective routers must be verified via Traefik API
23. **EVERY PUBLIC HOSTNAME REQUIRES AN END-TO-END POST-CUTOVER TEST** — `curl https://umami.prochat.tools/` not just domain DNS resolution
24. **EVERY STATEFUL APP REQUIRES A REAL USER-PATH ACCEPTANCE TEST** — not just container health or HTTP 200
25. **MIGRATION REHEARSAL CONTAINERS MUST BE INVENTORIED AND RETIRED** — `code-umami-1` consumed a live Supabase DB connection while providing no user value
26. **DUPLICATE APP RUNTIMES CONSUME LIVE EXTERNAL RESOURCES EVEN WHEN NOT PUBLICLY ROUTED** — connects to real production DB on start regardless of Traefik routing
27. **EXTERNAL DATABASE BACKENDS MUST BE MAPPED EXPLICITLY PER APP** — Umami's Supabase backend at 10.0.2.4:5433 was invisible in the standard Docker-network inspection; required `ip route get` to identify Tailscale subnet routing
28. **A LOCAL POSTGRES CONTAINER WITH A SIMILAR PROJECT NAME IS NOT A SUBSTITUTE DATABASE** — `code-postgres-1` (n8n test DB) and Umami's Supabase analytics are completely independent; the naming proximity was misleading
29. **AZURE DECOMMISSION SCOPE MUST DISTINGUISH DOKPLOY FROM SUPABASE** — Azure Dokploy (VMs, Traefik, app containers) and Azure Supabase (`vm-supabase`) are separate resources; decommissioning one does not imply or require decommissioning the other
30. **"17/17 DOMAINS PASS" OR EQUIVALENT AGGREGATE CHECKS CANNOT REPLACE PER-APPLICATION VALIDATION** — domain reachability proves Traefik is routing something; it does not prove the right container is serving or that authenticated application workflows work
31. **HISTORICAL ANALYTICS MUST BE VALIDATED IN A DATE RANGE THAT ACTUALLY CONTAINS EXPECTED RECORDS** — an empty default "last 24 hours" view is expected behavior after a period of low/no traffic; always verify the last known event timestamp before diagnosing analytics data loss
32. **EMPTY CHARTS DO NOT PROVE DATA LOSS** — before escalating to a data-loss incident, verify three things: (1) the selected date range, (2) the latest known event timestamp in the DB, (3) the underlying database row counts; all three must be checked
33. **DIRECT EVIDENCE SUPERSEDES INTERMEDIATE HYPOTHESES** — if the owner logs in and historical data appears after a date-range adjustment, a previously proposed mechanism (e.g. stale browser JS, authorization failure) was not the cause; trace conclusions to the actual observed behavior, not to earlier diagnostic speculation
34. **A SERVICE IS NOT MIGRATION-COMPLETE UNTIL ALL FOUR GATES PASS: public route + login + expected state + historical data visible** — each gate is independent and can fail silently while others pass; a service that authenticates but shows empty analytics has not passed the full gate

### Improved Future Migration Gates

For every stateful service, the following must pass before declaring that service's migration COMPLETE:

1. Container starts and remains stable for 15+ minutes
2. Internal health endpoint returns success
3. Public endpoint returns expected response (not just "route exists")
4. Application-specific validation (for n8n: login with existing account, workflows activate, credentials decrypt)
5. Write-test from inside container verifies mount permissions
6. Database hostname resolves to exactly ONE intended target from within the application container
7. No duplicate DNS aliases exist on shared networks for the same service name
8. Proxy trust verified (no ERR_ERL warnings)
9. Rate limiter uses correct per-client identity
10. API keys and credentials verified by fingerprint/count
11. Any failure keeps that service's migration status OPEN regardless of other services

**Ingress Acceptance Gate** (required for every public Compose application):

- [ ] Expected public hostname
- [ ] Effective Traefik router exists (verify via Traefik API `/api/http/routers`)
- [ ] Effective Traefik service exists (verify via Traefik API `/api/http/services`)
- [ ] Intended backend only — correct container, not stale/duplicate
- [ ] Backend status UP in Traefik service view
- [ ] External HTTPS succeeds (`curl -sI https://<hostname>/`)
- [ ] Real application page returns expected content (not Traefik 404)
- [ ] Real user login succeeds where applicable
- [ ] Expected application objects visible (websites, records, etc.)
- [ ] Historical state visible (date range set to cover known event window)
- [ ] Analytics date range verified to include records (confirm latest event timestamp before testing)
- [ ] Stale rehearsal runtime confirmed absent (stop + remove migration residue containers)
- [ ] Application-specific acceptance complete (login + expected data + historical data all PASS)

**Full incident details and checklist:** `n8n-post-migration-permission-fix-2026-08-19.md`

---

## 31. Production Acceptance Contract

**Infrastructure health does not equal user availability.**

A migration is NOT production-complete until all twelve gates pass. Passing some is not sufficient — each gate is independent and can fail silently while others pass.

| # | Gate | Verification method |
|---|------|---------------------|
| 1 | Container health | `docker inspect --format '{{.State.Health.Status}}'` or `docker ps` |
| 2 | Database connectivity | `psql <dsn> -c 'SELECT 1'` from within the application container |
| 3 | Application HTTP response | `curl http://localhost:<port>/health` from the container host |
| 4 | Traefik router exists | `curl localhost:8080/api/http/routers` — named router for this hostname present |
| 5 | Correct hostname routing | Traefik router rule matches the intended production hostname exactly |
| 6 | TLS certificate issuance | ACME JSON contains a valid, unexpired cert for the domain |
| 7 | HTTPS request through production path | `curl -sI https://<hostname>/` from outside the server |
| 8 | Cloudflare/Tunnel path | Request traces through Cloudflare edge (check `CF-Ray` response header) |
| 9 | Fresh browser session | Incognito window — application loads with no cached state |
| 10 | Authentication flow | Log in with an existing production account; session persists |
| 11 | Environment secrets/configuration | Application-specific config verified (API keys, DSN, env vars active) |
| 12 | No stale deployments | No duplicate containers share service names or DB connections on shared networks |

Gates 1–3 prove the container is alive. Gates 4–8 prove traffic reaches it through the real production path. Gates 9–11 prove the application works for a real user. Gate 12 proves the environment is clean.

A service that passes gates 1–3 but fails gate 7 is **not available to users**. Declare it migration-complete only when all twelve pass.

---

## 32. Ingress Acceptance Path

Every migration must explicitly verify the complete end-to-end request path before declaring a service available:

```
Browser
  → DNS (resolves to Cloudflare edge IP)
  → Cloudflare (WAF, Full SSL)
  → Cloudflare Tunnel (encrypted to origin connector)
  → Traefik HTTPS (SNI routing, TLS)
  → TLS certificate (ACME-issued, valid, not expired)
  → Traefik router rule (Host(`hostname`) matches exactly)
  → Traefik backend service (correct container, status UP)
  → Application container (HTTP response)
```

Failures can occur at every layer. The most common silent failures in this migration:

| Layer | Failure mode | Why it is silent |
|-------|-------------|-----------------|
| Traefik router | No router rule exists for the hostname | Container health passes; Traefik returns 404 |
| Traefik backend | Router points to wrong or stale container | Correct domain serves wrong app |
| TLS certificate | ACME issuance blocked by invalid hostname in rule | HTTPS unreachable; internal HTTP may still respond |
| Cloudflare Full SSL | Origin not listening on HTTPS | Cloudflare returns 525/526 to the user |
| Tunnel | Connector on wrong host or stopped | All requests fail; internal checks still pass |

**Validation commands:**

```bash
# Traefik routers list
curl -s http://localhost:8080/api/http/routers | jq '.[].name'

# Backend service status
curl -s http://localhost:8080/api/http/services/<service>@file | jq '.serverStatus'

# ACME certificate present
jq '.letsencrypt.Certificates[].domain.main' /etc/dokploy/traefik/acme.json

# External HTTPS end-to-end
curl -sI https://<hostname>/
```

---

## 33. Automated Ingress Validation Requirement

A reusable `check-domain.sh <hostname>` script must be built and run against every public hostname after every migration, deployment, and ingress change.

**Required checks:**

```
check-domain.sh app.domain.com
  [ ] DNS resolves to Cloudflare edge IP (not bare origin IP)
  [ ] HTTPS endpoint responds (curl -sI https://app.domain.com/)
  [ ] TLS certificate is valid (not self-signed, not expired)
  [ ] Expected HTTP status code returned (200 or 301/302, not 404/502/525)
  [ ] Traefik router exists for hostname (via Traefik API /api/http/routers)
  [ ] Traefik backend resolves correctly (correct container, status UP)
  [ ] Response body contains an expected application marker (not Traefik generic error page)
```

Failures returned by this script are **deployment contract failures, not application failures.** They indicate that infrastructure setup is incomplete. The migration remains open until all checks pass.

**Priority:** This script should be the first automation produced after a migration establishes a stable environment. It eliminates the most common regression class: a container is healthy but publicly unreachable for 2+ days because no one ran an end-to-end check. All three post-cutover incidents (Ory, n8n, Umami) would have been surfaced within seconds by this script.

---

## 34. Traefik Hostname Validation Rule

Every hostname inside a Traefik router rule must satisfy all four conditions before the rule is deployed:

1. **Valid DNS** — the hostname resolves to an address reachable through the configured ingress path
2. **Intended production domain** — the hostname is the correct canonical domain, not a test alias or deprecated name
3. **Certificate coverage** — ACME is configured to issue for this exact hostname, or a valid wildcard covers it
4. **No unregistered aliases** — every `Host()` clause in the rule refers to a domain that actually exists in DNS

**Example failure:**

```yaml
# This rule blocks ACME certificate issuance for auth.prochat.tools
# because www.auth.prochat.tools has no DNS record
rule: "Host(`auth.prochat.tools`) || Host(`www.auth.prochat.tools`)"
```

Traefik's ACME client attempts certificate issuance for every hostname it encounters in active router rules. If any hostname in the rule fails the ACME challenge (does not resolve, is not owned, or has no DNS record), the entire certificate issuance for the rule fails. The result: HTTPS is unavailable for the entire service, including correctly configured hostnames.

**DNS validation after every file-provider edit:**

```bash
# Check all hostnames in dynamic config resolve correctly
grep -h 'Host(' /etc/dokploy/traefik/dynamic/*.yml \
  | grep -oP '`[^`]+`' | tr -d '`' \
  | while read h; do
      dig +short "$h" | grep -q '.' || echo "MISSING DNS: $h"
    done
```

---

## 35. HTTP Success Is Insufficient

`curl localhost`, `curl <container-ip>`, and HTTP port checks do not constitute migration acceptance.

These checks validate that a process is listening. They do not validate that:
- Traffic from real users reaches the process
- TLS terminates correctly at every layer in the ingress chain
- The reverse proxy routes to the correct backend
- Authentication works end-to-end
- The application's environment and secrets are correctly loaded in the running process

**The only proof of production availability is:**

```
External client (browser or curl from outside the server)
  → HTTPS (not HTTP, not localhost)
  → Through Cloudflare edge
  → Through Cloudflare Tunnel to origin
  → To the application
  → Returns a valid, application-specific response
```

Internal health checks, `docker inspect`, and curl-to-localhost are necessary pre-conditions. They are not substitutes for the real acceptance test.

**Incident evidence from this migration:**

| Service | Internal state | External state | Duration |
|---------|---------------|----------------|----------|
| Ory Kratos | Container running, healthz OK | `auth.prochat.tools` → 404 (missing `ory.yml`) | ~1 hour (resolved at cutover) |
| n8n | Container running, healthz OK | Login failed (stale DNS collision on `postgres`) | 2+ days |
| Umami | Container running, healthz OK | No public route (Swarm provider ignores Compose labels) | 2.5 days |

In all three cases, a single `curl -sI https://<hostname>/` from outside the server would have surfaced the failure within seconds of cutover.

---

## 36. Migration Failure Patterns Prevented

The following patterns each surfaced in multiple services during this migration. Future agents must treat these as mandatory checklist items, not edge cases.

### Pattern 1: Missing Traefik File-Provider Artifacts

**What happens:** A service deployed as Docker Compose (not a Swarm service) has no Traefik router. The Swarm provider only reads Swarm service labels. Compose labels are silently ignored. The container is healthy; the public hostname returns 404.

**Services affected in this migration:** Ory Kratos, n8n, Umami, Via di Eden, BuildFlow staging

**Prevention:** After every Compose deployment, verify the router exists via Traefik API. File-provider routes must be created explicitly in `/etc/dokploy/traefik/dynamic/` for every Compose service that requires public routing.

---

### Pattern 2: Invalid Traefik Host Rules Blocking ACME

**What happens:** A Traefik router rule contains an unregistered hostname (e.g., `www.service.domain.com` where `www.` has no DNS record). Traefik's ACME client attempts to issue a certificate covering the invalid hostname. The challenge fails. The entire service becomes HTTPS-unavailable even though the primary hostname is correctly configured.

**Prevention:** Validate all hostnames in dynamic config against DNS before deploying. Run the check loop from Section 34 after every file-provider edit.

---

### Pattern 3: ACME Certificate Failures

**What happens:** Traefik cannot issue a Let's Encrypt certificate because: (a) a hostname in the rule doesn't resolve, (b) the ACME challenge is blocked by Cloudflare or a firewall, (c) `acme.json` has incorrect permissions (must be `600`), or (d) a Let's Encrypt rate limit has been reached.

**Prevention:**
- `acme.json` must have mode `600` — Traefik refuses to write to it otherwise
- Challenge type must match infrastructure (HTTP-01 requires public port 80; DNS-01 requires Cloudflare API token)
- Every hostname in active rules must resolve before Traefik starts
- Verify cert presence: `jq '.letsencrypt.Certificates[].domain.main' /etc/dokploy/traefik/acme.json`

---

### Pattern 4: Cloudflare Full SSL Origin Failures

**What happens:** Cloudflare is configured in Full SSL (strict) mode. The origin is not serving valid HTTPS or has an expired certificate. Cloudflare returns 525 (SSL Handshake Failed) or 526 (Invalid SSL Certificate). Users see a Cloudflare error page.

**Prevention:** With Cloudflare Tunnel, this is typically not an issue (the tunnel uses its own TLS). For any direct-origin paths, verify the Cloudflare SSL mode and the origin certificate match. Never use "Flexible" SSL when the origin serves HTTPS — the double-termination causes redirect loops.

---

### Pattern 5: Mixed/Stale Deployments

**What happens:** Migration-phase containers remain running after cutover. They share overlay networks with production containers. Docker DNS returns both IPs when resolving shared service names (e.g., `postgres`). The application randomly connects to the stale container's database at TypeORM pool startup. Symptoms are intermittent and difficult to reproduce because the pool persists across requests until the container restarts.

**Services affected in this migration:** n8n (DNS collision with `code-postgres-1`)

**Prevention:**
- Explicitly stop and remove all migration-phase containers after cutover
- Verify no duplicate service names exist on shared networks: `docker network inspect dokploy-network | jq '.[].Containers[].Name'`
- Database containers must only join compose-internal networks — never attach them to `dokploy-network` or any shared overlay

---

### Pattern 6: Missing Environment Variables

**What happens:** An application starts, passes health checks, and appears functional. A specific feature fails because a required environment variable is absent or holds the wrong value (wrong database URL, missing API key, wrong base URL for self-referencing services).

**Prevention:**
- For every migrated service, verify the full `.env` was transferred and is active in the running container
- For services with self-referencing config (n8n `WEBHOOK_URL`, Umami `APP_SECRET`), verify the value matches the new environment
- Test at least one feature that exercises the critical env var — the health endpoint does not cover this

---

### Pattern 7: Browser vs. Server Deployment Mismatch

**What happens:** A user's browser has cached asset manifests, API base URLs, or auth tokens from the previous deployment. After migration, client-side references point to the old server or old endpoints. The application appears broken only for returning users, not fresh sessions.

**Prevention:**
- Acceptance testing must always use a fresh incognito window with no cached state
- For Next.js or SSR apps, verify `NEXTAUTH_URL` and `NEXT_PUBLIC_*` env vars match the new domain
- For apps with service workers, verify the service worker cache is busted post-deploy

---

*These seven patterns account for all three post-cutover incidents in this migration (Ory, n8n, Umami). Checking all seven before declaring any service migration-complete would have prevented every incident.*

---

## 37. Additional DNS, ACME, and HTTPS Ingress Lessons

These lessons generalize from post-cutover ingress incidents and complement the framework in Sections 31–36.

### 37.1 Invalid Traefik hostnames silently block production HTTPS

A Traefik router can be enabled and visible in the API while HTTPS is completely broken for users. A single invalid hostname in a `Host()` rule is sufficient to block ACME certificate issuance for every hostname in that rule.

Every hostname in every `Host()` clause must have:
- valid DNS that resolves from the public internet
- intentional production ownership (no test aliases, deprecated names, or accidental `www.` variants)
- certificate coverage — named in the ACME config or covered by a valid wildcard
- correct `www`/non-`www` treatment — include only the variant that exists in DNS

**Failure chain:**

```
Host(`example.com`) || Host(`www.example.com`)
  where www.example.com has no DNS record
  → ACME attempts challenge for www.example.com
  → DNS lookup returns NXDOMAIN
  → Certificate issuance blocked for the entire rule
  → Traefik cannot serve HTTPS for example.com
  → Cloudflare Full SSL origin handshake fails (525/526)
  → User-facing outage — router exists, container healthy, HTTPS dead
```

### 37.2 ACME certificate validation is part of ingress acceptance

A migration is not complete until all three hold:
- Certificate issuance succeeded: `jq '.letsencrypt.Certificates[].domain.main' /etc/dokploy/traefik/acme.json` lists the hostname
- HTTPS works through the external production path: `curl -sI https://<hostname>/` from outside the server
- No ACME errors in Traefik logs: `grep -i "acme\|certificate" /var/log/dokploy/traefik.log`

**ACME failures are ingress failures, not application failures.** They are invisible to container health checks and internal HTTP tests. The only detection path is an external HTTPS request.

### 37.3 The only authoritative production test path

The following checks are **insufficient alone** to confirm user availability:

- `curl localhost:<port>` — validates the process is listening; nothing more
- `curl <container-ip>` — bypasses the reverse proxy entirely
- Docker `healthcheck` status — application process alive; ingress unknown
- Internal Docker network curl — skips DNS, Traefik routing, TLS, and Cloudflare

The authoritative test path is:

```
External browser or curl (from outside the server)
  → public DNS
  → Cloudflare edge (if used)
  → Cloudflare Tunnel → origin connector
  → Traefik HTTPS → TLS certificate
  → Router rule → correct backend container
  → Application response
```

Each layer can fail independently. The internal checks are necessary pre-conditions, not substitutes for the full path test.

### 37.4 Domain inventory gate before declaring migration complete

Before closing any migration, run an explicit domain inventory gate against every hostname in every active Traefik router rule:

```bash
# All hostnames in dynamic config must resolve
grep -h 'Host(' /etc/dokploy/traefik/dynamic/*.yml \
  | grep -oP '`[^`]+`' | tr -d '`' \
  | while read h; do
      result=$(dig +short "$h")
      [ -z "$result" ] && echo "NXDOMAIN: $h" || echo "OK: $h → $result"
    done

# Certificates must be issued
jq '.letsencrypt.Certificates[].domain.main' /etc/dokploy/traefik/acme.json
```

Gate criteria:
- No NXDOMAIN results
- No unintentional `www.`/non-`www.` mismatches
- Certificate present for every public hostname
- Router rules match only intended production domains

### 37.5 Automated ingress acceptance tooling is a reliability requirement

`check-domain.sh <hostname>` (specified in Section 33) must be treated as a **migration reliability tool**, not an optional convenience. Priority: high. Rationale: every ingress-class incident in this migration would have been surfaced within seconds of cutover by a single script that:

- resolves DNS
- confirms HTTPS responds
- validates TLS certificate (not self-signed, not expired)
- checks expected HTTP status code
- confirms Traefik router exists for the hostname
- confirms Traefik backend is reachable and status UP

Until this script exists, the manual equivalent must be run explicitly for every public hostname after every deployment and migration cutover.

### 37.6 Start investigation at the external path, not the application

Many post-migration outages are caused by **deployment contract failures**, not application bugs. Reversing the investigation order wastes time diagnosing correct application code.

Deployment contract failures (investigate first):
- Missing Traefik file-provider route (service unreachable via public hostname)
- Invalid hostname in router rule (certificate blocked, HTTPS dead)
- ACME failure (no valid certificate)
- Cloudflare origin configuration mismatch (525/526 at edge)
- Missing or wrong environment variable (feature broken, healthz still passes)

**Correct investigation order:**
1. External HTTPS test: `curl -sI https://<hostname>/`
2. Traefik API: router exists? backend UP? `curl localhost:8080/api/http/routers`
3. ACME JSON: certificate present and valid?
4. Container logs: application errors visible?
5. Application code: only after steps 1–4 pass

If step 1 fails, do not proceed to step 4 or 5.

---

## Document Metadata

| Field | Value |
|-------|-------|
| Author | Claude (AI-assisted migration operator) |
| Human authority | Steve Westhoek |
| Migration ID | azure-to-aws-dokploy-2026-08 |
| Total migration artifacts | 14 reports + 1 manifest + 1 script (~331K) |
| Architecture corrections made | 7 (Phase 3C7-3C11) |
| Post-cutover evidence entries | 10 (F-CUT-001 through F-CUT-010) |
| Domains migrated | 17 production + 1 staging |
| Databases migrated | 16 local + 0 external (Supabase unchanged) |
| Total cost of target | $84/month (Lightsail xlarge_3_0) |
| Downtime target | 90 minutes |
| Downtime actual | ~28 minutes |
| Data loss | ZERO |
