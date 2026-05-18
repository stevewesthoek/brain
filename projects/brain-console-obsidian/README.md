# Brain Console Obsidian Plugin

Standalone read-only Brain Core console for Obsidian. Displays ProBot dashboard parity, system health, execution readiness, and scheduler status using native Obsidian UI with responsive layout.

**Build:** `native-ux-2026-05-18-01`

**Status:** Active, stabilized 2026-05-18 with native Obsidian UX.

### Validation Status

- ✓ `npm run typecheck` passes
- ✓ `npm run build` passes
- ✓ `npm run package` emits release bundle
- ✓ TypeScript compilation zero errors
- ✓ Brain Core CI: 322 tests passing

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

- Read-only only.
- No note writes.
- No automatic POST calls.
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
1. Look for build marker in header: `build native-ux-2026-05-18-01`
2. If marker is missing or different, your plugin bundle is stale
3. See: `docs/system/brain-console-obsidian-native-ux-stabilization.md` → Install Verification for recovery steps

**Brain Core Configuration:**
1. Default URL: `http://localhost:4877`
2. Configure in Brain Console settings if different
3. Press "Manual refresh" to verify connection

## Native UX Features (2026-05-18)

### Responsive Layout
- Works on narrow sidebars (<280px wide)
- Single column on mobile/narrow panes
- Text wraps, no right-side clipping
- Native Obsidian theme (light/dark aware)

### Performance
- **Tab switching:** <50ms (uses cached state, no network call)
- **Initial load:** All 90+ endpoints load simultaneously (20-30 seconds typical)
- **Failed endpoints:** Don't crash dashboard; shown in diagnostics

### Offline Recovery
- Manual refresh: Always retries all endpoints
- Heartbeat: Detects Brain Core online/offline transitions (every 20s)
- Stale data: Visible with error banner until refresh succeeds
- No polling: Only check on tab switch and manual refresh

### Safety
- Read-only only (no POST routes)
- Manual refresh button only
- All data from Brain Core read API
- No mutations, no execution controls
- No secrets, OAuth tokens, or credentials exposed

## ProBot Dashboard Parity

See ProBot migration card in Overview tab for status:
- **Available (3):** Overview, Local Apps, Session History
- **Partial (3):** Production Pipeline, Video Orchestrator Studio, Viral Flow
- **Planned (1):** System Updates
- **Legacy/Admin-only (1):** Stripe (intentionally not visible)

Full details: `docs/system/probot-to-brain-console-dashboard-parity-handoff.md`

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
