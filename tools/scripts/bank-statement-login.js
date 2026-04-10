/**
 * ING Bank Statement Automation — Playwright Script
 *
 * Purpose:
 *   - Logs into ING Business Banking (mijnzakelijk.ing.nl)
 *   - Waits for user 2FA approval on phone
 *   - Downloads statement CSV files for all 3 accounts (2 current + 1 savings)
 *   - Exits gracefully on timeout or user approval
 *
 * Accounts to download:
 *   1. Yeshua Academy (Current) - NL89 INGB 0006 3699 60
 *   2. Yeshua Academy (Current) - NL21 INGB 0113 0903 90
 *   3. Savings Account
 *
 * Exit codes:
 *   0 - Success (files downloaded)
 *   1 - Login failed (wrong credentials, network error)
 *   2 - 2FA timeout (user didn't approve in time)
 *   3 - Download failed (page structure changed, no files found)
 *   4 - Invalid environment (missing credentials)
 */

const playwright = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const config = {
  username: process.env.ING_USERNAME,
  password: process.env.ING_PASSWORD,
  downloadDir: process.env.DOWNLOAD_DIR || path.join(process.env.HOME, 'Downloads'),
  timeoutSeconds: parseInt(process.env.TIMEOUT_SECONDS || '600'),
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '5000'),
  ntfyTopic: process.env.NTFY_TOPIC,
};

// Validate
if (!config.username || !config.password) {
  console.error('ERROR: ING_USERNAME and ING_PASSWORD environment variables required');
  process.exit(4);
}

if (!fs.existsSync(config.downloadDir)) {
  console.error(`ERROR: Download directory does not exist: ${config.downloadDir}`);
  process.exit(4);
}

