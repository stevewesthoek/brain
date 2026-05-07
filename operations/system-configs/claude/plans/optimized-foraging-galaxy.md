# Plan: Three Quick Wins for /web Orchestrator

## Context

Following a comparison of Scrapling vs the existing `/web` stack, the decision was to NOT integrate Scrapling (too much overlap, wrong problem space) but instead extract its best practices and apply them to the existing Playwright-based workflow. Three concrete gaps were identified:

1. **No anti-bot guidance** — The web orchestrator only says "use handoff for CAPTCHA." No proactive evasion strategies documented anywhere.
2. **No checkpoint/resume** — Playwright scripts restart from zero on failure. No mid-run state persistence.
3. **No selector recovery** — Scripts hard-fail on selector changes. No fallback chain.

Both files that cover Playwright are thin on these topics:
- `brain/ai/skills/custom/web/SKILL.md` — 419 lines, has 3 sparse mentions of anti-bot (all just "use handoff"), zero on checkpoints, zero on selector recovery
- `brain/operations/runbooks/playwright.md` — 150 lines, one throwaway line on selectors, nothing on anti-bot or checkpointing

No `/playwright` skill directory exists — all Playwright knowledge lives in Workflow D of the web orchestrator and the runbook.

---

## What Gets Changed

| File | Change |
|------|--------|
| `brain/ai/skills/custom/web/SKILL.md` | 3 targeted additions (see below) |
| `brain/operations/runbooks/playwright.md` | 3 new sections appended |

No new files. No new skills. No config changes. No skill sync needed.

---

## Change 1: Anti-Bot Best Practices

### In `web/SKILL.md`

**Location:** Standing Web Laws (lines 31–43) — expand the sparse "Handoff for CAPTCHA" law into a proper **"Anti-Bot: Proactive first, handoff last"** law.

Replace the single-liner:
```
- **Handoff for CAPTCHA or MFA.**
```
With a proper multi-line law:
```
- **Anti-Bot: Proactive first, handoff last.** Before reaching for handoff, apply these in order:
  1. Use cookie-import (real browser session — most effective, already documented)
  2. Add randomized delays: `await page.waitForTimeout(Math.random() * 3000 + 1500)`
  3. Rotate user-agent via `page.setExtraHTTPHeaders` or context `userAgent` option
  4. Use Apify if the site has aggressive cloud-based blocking (cloud proxy beats local evasion)
  5. Handoff only as last resort: `browse handoff "blocked — complete challenge"`
```

**Location:** Workflow D: Reusable Automation — after the script anatomy block, add a new **Anti-Bot Techniques** subsection (D3.5, before "D4. Wire to scheduler").

Content: concrete Playwright snippets for delays, user-agent rotation, viewport randomization, and disabling `navigator.webdriver`.

### In `playwright.md` runbook

Append a new **"Anti-Bot Techniques"** section with:
- Randomized delay snippet
- User-agent rotation (3–4 realistic UAs)
- Viewport randomization
- Disable automation flags (`--disable-blink-features=AutomationControlled`)
- When to escalate to Apify (rule of thumb: if local evasion fails after 2 attempts, use Apify)

---

## Change 2: Checkpoint/Resume Template

### In `web/SKILL.md`

**Location:** Workflow D — after the current script anatomy block (lines 231–259), add a new **Checkpoint Pattern** code block showing the 3-function pattern (load, save, cleanup) and how to wire it into the main loop.

Wire it naturally into the script anatomy as a named pattern the AI should use when generating scripts for bulk/multi-step operations.

Key rule to add to Standing Web Laws (or Workflow D preamble):
```
- **Checkpoint bulk scripts.** Any Playwright script processing 10+ items or expected to run >2 minutes
  should use checkpoint/resume. Save state every N items. Resume from last checkpoint on restart.
```

### In `playwright.md` runbook

Append a **"Checkpoint / Resume Pattern"** section with a complete, copy-paste-ready template:
```javascript
const CHECKPOINT = './.scrape-checkpoint.json';

function loadCheckpoint() {
  return fs.existsSync(CHECKPOINT)
    ? JSON.parse(fs.readFileSync(CHECKPOINT, 'utf-8'))
    : { index: 0, results: [] };
}

function saveCheckpoint(state) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify(state, null, 2));
}

// In main loop:
const state = loadCheckpoint();
console.log(`Resuming from item ${state.index}`);

for (let i = state.index; i < items.length; i++) {
  // ... process items[i] ...
  state.results.push(result);
  state.index = i + 1;
  if (i % 10 === 0) saveCheckpoint(state); // save every 10 items
}

fs.unlinkSync(CHECKPOINT); // clean up on completion
```

---

## Change 3: Selector Recovery Wrapper

### In `web/SKILL.md`

**Location:** Workflow D script anatomy — add a note after the selector usage comments that any generated script should use the `findElement()` helper for any selector that touches third-party sites (not your own stable DOM).

Add a concise selector recovery rule to Standing Web Laws:
```
- **Selector fallback for third-party sites.** When writing Playwright scripts against sites you don't control,
  use a fallback chain: exact selector → getByText → getByRole → getByLabel → log + skip/handoff.
  Never let a single stale selector kill an entire run.
```

### In `playwright.md` runbook

Append a **"Selector Recovery (Resilient Element Finding)"** section with a complete `findElement()` helper:

```javascript
async function findElement(page, selector, fallbacks = {}) {
  // 1. Exact selector (fastest)
  try {
    const el = page.locator(selector);
    await el.waitFor({ state: 'visible', timeout: 3000 });
    return el;
  } catch {}

  // 2. By visible text
  if (fallbacks.text) {
    try {
      const el = page.getByText(fallbacks.text, { exact: false });
      await el.waitFor({ state: 'visible', timeout: 3000 });
      return el;
    } catch {}
  }

  // 3. By ARIA role + name
  if (fallbacks.role) {
    try {
      const el = page.getByRole(fallbacks.role, { name: fallbacks.name });
      await el.waitFor({ state: 'visible', timeout: 3000 });
      return el;
    } catch {}
  }

  // 4. By aria-label
  if (fallbacks.label) {
    try {
      const el = page.getByLabel(fallbacks.label);
      await el.waitFor({ state: 'visible', timeout: 3000 });
      return el;
    } catch {}
  }

  // All failed — log context, skip or handoff
  console.error(`[selector-fail] ${selector}`, JSON.stringify(fallbacks));
  return null;
}
```

Usage example:
```javascript
const submitBtn = await findElement(page, '#submit-btn', {
  text: 'Submit',
  role: 'button',
  name: 'Submit',
});
if (!submitBtn) {
  // log and skip, or: await page.pause(); // handoff
} else {
  await submitBtn.click();
}
```

---

## Implementation Order

1. Edit `brain/ai/skills/custom/web/SKILL.md`:
   - Expand Standing Web Laws: anti-bot law + checkpoint law + selector fallback law (3 insertions)
   - Add D3.5 Anti-Bot Techniques subsection in Workflow D
   - Add checkpoint pattern to Workflow D script anatomy

2. Edit `brain/operations/runbooks/playwright.md`:
   - Append "Anti-Bot Techniques" section
   - Append "Checkpoint / Resume Pattern" section
   - Append "Selector Recovery (Resilient Element Finding)" section

3. Commit + push

---

## Verification

- Read both files after editing to confirm all 3 improvements land in the right places
- Check that the Standing Web Laws remain coherent (no duplication, no contradictions)
- Confirm the runbook sections are copy-paste-ready (full code, no TODOs)
- Confirm SKILL.md changes are guidance-level (tell the AI what to do), not code-level (code belongs in the runbook)
