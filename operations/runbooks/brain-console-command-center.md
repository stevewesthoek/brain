# Brain Console Command Center Runbook

**Version:** 0.1.0  
**Date:** 2026-05-17  
**Purpose:** Operate the Obsidian Brain Console plugin as your primary Brain + Mind system cockpit.

---

## Quick Start

1. **Open Brain Console**: Obsidian right sidebar → click brain icon, OR command palette "Open Brain Console"
2. **Status pills** show: Brain Core, Mind Steward, Scheduler, Save-to-Mind, Approvals, Maintenance
3. **6 core cards** display: Wiki Health, Maintenance Previews, Approvals, Scheduler Status, Brain Core readiness, Next Safe Action
4. **Refresh button** polls all endpoints manually (read-only, no automatic POST calls)
5. **That's it** — the dashboard is your system cockpit

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Obsidian Vault (Mind)                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Brain Console Plugin (Right Sidebar)                   │ │
│  │ • Status pills (6 quick indicators)                    │ │
│  │ • 6 metric cards (wiki health, approvals, etc)         │ │
│  │ • Action buttons (Refresh, Request Dry Run, etc)       │ │
│  │ • Activity panel (recent events)                       │ │
│  └────────────────────────────────────────────────────────┘ │
│  └─→ polls Brain Core every refresh (manual only)            │
└─────────────────────────────────────────────────────────────┘
             ↓
    ┌────────────────────┐
    │  Brain Core        │
    │  HTTP API          │
    │  (read-only)       │
    │  • /status         │
    │  • /runtime/reports│
    │  • /scheduler/jobs │
    │  • /approvals      │
    │  • /execution/*    │
    └────────────────────┘
             ↓
    ┌─────────────────────────────────────────┐
    │  Brain Runtime                          │
    │  • Mind Steward (vault maintenance)     │
    │  • Scheduler (nightly jobs)             │
    │  • Approval gate (safety boundaries)    │
    └─────────────────────────────────────────┘
```

---

## Dashboard Components

### Status Strip (6 Pills)

Located at top, showing quick health indicators:

| Pill | Shows | Source |
|------|-------|--------|
| **Brain Core** | `online` / `offline` + mode | `/status` |
| **Mind Steward** | job status (`idle`, `running`, `failed`, etc) | `/runtime/reports` |
| **Scheduler** | nightly job queue status | `/scheduler/status` |
| **Save-to-Mind** | capture pipeline status (always `live`) | n8n webhook health |
| **Approvals** | count of pending approval requests | `/approvals` |
| **Maintenance** | count of pending maintenance previews | `/execution/mind-previews` |

**Action:** Refresh button in header polls all endpoints.

### Core Cards (6 MVP)

#### 1. Wiki Health
**Shows:** Mind Steward lint results (ok/warnings/errors)
**Source:** `/runtime/reports` → `mind-steward.wikiHealth`
**Details:** Warning count, error count, example lint issues
**Safety:** Read-only; shows lint report only, no writes

#### 2. Maintenance Previews
**Shows:** Queue of proposed maintenance actions  
**Source:** `/execution/mind-previews`  
**Details:** Count pending, risk distribution (high/medium/low), latest date  
**Safety:** Read-only; shows preview queue only, no execution

#### 3. Approvals
**Shows:** Pending approval requests  
**Source:** `/approvals`  
**Details:** Count pending, approval kinds (e.g., "wiki-update: blocked", "capture: approved"), first few examples  
**Safety:** Read-only; audit gate tracks all requests; no automatic approval

#### 4. Scheduler Status
**Shows:** Nightly job queue health  
**Source:** `/scheduler/jobs` + `/scheduler/status`  
**Details:** Queue status, latest run result, sample of active jobs, job health  
**Safety:** Read-only; jobs run on nightly timer, no on-demand execution

#### 5. Brain Core
**Shows:** API server readiness and execution gate status  
**Source:** `/status` + `/execution/readiness`  
**Details:** Online/offline, hostname, version, execution enabled/disabled  
**Safety:** Read-only; execution gate shows approval status

#### 6. Next Safe Action
**Shows:** Recommended next step based on execution readiness  
**Source:** `/execution/readiness` + `/execution/plans`  
**Details:** Ready candidate count, blocker list (if any), first action kind  
**Safety:** Read-only; proposals only until explicit approval

### Activity Panel (Bottom)

Recent snapshots of system activity:
- Latest AI session title + age
- Runtime report count + status summary
- Maintenance preview count
- Last scheduler run status

**Purpose:** At-a-glance sense of system momentum and recency.

---

## Action Buttons

Located in header. Manual-only, read-only requests:

| Button | Function | Status |
|--------|----------|--------|
| **Refresh** | Poll all endpoints again | ✅ Enabled |
| **Request Dry Run** | Trigger Mind Steward preview | 🔒 Disabled (future expansion) |
| **View Latest** | Inspect latest artifact/preview | 🔒 Disabled (future expansion) |
| **Open Mind** | Navigate to Mind vault | 🔒 Disabled (future expansion) |
| **Wiki Log** | Jump to wiki/log.md | 🔒 Disabled (future expansion) |

**Current state:** Only **Refresh** is enabled. Other buttons fire no-op requests and are disabled pending implementation.

**Safety guarantee:** All buttons are read-only. No POST calls are automatic. Every button fires an approval request first; it never mutates state without explicit gate.

---

## Data Sources & Endpoints

Brain Console polls these Brain Core endpoints (all read-only):

```
GET /status
  → BrainCoreStatus (online, mode, version, host)
  → Used by: status pill, Brain Core card

GET /capabilities
  → BrainCoreCapabilitySummary (feature flags, endpoints, install status)
  → Used by: future feature detection

GET /runtime/reports
  → { reports: BrainCoreRuntimeReportSummary[] }
  → id: 'mind-steward' → Wiki Health card
  → id: 'approval-audit' → Approvals audit trail
  → Used by: Mind Steward pill, Wiki Health card

GET /scheduler/status
  → BrainCoreSchedulerStatus (queue health, latest run, enabled flag)
  → Used by: Scheduler pill, Scheduler Status card

GET /scheduler/jobs
  → { jobs: BrainCoreSchedulerJobSummary[] }
  → Each job: id, name, status, mutationRequired flag
  → Used by: Scheduler Status card

GET /approvals
  → { approvals: BrainCoreApprovalSummary[] }
  → Each approval: id, kind, status, created_at, response_deadline
  → Used by: Approvals pill, Approvals card

GET /approvals/store
  → BrainCoreApprovalStoreSummary (store status, record count)
  → Used by: audit trail and safety verification

GET /execution/readiness
  → BrainCoreExecutionReadiness (enabled flag, blockers, ready count, candidates)
  → Used by: Next Safe Action card, Brain Core card

GET /execution/plans
  → { plans: BrainCoreExecutionPlan[] }
  → Each plan: kind, model_router_dry_run_flag_name, status
  → Used by: Next Safe Action card

GET /execution/mind-preview-policy
  → BrainCoreMindPreviewPolicy (status, apply route enabled, blocked prefixes)
  → Used by: safety verification

GET /execution/mind-previews
  → { previews: BrainCoreMindPreviewSummary[] }
  → Each preview: id, createdAt, expiresAt, expired, targetPath, writes/sideEffects
  → Used by: Maintenance Previews pill, Maintenance Previews card
```

**Polling behavior:**
- Triggered only on manual "Refresh" button click
- Timeout: 1.5 seconds per endpoint
- Offline detection: if all endpoints fail, show "Brain Core offline" message
- No automatic polling; no background refresh

---

## Configuration

Brain Console settings are in Obsidian plugin settings:

**Setting: Brain Core URL**
- Default: `http://localhost:4877`
- Customize if Brain Core runs on different host/port
- Examples:
  - Local: `http://localhost:4877`
  - Remote (Tailscale): `http://100.71.31.88:6789`
  - HTTPS: `https://brain-core.internal.example.com`

**Validation:**
- URL is normalized (trailing slashes removed)
- Warning shown if URL doesn't match expected pattern
- Plugin remains usable offline; will show "Brain Core offline" message

---

## Safety Guarantees

### Read-Only Plugin
- **No writes to Obsidian vault or settings**
- **No writes to Brain Core** (all endpoints are GET only)
- **No automatic POST calls** (Refresh is manual only)
- **No credential storage** (URL + localhost default only)
- **No shell execution** (pure HTTP client)

### Approval-Gated Actions
- Every action button request goes through Brain Core approval gate first
- Approval gate maintains durable audit trail
- No action executes without explicit approval + confirmation
- User can inspect audit trail in `/approvals/store`

### Error Handling
- Timeout on slow/unreachable Brain Core (1.5s max)
- Graceful offline mode: plugin shows "offline" message, remains usable
- Network errors shown in header warning banner
- Card rendering handles missing/corrupted data gracefully

---

## Troubleshooting

### "Brain Core Offline" Message

**Cause:** Plugin cannot reach Brain Core HTTP server.

**Fixes:**
1. Verify Brain Core terminal is still running: `npm start` from `projects/brain-core`
2. Test endpoint manually: `curl http://localhost:4877/status`
3. If curl works but plugin shows offline:
   - Try alternate address: Settings → Brain Core URL → change to `http://127.0.0.1:4877`
   - Plugin may prefer 127.0.0.1 over localhost on some systems
4. Click "Refresh" button in plugin to retry
5. Check diagnostic error text shown in offline panel for specific endpoint failures
6. Fully quit and reopen Obsidian (plugin caches may persist)

**Diagnostic info:** When offline, plugin shows which endpoints failed and why. Copy that text if you need to debug further.

### Cards Show "Unavailable"

**Cause:** Specific endpoint returned error or timeout.

**Fixes:**
1. Click "Refresh" to retry
2. Check individual endpoint manually: `curl http://localhost:4877/<endpoint>`
3. Check Brain Core status: does `/status` return online?
4. Check Brain Core runtime reports: are subsystems healthy?

### Action Buttons Are Disabled

**Cause:** Feature not yet implemented (expected behavior in v0.1.0).

**Expected timeline:** See roadmap in `docs/system/obsidian-mind-steward-roadmap.md` for planned expansion.

**Current state:** Only "Refresh" button is enabled. Other buttons (Dry Run, View Latest, Open Mind, Wiki Log) are reserved for future phases.

### Plugin Doesn't Show in Ribbon/Sidebar

**Cause:** Plugin not installed or not enabled.

**Fixes:**
1. Verify plugin is installed: Obsidian Settings → Community Plugins → search "Brain Console"
2. Verify plugin is enabled (toggle switch is on)
3. Manually open: command palette (Cmd+Shift+P) → "Open Brain Console"
4. Check console for errors: Obsidian Settings → About → Show Debug Info → look for plugin errors

---

## Roadmap

### Phase 0 (Current: v0.1.0)
✅ Status pills + 6 core cards  
✅ Manual Refresh button  
✅ Read-only plugin, approval-gated actions  
✅ Dark cockpit theme + progressive disclosure  

### Phase 1 (Planned)
- [ ] Action button implementations (Dry Run, View Latest, etc)
- [ ] Card click-through to detail views
- [ ] Periodic auto-refresh (user-configurable interval)
- [ ] History/timeline of recent changes

### Phase 2 (Planned)
- [ ] Multiple tab support (Overview, Approvals, Scheduler, etc)
- [ ] Custom card visibility (user chooses which cards to show)
- [ ] Integration with Mind Markdown for inline status displays
- [ ] Webhooks for real-time updates (Brain Core push → Obsidian)

### Phase 3+ (Future)
- [ ] Maintenance action preview inspector
- [ ] Approval request UI (inspect + approve/reject in-plugin)
- [ ] Execution plan viewer + candidate comparison
- [ ] Mind Steward lint report drill-down
- [ ] Scheduler job runner + history viewer

See `docs/system/obsidian-mind-steward-roadmap.md` for full strategic roadmap.

---

## Operations

### For Users

**Daily standup:**
1. Open Obsidian
2. Click Brain Console icon (right sidebar)
3. Scan the 6 cards for blockers/alerts
4. Read action bullets in "Next Safe Action" card
5. Act on recommendations

**Weekly review:**
1. Check "Wiki Health" card for lint issues
2. Check "Maintenance Previews" card for queued actions
3. Check "Scheduler Status" card for job health
4. Verify "Approvals" card shows no unexpected pending requests

**If stuck:**
- **Plugin won't load?** See Troubleshooting section
- **Brain Core offline?** Start Brain Core: `brain-core start` or check status: `brain-core status`
- **Data looks stale?** Click "Refresh" button
- **Need raw data?** Browse Mind Markdown: HOME.md, live/dashboard.md, live/machine.md

### For Developers

**Plugin codebase:**
- Location: `projects/brain-console-obsidian/src/`
- Build: `npm run build`
- Package: `npm run package`
- Tests: `npm run typecheck` (type safety)

**Brain Core integration:**
- Endpoints documented in this runbook (see "Data Sources & Endpoints" section)
- Client functions: `projects/brain-console-obsidian/src/client.ts`
- View rendering: `projects/brain-console-obsidian/src/view.ts`
- Styles: `projects/brain-console-obsidian/styles.css`

**Testing dashboard locally:**
1. Start Brain Core: `brain-core start`
2. Install Brain Console plugin in Obsidian (from `projects/brain-console-obsidian/release/`)
3. Open Obsidian, click Brain Console icon
4. Verify 6 cards render and data populates
5. Click "Refresh" button, verify data updates

---

## References

- **Architecture Spec:** `docs/system/obsidian-command-center-dashboard-spec-2026-05-17.md`
- **Roadmap:** `docs/system/obsidian-mind-steward-roadmap.md`
- **Implementation Plan:** `docs/system/obsidian-mind-steward-implementation-plan.md`
- **Brain Core API:** `projects/brain-core/src/api/routes.ts` and generated OpenAPI docs
- **Plugin Source:** `projects/brain-console-obsidian/src/`
- **Mind Vault Reference:** `mind/HOME.md`, `mind/live/dashboard.md`

---

## FAQ

**Q: Can the plugin mutate my Mind vault?**  
A: No. The plugin is read-only. It cannot write to Obsidian settings or Mind files.

**Q: Why is Refresh manual-only?**  
A: Deliberate safety choice. Automatic polling can mask slow/broken endpoints. Manual refresh puts you in control and makes polling delays obvious.

**Q: What happens if Brain Core crashes?**  
A: Plugin shows "Brain Core offline" message but remains usable. You can navigate Mind Markdown directly as fallback.

**Q: Can I use this without installing Brain Core?**  
A: No, Brain Core must be running and accessible. The plugin is a UI for Brain Core, not a standalone tool.

**Q: What's the difference between this plugin and `mind/live/dashboard.md`?**  
A: The plugin is primary (live data, no manual updates). The Markdown file is fallback reference (for when plugin unavailable or for browsing legacy Markdown).

**Q: How do I know if data is stale?**  
A: Every card shows a source endpoint. If you suspect stale data, click "Refresh" to re-poll all endpoints.

**Q: Can I customize which cards show?**  
A: Not yet (planned for Phase 1). Currently, all 6 MVP cards always display. Future versions will support card visibility toggles.

---

## Changelog

### 0.1.0 (2026-05-17)
- Initial release: 6 core cards, status pills, manual Refresh button
- Dark cockpit theme (#0a0e27, #ff6b3d accents)
- Read-only plugin, zero automatic mutations
- Comprehensive error handling and offline mode

---

**Last updated:** 2026-05-17  
**Maintained by:** Steve Westhoek + Claude  
**Status:** Production (v0.1.0 MVP, roadmap to follow)
