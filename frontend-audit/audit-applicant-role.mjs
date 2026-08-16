import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:5173";
const SCREENSHOT_DIR = path.resolve("./screenshots/applicant");

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function auditApplicant() {
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

  console.log("\n=== 2. AUDITING APPLICANT ROLE ===");

  // 2.1 Login as Applicant
  console.log("Logging in as test2@gmail.com...");
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"], input[name="email"]', "test2@gmail.com");
  await page.fill('input[type="password"], input[name="password"]', "12345678");
  await page.click('button[type="submit"]');
  
  await page.waitForURL("**/app**", { timeout: 10000 });
  await page.waitForTimeout(1500);
  console.log(`  Successfully logged in! Landed at: ${page.url()}`);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_applicant_dashboard.png") });

  // 2.2 Applicant Dashboard checks
  const dashboardTitle = await page.textContent("h1, h2");
  console.log(`  Dashboard header: ${dashboardTitle?.trim()}`);

  // 2.3 Job Board
  console.log("Navigating to Job Board (/app/jobs)...");
  await page.goto(`${BASE_URL}/app/jobs`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02_job_board.png") });

  // Test search filter
  const searchInput = page.locator('input[placeholder*="Search" i], input[type="search"]');
  if (await searchInput.count() > 0) {
    console.log("  Testing job search input...");
    await searchInput.fill("React");
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02b_job_board_search.png") });
  }

  // Click first job detail if available
  const viewJobButton = page.locator('a[href*="/app/jobs/"], button:has-text("View Details"), a:has-text("View Details")').first();
  if (await viewJobButton.count() > 0) {
    console.log("  Navigating to Job Detail...");
    await viewJobButton.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03_job_detail.png") });

    // Check Apply Button / Modal
    const applyButton = page.locator('button:has-text("Apply Now"), button:has-text("Apply")').first();
    if (await applyButton.count() > 0 && !(await applyButton.isDisabled())) {
      console.log("  Clicking Apply button to inspect modal/form...");
      await applyButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04_job_apply_modal.png") });

      // Close modal if open
      const closeBtn = page.locator('button:has-text("Cancel"), button:has-text("Close"), button[aria-label="Close"]').first();
      if (await closeBtn.count() > 0) {
        await closeBtn.click();
      }
    }
  }

  // 2.4 My Applications Page
  console.log("Navigating to My Applications (/app/applications)...");
  await page.goto(`${BASE_URL}/app/applications`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05_my_applications.png") });

  // 2.5 Candidate Profile & 201 Documents
  console.log("Navigating to Candidate Profile (/app/profile)...");
  await page.goto(`${BASE_URL}/app/profile`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06_candidate_profile.png") });

  // 2.6 Notifications Page
  console.log("Navigating to Notifications (/app/notifications)...");
  await page.goto(`${BASE_URL}/app/notifications`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07_applicant_notifications.png") });

  // 2.7 RBAC test: Applicant attempting to access /admin
  console.log("Testing Applicant RBAC against /admin...");
  await page.goto(`${BASE_URL}/admin`);
  await page.waitForTimeout(1500);
  const forbiddenUrl = page.url();
  console.log(`  Applicant on /admin navigated to: ${forbiddenUrl}`);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "08_applicant_rbac_admin_block.png") });

  // 2.8 RBAC test: Applicant attempting to access /ta
  console.log("Testing Applicant RBAC against /ta...");
  await page.goto(`${BASE_URL}/ta`);
  await page.waitForTimeout(1500);
  const forbiddenTaUrl = page.url();
  console.log(`  Applicant on /ta navigated to: ${forbiddenTaUrl}`);

  // 2.9 Responsive test at mobile resolution (390x844)
  console.log("Testing Applicant layout at mobile viewport (390x844)...");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/app`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "09_applicant_mobile_dashboard.png") });

  await page.setViewportSize({ width: 1440, height: 900 });

  // 2.10 Logout
  console.log("Testing Applicant logout...");
  const logoutBtn = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), button[aria-label="Logout"]').first();
  if (await logoutBtn.count() > 0) {
    await logoutBtn.click();
    await page.waitForTimeout(1500);
    console.log(`  Logged out. Current URL: ${page.url()}`);
  }

  await browser.close();

  const report = {
    role: "APPLICANT",
    email: "test2@gmail.com",
    dashboardHeader: dashboardTitle?.trim(),
    rbacAdminRedirect: forbiddenUrl,
    rbacTaRedirect: forbiddenTaUrl,
    consoleErrors: errors,
    networkFailures,
  };

  fs.writeFileSync("./reports/applicant-audit-report.json", JSON.stringify(report, null, 2));
  console.log("✅ Applicant Role Audit Complete!\n");
}

auditApplicant().catch((err) => {
  console.error("Applicant audit failed:", err);
  process.exit(1);
});
