# MEGS Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the phased overhaul of the MEGS frontend UI from "AI-slop" to the "Industrial Utilitarian" design specified in `frontend-ui-design.md`.

**Architecture:** We will systematically override Tailwind CSS variables, restructure base UI components to eliminate shadows/rounding, and refactor page layouts to favor dense tabular data over floating cards.

**Tech Stack:** React 19, Vite, Tailwind CSS v4.

## Global Constraints

*   Quality over speed. Preserve working functionality.
*   Do not break backend/API contracts.
*   The design specification (`frontend-ui-design.md`) must be referenced during every implementation phase.
*   All changes must be verified using the existing Playwright audit scripts.

---

## Phase 1: Foundation & Theming

**Goal:** Enforce the new global design tokens and remove rounding/shadows globally.

*   [ ] **Step 1: Update `src/index.css`**
    *   Set all `--radius-*` variables to `0`.
    *   Remove shadow values from `--shadow-*` variables and replace their utility with border definitions where applicable, or set to `none`.
    *   Ensure base text colors are high contrast.
*   [ ] **Step 2: Update Layout Shells**
    *   Refactor `src/layouts/TALayout.tsx`, `AdminLayout.tsx`, and `ApplicantLayout.tsx` to remove any overarching container padding/shadows that create a "floating" app effect. Use a full-bleed structure.

## Phase 2: Primitive Components Refactor

**Goal:** Update all shared UI components to match the clinical, sharp aesthetic.

*   [ ] **Step 1: Refactor `Button` component**
    *   Remove any `rounded-*` classes. Ensure sharp borders and high-contrast hover states.
*   [ ] **Step 2: Refactor `StatusBadge` & `ScoreBadge`**
    *   Remove `rounded-full` or pill shapes. Make them sharp, rectangular boxes with uppercase mono font text.
*   [ ] **Step 3: Refactor Forms/Inputs**
    *   Remove rounding on text inputs. Ensure strong 1px borders (`border-slate-300`).
*   [ ] **Step 4: Refactor `PageHeader`**
    *   Remove unnecessary whitespace. Make it a compact, bordered top bar.

## Phase 3: Dashboard & Layout Demolition (The Bento-Grid Purge)

**Goal:** Overhaul the most offending "AI-slop" pages, specifically the TA Dashboard and Analytics.

*   [ ] **Step 1: Rewrite `src/pages/ta/TADashboard.tsx`**
    *   Remove the 4x4 card grid.
    *   Implement a tight top-bar ribbon for the 4 core metrics.
    *   Convert the "Recent Applications" queue into a full-width, dense HTML/TanStack table without card wrappers.
    *   Remove the "Recruitment Funnel Progression" bento cards and convert to a compact horizontal summary bar.
*   [ ] **Step 2: Rewrite `src/pages/ta/AnalyticsPage.tsx`**
    *   Remove floating chart containers. Use a split-pane or border-separated grid that feels like a unified control panel.

## Phase 4: Candidate & Admin Portal Polish

**Goal:** Bring the Applicant and Admin views in line with the new aesthetic.

*   [ ] **Step 1: Update Applicant Profile (`/app/profile`)**
    *   Convert the floating profile card into a structural page flow with distinct, bordered sections (Personal Info, Resume, 201 Files).
*   [ ] **Step 2: Update Admin Config (`/admin/scoring`)**
    *   Strip out decorative cards around the AI weights. Present them as a clinical list of sliders/inputs.

## Phase 5: Final Playwright Verification

*   [ ] **Step 1: Run Playwright Test Suites**
    *   Execute the existing `audit-ta.mjs`, `audit-admin.mjs`, and `audit-auth-and-security.mjs` to ensure no buttons, forms, or routing were broken by the DOM changes.
    *   Fix any broken locators (if class changes affected tests, though tests should ideally target roles/text).
