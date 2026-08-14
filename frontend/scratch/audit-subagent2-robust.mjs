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
      text: el.innerText ? el.innerText.slice(0, 60).replace(/\n/g, ' ') : '',
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

async function inspectSelectorAll(page, selector, limit = 15) {
  return await page.$$eval(selector, (elements, limit) => {
    return elements.slice(0, limit).map(el => {
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        text: el.innerText ? el.innerText.slice(0, 50).replace(/\n/g, ' ') : '',
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
      if (el.children.length > 0 && el.innerText && el.innerText.trim().length > 80) continue;
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || cs.display === 'none' || cs.visibility === 'hidden') continue;

      const fsPx = parseFloat(cs.fontSize);
      const text = (el.innerText || el.textContent || '').trim();

      // Leaf nodes with small text (< 12px)
      if (el.children.length === 0 && text.length > 0 && text.length < 100) {
        if (fsPx <= 11.5) {
          results.smallText.push({
            tag: el.tagName,
            text: text.slice(0, 50),
            fontSize: cs.fontSize,
            color: cs.color,
            class: el.className,
            box: { width: Math.round(rect.width), height: Math.round(rect.height) }
          });
        }
      }

      // Small buttons (< 36px height)
      if (el.tagName === 'BUTTON' || (el.tagName === 'A' && (el.className.includes('btn') || el.className.includes('rounded') || el.className.includes('px-')))) {
        if (rect.height > 0 && rect.height < 36 && text.length > 0 && !el.closest('header')) {
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

  console.log('--- SubAgent 2 Playwright Audit Initializing ---');

  // 1. LOGIN
  console.log('Logging in as TA:', CREDENTIALS.email);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${BASE_URL}/login`);
  await page.fill('#email', CREDENTIALS.email);
  await page.fill('#password', CREDENTIALS.password);
  await page.click('button[type="submit"]');

  await page.waitForSelector('[data-testid="ta-dashboard-page"]', { timeout: 15000 });
  console.log('Successfully logged in and reached TA Dashboard!');

  const auditReportData = {
    layout: {},
    dashboard: {},
    applications: {},
    applicationDetail: {},
    talentPool: {},
    smallElementsFound: {},
  };

  // Helper to navigate client-side and wait for page to render
  async function navigateTo(pathStr, readySelector) {
    await page.evaluate((p) => {
      window.history.pushState({}, '', p);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, pathStr);
    await page.waitForSelector(readySelector, { timeout: 10000 });
    await page.waitForTimeout(600); // settle tanstack queries & transitions
  }

  // ==========================================
  // 2. AUDIT TA LAYOUT & DASHBOARD
  // ==========================================
  console.log('\n--- Auditing Dashboard across viewports ---');
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(300);

    const shotPath = path.join(SCREENSHOT_DIR, `subagent2-dashboard-${vp.name}.png`);
    await page.screenshot({ path: shotPath, fullPage: true });
    console.log(`Saved dashboard screenshot [${vp.name}]: ${shotPath}`);

    if (vp.name === '1920x1080') {
      // Test sidebar collapse toggle
      const collapseBtn = await page.$('aside button:has-text("Collapse")');
      if (collapseBtn) {
        await collapseBtn.click();
        await page.waitForTimeout(300);
        const colShot = path.join(SCREENSHOT_DIR, `subagent2-layout-sidebar-collapsed-1920x1080.png`);
        await page.screenshot({ path: colShot, fullPage: true });
        console.log('Saved collapsed sidebar screenshot:', colShot);
        // re-expand
        const expandBtn = await page.$('aside button[aria-label*="sidebar"], aside button[aria-label*="Expand"]');
        if (expandBtn) await expandBtn.click();
        await page.waitForTimeout(300);
      }
    }
  }

  // Collect computed styles for Dashboard & Layout
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(300);

  const sidebar = await page.$('aside');
  const header = await page.$('header');
  const navLinks = await inspectSelectorAll(page, 'aside nav a');
  const userFooter = await page.$('aside .border-t');

  auditReportData.layout = {
    sidebar: await inspectElement(sidebar),
    header: await inspectElement(header),
    navLinks: navLinks,
    userFooter: await inspectElement(userFooter),
  };

  const kpiCards = await inspectSelectorAll(page, '[data-testid="dashboard-metric-cards"] > div');
  const pipelineBarStages = await inspectSelectorAll(page, '[data-testid="pipeline-summary-bar"] button');
  const actionRequiredCards = await inspectSelectorAll(page, '[data-testid="action-required-section"] .grid > div');
  const mrfCards = await inspectSelectorAll(page, '[data-testid="mrf-tracker-section"] [data-testid^="mrf-card"]');
  const dashboardTableRows = await inspectSelectorAll(page, '[data-testid="recent-applications-section"] tbody tr');

  auditReportData.dashboard = {
    kpiCards,
    pipelineBarStages,
    actionRequiredCards,
    mrfCards,
    dashboardTableRows,
  };
  auditReportData.smallElementsFound.dashboard = await findSmallTypographyAndControls(page);

  // ==========================================
  // 3. AUDIT APPLICATIONS MANAGEMENT (/ta/applications)
  // ==========================================
  console.log('\n--- Auditing Applications List Page across viewports ---');
  await navigateTo('/ta/applications', '[data-testid="ta-applications-page"]');

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(300);
    const appsShot = path.join(SCREENSHOT_DIR, `subagent2-applications-${vp.name}.png`);
    await page.screenshot({ path: appsShot, fullPage: true });
    console.log(`Saved applications screenshot [${vp.name}]: ${appsShot}`);
  }

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(300);

  const filterTabs = await inspectSelectorAll(page, '[data-testid="application-filters"] button[data-testid^="filter-tab"]');
  const searchInput = await inspectElement(await page.$('[data-testid="application-search-input"]'));
  const appTableHeaders = await inspectSelectorAll(page, '[data-testid="application-table"] th');
  const appTableRows = await inspectSelectorAll(page, '[data-testid="application-table"] tbody tr');
  const statusBadges = await inspectSelectorAll(page, '[data-testid="status-badge"]');
  const scoreBadges = await inspectSelectorAll(page, '[data-testid="score-badge"]');
  const manageButtons = await inspectSelectorAll(page, '[data-testid^="manage-application-btn"]');
  const paginationControls = await inspectSelectorAll(page, '[data-testid="applications-pagination"] button');

  auditReportData.applications = {
    filterTabs,
    searchInput,
    appTableHeaders,
    appTableRows,
    statusBadges,
    scoreBadges,
    manageButtons,
    paginationControls,
  };
  auditReportData.smallElementsFound.applications = await findSmallTypographyAndControls(page);

  // ==========================================
  // 4. AUDIT APPLICATION DETAIL PAGE (/ta/applications/:id)
  // ==========================================
  console.log('\n--- Auditing Application Detail Page across viewports ---');
  // Find first application manage button or link
  const firstManageBtn = await page.$('[data-testid^="manage-application-btn"]');
  let targetDetailUrl = '/ta/applications/1';
  if (firstManageBtn) {
    const href = await firstManageBtn.getAttribute('href');
    if (href) targetDetailUrl = href;
  }
  console.log('Navigating to detail URL:', targetDetailUrl);
  await navigateTo(targetDetailUrl, '[data-testid="ta-application-detail-page"]');

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(300);
    const detailShot = path.join(SCREENSHOT_DIR, `subagent2-application-detail-overview-${vp.name}.png`);
    await page.screenshot({ path: detailShot, fullPage: true });
    console.log(`Saved detail overview screenshot [${vp.name}]: ${detailShot}`);
  }

  // Click each tab and take screenshots at 1920x1080
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(300);

  const tabList = ['resume', 'interviews', 'endorsement', 'compliance', 'deployment'];
  for (const tabKey of tabList) {
    const tabBtn = await page.$(`[data-testid="detail-tab-${tabKey}"]`);
    if (tabBtn) {
      await tabBtn.click();
      await page.waitForTimeout(400);
      const tabShot = path.join(SCREENSHOT_DIR, `subagent2-application-detail-${tabKey}-1920x1080.png`);
      await page.screenshot({ path: tabShot, fullPage: true });
      console.log(`Saved tab screenshot [${tabKey}]: ${tabShot}`);
    }
  }

  // Switch back to overview tab to collect data
  const overviewTabBtn = await page.$('[data-testid="detail-tab-overview"]');
  if (overviewTabBtn) await overviewTabBtn.click();
  await page.waitForTimeout(300);

  const candidateSidebar = await page.$('[data-testid="candidate-sidebar"]');
  const sidebarButtons = await inspectSelectorAll(page, '[data-testid="candidate-sidebar"] button');
  const detailTabs = await inspectSelectorAll(page, '[data-testid^="detail-tab-"]');
  const aiScoreCard = await page.$('[data-testid="ai-score-card"]');
  const decisionLogItems = await inspectSelectorAll(page, '[data-testid^="decision-item-"]');
  const pipelineVerticalIndicator = await page.$('[data-testid="pipeline-indicator-vertical"]');

  auditReportData.applicationDetail = {
    sidebar: await inspectElement(candidateSidebar),
    sidebarButtons,
    detailTabs,
    aiScoreCard: await inspectElement(aiScoreCard),
    decisionLogItems,
    pipelineIndicator: await inspectElement(pipelineVerticalIndicator),
  };
  auditReportData.smallElementsFound.applicationDetail = await findSmallTypographyAndControls(page);

  // ==========================================
  // 5. AUDIT TALENT POOL PAGE (/ta/talent-pool)
  // ==========================================
  console.log('\n--- Auditing Talent Pool Page across viewports ---');
  await navigateTo('/ta/talent-pool', 'text=Talent Pool');

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(300);
    const poolShot = path.join(SCREENSHOT_DIR, `subagent2-talent-pool-${vp.name}.png`);
    await page.screenshot({ path: poolShot, fullPage: true });
    console.log(`Saved talent pool screenshot [${vp.name}]: ${poolShot}`);
  }

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(300);

  // Open "Consider for Job" Modal
  const considerBtn = await page.$('[data-testid^="consider-btn-"]');
  if (considerBtn) {
    await considerBtn.click();
    await page.waitForTimeout(400);
    const considerModalShot = path.join(SCREENSHOT_DIR, `subagent2-talent-pool-consider-modal-1920x1080.png`);
    await page.screenshot({ path: considerModalShot });
    console.log('Saved talent pool consider modal screenshot:', considerModalShot);
    const modalClose = await page.$('button:has-text("Cancel"), [role="dialog"] button:has(svg)');
    if (modalClose) await modalClose.click();
    await page.waitForTimeout(300);
  }

  // Open "Log Contact" Modal
  const contactBtn = await page.$('[data-testid^="log-contact-btn-"]');
  if (contactBtn) {
    await contactBtn.click();
    await page.waitForTimeout(400);
    const contactModalShot = path.join(SCREENSHOT_DIR, `subagent2-talent-pool-contact-modal-1920x1080.png`);
    await page.screenshot({ path: contactModalShot });
    console.log('Saved talent pool contact modal screenshot:', contactModalShot);
    const modalClose = await page.$('button:has-text("Cancel"), [role="dialog"] button:has(svg)');
    if (modalClose) await modalClose.click();
    await page.waitForTimeout(300);
  }

  const poolCards = await inspectSelectorAll(page, '[data-testid^="talent-card-"]');
  const poolButtons = await inspectSelectorAll(page, '[data-testid^="talent-card-"] button');
  const poolFilters = await inspectSelectorAll(page, '[data-testid^="filter-avail-"]');
  const poolSearchInput = await inspectElement(await page.$('[data-testid="talent-pool-search-input"]'));

  auditReportData.talentPool = {
    poolCards,
    poolButtons,
    poolFilters,
    poolSearchInput,
  };
  auditReportData.smallElementsFound.talentPool = await findSmallTypographyAndControls(page);

  // Write out comprehensive audit JSON
  fs.writeFileSync('c:/Users/cnico/OneDrive/Desktop/MEGS/frontend/scratch/audit-subagent2-data.json', JSON.stringify(auditReportData, null, 2));
  console.log('\n=== Playwright Audit Successfully Completed! ===');

  await browser.close();
}

runAudit().catch(err => {
  console.error('Audit Script Failed:', err);
  process.exit(1);
});
