import { chromium } from "playwright";
import dotenv from "dotenv";
import { PrismaPg } from "../backend/node_modules/@prisma/adapter-pg/dist/index.js";
import { PrismaClient } from "../backend/node_modules/@prisma/client/default.js";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

dotenv.config({ path: path.resolve("../backend/.env") });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SCREENSHOT_DIR = path.resolve("./screenshots/analytics");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function getAvailableUrl() {
  const urls = ["http://localhost:5174", "http://localhost:5173"];
  for (const u of urls) {
    try {
      const res = await fetch(u);
      if (res.ok || res.status === 200 || res.status === 304) return u;
    } catch {
      // ignore
    }
  }
  return "http://localhost:5174";
}

async function verifyAnalytics() {
  const BASE_URL = await getAvailableUrl();
  console.log(`\n=======================================================`);
  console.log(`  PLAYWRIGHT AUDIT: RECRUITMENT ANALYTICS DASHBOARDS`);
  console.log(`  Target URL: ${BASE_URL}`);
  console.log(`=======================================================\n`);

  const timestamp = Date.now();
  const adminEmail = `admin-analytics-${timestamp}@megs.com`;
  const taEmail = `ta-analytics-${timestamp}@megs.com`;
  const password = "AuditPassword123!";

  let testAdmin, testTA, testClient, testMrf, testJob, testCand, testApp;
  const errors = [];

  try {
    // 1. Seed and Authenticate Admin
    console.log("1. Seeding & Authenticating Admin User...");
    const { data: supaAdmin, error: adminErr } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: password,
      email_confirm: true,
      user_metadata: { role: "ADMINISTRATOR", name: "Admin Analytics Lead" },
    });
    if (adminErr || !supaAdmin.user) {
      throw new Error(`Failed to create test Admin in Supabase: ${adminErr?.message}`);
    }

    testAdmin = await prisma.user.create({
      data: {
        id: supaAdmin.user.id,
        email: adminEmail,
        role: "ADMINISTRATOR",
        accountStatus: "ACTIVE",
        mustChangePassword: false,
      },
    });

    const { data: adminSession, error: adminSignErr } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: password,
    });
    if (adminSignErr || !adminSession?.session) {
      throw new Error(`Failed to login Admin: ${adminSignErr?.message}`);
    }
    const adminAccessToken = adminSession.session.access_token;
    const adminRefreshToken = adminSession.session.refresh_token;
    console.log(`   ✅ Authenticated Admin: ${adminEmail}`);

    // 2. Seed and Authenticate TA Specialist
    console.log("\n2. Seeding & Authenticating TA Specialist User...");
    const { data: supaTA, error: taErr } = await supabase.auth.admin.createUser({
      email: taEmail,
      password: password,
      email_confirm: true,
      user_metadata: { role: "TALENT_ACQUISITION", name: "TA Analytics Specialist" },
    });
    if (taErr || !supaTA.user) {
      throw new Error(`Failed to create test TA in Supabase: ${taErr?.message}`);
    }

    testTA = await prisma.user.create({
      data: {
        id: supaTA.user.id,
        email: taEmail,
        role: "TALENT_ACQUISITION",
        accountStatus: "ACTIVE",
        mustChangePassword: false,
      },
    });

    const { data: taSession, error: taSignErr } = await supabase.auth.signInWithPassword({
      email: taEmail,
      password: password,
    });
    if (taSignErr || !taSession?.session) {
      throw new Error(`Failed to login TA: ${taSignErr?.message}`);
    }
    const taAccessToken = taSession.session.access_token;
    const taRefreshToken = taSession.session.refresh_token;
    console.log(`   ✅ Authenticated TA: ${taEmail}`);

    // Seed TA test requisitions & candidate activity
    testClient = await prisma.client.create({
      data: { name: `Global Tech Logistics ${timestamp}`, industry: "Industrial Technology" },
    });
    testMrf = await prisma.manpowerRequest.create({
      data: { clientId: testClient.id, createdById: testTA.id, title: `MRF-Warehouse Automation-${timestamp}` },
    });
    testJob = await prisma.jobPosting.create({
      data: {
        postedById: testTA.id,
        mrfId: testMrf.id,
        title: `Automation Controls Technician ${timestamp}`,
        description: "Industrial robotics maintenance and PLC support.",
        requirements: "PLC, Robotics, SCADA",
        status: "OPEN",
      },
    });

    // Seed test candidate
    const candEmail = `cand-${timestamp}@example.com`;
    const { data: supaCand } = await supabase.auth.admin.createUser({
      email: candEmail,
      password: password,
      email_confirm: true,
      user_metadata: { role: "APPLICANT" },
    });
    testCand = await prisma.user.create({
      data: {
        id: supaCand.user.id,
        email: candEmail,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Eduardo",
            lastName: "Villanueva",
            professionalSummary: "Mechatronics Specialist",
          },
        },
      },
    });

    testApp = await prisma.application.create({
      data: {
        userId: testCand.id,
        jobPostingId: testJob.id,
        status: "INITIAL_SCREENING",
        resumeUrl: "https://example.com/resume.pdf",
      },
    });

    await prisma.interview.create({
      data: {
        applicationId: testApp.id,
        type: "INITIAL_SCREENING",
        scheduledAt: new Date(Date.now() - 3600 * 1000 * 24 * 2),
        conductedAt: new Date(),
        result: "PASS",
        notes: "Excellent domain knowledge",
        isActive: true,
      },
    });

    await prisma.recruiterDecision.create({
      data: {
        applicationId: testApp.id,
        actorId: testTA.id,
        fromStatus: "SUBMITTED",
        toStatus: "INITIAL_SCREENING",
        reason: "Matched requirements and passed initial screening",
      },
    });

    // 3. Launch Browser and Audit Admin Analytics
    console.log("\n3. Launching Chromium to test Admin Analytics (/admin/analytics)...");
    const browser = await chromium.launch({ headless: true });

    // -------------------------------------------------------------
    // PART 1: SYSTEM ADMINISTRATOR ANALYTICS (/admin/analytics)
    // -------------------------------------------------------------
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await adminContext.addInitScript(
      ({ token, rToken }) => {
        localStorage.setItem("access_token", token);
        localStorage.setItem("refresh_token", rToken);
      },
      { token: adminAccessToken, rToken: adminRefreshToken }
    );

    const adminPage = await adminContext.newPage();
    adminPage.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("favicon")) {
        console.error(`[Admin Console Error]: ${msg.text()}`);
        errors.push({ context: "admin", text: msg.text() });
      }
    });

    console.log("  Navigating to /admin/analytics...");
    await adminPage.goto(`${BASE_URL}/admin/analytics`);
    await adminPage.waitForSelector("h1:has-text('Organization Recruitment Analytics')", { timeout: 15000 });
    await adminPage.waitForSelector("text='Total Applications'", { timeout: 15000 });
    await adminPage.waitForTimeout(1000);

    // Desktop Screenshot
    await adminPage.screenshot({ path: path.join(SCREENSHOT_DIR, "01_admin_analytics_desktop.png"), fullPage: true });
    console.log("  📸 Saved 01_admin_analytics_desktop.png");

    // Check KPI Cards
    const kpiElements = [
      "Total Applications",
      "Active Candidates",
      "Talent Pool",
      "Client Endorsements",
      "In 201 Compliance",
      "Total Deployments",
    ];
    for (const kpi of kpiElements) {
      const visible = await adminPage.locator(`text=${kpi}`).count();
      console.log(`  ✓ Admin KPI Card [${kpi}]: ${visible > 0 ? "VISIBLE" : "MISSING"}`);
    }

    // Check Charts & Sections
    const chartSections = [
      "Organization Recruitment Activity Trend",
      "Recruitment Funnel & Conversion Velocity",
      "Applications by Job Posting & MRF Demand",
      "Recruitment Pipeline Bottleneck & Aging Analysis",
    ];
    for (const sec of chartSections) {
      const visible = await adminPage.locator(`text=${sec}`).count();
      console.log(`  ✓ Admin Section [${sec}]: ${visible > 0 ? "VISIBLE" : "MISSING"}`);
    }

    // Test Metric Toggles
    console.log("  Testing metric toggles on activity chart...");
    const initialInterviewsToggle = adminPage.locator('button:has-text("Initial Interviews")').first();
    if (await initialInterviewsToggle.count() > 0) {
      await initialInterviewsToggle.click();
      await adminPage.waitForTimeout(500);
      await initialInterviewsToggle.click();
      console.log("  ✓ Metric toggle interactive test passed.");
    }

    // Test 7-Day Filter Preset
    console.log("  Testing 7 Days filter preset...");
    const filter7d = adminPage.locator('button:has-text("Last 7 Days")').first();
    if (await filter7d.count() > 0) {
      await filter7d.click();
      await adminPage.waitForTimeout(1000);
      await adminPage.screenshot({ path: path.join(SCREENSHOT_DIR, "02_admin_analytics_7d_filter.png"), fullPage: true });
      console.log("  📸 Saved 02_admin_analytics_7d_filter.png");
    }

    // Responsive: Tablet View (768px)
    await adminPage.setViewportSize({ width: 768, height: 1024 });
    await adminPage.waitForTimeout(800);
    await adminPage.screenshot({ path: path.join(SCREENSHOT_DIR, "03_admin_analytics_tablet.png"), fullPage: true });
    console.log("  📸 Saved 03_admin_analytics_tablet.png");

    // Responsive: Mobile View (375px)
    await adminPage.setViewportSize({ width: 375, height: 812 });
    await adminPage.waitForTimeout(800);
    await adminPage.screenshot({ path: path.join(SCREENSHOT_DIR, "04_admin_analytics_mobile.png"), fullPage: true });
    console.log("  📸 Saved 04_admin_analytics_mobile.png");

    await adminContext.close();

    // -------------------------------------------------------------
    // PART 2: TALENT ACQUISITION ANALYTICS (/ta/analytics)
    // -------------------------------------------------------------
    console.log("\n4. Testing Talent Acquisition Analytics (/ta/analytics)...");
    const taContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await taContext.addInitScript(
      ({ token, rToken }) => {
        localStorage.setItem("access_token", token);
        localStorage.setItem("refresh_token", rToken);
      },
      { token: taAccessToken, rToken: taRefreshToken }
    );

    const taPage = await taContext.newPage();
    taPage.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("favicon")) {
        console.error(`[TA Console Error]: ${msg.text()}`);
        errors.push({ context: "ta", text: msg.text() });
      }
    });

    console.log("  Navigating to /ta/analytics...");
    await taPage.goto(`${BASE_URL}/ta/analytics`);
    await taPage.waitForSelector("h1:has-text('Recruitment Operations Intelligence')", { timeout: 15000 });
    await taPage.waitForSelector("text='My Active Pipeline'", { timeout: 15000 });
    await taPage.waitForTimeout(1000);

    // Desktop Screenshot
    await taPage.screenshot({ path: path.join(SCREENSHOT_DIR, "05_ta_analytics_desktop.png"), fullPage: true });
    console.log("  📸 Saved 05_ta_analytics_desktop.png");

    // Check TA Workload Cards
    const taCards = [
      "My Active Pipeline",
      "Screening Pending",
      "Ready to Endorse",
      "Client Decisions",
      "Final Interviews",
      "201 Compliance",
    ];
    for (const card of taCards) {
      const visible = await taPage.locator(`text=${card}`).count();
      console.log(`  ✓ TA Workload Card [${card}]: ${visible > 0 ? "VISIBLE" : "MISSING"}`);
    }

    // Check TA Sections
    const taSections = [
      "My Recruitment Activity Trend",
      "My Candidate Pipeline Funnel",
      "Workload Action Queue",
      "Recruitment Report Export Center",
    ];
    for (const sec of taSections) {
      const visible = await taPage.locator(`text=${sec}`).count();
      console.log(`  ✓ TA Section [${sec}]: ${visible > 0 ? "VISIBLE" : "MISSING"}`);
    }

    // Responsive: Tablet View (768px)
    await taPage.setViewportSize({ width: 768, height: 1024 });
    await taPage.waitForTimeout(800);
    await taPage.screenshot({ path: path.join(SCREENSHOT_DIR, "06_ta_analytics_tablet.png"), fullPage: true });
    console.log("  📸 Saved 06_ta_analytics_tablet.png");

    // Responsive: Mobile View (375px)
    await taPage.setViewportSize({ width: 375, height: 812 });
    await taPage.waitForTimeout(800);
    await taPage.screenshot({ path: path.join(SCREENSHOT_DIR, "07_ta_analytics_mobile.png"), fullPage: true });
    console.log("  📸 Saved 07_ta_analytics_mobile.png");

    await taContext.close();
    await browser.close();

    console.log("\n=======================================================");
    console.log(`ANALYTICS AUDIT COMPLETE: ${errors.length} error(s) detected.`);
    console.log("=======================================================\n");

    if (errors.length > 0) {
      console.error("Errors encountered during audit:", errors);
      process.exit(1);
    }
  } finally {
    // Cleanup seeded test users
    try {
      if (testAdmin) {
        await prisma.user.delete({ where: { id: testAdmin.id } }).catch(() => {});
        await supabase.auth.admin.deleteUser(testAdmin.id).catch(() => {});
      }
      if (testTA) {
        if (testApp) {
          await prisma.recruiterDecision.deleteMany({ where: { applicationId: testApp.id } }).catch(() => {});
          await prisma.interview.deleteMany({ where: { applicationId: testApp.id } }).catch(() => {});
          await prisma.application.delete({ where: { id: testApp.id } }).catch(() => {});
        }
        if (testJob) {
          await prisma.jobPosting.delete({ where: { id: testJob.id } }).catch(() => {});
        }
        if (testMrf) {
          await prisma.manpowerRequest.delete({ where: { id: testMrf.id } }).catch(() => {});
        }
        if (testClient) {
          await prisma.client.delete({ where: { id: testClient.id } }).catch(() => {});
        }
        if (testCand) {
          await prisma.applicantProfile.deleteMany({ where: { userId: testCand.id } }).catch(() => {});
          await prisma.user.delete({ where: { id: testCand.id } }).catch(() => {});
          await supabase.auth.admin.deleteUser(testCand.id).catch(() => {});
        }
        await prisma.user.delete({ where: { id: testTA.id } }).catch(() => {});
        await supabase.auth.admin.deleteUser(testTA.id).catch(() => {});
      }
      await prisma.$disconnect();
    } catch {
      // ignore
    }
  }
}

verifyAnalytics().catch((err) => {
  console.error("FATAL verification error:", err);
  process.exit(1);
});
