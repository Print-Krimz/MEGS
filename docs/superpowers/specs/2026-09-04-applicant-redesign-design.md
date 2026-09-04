# Applicant-Facing Experience Redesign Specification

**Date:** 2026-09-04  
**Target Audience:** Jobseekers / Candidates / Applicants  
**Design Reference:** Modern Philippine ATS & Job Boards (JobStreet PH by SEEK, Kalibrr, Bossjob, Indeed PH)

---

## 1. Overview & Goals

This specification details the comprehensive redesign of the applicant-facing side of the MEGS Recruitment Management System. The goal is to replace legacy corporate brochure styling and hardcoded dark-teal color schemes with a modern, warm, professional job marketplace and candidate workspace.

### Core Objectives:
1. **Applicant-First:** Shift focus from an internal administrative/corporate tone to an empowering candidate journey.
2. **Public Job Discovery:** Enable any visitor to search, filter, and inspect open job postings without mandatory login; prompt registration/sign-in seamlessly when applying.
3. **Warm Professional Identity:** Utilize modern Navy (`#0f2b5c`) and approachable Royal Blue (`#2563eb`) with warm slate neutrals and amber accents, eliminating legacy green/teal styling.
4. **HCI Excellence:** Adhere strictly to the MEGS 10-Point HCI guidelines: eliminate AI slop, avoid repetitive microcopy, enforce responsive layouts, and present clear 4-stage application pipelines (**Applied → Screening → Interview → Decision**).
5. **Component Reusability:** Build centralized, modular primitives (`JobCard`, `CompanyCard`, `FilterPanel`, `InvitationCard`, `ApplicationStatusStepper`).

---

## 2. Visual Palette & Design System Tokens

### 2.1 CSS Design Tokens (`frontend/src/index.css`)
```css
@theme {
  /* Brand Palette */
  --color-brand-primary: #0f2b5c;       /* Deep Authority Navy */
  --color-brand-primary-hover: #0a1f44;
  --color-brand-accent: #2563eb;        /* Approachable Action Blue */
  --color-brand-accent-hover: #1d4ed8;
  --color-brand-accent-light: #eff6ff;

  /* Surfaces & Canvas */
  --color-page: #f8fafc;               /* Warm Slate Neutral Canvas */
  --color-surface: #ffffff;            /* Pure White Card Surface */
  --color-surface-hover: #f1f5f9;
  --color-surface-active: #e2e8f0;

  /* Borders & Dividers */
  --color-border: #e2e8f0;
  --color-border-strong: #cbd5e1;
  --color-border-subtle: #f1f5f9;

  /* Typography */
  --color-text-primary: #0f172a;       /* Slate 900 for Titles & Headings */
  --color-text-secondary: #334155;     /* Slate 700 for Body */
  --color-text-muted: #64748b;         /* Slate 500 for Metadata & Captions */
  --color-text-inverse: #ffffff;

  /* Semantic Stages */
  --color-status-applied: #2563eb;
  --color-status-screening: #d97706;
  --color-status-interview: #6366f1;
  --color-status-decision: #059669;
  --color-status-urgent: #ea580c;

  /* Elevation & Geometry */
  --radius-sm: 0.375rem;               /* 6px */
  --radius-md: 0.5rem;                 /* 8px for buttons and inputs */
  --radius-lg: 0.75rem;                /* 12px for cards */
  --radius-xl: 1rem;                   /* 16px for dialogs and hero */

  --shadow-card: 0 1px 3px 0 rgb(15 23 42 / 0.05), 0 1px 2px -1px rgb(15 23 42 / 0.05);
  --shadow-card-hover: 0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.04);
  --shadow-dropdown: 0 10px 25px -5px rgb(15 23 42 / 0.1), 0 8px 10px -6px rgb(15 23 42 / 0.1);
  --shadow-modal: 0 20px 25px -5px rgb(15 23 42 / 0.1), 0 8px 10px -6px rgb(15 23 42 / 0.1);
}
```

---

## 3. Architecture & Shared Components

### 3.1 `JobCard` (`src/components/applicant/JobCard.tsx`)
A unified, responsive card used across the Landing Page, Dashboard, Search, and Saved Jobs.
- **Header:** Job Title (links to detail), Company Name, Verified Badge, Save/Bookmark icon button.
- **Metadata Ribbon:** Location (with pin), Work Setup (On-site / Hybrid / Remote), Employment Type (Full-time / Part-time / Contract).
- **Salary Display:** Prominently formatted currency (e.g. `₱30,000 – ₱45,000 / month`) or `Competitive Salary`.
- **Tags:** Top 2–3 skill pills in subdued slate styling.
- **Footer:** Relative posted date (`Posted 2 days ago`), "Applied" indicator if applicable, and "View Details" / "Apply" action.

### 3.2 `FilterPanel` (`src/components/applicant/FilterPanel.tsx`)
- **Desktop:** Sticky left sidebar with collapsible sections: Category/Department, Work Setup, Location (Valenzuela, QC, Laguna, Cavite, Cebu, Davao, Remote), and Employment Type.
- **Mobile:** Sticky bottom filter trigger showing active filter count, opening an accessible slide-up drawer with clear "Apply Filters" and "Reset All" buttons.

### 3.3 `InvitationCard` (`src/components/applicant/InvitationCard.tsx`)
- Contextual card displaying the invited job title, company, recruiter name, personalized recruiter message callout, and expiration date.
- One-click actions: "View Job Details", "Accept & Apply", and "Decline" (with modal prompt for feedback).
- Zero internal database IDs, retry counters, or technical terminology.

