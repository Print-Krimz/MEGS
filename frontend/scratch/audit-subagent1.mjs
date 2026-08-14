import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOTS_DIR = 'c:/Users/cnico/OneDrive/Desktop/MEGS/frontend/audit-screenshots';
const BASE_URL = 'http://localhost:5173';

const APPLICANT_TOKEN = 'eyJhbGciOiJFUzI1NiIsImtpZCI6IjExMTllMTg1LWNkNDUtNDVjYy04N2MwLWNlZmExZTg0NTA1NSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL212bWJocnJ3aXJva3JxcGV4eGp3LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI5NjYyYjhkOS04YjMwLTQzYjEtODlhNy1kYjVjYmU4YzQxYTkiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzg2NzE2MDk2LCJpYXQiOjE3ODY3MTI0OTYsImVtYWlsIjoidGVzdDFAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbF92ZXJpZmllZCI6dHJ1ZX0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3ODY3MTI0OTZ9XSwic2Vzc2lvbl9pZCI6ImFmMjI1ZWZmLWFhZmQtNDY5NC1hNTM2LTJjNmY3YzgxN2ZlZSIsImlzX2Fub255bW91cyI6ZmFsc2V9.8x9DCcpyfgXw2cf9T8Vrn4U1JFvl0m57B03bHpVgRIzKr2FdQ5Q4xK6UpIEXeiez7TPDocvlBI3bekd4rHbdFw';

const APPLICANT_USER = {
  id: '9662b8d9-8b30-43b1-89a7-db5cbe8c41a9',
  email: 'test1@gmail.com',
  role: 'APPLICANT',
  accountStatus: 'ACTIVE',
  mustChangePassword: false
};

const VIEWPORTS = [
  { width: 1920, height: 1080, name: '1920x1080' },
  { width: 1440, height: 900, name: '1440x900' },
  { width: 1280, height: 800, name: '1280x800' }
];

