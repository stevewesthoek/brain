# Redeploy Ingress Persistence Standard

**Status:** CANONICAL
**Scope:** Public applications deployed through Dokploy, Docker Swarm, Compose, Traefik, and Cloudflare Tunnel

## Generalized lesson

**Redeploy ingress persistence must be verified.**

A healthy application process is not proof of a healthy production deployment. A redeploy can recreate a service or container while leaving the application healthy and silently removing the Traefik contract that makes the public hostname reachable.

## Invariant

A production application is not redeploy-safe unless its ingress contract is generated or persisted by the deployment source of truth and survives container or service recreation.

The contract includes:

- the canonical public hostname and path;
- the intended routing provider (`@swarm`, `@docker`, or `@file`);
- the Traefik enablement, router rule, entrypoints, TLS, and backend-port configuration;
- membership in `dokploy-network` when Traefik reaches the workload over that network;
- the correct backend identity after a task or container is recreated.

Runtime labels or dynamic files added manually during incident recovery are not, by themselves, durable source-of-truth evidence.

## Redeploy acceptance gate

Run this gate after every public application deployment, service recreation, migration, or ingress change:

1. Confirm the service or container was recreated and is stable at the intended replica count.
2. Confirm the image tag and resolved digest, restart count, and internal application port.
3. Confirm the required Traefik labels or file-provider route are still present.
4. Confirm the expected router exists in Traefik's loaded configuration, under the intended provider, with the exact `Host(...)` rule and TLS state.
5. Confirm the backend service is `UP`, points to the recreated workload, uses the intended port, and can reach it through `dokploy-network` when required.
6. Confirm DNS resolves through the intended public ingress and that the Cloudflare Tunnel connector is active for the hostname.
7. Confirm the external HTTPS endpoint returns an application-specific success response, including a representative page and the application health endpoint when available.
8. Confirm the external certificate is valid and that Traefik logs show no new router, backend, TLS, or ACME errors for the application.
9. Confirm no stale or manual-only route is the sole remaining dependency for the public endpoint.

The gate fails if any internal check passes while the real external HTTPS path returns a proxy error or generic `404 page not found`.

## Provider-specific requirements

### Docker Swarm application

The Dokploy deployment source must preserve the service labels that generate the `@swarm` router. The expected minimum contract is equivalent to:

```text
traefik.enable=true
traefik.docker.network=dokploy-network
traefik.http.routers.<service>-web.entrypoints=web,websecure
traefik.http.routers.<service>-web.rule=Host(`<hostname>`)
traefik.http.routers.<service>-web.service=<service>-web
traefik.http.services.<service>-web.loadbalancer.server.port=<port>
```

Do not infer safety from a Dokploy domain record alone. Inspect the live Swarm service and Traefik API after recreation.

### Docker Compose application

If the canonical architecture requires a file-provider route, the route must be a managed and persisted deployment artifact. It must target a stable backend identity and the workload must join `dokploy-network`. Compose labels alone do not prove that Traefik discovered the workload.

## Incident reference

On 2026-08-24, `web-public-prochat-avejzq` was `1/1` and healthy, with zero restarts and direct application `200` responses. Its Dokploy domain record still contained `prochat.tools → 3000`, but the live Swarm service had no Traefik labels, no file-provider route existed, and the real public HTTPS path returned Traefik `404`. Restoring the canonical Swarm labels recreated the `@swarm` router and restored external HTTPS `200` responses.

This is the same ingress-layer failure class previously observed with Ory, n8n, Umami, and Via di Eden: application health does not establish public reachability. The repair mechanism must follow the workload's canonical provider; ProChat is a Swarm-label workload, while Via di Eden is a file-provider workload.
