# Brain Console Obsidian Plugin

Standalone Brain Core console for Obsidian. Opens as a main-workspace dashboard tab and displays ProBot dashboard parity, system health, execution readiness, scheduler status, and controlled Local Apps operations using native Obsidian UI with responsive layout.

**Build:** `brain-console-local-apps-action-stability-2026-05-19-01`

**Status:** Active, gap-closure phase 2026-05-19 with ProBot decommission readiness tracking (10 cards: 7 parity + 3 gap-closure: external admin safe metadata, feature parity matrix, phase-out checklist).

### Validation Status

- ✓ `npm run typecheck` passes
- ✓ `npm run build` passes
- ✓ `npm run package` emits release bundle
- ✓ TypeScript compilation zero errors
- ✓ Brain Core CI: passes with local-apps orchestrator/dashboard coverage
- ✓ `npm run release:install` builds, packages, installs to every discovered vault copy, and verifies markers

## Intended structure

```text
projects/brain-console-obsidian/
├── .codex-plugin/plugin.json
├── manifest.json
├── package.json
├── src/
│   ├── client.ts
│   ├── main.ts
│   ├── settings.ts
│   └── view.ts
├── styles.css
└── tsconfig.json
```

## Safety boundaries

- Dashboard reads are read-only by default.
- No note writes.
- Local Apps Start/Stop/Restart buttons may POST only to canonical Brain Core local-app action endpoints after user confirmation.
- No secrets in settings.
- No installation into `mind/.obsidian/plugins/` until explicitly approved.
- Manual refresh only.
- Offline state is shown when Brain Core is unavailable.
- Runtime reports and capabilities are read from Brain Core, not copied into Mind notes.
- Runtime reports include the read-only `local-apps` and `video` summaries generated under `runtime/local/`.
- The read-only approval gate view includes approval store health when Brain Core exposes `/approvals/store`.
- The read-only execution readiness view includes `/execution/plans` and `/execution/readiness`, with `scheduler-run-model-router-dry-run` as the first future candidate and execution still disabled.
- **2026-05-18 live verified:** Approval store and audit log surfaces are operational and read-only.
- **2026-05-18 live verified:** Execution readiness view shows disabled state and no-execute behavior.
- Manual installation into `mind/.obsidian/plugins/` is required and should be approved separately.
- Manual install/test instructions live in `operations/runbooks/brain-console-manual-install-test.md`.

## Installation & Verification

### Build & Package

```bash
npm run --prefix projects/brain-console-obsidian build
npm run --prefix projects/brain-console-obsidian package
```

### Manual Install

1. Navigate to Obsidian vault `.obsidian/plugins/` folder
2. Create folder: `brain-console`
3. Copy from `projects/brain-console-obsidian/release/`:
   - `main.js`
   - `manifest.json`
   - `styles.css`
4. Reload Obsidian or restart
5. Enable "Brain Console" plugin in Settings → Community plugins

### Verify Installation

**In Brain Console:**
1. Look for build marker in header: `build brain-console-local-apps-action-stability-2026-05-19-01`
2. The dashboard header also shows `Build`, `View mode`, `Brain Core URL`, `Selected URL`, and connection state
3. If marker is missing or different, your plugin bundle is stale
4. See: `operations/runbooks/brain-console-manual-install-test.md` → Verify Installation for recovery steps
5. Verify the Apps tab shows a compact full-width app grid with Start/Stop/Restart controls on each app card

**Brain Core Configuration:**
1. Default URL: `http://localhost:4877`
2. Configure in Brain Console settings if different
3. Press "Manual refresh" to verify connection

## Local Apps Orchestrator

- Read-only dashboard payload: `GET /local-apps/dashboard`
- Controlled-action readiness payload: `GET /local-apps/action-readiness`
- Standard orchestration payload: `GET /local-apps/orchestrator`
- Onboarding checklist payload: `GET /local-apps/onboarding-checklist`
- Action plan payloads: `GET /local-apps/action-plans` and `GET /local-apps/:id/action-plan/:action`
- Action status payload: `GET /local-apps/actions/status`
- Controlled action endpoints: `POST /local-apps/:id/start`, `POST /local-apps/:id/stop`, `POST /local-apps/:id/restart`
- Brain Console never executes shell. Buttons call Brain Core only, with canonical app ids and fixed action names.
- Unsupported apps return structured `not_executable` results until a safe per-app execution strategy is registered.
- Buttons are enabled per app/action only when Brain Core reports that specific action is executable.
- Brain Core action routes catch failures and return structured JSON with `commandOverrideAccepted: false`.
- Release/install command: `npm run --prefix projects/brain-console-obsidian release:install`
- Model Router is surfaced from Brain Core runtime-report sources even though it is not registered in `operations/infrastructure/local-apps.json`.

## Native UX Features (2026-05-19 with ProBot Functional Parity Polish)

