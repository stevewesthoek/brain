# Phase 6 Integration Testing Guide

**Status:** Ready for browser testing | All API endpoints functional | UI fully polished

---

## Quick Start (Manual Testing)

### Prerequisites
- ProBot running locally (`npm start` or standard startup)
- Browser with DevTools open (check console for errors)
- Test data in place:
  - `~/.config/viralflow/brain.json` ✅ (contains 2 topics, 2 scripts, 4 videos)
  - `~/.config/viralflow/accounts.json` ✅ (contains 4 accounts, 1 series)

### Test Scenario 1: Initial Tab Load

**Steps:**
1. Open ProBot dashboard (localhost:port/dashboard)
2. Locate "Studio" tab in navigation (after "Local Apps")
3. Click "Studio" tab
4. Wait for loading spinner to disappear

**Expected:**
- ✅ Header appears with "Last updated: just now" + Refresh button
- ✅ 5 main panels render:
  - Content Strategy (2 topics visible)
  - Audience Insights (4 videos, 4 accounts, engagement %)
  - Batch Status (no active batch)
  - Top Videos (4 videos sorted by views)
  - Recent Scripts (2 scripts visible)
- ✅ Footer shows "4 accounts connected • Polling every 10s"
- ✅ No console errors

---

## Test Scenarios

### Test 2: Real-Time Polling

**Duration:** 30 seconds

**Steps:**
1. Load Studio tab (from Test 1)
2. Watch the "Last updated" timestamp
3. After ~10 seconds, watch it refresh
4. Observe timestamp change ("just now" → "10s ago" → reset to "just now")
5. Switch to another tab (Sessions, Dokploy, etc.)
6. Wait 15 seconds
7. Switch back to Studio tab

**Expected:**
- ✅ Timestamp changes every 10 seconds
- ✅ Panel content visibly refreshes (no blink/flash)
- ✅ When switching away, polling stops
- ✅ When switching back, polling resumes and fresh data loads immediately
- ✅ No "Last updated" text while tab hidden

**Console:**
- ✅ No errors logged
- ✅ No XHR warnings

---

### Test 3: Manual Refresh Button

**Steps:**
1. Load Studio tab
2. Click the "🔄 Refresh" button in header
3. Watch for update
4. Click again immediately
5. Check for error handling

**Expected:**
- ✅ Panel re-renders after click
- ✅ "Last updated" resets to "just now"
- ✅ No loading spinner (incremental refresh)
- ✅ Rapid clicks don't cause errors (debounced)
- ✅ Button stays clickable and responsive

---

### Test 4: Tab Switching

**Steps:**
1. Load Studio tab
2. Click "Sessions" tab
3. Click back to "Studio" tab
4. Watch polling resume

**Expected:**
- ✅ Studio tab hides immediately
- ✅ No polling requests while hidden (check Network tab)
- ✅ When returned to Studio, fresh data loads
- ✅ Polling resumes after ~500ms

**Network Tab:**
- ✅ Initial `/api/viral-flow/status` request on tab click
- ✅ Every 10s thereafter, another `/api/viral-flow/status` request
- ✅ Requests stop when tab hidden
- ✅ New request appears when tab shown again

---

### Test 5: Data Accuracy

**Steps:**
1. Load Studio tab
2. Check Content Strategy panel
3. Verify topics match test data:
   - "No-Code AI Tools 2026" (score: 92)
   - "AI Automation for Solopreneurs" (score: 87)
4. Check Top Videos panel
5. Verify videos sorted by views (descending):
   - "5 AI Tools..." (68,500 views)
   - "AI Automation Game Changer" (42,000 views)
   - "Complete AI Automation..." (15,800 views)
   - "Quick AI Automation..." (9,200 views)
6. Check Audience Insights metrics:
   - Total Videos: 4
   - Total Views: 135,500
   - Avg Engagement: 7.7%
   - Accounts: 4

