# Playwright CLI Runbook

## Installation & Status

- **Installed globally**: `npm install -g playwright` (Version 1.59.1)
- **Verify**: `playwright --version`
- **Browser cache**: `~/.cache/ms-playwright/` (auto-populated on first use)

## Quick Start

### Test if installed
```bash
playwright --version
```

### Run a recording (interactive)
```bash
npx playwright codegen https://example.com
```
This opens a browser where you interact, and Playwright records your actions as code.

### Create a Playwright project
```bash
npm create playwright@latest my-tests
cd my-tests
npx playwright test
npx playwright show-report
```

### Run a script
```bash
node my-script.js
```

## Common use cases

### 1. Bank statement download (ING example)
Script pattern for nightly scheduler:
```javascript
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Log in
  await page.goto('https://banking.ingdirect.nl');
  await page.fill('input[name="username"]', process.env.ING_USER);
  await page.fill('input[type="password"]', process.env.ING_PASS);
  await page.click('button[type="submit"]');
  
  // Download statements
  await page.goto('https://banking.ingdirect.nl/statements');
  const links = await page.locator('a:has-text("Download")').all();
  
  for (const link of links) {
    const downloadPromise = page.waitForEvent('download');
    await link.click();
    const download = await downloadPromise;
    await download.saveAs(`./statements/${download.suggestedFilename()}`);
  }
  
  await browser.close();
})();
```

### 2. Screenshot automation
```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');
  await page.screenshot({ path: 'screenshot.png', fullPage: true });
  await browser.close();
})();
```

### 3. Web scraping
```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');
  
  const data = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.item')).map(el => ({
      title: el.querySelector('.title').textContent,
      price: el.querySelector('.price').textContent,
    }));
  });
  
  console.log(data);
  await browser.close();
})();
```

## Nightly scheduler integration

To run a Playwright script via nightly scheduler:

1. Place script in a repo (e.g., `scripts/download-statements.js`)
2. Add to `office-nightly-scheduler.sh`:
```bash
# Download bank statements
node ~/Repos/prochattools/ops/probot/scripts/download-statements.js
```

3. Ensure `node_modules/playwright` or global `playwright` is available
4. Set environment variables in `.env` or shell:
```bash
export ING_USER="your-user"
export ING_PASS="your-pass"
```

## Debugging

### Browser won't launch
```bash
playwright install  # Download browser binaries
```

### Script hangs
- Add timeout: `await page.goto(url, { timeout: 30000 })`
- Check selectors: `npx playwright codegen` to record and verify

### Taking screenshots
```bash
playwright show-trace trace.zip  # View recorded trace
```

## Environment setup

For automation that needs credentials:
```bash
# In your nightly script or .env
export BROWSER_USER="username"
export BROWSER_PASS="password"
```

---

## Anti-Bot Techniques

When targeting sites with anti-bot protection, apply these techniques:

### Randomized Delays

Add random delays between 1500ms and 4500ms before key actions to avoid detection:
```javascript
await page.waitForTimeout(Math.random() * 3000 + 1500);
```

### User-Agent Rotation

Rotate between realistic user agents. Examples:
```javascript
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
];

const context = await browser.newContext({
  userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
});
```

### Viewport Randomization

Randomize browser viewport to avoid fingerprinting:
```javascript
const viewports = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
];

const context = await browser.newContext({
  viewport: viewports[Math.floor(Math.random() * viewports.length)],
});
```

### Disable Automation Flags

Hide the fact that Playwright is controlling the browser:
```javascript
const browser = await chromium.launch({
  args: ['--disable-blink-features=AutomationControlled'],
});

await page.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => false });
});
```

### Escalation Rule

**Rule:** If local evasion fails after 2 attempts, use Apify instead. Cloud proxy (Apify) beats local headers for aggressive anti-bot sites.

---

## Checkpoint / Resume Pattern

For bulk operations (10+ items or >2 minutes runtime), use checkpoints to resume from the last saved state on failure.

### Complete Template

