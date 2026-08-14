import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'c:/Users/cnico/OneDrive/Desktop/MEGS/frontend/audit-screenshots';
const BASE_URL = 'http://localhost:5173';

const RESOLUTIONS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
];

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function inspectComputedMetrics(page, pageName, resolutionName) {
  return await page.evaluate(({ pageName, resolutionName }) => {
    const findings = {
      pageName,
      resolutionName,
      url: window.location.pathname + window.location.search,
      title: document.title,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      hasHorizontalScrollbar: document.documentElement.scrollWidth > window.innerWidth,
      bodyScrollWidth: document.documentElement.scrollWidth,
      elementsWithSmallFont: [],
      smallButtons: [],
      badgeMetrics: [],
      tables: [],
      formControls: [],
      modals: [],
    };

    // 1. Text font size audit (< 13px)
    const textEls = document.querySelectorAll('p, span, div, a, button, label, th, td, h1, h2, h3, h4, h5, h6, input, select');
    const seenTexts = new Set();

    textEls.forEach((el) => {
      if (el.children.length === 0 && el.textContent && el.textContent.trim().length > 0) {
        const text = el.textContent.trim();
        const style = window.getComputedStyle(el);
        const fontSize = parseFloat(style.fontSize);
        const rect = el.getBoundingClientRect();

        if (rect.width > 0 && rect.height > 0 && fontSize < 13) {
          const key = `${text.substring(0, 25)}_${fontSize}_${style.color}`;
          if (!seenTexts.has(key) && findings.elementsWithSmallFont.length < 30) {
            seenTexts.add(key);
            findings.elementsWithSmallFont.push({
              text: text.substring(0, 60),
              tagName: el.tagName.toLowerCase(),
              fontSize: `${fontSize}px`,
              fontWeight: style.fontWeight,
              lineHeight: style.lineHeight,
              color: style.color,
              className: el.className ? el.className.toString().substring(0, 60) : '',
            });
          }
        }
      }
    });

    // 2. Buttons audit
    const buttons = document.querySelectorAll('button, a[role="button"]');
    buttons.forEach((btn) => {
      const rect = btn.getBoundingClientRect();
      const style = window.getComputedStyle(btn);
      if (rect.width > 0 && rect.height > 0) {
        const height = rect.height;
        const width = rect.width;
        const fontSize = parseFloat(style.fontSize);
        const text = (btn.textContent || btn.getAttribute('aria-label') || '').trim();

        if (height < 36 || fontSize < 12 || width < 32) {
          findings.smallButtons.push({
            text: text.substring(0, 40),
            height: `${Math.round(height)}px`,
            width: `${Math.round(width)}px`,
            fontSize: `${fontSize}px`,
            padding: `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`,
            className: btn.className ? btn.className.toString().substring(0, 60) : '',
          });
        }
      }
    });

    // 3. Badges audit
    const badgeCandidates = document.querySelectorAll('[class*="rounded-full"], [class*="badge"], [data-testid*="badge"], span[class*="uppercase"]');
    badgeCandidates.forEach((b) => {
      const rect = b.getBoundingClientRect();
      const style = window.getComputedStyle(b);
      const text = b.textContent ? b.textContent.trim() : '';
      if (rect.width > 0 && rect.height > 0 && text.length > 0 && text.length < 35) {
        findings.badgeMetrics.push({
          text,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          padding: `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`,
          backgroundColor: style.backgroundColor,
          color: style.color,
          height: `${Math.round(rect.height)}px`,
          border: style.border,
        });
      }
    });

    // 4. Tables audit
    const tableEls = document.querySelectorAll('table');
    tableEls.forEach((tbl) => {
      const rect = tbl.getBoundingClientRect();
      const parentRect = tbl.parentElement ? tbl.parentElement.getBoundingClientRect() : rect;
      const ths = Array.from(tbl.querySelectorAll('th')).map((th) => ({
        header: th.textContent.trim(),
        width: `${Math.round(th.getBoundingClientRect().width)}px`,
        fontSize: window.getComputedStyle(th).fontSize,
        padding: window.getComputedStyle(th).padding,
      }));
      const rowCount = tbl.querySelectorAll('tbody tr').length;

      // Check cells with truncate or small padding
      let crampedCellCount = 0;
      tbl.querySelectorAll('tbody td').forEach((td) => {
        const p = parseFloat(window.getComputedStyle(td).paddingLeft);
        if (p < 8) crampedCellCount++;
      });

      findings.tables.push({
        tableWidth: `${Math.round(rect.width)}px`,
        containerWidth: `${Math.round(parentRect.width)}px`,
        isOverflowing: rect.width > parentRect.width,
        headers: ths,
        rowCount,
        crampedCellCount,
      });
    });

    // 5. Form controls audit
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach((inp) => {
      const rect = inp.getBoundingClientRect();
      const style = window.getComputedStyle(inp);
      if (rect.width > 0 && rect.height > 0) {
        const height = rect.height;
        const fontSize = parseFloat(style.fontSize);
        if (height < 34 || fontSize < 13) {
          findings.formControls.push({
            placeholder: inp.getAttribute('placeholder') || inp.getAttribute('name') || inp.id,
            tag: inp.tagName.toLowerCase(),
            height: `${Math.round(height)}px`,
            fontSize: `${fontSize}px`,
            padding: `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`,
          });
        }
      }
    });

    // 6. Modal audit
    const modalEl = document.querySelector('[role="dialog"], .modal');
    if (modalEl && window.getComputedStyle(modalEl).display !== 'none') {
      const rect = modalEl.getBoundingClientRect();
      findings.modals.push({
        width: `${Math.round(rect.width)}px`,
        height: `${Math.round(rect.height)}px`,
        viewportHeight: window.innerHeight,
        exceedsScreenHeight: rect.height > window.innerHeight * 0.9,
      });
    }

    return findings;
  }, { pageName, resolutionName });
}

