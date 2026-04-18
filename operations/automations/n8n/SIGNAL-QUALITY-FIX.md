# N8N Mind Inbox: Add signal_quality Field to Captures

**Status:** REQUIRES MANUAL APPLICATION  
**Workflow:** Mind Inbox — Capture & Classify with Signal Scoring  
**Workflow ID:** FwP5INe9qoo1OwGC  
**Date:** 2026-04-18  
**Impact:** Enables proper PARA routing for high-quality captures

## Problem

The n8n workflow asks Gemini to compute `signal_quality` (content quality 0.0–1.0), but the "Build Processed Note" code node never extracts or includes it in the output markdown. Result: all captures arrive without `signal_quality`, causing the router to apply fail-safe logic and keep everything in review-queue instead of routing to PARA folders.

## Evidence

- Gemini prompt explicitly asks for `signal_quality` in classification schema
- "Build Processed Note" code extracts `para_type`, `confidence`, `summary`, `key_points`
- **`signal_quality` is never extracted or written to frontmatter**
- All real Shortcut captures (3 verified) lacked this field

## Solution

### Manual UI Patch

1. **Open n8n UI:**
   - Go to: https://n8n.prochat.tools
   - Log in if needed

2. **Find the workflow:**
   - Search for or navigate to: "Mind Inbox — Capture & Classify with Signal Scoring"
   - Click to open the workflow editor

3. **Locate the "Build Processed Note" code node**
   - This is the code node between "Gemini Classify" and "Check Existing GitHub File"

4. **Replace the node code:**
   - Click inside the code editor
   - Select all (Ctrl/Cmd+A)
   - Delete all existing code
   - Paste the fixed code from section below

5. **Save the workflow:**
   - Click "Save" (top-left button)
   - Confirm the workflow is "Active" (toggle should show green, top-right)

6. **Test:**
   - Use the real Shortcut / Save to Mind path
   - Verify the capture includes `signal_quality` field in frontmatter

### Fixed Code for "Build Processed Note" Node

Replace all code in the node with this:

```javascript
function utf8ToBase64(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) { bytes.push(code); } 
    else if (code < 0x800) { bytes.push(0xc0 | (code >> 6)); bytes.push(0x80 | (code & 0x3f)); } 
    else if (code >= 0xd800 && code <= 0xdbff) { i++; const next = str.charCodeAt(i); const fullCode = 0x10000 + (((code & 0x3ff) << 10) | (next & 0x3ff)); bytes.push(0xf0 | (fullCode >> 18)); bytes.push(0x80 | ((fullCode >> 12) & 0x3f)); bytes.push(0x80 | ((fullCode >> 6) & 0x3f)); bytes.push(0x80 | (fullCode & 0x3f)); } 
    else { bytes.push(0xe0 | (code >> 12)); bytes.push(0x80 | ((code >> 6) & 0x3f)); bytes.push(0x80 | (code & 0x3f)); }
  }
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) { const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2]; output += chars[a >> 2]; output += chars[((a & 3) << 4) | ((b ?? 0) >> 4)]; output += b === undefined ? "=" : chars[((b & 15) << 2) | ((c ?? 0) >> 6)]; output += c === undefined ? "=" : chars[c & 63]; }
  return output;
}
const orig = $("Build Gemini Body").first().json, title = orig.title || "Untitled Capture", content = orig.content || "", source = orig.source || "chatgpt", date = orig.date;
const gmini = $json, cls = gmini.candidates?.[0]?.content?.parts?.[0]?.text;
let ptype = "inbox", conf = 0.5, sq = 0.5, summ = "", kpts = [];
if (cls) try { const p = JSON.parse(cls); ptype = p.para_type || "inbox"; conf = p.confidence || 0.5; sq = p.signal_quality || 0.5; summ = p.summary || ""; kpts = p.key_points || []; } catch (e) {}
const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "untitled-capture";
const file = `01-inbox/${date}-${slug}.md`;
const md = `---\ntype: capture\nsource: ${source}\npara_type: ${ptype}\nconfidence: ${conf}\nsignal_quality: ${sq}\ntitle: ${JSON.stringify(title)}\ncreated: ${new Date().toISOString()}\n---\n\n# ${title}\n\n## Summary\n${summ}\n\n## Key Points\n${kpts.map(p => `- ${p}`).join('\n')}\n\n## Content\n${content}\n`;
const b64 = utf8ToBase64(md);
return [{json: {...orig, title, content, source, date, filepath: file, markdown: md, base64: b64, paraType: ptype, confidence: conf, summary: summ, keyPoints: kpts, signalQuality: sq}}];
```

### Changes Made

| Line | Before | After | Note |
|------|--------|-------|------|
| 4 | `let ptype = "inbox", conf = 0.5, summ = "", kpts = [];` | `let ptype = "inbox", conf = 0.5, sq = 0.5, summ = "", kpts = [];` | Add sq variable |
| 5 | `...conf = p.confidence \|\| 0.5; summ = p.summary...` | `...conf = p.confidence \|\| 0.5; sq = p.signal_quality \|\| 0.5; summ = p.summary...` | Extract signal_quality |
| 8 | `const md = \`---\ntype: capture\nsource: ${source}\npara_type: ${ptype}\nconfidence: ${conf}\n...` | `const md = \`---\ntype: capture\nsource: ${source}\npara_type: ${ptype}\nconfidence: ${conf}\nsignal_quality: ${sq}\n...` | Add to frontmatter |

## Result

### Before
```yaml
---
type: capture
source: shortcut
para_type: area
confidence: 0.92
title: "Example"
created: 2026-04-18T08:34:23.808Z
---
```

### After
```yaml
---
type: capture
source: shortcut
para_type: area
confidence: 0.92
signal_quality: 0.88
title: "Example"
created: 2026-04-18T08:34:23.808Z
---
```

## Verification

After applying the fix:

1. Send one real Shortcut capture
2. Check `01-inbox/` for the new file
3. Verify frontmatter includes `signal_quality: <number>`
4. Wait for router cron (1 minute)
5. Verify:
   - If `confidence >= 0.8` AND `signal_quality >= 0.8`: file moves to 03-projects/05-areas/06-resources (based on para_type)
   - If `confidence >= 0.8` AND `signal_quality < 0.8`: file stays in 01-inbox with status review-queue (fail-safe)
   - Status field is present: review-queue or ready-for-review or archived-*

## Safety

- ✅ Only changes code node; no workflow structure changes
- ✅ Fallback values (0.5) ensure router always has a value
- ✅ Router's fail-safe logic unchanged
- ✅ No breaking changes to existing captures or router behavior
- ✅ Gemini already returns signal_quality; we're just extracting it

## Notes

- Fixed workflow file saved to: `/Users/Office/Repos/stevewesthoek/brain/operations/automations/n8n/workflows/mind-inbox-fixed.json`
- This fix is independent of router changes (which are already deployed)
- Router can safely handle captures with or without signal_quality (fail-safe applies)
