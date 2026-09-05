# Brain Console Local QA

> **Historical legacy MVP QA note.** Brain Console 2.0 is complete. Use
> `operations/runbooks/brain-console-operations.md` for current operation and
> smoke verification; this dated note is retained only as historical context.

**Date:** 2026-05-17  
**Purpose:** Manual visual QA and polish assessment for Brain Console Obsidian plugin dashboard MVP.

---

## Install Location

Plugin installed locally (not committed) at:

```
/Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console/
```

## Installed Files

```
manifest.json     Plugin metadata (id: brain-console, version: 0.1.0)
main.js           Plugin entry point (compiled from src/main.ts)
view.js           Dashboard view rendering (compiled from src/view.ts)
client.js         Brain Core API client (compiled from src/client.ts)
settings.js       Plugin settings handler (compiled from src/settings.ts)
obsidian.js       Obsidian API wrapper (compiled from src/obsidian.ts)
styles.css        Dark cockpit theme and card styles
```

## How to Open in Obsidian

1. **Restart Obsidian** (or use "Reload Obsidian without saving" command if available)
2. **Go to Settings → Community plugins**
3. **Confirm "Brain Console" is enabled** (toggle is on)
4. **Open command palette** (Cmd+Shift+P on Mac)
5. **Run "Open Brain Console"** command
6. **Dashboard appears in right sidebar** showing 6 cards + status pills

## Expected First View

When Brain Console opens successfully:

### Status Strip (Top)
- 6 pills showing quick health indicators:
  - Brain Core: `online` / `offline` + mode
  - Mind Steward: job status
  - Scheduler: queue status
  - Save-to-Mind: capture status
  - Approvals: count pending
  - Maintenance: count pending

### Header
- Title: "Brain Cockpit"
- Subtitle: "System status, maintenance queue, and next safe action"
- Safety banner: "Read-only. Manual refresh. No automatic POST calls."

### 6 Core Cards (Card Grid)
1. **Wiki Health** — Model-router lint status (✓ OK or ⚠ Issues with counts)
2. **Maintenance Previews** — Queue status (count pending, latest date)
3. **Approvals** — Pending approval requests (count, sample kinds)
4. **Scheduler Status** — Nightly job queue health (status, latest run, job samples)
5. **Brain Core** — API server readiness (online/offline, host, version, execution status)
6. **Next Safe Action** — Recommended action or blocker (ready count or blocker list)

### Action Row
- **Refresh button** — ✅ Enabled (polls all endpoints)
- **Request Dry Run** — 🔒 Disabled (future expansion)
- **View Latest** — 🔒 Disabled (future expansion)
- **Open Mind** — 🔒 Disabled (future expansion)
- **Wiki Log** — 🔒 Disabled (future expansion)

### Activity Panel (Bottom)
- Recent activity summary (sessions, reports, previews)

## If Brain Core Is Offline

Expected behavior when `/status` endpoint unreachable:

✅ Plugin still opens  
✅ Shows "Brain Core offline" message with diagnostic details  
✅ Displays error information: which endpoints failed, error messages  
✅ No crash or stack traces  
✅ No raw JSON or error spam  
✅ Graceful degradation  
✅ User can still navigate Mind vault  

**Recovery steps shown in plugin:**

1. Verify Brain Core terminal is still running
2. Test: `curl http://localhost:4877/status` from terminal
3. If curl works but plugin still offline: try alternate address
   - Settings → Brain Core URL → try `http://127.0.0.1:4877` instead of `localhost`
4. Click Refresh button
5. If still offline, copy the diagnostic error text and refer to troubleshooting

**Manual recovery (if needed):**

```bash
cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-core
npm run build
npm start
# Brain Core should log: "Brain Core read-only API listening at http://..."
```

Then return to Obsidian and click "Refresh" in Brain Console.

## Visual QA Checklist

After opening the dashboard, rate each dimension on a scale of 1-5 (1=needs work, 5=excellent):

### Overall Polish
- [ ] Visual hierarchy clear (status pills → cards → details)
- [ ] No visual clutter
- [ ] Consistent spacing and alignment
- [ ] Professional appearance
- [ ] Matches dark cockpit aesthetic direction

### Status Strip (6 Pills)
- [ ] All 6 pills visible and readable
- [ ] Monospaced font correct
- [ ] Color contrast adequate
- [ ] Content fits without wrapping
- [ ] Indicators update on Refresh

### Card Design
- [ ] All 6 cards render without errors
- [ ] Card titles clear and uppercase
- [ ] Metrics display prominently (orange color)
- [ ] Details are readable (smaller, secondary text)
- [ ] Spacing between cards consistent
- [ ] Hover effects work (if applicable)
- [ ] Cards responsive to window resize