async function safeClick(page, selector, timeout = 2000) {
  try {
    const el = await page.waitForSelector(selector, { state: 'visible', timeout });
    if (el) {
      await el.click();
      await page.waitForTimeout(500);
      return true;
    }
  } catch {
    // fallback or element not present
  }
  return false;
}

async function runAudit() {
  const browser = await chromium.launch({ headless: true });
  const allResults = [];

  for (const res of RESOLUTIONS) {
    console.log(`\n======================================================`);
    console.log(` AUDITING RESOLUTION: ${res.name} (${res.width}x${res.height})`);
    console.log(`======================================================\n`);

    const context = await browser.newContext({
      viewport: { width: res.width, height: res.height },
    });
    const page = await context.newPage();

    // Login
    console.log(`[${res.name}] Logging in...`);
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'ta@megs-recruitment.com');
    await page.fill('input[type="password"]', 'TAPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/ta/**', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const clientNav = async (pathUrl) => {
      await page.evaluate((path) => {
        window.history.pushState({}, '', path);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, pathUrl);
      await page.waitForTimeout(1200);
    };

    // ─────────────────────────────────────────────────────────────
    // 1. MRF (Manpower Request Form)
    // ─────────────────────────────────────────────────────────────
    console.log(`[${res.name}] 1.1 TAMRFsPage (MRF list)...`);
    await clientNav('/ta/mrfs');
    let img = `subagent3-mrfs-list-${res.name}.png`;
    let ssPath = path.join(SCREENSHOT_DIR, img);
    await page.screenshot({ path: ssPath, fullPage: true });
    let metrics = await inspectComputedMetrics(page, 'TAMRFsPage - List', res.name);
    metrics.screenshotFile = img;
    allResults.push(metrics);

    // Open Create MRF Modal
    console.log(`[${res.name}] 1.2 TAMRFsPage Create Modal...`);
    const openedMrfModal = await safeClick(page, 'button:has-text("Create MRF")');
    if (openedMrfModal) {
      img = `subagent3-mrfs-create-modal-${res.name}.png`;
      ssPath = path.join(SCREENSHOT_DIR, img);
      await page.screenshot({ path: ssPath });
      metrics = await inspectComputedMetrics(page, 'TAMRFsPage - Create MRF Modal', res.name);
      metrics.screenshotFile = img;
      allResults.push(metrics);
      await safeClick(page, 'button:has-text("Cancel")');
    }

    // MRF Detail (/ta/mrfs/66)
    console.log(`[${res.name}] 1.3 TAMRFDetailPage (Overview / Jobs)...`);
    await clientNav('/ta/mrfs/66');
    img = `subagent3-mrf-detail-jobs-${res.name}.png`;
    ssPath = path.join(SCREENSHOT_DIR, img);
    await page.screenshot({ path: ssPath, fullPage: true });
    metrics = await inspectComputedMetrics(page, 'TAMRFDetailPage - Jobs Tab', res.name);
    metrics.screenshotFile = img;
    allResults.push(metrics);

    // MRF Detail - Compliance Tab
    console.log(`[${res.name}] 1.4 TAMRFDetailPage Compliance Tab...`);
    const clickedCompTab = await safeClick(page, 'button:has-text("Compliance Templates")');
    if (clickedCompTab) {
      img = `subagent3-mrf-detail-compliance-${res.name}.png`;
      ssPath = path.join(SCREENSHOT_DIR, img);
      await page.screenshot({ path: ssPath, fullPage: true });
      metrics = await inspectComputedMetrics(page, 'TAMRFDetailPage - Compliance Tab', res.name);
      metrics.screenshotFile = img;
      allResults.push(metrics);

      // Open Add Template Modal
      const openedTplModal = await safeClick(page, 'button:has-text("Add Requirement")');
      if (openedTplModal) {
        img = `subagent3-mrf-add-template-modal-${res.name}.png`;
        ssPath = path.join(SCREENSHOT_DIR, img);
        await page.screenshot({ path: ssPath });
        metrics = await inspectComputedMetrics(page, 'TAMRFDetailPage - Add Template Modal', res.name);
        metrics.screenshotFile = img;
        allResults.push(metrics);
        await safeClick(page, 'button:has-text("Cancel")');
      }
    }

    // MRF Detail - Deployments Tab
    console.log(`[${res.name}] 1.5 TAMRFDetailPage Deployments Tab...`);
    const clickedDeployTab = await safeClick(page, 'button:has-text("Deployments")');
    if (clickedDeployTab) {
      img = `subagent3-mrf-detail-deployments-${res.name}.png`;
      ssPath = path.join(SCREENSHOT_DIR, img);
      await page.screenshot({ path: ssPath, fullPage: true });
      metrics = await inspectComputedMetrics(page, 'TAMRFDetailPage - Deployments Tab', res.name);
      metrics.screenshotFile = img;
      allResults.push(metrics);
    }

    // MRF Detail - Specs Tab
    console.log(`[${res.name}] 1.6 TAMRFDetailPage Specs Tab...`);
    const clickedSpecsTab = await safeClick(page, 'button:has-text("Job Spec")');
    if (clickedSpecsTab) {
      img = `subagent3-mrf-detail-specs-${res.name}.png`;
      ssPath = path.join(SCREENSHOT_DIR, img);
      await page.screenshot({ path: ssPath, fullPage: true });
      metrics = await inspectComputedMetrics(page, 'TAMRFDetailPage - Specs Tab', res.name);
      metrics.screenshotFile = img;
      allResults.push(metrics);
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Job Postings
    // ─────────────────────────────────────────────────────────────
    console.log(`[${res.name}] 2.1 TAJobsPage (Jobs list)...`);
    await clientNav('/ta/jobs');
    img = `subagent3-jobs-list-${res.name}.png`;
    ssPath = path.join(SCREENSHOT_DIR, img);
    await page.screenshot({ path: ssPath, fullPage: true });
    metrics = await inspectComputedMetrics(page, 'TAJobsPage - List', res.name);
    metrics.screenshotFile = img;
    allResults.push(metrics);

    // Open Create Job Modal
    console.log(`[${res.name}] 2.2 TAJobsPage Create Modal...`);
    const openedJobModal = await safeClick(page, 'button:has-text("Create Job")');
    if (openedJobModal) {
      img = `subagent3-jobs-create-modal-${res.name}.png`;
      ssPath = path.join(SCREENSHOT_DIR, img);
      await page.screenshot({ path: ssPath });
      metrics = await inspectComputedMetrics(page, 'TAJobsPage - Create Job Modal', res.name);
      metrics.screenshotFile = img;
      allResults.push(metrics);
      await safeClick(page, 'button:has-text("Cancel")');
    }

    // Job Detail (/ta/jobs/68)
    console.log(`[${res.name}] 2.3 TAJobDetailPage (Pipeline)...`);
    await clientNav('/ta/jobs/68');
    img = `subagent3-job-detail-pipeline-${res.name}.png`;
    ssPath = path.join(SCREENSHOT_DIR, img);
    await page.screenshot({ path: ssPath, fullPage: true });
    metrics = await inspectComputedMetrics(page, 'TAJobDetailPage - Pipeline', res.name);
    metrics.screenshotFile = img;
    allResults.push(metrics);

    // Job Detail - Overview / Spec Tab
    console.log(`[${res.name}] 2.4 TAJobDetailPage (Overview/Spec)...`);
    const clickedJobOverview = await safeClick(page, 'button:has-text("Overview"), button:has-text("Job Spec")');
    if (clickedJobOverview) {
      img = `subagent3-job-detail-overview-${res.name}.png`;
      ssPath = path.join(SCREENSHOT_DIR, img);
      await page.screenshot({ path: ssPath, fullPage: true });
      metrics = await inspectComputedMetrics(page, 'TAJobDetailPage - Overview', res.name);
      metrics.screenshotFile = img;
      allResults.push(metrics);
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Clients
    // ─────────────────────────────────────────────────────────────
    console.log(`[${res.name}] 3.1 TAClientsPage (Client list)...`);
    await clientNav('/ta/clients');
    img = `subagent3-clients-list-${res.name}.png`;
    ssPath = path.join(SCREENSHOT_DIR, img);
    await page.screenshot({ path: ssPath, fullPage: true });
    metrics = await inspectComputedMetrics(page, 'TAClientsPage - List', res.name);
    metrics.screenshotFile = img;
    allResults.push(metrics);

    // Open Add Client Modal
    console.log(`[${res.name}] 3.2 TAClientsPage Add Client Modal...`);
    const openedClientModal = await safeClick(page, 'button:has-text("Add New Client")');
    if (openedClientModal) {
      img = `subagent3-clients-add-modal-${res.name}.png`;
      ssPath = path.join(SCREENSHOT_DIR, img);
      await page.screenshot({ path: ssPath });
      metrics = await inspectComputedMetrics(page, 'TAClientsPage - Add Client Modal', res.name);
      metrics.screenshotFile = img;
      allResults.push(metrics);
      await safeClick(page, 'button:has-text("Cancel")');
    }

    // Client Detail (/ta/clients/66)
    console.log(`[${res.name}] 3.3 TAClientDetailPage (MRFs tab)...`);
    await clientNav('/ta/clients/66');
    img = `subagent3-client-detail-mrfs-${res.name}.png`;
    ssPath = path.join(SCREENSHOT_DIR, img);
    await page.screenshot({ path: ssPath, fullPage: true });
    metrics = await inspectComputedMetrics(page, 'TAClientDetailPage - MRFs Tab', res.name);
    metrics.screenshotFile = img;
    allResults.push(metrics);

    // Client Detail - Deployments Tab
    console.log(`[${res.name}] 3.4 TAClientDetailPage (Deployments tab)...`);
    const clickedClientDeploy = await safeClick(page, '[data-testid="tab-client-deployments"]');
    if (clickedClientDeploy) {
      img = `subagent3-client-detail-deployments-${res.name}.png`;
      ssPath = path.join(SCREENSHOT_DIR, img);
      await page.screenshot({ path: ssPath, fullPage: true });
      metrics = await inspectComputedMetrics(page, 'TAClientDetailPage - Deployments Tab', res.name);
      metrics.screenshotFile = img;
      allResults.push(metrics);
    }

    // Client Detail - Info Tab
    console.log(`[${res.name}] 3.5 TAClientDetailPage (Company Info tab)...`);
    const clickedClientInfo = await safeClick(page, '[data-testid="tab-client-info"]');
    if (clickedClientInfo) {
      img = `subagent3-client-detail-info-${res.name}.png`;
      ssPath = path.join(SCREENSHOT_DIR, img);
      await page.screenshot({ path: ssPath, fullPage: true });
      metrics = await inspectComputedMetrics(page, 'TAClientDetailPage - Info Tab', res.name);
      metrics.screenshotFile = img;
      allResults.push(metrics);
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Interviews
    // ─────────────────────────────────────────────────────────────
    console.log(`[${res.name}] 4.1 TAInterviewsPage (Calendar/List & SLA)...`);
    await clientNav('/ta/interviews');
    img = `subagent3-interviews-list-${res.name}.png`;
    ssPath = path.join(SCREENSHOT_DIR, img);
    await page.screenshot({ path: ssPath, fullPage: true });
    metrics = await inspectComputedMetrics(page, 'TAInterviewsPage - List & SLA', res.name);
    metrics.screenshotFile = img;
    allResults.push(metrics);

    // Open Interview Outcome Modal
    console.log(`[${res.name}] 4.2 TAInterviewsPage Outcome Modal...`);
    const openedOutcomeModal = await safeClick(page, 'button:has-text("Record Outcome"), button:has-text("Status")');
    if (openedOutcomeModal) {
      img = `subagent3-interviews-outcome-modal-${res.name}.png`;
      ssPath = path.join(SCREENSHOT_DIR, img);
      await page.screenshot({ path: ssPath });
      metrics = await inspectComputedMetrics(page, 'TAInterviewsPage - Outcome Modal', res.name);
      metrics.screenshotFile = img;
      allResults.push(metrics);
      await safeClick(page, 'button:has-text("Cancel")');
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Compliance & Deployments
    // ─────────────────────────────────────────────────────────────
    console.log(`[${res.name}] 5.1 TACompliancePage...`);
    await clientNav('/ta/compliance');
    img = `subagent3-compliance-page-${res.name}.png`;
    ssPath = path.join(SCREENSHOT_DIR, img);
    await page.screenshot({ path: ssPath, fullPage: true });
    metrics = await inspectComputedMetrics(page, 'TACompliancePage', res.name);
    metrics.screenshotFile = img;
    allResults.push(metrics);

    console.log(`[${res.name}] 5.2 TADeploymentsPage...`);
    await clientNav('/ta/deployments');
    img = `subagent3-deployments-table-${res.name}.png`;
    ssPath = path.join(SCREENSHOT_DIR, img);
    await page.screenshot({ path: ssPath, fullPage: true });
    metrics = await inspectComputedMetrics(page, 'TADeploymentsPage - List', res.name);
    metrics.screenshotFile = img;
    allResults.push(metrics);

    // Open Update Deployment Status Modal
    console.log(`[${res.name}] 5.3 TADeploymentsPage Update Status Modal...`);
    const openedDeployStatusModal = await safeClick(page, 'button[data-testid*="update-deployment-status"], button:has-text("Status")');
    if (openedDeployStatusModal) {
      img = `subagent3-deployments-status-modal-${res.name}.png`;
      ssPath = path.join(SCREENSHOT_DIR, img);
      await page.screenshot({ path: ssPath });
      metrics = await inspectComputedMetrics(page, 'TADeploymentsPage - Status Modal', res.name);
      metrics.screenshotFile = img;
      allResults.push(metrics);
      await safeClick(page, 'button:has-text("Cancel")');
    }

    // Application Detail with Compliance and Deployment tabs (/ta/applications/111)
    console.log(`[${res.name}] 5.4 Application Detail Compliance Tab...`);
    await clientNav('/ta/applications/111');
    const openedAppComp = await safeClick(page, 'button:has-text("Compliance"), [data-testid="tab-compliance"]');
    if (openedAppComp) {
      img = `subagent3-app-compliance-tab-${res.name}.png`;
      ssPath = path.join(SCREENSHOT_DIR, img);
      await page.screenshot({ path: ssPath, fullPage: true });
      metrics = await inspectComputedMetrics(page, 'ComplianceTab (Application Detail)', res.name);
      metrics.screenshotFile = img;
      allResults.push(metrics);
    }

    console.log(`[${res.name}] 5.5 Application Detail Deployment Tab...`);
    const openedAppDeploy = await safeClick(page, 'button:has-text("Deployment"), [data-testid="tab-deployment"]');
    if (openedAppDeploy) {
      img = `subagent3-app-deployment-tab-${res.name}.png`;
      ssPath = path.join(SCREENSHOT_DIR, img);
      await page.screenshot({ path: ssPath, fullPage: true });
      metrics = await inspectComputedMetrics(page, 'DeploymentTab (Application Detail)', res.name);
      metrics.screenshotFile = img;
      allResults.push(metrics);
    }

    // ─────────────────────────────────────────────────────────────
    // 6. Employees
    // ─────────────────────────────────────────────────────────────
    console.log(`[${res.name}] 6.1 TAEmployeesPage (Directory)...`);
    await clientNav('/ta/employees');
    img = `subagent3-employees-list-${res.name}.png`;
    ssPath = path.join(SCREENSHOT_DIR, img);
    await page.screenshot({ path: ssPath, fullPage: true });
    metrics = await inspectComputedMetrics(page, 'TAEmployeesPage - Directory', res.name);
    metrics.screenshotFile = img;
    allResults.push(metrics);

    // Employee Detail (/ta/employees/50)
    console.log(`[${res.name}] 6.2 TAEmployeeDetailPage (Personal Info & Gov IDs)...`);
    await clientNav('/ta/employees/50');
    img = `subagent3-employee-detail-personal-${res.name}.png`;
    ssPath = path.join(SCREENSHOT_DIR, img);
    await page.screenshot({ path: ssPath, fullPage: true });
    metrics = await inspectComputedMetrics(page, 'TAEmployeeDetailPage - Personal Info', res.name);
    metrics.screenshotFile = img;
    allResults.push(metrics);

    // Employee Detail - Deployments Tab
    console.log(`[${res.name}] 6.3 TAEmployeeDetailPage (Deployments)...`);
    const clickedEmpDeploy = await safeClick(page, '[data-testid="tab-201-deployments"]');
    if (clickedEmpDeploy) {
      img = `subagent3-employee-detail-deployments-${res.name}.png`;
      ssPath = path.join(SCREENSHOT_DIR, img);
      await page.screenshot({ path: ssPath, fullPage: true });
      metrics = await inspectComputedMetrics(page, 'TAEmployeeDetailPage - Deployments', res.name);
      metrics.screenshotFile = img;
      allResults.push(metrics);
    }

    // Employee Detail - Compliance Tab
    console.log(`[${res.name}] 6.4 TAEmployeeDetailPage (Compliance & 201 docs)...`);
    const clickedEmpComp = await safeClick(page, '[data-testid="tab-201-compliance"]');
    if (clickedEmpComp) {
      img = `subagent3-employee-detail-compliance-${res.name}.png`;
      ssPath = path.join(SCREENSHOT_DIR, img);
      await page.screenshot({ path: ssPath, fullPage: true });
      metrics = await inspectComputedMetrics(page, 'TAEmployeeDetailPage - Compliance Docs', res.name);
      metrics.screenshotFile = img;
      allResults.push(metrics);
    }

    // Employee Detail - Timeline Tab
    console.log(`[${res.name}] 6.5 TAEmployeeDetailPage (Career Timeline)...`);
    const clickedEmpTime = await safeClick(page, '[data-testid="tab-201-timeline"]');
    if (clickedEmpTime) {
      img = `subagent3-employee-detail-timeline-${res.name}.png`;
      ssPath = path.join(SCREENSHOT_DIR, img);
      await page.screenshot({ path: ssPath, fullPage: true });
      metrics = await inspectComputedMetrics(page, 'TAEmployeeDetailPage - Career Timeline', res.name);
      metrics.screenshotFile = img;
      allResults.push(metrics);
    }

    await context.close();
  }

  await browser.close();

  fs.writeFileSync('audit-subagent3-results.json', JSON.stringify(allResults, null, 2));
  console.log('\n======================================================');
  console.log(' AUDIT SUITE FINISHED SUCCESSFULLY!');
  console.log(' Results written to audit-subagent3-results.json');
  console.log(` Total pages/views audited: ${allResults.length}`);
  console.log('======================================================\n');
}

runAudit().catch(console.error);
