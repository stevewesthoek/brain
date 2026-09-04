# Brain Console 2 Command Center UX/UI compactness

Date: 2026-09-04
Scope: existing `/command-center` route and the shared shell only. No LaunchAgent, scheduler, Core, or legacy route changes.

## Before

The live baseline at `http://127.0.0.1:4881/command-center` used a large page heading, four separate KPI cards, content-sized panels in a growing two-column layout, and an expanded attention list. The live page exceeded both target desktop viewports.

| Viewport | scrollHeight | clientHeight | Result |
| --- | ---: | ---: | --- |
| 1440x900 | 1475 | 900 | vertical scroll |
| 1512x982 | 1447 | 982 | vertical scroll |

Baseline screenshots were captured from the live application before the UI change:

- [Before 1440x900](./evidence/brain-console-2-command-center-ux-ui-2026-09-04/before-1440x900.png)
- [Before 1512x982](./evidence/brain-console-2-command-center-ux-ui-2026-09-04/before-1512x982.png)

## After

The route now uses a compact status strip, a bounded two-row operational grid, content-sized empty states, compact disclosure rows for secondary detail, linked domain posture rows, and a collapsed runtime identity disclosure. The shell is compact only for Command Center; all existing navigation routes remain present.

| Viewport | scrollHeight | clientHeight | horizontal dimensions | Result |
| --- | ---: | ---: | --- | --- |
| 1440x900 | 900 | 900 | 1440 / 1440 | no page scroll |
| 1512x982 | 982 | 982 | 1512 / 1512 | no page scroll |

After screenshots were captured from a production build on port 4982 using the live Brain Core read model:

- [After 1440x900](./evidence/brain-console-2-command-center-ux-ui-2026-09-04/after-1440x900.png)
- [After 1512x982](./evidence/brain-console-2-command-center-ux-ui-2026-09-04/after-1512x982.png)

## Performance and request behavior

- Primary snapshot query: one `useQuery` in `CommandCenter`.
- Initial operational snapshot requests: 1.
- Manual refresh operational snapshot requests: 1.
- Refresh interval: 10 seconds while visible; React Query background refetch is disabled.
- Snapshot payload measured from Brain Core: 27,395 bytes.
- Snapshot response measured locally: 220 ms total curl time during acceptance.
- Command Center route bundle: 4.27 kB.
- Command Center first load JS: 150 kB.
- Shared first load JS: 102 kB.
- Duplicate equivalent polling: No. The shell's separate 5-second `/status` check remains the Core availability signal used by the global shell; the Command Center uses one `/operational-snapshot` read-model request per refresh cycle.
- No giant history payload or widget-level snapshot fetch was added.

## Visible functionality verified

- Overall Brain state, attention count, active count, runtime matching, scheduler posture, freshness, and read-only safety state are visible above the fold.
- Attention shows the first three bounded items and exposes the remainder through `+ N more` disclosure.
- Attention rows expand to show explanation, source, entity reference, and safe next action.
- Active work rows use the same disclosure pattern; the real empty state is preserved.
- Recent activity remains a bounded list and reports the current unavailable/empty source truthfully.
- Domain posture links to existing Brain, Infrastructure, Scheduler, and AI Models routes.
- Runtime source/deployment revision detail is available behind disclosure.
- Refresh preserves the last valid snapshot while fetching.
- Loading, unavailable, refresh-error, and partial-snapshot states remain implemented.
- Browser interaction checks passed: 15 navigation links present, refresh triggered one snapshot request, disclosure opened, theme toggle changed theme, and keyboard focus remained on a button after tab navigation.
- No dead visible controls were introduced.

## Legacy route smoke test

The existing routes remain in the shell and build output: `/`, `/ai-models`, `/local-apps`, `/infrastructure`, `/dokploy`, `/monitoring`, `/tunnels`, `/scheduler`, `/video-analyzer`, `/aws-video`, and `/settings`. They were not renamed or removed.

## Files changed

- `projects/brain-console/components/command-center.tsx`
- `projects/brain-console/components/shell.tsx`
- `projects/brain-console/app/globals.css`
- `operations/reports/brain-console-2-command-center-ux-ui-compactness-2026-09-04.md`
- `operations/reports/evidence/brain-console-2-command-center-ux-ui-2026-09-04/`

## Validation

- `npm run test:command-center`: 1 passed.
- `npm run test:telemetry`: 3 passed.
- `npm run typecheck`: passed.
- `npm run build`: passed. Existing autoprefixer warning at `globals.css:510` remains outside this scoped UI change.
- `git diff --check`: passed.
- Browser visual and interaction QA: passed at 1440x900 and 1512x982.

## Remaining product gaps

This change proves the Command Center cockpit only. The broader Brain Console 2.0 product still has future work for the command palette, richer detail routes/drawers, activity filtering, personalized density/collapse preferences, and the remaining domain-specific modernization. Legacy pages remain compatibility surfaces.

## Live revision

The exact integrated revision and live identity are recorded in the final deployment verification and the Brain Core `/runtime/identity` response after deployment. The runtime must report the same source and deployment revision as `origin/main`.