async function inspectComputedMetrics(page, pageName) {
  return await page.evaluate((name) => {
    const findings = [];
    const elements = Array.from(document.querySelectorAll('*'));

    elements.forEach((el) => {
      // skip invisible
      if (!el.offsetParent && el.tagName !== 'BODY' && el.tagName !== 'HTML') return;

      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const tagName = el.tagName.toLowerCase();
      const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
      const className = el.className ? String(el.className) : '';

      const fontSize = parseFloat(style.fontSize);
      const lineHeight = parseFloat(style.lineHeight) || fontSize;
      const height = rect.height;
      const width = rect.width;

      // 1. Text sizing checks
      // Badges with < 11px
      if (fontSize < 11 && text.length > 0 && !['svg', 'path'].includes(tagName)) {
        findings.push({
          category: 'Typography - Tiny Text',
          severity: 'Medium',
          element: tagName,
          className: className.slice(0, 80),
          text: text.slice(0, 40),
          metric: `fontSize: ${style.fontSize}`,
          description: `Text size ${style.fontSize} is smaller than minimum readable threshold (11px).`
        });
      }

      // Labels or paragraphs with < 13px
      if (['label', 'p', 'span'].includes(tagName) && fontSize < 12.5 && text.length > 0 && !className.includes('badge') && !className.includes('rounded-full')) {
        if (!findings.some(f => f.text === text.slice(0, 40))) {
          findings.push({
            category: 'Typography - Sub-13px Body/Label',
            severity: 'Low',
            element: tagName,
            className: className.slice(0, 80),
            text: text.slice(0, 40),
            metric: `fontSize: ${style.fontSize}`,
            description: `Element uses sub-13px font size (${style.fontSize}), which may be difficult for users to read comfortably.`
          });
        }
      }

      // 2. Buttons & Clickable touch targets
      if (tagName === 'button' || (tagName === 'a' && (className.includes('btn') || className.includes('button') || style.display === 'inline-flex'))) {
        if (height > 0 && height < 36 && text.length > 0) {
          findings.push({
            category: 'Touch Target - Small Button Height',
            severity: height < 32 ? 'High' : 'Medium',
            element: tagName,
            className: className.slice(0, 80),
            text: text.slice(0, 40),
            metric: `height: ${Math.round(height)}px, width: ${Math.round(width)}px, padding: ${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`,
            description: `Button height (${Math.round(height)}px) is under the 38-40px minimum standard for desktop/mobile accessibility.`
          });
        }
      }

      // 3. Form Inputs & Selects
      if (['input', 'select', 'textarea'].includes(tagName)) {
        if (height > 0 && height < 38 && tagName !== 'textarea') {
          findings.push({
            category: 'Form Control - Cramped Input Height',
            severity: 'Medium',
            element: `${tagName}#${el.id || el.name || 'unnamed'}`,
            className: className.slice(0, 80),
            metric: `height: ${Math.round(height)}px, padding: ${style.paddingTop} ${style.paddingLeft}`,
            description: `Form input has a height of ${Math.round(height)}px (under 38-42px standard).`
          });
        }
      }

      // 4. Badges / Chips
      if (className.includes('rounded-full') || className.includes('badge') || className.includes('StatusBadge')) {
        const padY = parseFloat(style.paddingTop);
        if (padY < 3 && height < 22) {
          findings.push({
            category: 'Badge - Micro Padding/Height',
            severity: 'Low',
            element: tagName,
            className: className.slice(0, 80),
            text: text.slice(0, 30),
            metric: `height: ${Math.round(height)}px, padding: ${style.paddingTop} ${style.paddingRight}`,
            description: `Badge has very tight vertical padding (${style.paddingTop}) and small height (${Math.round(height)}px).`
          });
        }
      }

      // 5. Overflow / Clipping
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
        if (!['html', 'body', 'table', 'tbody', 'pre', 'code', 'nav'].includes(tagName) && style.overflowX === 'visible') {
          findings.push({
            category: 'Layout - Potential Horizontal Overflow',
            severity: 'High',
            element: tagName,
            className: className.slice(0, 80),
            metric: `scrollWidth: ${el.scrollWidth}px > clientWidth: ${el.clientWidth}px`,
            description: `Element content overflows its parent bounding box without scrolling.`
          });
        }
      }
    });

    return {
      page: name,
      title: document.title,
      findingsCount: findings.length,
      findings: findings
    };
  }, pageName);
}