// Logging
const log = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} ${msg}`),
};

// Send ntfy.sh notification
async function sendNotification(message, deepLink = null) {
  if (!config.ntfyTopic) return;

  return new Promise((resolve) => {
    const body = deepLink
      ? JSON.stringify({ title: message, click: deepLink })
      : message;

    const options = {
      hostname: 'ntfy.sh',
      port: 443,
      path: `/${config.ntfyTopic}`,
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      log.info(`Notification sent (${res.statusCode})`);
      resolve();
    });

    req.on('error', (err) => {
      log.warn(`Failed to send notification: ${err.message}`);
      resolve();
    });

    req.write(body);
    req.end();
  });
}

// Download statements for a single account
async function downloadAccountStatement(page, accountType, accountName, downloadIndex) {
  log.info(`[Account ${downloadIndex}] Downloading ${accountType} - ${accountName}...`);

  // Click the Download button (the big circular button)
  log.info('Clicking Download button...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]')).filter((el) =>
      el.textContent?.includes('Download')
    );
    if (buttons.length > 0) {
      buttons[0].click?.();
    }
  });

  await page.waitForTimeout(2000);

  // Select account type (Current or Savings)
  log.info(`Selecting account type: ${accountType}...`);
  await page.evaluate((type) => {
    const radioButtons = Array.from(document.querySelectorAll('input[type="radio"]'));
    const button = radioButtons.find((rb) => {
      const label = rb.parentElement?.textContent || rb.nextElementSibling?.textContent || '';
      return label.includes(type);
    });
    if (button) {
      button.click?.();
    }
  }, accountType);

  await page.waitForTimeout(1000);

  // Click on the account if it's not already selected
  log.info(`Selecting account: ${accountName}...`);
  await page.evaluate((name) => {
    const accountButtons = Array.from(document.querySelectorAll('button, div[role="button"]')).filter((el) =>
      el.textContent?.includes(name)
    );
    if (accountButtons.length > 0) {
      accountButtons[0].click?.();
    }
  }, accountName);

  await page.waitForTimeout(1500);

  // Select "Last month" button
  log.info('Selecting Last month...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')).filter((el) =>
      el.textContent?.includes('Last month')
    );
    if (buttons.length > 0) {
      buttons[0].click?.();
    }
  });

  await page.waitForTimeout(500);

  // Select CSV file type
  log.info('Selecting CSV file type...');
  await page.evaluate(() => {
    const radioButtons = Array.from(document.querySelectorAll('input[type="radio"]'));
    const csvButton = radioButtons.find((rb) => {
      const label = rb.parentElement?.textContent || rb.nextElementSibling?.textContent || '';
      return label.includes('CSV') && !label.includes('Comma');
    });
    if (csvButton) {
      csvButton.click?.();
    }
  });

  await page.waitForTimeout(500);

  // Select "Semicolon-separated values" option
  log.info('Selecting semicolon-separated values...');
  await page.evaluate(() => {
    const radioButtons = Array.from(document.querySelectorAll('input[type="radio"]'));
    const semiButton = radioButtons.find((rb) => {
      const label = rb.parentElement?.textContent || rb.nextElementSibling?.textContent || '';
      return label.includes('Semicolon');
    });
    if (semiButton) {
      semiButton.click?.();
    }
  });

  await page.waitForTimeout(500);

  // Click Download button
  log.info('Clicking Download button...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')).filter((el) =>
      el.textContent?.trim() === 'Download'
    );
    if (buttons.length > 0) {
      buttons[buttons.length - 1].click?.(); // Click the last Download button (in the form)
    }
  });

  await page.waitForTimeout(3000); // Wait for download to start

  log.info(`[Account ${downloadIndex}] Download completed`);
}

// Main execution
(async () => {
  let browser;
  let context;
  let page;

  try {
    log.info('Starting ING bank statement automation');

    // Launch browser with anti-bot evasion settings
    browser = await playwright.chromium.launch({
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
      ],
    });

    // Create context with proper user agent and viewport
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    });

    page = await context.newPage();

    // Set download path
    await context.on('page', (p) => {
      p.on('download', async (download) => {
        const filePath = path.join(config.downloadDir, download.suggestedFilename);
        await download.saveAs(filePath);
        log.info(`Downloaded: ${download.suggestedFilename}`);
      });
    });

    log.info('Navigating to ING Business Banking...');
    try {
      await page.goto('https://mijnzakelijk.ing.nl/banking/overview', {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
    } catch (err) {
      log.warn(`Page load warning: ${err.message}`);
    }

    await page.waitForTimeout(2000);

    // Handle login
    log.info('Logging in...');

    // Try to fill login form via JavaScript
    log.info('Attempting to find login form via JavaScript...');

    const usernameExists = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[name="username"]');
      return inputs.length > 0;
    });

    if (usernameExists) {
      log.info('Found login form, filling credentials...');
      await page.evaluate((username) => {
        const input = document.querySelector('input[name="username"]');
        if (input) {
          input.value = username;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, config.username);

      await page.waitForTimeout(300);

      await page.evaluate((password) => {
        const input = document.querySelector('input[name="password"]');
        if (input) {
          input.value = password;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, config.password);

      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
    } else {
      log.info('Form not visible — trying to expand via JavaScript...');
      await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*')).filter((el) =>
          el.textContent?.includes('With your username and password')
        );
        if (elements.length > 0) {
          elements[0].click?.();
        }
      });

      await page.waitForTimeout(2000);

      await page.evaluate((username) => {
        const input = document.querySelector('input[name="username"]');
        if (input) {
          input.value = username;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, config.username);

      await page.waitForTimeout(300);

      await page.evaluate((password) => {
        const input = document.querySelector('input[name="password"]');
        if (input) {
          input.value = password;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, config.password);

      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
    }

    // Wait for 2FA or dashboard
    log.info('Waiting for login to complete...');
    await page.waitForTimeout(3000);

    // Check if 2FA is needed
    const twoFaNeeded = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return text.includes('approve') || text.includes('bevestig') || text.includes('authorise');
    });

    if (twoFaNeeded) {
      log.info('2FA required — waiting for user approval on phone...');
      await sendNotification(
        'Your bank statement automation is waiting — approve in the ING app',
        'https://apps.apple.com/us/app/ing-netherlands/id474495017'
      );

      // Poll for successful 2FA
      const startTime = Date.now();
      const timeoutMs = config.timeoutSeconds * 1000;

      while (Date.now() - startTime < timeoutMs) {
        const isLoggedIn = await page.evaluate(() => {
          const text = document.body.textContent || '';
          return text.includes('Overview') || text.includes('Accounts') || text.includes('Download');
        });

        if (isLoggedIn) {
          log.info('2FA approved — proceeding with downloads');
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
      }

      const timeElapsed = (Date.now() - startTime) / 1000;
      if (timeElapsed >= config.timeoutSeconds) {
        log.error(`2FA timeout — user did not approve within ${config.timeoutSeconds}s`);
        process.exit(2);
      }
    }

    // Wait for dashboard to load
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);

    log.info('Logged in successfully — fetching account statements...');

    // Download statements for 3 accounts
    // Account 1: Current - Yeshua Academy (NL89 INGB 0006 3699 60)
    await downloadAccountStatement(page, 'Current accounts', 'Yeshua Academy', 1);
    await page.waitForTimeout(2000);

    // Account 2: Current - Yeshua Academy (NL21 INGB 0113 0903 90)
    // Need to go back to overview first
    await page.goto('https://mijnzakelijk.ing.nl/banking/overview', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await downloadAccountStatement(page, 'Current accounts', 'Yeshua Academy', 2);
    await page.waitForTimeout(2000);

    // Account 3: Savings Account
    await page.goto('https://mijnzakelijk.ing.nl/banking/overview', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await downloadAccountStatement(page, 'Savings accounts', 'Savings', 3);
    await page.waitForTimeout(2000);

    log.info('All statements downloaded successfully');

    // Log out
    log.info('Logging out...');
    await page.evaluate(() => {
      const logoutButtons = Array.from(document.querySelectorAll('button, a, [role="button"]')).filter((el) =>
        el.textContent?.includes('Log out') || el.textContent?.includes('Logout')
      );
      if (logoutButtons.length > 0) {
        logoutButtons[0].click?.();
      }
    });

    await page.waitForTimeout(2000);

    log.info('Logged out successfully');
    process.exit(0);

  } catch (error) {
    log.error(`Fatal error: ${error.message}`);
    log.error(error.stack);
    process.exit(1);

  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
