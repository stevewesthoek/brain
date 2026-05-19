---
name: dokploy-swarm-recovery
description: When Dokploy is unreachable (502/connection refused) after a restart, upgrade attempt, or Azure restore — the issue is almost always the port 3000 publication on the Docker Swarm service, not Traefik or DNS.
---

# Dokploy Swarm Recovery

## The insight

Dokploy runs as a Docker Swarm service, NOT a standalone container. Cloudflare Tunnel routes `dokploy.prochat.tools` directly to `localhost:3000`, bypassing Traefik entirely. If port 3000 is not published to the host (Swarm ingress), the tunnel has nothing to connect to — even though the container is healthy internally.

This is counter-intuitive because:
1. The Traefik dynamic config at `/etc/dokploy/traefik/dynamic/dokploy.yml` defines a route to `http://dokploy:3000` — suggesting Traefik handles Dokploy. It doesn't for external traffic.
2. Other apps route through Traefik (localhost:80), so you expect Dokploy to do the same. It's the exception.
3. `docker service ls` shows Dokploy "running" even when it's unreachable externally — the service is up but the port binding is missing.

## When this applies

- Dokploy UI returns 502 Bad Gateway or connection refused
- `curl localhost:3000` on the VM fails but `docker service ps dokploy` shows the task running
- After an upgrade attempt where the service was recreated
- After an Azure disk snapshot restore (Swarm state may not preserve port publications)
- After running `docker service update dokploy --image ...` (port bindings can be lost)

## The approach

1. **Check port publication first**: `docker service inspect dokploy --format '{{json .Endpoint.Ports}}'` — if empty or missing port 3000, that's your problem.
2. **Don't touch Traefik, DNS, or Cloudflare** — the tunnel config is static and correct. The problem is always on the Docker side.
3. **Don't recreate the service** unless absolutely necessary — you'll lose environment variables, labels, and network attachments that Dokploy depends on.

## The fix

```bash
# Republish port 3000
docker service update dokploy --publish-add 3000:3000

# Verify
curl -s localhost:3000 | head -5
```

If the service was accidentally removed entirely, recreate with ALL of these:
- Image: `dokploy/dokploy:v0.29.2`
- Network: `dokploy-network` (NOT `dokploy_default`)
- Volume: `/var/run/docker.sock:/var/run/docker.sock` (required for container management)
- Port: `3000:3000` published

## Gotchas

- **Network name**: The overlay network is `dokploy-network`, not `dokploy_default`. Using the wrong name causes "network not found" errors.
- **Docker socket**: Dokploy needs `/var/run/docker.sock` mounted. Without it: "Error: connect ENOENT /var/run/docker.sock".
- **Postgres race condition**: After a cold boot or restore, Dokploy may crash with "the database system is shutting down" if Postgres isn't ready. Wait for Postgres health, then restart Dokploy.
- **API key storage**: The `key` column in Dokploy's database stores a HASH, not the plaintext. The `start` column has the first 6 chars. Don't confuse the hash with the usable key.
- **Webhook endpoint**: The GitHub App posts to `/api/deploy/github` (NOT `/api/webhook/github`). The wrong endpoint returns 401.
- **dokploy-cli**: The packaged CLI (`dokploy-cli verify`, `dokploy-cli list`) returns 401. Use direct tRPC API calls instead.

## Context

Repo: brain (cross-repo infrastructure knowledge)
Discovered: 2026-05-19
Area: operations/infrastructure (Dokploy on Azure VM `vm-dokploy`)
