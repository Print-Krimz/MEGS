---
name: frontend
description: Specialized frontend architecture and UI/UX skill for the MEGS Recruitment Management System. Covers React 19 + Vite, TanStack Query/Router/Table, Tailwind CSS v4, Zod validation, and professional HR industrial utilitarian design.
---

# MEGS Frontend Architecture & UI/UX Skill

Use this skill when building, reviewing, or refactoring frontend interfaces for the MEGS Recruitment Management System.

---

## 1. Technology Stack

- **Framework & Tooling:** React 19, Vite, TypeScript
- **State & Routing:** TanStack Query (server state), TanStack Router (client routing)
- **Tables & Data:** TanStack Table (for complex sorting/filtering/pagination), Standard Semantic HTML tables (for simple data)
- **Validation:** Zod schemas
- **Styling:** Tailwind CSS v4 with semantic HR color tokens
- **Icons:** Lucide React (used purposefully with accessible labels)

---

## 2. Directory & Component Architecture

```text
frontend/src/
├── components/
│   ├── common/             # Shared UI primitives (PageHeader, StatusBadge, ScoreBadge, ConfirmDialog, EmptyState, LoadingState, NotificationBell)
│   └── ui/                 # Basic atomic UI primitives
├── layouts/                # Role-based shell layouts (AdminLayout, TALayout, ApplicantLayout, AuthLayout)
├── pages/
│   ├── admin/              # User management, audit logs, scoring config, analytics
│   ├── applicant/          # Job board, application tracking, candidate profile, 201 docs
│   ├── auth/               # Login, register, forgot/reset password, invite setup
│   ├── common/             # 403 Forbidden, 404 Not Found
│   └── ta/                 # MRF tracking, applications pipeline, interviews, endorsements, compliance, deployment, talent pool
├── hooks/                  # Custom hooks (useAuth, useNotificationStream)
├── lib/
│   ├── api/                # Typed API client modules by domain (admin, applicant, auth, client, documents, employees, notifications, ta)
│   ├── types/              # Domain models, API request/response types, enums
│   └── utils.ts            # Formatting & utility helpers
└── providers/              # AuthProvider, QueryProvider
```

---

## 3. Core Frontend Engineering Rules

### 1. Server State vs. Local UI State
- **TanStack Query as Default:** Fetch all backend data via TanStack Query (`useQuery`, `useMutation`).
- **Predictable Query Keys:** Use structured keys, e.g. `["applications"]`, `["applications", id]`, `["mrf", id]`, `["scoring-config"]`.
- **Automatic Invalidation:** Invalidate relevant query keys on successful mutations to ensure real-time consistency.
- **No Duplicated Server State:** Never duplicate server state into redundant global stores (e.g. Redux/Zustand) when TanStack Query already caches it.

### 2. Form & Payload Validation (Zod)
- Colocate validation schemas with their respective features or under `lib/api/` schemas.
- Enforce strict runtime schema validation before submitting data to backend endpoints.

### 3. Component Responsibility
- Presentation components must only render UI, trigger handlers, and receive props.
- Keep business logic in custom hooks or dedicated API modules.
- Split components when they exceed clear single-responsibility boundaries.

---

## 4. UI/UX & Design Principles (Anti-AI-Slop)

The product is an **Industrial Utilitarian** operational tool used daily by recruiters and HR personnel.

### Visual Rules
- **Information Density:** High information density with comfortable whitespace. Emphasize data tables, filters, and status over large decorative empty cards.
- **No Decorative AI Fluff:** No unnecessary rainbow gradients, excessive glassmorphism, floating random blur blobs, or giant marketing hero cards in operational dashboards.
- **Semantic Status Badges:** Status badges must always include clear text labels alongside semantic colors (e.g., `SUBMITTED`, `INITIAL_SCREENING`, `CLIENT_ENDORSEMENT`, `FINAL_INTERVIEW`, `HIRED`, `COMPLIANCE`, `DEPLOYED`).
- **State Handling:** Every screen must explicitly handle 4 states:
  1. **Loading:** Skeletons or subdued spinners.
  2. **Error:** Helpful error messages with retry options.
  3. **Empty:** Clear explanation and direct actionable CTA.
  4. **Success / Data:** High-density, accessible tabular and card views.

---

## 5. Recruitment Workflow Awareness

The frontend must strictly mirror the backend canonical hiring pipeline:
`SUBMITTED` → `INITIAL_SCREENING` → `CLIENT_ENDORSEMENT` → `FINAL_INTERVIEW` → `HIRED` → `COMPLIANCE` → `DEPLOYED`.

- Never expose UI buttons that allow invalid stage-skipping.
- Display score breakdowns and AI advisory summaries transparently alongside recruiter override controls.
