import { chromium } from 'playwright';

async function testNavClient() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  console.log('Logging in...');
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'ta@megs-recruitment.com');
  await page.fill('input[type="password"]', 'TAPassword123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/ta/**', { timeout: 10000 });
  console.log('Logged in URL:', page.url());

  const pagesToTest = [
    '/ta/mrfs',
    '/ta/mrfs/66',
    '/ta/jobs',
    '/ta/jobs/68',
    '/ta/clients',
    '/ta/clients/66',
    '/ta/interviews',
    '/ta/compliance',
    '/ta/deployments',
    '/ta/employees',
    '/ta/employees/50',
  ];

  for (const p of pagesToTest) {
    await page.evaluate((path) => {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, p);
    await page.waitForTimeout(1500);
    console.log(`Navigated to: ${p} -> Current URL: ${page.url()}`);
    const heading = await page.$eval('h1, h2, [data-testid="page-header"]', el => el.textContent).catch(() => 'No heading');
    console.log(`   Page content preview: ${heading.trim()}`);
  }

  await browser.close();
}

testNavClient().catch(console.error);
