# MEGS Applicant Portal Redesign Design Specification

## 1. Overview & Objectives

Following the successful redesign of the MEGS Landing, Login, and Register pages, this document specifies the redesign of the **MEGS Applicant Portal (`/app`)**. 

The goal is to elevate the candidate experience to match industry leaders in the Philippines (**JobStreet Philippines**, **Bossjob**, and **Kalibrr**) by applying:
- An authoritative, utilitarian **Navy Blue recruitment design system** (`#0F294A` primary, `#163B66` hover, `#07192F` dark navy, `#F8FAFC` slate-50 surfaces).
- Transparent, linear application milestone tracking (JobStreet style).
- Rapid digital resume readiness scoring and job invitations workflows (Bossjob & Kalibrr style).
- Strict adherence to the **10-Point HCI Usability Framework** and anti-AI-slop visual restraint (0 sparkles, 0 glassmorphism blurs, 0 decorative heading icons, no technical jargon).

---

## 2. Page-by-Page Specifications

### 2.1 Shell & Navigation (`ApplicantLayout.tsx`)
- **Header Structure:**
  - **Brand & Agency Identity:** Bold `MEGS` wordmark with subtitle `Recruitment & Manpower Services`, linking to `/app`.
  - **Primary Navigation Links:**
    - `Dashboard` (`/app`)
    - `Explore Jobs` (`/app/jobs`)
    - `My Applications` (`/app/applications`)
    - Active state: `#0F294A` text with subtle border-b or pill highlight; hover state: `#163B66`.
  - **Action Controls:**
    - Real-time notification bell with red badge counter.
    - Candidate Account Menu trigger displaying candidate initials avatar, full name, and chevron.
    - Dropdown menu options:
      - Profile Strength % (quick jump to `/app/profile`)
      - Edit Profile (`/app/profile`)
      - Account Security (`/change-password` or modal)
      - Sign Out (triggers accessible confirmation dialog)
- **Mobile Navigation:**
  - Responsive header with hamburger drawer.
  - Touch targets $\ge 44 \times 44\text{ px}$.
  - Zero horizontal overflow across mobile viewports ($375\text{ px}$).

---

### 2.2 Applicant Dashboard (`ApplicantDashboard.tsx`)
- **Header & Greeting:**
  - Time-based greeting (*"Good morning / afternoon / evening, [First Name]"*).
  - Subtitle: *"Track your application milestones and discover new opportunities."*
  - Quick action buttons: *"Browse Jobs"* and *"Update Profile"*.
- **Digital Resume Readiness Card (Bossjob & Kalibrr style):**
  - Displays computed readiness percentage via `computeProfileHealth(profile)`.
  - Color-coded progress bar (Navy Blue `#0F294A`).
  - Next-action prompt (e.g. *"Add skills and work experience to reach 100% readiness"*).
- **High-Priority Job Invitations Banner:**
  - Displays when Talent Acquisition has sent a direct job invitation (`pendingInvitations.length > 0`).
  - Highlights matched role and 1-click button to *"Review Invitations (:count)"*.
- **4 Operational Metric Tiles:**
  1. **Total Applications:** Count of all applications submitted.
  2. **In Review:** Active applications in screening/review.
  3. **Interviews:** Applications with scheduled interviews or client endorsements.
  4. **Placed:** Applications in deployed status.
- **Recent Applications Quick-Tracker:**
  - Displays top 3–5 applications in high-clarity cards.
  - JobStreet-style linear milestones:
    `Applied` $\to$ `Under Review` $\to$ `Interview` $\to$ `Requirements & Contract` $\to$ `Deployed`.
  - One-click button to view full application details.
- **Recommended Openings Preview:**
  - Displays 3–4 active job postings fetched from `/api/applicant-jobs/jobs`.
  - Shows title, verified client employer, location, and 1-click view/apply button.

---

### 2.3 Explore & Saved Jobs (`JobsPage.tsx` & `JobDetailPage.tsx`)
- **Header & Search Bar:**
  - Prominent search input (job title, skill, or keyword) matching the public landing page hero search.
  - Scope toggle: **All Openings (:count)** vs. **Saved Jobs (:count)** with bookmark icon.
  - Granular Philippine Location Filter: *Valenzuela (HQ)*, *Quezon City*, *Laguna*, *Batangas*, *Cavite*, *Cebu*, *Davao*, *Metro Manila*.
