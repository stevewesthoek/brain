# Post Orchestrator Preview Mode Runbook

## Purpose

Post Orchestrator preview mode is the read-only Brain Core and Brain Console surface for post flows, fixtures, review queues, schedule previews, analytics fixtures, safety policy, and migration planning.

It is intentionally preview-only. It does not publish, schedule, export files, copy to clipboard, or decommission anything.

## Current status

- P1-P15 preview arc is complete.
- Publishing is disabled.
- Scheduling is disabled.
- Platform writes are disabled.
- Decommission is not started.

## How to view in Obsidian

1. Start Brain Core.
2. Open Brain Console in Obsidian.
3. Open the Posts/Post Orchestrator section.
4. Review the grouped preview cards and blocker summaries.

## What each group means

- Status: compact overview of counts, blockers, and the next safe step.
- Flow Preview: platform flows, event fixtures, dry-run plans, and draft examples.
- Review / Schedule: review queue, schedule preview, and manual export preview.
- Safety / Policy: readiness, platform policy, operator guidance, and acceptance checks.
- Migration / Checkpoint: migration parity, decommission readiness, and roadmap checkpoint.

## What is safe

- Read-only endpoints.
- Dry-run previews.
- Review approval requests.
- Schedule review approval requests.
- Manual export preview only.

## What is not enabled

- Publishing.
- Scheduling.
- Platform API writes.
- Browser automation.
- External analytics reads.
- Decommissioning.

## Operator checklist

1. Review the overview card.
2. Review the blocked items in readiness and policy cards.
3. Inspect platform policies.
4. Inspect migration parity.
5. Review the roadmap checkpoint.
6. Decide whether to approve a future design phase.

## Manual Visual QA in Obsidian

### Setup

1. **Start Brain Core**
   ```bash
   cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-core
   npm run dev
   ```
   Verify `GET /status` returns `200 OK` with `online: true`.

2. **Restart Obsidian with Brain Console plugin**
   ```bash
   # Restart Obsidian after plugin reinstall from /Users/Office/Repos/stevewesthoek/brain/projects/brain-console-obsidian/release/
   ```

### Visual QA Steps

3. **Open Brain Console**
   - Click Brain Console icon in Obsidian sidebar.
   - Verify view opens without errors.

4. **Verify Command Bar**
   - Header shows `◈ BRAIN OS` in orange.
   - Status badge shows `ONLINE` (green) or `OFFLINE` (red).
   - Timestamp shows relative time (e.g., "last: 0s ago").
   - Refresh button visible and clickable.

5. **Verify Status Strip Below Header**
   - 6 pills visible: Brain Core, Model Router, Scheduler, Save-to-Mind, Approvals, Maintenance.
   - No overlapping text (all pills readable, properly spaced).
   - Status values visible (e.g., "online", "missing", "runtime-report").

6. **Verify Tab Rail**
   - 9 tabs visible: Overview, Apps, Orchestrators, Pipelines, Projects, Reports, Posts, Agents, Recovery.
   - Active tab has orange underline.
   - Tabs responsive and readable.
   - No wrapping issues in narrow pane.

7. **Open Posts Tab**
   - Click "Posts" tab.
   - Five group sections render:
     - Status (orange header "STATUS")
     - Flow Preview (orange header "FLOW PREVIEW")
     - Review / Schedule (orange header "REVIEW / SCHEDULE")
     - Safety / Policy (orange header "SAFETY / POLICY")
     - Migration / Checkpoint (orange header "MIGRATION / CHECKPOINT")

8. **Verify Status Group**
   - Card 1: "Overview" card renders.
   - Card 2: "Post Orchestrator Status" card renders.
   - Card 3: "Brain Console QA Status" card renders with:
     - Status value (e.g., "ready-for-manual-qa").
     - Endpoints metric (e.g., "21/21").
     - Coverage percent (e.g., "100%").
     - Manual checks count.
     - Passed checks count.
     - Next safe step.
     - Safety labels: "Preview only · Publishing disabled · Scheduling disabled · Execution disabled · No external writes · No Mind writes".
   - Card 4: "Visual QA Checklist" card renders with 10 checklist items.

9. **Verify Flow Preview Group**
   - Shows: Platform / Post Flows, Event Fixtures, Dry-Run Plan, Draft Plan Rows, Draft Fixtures.
   - No errors or empty states.
   - All cards render data (no "undefined" text).

10. **Verify Review / Schedule Group**
    - Shows: Draft Review Queue, Schedule Preview Queue, Manual Export Preview.
    - Each card shows readable summary stats.

11. **Verify Safety / Policy Group**
    - Shows: Readiness / Quality Score, Platform Policy / Security Review, Operator Guidance, Acceptance Checklist, Safety State.
    - All cards render data.

