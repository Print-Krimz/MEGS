import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:5173";
const SCREENSHOT_DIR = path.resolve("./screenshots/ta");

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function auditTA() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const logs = [];
  const errors = [];
  const networkFailures = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push({ type: "console_error", text: msg.text(), location: msg.location() });
    }
  });

  page.on("requestfailed", (req) => {
    networkFailures.push({ url: req.url(), failure: req.failure()?.errorText });
  });

  console.log("\n=== 3. AUDITING TALENT ACQUISITION (TA) ROLE ===");

  // 3.1 Login as TA
  console.log("Logging in as ta@megs-recruitment.com...");
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"], input[name="email"]', "ta@megs-recruitment.com");
  await page.fill('input[type="password"], input[name="password"]', "TAPassword123!");
  await page.click('button[type="submit"]');
  
  await page.waitForURL("**/ta**", { timeout: 10000 });
  await page.waitForTimeout(1500);
  console.log(`  Successfully logged in! Landed at: ${page.url()}`);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_ta_dashboard.png") });

  // 3.2 Applications Pipeline & Candidate Review
  console.log("Navigating to Applications Pipeline (/ta/applications)...");
  await page.goto(`${BASE_URL}/ta/applications`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02_ta_applications_list.png") });

  // Test stage filter tabs / dropdowns
  const filterTab = page.locator('button:has-text("Review"), button:has-text("Screening"), button:has-text("Hired")').first();
  if (await filterTab.count() > 0) {
    await filterTab.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02b_ta_applications_filtered.png") });
  }

  // Click into first application if present
  const appRow = page.locator('a[href*="/ta/applications/"], button:has-text("View"), tr.cursor-pointer, td a').first();
  if (await appRow.count() > 0) {
    console.log("  Navigating to Candidate Application Detail...");
    await appRow.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03_ta_application_detail.png") });
  }

  // 3.3 Job Postings
  console.log("Navigating to Job Postings (/ta/jobs)...");
  await page.goto(`${BASE_URL}/ta/jobs`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04_ta_job_postings.png") });

  // 3.4 Manpower Requisitions (MRF)
  console.log("Navigating to MRF List (/ta/mrfs)...");
  await page.goto(`${BASE_URL}/ta/mrfs`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05_ta_mrf_list.png") });

  console.log("Navigating to MRF Create form (/ta/mrfs/create)...");
  await page.goto(`${BASE_URL}/ta/mrfs/create`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06_ta_mrf_create.png") });

  // 3.5 Talent Pool & KNN Vector Search
  console.log("Navigating to Talent Pool (/ta/talent-pool)...");
  await page.goto(`${BASE_URL}/ta/talent-pool`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07_ta_talent_pool.png") });

  const knnSearchInput = page.locator('input[placeholder*="Search candidate" i], input[placeholder*="Search skill" i], input[type="search"]').first();
  if (await knnSearchInput.count() > 0) {
    console.log("  Testing Talent Pool semantic search query...");
    await knnSearchInput.fill("React Developer with TypeScript");
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07b_ta_talent_pool_search.png") });
  }

  // 3.6 Interviews Management
  console.log("Navigating to Interviews (/ta/interviews)...");
  await page.goto(`${BASE_URL}/ta/interviews`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "08_ta_interviews.png") });

  // 3.7 Corporate Clients
  console.log("Navigating to Clients (/ta/clients)...");
  await page.goto(`${BASE_URL}/ta/clients`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "09_ta_clients.png") });

  // 3.8 Compliance & 201 Document Verification
  console.log("Navigating to Compliance Checklist (/ta/compliance)...");
  await page.goto(`${BASE_URL}/ta/compliance`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "10_ta_compliance.png") });

  // 3.9 Deployments Management
  console.log("Navigating to Deployments (/ta/deployments)...");
  await page.goto(`${BASE_URL}/ta/deployments`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "11_ta_deployments.png") });

  // 3.10 Employees & Digital 201 Roster
  console.log("Navigating to Employees (/ta/employees)...");
  await page.goto(`${BASE_URL}/ta/employees`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "12_ta_employees.png") });

  // 3.11 Analytics & Export Reports
  console.log("Navigating to Analytics (/ta/analytics)...");
  await page.goto(`${BASE_URL}/ta/analytics`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "13_ta_analytics.png") });

  // 3.12 RBAC test: TA attempting to access /admin
  console.log("Testing TA RBAC against /admin...");
  await page.goto(`${BASE_URL}/admin`);
  await page.waitForTimeout(1500);
  const forbiddenUrl = page.url();
  console.log(`  TA on /admin navigated to: ${forbiddenUrl}`);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "14_ta_rbac_admin_block.png") });

  // 3.13 Logout
  console.log("Testing TA logout...");
  const logoutBtn = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), button[aria-label="Logout"]').first();
  if (await logoutBtn.count() > 0) {
    await logoutBtn.click();
    await page.waitForTimeout(1500);
    console.log(`  Logged out. Current URL: ${page.url()}`);
  }

  await browser.close();

  const report = {
    role: "TALENT_ACQUISITION",
    email: "ta@megs-recruitment.com",
    rbacAdminRedirect: forbiddenUrl,
    consoleErrors: errors,
    networkFailures,
  };

  fs.writeFileSync("./reports/ta-audit-report.json", JSON.stringify(report, null, 2));
  console.log("✅ TA Role Audit Complete!\n");
}

auditTA().catch((err) => {
  console.error("TA audit failed:", err);
  process.exit(1);
});
