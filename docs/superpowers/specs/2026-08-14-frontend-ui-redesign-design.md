# MEGS Recruitment System Frontend UI/UX Redesign Specification

**Date:** 2026-08-14  
**Author:** Antigravity AI  
**Scope:** Frontend UI/UX Architecture, Typography Scale, Component Ergonomics & Visual Polish  
**Target:** Professional Recruitment Agency / Enterprise ATS Interface  

---

## 1. Problem Statement & Executive Summary

The MEGS recruitment system frontend exhibits pervasive **micro-typography, compressed row heights, diminutive form controls, cramped cards, and weak visual hierarchy**. 

Through parallel Playwright browser audits across 1920x1080, 1440x900, and 1280x800 viewports, the following systemic defects were confirmed:
1. **Micro-Typography:** Over 60% of visible text elements use `text-[10px]`, `text-[11px]`, or `text-xs` (12px), including vital data such as candidate names, salary ranges, statutory IDs, timestamps, and table headers.
2. **Diminutive Controls:** Buttons and form inputs frequently measure `h-7` to `h-8.5` (28–34px) with tiny icon targets (`w-3.5 h-3.5`), increasing motor strain and misclick risk.
3. **Cramped Tables & Lists:** Table rows use tight padding (`py-2.5` to `py-3.5`) with tiny status badges (`text-[10px]`), making rapid candidate scanning exhausting for recruiters working 8+ hours daily.
4. **Weak Information Hierarchy:** Page headers, card titles, and section headers are often sized identically (`text-sm` or `text-base`), diminishing visual scan paths.
5. **Over-nested, Narrow Cards:** Container widths and modal dialogs are overly constrained, forcing multi-column forms into tight grids with 6px–8px gaps.

The goal of this redesign is to establish a **restrained, authoritative, highly readable, and comfortable enterprise ATS interface** tailored for staffing specialists, recruiters, candidates, and system administrators.

---

## 2. Professional Recruitment ATS Design System

