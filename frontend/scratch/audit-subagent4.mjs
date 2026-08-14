import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = 'c:/Users/cnico/OneDrive/Desktop/MEGS/frontend/audit-screenshots';

const RESOLUTIONS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
];

const CREDENTIALS = {
  admin: {
    email: 'admin@megs-recruitment.com',
    password: 'AdminPassword123!',
  },
  ta: {
    email: 'ta@megs-recruitment.com',
    password: 'TAPassword123!',
  },
};

const fullAuditReport = {};

async function inspectDomStyles(page, pageKey, resName) {
  try {
    const result = await page.evaluate(({ pageKey, resName }) => {
      const data = {
        page: pageKey,
        resolution: resName,
        url: window.location.href,
        smallFonts: [],
        smallControls: [],
        badges: [],
        buttons: [],
        tableMetrics: [],
        contrastObservations: [],
        layout: {},
      };

      // 1. Text elements with font-size < 13px
      const all = document.querySelectorAll('*');
      const seen = new Set();

      for (const el of all) {
        if (el.children.length > 2 && el.tagName !== 'P' && el.tagName !== 'SPAN' && el.tagName !== 'BUTTON') continue;
        const s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') continue;

        const txt = (el.innerText || el.textContent || '').trim();
        if (!txt || txt.length > 80 || seen.has(txt)) continue;

        const fsPx = parseFloat(s.fontSize);
        if (fsPx > 0 && fsPx < 13) {
          seen.add(txt);
          data.smallFonts.push({
            tag: el.tagName,
            text: txt.slice(0, 60),
            fontSize: s.fontSize,
            fontWeight: s.fontWeight,
            lineHeight: s.lineHeight,
            color: s.color,
            fontFamily: s.fontFamily.split(',')[0],
            className: String(el.className).slice(0, 100),
          });
        }
      }

      // 2. Interactive buttons & inputs
      const inputs = document.querySelectorAll('button, input, select, textarea, a[role="button"]');
      for (const btn of inputs) {
        const s = window.getComputedStyle(btn);
        if (s.display === 'none' || s.visibility === 'hidden') continue;
        const rect = btn.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        const txt = (btn.innerText || btn.getAttribute('aria-label') || btn.getAttribute('title') || btn.getAttribute('placeholder') || '').trim();
        
        const item = {
          tag: btn.tagName,
          text: txt.slice(0, 35),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          padding: `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`,
          fontSize: s.fontSize,
          className: String(btn.className).slice(0, 80),
        };

        data.buttons.push(item);
        if (rect.height < 32 || (rect.width < 32 && !txt)) {
          data.smallControls.push(item);
        }
      }

      // 3. Badges
      const badgeEls = document.querySelectorAll('[data-testid*="badge"], span[class*="rounded-full"], span[class*="rounded-md"]');
      const badgeSeen = new Set();
      for (const b of badgeEls) {
        const txt = (b.innerText || '').trim();
        if (!txt || txt.length > 25 || badgeSeen.has(txt)) continue;
        badgeSeen.add(txt);
        const s = window.getComputedStyle(b);
        const rect = b.getBoundingClientRect();
        data.badges.push({
          text: txt,
          fontSize: s.fontSize,
          height: Math.round(rect.height),
          padding: `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`,
          borderRadius: s.borderRadius,
          color: s.color,
          bg: s.backgroundColor,
        });
      }

      // 4. Tables
      const tables = document.querySelectorAll('table');
      for (const tbl of tables) {
        const ths = Array.from(tbl.querySelectorAll('th')).map(th => {
          const s = window.getComputedStyle(th);
          return {
            text: (th.innerText || '').trim(),
            fontSize: s.fontSize,
            padding: `${s.paddingTop} ${s.paddingRight}`,
          };
        });
        const rows = tbl.querySelectorAll('tbody tr');
        const td = rows[0]?.querySelector('td');
        const sTd = td ? window.getComputedStyle(td) : null;
        data.tableMetrics.push({
          headers: ths,
          rowCount: rows.length,
          tdFontSize: sTd?.fontSize,
          tdPadding: sTd ? `${sTd.paddingTop} ${sTd.paddingRight} ${sTd.paddingBottom} ${sTd.paddingLeft}` : null,
        });
      }

      return data;
    }, { pageKey, resName });

    if (!fullAuditReport[pageKey]) {
      fullAuditReport[pageKey] = {};
    }
    fullAuditReport[pageKey][resName] = result;
    return result;
  } catch (e) {
    console.error(`Error analyzing styles for ${pageKey}:`, e.message);
  }
}