```javascript
const fs = require('fs');
const path = require('path');

const CHECKPOINT = './.scrape-checkpoint.json';

function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf-8'));
  }
  return { index: 0, results: [] };
}

function saveCheckpoint(state) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify(state, null, 2));
}

(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const items = ['item1', 'item2', 'item3', /* ... many more items ... */];
  const state = loadCheckpoint();
  
  if (state.index > 0) {
    console.log(`Resuming from item ${state.index} (already processed ${state.index})`);
  }

  for (let i = state.index; i < items.length; i++) {
    try {
      const item = items[i];
      
      // Process the item
      await page.goto(`https://example.com/item/${item}`);
      const data = await page.evaluate(() => ({
        title: document.querySelector('h1')?.textContent,
        price: document.querySelector('.price')?.textContent,
      }));
      
      state.results.push({ item, ...data });
      state.index = i + 1;
      
      // Save checkpoint every 10 items
      if (i % 10 === 0) {
        saveCheckpoint(state);
        console.log(`[checkpoint] Saved progress: ${state.index}/${items.length}`);
      }
    } catch (err) {
      console.error(`Error processing item ${i}:`, err.message);
      saveCheckpoint(state); // save before crashing
      throw err; // re-throw so script exits (will resume next run)
    }
  }

  // Successful completion: clean up checkpoint
  fs.unlinkSync(CHECKPOINT);
  console.log(`✓ Done. Processed ${state.results.length} items.`);
  console.log(JSON.stringify(state.results, null, 2));

  await browser.close();
})();
```

### Usage

```bash
# First run: starts from item 0
node scrape.js

# If it crashes mid-way, the checkpoint is saved
# Second run: resumes from where it left off
node scrape.js

# On success: checkpoint is deleted, ready for next batch
```

---

## Selector Recovery (Resilient Element Finding)

When targeting third-party sites where selectors might change, use a fallback chain instead of hard-failing on the first selector miss.

### Helper Function

```javascript
async function findElement(page, selector, fallbacks = {}) {
  // 1. Exact selector (fastest, preferred if the site is under your control)
  try {
    const el = page.locator(selector);
    await el.waitFor({ state: 'visible', timeout: 3000 });
    return el;
  } catch {}

  // 2. Find by visible text (works across DOM changes)
  if (fallbacks.text) {
    try {
      const el = page.getByText(fallbacks.text, { exact: false });
      await el.waitFor({ state: 'visible', timeout: 3000 });
      console.log(`[fallback] Found by text: "${fallbacks.text}"`);
      return el;
    } catch {}
  }

  // 3. Find by ARIA role + name (semantic, resilient to CSS changes)
  if (fallbacks.role) {
    try {
      const el = page.getByRole(fallbacks.role, { name: fallbacks.name });
      await el.waitFor({ state: 'visible', timeout: 3000 });
      console.log(`[fallback] Found by role: ${fallbacks.role} "${fallbacks.name}"`);
      return el;
    } catch {}
  }

  // 4. Find by aria-label (attribute-based, very resilient)
  if (fallbacks.label) {
    try {
      const el = page.getByLabel(fallbacks.label);
      await el.waitFor({ state: 'visible', timeout: 3000 });
      console.log(`[fallback] Found by label: "${fallbacks.label}"`);
      return el;
    } catch {}
  }

  // All fallbacks exhausted — log failure with context for manual review
  console.error(`[selector-fail] Could not find: ${selector}`, JSON.stringify(fallbacks));
  return null; // caller decides: skip, log, or handoff
}
```

### Usage Example

```javascript
// Click a submit button with multiple ways to find it
const submitBtn = await findElement(page, '#submit-btn', {
  text: 'Submit',
  role: 'button',
  name: 'Submit',
  label: 'Submit form',
});

if (!submitBtn) {
  console.log('Submit button not found. Handing off to user...');
  await page.pause(); // handoff to manual control
} else {
  await submitBtn.click();
}
```

---

## Links

- [Playwright API docs](https://playwright.dev/docs/api/class-page)
- [Selectors guide](https://playwright.dev/docs/locators)
- [Best practices](https://playwright.dev/docs/best-practices)
- [Debugging](https://playwright.dev/docs/debug)
