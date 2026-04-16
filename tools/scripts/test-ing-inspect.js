const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  console.log('Opening page...');
  try {
    await page.goto('https://mijnzakelijk.ing.nl/banking/overview', {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
  } catch (err) {
    console.log('Warning:', err.message);
  }

  await page.waitForTimeout(3000);
  
  console.log('\n=== INSPECTING PAGE ===');
  const html = await page.content();
  
  // Look for form fields
  if (html.includes('username') || html.includes('login')) {
    console.log('✓ Page contains login-related content');
  }
  
  // Print first 3000 chars of HTML
  console.log(html.substring(0, 3000));

  await browser.close();
})();
