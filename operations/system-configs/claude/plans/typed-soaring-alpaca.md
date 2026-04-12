# Plan: Sessions Tab — Single "Open in Ghostty" Deep Link Button

## Context
The sessions tab currently shows two buttons per session card: "Copy" and "Open in Ghostty".  
The "Open in Ghostty" button only copies the command to the clipboard and brings Ghostty to focus — the user still has to paste manually. The goal is a single button that opens a new Ghostty window, `cd`s into the right repo, and resumes the exact session for the right tool, ready to continue. No clipboard, no paste, no extra steps.

## What needs to change

### 1. `src/services/control-plane.ts`

**Add two fields to `ContinuationCard` interface:**
```typescript
export interface ContinuationCard {
  ...existing fields...
  resumeTarget: string;   // raw ID used by the tool (session UUID for Claude/Codex, "1"/"2" for Gemini)
  directCommand: string;  // e.g. "claude --resume <id>" or "codex resume <id>"
}
```

**Add `buildDirectCommand()` helper:**
```typescript
function buildDirectCommand(session: SessionSummary): string {
  if (session.tool === "claude") return `claude --resume ${session.resumeTarget}`;
  if (session.tool === "codex") return `codex resume ${session.resumeTarget}`;
  return `gemini --resume ${session.resumeTarget}`;  // Gemini uses numeric index
}
```

**Update `buildRecentContinuationCards()`** (~line 376) to propagate these fields:
```typescript
{
  ...existing fields...
  resumeTarget: ranked.session.resumeTarget,
  directCommand: buildDirectCommand(ranked.session),
}
```

---

### 2. `src/bot/dashboard.ts` — server-side

**Replace `openGhosttyWithPreparedCommand(command)` (line 99)** with a new function `openGhosttySession(directCommand, cwd)` that actually runs the session:

```typescript
async function openGhosttySession(directCommand: string, cwd: string): Promise<void> {
  // Validate inputs
  if (!directCommand.trim()) throw new Error("directCommand is empty.");
  if (!cwd.trim()) throw new Error("cwd is empty.");
  
  // Find the ghostty binary
  const candidates = [
    "/Applications/Ghostty.app/Contents/MacOS/ghostty",
    path.join(os.homedir(), "Applications/Ghostty.app/Contents/MacOS/ghostty"),
  ];
  const ghosttyBin = candidates.find((p) => fs.existsSync(p)) ?? "ghostty";
  
  // Launch a new Ghostty window: cd to cwd, then run the tool's resume command
  // Use execFile to avoid shell injection; pass via zsh -i -c so PATH/env is loaded
  const shellCmd = `cd ${JSON.stringify(cwd)} && ${directCommand}`;
  await execFileAsync(ghosttyBin, ["--", "zsh", "-i", "-c", shellCmd]);
}
```

Why `zsh -i -c`: the interactive (`-i`) flag loads `.zshrc`, which ensures `claude`, `codex`, `gemini` are on PATH.

**Update `/api/local/ghostty` endpoint** (line 2138) to accept `{ directCommand, cwd }`:
```typescript
const parsed = JSON.parse(body) as { directCommand?: string; cwd?: string };
if (!parsed.directCommand || !parsed.cwd) { ...400... }
await openGhosttySession(parsed.directCommand, parsed.cwd);
```

---

### 3. `src/bot/dashboard.ts` — client-side JavaScript

**Update `openGhostty(btn, directCommand, cwd)` function** (line 1629):
```javascript
async function openGhostty(btn, directCommand, cwd) {
  const old = btn.textContent; btn.textContent = 'Opening…';
  try {
    const r = await fetch('/api/local/ghostty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directCommand, cwd })
    });
    if (r.status === 403) { btn.textContent = 'Desktop only'; }
    else if (!r.ok) throw new Error('HTTP ' + r.status);
    else btn.textContent = 'Opened ✓';
  } catch(e) { btn.textContent = 'Failed'; }
  setTimeout(() => { btn.textContent = old; }, 2000);
}
```

**Update `continuationItem(s)` function** (line 1674):
- Remove the `<code class="si-cmd">` display
- Remove the "Copy" button
- Single "Open in Ghostty" button that passes `s.directCommand` and `s.cwd`:

```javascript
function continuationItem(s) {
  const tc = s.tool==='claude'?'b-claude':s.tool==='codex'?'b-codex':'b-gemini';
  const tl = s.tool==='claude'?'Claude':s.tool==='codex'?'Codex':'Gemini';
  return '<div class="si">'
    + '<div class="si-hd">'
    + '<span class="badge '+tc+'">'+tl+'</span>'
    + '<span class="si-repo">'+esc(s.projectLabel)+'</span>'
    + '<span class="badge b-intent">'+esc(s.intentLabel)+'</span>'
    + (s.activeInTmux ? '<span class="badge b-live">live</span>' : '')
    + '<span class="si-age">'+esc(s.age)+'</span>'
    + '</div>'
    + '<div class="si-hl">'+esc(s.headline)+'</div>'
    + '<div class="si-ft">'
    + '<button class="btn-sm" data-cmd="'+attr(s.directCommand)+'" data-cwd="'+attr(s.cwd)+'" '
    + 'onclick="openGhostty(this,this.dataset.cmd,this.dataset.cwd)">Open in Ghostty</button>'
    + '</div></div>';
}
```

---

## Files to modify
- `src/services/control-plane.ts` — add fields to interface + helper + propagation
- `src/bot/dashboard.ts` — server function, API endpoint, client JS, UI rendering

## Verification
1. `cd /Users/Office/Repos/stevewesthoek/brain/projects/probot && npm run build` — must compile clean
2. Restart the ProBot daemon (`node dist/index.js` or via launchd)
3. Open dashboard → Sessions tab → click "Open in Ghostty" on any session card
4. Verify: new Ghostty window opens, `cd`s into the repo, and `claude --resume <id>` (or codex/gemini) runs immediately
