import { chromium } from 'playwright';

async function testNav() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  await page.goto('http://localhost:5173/login');
  await page.fill('input[id="email"]', 'test1@gmail.com');
  await page.fill('input[id="password"]', '12345678');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/app/**', { timeout: 10000 });
  console.log('Current URL after login:', page.url());

  // Click on "Browse Jobs" link
  await page.click('a[href="/app/jobs"]');
  await page.waitForTimeout(1000);
  console.log('Current URL after clicking Browse Jobs:', page.url());
  console.log('H1:', await page.locator('h1').allInnerTexts());

  // Click on "My Profile"
  await page.click('a[href="/app/profile"]');
  await page.waitForTimeout(1000);
  console.log('Current URL after clicking My Profile:', page.url());
  console.log('H1:', await page.locator('h1').allInnerTexts());

  // Check tabs
  const tabs = await page.locator('[role="tab"]').allInnerTexts();
  console.log('Profile tabs found:', tabs);

  await browser.close();
}

testNav().catch(console.error);
