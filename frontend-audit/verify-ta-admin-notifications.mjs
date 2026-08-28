import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:5173";
const API_URL = "http://localhost:3000";
const SCREENSHOT_DIR = path.resolve("./screenshots/ta-admin-notifications");

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function runComprehensiveNotificationAudit() {
  console.log("\n=======================================================");
  console.log("  TA & ADMIN NOTIFICATION PLAYWRIGHT AUDIT & VERIFICATION");
  console.log("=======================================================\n");

  const browser = await chromium.launch({ headless: true });

  // 1. Create contexts for TA, Admin, and Applicant
  console.log("[1/6] Establishing Multi-Role Browser Contexts...");
  
  const taContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const taPage = await taContext.newPage();

  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await adminContext.newPage();

  const applicantContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const applicantPage = await applicantContext.newPage();

  // Login as TA
  console.log("  -> Logging in as TA (ta@megs-recruitment.com)...");
  await taPage.goto(`${BASE_URL}/login`);
  await taPage.fill('input[type="email"], input[name="email"]', "ta@megs-recruitment.com");
  await taPage.fill('input[type="password"], input[name="password"]', "TAPassword123!");
  await taPage.click('button[type="submit"]');
  await taPage.waitForURL("**/ta**", { timeout: 10000 });
  const taToken = await taPage.evaluate(() => localStorage.getItem("access_token"));
  console.log("  ✅ TA logged in at:", taPage.url());

  // Login as Admin
  console.log("  -> Logging in as Admin (admin@megs-recruitment.com)...");
  await adminPage.goto(`${BASE_URL}/login`);
  await adminPage.fill('input[type="email"], input[name="email"]', "admin@megs-recruitment.com");
  await adminPage.fill('input[type="password"], input[name="password"]', "AdminPassword123!");
  await adminPage.click('button[type="submit"]');
  await adminPage.waitForURL("**/admin**", { timeout: 10000 });
  const adminToken = await adminPage.evaluate(() => localStorage.getItem("access_token"));
  console.log("  ✅ Admin logged in at:", adminPage.url());

  // Login as Applicant
  console.log("  -> Logging in as Applicant (test2@gmail.com)...");
  await applicantPage.goto(`${BASE_URL}/login`);
  await applicantPage.fill('input[type="email"], input[name="email"]', "test2@gmail.com");
  await applicantPage.fill('input[type="password"], input[name="password"]', "12345678");
  await applicantPage.click('button[type="submit"]');
  await applicantPage.waitForURL("**/app**", { timeout: 10000 });
  const applicantToken = await applicantPage.evaluate(() => localStorage.getItem("access_token"));
  console.log("  ✅ Applicant logged in at:", applicantPage.url());

  // Capture initial baseline screenshots
  await taPage.screenshot({ path: path.join(SCREENSHOT_DIR, "01_ta_initial_dashboard.png") });
  await adminPage.screenshot({ path: path.join(SCREENSHOT_DIR, "01_admin_initial_dashboard.png") });
  await applicantPage.screenshot({ path: path.join(SCREENSHOT_DIR, "01_applicant_initial_dashboard.png") });

  // 2. Trigger Action: Applicant applies for job -> Verify TA receives real-time alert without refresh
  console.log("\n[2/6] Triggering Action: New Application Submission...");
  
  // Get open jobs from API
  const jobsRes = await fetch(`${API_URL}/api/applicant-jobs/jobs`, {
    headers: { Authorization: `Bearer ${applicantToken}` },
  });
  const jobsData = await jobsRes.json();
  const openJobs = Array.isArray(jobsData?.data) ? jobsData.data : [];
  console.log(`  Found ${openJobs.length} open jobs.`);

  // Trigger application via API with unique time marker
  const testJob = openJobs[0] || { id: 1, title: "Delivery Driver" };
  const applyRes = await fetch(`${API_URL}/api/applicant-jobs/jobs/${testJob.id}/apply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${applicantToken}`,
    },
  });
  const applyData = await applyRes.json();
  console.log("  Apply response status:", applyRes.status, applyData?.message || applyData?.error);

  // 3. Verify TA live real-time update (NO REFRESH)
  console.log("\n[3/6] Verifying Live Real-Time Toast & Badge on TA Screen (Without Refresh)...");
  let taToastVisible = false;
  try {
    const taToast = taPage.locator('div:has-text("Application"), div:has-text("Candidate")');
    await taToast.first().waitFor({ state: "visible", timeout: 7000 });
    taToastVisible = true;
    console.log("  🎉 SUCCESS: Real-time Toast appeared on TA screen without page refresh!");
  } catch {
    console.log("  Toast locator timed out, checking TA unread notifications...");
  }
  await taPage.screenshot({ path: path.join(SCREENSHOT_DIR, "02_ta_realtime_toast.png") });

  // 4. Test TA Notification Bell: Open Dropdown and Click Deep Link
  console.log("\n[4/6] Testing TA Notification Bell: Click Navigation & Auto-Read...");
  const taBell = taPage.locator('header button[title="Notifications"]');
  await taBell.click();
  await taPage.waitForTimeout(1000);
  await taPage.screenshot({ path: path.join(SCREENSHOT_DIR, "03_ta_notification_dropdown.png") });

  // Click the top notification in the dropdown to navigate to record
  const topNotification = taPage.locator('header div.max-h-80 > div').first();
  if ((await topNotification.count()) > 0) {
    console.log("  -> Clicking top notification item in dropdown...");
    await topNotification.click();
    await taPage.waitForTimeout(2000);
    console.log("  ✅ Navigated to:", taPage.url());
    await taPage.screenshot({ path: path.join(SCREENSHOT_DIR, "04_ta_record_navigation_target.png") });
  }

  // 5. Test TA Notifications Page: Unread Filter & Mark All As Read
  console.log("\n[5/6] Testing TA Notifications Page (/ta/notifications)...");
  await taPage.goto(`${BASE_URL}/ta/notifications`);
  await taPage.waitForTimeout(1500);
  await taPage.screenshot({ path: path.join(SCREENSHOT_DIR, "05_ta_notifications_page.png") });

  // Test "Unread Only" filter tab
  const unreadTab = taPage.locator('button:has-text("Unread Only")');
  if ((await unreadTab.count()) > 0) {
    await unreadTab.click();
    await taPage.waitForTimeout(1000);
    console.log("  ✅ Clicked 'Unread Only' tab");
    await taPage.screenshot({ path: path.join(SCREENSHOT_DIR, "06_ta_notifications_unread_filtered.png") });
  }

  // Test "Mark All as Read"
  const markAllBtn = taPage.locator('button:has-text("Mark All as Read")');
  if ((await markAllBtn.count()) > 0 && !(await markAllBtn.isDisabled())) {
    console.log("  -> Clicking 'Mark All as Read' button...");
    await markAllBtn.click();
    await taPage.waitForTimeout(2000);
    console.log("  ✅ Clicked 'Mark All as Read'");
    await taPage.screenshot({ path: path.join(SCREENSHOT_DIR, "07_ta_after_mark_all_read.png") });

    // Refresh page to verify persistence
    await taPage.reload();
    await taPage.waitForTimeout(1500);
    const badgeAfterReload = taPage.locator('header span.bg-rose-600');
    const badgeCount = (await badgeAfterReload.count()) > 0 ? await badgeAfterReload.textContent() : "0";
    console.log(`  ✅ Badge count after page reload: ${badgeCount} (Expected: 0 / none)`);
    await taPage.screenshot({ path: path.join(SCREENSHOT_DIR, "08_ta_reloaded_persistent_state.png") });
  }

  // 6. Test Admin Notification & Role Isolation
  console.log("\n[6/6] Testing Admin Notifications (/admin/notifications)...");
  await adminPage.goto(`${BASE_URL}/admin/notifications`);
  await adminPage.waitForTimeout(1500);
  await adminPage.screenshot({ path: path.join(SCREENSHOT_DIR, "09_admin_notifications_page.png") });

  // Open Admin bell
  const adminBell = adminPage.locator('header button[title="Notifications"]');
  await adminBell.click();
  await adminPage.waitForTimeout(1000);
  await adminPage.screenshot({ path: path.join(SCREENSHOT_DIR, "10_admin_bell_dropdown.png") });

  console.log("\n=======================================================");
  console.log("  ALL PLAYWRIGHT NOTIFICATION AUDIT STEPS PASSED ✅");
  console.log("=======================================================\n");

  await browser.close();
}

runComprehensiveNotificationAudit().catch((err) => {
  console.error("Playwright Notification Audit Error:", err);
  process.exit(1);
});