async function runComprehensiveAudit() {
  console.log('=== STARTING COMPLETE PLAYWRIGHT AUDIT (Sub-Agent 1) ===');
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const allAudits = [];

  // ==========================================
  // PART 1: PUBLIC AUTHENTICATION PAGES
  // ==========================================
  console.log('\n========================================');
  console.log('PART 1: PUBLIC AUTH PAGES AUDIT');
  console.log('========================================');

  const authContext = await browser.newContext();
  const authPage = await authContext.newPage();

  const authRoutes = [
    { id: 'login', name: 'LoginPage (/login)', url: '/login' },
    { id: 'register', name: 'RegisterPage (/register)', url: '/register' },
    { id: 'forgot-password', name: 'ForgotPasswordPage (/forgot-password)', url: '/forgot-password' },
    { id: 'reset-password-no-token', name: 'ResetPasswordPage Invalid/Missing Token (/reset-password)', url: '/reset-password' },
    { id: 'reset-password-valid-token', name: 'ResetPasswordPage With Token (/reset-password?token=mock_jwt_token)', url: '/reset-password?token=mock_jwt_token' },
    { id: 'setup-account-no-token', name: 'SetupAccountPage Invalid/Missing Token (/setup-account)', url: '/setup-account' },
    { id: 'setup-account-valid-token', name: 'SetupAccountPage With Token (/setup-account?token=mock_jwt_token)', url: '/setup-account?token=mock_jwt_token' },
    { id: 'change-password', name: 'ChangePasswordPage (/change-password)', url: '/change-password' }
  ];

  for (const vp of VIEWPORTS) {
    await authPage.setViewportSize({ width: vp.width, height: vp.height });
    console.log(`\n--- Auditing Auth Pages at ${vp.name} ---`);

    for (const route of authRoutes) {
      await authPage.goto(`${BASE_URL}${route.url}`, { waitUntil: 'networkidle' });
      await authPage.waitForTimeout(400);

      const shotPath = path.join(SCREENSHOTS_DIR, `subagent1-auth-${route.id}-${vp.name}.png`);
      await authPage.screenshot({ path: shotPath, fullPage: true });
      console.log(`Saved screenshot: ${shotPath}`);

      const metrics = await inspectComputedMetrics(authPage, `Auth: ${route.name} (${vp.name})`);
      allAudits.push(metrics);
    }
  }

  // Interactive Public Auth Form Error States (at 1440x900)
  await authPage.setViewportSize({ width: 1440, height: 900 });

  // 1. Login Form Validation Error state
  await authPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await authPage.click('button[type="submit"]');
  await authPage.waitForTimeout(400);
  await authPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'subagent1-auth-login-validation-errors-1440x900.png'), fullPage: true });
  allAudits.push(await inspectComputedMetrics(authPage, 'Auth: Login Form Validation Error'));

  // 2. Login Form Server Error state
  await authPage.fill('input[id="email"]', 'wronguser@example.com');
  await authPage.fill('input[id="password"]', 'WrongPassword123!');
  await authPage.click('button[type="submit"]');
  await authPage.waitForTimeout(1000);
  await authPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'subagent1-auth-login-server-error-1440x900.png'), fullPage: true });
  allAudits.push(await inspectComputedMetrics(authPage, 'Auth: Login Server Error Alert'));

  // 3. Register Form Validation Error state
  await authPage.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle' });
  await authPage.click('button[type="submit"]');
  await authPage.waitForTimeout(400);
  await authPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'subagent1-auth-register-validation-errors-1440x900.png'), fullPage: true });
  allAudits.push(await inspectComputedMetrics(authPage, 'Auth: Register Form Validation Errors'));

  // 4. Forgot Password Success state
  await authPage.goto(`${BASE_URL}/forgot-password`, { waitUntil: 'networkidle' });
  await authPage.fill('input[id="email"]', 'test1@gmail.com');
  await authPage.click('button[type="submit"]');
  await authPage.waitForTimeout(1200);
  await authPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'subagent1-auth-forgot-password-success-1440x900.png'), fullPage: true });
  allAudits.push(await inspectComputedMetrics(authPage, 'Auth: Forgot Password Dispatched Confirmation'));

  await authContext.close();

  // ==========================================
  // PART 2: APPLICANT EXPERIENCE AUDIT
  // ==========================================
  console.log('\n========================================');
  console.log('PART 2: APPLICANT EXPERIENCE AUDIT');
  console.log('========================================');

  const appCtx = await browser.newContext();

  // Pre-seed and preserve applicant auth state
  await appCtx.addInitScript(({ token, user }) => {
    localStorage.setItem('megs_access_token', token);
    localStorage.setItem('megs_user', JSON.stringify(user));
  }, { token: APPLICANT_TOKEN, user: APPLICANT_USER });

  const appPage = await appCtx.newPage();

  // Ensure requests carry the authorization header
  await appPage.route('**/api/**', async (route) => {
    const headers = route.request().headers();
    headers['authorization'] = `Bearer ${APPLICANT_TOKEN}`;
    route.continue({ headers });
  });

  // Log in via UI
  console.log('Logging in as applicant (test1@gmail.com)...');
  await appPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await appPage.fill('input[id="email"]', 'test1@gmail.com');
  await appPage.fill('input[id="password"]', '12345678');
  await appPage.click('button[type="submit"]');
  await appPage.waitForURL('**/app/**', { timeout: 10000 });
  await appPage.waitForTimeout(1000);
  console.log('Successfully arrived in Applicant Portal:', appPage.url());

  // Define Applicant Pages
  const applicantRoutes = [
    { id: 'dashboard', name: 'Applicant Dashboard (/app/dashboard)', url: '/app/dashboard' },
    { id: 'jobs', name: 'Applicant Browse Jobs (/app/jobs)', url: '/app/jobs' },
    { id: 'job-detail-68', name: 'Applicant Job Detail (/app/jobs/68)', url: '/app/jobs/68' },
    { id: 'applications', name: 'Applicant Applications Tracking (/app/applications)', url: '/app/applications' },
    { id: 'profile', name: 'Applicant Profile (/app/profile)', url: '/app/profile' }
  ];

  for (const vp of VIEWPORTS) {
    await appPage.setViewportSize({ width: vp.width, height: vp.height });
    console.log(`\n--- Auditing Applicant Pages at ${vp.name} ---`);

    for (const route of applicantRoutes) {
      await appPage.goto(`${BASE_URL}${route.url}`, { waitUntil: 'networkidle' });
      await appPage.waitForTimeout(800);

      const shotPath = path.join(SCREENSHOTS_DIR, `subagent1-applicant-${route.id}-${vp.name}.png`);
      await appPage.screenshot({ path: shotPath, fullPage: true });
      console.log(`Saved screenshot: ${shotPath}`);

      const metrics = await inspectComputedMetrics(appPage, `Applicant: ${route.name} (${vp.name})`);
      allAudits.push(metrics);
    }
  }

  // ==========================================
  // PART 3: ALL APPLICANT PROFILE TABS AUDIT
  // ==========================================
  console.log('\n========================================');
  console.log('PART 3: APPLICANT PROFILE SECTIONS & TABS');
  console.log('========================================');

  await appPage.setViewportSize({ width: 1440, height: 900 });
  await appPage.goto(`${BASE_URL}/app/profile`, { waitUntil: 'networkidle' });
  await appPage.waitForTimeout(800);

  const profileTabs = [
    { id: 'personal', name: 'Personal Details Section', selector: '[data-testid="tab-personal"]' },
    { id: 'resume', name: 'Resume & AI Consent Section', selector: '[data-testid="tab-resume"]' },
    { id: 'experience', name: 'Work Experience Section', selector: '[data-testid="tab-experience"]' },
    { id: 'education', name: 'Education History Section', selector: '[data-testid="tab-education"]' },
    { id: 'skills', name: 'Skills & Competencies Section', selector: '[data-testid="tab-skills"]' },
    { id: 'trainings', name: 'Certifications & Trainings Section', selector: '[data-testid="tab-trainings"]' },
    { id: 'references', name: 'Character References Section', selector: '[data-testid="tab-references"]' },
    { id: 'documents', name: 'Compliance Documents Section', selector: '[data-testid="tab-documents"]' }
  ];

  for (const tab of profileTabs) {
    console.log(`Auditing profile tab: ${tab.name}...`);
    const tabEl = appPage.locator(tab.selector);
    if (await tabEl.count() > 0) {
      await tabEl.click();
      await appPage.waitForTimeout(600);

      const shotPath = path.join(SCREENSHOTS_DIR, `subagent1-applicant-profile-tab-${tab.id}-1440x900.png`);
      await appPage.screenshot({ path: shotPath, fullPage: true });
      console.log(`Saved screenshot: ${shotPath}`);

      const metrics = await inspectComputedMetrics(appPage, `Applicant Profile: ${tab.name} (1440x900)`);
      allAudits.push(metrics);
    }
  }

  // ==========================================
  // PART 4: INTERACTIVE MODALS & DRAWERS
  // ==========================================
  console.log('\n========================================');
  console.log('PART 4: INTERACTIVE MODALS & DRAWERS');
  console.log('========================================');

  // 1. Job Detail Apply Modal
  await appPage.goto(`${BASE_URL}/app/jobs/68`, { waitUntil: 'networkidle' });
  await appPage.waitForTimeout(800);
  const applyBtn = appPage.locator('button:has-text("Apply for Position"), button:has-text("Apply Now")').first();
  if (await applyBtn.count() > 0) {
    await applyBtn.click();
    await appPage.waitForTimeout(600);
    const shotPath = path.join(SCREENSHOTS_DIR, 'subagent1-applicant-job-apply-modal-1440x900.png');
    await appPage.screenshot({ path: shotPath, fullPage: true });
    console.log(`Saved screenshot: ${shotPath}`);
    allAudits.push(await inspectComputedMetrics(appPage, 'Applicant Job Apply Modal (1440x900)'));

    // Close modal
    const closeBtn = appPage.locator('button[aria-label="Close"], button:has-text("Cancel")').first();
    if (await closeBtn.count() > 0) await closeBtn.click();
  }

  // 2. Profile Add Experience Dialog
  await appPage.goto(`${BASE_URL}/app/profile`, { waitUntil: 'networkidle' });
  await appPage.click('[data-testid="tab-experience"]');
  await appPage.waitForTimeout(500);
  const addExpBtn = appPage.locator('button:has-text("Add Experience"), button:has-text("Add Work Experience")').first();
  if (await addExpBtn.count() > 0) {
    await addExpBtn.click();
    await appPage.waitForTimeout(500);
    const shotPath = path.join(SCREENSHOTS_DIR, 'subagent1-applicant-profile-modal-add-experience-1440x900.png');
    await appPage.screenshot({ path: shotPath, fullPage: true });
    console.log(`Saved screenshot: ${shotPath}`);
    allAudits.push(await inspectComputedMetrics(appPage, 'Applicant Profile: Add Experience Modal'));
    const cancelBtn = appPage.locator('button:has-text("Cancel")').first();
    if (await cancelBtn.count() > 0) await cancelBtn.click();
  }

  // 3. Profile Add Education Dialog
  await appPage.click('[data-testid="tab-education"]');
  await appPage.waitForTimeout(500);
  const addEduBtn = appPage.locator('button:has-text("Add Education")').first();
  if (await addEduBtn.count() > 0) {
    await addEduBtn.click();
    await appPage.waitForTimeout(500);
    const shotPath = path.join(SCREENSHOTS_DIR, 'subagent1-applicant-profile-modal-add-education-1440x900.png');
    await appPage.screenshot({ path: shotPath, fullPage: true });
    console.log(`Saved screenshot: ${shotPath}`);
    allAudits.push(await inspectComputedMetrics(appPage, 'Applicant Profile: Add Education Modal'));
    const cancelBtn = appPage.locator('button:has-text("Cancel")').first();
    if (await cancelBtn.count() > 0) await cancelBtn.click();
  }

  // 4. Notification Bell Dropdown in Applicant Layout
  const notifBtn = appPage.locator('button[aria-label*="Notification" i], button[aria-label*="notification" i]').first();
  if (await notifBtn.count() > 0) {
    await notifBtn.click();
    await appPage.waitForTimeout(500);
    const shotPath = path.join(SCREENSHOTS_DIR, 'subagent1-applicant-layout-notifications-1440x900.png');
    await appPage.screenshot({ path: shotPath, fullPage: true });
    console.log(`Saved screenshot: ${shotPath}`);
    allAudits.push(await inspectComputedMetrics(appPage, 'Applicant Layout: Notification Popover'));
  }

  // Save audit findings to JSON file
  fs.writeFileSync(
    'c:/Users/cnico/OneDrive/Desktop/MEGS/frontend/audit-subagent1-results.json',
    JSON.stringify(allAudits, null, 2)
  );

  console.log('\n=== AUDIT COMPLETE! All screenshots and metrics saved successfully. ===');
  await browser.close();
}

runComprehensiveAudit().catch(err => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
