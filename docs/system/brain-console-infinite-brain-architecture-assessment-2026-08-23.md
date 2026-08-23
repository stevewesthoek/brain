# Brain Console Infinite Brain Architecture Assessment

**Date:** 2026-08-23
**Scope:** read-only assessment for MRU0-P3.25.4A

## Current architecture

Brain Console is an optional browser operations surface under `projects/brain-console`. It uses Next.js App Router, React, TypeScript, TanStack Query, Zod, Lucide, Recharts, and local CSS utility conventions. The browser calls Brain Core through `lib/braincore-client.ts`; it does not read repository files or execute shell commands.

Brain Core is the API and safety boundary. The Console has both read queries and approval-aware action mutations for local applications, Infinite Brain proposal workflows, video workflows, and other operational surfaces. The existing client uses per-route Zod schemas, a ten-second default timeout, and polling intervals ranging from five to thirty seconds.

## Current surfaces

Routes/pages cover overview, AI models, local apps, infrastructure, Dokploy, monitoring, tunnels, scheduler, video analysis, AWS Video, and settings. The overview embeds `InfiniteBrainDashboard`; that component currently reads `/infinite-brain/status`, Mind Steward scheduler status, and an optional Mind maintenance report. `InfiniteBrainProposalReview` reads and mutates a large set of proposal, approval, readiness, dry-run, metadata-writer, and verification routes.

The README explicitly defines the web Console as an optional specialist surface and the Obsidian Brain Console plugin as the primary human cockpit. That boundary remains authoritative: this assessment does not propose a second Decision Center or a second memory system.

## Health assessment

**Implementation health:** structurally sound and reusable. The client boundary, runtime schemas, polling model, component shell, status/error states, and existing operational cards provide a workable foundation.

**Integration health:** partial. Brain Core now exposes the P3.25.3C and P3.25.3D projection endpoints, but the Console has no projection-envelope schemas or consumers for them. Infinite Brain UI still mixes legacy status endpoints with direct workflow/mutation routes.

**Documentation health:** the README and architecture/design references establish the intended thin-client boundary. The referenced Phase 1 parity and roadmap/implementation documents should be treated as follow-up documentation gaps if they remain absent; this packet does not invent or recreate them.

## Reusable assets

- `lib/braincore-client.ts` for timeout, error, and response handling.
- `lib/braincore-schemas.ts` for runtime validation, extended with projection-envelope schemas in a later implementation packet.
- TanStack Query for cache, polling, stale state, and invalidation.
- Existing cards, status badges, tables, pagination, and responsive shell.
- Existing read-only Infinite Brain status/proposal rendering where its route contracts remain intentionally supported.
- Existing approval and mutation controls, which must remain behind their current Brain Core authorization routes and must not be replaced by projection reads.

## Outdated or disconnected elements

- The Infinite Brain dashboard is status-centric and does not expose the unified review, intelligence, calibration, learning, evolution, promotion, transaction, or receipt projections.
- The Console has no shared projection-envelope parser or common freshness/availability renderer.
- `InfiniteBrainProposalReview` is a very large mixed read/mutation surface; it should not be refactored broadly during the first projection integration.
- Mind maintenance data requires a client-provided `NEXT_PUBLIC_MIND_ROOT`, which is a separate operational dependency from the new Brain Core projections.
- Several page surfaces are provider/infrastructure-specific and are not part of Infinite Brain projection migration.

## Authority alignment

- **Brain Core:** API boundary, evidence/workflow projections, validation, and action safety.
- **Brain Console:** presentation, bounded read queries, and user-initiated requests through Brain Core.
- **Mind:** meaning, importance, priorities, and strategic decisions.
- **Obsidian Brain Console:** primary human cockpit and Decision Center.
- **Console web app:** optional specialist browser surface; not a memory store, decision authority, or bypass around Brain Core.

No new authority, storage, dashboard system, or direct repository reader is warranted.
