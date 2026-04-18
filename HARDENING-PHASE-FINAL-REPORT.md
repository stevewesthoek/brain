# Save to Mind Intake Path: Producer-Side Hardening Report

**Date:** 2026-04-18  
**Status:** REQUIRES MANUAL N8N PATCH APPLICATION  
**Phase:** Producer contract completion

---

## Executive Summary

### Problem Found
- Real Shortcut captures consistently arrived WITHOUT `signal_quality` field
- Gemini API was asked to compute it, but n8n code node never extracted it
- Router had to apply fail-safe: high-confidence captures stayed in review-queue instead of routing to PARA folders

### Root Cause
- **Exact location:** n8n "Build Processed Note" code node
- **Issue:** Lines 4-5 extract para_type, confidence, summary, key_points but never read `p.signal_quality`
- **Impact:** Field was missing from all captures (3 verified real captures tested)

### Solution
- Extract `signal_quality` from Gemini response in the code node
- Include it in the markdown frontmatter
- No router changes needed (already safe with fail-safe logic)

### Current Status
- ✅ Router status insertion bug: FIXED and deployed
- ✅ Router formatting bug: FIXED and deployed
- ✅ Router observability: ADDED (logs when signal_quality missing)
- ✅ Documentation: UPDATED to reflect actual contract
- ⏳ **n8n signal_quality fix: READY FOR MANUAL APPLICATION**

---

## The Fix

### What Needs to Change

**File:** n8n Workflow "Mind Inbox — Capture & Classify with Signal Scoring"  
**Workflow ID:** FwP5INe9qoo1OwGC  
**Node:** "Build Processed Note" (code node)

### Step-by-Step Application

1. **Go to n8n UI:**
   ```
   https://n8n.prochat.tools
   ```

2. **Find the workflow:**
   - Search for: "Mind Inbox — Capture & Classify with Signal Scoring"
   - Open the workflow editor

3. **Locate "Build Processed Note" code node:**
   - This node sits between "Gemini Classify" and "Check Existing GitHub File"

4. **Replace the code:**
   - Copy the complete fixed code from: `/Users/Office/Repos/stevewesthoek/brain/operations/automations/n8n/SIGNAL-QUALITY-FIX.md`
   - Section: "Fixed Code for 'Build Processed Note' Node"
   - Paste into the code editor (replace all)

5. **Save the workflow:**
   - Click "Save" button (top-left)
   - Verify "Active" toggle shows green (top-right)

6. **Done.**

### Detailed Instructions

See: `/Users/Office/Repos/stevewesthoek/brain/operations/automations/n8n/SIGNAL-QUALITY-FIX.md`

### What the Fix Does

