# Dokploy Upgrade Report — v0.29.5 to v0.30.5

**Date:** 2026-09-03 (Europe/Lisbon)
**Host:** AWS Lightsail `dokploy-aws`
**Scope:** Dokploy control-plane service only
**Result:** COMPLETE

## Change

Dokploy was updated from:

```text
dokploy/dokploy:latest@sha256:72c082d05447f05c2452e1b29c5c664102290ea605e15a0f0dab2731be1ba7df
```

to the exact requested release:

```text
dokploy/dokploy:v0.30.5@sha256:beaab9d816750ea9524e47d6d1a9ba466d6c3442f9943fee8ac81a6d72f73103
```

The update targeted only the `dokploy` Docker Swarm service. The command used one-task parallelism, `start-first` ordering, a 30-second monitor, and automatic rollback on update failure. Port 3000 publication, the Docker socket mount, network attachment, and the single-replica mode were preserved.

Traefik, PostgreSQL, Redis, tenant databases, and application services were not updated, restarted, or reconfigured.

## Pre-update protection

- Lightsail snapshot: `dokploy-aws-pre-dokploy-v0-30-5-20260903`
- Snapshot state after creation: `available`
- PostgreSQL backup: `/var/lib/dokploy-upgrade-backups/dokploy-postgres-pre-v0.30.5-20260903.dump`
- PostgreSQL backup mode: `0600`
- PostgreSQL backup size: 251,418 bytes
- PostgreSQL backup SHA-256: `0e44966a7c50541701a93d771bed6f6373207795eaa2704c69bc087cfc3ea33d`
- Backup validation: `pg_restore --list` passed
- PostgreSQL preflight: `pg_isready` passed; schema-only `pg_dump` passed

## Acceptance

- Dokploy Swarm service: `1/1`
- Dokploy update status: `completed`
- Current Dokploy task: healthy, zero restarts
- Dokploy HTTPS: HTTP 200
- Dokploy `/api/health`: `{"ok":true}`
- JPV production HTTPS: HTTP 200
- JPV production `/api/health`: `ok=true`
- JPV preview HTTPS: HTTP 200
- JPV preview `/api/health`: `ok=true`
- Representative production endpoints: HTTP 200
- PostgreSQL: accepting connections, version 16.13
- Redis: `PONG`
- Docker: active; Swarm active; one manager node
- Image cleanup: no image deletion, `docker system prune`, or `docker system prune -a` was run; the previous v0.29.5 image remains retained locally for rollback
- Services not at `1/1`: zero
- Unhealthy running containers: zero
- Traefik task start time: unchanged from pre-update observation
- Dokploy PostgreSQL and Redis task start times: unchanged from pre-update observation
- Root filesystem after update: 269 GB free / 14% used

The preview health endpoint continues to report `deploymentEnv=production`; this pre-existing application-topology issue was observed before and after the Dokploy update and was not modified.

## Rollback

Swarm automatic rollback is configured on update failure. For a manual control-plane rollback, use the preserved prior image digest only after confirming the current service state and taking the required maintenance decision:

```bash
sudo docker service update \
  --image dokploy/dokploy:latest@sha256:72c082d05447f05c2452e1b29c5c664102290ea605e15a0f0dab2731be1ba7df \
  --update-parallelism 1 \
  --update-order start-first \
  --update-failure-action rollback \
  --update-monitor 30s \
  --rollback-parallelism 1 \
  --rollback-order start-first \
  --rollback-failure-action pause \
  --rollback-monitor 30s \
  --detach=false \
  dokploy
```

The Lightsail snapshot and PostgreSQL backup are retained as deeper recovery options. Restoring either is a separate production recovery procedure and is not part of normal image rollback.

## External references

- [Dokploy installation and version-specific update documentation](https://docs.dokploy.com/docs/core/installation)
- [Dokploy v0.30.5 release notes](https://github.com/Dokploy/dokploy/releases/tag/v0.30.5)