12. **Verify Migration / Checkpoint Group**
    - Shows: Migration Parity Report, Decommission Readiness Matrix, Roadmap Checkpoint, Contracts, Recovery / Blockers, Analytics Feedback Fixtures, End-to-End Pipeline Summary.
    - All cards render data.

13. **Verify Safety Labels**
    - No cards show "Publish", "Schedule", "Execute", "Export" buttons.
    - All cards show safety labels (e.g., "Publishing disabled · Scheduling disabled").
    - No "Decommission", "Delete", "Apply changes", "Start Playwright" labels.

14. **Verify Forbidden Controls Are Absent**
    - ✗ No "Publish Now" button.
    - ✗ No "Schedule Now" button.
    - ✗ No "Run posting" button.
    - ✗ No "Start Playwright" button.
    - ✗ No "Decommission now" button.
    - ✗ No "Delete repo" button.
    - ✗ No "Export now" button.
    - ✗ No "Download" button.
    - ✗ No "Copy to clipboard" button.
    - ✗ No Proofly/Xgrow provider labels.

15. **Verify Visual Quality**
    - No raw JSON or stack traces.
    - Text is readable (no tiny fonts).
    - Cards have consistent spacing (12–20px).
    - No huge empty cards or blank lines.
    - Orange accent color used consistently.
    - Dark cockpit theme is visually coherent.

16. **Verify Next Safe Step**
    - Overview card shows "next safe step" in readable text.
    - QA Status card shows "next safe step" (e.g., "ready for manual QA").
    - All cards show next action or approval requirement.

### Quality Checklist

- [ ] Header renders correctly with logo, status, timestamp, refresh.
- [ ] Status strip is readable with 6 pills (no overlapping text).
- [ ] Tab rail is active and responsive.
- [ ] Posts tab opens without lag.
- [ ] 5 group sections render with proper titles.
- [ ] All 22 cards render data (no "undefined" or errors).
- [ ] QA Status card shows metrics and safety labels.
- [ ] Visual QA Checklist shows 10 items or dynamic checklist from API.
- [ ] No forbidden buttons visible.
- [ ] All safety labels present.
- [ ] Typography is readable (fonts, sizes, contrast).
- [ ] Spacing is consistent and intentional.
- [ ] Next safe steps are visible and clear.
- [ ] Dark cockpit theme is applied consistently.
- [ ] No crashes or browser console errors.

## Troubleshooting: If the dashboard still looks unchanged

If you've reinstalled the plugin but the dashboard appears identical to before:

### 1. **Verify plugin files exist**

Check that the installed plugin contains the latest code:

```bash
ls -lah /Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console/
```

Expected:
- `main.js` (486-487 KB)
- `styles.css` (15+ KB)
- `manifest.json` (229 B)

### 2. **Verify the build marker is present**

```bash
grep "scaffold 2026-05-18" /Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console/main.js
grep "brain-console__build-marker" /Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console/styles.css
```

Both should return matches. If not, the new plugin was not installed.

### 3. **Fully quit Obsidian**

Do NOT just close the window or minimize. Use:
- Mac: Cmd+Q to fully quit Obsidian
- Windows/Linux: Alt+F4 or File > Exit

Wait 5 seconds, then reopen Obsidian.

### 4. **Check Obsidian cache**

If still unchanged, try:
1. Open Obsidian DevTools: Cmd+Option+I (Mac) or Ctrl+Shift+I (Windows)
2. Go to Console tab
3. Type: `location.reload(true)` (hard refresh)
4. Wait for page to reload

### 5. **Disable and re-enable the plugin**

1. Open Obsidian Settings
2. Go to Community Plugins
3. Find "Brain Console" in the Installed Plugins list
4. Click the toggle to Disable
5. Wait 3 seconds
6. Click the toggle to Enable
7. Open Brain Console again

### 6. **Confirm the build marker is visible**

After reopen/reload, the Brain Console header should show:

```
◈ BRAIN OS  ● ONLINE  [scaffold 2026-05-18]  ↻ refresh  last: 0s ago
```

The `scaffold 2026-05-18` text should be visible in orange/accent color on the right side of the header.

If you see this marker, the new plugin is loaded and the visual updates are active.

### 7. **Expected visible changes**

With the new plugin, you should see:
- **Build marker** in the header (right side, orange text)
- **Status badge** more prominent in the header center
- **Post group headings** (STATUS, FLOW PREVIEW, etc.) with orange top borders
- **Publishing Disabled** banner with red left border (if on Posts tab)

## Next phase decision

- Visual polish and navigation cleanup, or
- explicit user-approved real scheduling/publishing design later.

No secrets.
No live tokens.
No write actions.