```javascript
// BEFORE: signal_quality never extracted
let ptype = "inbox", conf = 0.5, summ = "", kpts = [];
if (cls) try { 
  const p = JSON.parse(cls); 
  ptype = p.para_type || "inbox"; 
  conf = p.confidence || 0.5; 
  summ = p.summary || ""; 
  kpts = p.key_points || []; 
} catch (e) {}

// AFTER: signal_quality extracted and used
let ptype = "inbox", conf = 0.5, sq = 0.5, summ = "", kpts = [];
if (cls) try { 
  const p = JSON.parse(cls); 
  ptype = p.para_type || "inbox"; 
  conf = p.confidence || 0.5; 
  sq = p.signal_quality || 0.5;  // ← NEW LINE
  summ = p.summary || ""; 
  kpts = p.key_points || []; 
} catch (e) {}

// And add to frontmatter:
const md = `---
type: capture
source: ${source}
para_type: ${ptype}
confidence: ${conf}
signal_quality: ${sq}          // ← NEW LINE
title: ${JSON.stringify(title)}
...
```

---

## Expected Behavior After Fix

### Before (Current)
```yaml
---
type: capture
source: shortcut
para_type: area
confidence: 0.92
title: "Example"
created: 2026-04-18T...Z
---
```
**Router:** Stays in 01-inbox (review-queue) because signal_quality missing = fail-safe

### After (Post-Fix)
```yaml
---
type: capture
source: shortcut
para_type: area
confidence: 0.92
signal_quality: 0.88
title: "Example"
created: 2026-04-18T...Z
---
```
**Router:** Moves to 05-areas (ready-for-review) because confidence ≥ 0.8 AND signal_quality ≥ 0.8

---

## Verification Steps

After applying the fix:

1. **Send a test capture:**
   - Use real Shortcut → Save to Mind path
   - Choose a note that should clearly be an area or resource

2. **Check producer output:**
   - Look for the file in `mind/01-inbox/`
   - Verify frontmatter includes:
     - `signal_quality: <number>`
     - `status: unrouted` (router not run yet)

3. **Wait for router (1 minute):**
   - Router runs every 60 seconds automatically

4. **Check final location:**
   - High-confidence + high-signal: File moves to appropriate PARA folder
   - High-confidence + low-signal: File stays in 01-inbox with review-queue
   - Router log: Check `~/.local/share/brain/logs/auto-router.log`

---

## Current Production State (Pre-Fix)

### What's Already Deployed
- ✅ Router status insertion: Working
- ✅ Router fail-safe: Working (catches missing signal_quality)
- ✅ Router observability: Working (logs missing signal_quality)
- ✅ Router formatting: Working (proper frontmatter structure)
- ✅ Documentation: Updated and accurate

### What's Blocked on n8n Patch
- ⏳ Producer signal_quality: PENDING n8n UI patch
- ⏳ Normal PARA routing: BLOCKED (fail-safe keeping everything in review-queue)

### Safety Assessment
- ✅ System is SAFE to use (nothing breaks)
- ✅ Captures are PRESERVED (nothing lost)
- ⚠️  Routing is BLOCKED (everything stays in inbox for review)
- ⚠️  User must manually route high-quality captures until n8n patch is applied

---

## Files Modified

### Brain Repo (Deployed)
```
✅ tools/scripts/mind-auto-router.py
   - Fixed status insertion bug
   - Added observability for missing signal_quality
   - Deployed commit: 4fb0b87c

✅ operations/runbooks/n8n-mind-inbox.md
   - Updated to reflect actual producer/router contract
   - Deployed commit: eb636fd5

📄 operations/automations/n8n/SIGNAL-QUALITY-FIX.md
   - MANUAL APPLICATION GUIDE (new file)
   - Deployed commit: eb636fd5

📄 operations/automations/n8n/workflows/mind-inbox-fixed.json
   - Pre-built fixed workflow (reference)
   - Deployed commit: eb636fd5

📄 operations/patches/n8n-mind-inbox-signal-quality-fix.md
   - Detailed patch documentation (reference)
   - Deployed commit: eb636fd5
```

### Mind Repo (Deployed)
```
✅ README.md
   - Updated to reflect signal_quality in captures
   - Deployed commit: 2acfeb7
```

---

## Next Steps

1. **Apply the n8n fix manually:**
   - Follow instructions in: `operations/automations/n8n/SIGNAL-QUALITY-FIX.md`
   - Estimated time: 5 minutes

2. **Verify with one test capture:**
   - Send a real Shortcut capture
   - Confirm signal_quality is present
   - Confirm routing works correctly

3. **Monitor router logs:**
   - `tail -f ~/.local/share/brain/logs/auto-router.log`
   - Should show zero "signal_quality missing" warnings after fix

4. **Production ready:**
   - All captures will route automatically
   - System scales to normal operations

---

## Summary

| Component | Status | Evidence |
|-----------|--------|----------|
| Problem identified | ✅ DONE | Code analysis shows missing extraction |
| Root cause found | ✅ DONE | Line 4-5 of Build Processed Note node |
| Router fix deployed | ✅ DONE | Commits 4fb0b87c (status), formatting |
| Documentation updated | ✅ DONE | Commits eb636fd5, 2acfeb7 |
| Producer fix documented | ✅ DONE | SIGNAL-QUALITY-FIX.md ready |
| Producer fix applied | ⏳ PENDING | Requires manual n8n UI edit |
| End-to-end verified | ⏳ PENDING | After n8n patch applied |

---

**To proceed:** Apply the n8n patch following the guide in `operations/automations/n8n/SIGNAL-QUALITY-FIX.md`, then send one real Shortcut capture to verify end-to-end routing.
