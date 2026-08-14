import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'c:/Users/cnico/OneDrive/Desktop/MEGS/frontend/audit-screenshots';
const BASE_URL = 'http://localhost:5173';
const CREDENTIALS = {
  email: 'ta@megs-recruitment.com',
  password: 'TAPassword123!',
};

const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
];

async function inspectElement(elementHandle) {
  if (!elementHandle) return null;
  return await elementHandle.evaluate((el) => {
    const cs = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      tagName: el.tagName,
      className: el.className,
      text: el.innerText ? el.innerText.slice(0, 70).replace(/\n/g, ' ') : '',
      box: {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
      },
      styles: {
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        padding: cs.padding,
        borderRadius: cs.borderRadius,
        border: cs.border,
        height: cs.height,
        minHeight: cs.minHeight,
        gap: cs.gap,
      }
    };
  });
}

async function inspectSelectorAll(page, selector, limit = 20) {
  return await page.$$eval(selector, (elements, limit) => {
    return elements.slice(0, limit).map(el => {
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        text: el.innerText ? el.innerText.slice(0, 60).replace(/\n/g, ' ') : '',
        box: {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        styles: {
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          lineHeight: cs.lineHeight,
          color: cs.color,
          backgroundColor: cs.backgroundColor,
          padding: cs.padding,
          borderRadius: cs.borderRadius,
          height: cs.height,
        }
      };
    });
  }, limit);
}

async function findSmallTypographyAndControls(page) {
  return await page.evaluate(() => {
    const results = {
      smallText: [],
      smallButtons: [],
      smallInputs: [],
    };

    const allEls = document.querySelectorAll('p, span, div, a, button, th, td, label, h1, h2, h3, h4, input, select');
    for (const el of allEls) {
      if (el.children.length > 0 && el.innerText && el.innerText.trim().length > 60) continue;
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || cs.display === 'none' || cs.visibility === 'hidden') continue;

      const fsPx = parseFloat(cs.fontSize);
      const text = (el.innerText || el.textContent || '').trim();

      // Leaf nodes with small text (< 12px)
      if (el.children.length === 0 && text.length > 0 && text.length < 80) {
        if (fsPx <= 11.5) {
          results.smallText.push({
            tag: el.tagName,
            text: text.slice(0, 45),
            fontSize: cs.fontSize,
            color: cs.color,
            class: el.className,
            box: { width: Math.round(rect.width), height: Math.round(rect.height) }
          });
        }
      }

      // Small buttons (< 36px height)
      if (el.tagName === 'BUTTON' || (el.tagName === 'A' && (el.className.includes('rounded') || el.className.includes('px-')))) {
        if (rect.height > 0 && rect.height < 36 && text.length > 0 && !el.closest('header') && !el.className.includes('w-6') && !el.className.includes('w-7')) {
          results.smallButtons.push({
            tag: el.tagName,
            text: text.slice(0, 35),
            height: Math.round(rect.height),
            width: Math.round(rect.width),
            fontSize: cs.fontSize,
            padding: cs.padding,
            class: el.className,
          });
        }
      }

      // Small inputs (< 38px height)
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
        if (rect.height > 0 && rect.height < 38) {
          results.smallInputs.push({
            tag: el.tagName,
            type: el.type || '',
            placeholder: el.placeholder || '',
            height: Math.round(rect.height),
            width: Math.round(rect.width),
            fontSize: cs.fontSize,
            padding: cs.padding,
            class: el.className,
          });
        }
      }
    }

    return results;
  });
}

