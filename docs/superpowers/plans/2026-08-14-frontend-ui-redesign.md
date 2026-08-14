# Frontend UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the MEGS Recruitment System frontend into a readable, comfortable, consistent, and authoritative enterprise ATS interface by eliminating micro-typography, cramped row heights, diminutive controls, and weak visual hierarchy.

**Architecture:** A 6-phase foundation-up redesign leveraging Tailwind CSS v4 design tokens, standardizing font scale floor (minimum 14px body, 12px metadata), ergonomic 40px+ input/button primitives, spacious 56px table rows, high-contrast recruitment status badges, and comprehensive Playwright visual regression gates.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Lucide React, TanStack Query v5, Playwright.

## Global Constraints

- Never use `antigravity-design-expert`.
- Banned micro-typography: No `text-[10px]` or `text-[11px]` in body copy, table cells, or primary labels.
- Minimum font floor: 12px (`text-xs`) exclusively for small subtext/timestamps, 14px (`text-sm`) for standard body text and form labels.
- Touch/Control Targets: Form inputs minimum `h-10` (40px) height; primary buttons minimum `h-10` height.
- Tables: Cell padding minimum `py-4 px-5` (min row height 54–56px).
- Status Badges: Minimum 12px font size with `px-2.5 py-1` padding.
- No breaking changes to existing API client interfaces, TanStack query keys, or component props contracts.

---

## Phase 1: Global Design Foundation

### Task 1.1: Core Design Tokens, Typography Floor & Base CSS
**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/common/StatusBadge.tsx`
- Modify: `frontend/src/components/common/ScoreBadge.tsx`

**Interfaces:**
- Consumes: Tailwind v4 theme variables, CSS custom properties.
- Produces: Standardized typography scale classes, button/input base utility tokens, high-contrast status badge variants.

- [ ] **Step 1: Update `frontend/src/index.css` with calibrated typography scale, radius, and input tokens**
  - Establish base text color `#0F172A`, muted text `#64748B`, surface background `#F8FAFC`, card background `#FFFFFF`.
  - Add standard typography utility layers: `.form-label` (14px font-medium text-slate-700), `.input-base` (h-10 px-3.5 text-sm rounded-lg border-slate-300), `.btn-primary` (h-10 px-4 text-sm font-semibold rounded-lg).
- [ ] **Step 2: Refactor `StatusBadge.tsx` to eliminate micro-text (`text-[10px]`)**
  - Update `sizeClasses`:
    - `sm`: `text-xs px-2.5 py-0.5 gap-1.5 font-medium` (12px)
    - `md`: `text-xs px-3 py-1 gap-1.5 font-medium` (12px)
    - `lg`: `text-sm px-3.5 py-1.5 gap-2 font-semibold` (14px)
  - Update dot sizes: `sm`: `w-2 h-2`, `md`: `w-2 h-2`, `lg`: `w-2.5 h-2.5`.
  - Ensure high-contrast colors across all 25+ recruitment statuses.
- [ ] **Step 3: Refactor `ScoreBadge.tsx` for prominent candidate rating visibility**
  - Update badge sizing: minimum `text-xs font-bold px-2.5 py-1` with 16px icon.
- [ ] **Step 4: Run unit tests to verify component contract integrity**
  - Run `npm run test` in `frontend/`
- [ ] **Step 5: Commit Phase 1 Foundation changes**
  - `git commit -m "feat(ui): upgrade global design tokens, status badges, and typography scale"`

---

## Phase 2: Navigation & Layouts

### Task 2.1: Talent Acquisition Layout (`TALayout.tsx`)
**Files:**
- Modify: `frontend/src/layouts/TALayout.tsx`
- Modify: `frontend/src/components/common/PageHeader.tsx`
- Modify: `frontend/src/components/common/NotificationBell.tsx`

**Interfaces:**
- Consumes: Navigation items config, `useAuth`, `NotificationBell`.
- Produces: Spacious sidebar with 20px icons, 14px nav links, 32px user avatar, 14px breadcrumbs.

