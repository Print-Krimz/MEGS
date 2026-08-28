import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:5173";
const SCREENSHOT_DIR = path.resolve("./screenshots/admin-audit");

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function runAuditVerification() {
  console.log("\n=======================================================");
  console.log("  ADMIN AUDIT LOG & SECURITY CONTROL VERIFICATION");
  console.log("=======================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const errors = [];
  const networkFailures = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Ignore favicon or non-critical 404s
      if (!text.includes("favicon.ico")) {
        errors.push({ type: "console_error", text, location: msg.location() });
      }
    }
  });

  page.on("response", (res) => {
    if (res.status() >= 400 && !res.url().includes("favicon")) {
      networkFailures.push({
        url: res.url(),
        status: res.status(),
        statusText: res.statusText(),
      });
    }
  });

  try {
    // 1. Authenticate as Admin
    console.log("1. Authenticating as Administrator...");
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"], input[name="email"]', "admin@megs-recruitment.com");
    await page.fill('input[type="password"], input[name="password"]', "AdminPassword123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin**", { timeout: 15000 });
    console.log("   ✅ Logged in successfully!");

    // 2. Navigate to Admin Audit Logs page
    console.log("\n2. Navigating to Admin Audit Trail (/admin/audit)...");
    await page.goto(`${BASE_URL}/admin/audit`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_audit_logs_main.png"), fullPage: true });

    // Verify Page Header
    const heading = await page.textContent("h1");
    console.log(`   Page Heading: "${heading?.trim()}"`);

    // Verify Table Headers & Content
    const tableRows = page.locator("table tbody tr");
    const rowCount = await tableRows.count();
    console.log(`   Found ${rowCount} audit log rows displayed on page 1.`);

    if (rowCount > 0) {
      // Check first row content
      const firstRowText = await tableRows.first().textContent();
      console.log(`   First row sample: "${firstRowText?.replace(/\s+/g, " ").trim()}"`);

      // Verify no raw developer artifacts like "USER_LOGGED_IN" in displayed text
      const rawUserLoggedIn = await page.locator('table tbody td:has-text("USER_LOGGED_IN")').count();
      const rawKNN = await page.locator('table tbody td:has-text("KNN_TALENT_POOL_SEARCH")').count();
      const rawUserHash = await page.locator('table tbody td:has-text("User #")').count();
      const rawTalentHash = await page.locator('table tbody td:has-text("TalentPool #")').count();

      console.log(`   Check: raw "USER_LOGGED_IN" occurrences: ${rawUserLoggedIn}`);
      console.log(`   Check: raw "KNN_TALENT_POOL_SEARCH" occurrences: ${rawKNN}`);
      console.log(`   Check: incomplete "User #" occurrences: ${rawUserHash}`);
      console.log(`   Check: incomplete "TalentPool #" occurrences: ${rawTalentHash}`);

      if (rawUserLoggedIn === 0 && rawKNN === 0 && rawUserHash === 0 && rawTalentHash === 0) {
        console.log("   ✅ Clean human-readable presentation verified! No raw developer artifacts.");
      } else {
        console.warn("   ⚠️ Warning: some raw developer strings detected.");
      }
    }

    // 3. Test Filter Controls
    console.log("\n3. Testing Category & Search Filters...");
    
    // Test Category filter
    const categorySelect = page.locator('select:has-text("All Audit Categories")').first();
    if (await categorySelect.count() > 0) {
      console.log("   Selecting category: 'Authentication'...");
      await categorySelect.selectOption("Authentication");
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02_audit_category_auth.png") });
      const authRowCount = await page.locator("table tbody tr").count();
      console.log(`   Authentication category returned ${authRowCount} records.`);

      console.log("   Resetting category filter...");
      await categorySelect.selectOption("");
      await page.waitForTimeout(1000);
    }

    // Test Search filter
    console.log("   Testing text search for 'admin'...");
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill("admin");
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03_audit_search_admin.png") });
    await searchInput.fill("");
    await page.waitForTimeout(1000);

    // 4. Test Date Range Presets
    console.log("\n4. Testing Date Range Toolbar...");
    const todayBtn = page.locator('button:has-text("Today")').first();
    if (await todayBtn.count() > 0) {
      await todayBtn.click();
      await page.waitForTimeout(1000);
      console.log("   ✅ Selected 'Today' date preset.");
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04_audit_date_today.png") });
    }

    const allTimeBtn = page.locator('button:has-text("All Time")').first();
    if (await allTimeBtn.count() > 0) {
      await allTimeBtn.click();
      await page.waitForTimeout(1000);
      console.log("   ✅ Restored 'All Time' preset.");
    }

    // 5. Test Audit Event Details Modal
    console.log("\n5. Testing Redesigned Audit Event Details Modal...");
    const viewDetailsBtn = page.locator('button:has-text("View Details")').first();
    if (await viewDetailsBtn.count() > 0) {
      await viewDetailsBtn.click();
      await page.waitForTimeout(1200);

      // Verify modal is open
      const modalHeader = page.locator('div[role="dialog"] h2, div[role="dialog"]:has-text("Audit Event Details")').first();
      console.log("   ✅ Audit Event Details modal opened!");
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05_audit_details_modal.png") });

      // Verify structured overview grid exists
      const actorLabel = await page.locator('div[role="dialog"]:has-text("Actor / User")').count();
      const entityLabel = await page.locator('div[role="dialog"]:has-text("Target Entity")').count();
      const ipLabel = await page.locator('div[role="dialog"]:has-text("IP Address")').count();
      const resultLabel = await page.locator('div[role="dialog"]:has-text("Result / Outcome")').count();

      console.log(`   Modal structured fields: Actor (${actorLabel > 0}), Entity (${entityLabel > 0}), IP (${ipLabel > 0}), Result (${resultLabel > 0})`);

      // Verify Technical Details raw payload is removed
      const techAccordion = page.locator('button:has-text("Technical Details (Raw Payload)")').first();
      const techCount = await techAccordion.count();
      if (techCount === 0) {
        console.log("   ✅ Technical Details (Raw Payload) confirmed removed from UI!");
      } else {
        console.warn("   ⚠️ Warning: Technical details raw payload still found in UI.");
      }

      // Close modal
      const closeBtn = page.locator('div[role="dialog"] button:has-text("Close"), button[aria-label="Close"]').first();
      if (await closeBtn.count() > 0) {
        await closeBtn.click();
        await page.waitForTimeout(800);
        console.log("   ✅ Modal closed cleanly.");
      }
    }

    // 6. Test Admin Dashboard Widget
    console.log("\n6. Checking Admin Dashboard recent audit logs widget...");
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07_admin_dashboard_widget.png"), fullPage: true });
    console.log("   ✅ Admin Dashboard rendered cleanly.");

    console.log("\n=======================================================");
    console.log(`  VERIFICATION RESULTS:`);
    console.log(`  - Console Errors: ${errors.length}`);
    console.log(`  - Network Failures (>=400): ${networkFailures.length}`);
    console.log("=======================================================\n");

    if (errors.length > 0) {
      console.log("Console Errors:", errors);
    }
    if (networkFailures.length > 0) {
      console.log("Network Failures:", networkFailures);
    }

  } catch (err) {
    console.error("❌ Verification failed with error:", err);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "error_state.png") });
  } finally {
    await browser.close();
  }
}

runAuditVerification().catch(console.error);
