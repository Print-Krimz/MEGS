import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  await page.goto('http://localhost:5174/login');
  
  await page.fill('input[type="email"]', 'ta@megs-recruitment.com');
  await page.fill('input[type="password"]', 'TAPassword123!');
  await page.click('button[type="submit"]');
  
  // Wait for dashboard to load completely
  await page.waitForURL('**/ta/dashboard', { timeout: 10000 });
  await page.waitForTimeout(3000); // Give extra time for data to render
  await page.screenshot({ path: 'screenshot_real_1080p_ta_dashboard.png', fullPage: true });

  const routes = [
    '/ta/applications',
    '/ta/applications/1', // Ensure this ID actually exists or captures the error gracefully
    '/ta/talent-pool'
  ];

  for (const r of routes) {
    await page.goto(`http://localhost:5174${r}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const safeName = r.replace(/\//g, '_');
    await page.screenshot({ path: `screenshot_real_1080p${safeName}.png`, fullPage: true });
  }

  await browser.close();
})();