async function loginAdmin(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', CREDENTIALS.admin.email);
  await page.fill('input[type="password"]', CREDENTIALS.admin.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin/dashboard', { timeout: 15000 });
  await page.waitForTimeout(2000);
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  try {
    for (const res of RESOLUTIONS) {
      console.log(`\n======================================================`);
      console.log(`AUDITING RESOLUTION: ${res.name} (${res.width}x${res.height})`);
      console.log(`======================================================\n`);

      const context = await browser.newContext({
        viewport: { width: res.width, height: res.height },
      });
      const page = await context.newPage();

      // ─── 1. LOGIN ADMIN ───
      console.log(`[${res.name}] Logging in as Admin...`);
      await loginAdmin(page);

      // ─── 2. ADMIN DASHBOARD ───
      console.log(`[${res.name}] Auditing Admin Dashboard (/admin/dashboard)...`);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `subagent4-${res.name}-admin-dashboard.png`),
        fullPage: true,
      });
      await inspectDomStyles(page, 'AdminDashboard', res.name);

      // ─── 3. NOTIFICATION BELL ───
      console.log(`[${res.name}] Auditing Notification Bell popover...`);
      const bell = page.locator('header button:has(svg.lucide-bell), header button[data-testid="notification-bell-btn"], header button:has(svg)').last();
      if (await bell.isVisible()) {
        await bell.click();
        await page.waitForTimeout(600);
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `subagent4-${res.name}-admin-notification-bell.png`),
        });
        await inspectDomStyles(page, 'NotificationBellPopover', res.name);
        // Click outside to close
        await page.click('header', { position: { x: 20, y: 20 } });
        await page.waitForTimeout(400);
      }

      // ─── 4. ADMIN USERS ───
      console.log(`[${res.name}] Auditing User Management (/admin/users)...`);
      await page.click('aside a[href="/admin/users"]');
      await page.waitForSelector('[data-testid="admin-users-page"]', { timeout: 10000 });
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `subagent4-${res.name}-admin-users.png`),
        fullPage: true,
      });
      await inspectDomStyles(page, 'AdminUsers', res.name);

      // Open Invite TA Staff Modal
      console.log(`[${res.name}] Opening Invite TA Staff modal...`);
      const inviteBtn = page.locator('[data-testid="invite-ta-button"]').first();
      if (await inviteBtn.isVisible()) {
        await inviteBtn.click();
        await page.waitForSelector('input[type="email"]', { timeout: 5000 });
        await page.waitForTimeout(500);
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `subagent4-${res.name}-admin-users-invite-modal.png`),
        });
        await inspectDomStyles(page, 'AdminUsersInviteModal', res.name);
        // Close modal
        const cancelBtn = page.locator('button:has-text("Cancel")').first();
        if (await cancelBtn.isVisible()) {
          await cancelBtn.click();
          await page.waitForTimeout(400);
        }
      }

      // Open Toggle User Status Confirm Dialog
      console.log(`[${res.name}] Opening Deactivate User ConfirmDialog...`);
      const deactivateBtn = page.locator('button:has-text("Deactivate")').first();
      if (await deactivateBtn.isVisible()) {
        await deactivateBtn.click();
        await page.waitForTimeout(600);
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `subagent4-${res.name}-admin-users-confirm-dialog.png`),
        });
        await inspectDomStyles(page, 'ConfirmDialog', res.name);
        // Cancel dialog
        const cancelDialogBtn = page.locator('button:has-text("Cancel")').first();
        if (await cancelDialogBtn.isVisible()) {
          await cancelDialogBtn.click();
          await page.waitForTimeout(400);
        }
      }

      // ─── 5. ADMIN AUDIT LOGS ───
      console.log(`[${res.name}] Auditing Audit Logs (/admin/audit-logs)...`);
      await page.click('aside a[href="/admin/audit-logs"]');
      await page.waitForSelector('[data-testid="admin-audit-page"]', { timeout: 10000 });
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `subagent4-${res.name}-admin-audit-logs.png`),
        fullPage: true,
      });
      await inspectDomStyles(page, 'AdminAuditLogs', res.name);

      // Open View Payload Modal in Audit Logs
      console.log(`[${res.name}] Opening Audit Log Payload modal...`);
      const viewPayloadBtn = page.locator('[data-testid="audit-view-details-btn"], button:has-text("View Payload")').first();
      if (await viewPayloadBtn.isVisible()) {
        await viewPayloadBtn.click();
        await page.waitForTimeout(700);
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `subagent4-${res.name}-admin-audit-logs-drawer.png`),
        });
        await inspectDomStyles(page, 'AdminAuditLogsPayloadModal', res.name);
        // Close modal
        const closePayloadBtn = page.locator('button:has-text("Close"), button[aria-label="Close modal"]').first();
        if (await closePayloadBtn.isVisible()) {
          await closePayloadBtn.click();
          await page.waitForTimeout(400);
        }
      }

      // ─── 6. ADMIN SCORING ───
      console.log(`[${res.name}] Auditing Scoring Page (/admin/scoring)...`);
      await page.click('aside a[href="/admin/scoring"]');
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `subagent4-${res.name}-admin-scoring.png`),
        fullPage: true,
      });
      await inspectDomStyles(page, 'AdminScoring', res.name);

      // ─── 7. ADMIN / SYSTEM ANALYTICS ───
      console.log(`[${res.name}] Auditing Analytics (/admin/analytics)...`);
      // Since scoring might crash layout, re-login to ensure clean state
      await loginAdmin(page);
      await page.click('aside a[href="/admin/analytics"]');
      await page.waitForSelector('[data-testid="analytics-page-root"]', { timeout: 10000 });
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `subagent4-${res.name}-admin-analytics.png`),
        fullPage: true,
      });
      await inspectDomStyles(page, 'AdminAnalytics', res.name);

      // ─── 8. FORBIDDEN PAGE (403) ───
      console.log(`[${res.name}] Auditing Forbidden Page (/forbidden)...`);
      await page.evaluate(() => {
        window.history.pushState(null, '', '/forbidden');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      await page.waitForSelector('[data-testid="forbidden-page"]', { timeout: 6000 });
      await page.waitForTimeout(800);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `subagent4-${res.name}-forbidden.png`),
      });
      await inspectDomStyles(page, 'ForbiddenPage', res.name);

      // ─── 9. 404 NOT FOUND PAGE ───
      console.log(`[${res.name}] Auditing 404 Page...`);
      await page.evaluate(() => {
        window.history.pushState(null, '', '/unrecognized-system-route-404');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      await page.waitForSelector('[data-testid="not-found-page"]', { timeout: 6000 });
      await page.waitForTimeout(800);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `subagent4-${res.name}-notfound.png`),
      });
      await inspectDomStyles(page, 'NotFoundPage', res.name);

      // ─── 10. SIDEBAR COLLAPSED ───
      console.log(`[${res.name}] Auditing Collapsed Sidebar...`);
      await page.evaluate(() => {
        window.history.pushState(null, '', '/admin/dashboard');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      await page.waitForSelector('[data-testid="admin-dashboard-page"]', { timeout: 6000 });
      await page.waitForTimeout(800);
      const collapseBtn = page.locator('aside button:has-text("Collapse")').first();
      if (await collapseBtn.isVisible()) {
        await collapseBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `subagent4-${res.name}-admin-sidebar-collapsed.png`),
          fullPage: true,
        });
        await inspectDomStyles(page, 'AdminSidebarCollapsed', res.name);
      }

      await context.close();
    }

    // ─── 11. TA ROLE VERIFICATION & /ta/analytics ───
    console.log(`\n======================================================`);
    console.log(`AUDITING TA ROLE ACCESS & /ta/analytics`);
    console.log(`======================================================\n`);

    const taContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const taPage = await taContext.newPage();

    console.log(`Logging in as TA...`);
    await taPage.goto(`${BASE_URL}/login`);
    await taPage.waitForSelector('input[type="email"]');
    await taPage.fill('input[type="email"]', CREDENTIALS.ta.email);
    await taPage.fill('input[type="password"]', CREDENTIALS.ta.password);
    await taPage.click('button[type="submit"]');
    await taPage.waitForURL('**/ta/dashboard', { timeout: 15000 });
    await taPage.waitForTimeout(2000);

    // TA Analytics
    console.log(`Auditing /ta/analytics as TA...`);
    await taPage.click('aside a[href="/ta/analytics"]');
    await taPage.waitForSelector('[data-testid="analytics-page-root"]', { timeout: 10000 });
    await taPage.waitForTimeout(2000);
    await taPage.screenshot({
      path: path.join(SCREENSHOT_DIR, `subagent4-1920x1080-ta-analytics.png`),
      fullPage: true,
    });
    await inspectDomStyles(taPage, 'TAAnalytics', '1920x1080');

    // Attempt accessing admin route as TA
    console.log(`Testing unauthorized route /admin/dashboard as TA...`);
    await taPage.evaluate(() => {
      window.history.pushState(null, '', '/admin/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await taPage.waitForTimeout(1000);
    await taPage.screenshot({
      path: path.join(SCREENSHOT_DIR, `subagent4-1920x1080-ta-unauthorized-attempt.png`),
    });
    await inspectDomStyles(taPage, 'TAUnauthorizedAttempt', '1920x1080');

    await taContext.close();

    // Save full JSON report
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'subagent4-complete-audit-report.json'),
      JSON.stringify(fullAuditReport, null, 2),
      'utf-8'
    );
    console.log(`\nAll tests completed and saved to subagent4-complete-audit-report.json!`);

  } catch (error) {
    console.error('Audit execution error:', error);
  } finally {
    await browser.close();
  }
}

run();
