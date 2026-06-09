# Brain Console Architecture

**Status:** active implementation reference  
**Dashboard:** `projects/brain-console`  
**Primary UI pattern:** shadcn/shadcnblocks-style admin dashboard  
**Backend boundary:** Brain Core API only  
**Default port:** `4881`  
**Brain Core default:** `http://localhost:4877`

## Canonical role

Brain Console is the single leading operations dashboard for the Brain repo.

Legacy dashboards are reference-only:

New dashboard feature work belongs in Brain Console and must be backed by Brain Core API contracts.

## Tech stack

Brain Console uses:

- Next.js App Router
- React
- TypeScript
- TanStack Query for auto-refreshing API state
- Zod for runtime API response validation
- Lucide icons
- shadcn/shadcnblocks-style layout primitives
- CSS variables and utility-style class composition

The browser must never run shell commands. Operational actions must go through Brain Core.

## Design reference

Use the shadcnblocks admin dashboard pattern as the visual reference:

```text
https://shadcnblocks-admin.vercel.app/ecommerce/dashboard-1
```

The intended style is:

- compact admin dashboard density
- clear left navigation
- calm dark cards
- tabbed views inside major sections
- small badges
- strong alignment
- fixed gutters
- no overlapping text, buttons, panes, cards, or pagination controls

Do not build long vertical dashboards when a tabbed or paged view is more appropriate.

## Layout rules

All Brain Console pages must follow these rules:

1. **No accidental overlap**
   - Cards may not cover pagination.
   - Buttons may not overflow cards.
   - Labels may not overlap badges.
   - Sidebar brand text may not squash the logo.

2. **Use page-local tabs for dense sections**
   - Prefer tabs for alternate views inside a menu item.
   - Example: Local Apps uses `Apps`, `Actions`, and `Policy` tabs.

3. **Use pagination for dense grids**
   - Dense operational grids should use explicit page controls.
   - Do not require dragging through a long card stack on desktop.

4. **Constrain cards**
   - Cards need deterministic header, metadata, body, and action rows.
   - Action buttons should stay visible inside the card.

5. **Responsive behavior**
   - Desktop/laptop: use compact multi-column grids.
   - Tablet: reduce columns.
   - Mobile: stack cards and allow vertical flow.
   - Mobile must remain usable, but desktop must not require scrolling just to find card actions.

6. **Typography**
   - UI labels should be compact and readable.
   - Code, IDs, logs, ports, and generated data should use:

```text
JetBrainsMono Nerd Font, JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace
```

## Local Apps layout contract

The Local Apps view is intentionally page-based.

Desktop/laptop behavior:

- 4 apps per page
- 2 columns × 2 rows
- horizontal pager below the grid
- running apps sorted first
- no vertical card stack in the main desktop view
- Open, Start/Restart, and Stop buttons visible inside every card

Responsive behavior:

- under narrower breakpoints, the grid can reduce to one column
- mobile may scroll vertically, but card contents still cannot overlap

The Local Apps page uses Brain Core endpoints only:

```text
GET  /local-apps/dashboard
GET  /local-apps/action-readiness
GET  /local-apps/actions/status
POST /local-apps/:id/start
POST /local-apps/:id/stop
POST /local-apps/:id/restart
```

## Operational lifecycle boundary

Brain Core owns lifecycle safety:

- per-app action locks
- start/restart/stop execution
- stale port handling
- service port verification
- database/container phase handling where modeled
- action readiness and action result reporting

Brain Console only renders the state and invokes Brain Core actions.

## Validation

Before marking any Brain Console change complete, run:

```bash
cd projects/brain-core
npm run typecheck

cd ../brain-console
npm run typecheck
npm run build
```

A UI-only change may skip Brain Core typecheck only when it does not touch Brain Core schemas, API contracts, registry data, or operational docs.

## Documentation index

Related docs:

- `docs/system/brain-console-roadmap.md`
- `docs/system/brain-console-design-system.md`
- `docs/system/brain-console-implementation-plan.md`
- `docs/system/brain-console-phase-1-parity-checklist.md`
- `docs/system/brain-console-local-apps-hardening.md`
- `operations/runbooks/brain-console-manual-qa.md`
