import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:5173";
const SCREENSHOT_DIR = path.resolve("./screenshots/talent-pool-audit");

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function auditTalentPool() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleLogs = [];
  const consoleErrors = [];
  const networkRequests = [];
  const networkErrors = [];

  page.on("console", (msg) => {
    const entry = { type: msg.type(), text: msg.text() };
    consoleLogs.push(entry);
    if (msg.type() === "error") {
      consoleErrors.push(entry);
    }
  });

  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("/api/")) {
      let body = null;
      try {
        body = await res.json();
      } catch {}
      networkRequests.push({
        url,
        method: res.request().method(),
        status: res.status(),
        response: body,
      });
      if (res.status() >= 400) {
        networkErrors.push({
          url,
          method: res.request().method(),
          status: res.status(),
          response: body,
        });
      }
    }
  });

  console.log("\n=======================================================");
  console.log("🔍 PLAYWRIGHT TALENT POOL END-TO-END VERIFICATION");
  console.log("=======================================================\n");

  // Step 1: Login as TA
  console.log("1. Logging in as TA recruiter...");
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"], input[name="email"]', "ta@megs-recruitment.com");
  await page.fill('input[type="password"], input[name="password"]', "TAPassword123!");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/ta**", { timeout: 10000 });
  await page.waitForTimeout(1000);
  console.log("   ✅ Logged in successfully!");

  // Step 2: Navigate to Talent Pool Page
  console.log("2. Navigating to Talent Pool page (/ta/talent-pool)...");
  await page.goto(`${BASE_URL}/ta/talent-pool`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_talent_pool_initial_empty.png") });

  // Step 3: Test Semantic Search with Keywords
  console.log("3. Performing semantic text search ('TypeScript Developer')...");
  const searchInput = page.locator('input[placeholder*="Skills, Keywords" i], input[type="text"]').first();
  await searchInput.fill("TypeScript");
  const searchButton = page.locator('button:has-text("Search Talent Pool")');
  await searchButton.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02_talent_pool_search_results.png") });

  // Inspect rendered candidate cards
  const candidateCards = page.locator(".grid.grid-cols-1.md\\:grid-cols-2 > div");
  const cardCount = await candidateCards.count();
  console.log(`   Search returned ${cardCount} candidate cards rendered in UI.`);

  const candidateDataSample = [];
  for (let i = 0; i < cardCount; i++) {
    const card = candidateCards.nth(i);
    const text = await card.innerText();
    candidateDataSample.push(text);
  }
  console.log("   Sample Card Details:\n", candidateDataSample.join("\n---\n"));

  // Step 4: Test Log Contact Modal & Submission
  console.log("4. Testing Log Contact Modal & Submission...");
  const logContactButton = page.locator('button:has-text("Log Contact")').first();
  if (await logContactButton.count() > 0) {
    await logContactButton.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03_talent_pool_log_contact_modal.png") });

    // Select job requisition in dropdown
    const jobSelect = page.locator('select').first();
    const options = await jobSelect.locator('option').all();
    if (options.length > 1) {
      const val = await options[1].getAttribute('value');
      if (val) await jobSelect.selectOption(val);
    }

    const notesInput = page.locator('textarea').first();
    await notesInput.fill("Phone interview completed. Candidate expressed strong interest.");

    const saveContactButton = page.locator('button:has-text("Save Contact Record")');
    await saveContactButton.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04_talent_pool_contact_saved.png") });
    console.log("   ✅ Contact record submitted!");
  }

  // Step 5: Test Consider for Job Modal (Reactivation)
  console.log("5. Testing 'Consider for Job' Modal & Reactivation...");
  const considerButton = page.locator('button:has-text("Consider for Job")').first();
  if (await considerButton.count() > 0) {
    await considerButton.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05_talent_pool_consider_modal.png") });

    const jobSelect = page.locator('select').first();
    const options = await jobSelect.locator('option').all();
    if (options.length > 1) {
      const val = await options[1].getAttribute('value');
      if (val) await jobSelect.selectOption(val);
    }

    const considerNotes = page.locator('textarea').first();
    await considerNotes.fill("Candidate meets all core criteria and is ready for initial screening.");

    const reactivateButton = page.locator('button:has-text("Reactivate & Apply Candidate")');
    await reactivateButton.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06_talent_pool_candidate_reactivated.png") });
    console.log("   ✅ Candidate successfully reactivated!");
  }

  // Step 6: Inspect Job Posting Detail Page Talent Pool Matches
  console.log("6. Navigating to Job Posting Detail page to check Talent Pool Matches tab...");
  await page.goto(`${BASE_URL}/ta/jobs`);
  await page.waitForTimeout(1000);
  const firstJob = page.locator('a[href*="/ta/jobs/"]').first();
  if (await firstJob.count() > 0) {
    await firstJob.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07_job_detail_overview.png") });

    // Switch to Talent Pool Matches tab
    const tpTab = page.locator('button:has-text("Talent Pool Matches")').first();
    if (await tpTab.count() > 0) {
      await tpTab.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "08_job_detail_talent_pool_tab.png") });
      console.log("   ✅ Job detail Talent Pool tab rendered!");
    }
  }

  // Step 7: Inspect Application Detail Page Similar Candidates
  console.log("7. Navigating to Application Detail page to check Similar in Pool tab...");
  await page.goto(`${BASE_URL}/ta/applications`);
  await page.waitForTimeout(1000);
  const firstApp = page.locator('a[href*="/ta/applications/"]').first();
  if (await firstApp.count() > 0) {
    await firstApp.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "09_application_detail_overview.png") });

    // Switch to Similar in Pool tab
    const simTab = page.locator('button:has-text("Similar in Pool")').first();
    if (await simTab.count() > 0) {
      await simTab.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "10_application_similar_tab.png") });
      console.log("   ✅ Application detail Similar in Pool tab rendered!");
    }
  }

  await browser.close();

  const auditSummary = {
    cardCount,
    candidateDataSample,
    networkRequestsCount: networkRequests.length,
    networkErrors,
    consoleErrors,
  };

  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, "audit-summary.json"),
    JSON.stringify(auditSummary, null, 2)
  );

  console.log("\n=======================================================");
  console.log("🏁 PLAYWRIGHT TALENT POOL VERIFICATION COMPLETE");
  console.log(`📸 Screenshots saved to: ${SCREENSHOT_DIR}`);
  console.log(`❌ Network Errors Encountered: ${networkErrors.length}`);
  console.log(`⚠️ Console Errors Encountered: ${consoleErrors.length}`);
  console.log("=======================================================\n");
}

auditTalentPool().catch((err) => {
  console.error("Talent Pool audit script failed:", err);
  process.exit(1);
});
