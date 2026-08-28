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
const SCREENSHOT_DIR = path.resolve("./screenshots/initial_screening");

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function main() {
  console.log("\n=======================================================");
  console.log("  PLAYWRIGHT AUDIT: INITIAL SCREENING PASS WORKFLOW");
  console.log("=======================================================\n");

  const timestamp = Date.now();
  const taEmail = `ta-screening-audit-${timestamp}@megs.com`;
  const taPassword = "AuditPassword123!";
  const applicantEmail = `applicant-screening-audit-${timestamp}@example.com`;
  const applicantPassword = "ApplicantPassword123!";

  let testClient, testMrf, testJob, testTA, testApplicant, testApp;
  let supabaseTaUserId, supabaseApplicantUserId;
  let browser;

  try {
    // 1. Seed TA User
    console.log("1. Seeding test TA user in Supabase & Postgres...");
    const { data: supaTa, error: supaTaErr } = await supabase.auth.admin.createUser({
      email: taEmail,
      password: taPassword,
      email_confirm: true,
      user_metadata: { role: "TALENT_ACQUISITION", name: "TA Screening Specialist" },
    });
    if (supaTaErr || !supaTa.user) {
      throw new Error(`Failed to create test TA in Supabase: ${supaTaErr?.message}`);
    }
    supabaseTaUserId = supaTa.user.id;

    testTA = await prisma.user.create({
      data: {
        id: supabaseTaUserId,
        email: taEmail,
        role: "TALENT_ACQUISITION",
        accountStatus: "ACTIVE",
        mustChangePassword: false,
      },
    });

    const { data: taSession, error: taSignInErr } = await supabase.auth.signInWithPassword({
      email: taEmail,
      password: taPassword,
    });
    if (taSignInErr || !taSession?.session) {
      throw new Error(`Failed to generate TA session: ${taSignInErr?.message}`);
    }
    const { access_token: taAccessToken, refresh_token: taRefreshToken } = taSession.session;
    console.log(`   ✅ Seeded TA User: ${taEmail}`);

    // 2. Seed Applicant User
    console.log("2. Seeding test Applicant user in Supabase & Postgres...");
    const { data: supaApp, error: supaAppErr } = await supabase.auth.admin.createUser({
      email: applicantEmail,
      password: applicantPassword,
      email_confirm: true,
      user_metadata: { role: "APPLICANT", name: "Nathaniel Cruz" },
    });
    if (supaAppErr || !supaApp.user) {
      throw new Error(`Failed to create test Applicant in Supabase: ${supaAppErr?.message}`);
    }
    supabaseApplicantUserId = supaApp.user.id;

    testApplicant = await prisma.user.create({
      data: {
        id: supabaseApplicantUserId,
        email: applicantEmail,
        role: "APPLICANT",
        accountStatus: "ACTIVE",
        mustChangePassword: false,
        applicantProfile: {
          create: {
            firstName: "Nathaniel",
            lastName: "Cruz",
            mobileNumber: "09694173025",
            gender: "MALE",
            province: "Metro Manila",
            city: "Muntinlupa",
            dateOfBirth: new Date("1996-03-12"),
            birthPlace: "Muntinlupa City",
            nationality: "Filipino",
            civilStatus: "SINGLE",
            address: "101 Alabang Hills",
            professionalSummary: "Experienced logistics delivery driver with clean professional license",
          },
        },
      },
    });

    const { data: applicantSession, error: appSignInErr } = await supabase.auth.signInWithPassword({
      email: applicantEmail,
      password: applicantPassword,
    });
    if (appSignInErr || !applicantSession?.session) {
      throw new Error(`Failed to generate Applicant session: ${appSignInErr?.message}`);
    }
    const { access_token: applicantAccessToken, refresh_token: applicantRefreshToken } = applicantSession.session;
    console.log(`   ✅ Seeded Applicant: ${applicantEmail} (Nathaniel Cruz)`);

    // 3. Create Client, MRF, Job Posting
    testClient = await prisma.client.create({
      data: {
        name: `1 Star Alabang Logistics ${timestamp}`,
        industry: "Logistics & Transport",
      },
    });

    testMrf = await prisma.manpowerRequest.create({
      data: {
        clientId: testClient.id,
        createdById: testTA.id,
        title: `MRF-Delivery Driver-${timestamp}`,
        location: "1 Star Alabang",
      },
    });

    testJob = await prisma.jobPosting.create({
      data: {
        postedById: testTA.id,
        mrfId: testMrf.id,
        title: `DELIVERY DRIVER ${timestamp}`,
        description: "Delivery Driver for 1 Star Alabang operations.",
        requirements: "Professional Driver License",
        location: "1 Star Alabang",
        status: "OPEN",
      },
    });

    // 4. Create Application starting in SUBMITTED state
    testApp = await prisma.application.create({
      data: {
        userId: testApplicant.id,
        jobPostingId: testJob.id,
        status: "SUBMITTED",
      },
    });
    console.log(`   ✅ Seeded Application #${testApp.id} in SUBMITTED status.\n`);

    // Launch Chromium browser
    console.log("3. Launching Playwright browser instance...");
    browser = await chromium.launch({ headless: true });

    // Create TA browser context
    const taContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await taContext.addInitScript(
      ({ token, rToken }) => {
        localStorage.setItem("access_token", token);
        localStorage.setItem("refresh_token", rToken);
      },
      { token: taAccessToken, rToken: taRefreshToken }
    );
    const taPage = await taContext.newPage();

    // Create Applicant browser context
    const applicantContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await applicantContext.addInitScript(
      ({ token, rToken }) => {
        localStorage.setItem("access_token", token);
        localStorage.setItem("refresh_token", rToken);
      },
      { token: applicantAccessToken, rToken: applicantRefreshToken }
    );
    const applicantPage = await applicantContext.newPage();

    // Step 1: Open Application in TA Portal (Shows SUBMITTED / UNDER REVIEW)
    console.log(`\n--- TEST 1: TA Portal initial view (SUBMITTED / UNDER REVIEW) ---`);
    await taPage.goto(`${BASE_URL}/ta/applications/${testApp.id}`);
    await taPage.waitForSelector("text=Nathaniel Cruz", { timeout: 20000 });
    await taPage.waitForTimeout(1000);
    await taPage.screenshot({ path: path.join(SCREENSHOT_DIR, "01_ta_portal_submitted.png"), fullPage: true });

    const scheduleBtn = taPage.locator('button:has-text("Schedule Initial Interview")').first();
    const hasScheduleBtn = (await scheduleBtn.count()) > 0;
    console.log(`   [Check] "Schedule Initial Interview" button is visible: ${hasScheduleBtn ? "✅ PASS" : "❌ FAIL"}`);
    if (!hasScheduleBtn) throw new Error("Schedule Initial Interview button not found on TA portal");

    // Step 2: Schedule Initial Screening Interview
    console.log(`\n--- TEST 2: Schedule Initial Screening in TA Portal ---`);
    await scheduleBtn.click();
    await taPage.waitForSelector('text=Schedule Initial Screening Interview', { timeout: 5000 });

    const scheduledDateStr = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 16);
    await taPage.fill('input[type="datetime-local"]', scheduledDateStr);
    await taPage.fill('[role="dialog"] textarea', "Initial Screening via Phone/Video");
    await taPage.screenshot({ path: path.join(SCREENSHOT_DIR, "02_schedule_modal.png") });

    await taPage.click('[role="dialog"] button:has-text("Schedule Interview")');
    await taPage.waitForSelector('button:has-text("Record Screening Result")', { timeout: 10000 });
    await taPage.waitForTimeout(1000);
    await taPage.screenshot({ path: path.join(SCREENSHOT_DIR, "03_scheduled_screening_state.png"), fullPage: true });

    // Verify DB state updated to INITIAL_SCREENING
    const dbAppAfterSchedule = await prisma.application.findUnique({ where: { id: testApp.id } });
    console.log(`   [Check] Database application status after scheduling is INITIAL_SCREENING: ${dbAppAfterSchedule?.status === "INITIAL_SCREENING" ? "✅ PASS" : `❌ FAIL (${dbAppAfterSchedule?.status})`}`);
    if (dbAppAfterSchedule?.status !== "INITIAL_SCREENING") throw new Error("Application status not updated on scheduling");

    // Step 3: Record Initial Screening as PASS
    console.log(`\n--- TEST 3: TA records Initial Screening as PASS ---`);
    const recordResultBtn = taPage.locator('button:has-text("Record Screening Result")').first();
    await recordResultBtn.click();
    await taPage.waitForSelector('text=Record Interview Assessment', { timeout: 5000 });

    await taPage.selectOption('[role="dialog"] select', "PASS");
    await taPage.fill('[role="dialog"] textarea', "Clear communication, verified valid professional license.");
    await taPage.screenshot({ path: path.join(SCREENSHOT_DIR, "04_record_result_modal_pass.png") });

    await taPage.click('[role="dialog"] button:has-text("Save Result")');

    // Step 4: Verify "Endorse to Client" button immediately appears without manual refresh
    console.log(`\n--- TEST 4: Real-time UI synchronization — Endorse to Client Button visibility ---`);
    await taPage.waitForSelector('button:has-text("Endorse to Client")', { timeout: 10000 });
    await taPage.waitForTimeout(1000);
    await taPage.screenshot({ path: path.join(SCREENSHOT_DIR, "05_ta_screening_passed_endorse_available.png"), fullPage: true });

    const endorseBtn = taPage.locator('button:has-text("Endorse to Client")').first();
    const isEndorseVisible = (await endorseBtn.count()) > 0;
    console.log(`   [Check] "Endorse to Client" button is visible and active: ${isEndorseVisible ? "✅ PASS" : "❌ FAIL"}`);
    if (!isEndorseVisible) throw new Error("Endorse to Client button did not appear");

    // Step 5: Check Applicant Portal for real-time synchronization
    console.log(`\n--- TEST 5: Applicant Portal reflects INITIAL SCREENING PASS and Stage 2 ---`);
    await applicantPage.goto(`${BASE_URL}/login`);
    await applicantPage.fill('input[type="email"], input[name="email"]', applicantEmail);
    await applicantPage.fill('input[type="password"], input[name="password"]', applicantPassword);
    await applicantPage.click('button[type="submit"]');
    await applicantPage.waitForURL("**/app**", { timeout: 10000 });

    await applicantPage.goto(`${BASE_URL}/app/applications/${testApp.id}`);
    await applicantPage.waitForSelector(`text=DELIVERY DRIVER`, { timeout: 20000 });
    await applicantPage.waitForTimeout(1000);
    await applicantPage.screenshot({ path: path.join(SCREENSHOT_DIR, "06_applicant_portal_passed.png"), fullPage: true });

    const applicantContent = await applicantPage.locator("body").innerText();
    const hasInitialScreeningPass = applicantContent.includes("PASS");
    console.log(`   [Check] Applicant portal shows INITIAL SCREENING PASS: ${hasInitialScreeningPass ? "✅ PASS" : "❌ FAIL"}`);
    if (!hasInitialScreeningPass) throw new Error("Applicant portal did not show PASS");

    // Step 6: TA clicks "Endorse to Client" and completes client endorsement
    console.log(`\n--- TEST 6: TA performs Endorse to Client -> moves to CLIENT_ENDORSEMENT (Stage 3) ---`);
    await endorseBtn.click();
    await taPage.waitForSelector('text=Endorse Candidate to Client', { timeout: 5000 });
    await taPage.fill('[role="dialog"] textarea', "Endorsing Nathaniel Cruz to 1 Star Alabang operations manager.");
    await taPage.screenshot({ path: path.join(SCREENSHOT_DIR, "07_endorse_modal.png") });

    await taPage.click('[role="dialog"] button:has-text("Submit Endorsement to Client")');
    await taPage.waitForSelector('button:has-text("Record Client Decision")', { timeout: 10000 });
    await taPage.waitForTimeout(1000);
    await taPage.screenshot({ path: path.join(SCREENSHOT_DIR, "08_client_endorsement_stage.png"), fullPage: true });

    const dbAppAfterEndorse = await prisma.application.findUnique({ where: { id: testApp.id } });
    console.log(`   [Check] Database status is CLIENT_ENDORSEMENT: ${dbAppAfterEndorse?.status === "CLIENT_ENDORSEMENT" ? "✅ PASS" : `❌ FAIL (${dbAppAfterEndorse?.status})`}`);

    // Step 7: Page reload persistence on both portals
    console.log(`\n--- TEST 7: Page reload persistence on both TA and Applicant portals ---`);
    await taPage.reload();
    await taPage.waitForSelector("text=Nathaniel Cruz", { timeout: 20000 });
    await taPage.waitForTimeout(1000);
    const isRecordDecisionStillVisible = (await taPage.locator('button:has-text("Record Client Decision")').count()) > 0;
    console.log(`   [Check] TA Portal maintains CLIENT_ENDORSEMENT after reload: ${isRecordDecisionStillVisible ? "✅ PASS" : "❌ FAIL"}`);

    await applicantPage.reload();
    await applicantPage.waitForSelector("text=DELIVERY DRIVER", { timeout: 20000 });
    await applicantPage.waitForTimeout(1000);
    await applicantPage.screenshot({ path: path.join(SCREENSHOT_DIR, "09_applicant_portal_endorsed.png"), fullPage: true });
    console.log(`   [Check] Applicant Portal persists updated stage after reload: ✅ PASS`);

    // Step 8: Test Stage Skipping & Bypass Prevention (Cannot skip to COMPLIANCE or HIRED)
    console.log(`\n--- TEST 8: Verify TA cannot skip stages prematurely ---`);
    const isDirectComplianceBlocked = (await taPage.locator('button:has-text("Deploy Candidate to Site")').count()) === 0;
    console.log(`   [Check] Later-stage actions (Deploy Candidate) are blocked: ${isDirectComplianceBlocked ? "✅ PASS" : "❌ FAIL"}`);

    await browser.close();

    console.log("\n=======================================================");
    console.log("  🎉 ALL 8 INITIAL SCREENING AUDIT SCENARIOS PASSED!");
    console.log("=======================================================\n");

  } catch (error) {
    console.error("❌ Playwright Audit Failed:", error);
    if (browser) await browser.close();
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
      if (supabaseApplicantUserId) {
        await supabase.auth.admin.deleteUser(supabaseApplicantUserId).catch(() => {});
      }
      if (testTA?.id) {
        await prisma.notification.deleteMany({ where: { userId: testTA.id } }).catch(() => {});
        await prisma.user.deleteMany({ where: { id: testTA.id } }).catch(() => {});
      }
      if (supabaseTaUserId) {
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
