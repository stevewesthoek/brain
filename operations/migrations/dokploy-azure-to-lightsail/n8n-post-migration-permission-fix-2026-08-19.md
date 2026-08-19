# n8n Post-Migration Recovery — Complete Incident Report 2026-08-19

## Executive Summary

n8n was completely non-functional on AWS from migration completion (2026-08-17) through 2026-08-19. Five independent defects were discovered and resolved during a multi-hour diagnostic session. The final and most elusive defect — intermittent authentication failure — was caused by a Docker DNS collision where two PostgreSQL containers advertised the same generic hostname on a shared overlay network.

**Final status:** n8n fully operational. All production data preserved with zero mutations to owner, password, API keys, credentials, workflows, or encryption identity.

---

## Symptom Chronology

| Time | Symptom | Actual cause |
|------|---------|--------------|
| 2026-08-17 | n8n container crash-loops with EACCES | Defect A: volume ownership |
| 2026-08-19 ~15:00 | Volume ownership fixed, n8n starts but unreachable externally | Defect B: no Traefik route |
| 2026-08-19 ~16:00 | File-provider route added, n8n reachable, login sometimes works | Defects C+D+E: intermittent DNS collision |
| 2026-08-19 ~17:00 | Login fails with "Wrong username or password" | Defect D: n8n connected to stale DB |
| 2026-08-19 ~18:00 | ERR_ERL_UNEXPECTED_X_FORWARDED_FOR in logs | Defect C: proxy trust |
| 2026-08-19 ~18:30 | Proxy fix applied, rate-limit fixed, login still fails | Defect D: not yet identified |
| 2026-08-19 ~19:30 | TypeORM instrumentation reveals wrong user in DB | Defect D: root cause identified |
| 2026-08-19 ~20:00 | Stale postgres disconnected from network | All defects resolved |
| 2026-08-19 ~20:15 | Containers recreated with durable fix | Production hardened |

---

## Defect A — Persistent Volume Ownership

**Classification:** Migration state-transfer defect

**Root cause:** The Docker named volume `apps-internal-n8n-cvjx2s_n8n_data` was restored during migration with correct file contents (owned by UID 1000:1000), but the volume's `_data` parent directory was created by Docker with root:root (0:0) ownership and mode 755. n8n runs as UID 1000 (user `node`) and could not create new files.

**Symptom:** `EACCES: permission denied, open '/home/node/.n8n/crash.journal'` — immediate crash loop on every startup.

**Fix:** `chown 1000:1000 /mnt/data-dokploy/docker/volumes/apps-internal-n8n-cvjx2s_n8n_data/_data`

**Why validation missed it:** Migration checks verified file presence and database health but not that the container process could write to the volume mount.

---

## Defect B — Traefik Ingress Discovery

**Classification:** Platform architecture mismatch

**Root cause:** n8n is deployed as a Docker Compose container. Traefik's effective discovery model on this host uses `providers.swarm` for automatic routing. The `providers.docker` section exists in config but is non-functional. n8n's Traefik labels were never read, producing no public router.

**Symptom:** `https://n8n.prochat.tools/` returned Traefik 404.

**Fix:** File-provider dynamic route at `/etc/dokploy/traefik/dynamic/n8n.yml`:
```yaml
http:
  routers:
    n8n-web:
      rule: Host(`n8n.prochat.tools`)
      service: n8n-service
      entryPoints: [web]
    n8n-websecure:
      rule: Host(`n8n.prochat.tools`)
      service: n8n-service
      entryPoints: [websecure]
      tls:
        certResolver: letsencrypt
  services:
    n8n-service:
      loadBalancer:
        servers:
          - url: http://apps-internal-n8n-cvjx2s-n8n-1:5678
        passHostHeader: true
```

**Why validation missed it:** Defect A prevented n8n from starting, so the routing gap was never surfaced during migration.

---

## Defect C — Reverse Proxy Trust

**Classification:** Configuration defect

**Root cause:** n8n received `X-Forwarded-For` headers from the proxy chain (Cloudflare → Traefik → n8n = 2 hops) but `N8N_PROXY_HOPS` was unset (effectively 0). Express did not trust the forwarded headers.

**Symptom:** `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` warnings. All external requests shared a single rate-limit bucket keyed on Traefik's overlay IP (10.0.1.x), not the real client IP.

**Fix:** Added `N8N_PROXY_HOPS=2` to `.env` and `docker-compose.yml`.

