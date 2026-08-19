# n8n Post-Migration Recovery — 2026-08-19

## Summary

n8n has been completely non-functional on AWS since the Azure → AWS Dokploy migration (2026-08-16/17). Two independent defects prevented operation:

1. **Defect A — Persistent data ownership:** Volume directory owned by root prevented n8n (UID 1000) from writing files. Symptom: `EACCES: permission denied, open '/home/node/.n8n/crash.journal'` crash loop.
2. **Defect B — Ingress discovery:** n8n is a Docker Compose container; Traefik uses Swarm provider for service discovery. No public route existed. Symptom: `https://n8n.prochat.tools/` returned Traefik 404.

Both defects are now resolved. n8n is fully operational end-to-end.

## Root Cause

**Classification: A — Wrong owner UID/GID on the volume's `_data` directory.**

The Docker named volume `apps-internal-n8n-cvjx2s_n8n_data` was restored during migration with the correct file contents (owned by UID 1000:1000), but the volume's `_data` parent directory itself was created by Docker with root:root (0:0) ownership and mode 755.

n8n runs as UID 1000 (user `node`) inside the container. With the `_data` directory owned by root and mode 755, UID 1000 could read existing files but could not create new files (like `crash.journal`) in the directory.

## Why Migration Validation Missed It

The migration phase 3B restore transferred file contents correctly (config, binaryData are owned by 1000:1000). The volume directory itself was created fresh by Docker on AWS (`docker volume create` or compose-up), which defaults to root ownership. The migration validation checked database health and file presence but did not verify that the container process could actually write to the volume mount point.

## Evidence

### Before Fix (AWS)

```
/mnt/data-dokploy/docker/volumes/apps-internal-n8n-cvjx2s_n8n_data/_data
  Owner: 0:0 (root:root)
  Mode: 755 (drwxr-xr-x)
  Contents: 1000:1000 (correct)
```

### After Fix (AWS)

```
/mnt/data-dokploy/docker/volumes/apps-internal-n8n-cvjx2s_n8n_data/_data
  Owner: 1000:1000 (node:node)
  Mode: 755 (drwxr-xr-x)
  Contents: 1000:1000 (unchanged)
```

## Fix Applied

Single command:

```bash
chown 1000:1000 /mnt/data-dokploy/docker/volumes/apps-internal-n8n-cvjx2s_n8n_data/_data
```

No file contents, modes, or data were modified.

## Pre-Fix Backups

| Backup | Path | SHA-256 |
|--------|------|---------|
| PostgreSQL dump (PG17, custom format) | `/tmp/n8n_prefix_backup_20260819.dump` | `1ca93700b8206fc81f477c2bb83bbcf41223d04588086a4dc8c4d92cbd98f259` |
| Filesystem archive (tar.gz, numeric owner preserved) | `/tmp/n8n_filesystem_prefix_backup_20260819.tar.gz` | `d6485cc7ec4d93bba27a7807bb494af1cdadda11d7f5ac784a8293252c1d3109` |

## Post-Fix Validation

| Check | Result |
|-------|--------|
| EACCES eliminated | YES |
| crash.journal created | YES |
| Container running (5+ min, 0 restarts) | YES |
| n8n healthz | `{"status":"ok"}` |
| PostgreSQL 17 healthy | YES |
| Workflows: 43 total | PASS |
| Active workflows: 6 activated | PASS |
| Credentials: 17 present | PASS |
| Execution history present | YES (1 record) |
| Encryption key functional | YES (workflows activated, credentials decrypt) |
| Azure n8n remained stopped | YES (host unreachable/deallocated) |
| Dual execution | NO |

## Active Workflows Confirmed

1. StatusLink - Callback to Broker Push
2. calendar-read-stable
3. calendar-manage-fixed
4. STB - Facebook Autopublish
5. Save to Mind — Capture for Mind Steward
6. Video Orchestrator — Post Dispatcher

## Defect B — Ingress Discovery

### Root Cause

Traefik on this host uses `providers.swarm` for automatic service discovery. All working production services are deployed as Docker Swarm services. n8n is deployed by Dokploy as a Docker Compose container (standalone, not Swarm). Although the Traefik config includes a `providers.docker` section, it is not active in practice — only `swarm`, `file`, and `internal` providers serve routers.

The n8n container has Traefik routing labels, but since the Docker provider doesn't function, those labels are never read. The result: n8n is healthy internally but has no public router.

This defect was never previously surfaced because Defect A prevented n8n from starting at all.

### Fix Applied

Created a Traefik file-provider dynamic route at `/etc/dokploy/traefik/dynamic/n8n.yml`:

```yaml
http:
  routers:
    n8n-web:
      rule: Host(`n8n.prochat.tools`)
      service: n8n-service
      entryPoints:
        - web
    n8n-websecure:
      rule: Host(`n8n.prochat.tools`)
      service: n8n-service
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt

  services:
    n8n-service:
      loadBalancer:
        servers:
          - url: http://apps-internal-n8n-cvjx2s-n8n-1:5678
        passHostHeader: true
```

