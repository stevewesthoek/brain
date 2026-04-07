---
name: dokploy-swarm-deploy-stale
description: When Dokploy's deploy API (or GitHub webhook) returns 200 but the live site keeps running old code — diagnose and force the Swarm service to pick up the new image.
---

# Dokploy Swarm Deploy Stale

## The insight
Dokploy's `application.deploy` API returns HTTP 200 + "Application deployed
successfully" regardless of whether the Docker Swarm service actually restarted.
The image rebuild and the service update are two independent steps — Dokploy can
silently succeed at building but fail to roll the service.

## When this applies
- Pushed to main, GitHub webhook shows 200, `application.deploy` returns success
- No new record appears in `deployment.all` despite API confirming success
- `docker ps` on the server shows container "Up X days" — far older than latest commit
- Live site still serves old code

## The approach
1. Confirm the image is newer than the running container:
   `ssh dokploy "docker images <svc> --format '{{.CreatedAt}}'"`
   vs container uptime from `docker ps`
2. If image is newer but container is old → service update silently didn't run
3. Force the Swarm service to restart with the current image:
   `ssh dokploy "docker service update --force <service-name>"`
4. If image date is also old → the build itself didn't run; investigate
   Dokploy logs: `docker logs dokploy.1.<hash> --tail 50`

## The fix
```bash
# Find the service name
ssh dokploy "docker service ls | grep <app-keyword>"

# Force restart (uses whatever image is currently tagged :latest)
ssh dokploy "docker service update --force <service-name>"
```

## Gotchas
- `--force` only restarts with the already-tagged image. If the build
  also failed to produce a new image, this just restarts old code.
- Always verify image CreatedAt > container start time before forcing.
- Service name pattern in this stack: `web-public-<app-name>-<hash>`
- The Dokploy container name has a `.1.<task-hash>` suffix; find it with
  `docker ps --format '{{.Names}}' | grep dokploy`

## Context
Repo: jpv-bootcamp (but applies to all Dokploy apps on prochat.tools)
Discovered: 2026-04-07
Area: Dokploy deployment pipeline / Docker Swarm