### 3.4 `ApplicationStatusStepper` (`src/components/applicant/ApplicationStatusStepper.tsx`)
- 4-stage pipeline: **Applied → Screening → Interview → Decision**.
- Accompanied by a contextual status box explaining the current next step in clear, human language.

### 3.5 `HeroSearch` & `CompanyCard`
- `HeroSearch`: Dual-input search widget (Keyword + Location) with quick tag suggestions.
- `CompanyCard`: Employer showcase card displaying company name, logo avatar, industry, active openings count, and location.

---

## 4. Screen-by-Screen Specifications

### 4.1 Public Landing Page (`/`)
1. **Navigation:** Modern header with MEGS logo, "Find Jobs", "Companies", "About Us", and auth buttons ("Sign In" outline, "Create Account" primary).
2. **Hero Section:**
   - Headline: *"Find the opportunity that fits you."*
   - Subheading: *"Connecting skilled Filipino talent with reputable employers across industrial, logistics, technical, and corporate sectors."*
   - `HeroSearch` bar with instant search submission.
   - Popular search tags: *Warehouse Supervisor, Industrial Electrician, Logistics Coordinator, Admin Assistant, React Developer*.
3. **Featured Jobs Section:**
   - Curated list/grid of open positions using `JobCard`.
   - Category filter pills for instant switching.
4. **Browse by Category:**
   - 6 visually distinct sector cards with open role counts.
5. **Featured Employers:**
   - Showcase cards of verified client partners.
6. **How It Works (3 Steps):**
   - 1. Search & Discover → 2. Apply in One Click → 3. Direct Placement & Onboarding.
7. **"Let Opportunities Find You" Recruiter Invitation Highlight:**
   - Explains automated profile matching and direct recruiter outreach.
8. **Final CTA & Clean Footer:**
   - Action banner prompting registration or job search.
   - Accessible footer with links, copyright, and DOLE agency transparency notice.

### 4.2 Authentication & Progressive Registration (`/login`, `/register`)
1. **Public Browsing to Guest-Apply Intercept:**
   - Open access to `/jobs` and `/jobs/:jobId`.
   - Unauthenticated visitors clicking "Apply" are prompted with a friendly modal to Register or Sign In with a return redirect parameter.
2. **Progressive 3-Step Registration (`/register`):**
   - **Step 1 (Account):** Email, Password, Confirm Password + 6-digit OTP verification with countdown timer.
   - **Step 2 (Profile Basics):** First Name, Last Name, Mobile Number (`+63`), Preferred Location.
   - **Step 3 (Resume):** Drag-and-drop PDF upload with instant parsing feedback, plus an explicit "Skip for now & browse jobs" option.
3. **Applicant-Friendly Login (`/login`):**
   - Clean slate-900 typography, accessible inputs, MFA challenge/setup modals, and direct links to register and password recovery.

### 4.3 Applicant Dashboard (`/app`)
Prioritizes items strictly in order of candidate needs:
1. **Job Search Bar:** Top search box for instant querying.
2. **Application Status Cards:** Overview metrics (Total, Under Review, Interviews, Placed) and recent active applications with the 4-stage stepper.
3. **Job Invitations:** Banner/card highlighting pending recruiter invitations.
4. **Recommended Jobs:** Personalized open positions matching the candidate's profile.
5. **Profile Strength Meter:** Completion progress with actionable tip to reach 100%.

### 4.4 Job Search & Job Details (`/app/jobs`, `/jobs`, `/jobs/:jobId`)
- Integrated desktop sidebar filters and mobile filter sheet.
- Segmented toggle between "All Openings" and "Saved Jobs".
- Job Details page includes comprehensive role overview, responsibilities, requirements, benefits, and modal application submission (supporting tailored resume upload or default profile resume).

### 4.5 My Applications & Invitations (`/app/applications`)
- Filter tabs: All, In Review, Interviews, Compliance & Contract, Deployed, and Job Invitations.
- Application detail view features scheduled interview details with time/location and compliance document upload checklist with verified status badges.
- Job Invitations tab features complete recruiter invitation cards with accept and decline workflows.

### 4.6 Candidate Profile (`/app/profile`)
Modular editable cards:
- **About Me:** Photo upload, legal identity, contact info, and professional summary.
- **Experience:** Chronological work history with add/edit/delete dialogs.
- **Education:** Educational background with degree, school, and dates.
- **Skills:** Interactive tag cloud with add/remove controls.
- **Certifications & Trainings:** Licenses and training credentials.
- **Resume on File:** Current PDF preview, download action, and replace resume upload.
- **Job Preferences:** Target roles, preferred work locations, and work setup availability.

---

## 5. Verification Plan

### 5.1 Automated Playwright Tests (`frontend/e2e/applicant-redesign-audit.spec.ts`)
- **Desktop (1280×800) & Mobile (390×844) Viewports:**
  - Verify Landing Page rendering and search functionality.
  - Verify public job browsing and guest-to-apply redirect modal.
  - Verify progressive registration stepper.
  - Verify Applicant Dashboard layout priority (1 to 5).
  - Verify Job Search sidebar (desktop) and bottom sheet (mobile).
  - Verify My Applications 4-stage pipeline stepper.
  - Verify Profile modular section editing.
  - Check zero occurrences of legacy `#0f766e` / `teal-700` colors and zero horizontal scroll overflow.

### 5.2 HCI Evaluation Checklist
- Full compliance with the MEGS 10-Point HCI Checklist: no AI slop, accessible WCAG 2.1 AA contrast, touch targets >= 44px, and plain natural language.
