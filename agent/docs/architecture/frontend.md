# MEGS Frontend Architecture & UI/UX Design Specification

This document defines the comprehensive frontend architecture, component structure, state management patterns, and UI/UX design guidelines for the MEGS Recruitment Management System.

---

## 1. Core Objectives

The MEGS frontend is designed as an **Industrial Utilitarian** operational tool used daily by recruiters, hiring managers, and applicants. It prioritizes:
- **Operational Clarity:** High information density, easy scannability, and structured workflows.
- **Maintainability:** Clear feature-based separation of concerns, strict typing, and standardized data fetching.
- **Robustness:** Zero client crashes, dedicated error boundaries, and comprehensive handling of Loading, Empty, Error, and Success states.
- **Anti-AI-Slop:** Functional minimalism without gratuitous gradients, excessive glassmorphism, or non-functional animations.

---

## 2. Technology Stack

- **Framework:** React 19
- **Build Tool:** Vite 6
- **Language:** TypeScript 5 (strict mode)
- **Data Fetching & Cache:** TanStack Query v5
- **Routing:** TanStack Router / React Router v7
- **Tables & Grids:** TanStack Table v8 (for complex data tables) and Semantic HTML tables
- **Validation:** Zod v3
- **Styling:** Tailwind CSS v4 with semantic tokens
- **Icons:** Lucide React

---

## 3. Directory & Feature Architecture

```text
frontend/src/
├── components/
│   ├── common/             # Reusable UI building blocks
│   │   ├── ConfirmDialog.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── ErrorState.tsx
│   │   ├── LoadingState.tsx
│   │   ├── NotificationBell.tsx
│   │   ├── PageHeader.tsx
│   │   ├── PipelineIndicator.tsx
│   │   ├── ScoreBadge.tsx
│   │   └── StatusBadge.tsx
│   └── ui/                 # Atomic UI primitives
├── layouts/                # Role-based shell layouts
│   ├── AdminLayout.tsx     # Admin navigation, audit shortcuts, system metrics
│   ├── TALayout.tsx        # TA dashboard, MRF pipeline, candidates, interviews, 201 compliance
│   ├── ApplicantLayout.tsx # Applicant dashboard, job listings, applications, profile
│   └── AuthLayout.tsx      # Centered card container for auth workflows
├── pages/
│   ├── admin/              # User management, audit logs, AI scoring sliders, system analytics
│   ├── applicant/          # Job board, application tracker, resume & profile builder, 201 upload
│   ├── auth/               # Login, register, change password, forgot/reset password, invite setup
│   ├── common/             # 403 Forbidden, 404 Not Found
│   └── ta/                 # MRF tracking, candidate pipeline, interviews, endorsements, deployments, talent pool
├── hooks/                  # Custom application hooks (useAuth, useNotificationStream)
├── lib/
│   ├── api/                # Modular API services by domain
│   │   ├── admin.ts
│   │   ├── applicant.ts
│   │   ├── auth.ts
│   │   ├── client.ts
│   │   ├── documents.ts
│   │   ├── employees.ts
│   │   ├── notifications.ts
│   │   └── ta.ts
│   ├── types/              # TypeScript domain types & enums
│   └── utils.ts            # Formatting & utility helpers
└── providers/              # AuthProvider, QueryProvider
```

---

## 4. State Management & Data Flow

### Server State (TanStack Query)
- **Primary Source of Truth:** All data originating from the backend is managed by TanStack Query.
- **Predictable Query Keys:**
  - `["applications"]`, `["applications", id]`
  - `["candidates"]`, `["candidates", id]`
  - `["jobs"]`, `["jobs", id]`
  - `["mrfs"]`, `["mrfs", id]`
  - `["talent-pool"]`
- **Mutations & Cache Invalidation:** On successful mutations, invalidate relevant queries to immediately sync UI state without manual state tampering.

### Local & Form State
- Local UI state (e.g., active tab, drawer visibility) uses standard React `useState` or `useReducer`.
- Form state is validated against Zod schemas on blur and submit.

---

## 5. UI/UX Design System & Color Palette

### Semantic Color System
```css
/* Core Brand & Neutral */
--color-primary: #0F766E;        /* Teal 700 — Primary action buttons & active navigation */
--color-primary-hover: #0D9488;  /* Teal 600 */
--color-primary-light: #CCFBF1;  /* Teal 50 — Accent backgrounds */
--color-surface: #FFFFFF;        /* Card & container surfaces */
--color-background: #F8FAFC;     /* Slate 50 — Clean neutral page background */
--color-border: #E2E8F0;         /* Slate 200 — Divider borders */

/* Canonical Pipeline Status Tokens */
--status-submitted: #6366F1;     /* Indigo 500 */
--status-screening: #3B82F6;     /* Blue 500 */
--status-endorsement: #8B5CF6;  /* Violet 500 */
--status-interview: #EC4899;    /* Pink 500 */
--status-hired: #10B981;        /* Emerald 500 */
--status-compliance: #F97316;   /* Orange 500 */
--status-deployed: #059669;     /* Emerald 600 */
--status-rejected: #EF4444;     /* Red 500 */
--status-talent-pool: #06B6D4;  /* Cyan 500 */
--status-archived: #9CA3AF;     /* Gray 400 */
```

### Typography Scale
- **Headings & Primary Text:** Clean sans-serif hierarchy (Geist Sans / Inter fallback).
- **Tabular Data, IDs & Scores:** Monospace font (Geist Mono / Roboto Mono fallback) for aligned columns and numbers.

---

## 6. Hiring Pipeline UI Patterns

1. **Pipeline Summary Bar:** Displays applicant distribution across pipeline stages (`SUBMITTED` → `INITIAL_SCREENING` → `CLIENT_ENDORSEMENT` → `FINAL_INTERVIEW` → `HIRED` → `COMPLIANCE` → `DEPLOYED`).
2. **Action-Required Section:** Prominently highlights applications requiring immediate recruiter attention (e.g. pending screenings, scheduled interviews for today, pending compliance approvals).
3. **Application Action Bar:** Context-sensitive status update buttons reflecting valid backend state machine transitions. Stage skipping is disabled.
4. **4-State Discipline:**
   - **Loading:** Display content skeletons matching the shape of the incoming table or card.
   - **Empty:** Provide helpful explanations and a single primary action button (e.g. "Create Job Posting").
   - **Error:** Display actionable error alerts with a "Retry" trigger.
   - **Data:** Dense, accessible data tables with search, column sorting, and pagination.
