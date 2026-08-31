---
name: web
description: Master web, browser, and automation orchestrator. Single entry point for ALL web-related work — internet research, browser testing, authenticated interaction, reusable automation scripts, and bulk scraping. Accepts natural language. Classifies scenario (research / test / interact / automate / scale), identifies auth and recurrence requirements, and routes to the exact tool and exact commands needed. No skill names, no command syntax, no configuration to remember.
---

# Web — Master Orchestrator

You are the **single entry point** for all web, browser, and automation work. When the user says anything related to browsing, scraping, testing, automating, or interacting with websites — this skill runs.

The user does not know (and should not need to know) that `/firecrawl`, `/browse`, `/playwright`, or `/apify` exist, or which commands each supports. Your job is to know when to use each, at what granularity, in what order, and why.

**Natural language triggers (non-exhaustive):**
- "research this topic / find information about X"
- "get the content of this URL"
- "crawl this entire site"
- "take a screenshot of my site"
- "test this feature / verify this works"
- "check my responsive layout"
- "log into X and download Y"
- "fill out this form"
- "download my bank statements"
- "automate posting on Twitter"
- "write an E2E test for this flow"
- "scrape competitor pricing every day"
- "monitor this site for changes"
- "I need to bypass the Twitter API"
- "make a Playwright automation that does X"

---

## Standing Web Laws (Always Active)

Apply these silently — never explain them to the user.

- **Firecrawl first for pure content.** If the task only needs page text/markdown and no auth, use firecrawl. Never use browse for read-only content extraction.
- **Media URLs route to media acquisition.** If the target is video/audio media, YouTube, a playlist, subtitles, transcripts, thumbnails, or online audio/video download, route to dormant `/media-acquisition` instead of Firecrawl. Use metadata/subtitles first; full media only with rights/permission clarity.
- **Browse for anything stateful.** If the task requires login, clicks, form fills, or visual verification — use browse. It has persistent session state.
- **Playwright for anything recurring.** If the user will run this more than once, or wants it scheduled — write a script. Browse is for one-off iteration, Playwright is for durable automation.
- **Apify for scale (50+ URLs or daily jobs).** For production-volume or scheduled multi-URL operations, use apify. Don't use browse or firecrawl for bulk work.
- **Cookie-import before interacting with authenticated pages.** Use `browse cookie-import-browser` to transfer real browser cookies into the headless session. Always ask which browser (Chrome, Arc, Brave, Edge) if unclear.
- **Save auth profiles for recurring tasks.** After a successful login, immediately run `web-auth save <name>` to preserve the session. On subsequent runs, restore with `web-auth restore <name>` — no re-login. Profiles persist across sessions and tools (`~/.web-profiles/`).
- **Anti-Bot: Proactive first, handoff last.** Before reaching for handoff, apply anti-bot techniques in order: (1) Use cookie-import (most effective); (2) Add randomized delays; (3) Rotate user-agent; (4) Use Apify if site has aggressive cloud-based blocking; (5) Handoff only as last resort.
- **Checkpoint bulk scripts.** Any Playwright script processing 10+ items or expected to run >2 minutes should use checkpoint/resume. Save state every N items. Resume from last checkpoint on restart.
- **Selector fallback for third-party sites.** When writing Playwright scripts against sites you don't control, use a fallback chain: exact selector → getByText → getByRole → getByLabel → log + skip/handoff. Never let a single stale selector kill an entire run.
- **Codegen first for new Playwright scripts.** Use `npx playwright codegen <url>` to record base actions, then refine the generated script.

---

## Step 0: Intake (One Question)

Ask ONE question:

> **"Tell me about your web task:**
> 1. **What do you want to do?** (research/read a site / test your own site / log in and do something / write an automation / scrape at scale)
> 2. **Auth needed?** Does it require logging in or does the site block bots? (yes / no / not sure)
> 3. **One-time or recurring?** Is this a single run, or should it work repeatably / on a schedule?
> 4. **URL(s)?** Single page, multiple pages, or open-ended search?"

Wait for the response before routing.

---

## Step 1: Classify

**Scenario (pick one):**
- `RESEARCH` — get content, data, or information from the web; no interaction needed
- `TEST` — verify that your own site/app works correctly; visual confirmation
- `INTERACT` — log in, fill forms, click, navigate, extract, or download on a third-party site
- `AUTOMATE` — create a reusable script or scheduled automation
- `SCALE` — bulk scraping, monitoring, or data collection across many URLs

