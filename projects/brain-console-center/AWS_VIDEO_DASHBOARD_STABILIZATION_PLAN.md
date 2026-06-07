# AWS Video Dashboard Stabilization Plan

## North star

The Brain Console Center must stay lean, modular, maintainable, and view-independent. The AWS Video view must not become a monolithic dashboard or affect unrelated Brain Console Center views. It must consume standardized modules and expose a clear operator workflow without flicker, contradictory state, or hidden legacy fallbacks.

The AWS Video operator UI must satisfy this invariant:

> Given a selected `JOB_ID` whose `/api/video-orchestrator/jobs/:jobId/control-plane` response says `allowedActions.approve_review.enabled === true`, the Review UI must show that job and enable Approve Review even if `/jobs/recent`, `/execution`, `/artifacts`, and `/review` are loading, empty, stale, or timed out.

## Facts observed

1. The backend control-plane can return a valid ready-to-publish state with complete review media, empty `missingRequirements`, and `allowedActions.approve_review.enabled === true`.
2. The UI has still shown loading, unavailable, or disabled Review state while the backend control-plane was valid.
3. The dashboard component has accumulated multiple state authorities: selected job state, recent jobs list state, legacy job/artifacts/execution/review queries, control-plane data, timeout-monitor state, and local view state.
4. Typecheck and backend endpoint tests are not enough to prove the UI is stable; the defect is a rendered-state consistency defect.
5. `/jobs/recent` must not clear, replace, or invalidate the currently selected job.
6. Legacy endpoints may exist for debugging, but they must not drive primary UI state or action gating.
7. Hydration must render the same initial text on server and first client render; browser-only persisted selection must be applied after mount without causing mismatch.

## Surgical stabilization sequence

### Phase 1 — selected job and hydration safety

Goal: one stable selected-job identity.

Requirements:
- Introduce or isolate a small selected-job store/hook for AWS Video.
- Do not derive the active selected job from `jobList.find(...)` for primary rendering.
- `/jobs/recent` may provide an initial default only after client mount.
- Persist selected job in `sessionStorage` only after mount.
- Initial server render and first client render must match.
- Never render different selected-job text during hydration.

Acceptance:
- No Next.js hydration warning at `/aws-video`.
- Refreshing the page keeps the selected job after mount.
- A `/jobs/recent` timeout does not blank the selected job card.

### Phase 2 — effective control-plane snapshot

Goal: one authoritative read model for primary UI.

Requirements:
- Create a small AWS Video view-model module/hook that returns `effectiveControlPlaneData`.
- It must keep the last known good snapshot per job ID.
- It must never replace a valid snapshot with loading, empty, stale, or different-job data.
- It must expose explicit states: `idle`, `loading`, `available`, `stale`, `error`.
- Primary UI must consume this hook, not raw query fragments.

Acceptance:
- If control-plane once returns complete media for a job, the Review UI does not flicker back to missing/unavailable during refetch.
- Execution and Artifacts panels show structured state, not `{}` or blank placeholders.

### Phase 3 — remove legacy state from primary rendering

Goal: legacy queries cannot contradict the control-plane.

Requirements:
- Legacy `/job`, `/review`, `/execution`, `/artifacts` queries may remain only inside explicitly labeled debug components.
- Primary selected-job card, pipeline steps, Review, Publish, Execution, Artifacts, and action buttons must use `effectiveControlPlaneData` only.
- Delete fallback reconstruction chains from legacy query data for primary UI.

Acceptance:
- `allowedActions.approve_review.enabled === true` enables Approve Review unless the mutation itself is running.
- Missing-field banners are based only on control-plane `missingRequirements` or control-plane finalization state.

### Phase 4 — split the AWS Video dashboard into modules

Goal: prevent the AWS Video view from becoming another monolith.

Suggested module boundaries:
- `components/aws-video/aws-video-dashboard.tsx` — composition only.
- `components/aws-video/use-aws-video-selection.ts` — selected-job identity and persistence.
- `components/aws-video/use-aws-video-control-plane.ts` — effective snapshot/query state.
- `components/aws-video/aws-video-workflow.tsx` — 8-step workflow display.
- `components/aws-video/aws-video-selected-job.tsx` — selected job card.
- `components/aws-video/aws-video-review.tsx` — review UI.
- `components/aws-video/aws-video-publish.tsx` — publish UI.
- `components/aws-video/aws-video-debug-panels.tsx` — legacy/debug-only panels.
- `components/aws-video/aws-video-actions.ts` — action helpers and mutation invalidation rules.

Acceptance:
- The current large AWS Video component is reduced, with view-model logic moved into small modules.
- Other Brain Console Center views are untouched.

### Phase 5 — UI regression coverage

Goal: prevent repeated regressions.

Required tests:
- Hydration-safe initial render: no selected job text mismatch.
- Selected job remains stable when recent jobs returns empty or times out.
- Last good control-plane snapshot remains visible during refetch.
- Approve Review enables when control-plane says enabled, even if legacy endpoints are empty.
- Finalization pending shows amber, not red missing-fields.
- Execution/artifacts never render `{}` in primary panels.

## Non-goals for this stabilization

- Do not add new video-generation features.
- Do not add EventBridge or Step Functions architecture changes yet.
- Do not redesign the entire Brain Console Center.
- Do not touch unrelated views.
- Do not hide real backend failures.
- Do not replace the current tech stack as part of this slice.

## Definition of done

The AWS Video UI is stable when a selected job has a valid control-plane response. It does not flicker to no-data, does not disable actions contradicted by control-plane, does not show hydration errors, and does not depend on legacy endpoint timing for primary rendering.
