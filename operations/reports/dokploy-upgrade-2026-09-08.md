# Dokploy Upgrade Report — v0.30.5 to v0.30.6

**Date:** 2026-09-08 (Europe/Lisbon)  
**Host:** AWS Lightsail `dokploy-aws`  
**Scope:** Dokploy control-plane service only  
**Result:** COMPLETE

## Change

Dokploy was updated from:

```text
dokploy/dokploy:v0.30.5
```

to the exact requested release:

```text
dokploy/dokploy:v0.30.6@sha256:1d6bd69ba58c1b4e305a9a33d77d8c3e0ee34707169f680cc600ab7ef1c3e6d8
```

The update targeted only the `dokploy` Docker Swarm service. The rollout used
one-task parallelism, `start-first` ordering, a 30-second monitor, and
automatic rollback on update failure. Port `3000:3000/tcp`, the single
replica, service networking, and the existing service configuration were
preserved.

Traefik, PostgreSQL, Redis, tenant databases, and application services were not
updated, restarted, or reconfigured.

## Pre-update protection

- Lightsail snapshot: `dokploy-aws-pre-dokploy-v0-30-6-20260908`
- Snapshot state after creation and before update: `available`
- Snapshot size: 320 GiB
- Snapshot created: 2026-09-08T23:47:39.164000+01:00
- PostgreSQL backup: `/var/lib/dokploy-upgrade-backups/dokploy-postgres-pre-v0.30.6-20260908.dump`
- PostgreSQL backup mode: `0600`
- PostgreSQL backup size: 267,234 bytes
- PostgreSQL backup SHA-256: `0b67514d6d4673894f636cdd2faff5a6decb1162ce0c57d293407eb683ffb6f2`
- Backup validation: `pg_restore --list` passed
- PostgreSQL preflight: `pg_isready` passed; schema-only `pg_dump` passed

## Acceptance

- Dokploy Swarm service: `1/1`
- Dokploy update status: `completed`
- Current Dokploy task: `wufrvopaf03watwvmr3ch206g`, running and healthy
- Prior v0.30.5 task: shutdown cleanly after the new task became healthy
- Dokploy HTTPS root: HTTP 200
- Dokploy `/api/health`: `{"ok":true}`
- JPV production HTTPS: HTTP 200
- JPV production `/api/health`: HTTP 200 with `ok=true`, `deploymentEnv=production`
- JPV staging HTTPS: HTTP 200
- JPV staging `/api/health`: HTTP 200 with `ok=true`, `deploymentEnv=staging`
- All 18 observed Swarm services: `1/1`
- Running unhealthy containers: zero
- Dokploy PostgreSQL task: unchanged; `pg_isready` passed and read-only `select 1` returned `1`
- Dokploy Redis task: unchanged; read-only `redis-cli ping` returned `PONG`
- Dokploy Traefik task: unchanged
- Docker: 29.2.0; Swarm active; one manager and one node
- Root filesystem: 274 GiB free / 12% used after update
- Representative endpoint results matched the pre-upgrade baseline:
  - HTTP 200: `prochat.tools`, `yeshua.academy`, `olivetoorganizing.com`,
    `jccpholdings.com`, `getproofly.app`, `saysthe.bible`,
    `resend.prochat.tools`, `onestatus.link`, and
    `auth.prochat.tools/health/alive`
  - HTTP 307: `finance.yeshua.academy` and `auth-admin.prochat.tools`
  - HTTP 530: `cedula.prochat.tools`, `legal-api.prochat.tools/health`,
    and `legal.prochat.tools`
  - DNS/connection failure: `viadieden.it`
- Image cleanup: no image deletion, `docker system prune`, or
  `docker system prune -a` was run. Both the v0.30.5 and v0.30.6 Dokploy
  images remain retained locally.
- Disk comparison: 32 GiB used / 278 GiB available before update; 36 GiB used
  / 274 GiB available after update. The increase is consistent with retaining
  the new image and container layers; no cleanup was performed.

The non-200 endpoint results above were already present in the pre-upgrade
baseline and were not caused or changed by this Dokploy update.

## Rollback

Swarm automatic rollback is configured on update failure. For a manual
control-plane rollback, confirm the current service state and make the required
maintenance decision first:

```bash
sudo docker service update --image dokploy/dokploy:v0.30.5@sha256:beaab9d816750ea9524e47d6d1a9ba466d6c3442f9943fee8ac81a6d72f73103 --update-parallelism 1 --update-order start-first --update-failure-action rollback --update-monitor 30s --rollback-parallelism 1 --rollback-order start-first --rollback-failure-action pause --rollback-monitor 30s --detach=false dokploy
```

The Lightsail snapshot and PostgreSQL backup are retained as deeper recovery
options. Restoring either is a separate production recovery procedure and is
not part of normal image rollback.

## External references

- [Dokploy installation and version-specific update documentation](https://docs.dokploy.com/docs/core/installation)
- [Dokploy v0.30.6 release notes](https://github.com/Dokploy/dokploy/releases/tag/v0.30.6)
