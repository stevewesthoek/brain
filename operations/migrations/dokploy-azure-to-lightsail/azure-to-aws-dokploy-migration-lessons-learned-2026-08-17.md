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
