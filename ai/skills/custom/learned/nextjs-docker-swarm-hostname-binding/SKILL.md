---
name: nextjs-docker-swarm-hostname-binding
description: Diagnose and fix Next.js 14 standalone health check failures in Docker Swarm where the app reports "Ready" but connection is refused — caused by HOSTNAME binding to the overlay IP instead of 0.0.0.0.
---

# Next.js 14 Standalone: Docker Swarm HOSTNAME Binding Mismatch

## The insight
Docker always sets the `HOSTNAME` env var to the container's short ID (e.g. `c4f072557185`).
In Docker overlay networks, that container ID resolves via internal DNS to the container's
overlay IP (e.g. `10.0.1.9`). Next.js 14 standalone uses `process.env.HOSTNAME` as its
**bind address** — so it binds to `10.0.1.9:3000`, not `0.0.0.0:3000`.

Health checks that use `localhost:3000` (→ `127.0.0.1`) hit nothing and get
"connection refused". The container is marked unhealthy → Traefik drops it → 502.

The app is fully running. Nothing crashed. The bind address is just the wrong interface.

## When this applies
- Next.js 14 standalone image deployed in Docker Swarm with overlay network
- App logs show `✓ Ready in Xms` but health check returns "connection refused"
- Container cycles between `(health: starting)` → `(unhealthy)` → killed → restarted
- Traefik returns 502 Bad Gateway despite container being "up"
- `curl http://localhost:3000` inside the container → connection refused
- `curl http://10.0.x.x:3000` inside the container → responds normally

## The approach
Don't assume "connection refused" = crashed process. First confirm what the server is
actually bound to:

```bash
# Inside the container — decode hex local_address column (little-endian):
cat /proc/net/tcp
# e.g. "0901000A:0BB8" → 10.0.1.9:3000 = overlay IP only, NOT 0.0.0.0
```

If it responds on the overlay IP but not localhost, it's this problem.

## The fix
Change the Dockerfile `HEALTHCHECK` to use `process.env.HOSTNAME` — the same address
Next.js bound to — instead of `localhost`:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://' + process.env.HOSTNAME + ':3000/api/health', \
  res => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1)).end()"
```

Increase `--start-period` to 60s+ if the startup script runs migrations or provisioning
before starting the server.

**Emergency fix without rebuild** — update the running Docker service health check:
```bash
docker service update \
  --health-cmd 'node -e "require('"'"'http'"'"').get('"'"'http://'"'"' + process.env.HOSTNAME + '"'"':3000/api/health'"'"', res => process.exit(res.statusCode === 200 ? 0 : 1)).on('"'"'error'"'"', () => process.exit(1)).end()"' \
  --health-start-period 60s \
  <service-id>
```

## Gotchas
- `ENV HOSTNAME=0.0.0.0` in the Dockerfile does **not** work — Docker always overrides
  `HOSTNAME` at container creation time with the container ID. The Dockerfile value is ignored.
- `HOSTNAME=0.0.0.0 node server.js` (inline in the start script) would also fix this by
  overriding before Node.js reads the env — but modifying the health check is cleaner.
- The symptom looks like a silent crash because Docker Swarm kills unhealthy containers quickly,
  making it seem like the process died. It didn't — the health check just never passed.
- This is Next.js 14+ behavior. Earlier versions may have used `localhost` as the default.
- Disk space exhaustion on the build host (`/dev/root` at 95%+) causes Docker BuildKit to
  hang at "exporting layers". Symptom: log file stops growing after `#24 exporting layers`.
  Fix: `truncate -s 0 /var/log/syslog /var/log/kern.log` and remove `/var/log/*.gz`.

## Context
Repo: prochat (`prochattools/prochat`)
Discovered: 2026-04-11
Area: `Dockerfile` HEALTHCHECK directive
Stack: Next.js 14.2 standalone, Docker Swarm, Traefik, Dokploy