- [ ] **Step 1: Refactor `TALayout.tsx` navigation items and footer user pill**
  - Expand nav links to `px-3.5 py-2.5 text-sm font-medium rounded-lg gap-3` with `w-5 h-5` icons.
  - Active state: `bg-primary text-white font-semibold shadow-xs`.
  - Enlarge user avatar in sidebar footer to `w-8 h-8` with `text-sm` font, user email to `text-sm font-medium`, role label to `text-xs text-slate-500 font-medium`.
- [ ] **Step 2: Refactor `PageHeader.tsx` for authoritative hierarchy**
  - Increase page title to `text-2xl font-bold tracking-tight text-slate-900`.
  - Increase page description to `text-sm text-slate-600 leading-normal`.
  - Breadcrumbs: `text-sm font-medium text-slate-500 hover:text-slate-900`.
- [ ] **Step 3: Refactor `NotificationBell.tsx` popover dropdown**
  - Expand popover container width to `w-96 rounded-xl shadow-lg border-slate-200`.
  - Increase item padding to `p-4`, title to `text-sm font-semibold text-slate-900`, message preview to `text-xs text-slate-600 leading-relaxed`, timestamp to `text-xs text-slate-400 font-medium`.
- [ ] **Step 4: Test TALayout across viewports with Playwright**
  - Run Playwright test checking sidebar collapse, active indicators, and header elements.
- [ ] **Step 5: Commit Phase 2.1 changes**
  - `git commit -m "feat(ui): upgrade TALayout, PageHeader, and NotificationBell ergonomics"`

### Task 2.2: Admin & Applicant Layouts (`AdminLayout.tsx`, `ApplicantLayout.tsx`, `AuthLayout.tsx`)
**Files:**
- Modify: `frontend/src/layouts/AdminLayout.tsx`
- Modify: `frontend/src/layouts/ApplicantLayout.tsx`
- Modify: `frontend/src/layouts/AuthLayout.tsx`

**Interfaces:**
- Consumes: User auth context, role definitions.
- Produces: Consistent layout scaffolding across Admin, Applicant, and Public Auth surfaces.

- [ ] **Step 1: Refactor `AdminLayout.tsx` sidebar and header navigation**
  - Update nav links to `px-3.5 py-2.5 text-sm font-medium` with `w-5 h-5` icons.
  - Enlarge admin user pill to `w-8 h-8` avatar and `text-sm` email.
- [ ] **Step 2: Refactor `ApplicantLayout.tsx` top navbar**
  - Expand nav links to `px-3.5 py-2 text-sm font-medium` with clear active pill styling (`bg-teal-50 text-teal-800 font-semibold`).
  - Enlarge applicant avatar to `w-9 h-9` with `text-sm` name label.
- [ ] **Step 3: Refactor `AuthLayout.tsx` authentication container**
  - Expand card width to `max-w-lg` (or `max-w-2xl` for register), padding to `p-8 sm:p-10 rounded-2xl border-slate-200 shadow-subtle`.
  - Brand header icon: `w-12 h-12` with `text-xl` font.
- [ ] **Step 4: Commit Phase 2.2 changes**
  - `git commit -m "feat(ui): upgrade AdminLayout, ApplicantLayout, and AuthLayout containers"`

---

## Phase 3: Core Recruitment Pages

### Task 3.1: Talent Acquisition Dashboard (`TADashboardPage.tsx` & Components)
**Files:**
- Modify: `frontend/src/pages/ta/TADashboardPage.tsx`
- Modify: `frontend/src/pages/ta/components/PipelineSummaryBar.tsx`
- Modify: `frontend/src/pages/ta/components/ActionRequiredSection.tsx`
- Modify: `frontend/src/pages/ta/components/MRFTrackerCard.tsx`
- Modify: `frontend/src/pages/ta/components/ApplicationTable.tsx`

**Interfaces:**
- Consumes: `taApi.getPipelineStats`, `taApi.listApplications`, `taApi.listMRFs`.
- Produces: High-visibility KPI metric cards, readable pipeline stage stream, spacious candidate table.

- [ ] **Step 1: Refactor Top Metric Stat Cards in `TADashboardPage.tsx`**
  - Card padding: `p-6 rounded-xl border border-slate-200 bg-white shadow-xs`.
  - Metric numbers: `text-3xl font-bold font-mono text-slate-900`.
  - Stat label: `text-xs font-semibold uppercase tracking-wider text-slate-500`.
  - Subtext indicator: `text-xs font-medium text-teal-800 mt-1`.
  - Icon container: `p-3.5 rounded-lg shrink-0` with `w-6 h-6` icons.
