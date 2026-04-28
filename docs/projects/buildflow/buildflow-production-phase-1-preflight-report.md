# BuildFlow Production Phase 1 Preflight Report

## Proven Facts

- `ed29eb68` is pushed and no longer ahead of `origin/main` in the `brain` repo.
- Public endpoints returned HTTP 200 during verification:
  - `https://buildflow.prochat.tools/`
  - `https://buildflow-staging.prochat.tools/`
  - `https://buildflow-staging.prochat.tools/api/openapi`
- The BuildFlow repo exists at `/Users/Office/Repos/stevewesthoek/buildflow`.
- BuildFlow repo state at inspection time:
  - Branch: `main`
  - Latest local commit: `f7c1618`
  - Status: ahead of `origin/main` by 5 commits
- Commit `3473303` exists in the BuildFlow repo.
- `Dockerfile` at `3473303` matches the current `Dockerfile`.
- The Dockerfile sets:
  - `BRIDGE_PORT=3053`
  - `PORT=3054`
  - `WEB_PORT=3055`
- The runtime image exposes `3054` only, not `3053` or `3055`.
- The proxy code in `packages/proxy/src/index.ts` starts:
  - relay on `3053`
  - web on `3055`
  - proxy on `3054`
- The proxy routes `/api/register`, `/api/bridge/ws`, and `/api/admin*` to relay, and `/api/openapi`, `/api/actions*`, and `/dashboard*` to web.

## Assumptions

- The Dockerfile and proxy code are sufficient to satisfy the Phase 1 topology requirement without a local Docker build.
- The current BuildFlow branch state in `/Users/Office/Repos/stevewesthoek/buildflow` is unrelated to this cutover preflight and should be left untouched.

## Blockers

- None for read-only preflight.
- Docker build and container-runtime verification were intentionally not run, so there is no live proof yet that the image builds cleanly in this environment.

## Recommended Next Steps

- Run a cheap, explicitly approved Docker build verification next.
- If the build succeeds, verify container startup and readiness for relay, web, and proxy ports.
- Do not change DNS, tunnel routes, Dokploy config, or container state until those checks pass.