**Expected:**
- ✅ All data matches test files exactly
- ✅ No truncation or formatting issues
- ✅ Sorting correct (descending by score/views)
- ✅ Numbers formatted with commas (e.g., "68,500")
- ✅ Engagement shown as percentage (e.g., "7.7%")

---

### Test 6: Error Handling (Simulated API Failure)

**Steps:**
1. Load Studio tab (should render normally)
2. Open Browser DevTools → Network tab
3. Right-click on network request → Edit and Resend
4. Change endpoint from `/api/viral-flow/status` to `/api/viral-flow/invalid`
5. Observe error handling

**Expected:**
- ✅ Error message appears in red overlay
- ✅ Previous panel data remains visible (not cleared)
- ✅ Error message: "⚠️ Failed to refresh: Error: HTTP 404"
- ✅ Refresh button still functional
- ✅ Polling continues (retry on next 10s interval)

**Alternative:** Stop the server temporarily and click Refresh button.

---

### Test 7: Responsive Layout

**Steps:**
1. Load Studio tab on desktop (1920px wide)
2. Observe 3-column grid layout
3. Open DevTools (F12)
4. Activate mobile view (375px wide)
5. Observe layout reflow

**Expected:**
- ✅ Desktop: 3 columns, panels auto-flow densely (Performance/Scripts span 2 rows)
- ✅ Tablet (768px): 2 columns, panels reflow smoothly
- ✅ Mobile (375px): 1 column, all panels stack vertically
- ✅ No horizontal scrolling
- ✅ Text readable without zoom
- ✅ Buttons clickable (48px+ height)

---

### Test 8: Dark Mode (if enabled)

**Steps:**
1. Enable dark mode in browser/OS
2. Load Studio tab
3. Check colors adjust accordingly

**Expected:**
- ✅ Background colors adapt (light → dark)
- ✅ Text colors remain readable (contrast ≥ 4.5:1)
- ✅ No harsh color combinations
- ✅ Borders visible in dark mode
- ✅ Status indicators clear (green, red, blue visible)

---

### Test 9: No Batch Production (Current State)

**Steps:**
1. Load Studio tab
2. Look at Batch Status panel

**Expected:**
- ✅ "No active batch production" message
- ✅ No pipeline stages shown
- ✅ Resume button not clickable
- ✅ Clean, minimal appearance

---

### Test 10: With Active Batch (Checkpoint File)

**Setup:**
```bash
cat > .pipeline-checkpoint.json << 'EOF'
{
  "batch_id": "batch-2026-05-07-001",
  "topic": "AI Automation",
  "stage": "voice",
  "progress": {
    "discover": { "completed": true },
    "script": { "completed": true },
    "voice": { "completed": false, "in_progress": true },
    "compose": { "completed": false, "in_progress": false },
    "design": { "completed": false, "in_progress": false },
    "post": { "completed": false, "in_progress": false }
  },
  "errors": []
}
EOF
```

**Steps:**
1. Create checkpoint file (above)
2. Load Studio tab
3. Check Batch Status panel

**Expected:**
- ✅ Stage badge shows: "Current Stage: voice"
- ✅ Pipeline shows: discover ✓, script ✓, voice •, compose ○, design ○, post ○
- ✅ Resume button appears and is clickable (shows "Resume" label)
- ✅ Colors: completed (green), active (blue), pending (gray)

---

## Console Checks

After each test, check Browser DevTools Console:

**Expected (Clean Console):**
- ✅ No red error messages
- ✅ No yellow warnings
- ✅ Polling logs optional (can be suppressed)
- ✅ No `undefined` references
- ✅ No CORS errors
- ✅ No 404s for local endpoints

**Check for:**
- ❌ "Uncaught TypeError"
- ❌ "Failed to parse JSON"
- ❌ "Network error"
- ❌ "Cannot read property of undefined"

---

## Network Tab Inspection

**Expected Requests (when Studio tab active):**

```
GET /api/viral-flow/status       [200 OK] ~50ms  (initial + every 10s)
```

