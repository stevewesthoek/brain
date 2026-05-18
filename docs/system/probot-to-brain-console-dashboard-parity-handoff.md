# ProBot to Brain Console dashboard parity handoff

Date: 2026-05-18

## Goal

Move ProBot dashboard value into the Obsidian Brain Console so ProBot can become a legacy/thin client and Brain Console becomes the primary human cockpit.

## Scope approved in this pass

- Dashboard parity and migration visibility.
- Brain Core read-only APIs for parity status.
- Brain Console type contract for parity data; visible card wiring remains the next slice.
- No controlled-execution runtime work.
- No ProBot decommission.
- No secret, OAuth, Stripe, or financial data exposure.
- No direct shell execution or mutation controls from Brain Console.

## ProBot dashboard tabs inventoried

- Overview.
- Local Apps.
- Production Pipeline.
- Video Orchestrator Studio.
- Viral Flow.
- Stripe.
- Session History.
- System Updates.

## First implementation slice

Implemented a read-only Brain Core parity inventory endpoint:

- `GET /probot/dashboard-parity`

Implemented files:

- `projects/brain-core/src/adapters/probot-dashboard-parity.ts`
- `projects/brain-core/src/types/api.ts`
- `projects/brain-core/src/api/routes.ts`
- `projects/brain-core/src/tests/live-status-endpoints.test.ts`
- `projects/brain-console-obsidian/src/client.ts` (type contract only)

The endpoint reports each ProBot dashboard tab, its Brain Console target section, migration decision, status, priority, related Brain Core endpoints, and safety status.

## Safety status

- Read-only only.
- No POST route added.
- No secrets exposed.
- No financial data exposed.
- Stripe is explicitly marked legacy/admin-only and not visible in Brain Console.
- No mutation controls enabled.
- No direct shell execution enabled.
- No file writes.
- No Mind writes.

## Validation

- Brain Core CI: passed, 322 tests passing.
- Brain Console typecheck: passed.

## Second implementation slice

Implemented visible Brain Console ProBot parity card:

- Added `readBrainCoreProBotDashboardParity()` reader in `projects/brain-console-obsidian/src/view.ts`.
- Added `renderProBotDashboardParityCard()` to display parity status in the Overview tab.
- Card displays: total tabs (8), visible count, working count, partial count, legacy-only count, blocker count.
- Card lists all ProBot tabs with their Brain Console target section, migration status (available/partial/legacy-only), and implementation decision (keep/redesign/admin-only).
- Card shows per-tab: status, decision, visibility in Brain Console, whether working.
- Safety label: "Read-only · No secrets · No mutation controls · No direct shell execution"

Implemented files:

- `projects/brain-console-obsidian/src/view.ts` (visible card + reader)
- `docs/system/probot-to-brain-console-dashboard-parity-handoff.md` (this file)

## Validation

- Brain Core CI: 322 tests passing.
- Brain Console typecheck: passed.
- Brain Console build: passed, main.js bundled (792.4kb).

## Safety status

All safety boundaries maintained:
- Read-only only (no POST routes).
- No secrets, OAuth tokens, or credentials exposed.
- No Stripe financial data exposed.
- No mutation controls.
- No shell execution.
- No file writes.
- No Mind writes.
- No platform API writes.
- No STB mutation.
- No Video execution.
- No ProBot decommission.

## Third implementation slice: BrainOS Obsidian Native UX Stabilization

### Problem Statement

Critical usability issues identified:
- Buttons required 4–5 clicks before reacting
- Some buttons did not work
- Right side cut off
- Layout non-native
- Not responsive in narrow sidebars
- Stale state after service restart
- Refresh unreliable

### Root Causes

1. Tab switching reloaded all 80+ Brain Core endpoints
2. No state caching between tab switches
3. Full DOM re-render on every click
4. No loading indicators or disabled states
5. Hard-coded `max-width: 1400px` shell
6. Fixed `120px` columns, missing `min-width: 0` on grid cells
7. 1.4rem logo, dense layout

### Changes Implemented

**projects/brain-console-obsidian/src/main.ts**
- Added `cachedState` to preserve data between tabs
- Added `isRefreshing` flag to prevent duplicate calls
- Split into `fullRefresh()` (all endpoints) and `rerenderWithCachedState()` (instant)
- Tab click now calls `rerenderWithCachedState()` instead of `fullRefresh()`
- Manual refresh button shows loading state, is disabled, displays timestamp

**projects/brain-console-obsidian/styles.css**
- Container: `max-width: 100%`, full responsive width
- Cards/grids: Added `min-width: 0` to prevent overflow
- Text wrapping: `word-break: break-word`, `overflow-wrap: break-word`
- Command bar: Compact sizing for narrow panes
- Logo: 1rem (down from 1.4rem)
- Tabs: Added scroll on narrow screens
- Dashboard grid: `minmax(200px, 1fr)`, single-column <400px
- Rows: `minmax(80px, auto)`, single-column <400px

### Validation

- Brain Console typecheck: passed
- Brain Console build: passed

### How It Works Now

**Tab Switching:**
- User clicks tab → instant switch using cached data (no network call)
- Perceived lag eliminated

**Refresh:**
- User clicks "Manual refresh" → button disables, shows "Refreshing..."
- Fetches all Brain Core endpoints
- Re-renders with new data
- Button re-enables, shows timestamp

**Offline Recovery:**
- If offline: clean offline state shown
- Manual refresh retries without closing pane
- Partial data shown if some endpoints fail
- Old data visible with warning if refresh fails

**Layout:**
- Responsive on <280px wide sidebars
- Text wraps, no clipping
- Cards adapt with `auto-fit`
- Tabs scroll if needed
- ProBot parity card remains visible and responsive

## Fourth Implementation Slice: Obsidian Native UX Stabilization (2026-05-18)

Completed comprehensive stabilization after user feedback identified critical usability issues:

- **Slice A:** Visible build marker for installation verification
- **Slice B:** Native Obsidian CSS theme replacing cockpit dark UI
- **Slice C:** One-click tab switching using cached state (instant, no network reload)
- **Slice D:** Refresh/offline recovery with heartbeat detection
- **Slice E:** Endpoint failure tolerance (Promise.allSettled prevents crashes)
- **Slice F:** ProBot migration card made prominent (full-width, accent border)
- **Slice G:** Comprehensive documentation and recovery runbook

**Root cause of poor UX:** All 90+ endpoints loaded on every tab click (Promise.all), causing 2-3 second delays. Fixed with state caching.

**Validation:** TypeScript ✓ Build ✓ Package ✓ Brain Core CI skipped (no changes)

**Safety:** All boundaries maintained. Read-only only. Heartbeat is read-only GET (20s interval).

See: `docs/system/brain-console-obsidian-native-ux-stabilization.md` for full implementation details, recovery runbook, and API reference.

### Remaining Polish (Future)

1. Skeleton state while refreshing
2. Endpoint failure details in diagnostics
3. Persist last-used tab in settings
4. Keyboard navigation
5. Theme switching
6. True lazy-loading (per-tab endpoint loads)

## Next Safe Tasks (Resume After Stabilization)

1. Add read-only ProBot workflow queue summary if safe source data exists (low-risk).
2. Add read-only Video Orchestrator account health parity without tokens/OAuth/secrets.
3. Add read-only system update availability summary without execution controls.
4. Add read-only Stripe account parity (metadata only, no API keys or financial data).
5. Keep ProBot as legacy/thin client until every keep/redesign tab has Brain Console parity and explicit decommission approval exists.
