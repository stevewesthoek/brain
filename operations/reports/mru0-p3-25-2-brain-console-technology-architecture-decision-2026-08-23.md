# MRU0-P3.25.2 — Brain Console Technology Architecture Decision

**Date:** 2026-08-23
**Decision:** **KEEP CURRENT STACK**
**Scope:** architecture decision only; no dashboard implementation

## Executive decision

Keep the existing Next.js 15 / React 19 / TypeScript Brain Console stack and its
Brain Core API connector. Do not replace the frontend with Grafana, Metabase, or a
new dashboard framework.

The standalone port-4881 application should remain an optional specialist
diagnostics and operations surface. It must not become a second primary Decision
Center. The accepted primary human cockpit remains the Obsidian Brain Console inside
Mind; Brain Core remains the shared headless API, control, and safety boundary.

This decision preserves the existing architecture while leaving room for a future
read-only operational cockpit if ownership and portal boundaries are explicitly
re-decided.

## Evidence reviewed

- `projects/brain-console/package.json`
- `projects/brain-console/README.md`
- `projects/brain-console/lib/braincore-client.ts`
- `projects/brain-console/lib/braincore-schemas.ts`
- `projects/brain-console/components/*`
- `projects/brain-core/README.md`
- `projects/brain-core/src/api/server.ts`
- `projects/brain-core/src/api/routes.ts`
- `operations/specs/brain-console-obsidian-plugin.md`
- `operations/specs/infinite-brain-context-learning-runtime-architecture.md`
- `operations/reports/clr3-decision-core-portal-acceptance-2026-08-16.md`
- `operations/reports/ikhp5-unified-consumer-surfaces-acceptance-2026-08-19.md`
- `operations/reports/mru0-p3-25-1b-brain-console-restoration-assessment-2026-08-23.md`

## Current technology assessment

### Frontend

The current frontend is a reasonable fit for a bounded local operational interface:

- Next.js 15 provides routing, build, and a conventional React application model.
- React 19 supports modular client components and incremental surface growth.
- TypeScript provides compile-time contracts for UI and API boundaries.
- TanStack Query is already used for request lifecycle, polling, loading, and error
  states.
- TanStack Table is available for tabular operational data.
- Zod schemas validate Brain Core responses at runtime.
- Recharts is already present for compact charts.
- `clsx`, `tailwind-merge`, and the existing CSS system are sufficient for the
  current design; adding a component framework is not required yet.

The architecture is maintainable if screens remain thin, route-specific contracts
remain explicit, and domain logic stays in Brain Core or shared typed client modules.
Next.js server rendering is not being used as a second data authority; the current
browser client reads Brain Core.

### Backend

Brain Core is a small localhost Node HTTP API with explicit route handling and
adapter modules. It already provides:

- read-only status and infrastructure projections;
- runtime report and scheduler views;
- AI model selector health;
- approval and execution-gate projections;
- Infinite Brain status/proposal views;
- bounded Video Orchestrator planning/status surfaces;
- localhost and safety checks at the API boundary.

This is adequate for the current scale and safety model. It is not yet a general
analytics platform or a versioned public API. Before substantial cockpit growth,
Brain Core should standardize projection envelopes, freshness/provenance, error
shapes, pagination/filtering, and capability discovery.

## What Brain Console should become

The answer is deliberately scoped:

| Role | Standalone port 4881 | Obsidian Brain Console |
|---|---|---|
| Operational diagnostics | Yes, specialist surface | Yes |
| Infrastructure visibility | Yes, read-only specialist views | Yes, primary human workflow |
| Infinite Brain review/decision center | Not by default | Yes, canonical primary surface |
| Mind meaning, importance, priorities | No | Mind/Obsidian authority |
| Execution authority | No; delegated through Brain Core gates | No independent authority |
| Video Orchestrator status/planning | Future read-only specialist view | Future bounded view |

The web Console may eventually expose health, ingestion status, review summaries,
briefing, calibration, repositories, servers, applications, automation status, and
Video Orchestrator status only as Brain Core projections. It must not create a second
review database, decision workflow, Mind store, or execution controller.

## Dashboard ecosystem alternatives

### Continue with Next.js/React — selected

Best fit for:

- a local, authenticated-by-boundary operational surface;
- Brain Core-specific response contracts;
- safety-aware error and empty states;
- specialist workflows that are not generic time-series dashboards;
- incremental addition of typed views without introducing another service.

Recommended current tools:

- TanStack Query for request state and bounded polling;
- TanStack Table for dense resource/event tables;
- existing Recharts only where a compact chart materially improves understanding;
- Apache ECharts only if a future visualization requires capabilities Recharts cannot
  provide, and only after a bounded dependency decision;
- shadcn/ui only if repeated component primitives become a demonstrated maintenance
  problem. It is not required for the current architecture.

### Grafana — complementary, not a replacement

Grafana is appropriate for time-series infrastructure metrics, alert exploration,
and historical operational trends when a supported metrics source exists. It is not a
replacement for Brain Console because it does not own Brain review contracts,
provenance, Mind impact, approval boundaries, proposal history, or Brain Core safety
semantics.