### Responsive Layout
- Opens in the main workspace as a normal tab by default
- Ribbon icon reopens a fresh dashboard view
- Responsive full-width layout with wider cards
- Text wraps, no right-side clipping
- Native Obsidian theme (light/dark aware)
- ProBot Migration section with dedicated header and subtitle
- Apps tab now uses a full-width compact app grid instead of the general three-column dashboard layout
- Local Apps section reads dedicated dashboard/readiness/orchestrator payloads and wires controls to Brain Core controlled action endpoints

### Performance
- **Tab switching:** <50ms (uses cached state, no network call)
- **Initial load:** All 96+ endpoints load simultaneously (20-30 seconds typical)
- **Failed endpoints:** Don't crash dashboard; shown in diagnostics
- **ProBot parity cards:** 7 cards in dedicated Migration section with visual prominence, badge/stat styling, and clear safety labels

### Offline Recovery
- Manual refresh: Always retries all endpoints
- Heartbeat: Detects Brain Core online/offline transitions (every 20s)
- Stale data: Visible with error banner until refresh succeeds
- No polling: Only check on tab switch and manual refresh

### Safety
- Read-mostly dashboard with constrained Local Apps POST actions only
- Manual refresh button only
- All data from Brain Core read API
- No shell execution in the Obsidian plugin
- No arbitrary command input
- No secrets, OAuth tokens, or credentials exposed

## ProBot Dashboard Parity (2026-05-19 Functional Parity Polish Phase)

Overview tab now includes **ProBot Migration** section with 7 dedicated cards and clear section header:

### Available (Fully Migrated)
1. **Sessions & Continuations** — Visible and working in Brain Console Overview
2. **Local Apps** — Visible and working in Brain Console Apps section
3. **Scheduler** — Visible and working in Brain Console Apps section  

### Partial (Ready/Pending)
4. **Studio (Video/Viral Flow)** — Video Orchestrator ready, Viral Flow marked for redesign to use Brain Post Orchestrator

### Legacy/Admin-only (Intentional, No Safe Data)
5. **External Integrations** — Dokploy, New Relic, Analytics, Google Ads, Stripe, Domains, Tunnels (all intentionally admin-only, no safe metadata endpoints available)
   - ⚠ Clear warning: "All integrations are intentionally admin-only (no safe data available)"
   - No credentials, secrets, OAuth tokens, or Stripe financial data exposed

### Decommission Status
6. **ProBot Decommission Readiness** — ✗ NOT READY (6/9 criteria satisfied, 3 require explicit user approval)

### Command Center
7. **ProBot → Brain Console Parity: Command Center** — Overall migration status, feature inventory, safety compliance

**Design Notes:**
- Visually prominent section with dedicated header and subtitle
- Each card has status badges, stat grids, and feature lists
- Safety labels on every card (read-only, no execution controls, no mutations)
- Narrow-pane friendly with min-width: 0 and word-wrapping
- No right-side clipping
- Obsidian CSS variables for theme compatibility

## Settings

- **Brain Core URL:** Read-only endpoint (default: `http://localhost:4877`)
- **Manual refresh only:** Click button to reload all endpoints
- **No automatic refresh:** No background polling or auto-refresh

## Troubleshooting

**Build marker is missing or outdated:**
- Plugin bundle is stale
- Uninstall plugin folder from Obsidian vault
- Rebuild and repackage (run commands above)
- Reinstall into Obsidian
- Restart Obsidian

**Reliable release/install flow:**
```bash
npm run --prefix projects/brain-console-obsidian release:install
```

**Tab switching is slow:**
- Check Brain Core health: `curl http://localhost:4877/status`
- Check network connectivity in Obsidian console (Ctrl+Shift+I)
- Click "Manual refresh" to verify endpoint response time

**Brain Core is offline:**
- Dashboard shows offline banner
- Last cached data remains visible
- Start Brain Core: `cd projects/brain-core && npm start`
- Click "Manual refresh" to retry connection

**Specific endpoint fails:**
- Check Obsidian console for network errors
- Brain Core may have crashed or restarted
- Manual refresh will retry; partial data shown in diagnostics

## Documentation

- **Native UX stabilization:** `docs/system/brain-console-obsidian-native-ux-stabilization.md`
- **ProBot parity handoff:** `docs/system/probot-to-brain-console-dashboard-parity-handoff.md`
- **Manual install/test runbook:** `operations/runbooks/brain-console-manual-install-test.md`

## Implementation Details

See `docs/system/brain-console-obsidian-native-ux-stabilization.md` for:
- Root cause analysis of prior UX issues
- Architecture: state caching, heartbeat, error handling
- API reference for developers
- Build marker constant and versioning
- Recovery procedures

## API Contract

All endpoints are read-only GET. No POST routes added. See `projects/brain-console-obsidian/src/client.ts` for endpoint type definitions.