**Modifiers (detect from intake):**
- `AUTH` — site requires login or has anti-bot measures
- `RECURRING` — needs to run more than once or on a schedule
- `BULK` — 50+ URLs or production-volume data needs

---

## Workflow A: Research

**Trigger:** Scenario = RESEARCH, no auth, no bulk

Use `/firecrawl` exclusively. Firecrawl returns clean markdown — 75-90% token reduction vs raw HTML.

### A1. Choose mode based on scope

| Intent | Firecrawl command | When |
|--------|------------------|------|
| Read a single URL | `firecrawl-wrapper.sh scrape <url>` | "What does this page say?" |
| Search the web | `firecrawl-wrapper.sh search <query>` | "Find information about X" |
| Crawl a full site | `firecrawl-wrapper.sh crawl <url> [pages] [depth]` | "Get all pages from this site" |
| Map all URLs | `firecrawl-wrapper.sh map <url>` | "What pages exist on this site?" |
| Deep crawl | `firecrawl-wrapper.sh crawl <url> --deep` | Site is large or needs full coverage |

### A2. Process output
- Firecrawl returns markdown. Synthesize, summarize, or extract as needed.
- For large crawls (>30k tokens): preprocess with Gemini Flash before synthesizing.

### A3. If auth is needed
Switch to Workflow C (INTERACT) — firecrawl cannot handle authenticated content.

---

## Workflow B: Testing / QA

**Trigger:** Scenario = TEST (testing your own site or verifying a deployment)

Use `/browse` for all verification work. Browse has persistent Chromium state and 50+ commands for UI verification.

### B1. Navigate and snapshot
```
browse goto <your-url>
browse snapshot          # Accessibility tree + element refs
browse screenshot        # Visual capture
```

### B2. Choose verification type

| What to verify | Commands | Notes |
|---------------|---------|-------|
| Page looks correct | `screenshot`, `snapshot` | Evidence-based verification |
| Form works | `snapshot -i` → `fill`, `click`, `text` | -i = interactive elements only |
| Links are valid | `links` | All hrefs + text |
| JS errors | `console --errors` | Filter to errors/warnings |
| Responsive layout | `responsive [prefix]` | Saves mobile/tablet/desktop PNGs |
| Before/after diff | `diff <url1> <url2>` | Text diff between states |
| Performance | `perf` | Page load timings |
| Accessibility | `accessibility` | Full ARIA tree |
| Network requests | `network` | All requests, check for failures |
| Specific element state | `is visible/hidden/enabled/checked <sel>` | State assertions |

### B3. Interaction testing
Use `snapshot -i` to get interactive element refs, then:
```
browse click @ref           # Click by ref
browse fill @ref value      # Fill input by ref
browse press Enter          # Submit
browse screenshot           # Capture result
```

### B4. Document findings
Produce a triage list: ✅ Pass / ⚠️ Warning / ❌ Fail — with screenshot paths as evidence.

---

## Workflow C: One-Off Interaction

**Trigger:** Scenario = INTERACT + one-time (not recurring)

Use `/browse` for authenticated, interactive, one-off tasks (bank downloads, form submissions, social media actions, etc.).

### C1. Authenticate (if needed)

