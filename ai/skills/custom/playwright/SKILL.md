---
name: playwright
description: Use for browser automation, scraping, testing, screenshots, PDFs, form filling, and browser-based workflows with the Playwright CLI.
---

# Playwright CLI Skill

Use this skill when the user wants to automate browser tasks, scraping, testing, or browser-based automation with Playwright.

## Context

Playwright is installed globally at version 1.59.1. Use for:
- **Headless browser automation** — running scripts without a GUI
- **Web scraping** — extracting data from sites (e.g., ING bank statements)
- **Testing** — running E2E tests against web apps
- **Screenshots/PDFs** — automating visual capture
- **Form filling & interaction** — automating user actions

## Common patterns

### Quick script (Node.js)
```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');
  await page.screenshot({ path: 'screenshot.png' });
  await browser.close();
})();
```

### Using Playwright Test (CLI)
```bash
npm create playwright@latest
npx playwright test
npx playwright show-report
```

### Headless automation (no GUI)
```bash
npx playwright codegen https://example.com  # Generate code by recording
npx playwright install                       # Install browser binaries
```

## Integration with brain

- **Nightly scheduler**: Use in shell scripts executed by `office-nightly-scheduler.plist`
- **Bank automation**: See `ING bank statement downloader` (in projects, reference pattern)
- **Project-specific**: Add to individual repo `CLAUDE.md` if project needs browser automation

## Key files

- Installation: global `npm install -g playwright`
- Test runner: `npx playwright test` (if in a Playwright project)
- Code generation: `npx playwright codegen <url>` (record interactions)
- Browsers: `~/.cache/ms-playwright/` (auto-downloaded on first use)

## When to use Claude for Playwright

1. **Generate scripts** — describe what you want (e.g., "log into bank, download statements as CSV")
2. **Fix bugs** — paste error, ask for diagnosis
3. **Test generation** — describe the flow, Claude writes `.spec.ts`
4. **Integration help** — connect Playwright scripts to your nightly scheduler or n8n workflows

## References

- [Playwright docs](https://playwright.dev)
- [Codegen guide](https://playwright.dev/docs/codegen)
- [Best practices](https://playwright.dev/docs/best-practices)

## ING bank statement example

Your existing ING downloader likely uses:
```javascript
const { chromium } = require('playwright');
const fs = require('fs');

const browser = await chromium.launch();
const page = await browser.newPage();
// 1. Navigate to ING login
// 2. Fill credentials
// 3. Navigate to statements
// 4. Download each statement
// 5. Save locally
```

For improvements or changes, describe the desired behavior and Claude will help refactor or extend it.
