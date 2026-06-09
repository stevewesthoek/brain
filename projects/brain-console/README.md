# Brain Console

**Status:** Phase 1 implemented and build-validated  
**Role:** single leading local operations dashboard for Brain  
**Port:** `4881`  
**Data source:** Brain Core API only

Brain Console is the fourth and final dashboard direction for the `brain` repo.

```text
Brain Console → Brain Core API → runtime/job/config sources
```

Legacy dashboards are reference-only.

## Run

```bash
cd projects/brain-console
npm install
npm run dev
```

Open:

```text
http://localhost:4881
```

Brain Core must be available at:

```text
http://localhost:4877
```

Override in the browser build with:

```bash
NEXT_PUBLIC_BRAIN_CORE_URL=http://localhost:4877 npm run dev
```

## Architecture and design rules

Read these before changing Brain Console UI or API contracts:

```text
docs/system/brain-console-architecture.md
docs/system/brain-console-design-system.md
```

## Phase 1 surfaces

- Overview cards from `/ops/system-metrics`, `/ops/ai-usage-windows`, and `/ops/ai-costs`
- Local Applications from `/local-apps/dashboard`, `/local-apps/action-readiness`, and `/local-apps/actions/status`
- Dokploy status from `/infra/dokploy`
- New Relic uptime from `/infra/monitoring`
- Office nightly scheduler status from `/infra/scheduler`
- Cloudflare Tunnels from `/infra/tunnels`
- Video Analyzer from `/research/video-analyze` and `/research/video-analyze/history`
- AWS Video Pipeline from the current Brain Core AWS Video endpoints

## Design system

Before changing the UI or operational contracts, read:

```text
docs/system/brain-console-architecture.md
docs/system/brain-console-design-system.md
```

The dashboard follows a shadcnblocks admin-dashboard style: compact shell, left navigation, page tabs, bounded cards, clear status states, and no overlapping controls.

## Safety

- The browser never executes shell commands.
- Start/stop/restart buttons call Brain Core only.
- Unsupported actions remain disabled and explain why.
- YouTube publishing routes exist in Brain Core but are intentionally absent from Phase 1.



## Validate

```bash
npm run typecheck
npm run build
```

Current Phase 1 validation:

```text
✓ typecheck passes
✓ production build passes
```

## Current AWS Video contract

Use the current Brain Core route for requesting script changes:

```text
POST /api/video-orchestrator/scripts/:jobId/request-changes
```

Do not use the older `/changes` path.

## Phase 1 parity

See:

```text
docs/system/brain-console-phase-1-parity-checklist.md
```



## Manual QA

Before importing the next legacy-dashboard feature slice, run:

```text
operations/runbooks/brain-console-manual-qa.md
```
