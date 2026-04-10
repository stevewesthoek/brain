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

## Links

- [Playwright API docs](https://playwright.dev/docs/api/class-page)
- [Selectors guide](https://playwright.dev/docs/locators)
- [Best practices](https://playwright.dev/docs/best-practices)
- [Debugging](https://playwright.dev/docs/debug)
