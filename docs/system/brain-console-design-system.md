# Brain Console Design System

**Status:** active UI contract  
**Dashboard:** `projects/brain-console`  
**Primary reference:** shadcnblocks admin-dashboard style  
**UI stack:** Next.js, React, TypeScript, Tailwind-style CSS, shadcn/ui conventions, TanStack Query, Zod

## Purpose

Brain Console is an operational dashboard. Its UI must optimize for dense, readable control surfaces rather than marketing-page scale.

The design direction is based on the shadcnblocks admin dashboard pattern:

- persistent left navigation
- compact top status bar
- page-level tabs/subviews
- card grids with bounded content
- clear muted borders and grey surfaces
- small, readable operational typography
- no uncontrolled vertical stacking of operational cards

## Non-negotiable layout rules

1. **No overlap**
   - Cards, buttons, badges, labels, tabs, and pager controls must never overlap.
   - If content is too long, clamp it with ellipsis or line-clamp.
   - Do not hide action buttons behind viewport constraints.

2. **Paged operational grids**
   - Dense operational lists should use paging, tabs, filters, or tables.
   - Do not render all local applications as one long vertical card stack.
   - The Local Apps view uses a paged grid so operators navigate by clicking pages, not by dragging through cards.

3. **Desktop first, mobile safe**
   - On normal laptop fullscreen width, Local Apps should show a complete page with visible buttons and pager.
   - On smaller screens, the layout may stack vertically, but it must remain readable and navigable.
   - Mobile layout may scroll; desktop/laptop operational view should avoid unnecessary scroll.

4. **Use shadcn-style density**
   - Use subtle borders, muted panels, compact headings, and standard button/card spacing.
   - Avoid oversized hero typography inside operational views.
   - Avoid giant metric/card blocks unless the page is specifically an overview page.

5. **Use tabs for alternate views**
   - Each menu item may contain tabs/subviews.
   - Local Apps uses `Apps`, `Actions`, and `Policy` tabs.
   - AWS Video uses subviews for pipeline/job/publish/activity workflows.

6. **Data typography**
   - Use `JetBrainsMono Nerd Font`, falling back to `JetBrains Mono` and system monospace, for ports, ids, JSON, logs, code blocks, and raw operational data.
   - Use the normal interface font for labels, headings, buttons, and navigation.

7. **Brain Core is the boundary**
   - The UI never executes shell commands.
   - The UI only calls Brain Core API endpoints.
   - Lifecycle guarantees belong in Brain Core, not in browser code.

## Local Apps layout contract

The Local Apps page is the most frequently used operational surface and must remain stable.

Desktop/laptop layout:

```text
Header
Tabs
Summary strip
2 x 2 app card grid
Horizontal pager
```

Current contract:

```text
4 apps per page
2 columns x 2 rows on desktop
running apps sorted first
page controls below the grid
card action buttons always visible
no vertical card stack on laptop fullscreen
```

Each card must show:

- app label/name
- canonical app id
- lifecycle status badge
- ports
- infrastructure summary, including database/container metadata when available
- health
- short description
- Open button
- Start/Restart button
- Stop button

If the backend returns duplicate app ids, the frontend deduplicates by canonical app id before rendering. Brain Core should still avoid duplicates at the source.

## Responsive fallback

When there is not enough horizontal room:

- desktop 2x2 grid may fall back to one column
- summary strip may wrap
- sidebar may collapse labels and keep icons visible
- cards may stack vertically on mobile only
- pager remains available

## Data freshness and action feedback

Every operational surface should expose freshness or status state:

- online/offline topbar state
- section-level stale/error state
- per-card local action status
- spinner or working label during start/restart/stop
- refresh controls where useful

Local Apps merges local mutation state with Brain Core `/local-apps/actions/status` so cards can show immediate feedback while an action is running.

## Implementation notes

Important files:

```text
projects/brain-console/components/shell.tsx
projects/brain-console/components/local-apps-dashboard.tsx
projects/brain-console/app/globals.css
projects/brain-console/lib/braincore-schemas.ts
```

Validation:

```bash
cd projects/brain-console
npm run typecheck
npm run build

cd ../brain-core
npm run typecheck
```

## Change policy

Before changing Brain Console UI:

1. Read this document.
2. Keep the shadcnblocks admin-dashboard density model.
3. Preserve the no-overlap contract.
4. Preserve Brain Core as the only operational data/action boundary.
5. Run typecheck/build validation before committing.
