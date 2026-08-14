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

async function inspectElement(elementHandle, label) {
  if (!elementHandle) return null;
  return await elementHandle.evaluate((el) => {
    const cs = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      tagName: el.tagName,
      className: el.className,
      text: el.innerText ? el.innerText.slice(0, 50).replace(/\n/g, ' ') : '',
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
        paddingTop: cs.paddingTop,
        paddingBottom: cs.paddingBottom,
        paddingLeft: cs.paddingLeft,
        paddingRight: cs.paddingRight,
        borderRadius: cs.borderRadius,
        border: cs.border,
        height: cs.height,
        minHeight: cs.minHeight,
        gap: cs.gap,
      }
    };
  });
}

async function inspectSelectorAll(page, selector, limit = 10) {
  return await page.$$eval(selector, (elements, limit) => {
    return elements.slice(0, limit).map(el => {
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        text: el.innerText ? el.innerText.slice(0, 40).replace(/\n/g, ' ') : '',
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
      if (el.children.length > 0 && el.innerText && el.innerText.trim().length > 100) continue; // skip massive containers
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || cs.display === 'none' || cs.visibility === 'hidden') continue;

      const fsPx = parseFloat(cs.fontSize);
      const text = (el.innerText || el.textContent || '').trim();

      // Check small text: if leaf node or small element
      if (el.children.length === 0 && text.length > 0 && text.length < 100) {
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

      // Check small buttons (< 36px height)
      if (el.tagName === 'BUTTON' || (el.tagName === 'A' && el.getAttribute('role') === 'button') || (el.tagName === 'A' && el.className.includes('btn') || el.className.includes('rounded'))) {
        if (rect.height > 0 && rect.height < 36 && text.length > 0) {
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

      // Check small inputs (< 38px height)
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

  const auditReportData = {
    layout: {},
    dashboard: {},
    applications: {},
    applicationDetail: {},
    talentPool: {},
    smallElementsFound: {},
  };

  // 1. LOGIN
  console.log('Logging in as TA:', CREDENTIALS.email);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  
  await page.fill('#email', CREDENTIALS.email);
  await page.fill('#password', CREDENTIALS.password);
  await page.click('button[type="submit"]');

  await page.waitForURL('**/ta/dashboard', { timeout: 15000 });
  console.log('Successfully logged in! Current URL:', page.url());
  await page.waitForTimeout(1000); // let animations settle

  // 2. AUDIT TA LAYOUT & DASHBOARD ACROSS 3 VIEWPORTS
  for (const vp of VIEWPORTS) {
    console.log(`\n=== Auditing at resolution ${vp.name} ===`);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${BASE_URL}/ta/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    // Screenshot Dashboard
    const dashboardShot = path.join(SCREENSHOT_DIR, `subagent2-dashboard-${vp.name}.png`);
    await page.screenshot({ path: dashboardShot, fullPage: true });
    console.log('Saved dashboard screenshot:', dashboardShot);

    // If 1920x1080, also test collapsed sidebar screenshot
    if (vp.name === '1920x1080') {
      const collapseBtn = await page.$('aside button[aria-label*="sidebar"], aside button:has-text("Collapse")');
      if (collapseBtn) {
        await collapseBtn.click();
        await page.waitForTimeout(400);
        const collapsedShot = path.join(SCREENSHOT_DIR, `subagent2-layout-sidebar-collapsed-1920x1080.png`);
        await page.screenshot({ path: collapsedShot, fullPage: true });
        console.log('Saved collapsed sidebar screenshot:', collapsedShot);
        // expand back
        const expandBtn = await page.$('aside button[aria-label*="sidebar"]');
        if (expandBtn) await expandBtn.click();
        await page.waitForTimeout(400);
      }
    }
  }

  // Deep inspect Dashboard components at 1920x1080
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${BASE_URL}/ta/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Inspect Sidebar & Header
  const sidebar = await page.$('aside');
  const header = await page.$('header');
  const navLinks = await inspectSelectorAll(page, 'aside nav a');
  const userFooter = await page.$('aside .border-t');
  
  auditReportData.layout = {
    sidebar: await inspectElement(sidebar, 'sidebar'),
    header: await inspectElement(header, 'header'),
    navLinks: navLinks,
    userFooter: await inspectElement(userFooter, 'userFooter'),
  };

  // Inspect Dashboard Metric Cards
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

  // Run small typography scan on Dashboard
  auditReportData.smallElementsFound.dashboard = await findSmallTypographyAndControls(page);

  // 3. AUDIT APPLICATIONS PAGE (/ta/applications)
  console.log('\n=== Auditing Applications Page ===');
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${BASE_URL}/ta/applications`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const appsShot = path.join(SCREENSHOT_DIR, `subagent2-applications-${vp.name}.png`);
    await page.screenshot({ path: appsShot, fullPage: true });
    console.log('Saved applications screenshot:', appsShot);
  }

  // Deep inspect applications page components at 1920x1080
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${BASE_URL}/ta/applications`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const filterTabs = await inspectSelectorAll(page, '[data-testid="application-filters"] button[data-testid^="filter-tab"]');
  const searchInput = await inspectElement(await page.$('[data-testid="application-search-input"]'), 'searchInput');
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

  // 4. AUDIT APPLICATION DETAIL PAGE (/ta/applications/:id)
  console.log('\n=== Auditing Application Detail Page ===');
  // Grab the first application link
  const firstAppManageBtn = await page.$('[data-testid^="manage-application-btn"]');
  let detailUrl = `${BASE_URL}/ta/applications/1`;
  if (firstAppManageBtn) {
    const href = await firstAppManageBtn.getAttribute('href');
    if (href) detailUrl = `${BASE_URL}${href}`;
  }

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(detailUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const detailShot = path.join(SCREENSHOT_DIR, `subagent2-application-detail-overview-${vp.name}.png`);
    await page.screenshot({ path: detailShot, fullPage: true });
    console.log('Saved detail overview screenshot:', detailShot);

    if (vp.name === '1920x1080') {
      // Click Resume & Profile tab and screenshot
      const resumeTab = await page.$('[data-testid="detail-tab-resume"]');
      if (resumeTab) {
        await resumeTab.click();
        await page.waitForTimeout(600);
        const resumeShot = path.join(SCREENSHOT_DIR, `subagent2-application-detail-resume-1920x1080.png`);
        await page.screenshot({ path: resumeShot, fullPage: true });
        console.log('Saved detail resume tab screenshot:', resumeShot);
      }

      // Click Interviews tab and screenshot
      const interviewsTab = await page.$('[data-testid="detail-tab-interviews"]');
      if (interviewsTab) {
        await interviewsTab.click();
        await page.waitForTimeout(600);
        const intShot = path.join(SCREENSHOT_DIR, `subagent2-application-detail-interviews-1920x1080.png`);
        await page.screenshot({ path: intShot, fullPage: true });
        console.log('Saved detail interviews tab screenshot:', intShot);
      }

      // Click Compliance tab and screenshot
      const compTab = await page.$('[data-testid="detail-tab-compliance"]');
      if (compTab) {
        await compTab.click();
        await page.waitForTimeout(600);
        const compShot = path.join(SCREENSHOT_DIR, `subagent2-application-detail-compliance-1920x1080.png`);
        await page.screenshot({ path: compShot, fullPage: true });
        console.log('Saved detail compliance tab screenshot:', compShot);
      }
    }
  }

  // Switch back to overview tab to inspect elements
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(detailUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const candidateSidebar = await page.$('[data-testid="candidate-sidebar"]');
  const sidebarButtons = await inspectSelectorAll(page, '[data-testid="candidate-sidebar"] button');
  const detailTabs = await inspectSelectorAll(page, '[data-testid^="detail-tab-"]');
  const aiScoreCard = await page.$('[data-testid="ai-score-card"]');
  const decisionLogItems = await inspectSelectorAll(page, '[data-testid^="decision-item-"]');
  const pipelineVerticalIndicator = await page.$('[data-testid="pipeline-indicator-vertical"]');

  auditReportData.applicationDetail = {
    sidebar: await inspectElement(candidateSidebar, 'candidateSidebar'),
    sidebarButtons,
    detailTabs,
    aiScoreCard: await inspectElement(aiScoreCard, 'aiScoreCard'),
    decisionLogItems,
    pipelineIndicator: await inspectElement(pipelineVerticalIndicator, 'pipelineIndicator'),
  };

  auditReportData.smallElementsFound.applicationDetail = await findSmallTypographyAndControls(page);

  // 5. AUDIT TALENT POOL PAGE (/ta/talent-pool)
  console.log('\n=== Auditing Talent Pool Page ===');
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${BASE_URL}/ta/talent-pool`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const poolShot = path.join(SCREENSHOT_DIR, `subagent2-talent-pool-${vp.name}.png`);
    await page.screenshot({ path: poolShot, fullPage: true });
    console.log('Saved talent pool screenshot:', poolShot);
  }

  // Deep inspect Talent Pool components at 1920x1080
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${BASE_URL}/ta/talent-pool`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Modal inspection: click "Consider for Job" if candidate card exists
  const firstConsiderBtn = await page.$('[data-testid^="consider-btn-"]');
  if (firstConsiderBtn) {
    await firstConsiderBtn.click();
    await page.waitForTimeout(400);
    const considerModalShot = path.join(SCREENSHOT_DIR, `subagent2-talent-pool-consider-modal-1920x1080.png`);
    await page.screenshot({ path: considerModalShot });
    console.log('Saved talent pool consider modal screenshot:', considerModalShot);
    const modalClose = await page.$('[role="dialog"] button:has-text("Cancel"), [role="dialog"] button:has(svg)');
    if (modalClose) await modalClose.click();
    await page.waitForTimeout(300);
  }

  const poolCards = await inspectSelectorAll(page, '[data-testid^="talent-card-"]');
  const poolButtons = await inspectSelectorAll(page, '[data-testid^="talent-card-"] button');
  const poolFilters = await inspectSelectorAll(page, '[data-testid^="filter-avail-"]');
  const poolSearchInput = await inspectElement(await page.$('[data-testid="talent-pool-search-input"]'), 'poolSearchInput');

  auditReportData.talentPool = {
    poolCards,
    poolButtons,
    poolFilters,
    poolSearchInput,
  };

  auditReportData.smallElementsFound.talentPool = await findSmallTypographyAndControls(page);

  // Save audit raw data to json
  fs.writeFileSync('c:/Users/cnico/OneDrive/Desktop/MEGS/frontend/scratch/audit-subagent2-data.json', JSON.stringify(auditReportData, null, 2));
  console.log('\n--- Audit Complete! Data written to scratch/audit-subagent2-data.json ---');

  await browser.close();
}

runAudit().catch(err => {
  console.error('Audit Script Failed:', err);
  process.exit(1);
});
