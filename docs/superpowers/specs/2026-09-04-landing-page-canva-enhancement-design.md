# MEGS Landing Page Canva Reference Enhancement Design

- **Date:** 2026-09-04
- **Status:** Approved by User
- **Reference Site:** [MAR Employment for Good Services Inc. (Canva)](https://megsinc.my.canva.site/)

---

## 1. Overview & Business Context

**MAR EMPLOYMENT FOR GOOD SERVICES INC. (MEGS)** is a premier Philippine manpower and human resource service provider founded in May 1997, servicing the nation's Top 1,000 Corporations.

This design upgrades the public-facing landing page of the MEGS Recruitment Management System into a **Unified Dual-Purpose Hub** that integrates:
1. **Corporate Agency Showcase:** The complete corporate profile, 27-year heritage, DOLE D.O. 40-03 statutory compliance features, PALSCON accreditation, PJAR Group affiliation, 6 nationwide branches with an interactive Philippine SVG map, 6 partner industries, and 15 job specializations.
2. **Active Job Seeker Portal:** The system's live job board, real-time search, category filters, and applicant onboarding workflows.

---

## 2. Brand Identity & Visual Assets

### 2.1 Corporate Identity
- **Legal Entity:** MAR EMPLOYMENT FOR GOOD SERVICES INC.
- **Slogan:** *"Better People for Better Result"*
- **Parent Group:** PJAR Group
- **Accreditation:** PALSCON (Philippine Association of Local Service Contractors)
- **Founded:** May 1997
- **Corporate Pillars:** Integrity · Loyalty · Respect
- **Vision:** Deliver "Better people for better results" to 200 corporate firms and a great employment experience to 15,000 deployed personnel.

### 2.2 Asset Optimization & Placement
All extracted Canva photography and emblems are optimized into `frontend/public/images/canva-ref/`:
- `megs-seal.png` / SVG: Circular corporate seal with *"Better People for Better Result"* and *"MEGS INC."*
- `palscon-logo.png`: Transparent PALSCON federation emblem.
- `industries/manufacturing.jpg`: Manufacturing plant & assembly operations.
- `industries/logistics.jpg`: Fleet logistics & transport operations.
- `industries/warehousing.jpg`: High-bay storage & inventory handling.
- `industries/retail.jpg`: Retail merchandising & supermarket operations.
- `industries/hospitality.jpg`: Food & beverage service staff.
- `industries/casino.jpg`: Gaming floor & entertainment venue staffing.

---

## 3. Information Architecture & Component Hierarchy

The landing page (`frontend/src/pages/public/LandingPage.tsx`) implements the following ordered flow:

```
LandingPage.tsx
├── LandingHeader (Sticky brand navigation & anchor links)
├── main
│   ├── LandingHero (Corporate value proposition + dual CTAs)
│   ├── LandingAffiliates (PJAR Group & PALSCON accreditation trust bar)
│   ├── LandingAbout (Company history, 1997 founding & 5-year vision)
│   ├── LandingValues (3 Corporate values: Integrity, Loyalty, Respect)
│   ├── LandingServices (6 Salient features under DOLE D.O. 40 + Accident Insurance)
│   ├── LandingIndustries (6 Partner industry photo cards with role breakdowns)
│   ├── LandingSpecializations (15 Core job specializations directory)
│   ├── LandingBranches (Interactive Philippine Vector Map + 6 Branch Cards)
│   ├── LandingJobListings (Live database job search & filters)
│   ├── LandingCategories (System job categories with live counts)
│   ├── LandingFeaturedCompanies (Verified employer partners)
│   ├── LandingHowItWorks (4-step candidate journey)
│   └── LandingContact (Service proposal inquiry & VP Operations hotline)
└── LandingFooter (6-branch directory, legal disclaimers, DOLE compliance notice)
```

---

## 4. Component Specifications

### 4.1 `LandingHeader.tsx`
- **Brand Mark:** Displays the high-resolution MEGS seal alongside "MEGS" and "MAR EMPLOYMENT FOR GOOD SERVICES INC."
- **Desktop Navigation:**
  - `About` (`#about`)
  - `Services` (`#services`)
  - `Industries` (`#industries`)
  - `Specializations` (`#specializations`)
  - `Branches & Map` (`#branches`)
  - `Find Jobs` (`#jobs`)
  - `Contact / Proposals` (`#contact`)
- **Actions:** Dual action buttons: `[Log In]` and `[Create Account]`, or `[Go to Portal]` when authenticated.
- **Mobile Menu:** Full-drawer mobile menu preserving all anchors and direct login options.

### 4.2 `LandingHero.tsx`
- **Headline:** *"Empowering Top Philippine Enterprises with Proven Workforce Solutions Since 1997"*
- **Subheadline:** Full-service manpower management, rapid site deployment, and 100% DOLE statutory compliance across Luzon, Visayas, and Mindanao.
- **Dual CTA Buttons:**
  1. `[Browse Job Openings →]` (Scrolls smoothly to `#jobs`)
  2. `[Request Manpower Proposal ↓]` (Scrolls smoothly to `#contact`)
- **Key Trust Badges:**
  - `27+ Years` Operational Track Record
  - `6 Regional Branches` Across the Archipelago
  - `DOLE Compliant` (D.O. 174 & D.O. 40-03)
  - `PALSCON Member`

### 4.3 `LandingAffiliates.tsx` [NEW]
- **Purpose:** Immediate institutional trust strip placed immediately below the hero.
- **Content:**
  - **PJAR Group:** *"A Proud Member of the PJAR Group of Companies"*
  - **PALSCON:** *"Accredited Member of the Philippine Association of Local Service Contractors"* with official emblem.
  - Highlighting legitimate contractor status under Philippine labor law.

### 4.4 `LandingAbout.tsx` & `LandingValues.tsx`
- **Founding Heritage:** May 1997 establishment, over 27 years supporting the country's Top 1,000 Corporations.
- **Vision Target:** 5-year vision delivering *"Better people for better results"* to 200 partner firms and empowering 15,000 deployed personnel.
- **3 Core Values:**
  1. **Integrity:** Building employee character, statutory transparency, and spotless reputation.
  2. **Loyalty:** Fostering shared operational commitment toward organizational goals.
  3. **Respect:** Driving workplace teamwork, human dignity, and mutual trust.

### 4.5 `LandingServices.tsx`
- **6 Salient Features from Canva:**
  1. **Recruitment Exemption:** Eliminates advertising expenses, screening bottlenecks, and interview costs for clients.
  2. **Statutory Benefits Administration:** Complete management of SSS, PhilHealth, Pag-IBIG, and ECC contributions and compliance records.
  3. **Zero Legal Liabilities:** Direct employer-employee relationship with MEGS; clients are fully insulated under DOLE D.O. No. 40, S.2003.
  4. **Non-Existent Labor Disputes:** Eliminates union and collective bargaining negotiations for client companies.
  5. **Dedicated On-Site Service Coordinators:** Daily workforce attendance, supervision, and immediate operational issue resolution.
  6. **Competitive Billing Rates:** Transparent labor code-compliant computation with fair holiday and night differential handling.
- **Accident Insurance Card:**
  - ₱100,000 Death or Total Disability Insurance Coverage
  - ₱10,000 Hospitalization Coverage

### 4.6 `LandingIndustries.tsx`
- 6 Partner industry showcase cards with Canva authentic photography:
  1. **Manufacturing:** Production assembly, quality control, packaging, food & electronic plants.
  2. **Logistics:** Fleet transport, freight handling, delivery drivers, and dispatch.
  3. **Warehousing:** Inventory control, high-bay storage, sorting, and forklift operations.
  4. **Retail, Sales & Distribution:** Supermarkets, merchandising, brand ambassadors, cashiering.
  5. **Hotel & Restaurant:** Kitchen staff, dining servers, banquet service, and hospitality crew.
  6. **Gaming & Casino:** Entertainment venue operations, cashiering, and floor maintenance.

### 4.7 `LandingSpecializations.tsx`
- Complete 15-role directory from Canva:
  - Sales Promo / Merchandiser
  - Office Staff / Clerks
  - Data Encoders
  - Production Supervisor / Worker
  - Messenger (Motorized / Foot)
  - Delivery Driver
  - Utility Helpers
  - Machine Operators
  - QA/QC Personnel
  - Food Servers
  - Forklift Operators
  - Welders
  - Cashier / Bagger
  - Warehouse Crew
  - Brand Ambassadors

### 4.8 `LandingBranches.tsx` & Interactive Philippine Map
- **Vector Philippine Map:**
  - High-precision SVG map of Luzon, Visayas, and Mindanao.
  - Interactive pulsing hotspot markers for each of the 6 branches.
  - Two-way active state: hovering/clicking a pin highlights the branch card; clicking a card zooms/highlights the pin.
- **Filter Tabs:** `[All Branches (6)]`, `[Luzon & NCR (4)]`, `[Visayas (1)]`, `[Mindanao (1)]`.
- **6 Branch Details:**
  1. **Valenzuela Central Office (HQ):** `#9, PJAR Bldg, P. Gomez St, Malinta, Valenzuela City`
  2. **Quezon City Branch:** `Rm 207, 2nd Floor, STG Bldg., 109 P. Tuazon, Cubao, Quezon City`
  3. **Batangas Branch:** `PJAR Trading (In front of New City Hall), Brgy Santor, Tanauan City, Batangas`
  4. **Biñan Branch:** `3rd Fl, Uniworld Bldg. 347, Burgos St., Brgy Vicente, Biñan, Laguna`
  5. **Cebu Branch:** `RM 301, Du Sui Bldg, North Road, Brgy Jagobiao, Mandaue City, Cebu`
  6. **Davao Branch:** `D2 2F, C LAT Bldg, Bonifacio St, Davao City, Mindanao`

### 4.9 `LandingContact.tsx` [NEW]
- **Contact Executive:** John Patrick Ramos, Vice-President for Operations.
- **Email:** `patrickramos@pjar-group.com`
- **Phone Lines:** `0917-629-1864` (Globe) · `0923-745-4050` (Sun / Smart)
- **Interactive Proposal Form:** Quick contact modal allowing client companies to request formal manpower proposals, specify branch locations, and download company profiles.

---

## 5. Non-Functional Requirements & Design Principles

1. **HCI Restraint & Anti-Slop:** Adheres strictly to the 10-point HCI checklist. No gratuitous AI gradients, rainbow badges, or generic placeholder text.
2. **Typography & Contrast:** High-contrast text on solid backgrounds meeting WCAG AA contrast ratios (4.5:1 for body text, 3:1 for headers).
3. **Performance:** All imagery pre-scaled and compressed as WebP/JPG with lazy-loading attributes.
4. **Zero Regressions:** Preserves all existing TanStack Query job searches, location queries, and authentication redirects.

---

## 6. Verification & Test Plan

1. **Build & Type Check:** Run `npm run build` or `npx tsc --noEmit` on the frontend.
2. **Component Tests:** Update `LandingPage.test.tsx` to verify rendering of new sections and navigation anchors.
3. **Responsive Verification:** Test breakpoints across mobile (375px), tablet (768px), desktop (1280px), and ultra-wide (1920px).
4. **Anchor Navigation:** Verify clicking `#branches`, `#contact`, `#jobs`, etc., smoothly scrolls to the correct section without layout jumps.