- [ ] **Step 2: Refactor `PipelineSummaryBar.tsx`**
  - Expand stage boxes with `p-3.5`, 16px bold count typography, and 12px stage labels.
  - Thicken overall progress track to `h-2.5` with smooth rounded bars.
- [ ] **Step 3: Refactor `ActionRequiredSection.tsx`**
  - Alert cards: `p-4.5 rounded-xl border-l-4`, candidate title `text-sm font-bold text-slate-900`, stage badge `text-xs font-semibold`, timestamp `text-xs text-slate-500`.
  - Action buttons: `h-8.5 px-3.5 text-xs font-semibold rounded-lg`.
- [ ] **Step 4: Refactor `ApplicationTable.tsx` for high-volume candidate scanning**
  - Table header: `py-4 px-5 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80`.
  - Table rows: `py-4.5 px-5` cell padding.
  - Candidate Column: `w-10 h-10` avatar circle, candidate full name in `text-sm font-bold text-slate-900`, email in `text-xs text-slate-500`.
  - Position Column: `text-sm font-semibold text-slate-900`, location in `text-xs text-slate-500` with `w-3.5 h-3.5` pin icon.
  - AI Fit Score: `ScoreBadge` size="md" (`text-xs font-bold px-2.5 py-1`).
  - Action button: `h-8.5 px-3.5 text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg`.
- [ ] **Step 5: Visual inspection with Playwright on `/ta/dashboard`**
- [ ] **Step 6: Commit Phase 3.1 changes**
  - `git commit -m "feat(ui): redesign TA dashboard, KPI cards, and candidate application table"`

### Task 3.2: Applications Management & Candidate Dossier Detail (`TAApplicationsPage.tsx`, `TAApplicationDetailPage.tsx`)
**Files:**
- Modify: `frontend/src/pages/ta/TAApplicationsPage.tsx`
- Modify: `frontend/src/pages/ta/components/ApplicationFilters.tsx`
- Modify: `frontend/src/pages/ta/TAApplicationDetailPage.tsx`
- Modify: `frontend/src/pages/ta/components/CandidateSidebar.tsx`
- Modify: `frontend/src/pages/ta/components/StatusActionBar.tsx`
- Modify: `frontend/src/pages/ta/components/OverviewTab.tsx`
- Modify: `frontend/src/pages/ta/components/ResumeProfileTab.tsx`
- Modify: `frontend/src/components/common/PipelineIndicator.tsx`

**Interfaces:**
- Consumes: `taApi.getApplicationDetail`, candidate profile data, resume JSON.
- Produces: Robust candidate dossier with high-clarity status action triggers and widened candidate sidebar.

- [ ] **Step 1: Refactor `ApplicationFilters.tsx` in `TAApplicationsPage.tsx`**
  - Inputs: `h-10 px-3.5 text-sm rounded-lg border-slate-300`.
  - Stage filter pills: `px-3.5 py-2 text-sm font-medium rounded-lg` with `text-xs font-bold` count badges.
  - Reset filters & export buttons: `h-10 px-4 text-sm font-semibold`.
- [ ] **Step 2: Refactor `CandidateSidebar.tsx` in `TAApplicationDetailPage.tsx`**
  - Expand sidebar padding to `p-6`, candidate avatar to `w-16 h-16` with `text-lg` initials.
  - Candidate name: `text-lg font-bold text-slate-900`.
  - Contact items: `text-sm font-medium text-slate-700` with `w-4 h-4` icons.
  - Resume download button: `h-10 px-4 text-sm font-semibold w-full`.
- [ ] **Step 3: Refactor `StatusActionBar.tsx`**
  - Action buttons: `h-10 px-4 text-sm font-semibold rounded-lg` with high-contrast color coding.
  - Advance CTA: `bg-teal-700 hover:bg-teal-800 text-white shadow-sm`.
  - Reject / Backout CTA: `bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200`.
