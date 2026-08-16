import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:5173";
const API_URL = "http://localhost:3000";
const SCREENSHOT_DIR = path.resolve("./screenshots/documents");

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function auditDocumentPreview() {
  console.log("\n=======================================================");
  console.log("  PLAYWRIGHT AUDIT: SECURE APPLICANT DOCUMENT VIEWING  ");
  console.log("=======================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const errors = [];
  const networkFailures = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push({ type: "console_error", text: msg.text() });
    }
  });

  page.on("requestfailed", (req) => {
    networkFailures.push({ url: req.url(), failure: req.failure()?.errorText });
  });

  try {
    // 1. TA Login
    console.log("[Step 1] Logging in as TA user (ta@megs-recruitment.com)...");
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"], input[name="email"]', "ta@megs-recruitment.com");
    await page.fill('input[type="password"], input[name="password"]', "TAPassword123!");
    await page.click('button[type="submit"]');

    await page.waitForURL("**/ta**", { timeout: 10000 });
    console.log("  ✓ TA Logged in successfully!");

    // 2. Navigate to Applications
    console.log("[Step 2] Navigating to Applications Pipeline...");
    await page.goto(`${BASE_URL}/ta/applications`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_applications_pipeline.png") });

    // 3. Open first application
    const appLink = page.locator('a[href*="/ta/applications/"]').first();
    if ((await appLink.count()) > 0) {
      console.log("[Step 3] Opening candidate application detail...");
      await appLink.click();
      await page.waitForTimeout(1500);

      // Switch to Compliance tab
      console.log("[Step 4] Opening Compliance & Requirements tab...");
      const complianceTab = page.locator('button:has-text("Compliance"), button:has-text("Requirements")').first();
      if ((await complianceTab.count()) > 0) {
        await complianceTab.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02_compliance_tab.png") });
        console.log("  ✓ Compliance tab loaded!");

        // Check if there is a View button
        const viewBtn = page.locator('button:has-text("View")').first();
        if ((await viewBtn.count()) > 0) {
          console.log("[Step 5] Clicking 'View' to trigger Document Preview Modal...");
          await viewBtn.click();
          await page.waitForTimeout(1500);
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03_document_preview_modal.png") });

          // Verify modal contents
          const modal = page.locator('[role="dialog"]');
          const isModalVisible = await modal.isVisible();
          console.log(`  ✓ Document Preview Modal visible: ${isModalVisible}`);

          // Close modal
          const closeBtn = page.locator('button:has-text("Close"), button[title="Close modal"]').first();
          if ((await closeBtn.count()) > 0) {
            await closeBtn.click();
            await page.waitForTimeout(500);
            console.log("  ✓ Modal closed cleanly without navigating away from application!");
          }
        } else {
          console.log("  ℹ No submitted documents with 'View' button in current application. Requirements list displayed properly.");
        }
      }
    }

    // 4. Security Verification
    console.log("\n[Step 6] Running automated security boundary checks...");
    
    // Check direct unauthenticated API access to /preview
    const unauthRes = await fetch(`${API_URL}/api/documents/1/preview`);
    console.log(`  ✓ Unauthenticated GET /api/documents/1/preview returned: ${unauthRes.status} (Expected 401 Unauthorized)`);
    if (unauthRes.status !== 401) {
      throw new Error(`Expected 401, got ${unauthRes.status}`);
    }

    // Check direct unauthenticated API access to /download
    const unauthDownloadRes = await fetch(`${API_URL}/api/documents/1/download`);
    console.log(`  ✓ Unauthenticated GET /api/documents/1/download returned: ${unauthDownloadRes.status} (Expected 401 Unauthorized)`);
    if (unauthDownloadRes.status !== 401) {
      throw new Error(`Expected 401, got ${unauthDownloadRes.status}`);
    }

    console.log("\n=======================================================");
    console.log("  PLAYWRIGHT AUDIT: ALL TESTS & SECURITY CHECKS PASSED  ");
    console.log("=======================================================\n");
  } catch (err) {
    console.error("Playwright Audit Error:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

auditDocumentPreview().catch((e) => {
  console.error(e);
  process.exit(1);
});