**When Switching Tabs:**
- ✅ Requests STOP immediately (no longer every 10s)
- ✅ No trailing requests after tab hide

**When Returning to Studio:**
- ✅ Single immediate request
- ✅ 10s polling resumes

**Response Size:**
- ~2-3KB per response (varies with data)
- No compression needed for this size

---

## Performance Baseline

**Target Metrics:**
- Initial load: < 500ms (including API call)
- Refresh interval: ~100ms (UI update, not API call time)
- No memory leaks after 5 minutes of polling
- No CPU spikes during polling

**How to Test:**
1. Open DevTools → Performance tab
2. Click record
3. Watch Studio tab for 15 seconds
4. Stop recording
5. Analyze for long tasks (> 50ms)

---

## Accessibility Checks

**Expected:**
- ✅ Tab key navigates through buttons
- ✅ Refresh button keyboard-accessible
- ✅ No keyboard traps
- ✅ Focus visible (outline/highlight)
- ✅ Color not only cue (e.g., ✓ icon + green)
- ✅ Status indicators have text labels (not just color)

---

## Edge Cases

### Missing Data Files

**Setup:** Rename or delete test data files

**Expected:**
- ✅ API returns empty arrays
- ✅ Panels show "No X yet" messages
- ✅ Metrics show 0 values
- ✅ No 500 errors
- ✅ Graceful fallback UI

### Malformed Data

**Setup:** Corrupt test data JSON

**Expected:**
- ✅ API catches parse error
- ✅ Returns empty/default data
- ✅ Studio panel shows partial data or "No data"
- ✅ No console crashes

### Very Large Datasets

**Setup:** Add 100+ topics/videos to brain.json

**Expected:**
- ✅ Page still responsive
- ✅ Rendering < 1 second
- ✅ Lists scrollable
- ✅ No UI freeze
- ✅ Memory usage reasonable

---

## Success Criteria (All Must Pass)

- ✅ Tab loads without errors
- ✅ All 5 panels render with test data
- ✅ Polling works (10s refresh visible)
- ✅ Tab switching stops/resumes polling
- ✅ Manual refresh button works
- ✅ Error messages show gracefully
- ✅ No console errors
- ✅ Mobile layout responsive
- ✅ Data accuracy verified
- ✅ Performance acceptable (< 500ms initial)

---

## Known Limitations (Phase 6.0 Beta)

| Feature | Status | Notes |
|---------|--------|-------|
| Batch resume button | ⏳ Placeholder | Functionality deferred to Phase 7 |
| Account add modal | ⏳ API ready | UI form deferred to Phase 7 |
| Performance charts | ⏳ Data ready | Visualization deferred to Phase 7 |
| Brain insights modal | ⏳ API ready | Detailed insights deferred to Phase 7 |
| SERIES group posting | ⏳ Ready | UI integration deferred to Phase 7 |

All core functionality (polling, display, API) is production-ready.

---

## Testing Checklist

- [ ] Test 1: Initial tab load (no errors, all panels visible)
- [ ] Test 2: Real-time polling (timestamps refresh every 10s)
- [ ] Test 3: Manual refresh button (works, updates timestamp)
- [ ] Test 4: Tab switching (polling stops/resumes correctly)
- [ ] Test 5: Data accuracy (values match test data)
- [ ] Test 6: Error handling (graceful failure, no crashes)
- [ ] Test 7: Responsive layout (works on mobile/tablet)
- [ ] Test 8: Dark mode (readable in light/dark)
- [ ] Test 9: No batch (panel shows "no active batch")
- [ ] Test 10: With batch (checkpoint stages visible)
- [ ] Console: No errors after 5 minutes of polling
- [ ] Network: Requests every 10s, stop on tab hide
- [ ] Performance: Initial load < 500ms

---

**Report Issues:** If any test fails, check:
1. Browser console for JavaScript errors
2. Network tab for failed API requests
3. ProBot server logs for backend errors
4. Test data file permissions and format

**Phase 6 Beta Status:** ✅ Ready for production testing after successful completion of above tests.