- [ ] **Step 4: Refactor `PipelineIndicator.tsx`**
  - Stage bubbles: `w-7 h-7` with `text-xs font-bold` stage numbers/icons.
  - Stage labels: `text-xs font-semibold text-slate-700` with clean wrapping.
- [ ] **Step 5: Refactor `OverviewTab.tsx` & `ResumeProfileTab.tsx`**
  - Skills pills: `text-xs font-medium px-3 py-1 bg-slate-100 text-slate-700 rounded-md`.
  - Experience / Education blocks: `p-5 rounded-xl border border-slate-200 bg-white`, titles in `text-base font-bold text-slate-900`, body copy in `text-sm text-slate-600 leading-relaxed`.
- [ ] **Step 6: Visual verification of Application Detail with Playwright**
- [ ] **Step 7: Commit Phase 3.2 changes**
  - `git commit -m "feat(ui): redesign application detail, candidate sidebar, and status action bar"`

### Task 3.3: Talent Pool Page (`TATalentPoolPage.tsx`)
**Files:**
- Modify: `frontend/src/pages/ta/TATalentPoolPage.tsx`

- [ ] **Step 1: Refactor talent pool cards & search controls**
  - Search/filter controls: `h-11 px-4 text-sm rounded-lg`.
  - Candidate cards: `p-6 rounded-xl border border-slate-200 bg-white shadow-xs`.
  - Candidate name: `text-base font-bold text-slate-900`, avatar `w-12 h-12`.
  - Skills chips: `text-xs font-medium px-2.5 py-1 rounded-md`.
  - AI score & availability badges: `text-xs font-semibold px-3 py-1`.
- [ ] **Step 2: Commit Phase 3.3 changes**
  - `git commit -m "feat(ui): upgrade talent pool cards, filter controls, and score badges"`

---

## Phase 4: Tables, Forms & Candidate Data

### Task 4.1: MRF Management & Job Postings (`TAMRFsPage.tsx`, `TAMRFDetailPage.tsx`, `TAJobsPage.tsx`, `TAJobDetailPage.tsx`, `TAClientsPage.tsx`, `TAClientDetailPage.tsx`)
**Files:**
- Modify: `frontend/src/pages/ta/TAMRFsPage.tsx`
- Modify: `frontend/src/pages/ta/TAMRFDetailPage.tsx`
- Modify: `frontend/src/pages/ta/TAJobsPage.tsx`
- Modify: `frontend/src/pages/ta/TAJobDetailPage.tsx`
- Modify: `frontend/src/pages/ta/TAClientsPage.tsx`
- Modify: `frontend/src/pages/ta/TAClientDetailPage.tsx`

- [ ] **Step 1: Refactor MRF List & Create MRF Modal (`TAMRFsPage.tsx`)**
  - Table rows: `py-4 px-5` cell padding.
  - Re-structure Create MRF Modal into clear 3-column or multi-section grid with `h-10 px-3.5 text-sm` inputs and `text-sm font-medium` labels.
- [ ] **Step 2: Refactor MRF Detail Page (`TAMRFDetailPage.tsx`)**
  - Quota progress bar: `h-3.5 rounded-full` with `text-sm font-bold` counter.
  - Salary range badge: `text-lg font-bold font-mono text-teal-800`.
  - Audit trail timeline: `py-3 px-4` with `text-xs font-mono` timestamps and `text-sm` actor names.
- [ ] **Step 3: Refactor Job Postings (`TAJobsPage.tsx`, `TAJobDetailPage.tsx`)**
  - Job title: `text-base font-semibold text-slate-900`.
  - Salary tags: `text-xs font-semibold px-3 py-1 bg-slate-100 text-slate-800`.
  - Create Job modal inputs: `h-10 px-3.5 text-sm`.
- [ ] **Step 4: Refactor Clients Directory & Detail (`TAClientsPage.tsx`, `TAClientDetailPage.tsx`)**
  - Company titles: `text-lg font-bold text-slate-900`.
  - Contact person & phone items: `text-sm text-slate-700` with `w-4 h-4` icons.
- [ ] **Step 5: Commit Phase 4.1 changes**
  - `git commit -m "feat(ui): upgrade MRF, Job Postings, and Client management interfaces"`

