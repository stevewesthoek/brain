---
name: dokploy-ghcr-pull-auth
description: "When Dokploy fails to pull a GHCR image with \"unauthorized: authentication required\" — setting registryId triggers Registry Swarm (re-tag + push) instead of providing pull credentials. The correct fix is username/password/registryUrl directly on the application record."
---

# Dokploy GHCR Pull Authentication

## The insight
Dokploy has two separate auth paths for docker image pulls. Setting `registryId` on an application does NOT make it use that registry's credentials for pulling — it triggers "Registry Swarm" mode, which re-tags the image and *pushes* it to that registry. This causes permission_denied errors if you don't own the registry namespace being pushed to.

For pull-only GHCR auth, `getAuthConfig()` reads `application.username`, `application.password`, and `application.registryUrl` directly from the application record. These must be set on each application individually.

## When this applies
- Dokploy app set to `sourceType: docker` with a GHCR image
- Container logs or Dokploy deployment log shows: `unauthorized: authentication required` or `registry-1.docker.io` (even though image is on ghcr.io)
- You've linked a registry record via `registryId` but pulls still fail
- Deployment log shows Dokploy trying to push to `ghcr.io/stevewesthoek/...` (wrong namespace)

## The fix
Set credentials directly on the application record via the API:
```bash
source ~/.config/dokploy/.env
curl -s -X POST "https://dokploy.prochat.tools/api/application.update" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "<app-id>",
    "username": "stevewesthoek",
    "password": "<ghp_PAT_with_read:packages>",
    "registryUrl": "ghcr.io",
    "registryId": null
  }'
```

Critical: also set `registryId: null` to disable Registry Swarm mode.

## Gotchas
- `registryId` and `username/password/registryUrl` are mutually exclusive in effect. Using both simultaneously causes Registry Swarm to run (push attempt) regardless of the pull credentials.
- The PAT needs `read:packages` scope on the org that owns the package.
- If the GHCR package is public, no credentials are needed — but Dokploy still needs `registryUrl: ghcr.io` set or it defaults to docker.io.
- Must be set per-application — there is no global GHCR credential that applies to all apps.

## Context
Repo: all Dokploy docker-source apps (prochattools org)
Discovered: 2026-04-15
Area: Dokploy application settings, GHCR pull authentication
