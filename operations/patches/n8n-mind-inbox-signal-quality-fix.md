# n8n Mind Inbox Workflow: Add signal_quality Field

**Workflow:** Mind Inbox — Capture & Classify with Signal Scoring  
**Workflow ID:** FwP5INe9qoo1OwGC  
**Issue:** `signal_quality` is requested from Gemini but not extracted or included in the markdown frontmatter

## Problem

The "Build Processed Note" code node:
1. ✅ Gemini is asked to return `signal_quality` (in prompt schema)
2. ❌ Code never extracts `signal_quality` from Gemini response
3. ❌ Markdown frontmatter never includes `signal_quality` field

Result: All captures arrive without `signal_quality`, router applies fail-safe, captures stay in review-queue instead of routing to PARA folders.

## Solution

**In n8n UI:**
1. Go to: https://n8n.prochat.tools/workflows
2. Find and open: "Mind Inbox — Capture & Classify with Signal Scoring" (ID: FwP5INe9qoo1OwGC)
3. Find the "Build Processed Note" code node
4. **Change line 4-5 FROM:**
```javascript
let ptype = "inbox", conf = 0.5, summ = "", kpts = [];
if (cls) try { const p = JSON.parse(cls); ptype = p.para_type || "inbox"; conf = p.confidence || 0.5; summ = p.summary || ""; kpts = p.key_points || []; } catch (e) {}
```

5. **Change TO:**
```javascript
let ptype = "inbox", conf = 0.5, sq = 0.5, summ = "", kpts = [];
if (cls) try { const p = JSON.parse(cls); ptype = p.para_type || "inbox"; conf = p.confidence || 0.5; sq = p.signal_quality || 0.5; summ = p.summary || ""; kpts = p.key_points || []; } catch (e) {}
```

6. **Change line 25-26 FROM:**
```javascript
const md = `---\ntype: capture\nsource: ${source}\npara_type: ${ptype}\nconfidence: ${conf}\ntitle: ${JSON.stringify(title)}\ncreated: ${new Date().toISOString()}\n---\n\n# ${title}\n\n## Summary\n${summ}\n\n## Key Points\n${kpts.map(p => `- ${p}`).join('\n')}\n\n## Content\n${content}\n`;
```

7. **Change TO:**
```javascript
const md = `---\ntype: capture\nsource: ${source}\npara_type: ${ptype}\nconfidence: ${conf}\nsignal_quality: ${sq}\ntitle: ${JSON.stringify(title)}\ncreated: ${new Date().toISOString()}\n---\n\n# ${title}\n\n## Summary\n${summ}\n\n## Key Points\n${kpts.map(p => `- ${p}`).join('\n')}\n\n## Content\n${content}\n`;
```

8. Click "Save" (top-left)
9. Verify workflow is "Active" (toggle, top-right)
10. Test via webhook

## What This Changes

**Before:**
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

**After:**
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

## Impact

- ✅ Router will now have `signal_quality` for high-quality captures
- ✅ High-confidence + high-signal captures will route to 03-projects, 05-areas, 06-resources
- ✅ Router fail-safe still applies to incomplete captures
- ✅ No breaking changes to existing captures or router logic