### Task 4.2: Interviews, Compliance, Deployments & Employees (`TAInterviewsPage.tsx`, `TACompliancePage.tsx`, `TADeploymentsPage.tsx`, `TAEmployeesPage.tsx`, `TAEmployeeDetailPage.tsx`)
**Files:**
- Modify: `frontend/src/pages/ta/TAInterviewsPage.tsx`
- Modify: `frontend/src/pages/ta/components/InterviewsTab.tsx`
- Modify: `frontend/src/pages/ta/TACompliancePage.tsx`
- Modify: `frontend/src/pages/ta/components/ComplianceTab.tsx`
- Modify: `frontend/src/pages/ta/TADeploymentsPage.tsx`
- Modify: `frontend/src/pages/ta/components/DeploymentTab.tsx`
- Modify: `frontend/src/pages/ta/TAEmployeesPage.tsx`
- Modify: `frontend/src/pages/ta/TAEmployeeDetailPage.tsx`

- [ ] **Step 1: Refactor Interviews Hub (`TAInterviewsPage.tsx`, `InterviewsTab.tsx`)**
  - Time slot badges: `text-xs font-mono font-semibold px-2.5 py-1`.
  - Rating score buttons: `w-10 h-10 text-sm font-bold` with smooth hover states.
  - Interviewer avatars: `w-7 h-7` with `text-xs` names.
- [ ] **Step 2: Refactor Compliance & Document Verification (`TACompliancePage.tsx`, `ComplianceTab.tsx`)**
  - Document rows: `py-4 px-5` cell padding.
  - Verification badges: `text-xs font-medium px-3 py-1`.
  - Verification action buttons: `h-9 px-3.5 text-xs font-semibold`.
- [ ] **Step 3: Refactor Deployments & Onboarding Tracker (`TADeploymentsPage.tsx`, `DeploymentTab.tsx`)**
  - Deployment cards: `p-5 rounded-xl border border-slate-200 bg-white`.
  - Onboarding checklist checkboxes: `w-5 h-5` with `text-sm font-medium` labels.
- [ ] **Step 4: Refactor Employees Directory & Detail (`TAEmployeesPage.tsx`, `TAEmployeeDetailPage.tsx`)**
  - Employee table rows: `py-4 px-5` cell padding.
  - Government ID blocks: `p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono`.
- [ ] **Step 5: Commit Phase 4.2 changes**
  - `git commit -m "feat(ui): upgrade interviews, compliance checklist, deployments, and employee roster"`

### Task 4.3: Applicant Profile & Applicant Pages (`ApplicantProfilePage.tsx` & 8 Components, `ApplicantDashboardPage.tsx`, `ApplicantJobsPage.tsx`, `ApplicantJobDetailPage.tsx`, `ApplicantApplicationsPage.tsx`, `ApplicantApplicationDetailPage.tsx`)
**Files:**
- Modify: `frontend/src/pages/applicant/ApplicantProfilePage.tsx`
- Modify: `frontend/src/pages/applicant/components/PersonalInfoSection.tsx`
- Modify: `frontend/src/pages/applicant/components/ResumeSection.tsx`
- Modify: `frontend/src/pages/applicant/components/WorkExperienceSection.tsx`
- Modify: `frontend/src/pages/applicant/components/EducationSection.tsx`
- Modify: `frontend/src/pages/applicant/components/SkillsSection.tsx`
- Modify: `frontend/src/pages/applicant/components/TrainingsSection.tsx`
- Modify: `frontend/src/pages/applicant/components/ReferencesSection.tsx`
- Modify: `frontend/src/pages/applicant/components/AssetsSection.tsx`
- Modify: `frontend/src/pages/applicant/ApplicantDashboardPage.tsx`
- Modify: `frontend/src/pages/applicant/ApplicantJobsPage.tsx`
- Modify: `frontend/src/pages/applicant/ApplicantJobDetailPage.tsx`
- Modify: `frontend/src/pages/applicant/ApplicantApplicationsPage.tsx`
- Modify: `frontend/src/pages/applicant/ApplicantApplicationDetailPage.tsx`

