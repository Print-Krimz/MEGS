import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:5173";
const SCREENSHOT_DIR = path.resolve("./screenshots/admin");

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function auditAdmin() {
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

  console.log("\n=== 4. AUDITING SYSTEM ADMINISTRATOR (ADMIN) ROLE ===");

  // 4.1 Login as Admin
  console.log("Logging in as admin@megs-recruitment.com...");
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"], input[name="email"]', "admin@megs-recruitment.com");
  await page.fill('input[type="password"], input[name="password"]', "AdminPassword123!");
  await page.click('button[type="submit"]');
  
  await page.waitForURL("**/admin**", { timeout: 10000 });
  await page.waitForTimeout(1500);
  console.log(`  Successfully logged in! Landed at: ${page.url()}`);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_admin_dashboard.png") });

  // 4.2 User Management
  console.log("Navigating to User Management (/admin/users)...");
  await page.goto(`${BASE_URL}/admin/users`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02_admin_users.png") });

  // Test Invite User modal
  const inviteBtn = page.locator('button:has-text("Invite User"), button:has-text("Invite TA"), button:has-text("New User")').first();
  if (await inviteBtn.count() > 0) {
    console.log("  Testing Invite User modal...");
    await inviteBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03_admin_invite_modal.png") });

    const cancelBtn = page.locator('button:has-text("Cancel"), button:has-text("Close"), button[aria-label="Close"]').first();
    if (await cancelBtn.count() > 0) {
      await cancelBtn.click();
    }
  }

  // 4.3 Scoring Configuration
  console.log("Navigating to Scoring Configuration (/admin/scoring)...");
  await page.goto(`${BASE_URL}/admin/scoring`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04_admin_scoring_config.png") });

  // 4.4 Scoring Quality & Drift Analysis
  console.log("Navigating to Scoring Quality (/admin/scoring/quality)...");
  await page.goto(`${BASE_URL}/admin/scoring/quality`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05_admin_scoring_quality.png") });

  // 4.5 Revalidation Queue
  console.log("Navigating to Revalidation Queue (/admin/revalidation)...");
  await page.goto(`${BASE_URL}/admin/revalidation`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06_admin_revalidation_queue.png") });

  // 4.6 Audit Logs
  console.log("Navigating to Audit Logs (/admin/audit)...");
  await page.goto(`${BASE_URL}/admin/audit`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07_admin_audit_logs.png") });

  // 4.7 Testing Admin Access to TA modules (Admin can also navigate or view system data)
  console.log("Testing Admin navigating to /ta...");
  await page.goto(`${BASE_URL}/ta`);
  await page.waitForTimeout(1500);
  console.log(`  Admin on /ta landed at: ${page.url()}`);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "08_admin_ta_view.png") });

  // 4.8 Logout
  console.log("Testing Admin logout...");
  const logoutBtn = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), button[aria-label="Logout"]').first();
  if (await logoutBtn.count() > 0) {
    await logoutBtn.click();
    await page.waitForTimeout(1500);
    console.log(`  Logged out. Current URL: ${page.url()}`);
  }

  await browser.close();

  const report = {
    role: "ADMINISTRATOR",
    email: "admin@megs-recruitment.com",
    consoleErrors: errors,
    networkFailures,
  };

  fs.writeFileSync("./reports/admin-audit-report.json", JSON.stringify(report, null, 2));
  console.log("✅ Admin Role Audit Complete!\n");
}

auditAdmin().catch((err) => {
  console.error("Admin audit failed:", err);
  process.exit(1);
});