- **Job Cards Grid:**
  - Modern card styling with subtle `#E2E8F0` border and soft shadow.
  - Verified employer badge (*Star Meg*, *Global Freight Corp*, *Apex Retail Distribution*).
  - Location, employment type tag, posting date.
  - Bookmark toggle button with clear `aria-label`.
  - Primary button: *"View Details & Apply"* in Navy Blue (`#0F294A`).
- **Job Detail Page (`JobDetailPage.tsx`):**
  - Detailed overview of responsibilities, qualifications, and employment terms.
  - Sticky action card on desktop with 1-click apply, bookmark button, and DOLE recruitment safety guarantee.
  - One-click Apply Modal: allows applying with current profile or uploading an updated resume (PDF/DOCX $\le 5\text{ MB}$).

---

### 2.4 My Applications & Job Invitations (`MyApplicationsPage.tsx` & `ApplicationDetailPage.tsx`)
- **Status Filter Tabs:**
  - *All Applications*, *In Review*, *Interviews*, *Requirements & Contract*, *Deployed*, and *Job Invitations (:pendingCount)*.
- **Milestone Timeline Tracker:**
  - Clear visual progress indicator showing the exact status and next expected milestone.
- **Job Invitations Workflow:**
  - Accept modal: 1-click confirmation with optional note to talent acquisition.
  - Decline modal: friendly dropdown for reason (*Salary mismatch*, *Currently employed*, *Commute/Location*, *Not interested*, *Other*).
- **Application Detail & 201 Compliance Upload (`ApplicationDetailPage.tsx`):**
  - Section for pre-employment compliance items (Medical exam, NBI clearance, SSS, PhilHealth, Pag-IBIG).
  - File upload with instant 5MB validation and status chips (*Pending Upload*, *Under Review*, *Approved*).

---

### 2.5 Profile Alignment (`ProfilePage.tsx` & subcomponents)
- Eliminate all legacy teal tokens (`bg-teal-700`, `ring-teal-700`, `border-teal-800`), replacing them with Navy Blue tokens (`#0F294A`, `#163B66`).
- Update `ProfileOverview`, `ProfileSectionNav`, `SkillsSection`, and `ProfileHealthMeter` for visual consistency.

---

## 3. 10-Point HCI Review Standards

1. **Understandability:** Candidates immediately know where their applications stand and what steps are required.
2. **Zero Duplication:** No redundant button descriptions or duplicated headings.
3. **Plain Language:** Candidate-friendly phrasing (*"Under review by recruiter"* instead of technical status strings).
4. **Smart Automation:** Profile health dynamically calculates; invitations convert to applications with 1 click.
5. **Consistency:** Unified Navy Blue theme across all applicant pages.
6. **Anti-Slop:** 0 sparkles, 0 blurs, 0 decorative icons beside headings.
7. **Next-Step Clarity:** Explicit next action buttons (*"Upload NBI Clearance"*, *"Confirm Interview"*).
8. **Error Recovery:** Forgiving input forms with inline validation.
9. **Task-Based Hierarchy:** Primary focus on active applications, invitations, and job search.
10. **Purpose-Built Design:** Authentic DOLE-licensed operational agency styling.

---

## 4. Verification & Testing Plan

1. **Unit Testing:**
   - Execute all Vitest unit tests under `src/pages/applicant`.
   - Command: `npx vitest run src/pages/applicant`
2. **Build Verification:**
   - Command: `npm run build` in `frontend` (`tsc -b && vite build`)
3. **Playwright E2E Audit (`frontend/e2e/applicant-portal-redesign.spec.ts`):**
   - Test across Desktop (`1280x800`) and Mobile (`375x812`) viewports.
   - Assert touch targets $\ge 44 \times 44\text{ px}$.
   - Assert zero horizontal overflow.
   - Assert 0 `lucide-sparkles` instances.
   - Capture desktop and mobile screenshots for visual evidence.
