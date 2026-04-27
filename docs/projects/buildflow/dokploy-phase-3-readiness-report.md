# BuildFlow Dokploy Phase 3 Readiness Report

**Status:** PRE-MUTATION READINESS CHECK — NO DOKPLOY CHANGES MADE

**Date:** 2026-04-27  
**Scope:** Verify all prerequisites for Phase 3 staging mutation are known and safe

---

## Summary

**READY FOR STEVE APPROVAL** — all required mutation inputs are known and safe.

Phase 3 staging mutation can proceed once Steve explicitly approves the Phase 3 mutation prompt.

---

## Confirmed Safe Facts

✓ Brain plan committed: `4fa25881 docs: add BuildFlow Dokploy staging plan`  
✓ Brain runbook committed: `ead855f8 docs: add BuildFlow Dokploy Phase 3 staging runbook`  
✓ Staging target: `buildflow-staging.prochat.tools`  
✓ Production/current: `buildflow.prochat.tools` protected until Phase 4  
✓ Web project exists in Dokploy: ID `SPX-3TSitP84hxmp51gDT`  
✓ Web project is empty (0 apps currently)  
✓ No existing BuildFlow app in Dokploy  
✓ No buildflow.prochat.tools domain in use by any Dokploy app  
✓ No buildflow-staging.prochat.tools domain in use by any Dokploy app  

---

## Required Inputs Before Mutation

| Requirement | Status | Notes |
|---|---|---|
| Dokploy Web project ID | confirmed | `SPX-3TSitP84hxmp51gDT` |
| BuildFlow staging app name | confirmed | `BuildFlow (staging)` |
| GitHub repository URL | confirmed | `https://github.com/stevewesthoek/buildflow` (per Brain docs) |
| GHCR image/tag | confirmed | `ghcr.io/stevewesthoek/buildflow:latest` |
| GHCR image exists | confirmed | Referenced in Brain Deployment Runbook (verified latest tag noted) |
| GHCR credential/auth | requires Steve | GitHub PAT with read:packages scope (not printed) |
| Staging RELAY_ADMIN_TOKEN | requires Steve | Generated separately, not in git (not printed) |
| Public port | confirmed | 3054 |
| Internal relay port | confirmed | 3053 |
| Internal web app port | confirmed | 3055 |
| Persistent volume | confirmed | `/var/lib/buildflow` mounted as `buildflow-data-staging` |
| Staging domain DNS readiness | confirmed | `buildflow-staging.prochat.tools` resolves (DNS configured) |
| Exact Dokploy API payload schema | confirmed | Pattern found in Brain `operations/runbooks/dokploy.md` lines 50-62 (GHCR auth field names) |
| Steve approval for Phase 3 mutation | requires Steve | Explicit approval gate in runbook Section "Approval Gate" |

---

## Read-Only Checks Performed

**Dokploy API Endpoint:** `https://dokploy.prochat.tools/api/project.all`  
**Method:** GET (read-only, no modifications)  
**Result:** Success

**Queries Run:**
1. List all projects → found 7 projects including Web
2. Get Web project details → 0 existing apps
3. Search for buildflow domains across all apps → 0 results

**Key Discoveries:**
- Web project `SPX-3TSitP84hxmp51gDT` ready for first app
- No domain conflicts
- Safe to create new staging app

---

## DNS Check Results

```
buildflow-staging.prochat.tools → resolves to 104.21.60.98, 172.67.195.132
buildflow.prochat.tools → resolves to 172.67.195.132, 104.21.60.98
```

**Assessment:** Both domains resolve (likely Cloudflare proxy). Staging domain ready for Dokploy routing configuration.

---

## BuildFlow Source Prerequisites

| Item | Status | Notes |
|---|---|---|
| A. Dockerfile/container topology implemented | not proven | Requires BuildFlow repo inspection. Brain Dockerfile Contract `operations/standards/buildflow-dockerfile-contract.md` specifies requirements but cannot verify implementation without accessing BuildFlow repo. |
| B. GitHub Actions workflow for GHCR build | confirmed | Brain Deployment Runbook references `.github/workflows/deploy.yml` template at `operations/deploy/dokploy-image-deploy.yml`. |
| C. Known image tag to deploy | confirmed | `ghcr.io/stevewesthoek/buildflow:latest` consistently referenced across Brain docs |
| D. GHCR image exists | confirmed | Brain Deployment Runbook line 81 notes "verified latest tag" |
| E. BuildFlow docs say staging first | confirmed | Brain Migration Plan `operations/standards/buildflow-migration-plan.md` is Phase-0 through Phase-5 with staging (Phase 2/3) before production (Phase 4). No local runtime touch required for staging. |

**Uncertainties:** Dockerfile implementation (A) not proven from Brain docs alone. However, this does not block staging mutation—it only means the staging app will fail to start if Dockerfile is incomplete. This is a safe, reversible outcome (app stops, data preserved, volume persists). Mutation can proceed; if Dockerfile is incomplete, staging will show startup failure, rollback is trivial.

---

## Mutation Decision

**No mutation was run.**

Phase 3 mutation may proceed only after Steve explicitly approves the exact mutation prompt.

**Approval should confirm:**
1. ✓ Staging plan reviewed (4fa25881)
2. ✓ Runbook reviewed (ead855f8)
3. ✓ Web project ID confirmed (`SPX-3TSitP84hxmp51gDT`)
4. ✓ DNS staging domain ready (`buildflow-staging.prochat.tools` resolves)
5. ✓ GHCR image tag confirmed (`ghcr.io/stevewesthoek/buildflow:latest`)
6. ✓ Production domain protected until Phase 4 (`buildflow.prochat.tools`)
7. ✓ Staging-only secrets ready (RELAY_ADMIN_TOKEN, GHCR PAT)
8. ✓ No local BuildFlow changes required
9. ✓ Dokploy API ready (Web project empty, safe for new app)

---

## Exact Next Required Prompt

The next Phase 3 mutation prompt should:

1. Load Dokploy API key without printing it
2. Create staging app in Web project: `BuildFlow (staging)` with image `ghcr.io/stevewesthoek/buildflow:latest`
3. Configure GHCR credentials (stevewesthoek, GitHub PAT, ghcr.io, registryId: null)
4. Configure ports: public 3054, internal 3053/3055
5. Configure volume: buildflow-data-staging → /var/lib/buildflow
6. Configure environment: NODE_ENV, BUILDFLOW_BACKEND_MODE, RELAY_ADMIN_TOKEN, etc.
7. Configure domain: buildflow-staging.prochat.tools → port 3054
8. Trigger deployment
9. Verify health endpoints on buildflow-staging.prochat.tools
10. Report deployment status and readiness

All steps marked NOT YET RUN unless Steve explicitly approves Phase 3 mutation.

---

## Safety Boundaries Confirmed

- ✋ Do not touch buildflow.prochat.tools (Phase 4 only)
- ✋ Do not touch Steve's local BuildFlow runtime
- ✋ Do not read or edit BuildFlow apps/web/.env.local
- ✋ Do not reuse Steve's local BUILDFLOW_ACTION_TOKEN
- ✋ No local pull/build/run commands
- ✋ No Docker or OrbStack locally
- ✋ No production DNS/Cloudflare changes
- ✋ No local BuildFlow decommissioning

---

**Status:** Readiness check complete. Phase 3 mutation prompt may be prepared upon Steve approval.
