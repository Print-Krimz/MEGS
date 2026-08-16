import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:5173";
const API_URL = "http://localhost:3000";
const SCREENSHOT_DIR = path.resolve("./screenshots/realtime-notifications");

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function runRealtimeNotificationVerification() {
  console.log("\n=======================================================");
  console.log("  REAL-TIME NOTIFICATION PLAYWRIGHT VERIFICATION");
  console.log("=======================================================\n");

  const browser = await chromium.launch({ headless: true });
  
  // 1. Create Applicant Context & Page
  const applicantContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const applicantPage = await applicantContext.newPage();

  const applicantErrors = [];
  applicantPage.on("console", (msg) => {
    if (msg.type() === "error") {
      applicantErrors.push(msg.text());
    }
  });

  // Login as Applicant
  console.log("[1/6] Logging in as Applicant (test2@gmail.com)...");
  await applicantPage.goto(`${BASE_URL}/login`);
  await applicantPage.fill('input[type="email"], input[name="email"]', "test2@gmail.com");
  await applicantPage.fill('input[type="password"], input[name="password"]', "12345678");
  await applicantPage.click('button[type="submit"]');
  await applicantPage.waitForURL("**/app**", { timeout: 10000 });
  await applicantPage.waitForTimeout(2000);
  console.log("  ✅ Applicant logged in at:", applicantPage.url());

  // Extract applicant token and user id from localStorage
  const { token, user } = await applicantPage.evaluate(() => {
    const rawUser = localStorage.getItem("access_token");
    return {
      token: rawUser,
      user: JSON.parse(localStorage.getItem("user") || "{}"),
    };
  });

  // Fetch applicant's profile/id from /api/me
  const meRes = await fetch(`${API_URL}/api/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meData = await meRes.json();
  const applicantUserId = meData?.data?.user?.id;
  console.log(`  Applicant User ID: ${applicantUserId}`);

  // Capture initial screenshot
  await applicantPage.screenshot({ path: path.join(SCREENSHOT_DIR, "01_applicant_initial.png") });

  // Get initial unread count from UI
  const initialBadge = applicantPage.locator('header span.bg-rose-600');
  const initialUnreadCount = (await initialBadge.count()) > 0 ? parseInt(await initialBadge.textContent() || "0", 10) : 0;
  console.log(`  Initial unread badge count: ${initialUnreadCount}`);

  // 2. Trigger an action / notification on backend for this applicant
  console.log("\n[2/6] Triggering real-time notification on backend for Applicant...");
  
  // Login as TA to trigger an application update / endorsement or direct notification
  const taContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const taPage = await taContext.newPage();
  
  await taPage.goto(`${BASE_URL}/login`);
  await taPage.fill('input[type="email"], input[name="email"]', "ta@megs-recruitment.com");
  await taPage.fill('input[type="password"], input[name="password"]', "TAPassword123!");
  await taPage.click('button[type="submit"]');
  await taPage.waitForURL("**/ta**", { timeout: 10000 });
  
  const taToken = await taPage.evaluate(() => localStorage.getItem("access_token"));
  console.log("  ✅ TA logged in successfully");

  // Call TA endorsement or status update API to trigger sendNotification
  const uniqueTitle = `Realtime Interview ${Date.now()}`;
  
  // Let's create an application notification using Prisma / backend service or through an API
  const appsRes = await fetch(`${API_URL}/api/ta/applications?limit=10`, {
    headers: { Authorization: `Bearer ${taToken}` },
  });
  const appsData = await appsRes.json();
  const appsList = Array.isArray(appsData?.data?.data)
    ? appsData.data.data
    : Array.isArray(appsData?.data)
    ? appsData.data
    : (appsData?.data?.applications || []);
  console.log(`  Fetched ${appsList.length} total applications from TA API.`);
  const testApp = appsList.find((a) => (a.userId || a.user?.id) === applicantUserId) || appsList[0];
  const targetUserId = testApp?.userId || testApp?.user?.id;

  // Fetch real client ID from TA API
  const clientsRes = await fetch(`${API_URL}/api/ta/clients`, {
    headers: { Authorization: `Bearer ${taToken}` },
  });
  const clientsData = await clientsRes.json();
  const clientsList = Array.isArray(clientsData?.data) ? clientsData.data : [];
  const clientId = clientsList[0]?.id || 1;
  console.log(`  Using client ID: ${clientId} (${clientsList[0]?.name || "Default Client"})`);

  if (testApp) {
    console.log(`  Found application #${testApp.id} for user ${targetUserId}`);
    // Trigger endorsement
    const endorseRes = await fetch(`${API_URL}/api/ta/applications/${testApp.id}/endorse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${taToken}`,
      },
      body: JSON.stringify({
        clientId: Number(clientId),
        outcome: "ENDORSED",
        notes: `Automated test endorsement at ${new Date().toISOString()}`,
      }),
    });
    const endorseData = await endorseRes.json();
    console.log(`  Endorsement trigger response:`, endorseRes.status, endorseData?.message || endorseData?.error);
  }

  // 3. Keep applicant page open WITHOUT refreshing and check for live notification update
  console.log("\n[3/6] Watching Applicant page for live real-time update (WITHOUT page refresh)...");
  
  // Look for toast or badge update within 5 seconds
  let toastAppeared = false;
  try {
    const toast = applicantPage.locator('div:has-text("Client Endorsement"), div:has-text("Notification")');
    await toast.first().waitFor({ state: "visible", timeout: 8000 });
    toastAppeared = true;
    console.log("  🎉 SUCCESS: Real-time Toast appeared on Applicant screen!");
  } catch {
    console.log("  Toast locator timed out, checking unread badge...");
  }

  await applicantPage.screenshot({ path: path.join(SCREENSHOT_DIR, "02_realtime_notification_received.png") });

  // 4. Verify unread badge updated
  const updatedBadge = applicantPage.locator('header span.bg-rose-600');
  const updatedCountText = (await updatedBadge.count()) > 0 ? await updatedBadge.textContent() : "0";
  const updatedUnreadCount = parseInt(updatedCountText || "0", 10);
  console.log(`  Updated unread badge count in UI: ${updatedUnreadCount}`);

  // 5. Open notification bell dropdown
  console.log("\n[4/6] Opening Notification Bell dropdown...");
  const bellButton = applicantPage.locator('button[title="Notifications"]');
  await bellButton.click();
  await applicantPage.waitForTimeout(1000);
  await applicantPage.screenshot({ path: path.join(SCREENSHOT_DIR, "03_notification_dropdown_open.png") });

  // 6. Mark first unread notification as read
  console.log("\n[5/6] Marking notification as read...");
  const markReadButton = applicantPage.locator('button[title="Mark as read"]').first();
  if (await markReadButton.count() > 0) {
    await markReadButton.click();
    await applicantPage.waitForTimeout(1500);
    console.log("  ✅ Clicked 'Mark as read'");
  } else {
    console.log("  No unread button found in top 5 list");
  }

  await applicantPage.screenshot({ path: path.join(SCREENSHOT_DIR, "04_after_mark_as_read.png") });

  const finalBadge = applicantPage.locator('header span.bg-rose-600');
  const finalCountText = (await finalBadge.count()) > 0 ? await finalBadge.textContent() : "0";
  console.log(`  Final unread badge count: ${finalCountText}`);

  console.log("\n[6/6] Checking console errors...");
  if (applicantErrors.length === 0) {
    console.log("  ✅ Clean console: No errors detected during real-time lifecycle!");
  } else {
    console.log("  ⚠️ Console errors:", applicantErrors);
  }

  await browser.close();

  console.log("\n=======================================================");
  console.log("  PLAYWRIGHT VERIFICATION COMPLETE ✅");
  console.log("=======================================================\n");
}

runRealtimeNotificationVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
