import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:5173";
const SCREENSHOT_DIR = path.resolve("./screenshots/auth");

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function auditAuthAndSecurity() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const logs = [];
  const errors = [];
  const networkFailures = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push({ type: "console_error", text: msg.text(), location: msg.location() });
    } else {
      logs.push({ type: msg.type(), text: msg.text() });
    }
  });

  page.on("requestfailed", (req) => {
    networkFailures.push({ url: req.url(), failure: req.failure()?.errorText });
  });

  console.log("\n=== 1. AUDITING AUTH & SECURITY ROUTING ===");

  // 1.1 Unauthenticated redirects
  console.log("Testing unauthenticated redirect on /admin...");
  await page.goto(`${BASE_URL}/admin`);
  await page.waitForLoadState("networkidle");
  const adminRedirectUrl = page.url();
  console.log(`  Redirected to: ${adminRedirectUrl}`);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_unauth_admin_redirect.png") });

  console.log("Testing unauthenticated redirect on /ta...");
  await page.goto(`${BASE_URL}/ta`);
  await page.waitForLoadState("networkidle");
  const taRedirectUrl = page.url();
  console.log(`  Redirected to: ${taRedirectUrl}`);

  console.log("Testing unauthenticated redirect on /app...");
  await page.goto(`${BASE_URL}/app`);
  await page.waitForLoadState("networkidle");
  const appRedirectUrl = page.url();
  console.log(`  Redirected to: ${appRedirectUrl}`);

  // 1.2 Auth pages rendering
  console.log("Testing /login page render...");
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02_login_page.png") });

  console.log("Testing /register page render...");
  await page.goto(`${BASE_URL}/register`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03_register_page.png") });

  console.log("Testing /forgot-password page render...");
  await page.goto(`${BASE_URL}/forgot-password`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04_forgot_password_page.png") });

  console.log("Testing /reset-password page render...");
  await page.goto(`${BASE_URL}/reset-password`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05_reset_password_page.png") });

  console.log("Testing /setup-account page render...");
  await page.goto(`${BASE_URL}/setup-account`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06_setup_account_page.png") });

  console.log("Testing 404 page render (/some-non-existent-path)...");
  await page.goto(`${BASE_URL}/some-non-existent-path`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07_not_found_page.png") });

  // 1.3 Testing Invalid Login Error Presentation
  console.log("Testing login error display on invalid credentials...");
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"], input[name="email"]', "admin@megs-recruitment.com");
  await page.fill('input[type="password"], input[name="password"]', "WrongPassword123!");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "08_invalid_login_feedback.png") });

  const pageContent = await page.content();
  const hasInvalidCredentialsText = pageContent.includes("Invalid email or password");
  console.log(`  Displays 'Invalid email or password': ${hasInvalidCredentialsText}`);

  await browser.close();

  const report = {
    unauthRedirects: {
      admin: adminRedirectUrl,
      ta: taRedirectUrl,
      app: appRedirectUrl,
    },
    hasInvalidCredentialsText,
    consoleErrors: errors,
    networkFailures,
  };

  fs.writeFileSync("./reports/auth-security-report.json", JSON.stringify(report, null, 2));
  console.log("✅ Auth & Security Audit Complete!\n");
}

auditAuthAndSecurity().catch(console.error);
