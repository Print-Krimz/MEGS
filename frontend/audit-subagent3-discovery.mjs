import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  console.log('Navigating to login...');
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('input[type="email"], input[name="email"], #email');

  await page.fill('input[type="email"], input[name="email"], #email', 'ta@megs-recruitment.com');
  await page.fill('input[type="password"], input[name="password"], #password', 'TAPassword123!');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/ta/**', { timeout: 10000 });
  console.log('Logged in successfully! Current URL:', page.url());

  // Check MRFs
  await page.goto('http://localhost:5173/ta/mrfs');
  await page.waitForTimeout(2000);
  const mrfLinks = await page.$$eval('a[href*="/ta/mrfs/"]', els => els.map(e => e.getAttribute('href')));
  console.log('MRF links:', mrfLinks);

  // Check Jobs
  await page.goto('http://localhost:5173/ta/jobs');
  await page.waitForTimeout(2000);
  const jobLinks = await page.$$eval('a[href*="/ta/jobs/"]', els => els.map(e => e.getAttribute('href')));
  console.log('Job links:', jobLinks);

  // Check Clients
  await page.goto('http://localhost:5173/ta/clients');
  await page.waitForTimeout(2000);
  const clientLinks = await page.$$eval('a[href*="/ta/clients/"]', els => els.map(e => e.getAttribute('href')));
  console.log('Client links:', clientLinks);

  // Check Employees
  await page.goto('http://localhost:5173/ta/employees');
  await page.waitForTimeout(2000);
  const employeeLinks = await page.$$eval('a[href*="/ta/employees/"]', els => els.map(e => e.getAttribute('href')));
  console.log('Employee links:', employeeLinks);

  // Check Interviews
  await page.goto('http://localhost:5173/ta/interviews');
  await page.waitForTimeout(2000);
  console.log('Interviews loaded, URL:', page.url());

  // Check Compliance
  await page.goto('http://localhost:5173/ta/compliance');
  await page.waitForTimeout(2000);
  console.log('Compliance loaded, URL:', page.url());

  // Check Deployments
  await page.goto('http://localhost:5173/ta/deployments');
  await page.waitForTimeout(2000);
  console.log('Deployments loaded, URL:', page.url());

  await browser.close();
}

main().catch(console.error);
