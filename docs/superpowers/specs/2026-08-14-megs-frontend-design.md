# MEGS Frontend Design Spec

## Overview

Build a professional recruitment operations frontend for the existing MEGS backend. The system serves three user roles — **Applicant**, **Talent Acquisition (TA)**, and **Administrator** — each with distinct workflows and information needs. The backend is the source of truth; the frontend visualizes and operates against it.

**Tech Stack:** React 19 + Vite + TypeScript + TanStack Query + Zod + shadcn/ui  
**Location:** `frontend/` directory alongside `backend/` in the existing monorepo  
**Brand:** MEGS — Deep teal accent (#0F766E range)

---

## 1. Design Direction

### Aesthetic: Industrial Utilitarian

**Purpose:** Operational efficiency for recruiters, approachable clarity for applicants.

**DFII Score:**
| Dimension | Score |
|---|---|
| Aesthetic Impact | 4 |
| Context Fit | 5 |
| Implementation Feasibility | 5 |
| Performance Safety | 5 |
| Consistency Risk | 2 |
| **Total** | **17 - 2 = 15** |

This is a **workhorse tool** — not a marketing site. The design must make recruiters productive, not impressed.

### Design Principles

1. **Information density over decoration** — TA sees data tables, filters, and status at a glance
2. **Recruitment workflow as navigation** — the UI mirrors the actual pipeline stages
3. **Semantic status colors** — consistent meaning across every screen (not decorative)
4. **Restrained surfaces** — neutral backgrounds, minimal shadows, subtle borders
5. **Forms that work** — persistent labels, inline validation, backend error display

### Color System

```
--color-primary: #0F766E        (teal-700 — primary actions, active nav)
--color-primary-hover: #0D9488  (teal-600 — hover states)
--color-primary-light: #CCFBF1  (teal-50 — subtle backgrounds)

--color-surface: #FFFFFF         (cards, panels)
--color-background: #F8FAFC     (slate-50 — page background)
--color-border: #E2E8F0         (slate-200)
--color-text-primary: #0F172A   (slate-900)
--color-text-secondary: #64748B (slate-500)
--color-text-muted: #94A3B8     (slate-400)

Semantic status colors:
--status-submitted: #6366F1     (indigo-500)
--status-in-progress: #F59E0B  (amber-500)
--status-screening: #3B82F6    (blue-500)
--status-endorsement: #8B5CF6  (violet-500)
--status-hired: #10B981        (emerald-500)
--status-compliance: #F97316   (orange-500)
--status-deployed: #059669     (emerald-600)
--status-rejected: #EF4444     (red-500)
--status-talent-pool: #06B6D4  (cyan-500)
--status-archived: #9CA3AF     (gray-400)
```

### Typography

- **Headings:** Geist Sans (clean, professional, not Inter)
- **Body:** System font stack for speed (Geist for key elements)
- **Monospace:** Geist Mono (scores, IDs, dates in tables)
- **Hierarchy:** Weight and color differentiation, not massive scale jumps

---

## 2. Authentication & Authorization

### Backend Contract (from `/api/auth`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/auth/register` | POST | Applicant self-registration |
| `/api/auth/login` | POST | Login (returns Supabase JWT) |
| `/api/auth/logout` | POST | Session termination |
| `/api/auth/change-password` | POST | Authenticated password change |
| `/api/auth/forgot-password` | POST | Password reset request |
| `/api/auth/reset-password` | POST | Password reset with token |
| `/api/auth/setup-account` | POST | TA account setup (from invite) |
| `/api/me` | GET | Current user profile |

### Frontend Auth Architecture

- **Supabase JS Client** for session management (JWT stored in memory, refresh via Supabase SDK)
- **AuthProvider context** wrapping the entire app — provides `user`, `isAuthenticated`, `login()`, `logout()`, `role`
- **Route guards:** Three protected layout shells — `ApplicantLayout`, `TALayout`, `AdminLayout` — each checking role before rendering children
- **Mandatory password change:** If `user.mustChangePassword === true`, redirect to change-password screen before any other navigation
- **Token refresh:** Supabase SDK handles this automatically; TanStack Query interceptor attaches `Authorization: Bearer <token>` to every request

### Auth Pages

1. **Login** — email/password, link to register, link to forgot password
2. **Register** — applicant self-registration (name, email, password)
3. **Forgot Password** — email input, sends reset link
4. **Reset Password** — new password form (accessed via email link)
5. **Setup Account** — TA account activation (from admin invite link)
6. **Change Password** — forced on first login for invited TAs

---

## 3. Routing Architecture

```
/                           → Redirect based on role
/login                      → Login page
/register                   → Applicant registration
/forgot-password            → Password reset request
/reset-password             → Password reset form
/setup-account              → TA invite setup

/app/                       → Applicant shell
  /app/dashboard            → Applicant home
  /app/profile              → Profile management
  /app/jobs                 → Browse open jobs
  /app/jobs/:id             → Job details
  /app/applications         → My applications
  /app/applications/:id     → Application detail/progress

/ta/                        → TA shell
  /ta/dashboard             → TA overview
  /ta/applications          → All applications (pipeline view)
  /ta/applications/:id      → Application detail (recruitment workspace)
  /ta/jobs                  → Job postings management
  /ta/jobs/:id              → Job detail + ranked candidates
  /ta/clients               → Client management
  /ta/clients/:id           → Client detail
  /ta/mrfs                  → Manpower requests
  /ta/mrfs/:id              → MRF detail
  /ta/talent-pool           → Talent pool search
  /ta/interviews            → Interview compliance/calendar
  /ta/compliance            → Compliance monitoring
  /ta/deployments           → Deployment tracking
  /ta/employees             → Employee management
  /ta/employees/:id         → Employee 201 file
  /ta/analytics             → Pipeline & deployment analytics

/admin/                     → Admin shell
  /admin/dashboard          → System overview
  /admin/users              → User management
  /admin/scoring            → Candidate scoring config
  /admin/audit-logs         → Audit trail
  /admin/clients            → Client oversight
  /admin/mrfs               → MRF monitoring
  /admin/analytics          → Analytics (same endpoints as TA)
```

---

## 4. Application Status Pipeline

The backend enforces these transitions strictly via `ALLOWED_TRANSITIONS`:

```
SUBMITTED → PARSING → REVIEW → MATCHED
                            ↘ NEEDS_ATTENTION
REVIEW/MATCHED → INITIAL_SCREENING (or TALENT_POOL / ARCHIVED)
INITIAL_SCREENING → CLIENT_ENDORSEMENT (requires PASSED interview)
CLIENT_ENDORSEMENT → FINAL_INTERVIEW (requires ENDORSED outcome)
FINAL_INTERVIEW → HIRED (requires PASSED interview)
HIRED → ONBOARDING → COMPLIANCE → DEPLOYED

Off-ramps at most stages:
  → TALENT_POOL (reusable candidate)
  → ARCHIVED (rejected/withdrawn)
  → BACKOUT (candidate withdrew after hiring)
```

### Frontend Pipeline Component

A horizontal stage indicator showing the candidate's current position in the pipeline. Each stage is a labeled step with:
- Past stages: checkmark, muted
- Current stage: highlighted with teal accent
- Future stages: outlined, neutral
- Off-ramp stages (Talent Pool, Archived): shown as side branches when applicable

This component appears on:
- Application detail page (TA view)
- Application progress page (Applicant view)
- Application list rows (condensed version)

---

## 5. Applicant Interface

### 5.1 Applicant Dashboard (`/app/dashboard`)
- Welcome message with name
- Profile completion indicator (% based on filled fields)
- Active applications summary (count by status)
- Quick links: Browse Jobs, View Applications, Complete Profile

### 5.2 Profile Management (`/app/profile`)
Organized into logical sections (tabs or accordion, not one long form):

**Personal Info** — name, contact, location, date of birth, government IDs, photo upload  
**Resume** — file upload (PDF), AI consent toggle  
**Work Experience** — add/remove entries (company, role, dates, current toggle)  
**Education** — add/remove entries (school, degree, field, dates)  
**Skills** — tag-style input, add/remove  
**Trainings** — add/remove entries  
**Character References** — add/remove entries  
**Documents/Assets** — file upload with labels, verification status display  

API mapping:
- GET `/api/applicants/profile` → load all sections
- POST `/api/applicants/profile` → update personal info
- POST/DELETE for each sub-resource (work-experience, education, skills, etc.)
- POST `/api/applicants/profile/photo` → photo upload
- POST `/api/applicants/profile/resume` → resume upload
- POST `/api/applicants/profile/consent` → AI consent

### 5.3 Job Browsing (`/app/jobs`)
- List of open job postings with search/filter
- Each job shows: title, location, employment type, description excerpt
- API: GET `/api/applicant-jobs/jobs`

### 5.4 Job Detail (`/app/jobs/:id`)
- Full description, requirements, qualifications
- "Apply" button (with resume upload option)
- API: GET `/api/applicant-jobs/jobs/:id`, POST `/api/applicant-jobs/jobs/:id/apply`

### 5.5 My Applications (`/app/applications`)
- List of submitted applications
- Each row: job title, company, date applied, current status badge
- API: GET `/api/applicant-jobs/my-applications`

### 5.6 Application Detail (`/app/applications/:id`)
- Pipeline progress indicator (visual stage tracker)
- Job information
- Application status with human-readable explanation
- Interview details (if scheduled) — date, type, result
- Compliance requirements (if at that stage) — document checklist
- This is read-only from the applicant side; backend drives transitions

---

## 6. Talent Acquisition Interface

### 6.1 TA Dashboard (`/ta/dashboard`)

**Not a generic stats dashboard.** This is an operational command center showing:

- **Pipeline summary** — count of applications at each active stage (from GET `/api/ta/analytics/pipeline`)
- **Requiring action** — applications in NEEDS_ATTENTION, interviews past SLA, pending compliance reviews
- **Recent applications** — latest 10 submissions
- **MRF fill status** — MRFs with remaining openings
- **Upcoming interviews** — next 7 days

Layout: Clean data sections with clear headings, not cards-inside-cards. Numbers with labels. Clickable rows to navigate.

### 6.2 Application Management (`/ta/applications`)

**The primary TA workspace.**

Table view with columns:
- Candidate name (linked to detail)
- Position
- Client/MRF
- AI Match Score
- Current Stage (status badge)
- Date Applied
- Next Action

Features:
- Status filter tabs (All, Review, Screening, Endorsement, Final Interview, Hired, Compliance, Deployed)
- Search by candidate name or position
- Sort by date, score, status
- Pagination
- API: GET `/api/ta/applications`

### 6.3 Application Detail (`/ta/applications/:id`)

**The candidate recruitment workspace.** This is the most important screen for recruiters.

**Layout: Sidebar + Content area**

**Left sidebar (fixed, narrow):**
- Candidate photo + name
- Position applied for
- AI Score (number + visual bar)
- Current status badge
- Pipeline stage indicator (vertical for sidebar)
- Quick action buttons (advance, schedule interview, endorse, etc.)

**Main content area (tabbed):**

**Tab 1: Overview**
- Candidate summary (professional summary, location, contact)
- AI Resume Analysis (score, summary, strengths, gaps) — from application.aiSummary
- Job match details
- Recruiter decisions history — GET `/api/ta/applications/:id/decisions`

**Tab 2: Resume & Profile**
- Resume download/view
- Work experience, education, skills, trainings, references
- Document/asset listings with verification badges

**Tab 3: Interviews**
- Interview history (initial screening, final)
- Schedule new interview form
- Update interview result (PASSED, FAILED, NO_SHOW)
- APIs: GET/POST `/api/ta/applications/:id/interviews`, PATCH `.../:interviewId/status`

**Tab 4: Endorsement**
- Client endorsement form (outcome: ENDORSED, NOT_ENDORSED, DEFERRED)
- Endorsement history
- APIs: POST `/api/ta/applications/:id/endorse`, GET `.../:id/endorsements`

**Tab 5: Compliance**
- Required documents checklist (generated from MRF)
- Document upload/submission
- Review status per document (PENDING, APPROVED, REJECTED, EXPIRED)
- Overall compliance status (fully compliant = green)
- APIs: GET/POST `/api/ta/applications/:id/compliance`, POST/PATCH compliance endpoints

**Tab 6: Deployment**
- Deployment creation form (site, dates, client)
- Deployment status tracking
- API: POST `/api/ta/applications/:id/deploy`

**Status transition controls:**
- Contextual action buttons based on current status and allowed transitions
- Confirmation dialogs for critical actions (hire, deploy, archive)
- Validation: frontend mirrors backend's `ALLOWED_TRANSITIONS` for UX, but backend enforces

### 6.4 Job Management (`/ta/jobs`)
- Table: title, status (DRAFT/OPEN/CLOSED), location, applications count, date created
- Create/edit job forms
- Status toggling
- APIs: GET/POST/PATCH `/api/ta/jobs`

### 6.5 Job Detail (`/ta/jobs/:id`)
- Job information
- Ranked candidates tab (from AI scoring) — GET `/api/ta/jobs/:jobId/ranked-candidates`
- Talent pool matches — GET `/api/ta/jobs/:jobId/talent-pool`
- Trigger re-ranking — POST `/api/ta/jobs/:jobId/rank-candidates`

### 6.6 Client Management (`/ta/clients`)
- Client list with industry, contact info
- Client detail page with linked MRFs
- Create/edit client forms
- APIs: GET/POST/PATCH `/api/ta/clients`

### 6.7 MRF Management (`/ta/mrfs`)
- Table: client, position title, headcount, priority, status, filled/remaining
- MRF detail page with:
  - Requirements and qualifications
  - Linked job postings
  - Compliance templates
  - Pipeline of candidates applying to linked jobs
- Create/edit MRF forms
- Link job to MRF action
- APIs: GET/POST/PATCH `/api/ta/mrfs`, link-job, compliance-templates

### 6.8 Talent Pool (`/ta/talent-pool`)
- Semantic search interface (text query → KNN vector search)
- Results showing: candidate, skills, experience, previous application, talent pool status, availability
- Actions: consider for job, record contact
- Contact history per candidate
- APIs: POST `/api/ta/talent-pool/search`, POST `.../members`, POST `.../contacts`, POST `.../consider`

### 6.9 Interview Compliance (`/ta/interviews`)
- SLA tracker — interviews approaching or past 7-day limit
- API: GET `/api/ta/compliance/interviews`

### 6.10 Deployments (`/ta/deployments`)
- Active deployments table: employee, client, site, status, contract dates
- Deployment detail page
- Status updates
- APIs: GET/PATCH `/api/ta/deployments`

### 6.11 Employees (`/ta/employees`)
- Employee directory with status filtering
- Employee detail with Digital 201 file
- Employment history
- APIs: GET `/api/employees`, GET `/:id/digital-201`, GET `/:id/employment-history`

### 6.12 Analytics (`/ta/analytics`)
- Pipeline statistics — applications by status
- Time to fill — average days per stage
- Deployment stats — active/ended by client
- Compliance overview — requirement completion rates
- Export to PDF/XLSX
- APIs: GET `/api/ta/analytics/*`, GET `/api/ta/reports/*`

---

## 7. Admin Interface

### 7.1 Admin Dashboard (`/admin/dashboard`)
- System-wide statistics: total users by role, active applications, active deployments
- Recent audit log entries
- Quick links to management functions

### 7.2 User Management (`/admin/users`)
- Table: email, role, status, invited date
- Actions: change role, activate/deactivate, invite TA
- Invite TA modal (email input → sends invitation)
- APIs: GET `/api/admin/users`, POST `/api/admin/invite-ta`, PATCH role/status

### 7.3 Candidate Scoring Configuration (`/admin/scoring`)
- Current scoring weights display (Skills, Experience, Location, Compliance, Education)
- Weight editor with validation (must total 100%)
- KNN settings editor (defaultK, maximumK, minimumSimilarity)
- Configuration validation before save
- Configuration history
- Revalidation status monitor
- Quality metrics display
- Restore defaults action
- APIs: GET/PUT `/api/admin/candidate-scoring/configuration`, validate, restore-defaults, history, revalidation-status, quality-metrics

### 7.4 Audit Logs (`/admin/audit-logs`)
- Searchable, filterable log table
- Columns: timestamp, user, action, details
- Pagination
- API: GET `/api/admin/audit-logs`

### 7.5 Shared Views
Admin also has read-access to TA views (clients, MRFs, analytics) since the TA routes accept both TALENT_ACQUISITION and ADMINISTRATOR roles.

---

## 8. Component Architecture

### Shared Components (used across all roles)

```
components/
  ui/                    ← shadcn components (installed via CLI)
  common/
    PageHeader.tsx       ← page title + breadcrumb + optional actions
    StatusBadge.tsx      ← semantic color badges for all status types
    PipelineIndicator.tsx ← horizontal/vertical stage tracker
    DataTable.tsx        ← sortable table with pagination (wraps shadcn Table)
    SearchFilters.tsx    ← search bar + filter controls
    EmptyState.tsx       ← contextual empty messages with suggested action
    LoadingState.tsx     ← skeleton loaders matching page layout
    ErrorState.tsx       ← error display with retry button
    ConfirmDialog.tsx    ← confirmation for destructive actions
    FileUpload.tsx       ← drag-and-drop file upload with preview
    ScoreBadge.tsx       ← AI score display (number + color coding)
```

### Layout Components

```
layouts/
  AuthLayout.tsx         ← centered card layout for auth pages
  ApplicantLayout.tsx    ← simple top nav + content area
  TALayout.tsx           ← sidebar nav + top bar + content area
  AdminLayout.tsx        ← sidebar nav + top bar + content area
```

### Feature Components (co-located with pages)

Each page directory contains its own feature-specific components. For example:
```
pages/ta/applications/
  ApplicationsPage.tsx
  ApplicationDetail.tsx
  components/
    ApplicationTable.tsx
    InterviewPanel.tsx
    EndorsementPanel.tsx
    CompliancePanel.tsx
    DeploymentPanel.tsx
    CandidateSidebar.tsx
```

---

## 9. API Integration Layer

### Structure

```
lib/
  api/
    client.ts            ← axios/fetch wrapper with auth interceptor
    auth.ts              ← login, register, logout, password functions
    applicant.ts         ← applicant profile and job API functions
    ta.ts                ← TA operations (applications, jobs, clients, MRFs, etc.)
    admin.ts             ← admin operations (users, scoring, audit)
    employees.ts         ← employee management functions
    notifications.ts     ← notification CRUD + SSE stream
    documents.ts         ← document download
  hooks/
    useAuth.ts           ← auth context hook
    useApplications.ts   ← TanStack Query hooks for applications
    useJobs.ts           ← TanStack Query hooks for jobs
    useClients.ts        ← TanStack Query hooks for clients
    useMRFs.ts           ← TanStack Query hooks for MRFs
    useTalentPool.ts     ← TanStack Query hooks for talent pool
    useEmployees.ts      ← TanStack Query hooks for employees
    useAnalytics.ts      ← TanStack Query hooks for analytics
    useNotifications.ts  ← notification hooks + SSE
  types/
    api.ts               ← Response types matching backend models
    enums.ts             ← All enums from Prisma schema (mirrored)
    forms.ts             ← Zod schemas for form validation
```

### API Client Pattern

```typescript
// Centralized fetch wrapper
const apiClient = {
  get: <T>(url: string) => fetch with auth header, error handling, JSON parse,
  post: <T>(url: string, body) => fetch with POST method,
  patch: <T>(url: string, body) => fetch with PATCH method,
  delete: <T>(url: string) => fetch with DELETE method,
}

// Error handling: 401 → redirect to login, 403 → show forbidden,
// 422 → return validation errors, 500 → show generic error
```

### TanStack Query Pattern

```typescript
// Query key factory
export const applicationKeys = {
  all: ['applications'] as const,
  lists: () => [...applicationKeys.all, 'list'] as const,
  list: (filters: ApplicationFilters) => [...applicationKeys.lists(), filters] as const,
  details: () => [...applicationKeys.all, 'detail'] as const,
  detail: (id: string) => [...applicationKeys.details(), id] as const,
};

// Custom hook
export function useApplications(filters: ApplicationFilters) {
  return useQuery({
    queryKey: applicationKeys.list(filters),
    queryFn: () => taApi.listApplications(filters),
    staleTime: 30_000,
  });
}
```

---

## 10. State Management

**Minimal global state.** Most state is server state managed by TanStack Query.

- **Auth state:** React Context (user, session, role)
- **UI state:** Local component state (sidebar open, active tab, filters)
- **Server state:** TanStack Query (all API data, cached, auto-refetched)
- **Form state:** React Hook Form + Zod (form validation, submission)
- **Notifications:** SSE connection managed by a custom hook, notification list via TanStack Query

No Zustand, no Redux, no complex state machines. The backend enforces workflows.

---

## 11. Error & Loading States

Every data-driven page must handle:

| State | Implementation |
|---|---|
| Loading | Skeleton loaders matching the page layout shape |
| Success | Normal content render |
| Empty | Contextual message + suggested action ("No applications yet. Browse open positions.") |
| Error (generic) | Error card with message + retry button |
| 401 Unauthorized | Redirect to login |
| 403 Forbidden | "You don't have permission" page |
| 404 Not Found | "Resource not found" page |
| 422 Validation | Inline field errors from backend |
| Network failure | Toast notification + retry option |

---

## 12. Notifications

The backend provides:
- GET `/api/notifications` — paginated list
- GET `/api/notifications/unread-count` — badge count
- GET `/api/notifications/stream` — SSE real-time updates
- PATCH `/api/notifications/:id/read` — mark as read

Frontend implementation:
- Bell icon in top bar with unread count badge
- Dropdown/panel showing recent notifications
- SSE connection for real-time updates (EventSource)
- Click notification → navigate to relevant resource

---

## 13. Backend Gaps (Documented, Not Implemented)

Features the frontend would benefit from but the backend does not currently support:

1. **Applicant notification stream** — SSE exists but applicant-specific notifications may be sparse
2. **Application status change reasons** — frontend shows status but reasons for rejection/talent pool are limited to recruiter decisions
3. **Bulk operations** — no batch status update or batch archive endpoints
4. **Dashboard aggregate endpoint** — TA dashboard will need multiple API calls (pipeline stats, recent applications, upcoming interviews)
5. **Applicant interview schedule** — applicants can see applications but there's no dedicated "my interviews" endpoint (will derive from application detail)

These are **not blockers**. The frontend will work within existing API constraints.

---

## 14. Responsive Strategy

| Viewport | Behavior |
|---|---|
| Desktop (1280px+) | Full sidebar nav, data tables, side-by-side panels |
| Laptop (1024-1279px) | Collapsible sidebar, slightly tighter tables |
| Tablet (768-1023px) | Bottom nav or hamburger menu, stacked layouts |
| Mobile (<768px) | Single column, simplified tables → card lists, full-width forms |

Priority: Desktop/laptop for TA and Admin (operational users). Applicant interface should work well on mobile (job seekers browse on phones).

---

## 15. Accessibility Fundamentals

- Semantic HTML (nav, main, section, article, table, form, button, a)
- Proper form labels (visible, associated via htmlFor)
- Keyboard navigation (tab order, focus management in modals)
- Visible focus states (teal outline ring)
- ARIA labels on icon-only buttons
- Sufficient contrast (all text passes WCAG AA)
- Tables with proper th/scope
- Dialog focus trapping (shadcn handles this)
- Status badge text (not color-only information)
