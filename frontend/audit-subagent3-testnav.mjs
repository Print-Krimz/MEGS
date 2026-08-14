import { chromium } from 'playwright';

async function testNav() {
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
    await page.goto(`http://localhost:5173${p}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    console.log(`Visited: ${p} -> Actual URL: ${page.url()} -> Title:`, await page.title());
  }

  await browser.close();
}

testNav().catch(console.error);