async function runAudit() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('=== SubAgent 2 Playwright Audit Initializing ===');

  // 1. LOGIN
  console.log('Logging in as TA:', CREDENTIALS.email);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${BASE_URL}/login`);
  await page.fill('#email', CREDENTIALS.email);
  await page.fill('#password', CREDENTIALS.password);
  await page.click('button[type="submit"]');

  await page.waitForSelector('[data-testid="ta-dashboard-page"]', { timeout: 15000 });
  console.log('Logged in successfully and landed on TA Dashboard!');

  const auditReportData = {
    layout: {},
    dashboard: {},
    applications: {},
    applicationDetail: {},
    talentPool: {},
    smallElementsFound: {},
  };

  async function navigate(pathStr) {
    await page.evaluate((p) => {
      window.history.pushState({}, '', p);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, pathStr);
    await page.waitForTimeout(800);
  }

  // ==========================================
  // PAGE 1: TA DASHBOARD & LAYOUT
  // ==========================================
  console.log('\n--- 1. Auditing TA Dashboard & Layout ---');
  await navigate('/ta/dashboard');

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(500);
    const shotPath = path.join(SCREENSHOT_DIR, `subagent2-dashboard-${vp.name}.png`);
    await page.screenshot({ path: shotPath, fullPage: true });
    console.log(`Saved dashboard screenshot [${vp.name}]: ${shotPath}`);
  }

  // Test Collapse Sidebar
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(300);
  const collapseBtn = await page.$('aside button[aria-label="Collapse sidebar"]');
  if (collapseBtn) {
    await collapseBtn.evaluate(el => el.click());
    await page.waitForTimeout(400);
    const colShot = path.join(SCREENSHOT_DIR, `subagent2-layout-sidebar-collapsed-1920x1080.png`);
    await page.screenshot({ path: colShot, fullPage: true });
    console.log('Saved collapsed sidebar screenshot:', colShot);

    const expandBtn = await page.$('aside button[aria-label="Expand sidebar"]');
    if (expandBtn) await expandBtn.evaluate(el => el.click());
    await page.waitForTimeout(300);
  }

  auditReportData.layout = {
    sidebar: await inspectElement(await page.$('aside')),
    header: await inspectElement(await page.$('header')),
    navLinks: await inspectSelectorAll(page, 'aside nav a'),
    userFooter: await inspectElement(await page.$('aside .border-t')),
  };

  auditReportData.dashboard = {
    kpiCards: await inspectSelectorAll(page, '[data-testid="dashboard-metric-cards"] > div'),
    pipelineBarStages: await inspectSelectorAll(page, '[data-testid="pipeline-summary-bar"] button'),
    actionRequiredCards: await inspectSelectorAll(page, '[data-testid="action-required-section"] .grid > div'),
    mrfCards: await inspectSelectorAll(page, '[data-testid="mrf-tracker-section"] [data-testid^="mrf-card"]'),
    dashboardTableRows: await inspectSelectorAll(page, '[data-testid="recent-applications-section"] tbody tr'),
  };
  auditReportData.smallElementsFound.dashboard = await findSmallTypographyAndControls(page);

  // ==========================================
  // PAGE 2: TA APPLICATIONS MANAGEMENT
  // ==========================================
  console.log('\n--- 2. Auditing TA Applications Management ---');
  await navigate('/ta/applications');

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(500);
    const appsShot = path.join(SCREENSHOT_DIR, `subagent2-applications-${vp.name}.png`);
    await page.screenshot({ path: appsShot, fullPage: true });
    console.log(`Saved applications screenshot [${vp.name}]: ${appsShot}`);
  }

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(300);

  auditReportData.applications = {
    filterTabs: await inspectSelectorAll(page, '[data-testid="application-filters"] button[data-testid^="filter-tab"]'),
    searchInput: await inspectElement(await page.$('[data-testid="application-search-input"]')),
    appTableHeaders: await inspectSelectorAll(page, '[data-testid="application-table"] th'),
    appTableRows: await inspectSelectorAll(page, '[data-testid="application-table"] tbody tr'),
    statusBadges: await inspectSelectorAll(page, '[data-testid="status-badge"]'),
    scoreBadges: await inspectSelectorAll(page, '[data-testid="score-badge"]'),
    manageButtons: await inspectSelectorAll(page, '[data-testid^="manage-application-btn"]'),
    paginationControls: await inspectSelectorAll(page, '[data-testid="applications-pagination"] button'),
  };
  auditReportData.smallElementsFound.applications = await findSmallTypographyAndControls(page);

  // ==========================================
  // PAGE 3: TA APPLICATION DETAIL
  // ==========================================
  console.log('\n--- 3. Auditing TA Application Detail Page ---');
  const firstManageBtn = await page.$('[data-testid^="manage-application-btn"]');
  let targetDetailUrl = '/ta/applications/1';
  if (firstManageBtn) {
    const href = await firstManageBtn.getAttribute('href');
    if (href) targetDetailUrl = href;
  }
  console.log('Navigating to candidate detail page:', targetDetailUrl);
  await navigate(targetDetailUrl);

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(500);
    const detailShot = path.join(SCREENSHOT_DIR, `subagent2-application-detail-overview-${vp.name}.png`);
    await page.screenshot({ path: detailShot, fullPage: true });
    console.log(`Saved detail overview screenshot [${vp.name}]: ${detailShot}`);
  }

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(300);

  // Tab screenshots
  const tabList = ['resume', 'interviews', 'endorsement', 'compliance', 'deployment'];
  for (const tabKey of tabList) {
    try {
      const tabBtn = await page.$(`[data-testid="detail-tab-${tabKey}"]`);
      if (tabBtn) {
        await tabBtn.evaluate(el => el.click());
        await page.waitForTimeout(400);
        const tabShot = path.join(SCREENSHOT_DIR, `subagent2-application-detail-${tabKey}-1920x1080.png`);
        await page.screenshot({ path: tabShot, fullPage: true });
        console.log(`Saved tab screenshot [${tabKey}]: ${tabShot}`);
      }
    } catch (e) {
      console.log(`Note on tab ${tabKey}:`, e.message);
    }
  }

  // Switch back to overview tab
  const overviewTabBtn = await page.$('[data-testid="detail-tab-overview"]');
  if (overviewTabBtn) {
    await overviewTabBtn.evaluate(el => el.click());
    await page.waitForTimeout(300);
  }

  auditReportData.applicationDetail = {
    sidebar: await inspectElement(await page.$('[data-testid="candidate-sidebar"]')),
    sidebarButtons: await inspectSelectorAll(page, '[data-testid="candidate-sidebar"] button'),
    detailTabs: await inspectSelectorAll(page, '[data-testid^="detail-tab-"]'),
    aiScoreCard: await inspectElement(await page.$('[data-testid="ai-score-card"]')),
    decisionLogItems: await inspectSelectorAll(page, '[data-testid^="decision-item-"]'),
    pipelineIndicator: await inspectElement(await page.$('[data-testid="pipeline-indicator-vertical"]')),
  };
  auditReportData.smallElementsFound.applicationDetail = await findSmallTypographyAndControls(page);

  // ==========================================
  // PAGE 4: TALENT POOL
  // ==========================================
  console.log('\n--- 4. Auditing Talent Pool Page ---');
  await navigate('/ta/talent-pool');

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(500);
    const poolShot = path.join(SCREENSHOT_DIR, `subagent2-talent-pool-${vp.name}.png`);
    await page.screenshot({ path: poolShot, fullPage: true });
    console.log(`Saved talent pool screenshot [${vp.name}]: ${poolShot}`);
  }

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(300);

  // Test Modal: Consider for Job
  const considerBtn = await page.$('[data-testid^="consider-btn-"]');
  if (considerBtn) {
    await considerBtn.evaluate(el => el.click());
    await page.waitForTimeout(400);
    const considerModalShot = path.join(SCREENSHOT_DIR, `subagent2-talent-pool-consider-modal-1920x1080.png`);
    await page.screenshot({ path: considerModalShot });
    console.log('Saved talent pool consider modal screenshot:', considerModalShot);
    const modalClose = await page.$('button:has-text("Cancel"), [role="dialog"] button:has(svg)');
    if (modalClose) await modalClose.evaluate(el => el.click());
    await page.waitForTimeout(300);
  }

  // Test Modal: Log Contact
  const contactBtn = await page.$('[data-testid^="log-contact-btn-"]');
  if (contactBtn) {
    await contactBtn.evaluate(el => el.click());
    await page.waitForTimeout(400);
    const contactModalShot = path.join(SCREENSHOT_DIR, `subagent2-talent-pool-contact-modal-1920x1080.png`);
    await page.screenshot({ path: contactModalShot });
    console.log('Saved talent pool contact modal screenshot:', contactModalShot);
    const modalClose = await page.$('button:has-text("Cancel"), [role="dialog"] button:has(svg)');
    if (modalClose) await modalClose.evaluate(el => el.click());
    await page.waitForTimeout(300);
  }

  auditReportData.talentPool = {
    poolCards: await inspectSelectorAll(page, '[data-testid^="talent-card-"]'),
    poolButtons: await inspectSelectorAll(page, '[data-testid^="talent-card-"] button'),
    poolFilters: await inspectSelectorAll(page, '[data-testid^="filter-avail-"]'),
    poolSearchInput: await inspectElement(await page.$('[data-testid="talent-pool-search-input"]')),
  };
  auditReportData.smallElementsFound.talentPool = await findSmallTypographyAndControls(page);

  // Write out full structured JSON
  fs.writeFileSync('c:/Users/cnico/OneDrive/Desktop/MEGS/frontend/scratch/audit-subagent2-data.json', JSON.stringify(auditReportData, null, 2));
  console.log('\n=== Playwright Audit Completed Successfully! ===');

  await browser.close();
}

runAudit().catch(err => {
  console.error('Audit Script Failed:', err);
  process.exit(1);
});