The target `apps-internal-n8n-cvjx2s-n8n-1` is the stable Docker DNS name on `dokploy-network` (derived from compose project + service + replica). Verified resolvable and reachable from the Traefik container. No ephemeral IP used. No Traefik restart required (file provider auto-watches).

### Pre-Route Backup

| Backup | Path | SHA-256 |
|--------|------|---------|
| Traefik dynamic config archive | `/tmp/traefik-dynamic-backup-20260819.tar.gz` | `e267c5dbf83d5e9949729631c034c059161753d967dd24e52133ab374e8e39fc` |

### Route Architecture

```
Client → Cloudflare (TLS termination)
  → Cloudflare Tunnel (cloudflared systemd service)
  → http://localhost:80 (Traefik web entrypoint)
  → file-provider router: Host(`n8n.prochat.tools`)
  → http://apps-internal-n8n-cvjx2s-n8n-1:5678 (Docker DNS on dokploy-network)
  → n8n container
```

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
| PostgreSQL | `postgres:17-alpine` (container `apps-internal-n8n-cvjx2s-postgres-1`) |
| DB name | n8n |
| Webhook URL | https://n8n.prochat.tools/ |

## Final End-to-End Validation (Post Both Fixes)

| Check | Result |
|-------|--------|
| EACCES eliminated | YES |
| crash.journal created | YES |
| Container running (10+ min, 0 restarts) | YES |
| n8n internal healthz | `{"status":"ok"}` |
| PostgreSQL 17 healthy | YES, accepting connections |
| Workflows: 43 total | PASS |
| Active workflows: 6 activated | PASS |
| Credentials: 17 present | PASS |
| Credentials decrypt | PASS (proven by workflow activation) |
| Execution history present | YES (1 record) |
| Encryption key functional | YES |
| Public endpoint `https://n8n.prochat.tools/healthz` | 200 OK |
| TLS valid | YES (ssl_verify_result: 0) |
| Editor/signin page | 200 OK |
| Static assets | 200 OK |
| Webhook base URL config | `https://n8n.prochat.tools/` (correct) |
| Traefik n8n-web@file router | enabled |
| Traefik n8n-websecure@file router | enabled |
| Traefik n8n-service@file | enabled, UP |
| Representative routes (prochat.tools, saysthe.bible, yeshua.academy) | 200 OK |
| Unrelated router regression | NO (23 routers, all enabled) |
| Azure n8n remained stopped | YES (host unreachable/deallocated) |
| Dual execution | NO |
| Cloudflare/DNS changes | 0 |
| Database mutations | 0 |

## Outage Duration

- **Migration completion:** 2026-08-17
- **Fix applied:** 2026-08-19 17:10 UTC
- **Total outage:** ~2.5 days (n8n never functioned on AWS post-migration)

## Lessons for Future Migrations

### A. Volume Ownership

When migrating Docker named volumes, verify that the volume `_data` directory ownership matches the container's runtime UID. Docker creates volume directories as root by default — file contents restored into them may have correct ownership while the parent directory does not, causing write failures for non-root container processes.

### B. Container State != Application Health

A container existing and attempting to start is not proof of health. Migration validation must verify that the container process can successfully complete its startup sequence and reach a stable ready state.

### C. Internal Health != Public Health

Every production service must be validated through its actual public ingress path, not just internal port checks. A service can be perfectly healthy internally while having no public route.

### D. Router/Discovery Model Must Be Inventoried

When the infrastructure routing model (Swarm services + Swarm provider) differs from the application deployment model (Docker Compose containers), explicit routing treatment is required. The Traefik file-provider pattern used here is the correct approach for Compose workloads.

### E. Stability Window Required

Stateful services require observation over time (5–10 minutes minimum), not a single-point `docker ps` check. Restart loops may not be evident from a single status query.

### F. Application-Specific Validation

For n8n specifically: verify workflow database present, credentials decrypt, active workflows initialize, public editor route works, webhook ingress exists.

## Stateful Service Migration Validation Checklist

For each stateful service migrated:

- [ ] Exact image/version recorded
- [ ] Runtime UID:GID identified and recorded
- [ ] Persistent mount source recorded
- [ ] Volume `_data` directory owner UID:GID matches runtime UID:GID
- [ ] File/directory modes preserved
- [ ] Database restored and queryable
- [ ] Secrets/encryption identity preserved (hash comparison)
- [ ] Container starts without permission errors
- [ ] Stable >= 5–10 minutes, restart count stable
- [ ] Internal health endpoint passes
- [ ] Public/external health passes through actual ingress
- [ ] Router exists in Traefik (verify provider: swarm vs file vs docker)
- [ ] Expected ingress path validated end-to-end
- [ ] Credentials/config decrypt correctly
- [ ] Active workloads initialize (for n8n: workflows activate)
- [ ] No duplicate old/new execution possible
- [ ] Write-test from inside container: `docker exec <c> touch /mount/test && rm /mount/test`
- [ ] Application-specific side-effect-safe check completed
- [ ] Any failure keeps that service's migration status OPEN