If adopted later, Grafana must consume an approved metrics projection. It must not
become a second Brain authority or receive direct access to runtime-local truth.

### Metabase — not the primary fit

Metabase is useful for relational/business analytics and ad hoc data exploration. It
does not fit the primary Brain Console role because the target surfaces are typed
operational projections, review state, safety boundaries, and evidence relationships,
not arbitrary BI queries. It would add a data and authority layer without solving the
main contract problem.

### Other dashboard frameworks — defer

No alternative currently demonstrates enough benefit to justify migration cost,
parallel UI ownership, or a new runtime dependency. Reconsider only with measured
requirements such as sustained rendering/performance failure, multi-tenant delivery,
or a provider-neutral deployment target that Next.js cannot meet.

## Infinite Brain alignment

The authority model remains:

```text
Mind meaning and priorities
        ↓
Brain canonical policies and evidence
        ↓
Brain Core typed projections and safety boundary
        ↓
Obsidian primary cockpit / port-4881 specialist adapter
```

The standalone Console must not:

- read `runtime/local/**` directly from the browser;
- infer Mind importance or make strategic decisions;
- duplicate the unified review inbox or Decision Core;
- write canonical Brain or Mind state directly;
- bypass approval, receipt, or validation gates;
- become a provider/model-selection authority.

The existing `brainCoreRequest` client, Zod schemas, and Brain Core route boundary
are the correct integration pattern.

## Brain Core evolution required before expansion

No API implementation is part of this decision. Future contracts should be planned
in this order:

1. **Projection envelope:** stable `id`, `generatedAt`, `status`, `freshness`,
   `source`, `provenance`, `warnings`, and structured error fields.
2. **Capability manifest:** explicit read capabilities, availability, safety flags,
   and versioned contract references.
3. **Review projections:** read-only unified inbox, briefing, calibration, readiness,
   and learning-checkpoint projections exposed through Brain Core, without moving
   authority from existing P3.17–P3.24 sources.
4. **Query controls:** bounded filters, pagination, and deterministic empty states.
5. **Conformance tests:** Core route/schema/client fixtures proving no direct file
   access, no automatic promotion, no Mind mutation, and no execution authority.

The web Console should consume these contracts only after they are accepted. It
should not manufacture missing projections from local files.

## Video Orchestrator preparation

Current architecture can support future Video Orchestrator integration because:

- Brain Core already exposes read-only video status/planning routes;
- the Console already isolates video views in dedicated components;
- provider-specific work remains behind Brain Core adapters;
- planning and execution boundaries are represented in API payloads and safety flags.

Before activation or broader integration, require:

- versioned read projections for job, approval, artifact, readiness, and audit state;
- explicit `readOnly`, `executionEnabled`, `executionPerformed`, and effect metadata;
- stable empty/error states for absent providers and artifacts;
- no direct media-folder, credential, or provider access from the browser;
- separate authorization for execution, scheduling, publishing, or remediation.

Do not merge `feature/video-orchestrator` as part of this decision.

## Risks and migration strategy

Risks:

- standalone web and Obsidian surfaces could drift into duplicate primary workflows;
- Brain Core's large route file and ad hoc route contracts may slow growth;
- polling and unbounded payloads could degrade dashboard responsiveness;
- direct provider-backed reads can produce uneven latency and stale states;
- adding generic dashboard tooling could create a parallel authority/data layer.

Mitigations:

- keep Obsidian primary and port 4881 specialist;
- add projection contracts and conformance tests before new UI;
- retain explicit Zod parsing, timeouts, freshness, and structured errors;
- prefer bounded read projections over raw provider calls;
- measure before introducing ECharts, shadcn/ui, Grafana, or Metabase.

## Recommended roadmap

### Immediate — P3.25.3: Brain Core projection-contract plan

Inventory existing P3.17–P3.24 artifacts and define read-only Core projection
contracts, ownership, freshness, and route boundaries. No UI implementation.

### Next — P3.25.4: bounded Core read exposure

Only after authorization, expose the accepted projections through Brain Core with
schemas, empty/error states, provenance, and conformance tests.

### Later — P3.25.5: specialist Console read views

Add narrowly scoped read-only views to port 4881 only if they do not duplicate the
Obsidian Decision Center. Reuse the existing client/query/schema patterns.

### Separate — Video Orchestrator integration review

Review accepted Core video contracts and feature-branch readiness independently.
Do not merge or enable execution as part of Console work.

## Decision summary

- **Technology:** KEEP CURRENT STACK.
- **Frontend:** Next.js 15 / React 19 / TypeScript, with existing TanStack Query,
  TanStack Table, Zod, and Recharts foundations.
- **Backend:** retain Brain Core as the sole API/control/safety boundary.
- **Primary cockpit:** Obsidian Brain Console.
- **Standalone web Console:** optional specialist diagnostics/operations surface.
- **External dashboards:** complementary only, and deferred.
- **Next implementation phase:** MRU0-P3.25.3 Brain Core projection-contract plan.

No implementation, dependency change, provider change, Video Orchestrator merge, or
runtime authority change is authorized by this document.
