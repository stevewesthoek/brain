# MRU0-P3.25.1B — Brain Console Restoration Assessment

**Date:** 2026-08-23
**Repository:** `brain`
**Scope:** restore and assess the existing standalone `projects/brain-console` surface

## Decision

**Status: NEEDS REPAIR for current end-to-end activation; READY as a restored/buildable optional surface.**

The existing Brain Console can be restored and operated locally through its documented
Brain Console → Brain Core API boundary. It is type-safe, buildable, and its documented
routes render successfully. It should remain an optional/specialist surface until a
separate, authorized compatibility decision exposes P3.17–P3.24 review capabilities
through Brain Core.

The current end-to-end runtime is not ready for activation: port `4877` is occupied by
PID `3386`, launched from the protected `brain-video-orchestrator` worktree, and the
read-only status route timed out during the follow-up audit. The process was not
stopped or modified. The Console therefore has verified build/render readiness, but
not current live Brain Core API readiness.

No UI redesign, new Brain Core API, runtime authority change, or Video Orchestrator
merge was performed.

## Restoration evidence

Dependency restoration used the existing lockfile only:

```text
cd projects/brain-console
npm ci
```

Results:

- dependencies restored successfully;
- `npm run typecheck`: PASS;
- `npm run build`: PASS;
- build emitted one existing CSS/autoprefixer warning (`flex-end` compatibility), not a build failure;
- npm reported four audit findings; no dependency remediation was authorized or performed.

The development server started on `http://localhost:4881`. Brain Core remained the
backend at `http://localhost:4877` and reported `mode: read-only`, `ok: true`, and
`generationModeRuntime: fixture`.

That earlier status response is historical evidence from the restoration run. A later
read-only probe found the protected worktree process still listening on `4877`, but
`/status` and `/infinite-brain/status` returned 200 while representative operational
routes (`/ops/system-metrics`, `/local-apps/dashboard`, `/infra/dokploy`, and others)
timed out. This is an environment/process readiness issue, not a Console source or
dependency failure.

Documented Console routes returned HTTP 200:

`/`, `/ai-models`, `/aws-video`, `/dokploy`, `/infrastructure`, `/local-apps`,
`/monitoring`, `/scheduler`, `/settings`, `/tunnels`, `/video-analyzer`.

## Architecture assessment

### Strengths

- `projects/brain-console/lib/braincore-client.ts` centralizes API access, timeout,
  JSON parsing, HTTP errors, and Zod response validation.
- The Console does not read Brain runtime files directly.
- The default backend is the documented local Brain Core endpoint, configurable through
  `NEXT_PUBLIC_BRAIN_CORE_URL`.
- Existing screens are modular React components with route-specific schemas and query
  functions.
- Browser-side controls call Brain Core rather than executing shell commands locally.
- Brain Core remains the authority for operational data and safety boundaries.

### Working API-backed surfaces

The restored app consumes existing Brain Core routes for status, infrastructure,
local-apps, scheduler, monitoring, tunnels, AI model health, graphify status,
Mind-Steward scheduler status, and existing video-analysis/video-orchestrator views.
These are read through `brainCoreRequest` or the existing action helper and validated
by the Console's schemas.

### P3.17–P3.24 compatibility

The accepted P3.17–P3.24 capabilities exist in Brain Core/runtime-local Brain
artifacts and acceptance reports, but the standalone Console does not currently
consume them as a unified review workflow:

| Capability | Current assessment | Boundary |
|---|---|---|
| P3.17 unified review inbox | Not exposed as a Console surface | Needs an existing/canonical Brain Core read route before UI work |
| P3.18 intelligence briefing | Not exposed | Same API exposure decision required |
| P3.19 review workflow | Not exposed as a unified Console workflow | Must preserve the existing decision boundary |
| P3.20 controlled promotion | Not exposed | Must not be implemented as direct UI mutation |
| P3.21 daily intelligence loop | Not exposed | Remains manual/report-only through existing Brain tooling |
| P3.22 feedback calibration | Not exposed | Remains report-only |
| P3.23 operational readiness | Not exposed as a P3 readiness view | Existing Brain Core readiness routes are for other operational domains |
| P3.24 learning checkpoint | Not exposed | Remains report-only and human-governed |

This is a compatibility gap, not evidence that those packets are missing or invalid.
No direct file access from the browser should be added to close it.

## Video Orchestrator boundary

The standalone app contains existing video-related routes/components and Brain Core
contains existing provider-backed video routes. This assessment did not merge
`feature/video-orchestrator`, add scheduling, enable execution, or change provider
authority. Any future reconciliation must remain a separately authorized integration
review.

## Risks and limitations

- The standalone app is optional/legacy relative to the primary Obsidian Brain Console
  surface described in its README and existing Infinite Brain architecture docs.
- The P3.17–P3.24 review experience is not available in this app today.
- The app's production build has a non-blocking CSS compatibility warning.
- Dependency audit findings require a separate owner-authorized dependency review.
- Route HTTP 200 proves server rendering, not populated live provider data; Brain Core
  was intentionally observed in read-only fixture mode.
- `projects/brain-console/package.json` has no test script. The checked-in
  `lib/aws-video-selection.test.ts` is not directly runnable with the repository's
  plain Node invocation because its extensionless local import is unresolved; no test
  runner or source change was introduced in this assessment.

## Roadmap

### Immediate

Keep `projects/brain-console` as an optional, API-mediated diagnostics surface. Preserve
its current route/component boundaries and use the existing Brain Core client.

### Required before P3 review integration

Perform a separate read-only Brain Core contract audit to determine whether the
P3.17–P3.24 projections should receive canonical read-only routes. If authorized,
define those routes and schemas first, then add a bounded Console read-only view.

### Not authorized by this assessment

- UI redesign;
- direct runtime-file reads;
- new review/promotion APIs;
- automatic promotion or decisions;
- scheduling or autonomous execution;
- Video Orchestrator merge or provider changes.

## Final assessment

The existing Brain Console is restored and technically healthy at source/build level
for its current documented purpose. It is **NEEDS REPAIR for current end-to-end
activation** because the occupied Brain Core runtime is not presently responsive.
After the protected runtime is independently recovered or released by its owner, a
fresh `/status` plus representative read-only route probe is required. It also
**NEEDS A SEPARATE API/authority DECISION** before it can represent the unified
Infinite Brain P3.17–P3.24 review layer.