### 2.1 Color Palette & Neutrals
* **Primary (Brand Teal):** `hsl(175, 84%, 28%)` (#0c6b64) — Authoritative, professional, high-contrast against white.
* **Primary Hover:** `hsl(175, 90%, 22%)` (#074e49).
* **Primary Light Surface:** `hsl(166, 76%, 95%)` (#e6f7f5).
* **Background Neutrals:**
  * App Background: `#F8FAFC` (Slate-50)
  * Card Surfaces: `#FFFFFF` (Pure White with 1px `border-slate-200/80` and subtle elevation `shadow-[0_1px_3px_rgba(0,0,0,0.05)]`)
  * Elevated Menus & Popovers: `#FFFFFF` with `shadow-[0_10px_25px_-5px_rgba(0,0,0,0.08)]`
* **Typography Colors:**
  * Primary Text (Headings/Data): `#0F172A` (Slate-900) — WCAG AAA contrast
  * Secondary Text (Labels/Body): `#334155` (Slate-700) — WCAG AAA contrast
  * Muted Text (Subtitles/Timestamps): `#64748B` (Slate-500) — 4.6:1 WCAG AA contrast
  * Borders & Dividers: `#E2E8F0` (Slate-200)

### 2.2 Typography Scale
* **Display / Hero Titles:** `text-2xl sm:text-3xl font-bold tracking-tight text-slate-900` (28px/36px)
* **Page Titles:** `text-xl sm:text-2xl font-bold tracking-tight text-slate-900` (22px/28px)
* **Section / Card Headers:** `text-base sm:text-lg font-semibold text-slate-900` (16px/18px)
* **Card Sub-headers / Group Labels:** `text-sm font-semibold text-slate-800` (14px)
* **Form Field Labels:** `text-sm font-medium text-slate-700 mb-1.5` (14px) — **Banned: `text-xs` for primary field labels**
* **Standard Body & Table Data:** `text-sm text-slate-700 leading-normal` (14px) — **Banned: `text-xs` for primary candidate names & position titles**
* **Secondary Metadata / Subtext:** `text-xs text-slate-500` (12px) — **Banned: `text-[10px]` & `text-[11px]` across all body copy**
* **Badge Typography:**
  * Badge `sm`: `text-xs font-semibold px-2.5 py-0.5` (12px)
  * Badge `md`: `text-xs font-semibold px-3 py-1` (12px)
  * Badge `lg`: `text-sm font-semibold px-3.5 py-1.5` (14px)

### 2.3 Component Sizing & Touch Targets
* **Standard Inputs & Selects:** `h-10 px-3.5 text-sm rounded-lg border-slate-300 focus:ring-2 focus:ring-teal-600 focus:border-teal-600` (40px height)
* **Large Inputs (Search / Filter bars):** `h-11 px-4 text-sm rounded-lg` (44px height)
* **Primary / Secondary Action Buttons:** `h-10 px-4 text-sm font-semibold rounded-lg` (40px height)
* **Table Action Buttons:** `h-8.5 px-3 text-xs font-semibold rounded-lg` (34px height)
* **Icon Buttons:** Minimum `w-9 h-9` with `w-4.5 h-4.5` icon
* **Sidebar Navigation Items:** `px-3.5 py-2.5 text-sm font-medium rounded-lg gap-3` with `w-5 h-5` icons
* **Table Cell Padding:** `py-4 px-5` (min row height 56px)

### 2.4 Semantic Recruitment Status Badges
Ensure high-contrast, professional status styling with clear color coding:
* `SUBMITTED`: Indigo (`bg-indigo-50 text-indigo-700 border-indigo-200`)
* `PARSING`: Violet (`bg-purple-50 text-purple-700 border-purple-200`)
* `REVIEW`: Amber (`bg-amber-50 text-amber-800 border-amber-200`)
* `NEEDS_ATTENTION` / `BACKOUT`: Rose/Red (`bg-rose-50 text-rose-700 border-rose-200`)
* `MATCHED` / `INITIAL_SCREENING`: Blue (`bg-blue-50 text-blue-700 border-blue-200`)
* `TALENT_POOL`: Cyan (`bg-cyan-50 text-cyan-800 border-cyan-200`)
* `CLIENT_ENDORSEMENT`: Purple (`bg-purple-50 text-purple-700 border-purple-200`)
* `FINAL_INTERVIEW`: Pink/Fuchsia (`bg-pink-50 text-pink-700 border-pink-200`)
* `HIRED` / `DEPLOYED`: Emerald (`bg-emerald-50 text-emerald-800 border-emerald-200`)
* `ONBOARDING`: Teal (`bg-teal-50 text-teal-800 border-teal-200`)
* `COMPLIANCE`: Orange (`bg-orange-50 text-orange-800 border-orange-200`)
* `ARCHIVED` / `CLOSED`: Slate (`bg-slate-100 text-slate-700 border-slate-200`)

---

## 3. Global & Module-Specific Findings & Improvements

### 3.1 Global Design Problems (Across All Pages)
1. **Microscopic Text Scale (`text-[10px]`, `text-[11px]`):**
   - *Problem:* Ubiquitous usage in table headers, timestamps, badges, filter chips, subtexts, and IDs.
   - *Impact:* Severe eyestrain and illegibility on standard 1080p desktop monitors.
   - *Remedy:* Establish strict lower floor of 12px (`text-xs`) for metadata, 14px (`text-sm`) for body, labels, and table cells.
2. **Diminutive Buttons and Form Controls (`h-7`, `h-8`):**
   - *Problem:* Sub-40px button and input heights with tiny 14px icons.
   - *Impact:* High misclick rate, poor motor ergonomics.
   - *Remedy:* Standardize inputs to `h-10` / `h-11` and buttons to `h-10` (tables: `h-8.5`).
3. **Cramped Table Padding:**
   - *Problem:* `py-2.5` to `py-3.5` row heights with squeezed columns and clipped candidate names.
   - *Impact:* Recruiter scanning fatigue in high-volume pipeline workflows.
   - *Remedy:* Expand cell padding to `py-4 px-5` with `text-sm font-semibold` primary titles.
4. **Low Visual Hierarchy in Layout Headers & Sidebars:**
   - *Problem:* Micro profile avatars (`w-6 h-6`), tiny navigation links, and flat page headers.
   - *Impact:* System feels like a raw prototype rather than a mission-critical enterprise recruitment tool.
   - *Remedy:* Expand navigation links to `px-3.5 py-2.5 text-sm`, avatars to `w-8 h-8`, and clear breadcrumb navigation.

---

## 4. Prioritization Matrix

| Area / Component | Finding | Severity | Phase |
| :--- | :--- | :--- | :--- |
| **Global Theme & Tokens** | Micro text floor, badge sizing, button/input base tokens | **Critical** | Phase 1 |
| **Layouts & Navigation** | TALayout, AdminLayout, ApplicantLayout, AuthLayout | **High** | Phase 2 |
| **TA Dashboard & Pipeline** | KPI stat cards, ApplicationTable, CandidateSidebar, StatusActionBar | **Critical** | Phase 3 |
| **TA Operations (MRF/Jobs)** | TAMRFsPage, TAMRFDetailPage, TAJobsPage, TAClientsPage | **High** | Phase 4 |
| **Applicant Experience** | ApplicantProfilePage (8 sections), Jobs & Applications pages | **High** | Phase 4 |
| **Interviews & Compliance** | TAInterviewsPage, TACompliancePage, TADeploymentsPage | **High** | Phase 4 |
| **Admin & Analytics** | AdminUsersPage, AdminScoringPage, TAAnalyticsPage, AuditLogs | **High** | Phase 5 |
| **Modals, States & Polish** | ConfirmDialog, NotificationBell, Error/Empty states, 404/403 | **Medium** | Phase 5 |
| **Visual Playwright Verification** | Full test suite across 1920, 1440, 1280 desktop viewports | **Critical** | Phase 6 |

---

## 5. Architectural Non-Functional Requirements
- **No breaking changes** to API endpoints, schema types, or TanStack query keys.
- **Pure Tailwind CSS v4** utility alignment utilizing `--font-sans`, CSS variable tokens, and clean class composition.
- **Accessibility:** Ensure all text passes WCAG 2.1 AA (4.5:1 contrast for normal text, 3:1 for large text).
- **Responsive Fluidity:** Flawless rendering from 1280px (standard enterprise laptop) to 1920px (full HD desktop monitor).