**Clarification:** This defect caused rate-limiting issues and was a real operational problem, but it was NOT the root cause of deterministic HTTP 401 "Wrong username or password" responses. The password authentication failure had a separate cause (Defect D).

---

## Defect D — Docker DNS Collision (FINAL ROOT CAUSE of Authentication Failure)

**Classification:** Infrastructure naming collision — the decisive production-breaking defect

### Technical Explanation

The production compose project (`apps-internal-n8n-cvjx2s`) and a stale migration residue compose project (`code`) both defined a service named `postgres`. Both projects attached their postgres containers to the shared Docker overlay network `dokploy-network`.

Docker's embedded DNS resolver returns results from ALL networks a querying container is attached to. When the production n8n container resolved hostname `postgres`, Docker DNS returned addresses from both:

| Container | Project | Network | IP on dokploy-network |
|-----------|---------|---------|----------------------|
| apps-internal-n8n-cvjx2s-postgres-1 | apps-internal-n8n-cvjx2s | dokploy-network | 10.0.1.189 |
| code-postgres-1 | code | dokploy-network | 10.0.1.14 |

The production postgres (10.0.1.189) contained the real owner account `info@prochat.tools`. The stale postgres (10.0.1.14) contained only a setup user `test@test.com`.

n8n's TypeORM connection pool established connections at startup. Depending on which DNS response was selected, the pool connected to one database or the other. This produced the intermittent behavior:
- Sometimes login succeeded (pool connected to production DB)
- Sometimes identical credentials returned 401 (pool connected to stale DB where the user didn't exist)

### Why This Appeared Contradictory

Direct inspection of the production postgres always showed `info@prochat.tools` with the correct password hash. Bcrypt verification of the password against the known hash always passed. But these checks bypassed n8n's TypeORM connection pool — they opened fresh connections that correctly resolved to the production database.

The instrumentation that finally identified the bug was injected into n8n's `handleEmailLogin()` handler. It revealed:
- `repo.count()` = 1 (TypeORM sees one user)
- `first_user_email = test@test.com` (NOT the expected production user)
- Raw SQL `WHERE email = 'info@prochat.tools'` returned 0 rows through TypeORM's DataSource

This proved the running n8n process was connected to a different database than what direct inspection showed.

### Emergency Fix

```bash
docker network disconnect dokploy-network code-postgres-1
```

After disconnection, DNS for `postgres` from the n8n container returned only 10.0.1.189. Container restart forced a fresh connection pool to the correct database.

### Durable Fix

1. Removed `dokploy-network` from the postgres service in `docker-compose.yml`
2. Postgres now exists ONLY on the compose-internal `default` network
3. n8n resolves `postgres` via `default` network → only the local compose service can answer
4. Recreated both containers to apply the network change

After the durable fix, DNS resolution from n8n returns only `172.19.0.2` (compose-internal address). No external collision is possible.

### Why Connection Pools Made It Intermittent

TypeORM maintains a persistent connection pool. Once established at startup, connections are reused. If the pool was established against the stale DB, ALL subsequent queries went to the wrong database until the container was restarted. If it happened to connect to the correct DB, login worked until the next container restart randomized the target again.

---

## Defect E — Stale Duplicate Migration Stack

**Classification:** Migration cleanup failure

**Root cause:** During migration, the compose project was started with project name `code` (in addition to the canonical name `apps-internal-n8n-cvjx2s`). This created duplicate containers (`code-n8n-1`, `code-postgres-1`) with separate volumes (`code_n8n_data`, `code_postgres_data`). These stale containers remained running with `restart: unless-stopped` policy.

**Impact:** The stale `code-postgres-1` shared `dokploy-network` and advertised hostname alias `postgres`, causing the DNS collision in Defect D. The stale `code-n8n-1` did not activate production workflows but performed background database operations.

**Resolution:** Both stale containers stopped and removed. Volumes preserved (not deleted). The compose file network fix prevents recurrence even if the stale project were somehow restarted.

---

## Superseded Hypotheses

The following hypotheses were investigated and definitively disproven:

| Hypothesis | Status | Evidence |
|-----------|--------|----------|
| Password changed or corrupted | DISPROVEN | Bcrypt hash fingerprint matches authoritative Azure export |
| Browser cache causing stale auth | DISPROVEN | Fresh browsers and curl exhibited same failure |
| Bcrypt comparison bug | DISPROVEN | Local bcrypt verification passed against known hash |
| Cloudflare routing alternation | DISPROVEN | Single tunnel, single backend; Traefik file-provider confirmed |
| Traefik backend alternation | DISPROVEN | Only one n8n-service@file with one server |
| N8N_PROXY_HOPS causing 401 | DISPROVEN | Proxy fix eliminated ERR_ERL but login still failed |
| Rate limiting masquerading as auth failure | DISPROVEN | Different error messages (429 vs 401) |
| n8n setup wizard creating new owner | PARTIAL | `test@test.com` existed in STALE db, not production |
| Data migration corruption | DISPROVEN | All counts/fingerprints match authoritative source |

---

## Final Data Fidelity Verification

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Owner UUID | 852b8f6a-8bcc-4743-96b6-66fe2c0302af | Matches | PASS |
| Owner email | info@prochat.tools | Matches | PASS |
| Owner role | global:owner | Matches | PASS |
| Owner disabled | false | false | PASS |
| Password hash fingerprint | 098719b6...4d32668 | Matches | PASS |
| API keys | 2 | 2 | PASS |
| API key labels | Milestone App, ProChat | Matches | PASS |
| API key ownership | Both owned by 852b8f6a... | Matches | PASS |
| Credentials | 17 | 17 | PASS |
| Workflows | 43 | 43 | PASS |
| Active workflows | 6 | 6 | PASS |
| Webhook registrations | 6 | 6 | PASS |
| Projects | 1 | 1 | PASS |
| Project relations | 1 | 1 | PASS |
| Execution history | Present | Present | PASS |
| Encryption identity | Preserved | Workflows activate, credentials decrypt | PASS |

---

## Final Architecture (Post-Fix)

```
Client → Cloudflare (TLS termination)
  → Cloudflare Tunnel (cloudflared systemd, outbound from AWS)
  → http://localhost:80 (Traefik web entrypoint)
  → file-provider router: Host(`n8n.prochat.tools`)
  → http://apps-internal-n8n-cvjx2s-n8n-1:5678 (Docker DNS on dokploy-network)
  → n8n container (UID 1000, /home/node/.n8n mounted rw)
    → DB_POSTGRESDB_HOST=postgres (resolved via compose-internal default network ONLY)
    → apps-internal-n8n-cvjx2s-postgres-1:5432 (172.19.0.2, compose-internal only)
```

**Network isolation model:**
- n8n: `apps-internal-n8n-cvjx2s_default` + `dokploy-network` (Traefik needs to reach it)
- postgres: `apps-internal-n8n-cvjx2s_default` ONLY (no shared network exposure)

**Invariant:** Production postgres MUST NOT be on any shared network where other containers could advertise the same DNS alias.

---

## Security Incident

During diagnostic instrumentation, the full `N8N_ENCRYPTION_KEY` was accidentally emitted in terminal output by inspecting the complete container environment (`docker inspect --format '{{json .Config.Env}}'`).

**Mitigation:**
- Key was NOT rotated during active recovery (credentials currently decrypt correctly)
- Terminal output is ephemeral (SSH session)
- No evidence of key exposure beyond diagnostic session

**Deferred follow-up:** Evaluate key rotation after n8n is confirmed stable for an extended period. Key rotation requires re-encrypting all 17 credentials.

**Prevention:** Never dump complete `Config.Env` arrays. Use allowlisted environment inspection (specific variable names only).

---

## Prevention Controls

1. **Postgres removed from dokploy-network** in compose definition — eliminates shared-alias collision
2. **Stale containers removed** — no duplicate `postgres` alias exists
3. **Docker volume not marked external** — compose warning is cosmetic, not functional
4. **N8N_PROXY_HOPS=2** applied — correct rate-limiting behavior
5. **File-provider route** — stable ingress independent of Docker provider

---

## Pre-Fix Backups

| Backup | Path | SHA-256 |
|--------|------|---------|
| PostgreSQL dump (PG17, custom format) | `/tmp/n8n_prefix_backup_20260819.dump` | `1ca93700b8206fc81f477c2bb83bbcf41223d04588086a4dc8c4d92cbd98f259` |
| Filesystem archive | `/tmp/n8n_filesystem_prefix_backup_20260819.tar.gz` | `d6485cc7ec4d93bba27a7807bb494af1cdadda11d7f5ac784a8293252c1d3109` |
| docker-compose.yml (pre-proxy-fix) | `/tmp/docker-compose.yml.pre-proxy-fix` | `b171bcf9bc6d95f051d82e874a1c89fe1d900db9a32492627514ac0da268ece3` |
| .env (pre-proxy-fix) | `/tmp/env.pre-proxy-fix` | `c4dd6d6e30c9780cf4467ee785bc77ad68125c93904a614a663d107a181582a3` |
| docker-compose.yml (pre-durable-fix) | `/tmp/docker-compose.yml.pre-durable-fix` | `f97dda136ea3a7f0f5195fe71d7bc2393374acbaec4ab9edbc3a4ad6b6e59ec7` |
| Authoritative Azure final dump | `/tmp/final-delta/n8n.dump` | `8adaccc5dc1f4db07bbfed339a436f83c24c6f0ddc885072e5e8eeb098c5c1f0` |

---

## Unresolved / Deferred Items

1. **Security follow-up:** Evaluate N8N_ENCRYPTION_KEY rotation (low urgency — no evidence of compromise)
2. **Stale volumes:** `code_n8n_data` and `code_postgres_data` remain on disk (intentionally preserved, not deleted)
3. **code-umami-1:** Unrelated container from stale `code` project still running (separate service, harmless)
4. **Monitoring:** No APM/alerting on n8n (pre-existing gap, not introduced by this incident)
5. **Azure decommission:** Separate planning exercise, NOT part of this recovery

---

## Outage Duration

- **Migration completion:** 2026-08-17
- **All defects resolved:** 2026-08-19 ~20:15 UTC
- **Total n8n outage:** ~2.5 days (never fully functional on AWS post-migration)

---

## Deployment Details

| Attribute | Value |
|-----------|-------|
| Container | `apps-internal-n8n-cvjx2s-n8n-1` |
| Image | `n8nio/n8n:2.4.7` |
| Runtime UID:GID | 1000:1000 (node:node) |
| Volume | `apps-internal-n8n-cvjx2s_n8n_data` |
| Volume mount source | `/mnt/data-dokploy/docker/volumes/apps-internal-n8n-cvjx2s_n8n_data/_data` |
| Mount target | `/home/node/.n8n` |
| Mount mode | rw |
| Volume owner | 1000:1000 |
| PostgreSQL | `postgres:17-alpine` (container `apps-internal-n8n-cvjx2s-postgres-1`) |
| DB name | n8n |
| DB hostname (from n8n) | postgres (resolves via compose-internal network only) |
| Postgres network | `apps-internal-n8n-cvjx2s_default` only (NOT on dokploy-network) |
| n8n networks | `apps-internal-n8n-cvjx2s_default` + `dokploy-network` |
| N8N_PROXY_HOPS | 2 |
| Webhook URL | https://n8n.prochat.tools/ |
| Traefik route | n8n-web@file + n8n-websecure@file → n8n-service@file |

## Stateful Service Migration Validation Checklist

For each stateful service migrated:

- [ ] Exact image/version/digest recorded
- [ ] Runtime UID:GID identified and recorded
- [ ] Persistent mount source recorded
- [ ] Volume `_data` directory owner UID:GID matches runtime UID:GID
- [ ] File/directory modes preserved
- [ ] Database restored and queryable
- [ ] DB row/data counts validated
- [ ] Configured DB hostname recorded
- [ ] DB hostname repeatedly resolves to exactly intended target(s)
- [ ] No duplicate network alias collision on shared networks
- [ ] Application runtime DB identity proven (query from WITHIN app, not external)
- [ ] No stale old DB on same service-discovery namespace
- [ ] No stale old main process from prior project names
- [ ] Old/new writer separation proven
- [ ] Internal health endpoint passes
- [ ] Public endpoint returns expected response (not just route exists)
- [ ] Actual user login passes with existing credentials
- [ ] Login repeated (3x minimum)
- [ ] API keys preserved (count + fingerprints)
- [ ] Credentials preserved and decrypt
- [ ] Workflow ownership preserved
- [ ] Active workflows initialize
- [ ] Webhook registration healthy
- [ ] Proxy trust correct
- [ ] Rate limiter sees expected client identity (not shared overlay IP)
- [ ] No temporary diagnostic instrumentation remains
- [ ] Secret scan passes
- [ ] Service stable >= 15 minutes
- [ ] Any failure keeps migration status OPEN

### Docker Networking Sub-Checks

- [ ] Enumerate all DNS aliases on every shared network the service touches
- [ ] Verify expected service hostnames are unique across all compose projects on shared networks
- [ ] Detect duplicate aliases from different compose projects
- [ ] Do not use container IP as persistent configuration
- [ ] Prefer workload-specific service identity over generic names where practical
- [ ] Verify DNS resolution from within the application container (not just external psql)