- [ ] **Step 1: Refactor `ApplicantProfilePage.tsx` tab strip and form fields**
  - Profile tabs: `text-sm font-medium px-4 py-3 rounded-lg` with `text-xs font-bold` count badges.
  - Form labels across all 8 subcomponents: `text-sm font-medium text-slate-700 mb-1.5`.
  - Form inputs: `h-10 px-3.5 text-sm rounded-lg border-slate-300`.
  - Statutory ID grid: Clean 2-column or 4-column layout with `font-mono text-sm` inputs.
- [ ] **Step 2: Refactor Applicant Dashboard & Job Browsing (`ApplicantDashboardPage.tsx`, `ApplicantJobsPage.tsx`, `ApplicantJobDetailPage.tsx`)**
  - Job cards: `p-6 rounded-xl border border-slate-200 bg-white`, title `text-base font-bold text-slate-900`, salary tag `text-xs font-semibold px-3 py-1 bg-teal-50 text-teal-800`.
  - Job description prose: `text-sm sm:text-base text-slate-700 leading-relaxed max-w-prose`.
  - Primary "Apply Now" button: `h-11 px-6 text-base font-bold bg-teal-700 text-white rounded-lg`.
- [ ] **Step 3: Refactor Applicant Applications List & Detail (`ApplicantApplicationsPage.tsx`, `ApplicantApplicationDetailPage.tsx`)**
  - Application cards: `p-6 rounded-xl border border-slate-200 bg-white`, status badge `size="md"`.
  - Pipeline progress stepper: `w-8 h-8` milestone circles with `text-xs font-semibold` labels.
- [ ] **Step 4: Commit Phase 4.3 changes**
  - `git commit -m "feat(ui): redesign applicant profile, job browsing, and application tracker"`

---

## Phase 5: Modals, States & Secondary Pages

### Task 5.1: Administrator Pages (`AdminDashboardPage.tsx`, `AdminUsersPage.tsx`, `AdminScoringPage.tsx`, `AdminAuditLogsPage.tsx`, `TAAnalyticsPage.tsx`)
**Files:**
- Modify: `frontend/src/pages/admin/AdminDashboardPage.tsx`
- Modify: `frontend/src/pages/admin/AdminUsersPage.tsx`
- Modify: `frontend/src/pages/admin/AdminScoringPage.tsx`
- Modify: `frontend/src/pages/admin/AdminAuditLogsPage.tsx`
- Modify: `frontend/src/pages/ta/TAAnalyticsPage.tsx`

- [ ] **Step 1: Refactor `AdminDashboardPage.tsx` KPI cards & system stream**
  - KPI numbers: `text-3xl font-bold font-mono text-slate-900`.
  - System activity stream: `py-4 px-5` row padding with `text-xs font-mono` timestamps.
- [ ] **Step 2: Refactor `AdminUsersPage.tsx` table & Create/Edit User modal**
  - User table rows: `py-4 px-5` cell padding.
  - Role badges: `text-xs font-medium px-2.5 py-1 rounded-md`.
  - Create User modal: `h-10 px-3.5 text-sm` inputs, `text-sm font-medium` labels, `h-6 w-11` switch controls.
- [ ] **Step 3: Refactor `AdminScoringPage.tsx` AI rubric sliders & test sandbox**
  - Sliders: `h-2.5` track height with `w-5 h-5` thumb.
  - Percentage callouts: `text-lg font-bold font-mono text-teal-800`.
  - Test sandbox cards: `p-5` container padding with clear score badges.
- [ ] **Step 4: Refactor `AdminAuditLogsPage.tsx` & JSON payload viewer**
  - Table cells: `py-4 px-5` with `text-sm` actor names and `text-xs font-mono` timestamps.
  - JSON payload drawer: Syntax-formatted viewer at `text-xs font-mono leading-normal` with `p-4` surface.
- [ ] **Step 5: Refactor `TAAnalyticsPage.tsx`**
  - Funnel bars: `h-6` or `h-8` with `text-xs font-bold` conversion percentages.
  - Leaderboard table: `py-3.5 px-4` with `text-sm` primary data.
- [ ] **Step 6: Commit Phase 5.1 changes**
  - `git commit -m "feat(ui): redesign Admin dashboard, users table, AI scoring sliders, audit logs, and analytics"`

