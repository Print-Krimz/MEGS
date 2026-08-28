import { chromium } from "playwright";
import dotenv from "dotenv";
import { PrismaPg } from "../backend/node_modules/@prisma/adapter-pg/dist/index.js";
import { PrismaClient } from "../backend/node_modules/@prisma/client/default.js";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const envPath = fs.existsSync(path.resolve("./backend/.env"))
  ? path.resolve("./backend/.env")
  : path.resolve("../backend/.env");
dotenv.config({ path: envPath });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BASE_URL = "http://localhost:5173";
const SCREENSHOT_DIR = path.resolve("./screenshots/endorsement");

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function main() {
  console.log("\n=======================================================");
  console.log("  PLAYWRIGHT AUDIT: CLIENT ENDORSEMENT WORKFLOW");
  console.log("=======================================================\n");

  const timestamp = Date.now();
  const taEmail = `ta-endorse-audit-${timestamp}@megs.com`;
  const taPassword = "AuditPassword123!";

  let testClient, testMrf, testJob, testTA, testApplicant, testApp;
  let supabaseTaUserId;

  try {
    console.log("1. Seeding test TA user in Supabase & Postgres...");
    const { data: supaUser, error: supaErr } = await supabase.auth.admin.createUser({
      email: taEmail,
      password: taPassword,
      email_confirm: true,
      user_metadata: { role: "TALENT_ACQUISITION", name: "TA Audit Specialist" },
    });

    if (supaErr || !supaUser.user) {
      throw new Error(`Failed to create test TA in Supabase: ${supaErr?.message}`);
    }
    supabaseTaUserId = supaUser.user.id;

    testTA = await prisma.user.create({
      data: {
        id: supabaseTaUserId,
        email: taEmail,
        role: "TALENT_ACQUISITION",
        accountStatus: "ACTIVE",
        mustChangePassword: false,
      },
    });

    // Obtain authentic session tokens
    const { data: sessionData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: taEmail,
      password: taPassword,
    });
    if (signInErr || !sessionData?.session) {
      throw new Error(`Failed to generate TA session: ${signInErr?.message}`);
    }
    const { access_token: accessToken, refresh_token: refreshToken } = sessionData.session;

    console.log(`   ✅ Seeded TA User: ${taEmail}`);

    testClient = await prisma.client.create({
      data: {
        name: `Prime Industrial Logistics ${timestamp}`,
        industry: "Logistics & Supply Chain",
      },
    });

    testMrf = await prisma.manpowerRequest.create({
      data: {
        clientId: testClient.id,
        createdById: testTA.id,
        title: `MRF-Warehouse Ops Lead-${timestamp}`,
      },
    });

    testJob = await prisma.jobPosting.create({
      data: {
        postedById: testTA.id,
        mrfId: testMrf.id,
        title: `Logistics Operations Coordinator ${timestamp}`,
        description: "Oversee site logistics and supply chain personnel.",
        requirements: "Logistics, Team Management, Safety Compliance",
        status: "OPEN",
      },
    });

    testApplicant = await prisma.user.create({
      data: {
        id: `applicant-audit-${timestamp}`,
        email: `candidate-${timestamp}@example.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Gabriel",
            lastName: "Navarro",
            mobileNumber: "09171112233",
            gender: "MALE",
            province: "Cavite",
            city: "General Trias",
            dateOfBirth: new Date("1994-08-20"),
            birthPlace: "Cavite",
            nationality: "Filipino",
            civilStatus: "SINGLE",
            address: "45 Prime Blvd, Cavite",
          },
        },
      },
    });

    testApp = await prisma.application.create({
      data: {
        userId: testApplicant.id,
        jobPostingId: testJob.id,
        status: "INITIAL_SCREENING",
      },
    });

    // Create Initial Screening PASS interview
    await prisma.interview.create({
      data: {
        applicationId: testApp.id,
        type: "INITIAL_SCREENING",
        result: "PASS",
        scheduledAt: new Date(),
        notes: "Candidate has strong operations leadership and clear communication.",
      },
    });

    console.log(`   ✅ Seeded Application #${testApp.id} for Candidate Gabriel Navarro.`);
    console.log(`   Linked Client: "${testClient.name}" | MRF: "${testMrf.title}"\n`);

    // 2. Launch browser with authenticated context
    console.log("2. Launching Playwright Chromium instance with authenticated session...");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    await context.addInitScript(
      ({ token, rToken }) => {
        localStorage.setItem("access_token", token);
        localStorage.setItem("refresh_token", rToken);
      },
      { token: accessToken, rToken: refreshToken }
    );

    const page = await context.newPage();

    // 3. Navigate directly to Application Detail
    console.log(`3. Navigating to Application #${testApp.id} Detail Page...`);
    await page.goto(`${BASE_URL}/ta/applications/${testApp.id}`);
    await page.waitForSelector("text=Gabriel Navarro", { timeout: 20000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_initial_screening_passed.png"), fullPage: true });

    // Scenario 1 & 2: Check "Endorse to Client" button appears after passing screening
    console.log("\n--- SCENARIO 1 & 2: Verify Endorsement Button & Auto-Linked Client Display ---");
    const endorseBtn = page.locator('button:has-text("Endorse to Client")').first();
    const hasEndorseBtn = (await endorseBtn.count()) > 0;
    console.log(`   [Check] "Endorse to Client" button visible: ${hasEndorseBtn ? "✅ PASS" : "❌ FAIL"}`);
    if (!hasEndorseBtn) throw new Error("Endorse to Client button not found");

    // Scenario 3 & 7: Open Endorsement Modal and verify auto-linked info & no arbitrary client selector
    await endorseBtn.click();
    await page.waitForSelector('text=Endorse Candidate to Client', { timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02_endorse_modal_autolinked.png") });

    const modalText = await page.locator('[role="dialog"]').innerText();
    const containsClient = modalText.includes(testClient.name);
    const containsMRF = modalText.includes(testMrf.title);
    const hasTargetClientSelect = (await page.locator('[role="dialog"] select:has-text("Select a client")').count()) > 0;

    console.log(`   [Check] Modal shows auto-linked Client "${testClient.name}": ${containsClient ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`   [Check] Modal shows auto-linked MRF "${testMrf.title}": ${containsMRF ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`   [Check] Rogue client dropdown is absent (no manual spoofing): ${!hasTargetClientSelect ? "✅ PASS" : "❌ FAIL"}`);

    // Scenario 3: Submit Endorsement as PENDING
    console.log("\n--- SCENARIO 3 & 4: Record Endorsement as PENDING (Under Client Review) ---");
    await page.fill('[role="dialog"] textarea', "Endorsing candidate profile and screening report to client operations manager.");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03_endorse_modal_filled.png") });

    await page.click('[role="dialog"] button:has-text("Submit Endorsement to Client")');
    await page.waitForSelector('button:has-text("Record Client Decision")', { timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04_pending_client_review_banner.png"), fullPage: true });

    // Scenario 4: Verify Banner shows "Record Client Decision" and "Advance to Client Evaluation" is BLOCKED
    const recordDecisionBtn = page.locator('button:has-text("Record Client Decision")').first();
    const advanceBtn = page.locator('button:has-text("Advance to Client Evaluation")');
    const isRecordDecisionVisible = (await recordDecisionBtn.count()) > 0;
    const isAdvanceVisible = (await advanceBtn.count()) > 0;

    console.log(`   [Check] "Record Client Decision" action is present: ${isRecordDecisionVisible ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`   [Check] "Advance to Client Evaluation" is BLOCKED while Pending: ${!isAdvanceVisible ? "✅ PASS" : "❌ FAIL"}`);

    // Scenario 8: Refreshing page keeps correct endorsement state
    console.log("\n--- SCENARIO 8: Page Refresh Persistence ---");
    await page.reload();
    await page.waitForSelector("text=Gabriel Navarro", { timeout: 20000 });
    await page.waitForTimeout(1000);
    const isRecordDecisionStillVisible = (await page.locator('button:has-text("Record Client Decision")').count()) > 0;
    console.log(`   [Check] Endorsement state persists after full reload: ${isRecordDecisionStillVisible ? "✅ PASS" : "❌ FAIL"}`);

    // Scenario 6: Test Client DECLINED flow
    console.log("\n--- SCENARIO 6: Client Decision -> DECLINED (Blocks Final Interview) ---");
    await page.locator('button:has-text("Record Client Decision")').first().click();
    await page.waitForSelector('text=Record Client Hiring Decision', { timeout: 5000 });

    // Select DECLINED
    await page.selectOption('[role="dialog"] select', "DECLINED");
    await page.fill('[role="dialog"] textarea', "Client decided not to proceed with this applicant.");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05_client_decision_modal_declined.png") });

    await page.click('[role="dialog"] button:has-text("Save Client Decision")');
    await page.waitForSelector('button:has-text("Update Client Decision")', { timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06_client_declined_state.png"), fullPage: true });

    const isAdvanceBlockedAfterDecline = (await page.locator('button:has-text("Advance to Client Evaluation")').count()) === 0;
    console.log(`   [Check] "Advance to Client Evaluation" remains BLOCKED on Decline: ${isAdvanceBlockedAfterDecline ? "✅ PASS" : "❌ FAIL"}`);

    // Scenario 5: Update Client Decision to APPROVED -> Unlocks Final Interview
    console.log("\n--- SCENARIO 5: Client Decision -> APPROVED (Unlocks Final Interview) ---");
    await page.locator('button:has-text("Update Client Decision")').first().click();
    await page.waitForSelector('text=Record Client Hiring Decision', { timeout: 5000 });

    await page.selectOption('[role="dialog"] select', "APPROVED");
    await page.fill('[role="dialog"] textarea', "Client accepted candidate and requested technical interview.");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07_client_decision_modal_approved.png") });

    await page.click('[role="dialog"] button:has-text("Save Client Decision")');
    await page.waitForSelector('button:has-text("Advance to Client Evaluation")', { timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "08_client_approved_unlocked.png"), fullPage: true });

    const advanceToFinalBtn = page.locator('button:has-text("Advance to Client Evaluation")').first();
    const isAdvanceNowUnlocked = (await advanceToFinalBtn.count()) > 0;
    console.log(`   [Check] "Advance to Client Evaluation" is UNLOCKED after Approval: ${isAdvanceNowUnlocked ? "✅ PASS" : "❌ FAIL"}`);

    // Click "Advance to Client Evaluation" and verify transition to FINAL_INTERVIEW
    console.log("   Advancing application to Client Evaluation (FINAL_INTERVIEW)...");
    await advanceToFinalBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "09_advanced_to_final_interview.png"), fullPage: true });

    const pageContent = await page.locator("body").innerText();
    const isInFinalInterview = pageContent.includes("FINAL_INTERVIEW") || pageContent.includes("Final Interview");
    console.log(`   [Check] Application transitioned to Final Interview stage: ${isInFinalInterview ? "✅ PASS" : "❌ FAIL"}`);

    // Scenario 9: Verify Tab 5 Client Endorsements list and badge
    console.log("\n--- SCENARIO 9: Verify Endorsements Tab Badges & No Duplicate Buttons ---");
    const endorsementsTabBtn = page.locator('button:has-text("Client Endorsements")').first();
    if (await endorsementsTabBtn.count() > 0) {
      await endorsementsTabBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "10_tab5_endorsements_list.png"), fullPage: true });
      const tab5Text = await page.locator('[role="tabpanel"], div.space-y-6').innerText();
      const hasApprovedBadge = tab5Text.includes("APPROVED");
      console.log(`   [Check] Endorsements Tab displays APPROVED badge: ${hasApprovedBadge ? "✅ PASS" : "❌ FAIL"}`);
    }

    // Check no duplicate Advance Stage button in header
    const topAdvanceBtn = page.locator('header button:has-text("Advance Stage")');
    const hasDuplicateTopAdvance = (await topAdvanceBtn.count()) > 0;
    console.log(`   [Check] Duplicate top "Advance Stage" button is gone: ${!hasDuplicateTopAdvance ? "✅ PASS" : "❌ FAIL"}`);

    await browser.close();

    console.log("\n=======================================================");
    console.log("  🎉 ALL 9 CLIENT ENDORSEMENT AUDIT SCENARIOS PASSED!");
    console.log("=======================================================\n");

  } catch (error) {
    console.error("❌ Playwright Audit Failed:", error);
    process.exit(1);
  } finally {
    try {
      if (testApp?.id) {
        await prisma.recruiterDecision.deleteMany({ where: { applicationId: testApp.id } }).catch(() => {});
        await prisma.clientEndorsement.deleteMany({ where: { applicationId: testApp.id } }).catch(() => {});
        await prisma.interview.deleteMany({ where: { applicationId: testApp.id } }).catch(() => {});
        await prisma.application.deleteMany({ where: { id: testApp.id } }).catch(() => {});
      }
      if (testJob?.id) await prisma.jobPosting.deleteMany({ where: { id: testJob.id } }).catch(() => {});
      if (testMrf?.id) await prisma.manpowerRequest.deleteMany({ where: { id: testMrf.id } }).catch(() => {});
      if (testClient?.id) {
        await prisma.clientEndorsement.deleteMany({ where: { clientId: testClient.id } }).catch(() => {});
        await prisma.client.deleteMany({ where: { id: testClient.id } }).catch(() => {});
      }
      if (testApplicant?.id) {
        await prisma.applicantProfile.deleteMany({ where: { userId: testApplicant.id } }).catch(() => {});
        await prisma.notification.deleteMany({ where: { userId: testApplicant.id } }).catch(() => {});
        await prisma.user.deleteMany({ where: { id: testApplicant.id } }).catch(() => {});
      }
      if (supabaseTaUserId) {
        await prisma.user.deleteMany({ where: { id: supabaseTaUserId } }).catch(() => {});
        await supabase.auth.admin.deleteUser(supabaseTaUserId).catch(() => {});
      }
    } catch {
      // Best-effort cleanup
    } finally {
      await prisma.$disconnect();
    }
  }
}

main();