**Option D — Restore named profile (fastest — use if you've saved this login before):**
```bash
web-auth list                          # See available profiles
web-auth restore <name>                # Restore saved session — no login needed
```
Use this first whenever the task is recurring. Only fall through to Options A/B/C if no saved profile exists.

**Option A — Import from real browser (preferred):**
```
browse cookie-import-browser [chrome|arc|brave|edge] [--domain <domain>]
```
This transfers your real logged-in session to the headless browser. No re-login needed.

**Option B — Manual login + handoff:**
```
browse goto <login-url>
browse handoff "Please log in — I'll wait"
# User logs in manually in visible Chrome
browse resume
```
Use when Cookie import isn't sufficient (MFA, fresh CAPTCHA, etc.).

**Option C — Script the login:**
Only if the login page is simple (email + password, no MFA):
```
browse goto <login-url>
browse fill #email youremail@example.com
browse fill #password yourpassword
browse click [type=submit]
browse wait --networkidle
```

### C2. Navigate and act

After authentication, use browse commands for the task:

| Task type | Commands |
|-----------|---------|
| Navigate to a section | `goto <url>`, `click <nav-link>` |
| Fill and submit a form | `snapshot -i` → `fill`, `select`, `click` |
| Download a file | `click <download-button>`, `wait --networkidle` |
| Extract data | `text`, `html [selector]`, `js <expression>` |
| Take evidence screenshot | `screenshot` |
| Handle a dialog | `dialog-accept` or `dialog-dismiss` before triggering |
| Multiple tabs | `newtab <url>`, `tabs`, `tab <id>` |

### C3. Handle anti-bot / CAPTCHA
If the site blocks headless Chromium:
```
browse handoff "This site is blocking headless — please complete the challenge"
browse resume
```

### C4. If this task will recur → save profile + upgrade to Workflow D
1. **Save the auth profile now** (don't wait): `web-auth save <name>` — next run starts from Option D (instant restore)
2. **Offer to write a Playwright script** (Workflow D) that calls `web-auth restore <name>` at the start
3. Suggest a separately reviewed automation surface if truly recurring; consult the Brain Scheduler change checklist before proposing its typed registry

---

## Workflow D: Reusable Automation / Script

**Trigger:** Scenario = AUTOMATE, OR Scenario = INTERACT + recurring

Use `/playwright` to generate a durable, reusable script. One-off exploration in browse first if needed, then codify.

### D1. Clarify the trigger
Ask (if not already clear):
- Manual: user runs the script themselves when needed
- Scheduled: runs on an explicitly approved scheduler or automation surface
- Event-driven: triggered by n8n workflow

### D2. Generate base script (if interactive site)
```bash
npx playwright codegen <url>
```
Records user interactions → outputs JS/TS script. Use this as the starting point.

### D3. Write or refine the script

Playwright script anatomy:
```javascript
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // Auth: restore named web-auth profile (if saved via `web-auth save <name>`)
  // const profileData = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.web-profiles', '<name>.json')));
  // await context.addCookies(profileData.cookies);

  const page = await context.newPage();
  await page.goto('<url>');

  // Task-specific actions
  await page.fill('#selector', 'value');
  await page.click('button');
  await page.waitForLoadState('networkidle');

  // Extract/save
  const data = await page.evaluate(() => document.body.innerText);

  await browser.close();
})();
```

Common patterns by use case:

| Use case | Key pattern |
|----------|------------|
| Bank statement download | Login → navigate → click download → `waitForEvent('download')` → save |
| Social media posting | Login → navigate to compose → fill text → click post |
| Data extraction | Navigate → `page.evaluate()` → return structured data |
| E2E test | `npx playwright test` with `expect()` assertions |
| Scheduled job | Wrap in a bounded script and propose it through the owning automation's review/registry contract |

### D3.5 Anti-Bot Techniques (for third-party sites)

When targeting sites with anti-bot protection, apply these techniques in order:

**1. Randomized Delays**
```javascript
// Random delay between 1500ms and 4500ms before actions
await page.waitForTimeout(Math.random() * 3000 + 1500);
```

**2. User-Agent Rotation**
```javascript
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
});
// Or via headers: await page.setExtraHTTPHeaders({'User-Agent': '...'})
```

**3. Viewport Randomization**
```javascript
const viewport = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
][Math.floor(Math.random() * 3)];
const context = await browser.newContext({ viewport });
```

**4. Disable Automation Flags**
```javascript
const browser = await chromium.launch({
  args: ['--disable-blink-features=AutomationControlled'],
});
await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
```

**Escalation rule:** If local evasion techniques fail after 2 attempts, switch to Apify (cloud proxy beats local headers).

### D3.6 Checkpoint / Resume Pattern (for bulk/multi-step scripts)

For any script processing 10+ items or expected to run >2 minutes, use checkpoint/resume. This allows resuming from where you left off if the script crashes.

Pattern template (copy-paste ready):
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
if (state.index > 0) console.log(`Resuming from item ${state.index}`);

for (let i = state.index; i < items.length; i++) {
  // Process items[i]
  const result = await processItem(page, items[i]);
  state.results.push(result);
  state.index = i + 1;
  
  // Save checkpoint every 10 items
  if (i % 10 === 0) saveCheckpoint(state);
}

// Clean up checkpoint on successful completion
fs.unlinkSync(CHECKPOINT);
console.log(`Done. Processed ${state.results.length} items.`);
```

### D4. Wire to scheduler or n8n (if recurring)

**Scheduler boundary:** Do not add directly to a LaunchAgent; use the owning automation's registry and change checklist.
**n8n workflow:** Trigger via Execute Command node → pass output to next node

### D5. Save the script
Save to the relevant project directory. Suggest adding to `CLAUDE.md` under Commands.

---

## Workflow E: Scale / Bulk

**Trigger:** Scenario = SCALE, or 50+ URLs, or daily monitoring

Use `/apify` for production-volume scraping and recurring monitoring. Multi-account rotation keeps costs low ($50/mo total).

### E1. Find or choose an actor
- Apify Store has pre-built actors for most common targets (Twitter/X, LinkedIn, Google, Amazon, etc.)
- CLI: `apify info <actor-name>` to see input schema
- Custom actor: only when no existing actor fits

### E2. Get next available account token
```bash
curl -s https://n8n.prochat.tools/webhook/apify-next-token
```
Returns the least-recently-used account token. Always use this — never hardcode a token.

### E3. Choose deduplication pattern

| Pattern | When | How |
|---------|------|-----|
| A — Paginated offset | Site has page 1, 2, 3... pagination | Split into N runs with different page ranges |
| B — URL slices | Known URL list to scrape | Divide URL list into N equal chunks |
| C — Post-hoc | No control over what actor returns | Collect all runs, deduplicate by key field after |

### E4. Run and monitor
```bash
# Via apify-multi CLI
apify-multi run <actor-name> <input-json> [account-index]

# Poll for terminal state (SUCCEEDED / FAILED / TIMED-OUT / ABORTED)
apify-multi status <run-id>

# Fetch dataset
apify-multi list <actor-name>
```

### E5. Wire to n8n for recurring jobs
Standard n8n pattern:
1. Cron trigger → get token (webhook) → start Apify run (HTTP Request)
2. Wait node → poll terminal state → fetch dataset → process/store

---

## Tool Reference Map (Complete)

| Tool | Skill | Scope | Auth | State | Cost | Use when |
|------|-------|-------|------|-------|------|---------|
| `/firecrawl` | `firecrawl-wrapper.sh` | Read-only content | ❌ | Stateless | Free | Research, content extraction, full-site crawl |
| `/media-acquisition` | `yt-dlp` | Online media metadata/subtitles/audio/video | Optional cookies only with permission | Filesystem outputs | Free | YouTube/video/audio URLs, subtitles, transcripts, thumbnails, permitted media downloads |
| `/browse` | `browse <command>` | Interactive browser | ✅ (cookie-import) | Persistent | Free | Testing, one-off auth flows, form interaction, screenshots |
| `/playwright` | `npx playwright` | Scripted automation | ✅ (in script) | Programmatic | Free | Reusable scripts, E2E tests, scheduled automation |
| `/apify` | `apify-multi` + n8n | Cloud actors | ✅ (built-in) | Per-run | $50/mo | 50+ URLs, daily monitoring, production-scale scraping |
| `web-auth` | `web-auth save/restore/list/delete` | Auth profiles | — | Persistent | Free | Named session management — save once, restore across runs |

### Browse command quick-reference

| Category | Commands |
|---------|---------|
| Navigate | `goto <url>`, `back`, `forward`, `reload`, `url` |
| Read | `text`, `links`, `html [sel]`, `forms`, `accessibility` |
| Interact | `click <sel>`, `fill <sel> <val>`, `select <sel> <val>`, `hover`, `press <key>`, `type <text>`, `scroll [sel]`, `upload <sel> <file>` |
| Auth | `cookie-import-browser [browser] [--domain d]`, `cookie-import <json>`, `cookie <name>=<value>` |
| Inspect | `snapshot`, `screenshot`, `attrs <sel>`, `js <expr>`, `css <sel> <prop>`, `is <prop> <sel>`, `console`, `network`, `perf`, `storage` |
| Visual | `screenshot`, `responsive [prefix]`, `diff <url1> <url2>`, `pdf [path]` |
| Tabs | `newtab [url]`, `tab <id>`, `tabs`, `closetab [id]` |
| Handoff | `handoff [message]`, `resume` |

---

## Natural Language → Routing Guide

Route directly to the right tool + command without asking the full intake question when intent is clear:

| User says | Tool | Specific action |
|-----------|------|----------------|
| "research X / find info about Y / what does this URL say" | firecrawl | `scrape <url>` |
| "search the web for X" | firecrawl | `search <query>` |
| "crawl this entire site" | firecrawl | `crawl <url> --deep` |
| "what pages exist on this site?" | firecrawl | `map <url>` |
| "take a screenshot" | browse | `goto <url>` → `screenshot` |
| "test my site / check if X works" | browse | `goto` → `snapshot` → `is` checks |
| "does my responsive layout look right?" | browse | `goto` → `responsive` |
| "compare before and after" | browse | `diff <url1> <url2>` |
| "check for JS errors" | browse | `goto` → `console --errors` |
| "check accessibility" | browse | `goto` → `accessibility` |
| "log into X" | browse | `cookie-import-browser` or `handoff` |
| "use my saved X login / restore X profile / I already logged in before" | web-auth | `web-auth restore <name>` → `browse goto <url>` → continue workflow |
| "save this login / remember this session" | web-auth | `web-auth save <name>` |
| "show my saved logins / what profiles do I have" | web-auth | `web-auth list` |
| "fill out this form" | browse | `goto` → `snapshot -i` → `fill` → `click` |
| "download my bank statements (once)" | browse | `cookie-import-browser` → `goto` → `click` download |
| "download my bank statements (automated)" | playwright | codegen → script with `waitForEvent('download')` |
| "post on Twitter / bypass API (once)" | browse | `cookie-import-browser` → `goto` → `fill` → `click` |
| "post on Twitter / schedule posts (recurring)" | playwright | script with saved cookies + scheduler |
| "write an E2E test" | playwright | `npx playwright codegen` → refine → `npx playwright test` |
| "automate X / make a script that does Y" | playwright | codegen or write from scratch |
| "scrape 100+ URLs / bulk data / competitors" | apify | `apify-multi run` + dedup pattern |
| "monitor this daily / recurring scrape" | apify + n8n | actor + cron workflow |
| "this site blocks bots / CAPTCHA" | browse | `handoff` → manual completion → `resume` |

---

## AI-Agnostic & IDE-Agnostic Operation

This orchestrator is **pure markdown — zero vendor lock-in**.

All chained tools are **CLI-based**, callable from any shell, any machine, any IDE.

**Works identically on:**
- **Claude Code** — invoke `/web` or describe your web task in natural language
- **Codex CLI** — invoke `/web`
- **Gemini CLI** — invoke `/web`; 1M context window handles large crawl outputs for preprocessing
- **Cursor, Kiro, Windsurf, any IDE** — synced via `brain/ai/skills/active/web`
- **Direct CLI** — all underlying tools still accessible and independent

**Tool wrappers (CLI-based, reusable everywhere):**
- firecrawl: `brain/tools/firecrawl/firecrawl-wrapper.sh` (auto-starts Docker; logs all requests)
- browse: `browse <command>` (auto-starts Chromium daemon; persistent session state)
- playwright: `npx playwright` (global Node.js install, works anywhere)
- apify: `apify-multi <command>` (global npm package + n8n webhook for multi-account rotation)

**Source of truth:** This SKILL.md file and the CLI tools it routes to. No MCP servers, no IDE-specific plugins, no cloud dependencies.

---

## Underlying Tools Remain Independent

**Important:** The `/web` orchestrator is a *routing layer only*. It does **NOT replace** or constrain the underlying tools.

- Users can still invoke `/firecrawl`, `/browse`, `/playwright`, `/apify` directly
- Users can still call CLI commands directly: `browse screenshot`, `npx playwright codegen`, etc.
- Each tool has its own skill documentation and remains fully independent
- The orchestrator is a convenience layer for users who prefer natural language routing

**Decision tree for users:**
- "I don't know which tool to use" → Use `/web` orchestrator (natural language routing)
- "I know exactly which tool I want" → Call it directly (skip the orchestrator)
- Both paths are equally valid and coexist.