### Task 5.2: Public Auth Pages & Shared Dialogs / States
**Files:**
- Modify: `frontend/src/pages/auth/LoginPage.tsx`
- Modify: `frontend/src/pages/auth/RegisterPage.tsx`
- Modify: `frontend/src/pages/auth/ForgotPasswordPage.tsx`
- Modify: `frontend/src/pages/auth/ResetPasswordPage.tsx`
- Modify: `frontend/src/pages/auth/SetupAccountPage.tsx`
- Modify: `frontend/src/pages/auth/ChangePasswordPage.tsx`
- Modify: `frontend/src/pages/common/ForbiddenPage.tsx`
- Modify: `frontend/src/pages/common/NotFoundPage.tsx`
- Modify: `frontend/src/components/common/ConfirmDialog.tsx`
- Modify: `frontend/src/components/common/EmptyState.tsx`
- Modify: `frontend/src/components/common/ErrorState.tsx`
- Modify: `frontend/src/components/common/LoadingState.tsx`

- [ ] **Step 1: Refactor all Auth pages (`LoginPage.tsx`, `RegisterPage.tsx`, etc.)**
  - Form labels: `text-sm font-medium text-slate-700 mb-1.5`.
  - Inputs: `h-11 px-3.5 text-sm rounded-lg border-slate-300`.
  - Primary Submit CTAs: `h-11 text-base font-semibold rounded-lg bg-teal-700 text-white`.
  - Password strength bars: `h-2 rounded-full`.
- [ ] **Step 2: Refactor Error pages (`ForbiddenPage.tsx`, `NotFoundPage.tsx`)**
  - Professional error cards with prominent action buttons and structured status badges.
- [ ] **Step 3: Refactor Shared States (`ConfirmDialog.tsx`, `EmptyState.tsx`, `ErrorState.tsx`, `LoadingState.tsx`)**
  - ConfirmDialog: `h-10 px-4 text-sm font-semibold` action buttons.
  - EmptyState: `p-8` with 20px icon containers and `text-sm` descriptions.
- [ ] **Step 4: Commit Phase 5.2 changes**
  - `git commit -m "feat(ui): upgrade auth pages, error states, and confirmation dialogs"`

---

## Phase 6: Playwright Visual Verification & Polish

### Task 6.1: Automated Playwright Visual Inspection Suite
**Files:**
- Create: `frontend/tests/visual-ui-audit.spec.ts`

- [ ] **Step 1: Write Playwright regression test script covering all pages across 1920x1080, 1440x900, 1280x800**
  - Verify minimum button height >= 38px.
  - Verify minimum input height >= 40px.
  - Verify minimum font size for body and table cells >= 13px.
  - Verify table row padding >= 14px.
  - Verify status badge font size >= 12px.
- [ ] **Step 2: Run Playwright test suite against local dev server**
  - Run: `npx playwright test tests/visual-ui-audit.spec.ts`
- [ ] **Step 3: Capture full-suite after screenshots and verify zero layout clipping or horizontal scrolling**
- [ ] **Step 4: Commit Phase 6 verification tests**
  - `git commit -m "test(ui): add comprehensive Playwright UI/UX visual validation test suite"`

---

## Retesting Matrix (Post-Phase Visual Verification)

| Phase | Pages to Visually Re-test via Playwright |
| :--- | :--- |
| **Phase 1** | Any page rendering `StatusBadge`, `ScoreBadge` (e.g. `/ta/dashboard`, `/ta/applications`) |
| **Phase 2** | `TALayout` (`/ta/dashboard`), `AdminLayout` (`/admin/dashboard`), `ApplicantLayout` (`/app/dashboard`), `/login` |
| **Phase 3** | `/ta/dashboard`, `/ta/applications`, `/ta/applications/:id`, `/ta/talent-pool` |
| **Phase 4** | `/ta/mrfs`, `/ta/mrfs/:id`, `/ta/jobs`, `/ta/interviews`, `/ta/compliance`, `/ta/deployments`, `/app/profile`, `/app/jobs` |
| **Phase 5** | `/admin/users`, `/admin/scoring`, `/admin/audit-logs`, `/ta/analytics`, `/login`, `/register`, `/forbidden`, `/404` |
| **Phase 6** | Full regression pass across all 25+ routes on 1920x1080, 1440x900, 1280x800 |
