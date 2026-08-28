import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:5173";
const SCREENSHOT_ROOT = path.resolve("./screenshots/responsive");

const VIEWPORTS = [
  { name: "mobile-320", width: 320, height: 568, category: "Mobile (Small)" },
  { name: "mobile-375", width: 375, height: 667, category: "Mobile (Standard)" },
  { name: "mobile-390", width: 390, height: 844, category: "Mobile (Modern)" },
  { name: "mobile-430", width: 430, height: 932, category: "Mobile (Large)" },
  { name: "tablet-768", width: 768, height: 1024, category: "Tablet (Portrait)" },
  { name: "tablet-1024", width: 1024, height: 768, category: "Tablet (Landscape)" },
  { name: "laptop-1366", width: 1366, height: 768, category: "Laptop" },
  { name: "desktop-1440", width: 1440, height: 900, category: "Desktop" },
  { name: "desktop-1920", width: 1920, height: 1080, category: "Large Desktop" },
];

fs.mkdirSync(SCREENSHOT_ROOT, { recursive: true });

async function checkOverflow(page) {
  return await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const isDocOverflowing = scrollWidth > docWidth + 1;

    const overflowingElements = [];
    const all = document.querySelectorAll("*");
    for (const el of all) {
      const rect = el.getBoundingClientRect();
      if (rect.right > docWidth + 2 && rect.width > 0 && rect.height > 0) {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : "";
        const cls = el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}` : "";
        const text = (el.innerText || "").slice(0, 30).replace(/\n/g, " ");
        overflowingElements.push({
          selector: `${tag}${id}${cls}`,
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          docWidth,
          text,
        });
      }
    }

    return {
      docWidth,
      scrollWidth,
      isDocOverflowing,
      overflowingElements: overflowingElements.slice(0, 10),
    };
  });
}

async function auditRole(browser, roleName, credentials, pages) {
  console.log(`\n========================================`);
  console.log(`AUDITING ROLE: ${roleName}`);
  console.log(`========================================`);

  const results = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    if (credentials) {
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[type="email"], input[name="email"]', credentials.email);
      await page.fill('input[type="password"], input[name="password"]', credentials.password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1200);
    }

    for (const p of pages) {
      const url = `${BASE_URL}${p.path}`;
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
        await page.waitForTimeout(800);

        const overflow = await checkOverflow(page);

        if (["mobile-375", "tablet-768", "desktop-1440"].includes(vp.name)) {
          const sanitizedPath = p.path.replace(/\//g, "_").replace(/^_/, "") || "home";
          const shotDir = path.join(SCREENSHOT_ROOT, vp.name);
          fs.mkdirSync(shotDir, { recursive: true });
          const shotPath = path.join(shotDir, `${roleName.toLowerCase()}_${sanitizedPath}.png`);
          await page.screenshot({ path: shotPath, fullPage: false });
        }

        results.push({
          role: roleName,
          path: p.path,
          pageName: p.name,
          viewport: vp.name,
          width: vp.width,
          height: vp.height,
          isDocOverflowing: overflow.isDocOverflowing,
          scrollWidth: overflow.scrollWidth,
          docWidth: overflow.docWidth,
          overflowCount: overflow.overflowingElements.length,
          topOverflowElements: overflow.overflowingElements,
        });

        if (overflow.isDocOverflowing) {
          console.log(`❌ [OVERFLOW] [${vp.name} - ${vp.width}px] ${p.name} (${p.path}): scrollWidth=${overflow.scrollWidth}px (exceeds ${overflow.docWidth}px by ${overflow.scrollWidth - overflow.docWidth}px)`);
        }
      } catch (err) {
        console.error(`⚠️ Error testing ${p.path} on ${vp.name}:`, err.message);
        results.push({
          role: roleName,
          path: p.path,
          pageName: p.name,
          viewport: vp.name,
          error: err.message,
        });
      }
    }

    await context.close();
  }

  return results;
}

async function runFullAudit() {
  const browser = await chromium.launch({ headless: true });

  const publicPages = [
    { name: "Landing Page", path: "/" },
    { name: "Login Page", path: "/login" },
    { name: "Register Page", path: "/register" },
    { name: "Forgot Password", path: "/forgot-password" },
    { name: "Reset Password", path: "/reset-password" },
    { name: "Forbidden 403", path: "/forbidden" },
    { name: "Dev Gallery", path: "/dev" },
  ];

  const applicantPages = [
    { name: "Applicant Dashboard", path: "/app" },
    { name: "Job Board", path: "/app/jobs" },
    { name: "Job Detail", path: "/app/jobs/1" },
    { name: "My Applications", path: "/app/applications" },
    { name: "Application Detail", path: "/app/applications/1" },
    { name: "Candidate Profile", path: "/app/profile" },
    { name: "Applicant Notifications", path: "/app/notifications" },
  ];

  const taPages = [
    { name: "TA Dashboard", path: "/ta" },
    { name: "Applications Pipeline", path: "/ta/applications" },
    { name: "Application Detail", path: "/ta/applications/1" },
    { name: "Job Postings", path: "/ta/jobs" },
    { name: "Job Posting Detail", path: "/ta/jobs/1" },
    { name: "MRF List", path: "/ta/mrfs" },
    { name: "MRF Create", path: "/ta/mrfs/create" },
    { name: "MRF Detail", path: "/ta/mrfs/1" },
    { name: "Talent Pool", path: "/ta/talent-pool" },
    { name: "Interviews", path: "/ta/interviews" },
    { name: "Clients", path: "/ta/clients" },
    { name: "Client Detail", path: "/ta/clients/1" },
    { name: "Compliance SLA", path: "/ta/compliance" },
    { name: "Deployments", path: "/ta/deployments" },
    { name: "Deployment Detail", path: "/ta/deployments/1" },
    { name: "Employees", path: "/ta/employees" },
    { name: "Employee Detail", path: "/ta/employees/1" },
    { name: "Analytics", path: "/ta/analytics" },
    { name: "TA Notifications", path: "/ta/notifications" },
  ];

  const adminPages = [
    { name: "Admin Dashboard", path: "/admin" },
    { name: "User Management", path: "/admin/users" },
    { name: "Scoring Weights", path: "/admin/scoring" },
    { name: "Scoring Quality", path: "/admin/scoring/quality" },
    { name: "Revalidation Queue", path: "/admin/revalidation" },
    { name: "Audit Logs", path: "/admin/audit" },
    { name: "Admin Notifications", path: "/admin/notifications" },
  ];

  const allResults = [];

  const publicRes = await auditRole(browser, "PUBLIC", null, publicPages);
  allResults.push(...publicRes);

  const applicantRes = await auditRole(browser, "APPLICANT", { email: "test2@gmail.com", password: "12345678" }, applicantPages);
  allResults.push(...applicantRes);

  const taRes = await auditRole(browser, "TA", { email: "ta@megs-recruitment.com", password: "TAPassword123!" }, taPages);
  allResults.push(...taRes);

  const adminRes = await auditRole(browser, "ADMIN", { email: "admin@megs-recruitment.com", password: "AdminPassword123!" }, adminPages);
  allResults.push(...adminRes);

  await browser.close();

  fs.mkdirSync("./reports", { recursive: true });
  fs.writeFileSync("./reports/responsive-audit-results.json", JSON.stringify(allResults, null, 2));

  const totalTests = allResults.length;
  const overflows = allResults.filter(r => r.isDocOverflowing);
  console.log(`\n========================================`);
  console.log(`AUDIT SUMMARY:`);
  console.log(`Total Page x Viewport Tests: ${totalTests}`);
  console.log(`Total Viewport Overflow Failures: ${overflows.length}`);
  console.log(`========================================\n`);
}

runFullAudit().catch(console.error);