### Color & Contrast
- [ ] Dark background (#0a0e27 or close)
- [ ] Orange accents (#ff6b3d or close) for metrics
- [ ] Text contrast passes WCAG AA
- [ ] No glare or eye strain
- [ ] Secondary text (gray) readable

### Typography
- [ ] Monospaced font applied (Menlo/Monaco ideal)
- [ ] Font sizes create hierarchy
- [ ] Line spacing comfortable
- [ ] No text overflow or truncation

### Action Row
- [ ] "Refresh" button visible and enabled
- [ ] Other buttons visible but disabled (visual indication clear)
- [ ] Buttons are clickable (Refresh works)
- [ ] Button styling consistent with dark theme

### Offline State
- [ ] If Brain Core unreachable, shows "offline" message gracefully
- [ ] No raw errors or stack traces
- [ ] User guidance present ("Start Brain Core to load...")

### Comparison to Reference Spec
Reference: `/docs/system/obsidian-command-center-dashboard-spec-2026-05-17.md`

- [ ] Layout matches specification (pills → header → grid → activity)
- [ ] Card titles match spec (Wiki Health, Approvals, Scheduler, etc)
- [ ] Data sources correct (Brain Core endpoints feeding cards)
- [ ] Safety guarantees visible (banner says "read-only, manual refresh")
- [ ] Visual direction matches spec (dark, monospaced, sparse)

### User Experience
- [ ] Dashboard opens quickly
- [ ] No hangs or freezes
- [ ] Refresh button responsive (< 1s feedback)
- [ ] Cards don't show raw JSON or internal data
- [ ] Metrics are polished and summarized

## Known Limitations (MVP Expected)

- ⏳ **Manual refresh only** — No automatic polling (safety-first design)
- 🔒 **Action buttons disabled** — Except Refresh; future implementation
- 📝 **No apply/mutation** — Dashboard is read-only inspection only
- 📱 **Desktop only** — Obsidian mobile not supported in this version
- 🎨 **First visual pass** — Polish refinements expected after this QA

## Visual Polish Pass (Next Steps)

After this QA, document any of these issues found:

- [ ] Spacing too tight or too loose
- [ ] Colors feel off (contrast, vibrancy, match to spec)
- [ ] Typography feels wrong (size, weight, font choice)
- [ ] Cards feel cluttered or sparse
- [ ] Status pills hard to read
- [ ] Action buttons need visual improvement
- [ ] Offline state messaging could be clearer
- [ ] Missing hover/interaction feedback
- [ ] Layout breaks at certain window sizes
- [ ] Metrics/details hierarchy unclear

Document findings and create follow-up polish pass task.

## Testing Commands

### Verify Plugin Installed
```bash
ls -la /Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console/
```

### Verify Enabled in Config
```bash
cat /Users/Office/Repos/stevewesthoek/mind/.obsidian/community-plugins.json
```

### Rebuild Plugin (if making changes)
```bash
cd /Users/Office/Repos/stevewesthoek/brain
npm run --prefix projects/brain-console-obsidian typecheck
npm run --prefix projects/brain-console-obsidian build
npm run --prefix projects/brain-console-obsidian package
# Files updated in release/ folder; re-copy to Mind if needed
```

### Start Brain Core (if offline)
```bash
cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-core
npm run build
npm start
# Listen for: "Brain Core listening on http://localhost:4877"
```

## FAQ

**Q: Plugin doesn't appear in command palette?**  
A: Restart Obsidian completely. If still missing, check Settings → Community plugins → Disabled list. Re-enable if needed.

**Q: Refresh button does nothing?**  
A: Brain Core is likely offline. Check status: `curl http://localhost:4877/status`. Start Brain Core if needed.

**Q: See raw JSON in cards?**  
A: Data may be malformed from Brain Core, or plugin has a rendering bug. Check browser console for JS errors (Settings → Developer Tools).

**Q: Cards show "Unavailable" for all data?**  
A: Brain Core endpoints may not be returning data. Verify Brain Core is running and `/status` responds successfully.

**Q: Want to modify the theme?**  
A: Edit `/Users/Office/Repos/stevewesthoek/brain/projects/brain-console-obsidian/styles.css`, rebuild, and copy styles.css to Mind plugin folder. Restart Obsidian.

---

## QA Sign-Off Template

```
## QA Results — Brain Console MVP v0.1.0

Date: _______________
Tester: _____________
Duration: ___________

### Overall Assessment
[ ] Ready for user deployment
[ ] Needs polish pass before deployment
[ ] Blocked on issue(s)

### Critical Issues Found
(List any blockers)

### Polish Suggestions
(List visual/UX improvements)

### Performance
Refresh latency: ___ ms
Card render time: ___ ms
Memory usage: ___ MB

### Recommendation
(Next steps)
```

---

**Status:** QA environment ready. Open Brain Console in Obsidian to begin visual testing.  
**Document:** Findings in this runbook under "Visual Polish Pass (Next Steps)" section.  
**Next:** Screenshot review and polish pass based on actual dashboard appearance.
