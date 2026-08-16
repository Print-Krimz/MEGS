# MEGS Frontend — Specification & Architecture Design Document

> **Date:** 2026-08-14 / 2026-08-15
> **Primary Reference:** MEGS Full-Stack Recruitment Management System Specification

---

## 1. Architecture Decision

### Selected: Monolithic SPA with Role-Based Routing
- Single Vite + React 19 application
- TanStack Router with role-gated route trees
- Role-based layouts (ApplicantLayout, TALayout, AdminLayout, AuthLayout)
- Shared component library for common patterns
- Best fit for a 3-role internal tool with shared backend

---

## 2. Backend Contract Summary (Source of Truth)

### 2.1 Role Enum Values
```typescript
type Role = "APPLICANT" | "TALENT_ACQUISITION" | "ADMINISTRATOR"
```

### 2.2 API Mount Points
| Mount | Source |
|-------|--------|
| `GET /` | Health check |
| `GET /api/me` | Auth verification (returns `{ user }`) |
| `/api/auth` | Auth routes (login, register, password, invite) |
| `/api/applicants` | Applicant profile management |
| `/api/applicant-jobs` | Job browsing & applications |
| `/api/ta` | Talent Acquisition operations |
| `/api/admin` | Administrator operations |
| `/api/employees` | Employee & Digital 201 records |
| `/api/documents` | Document download proxy |
| `/api/notifications` | Notifications (REST + SSE stream) |

### 2.3 Application Status Pipeline
```
SUBMITTED → PARSING → REVIEW → INITIAL_SCREENING → CLIENT_ENDORSEMENT → FINAL_INTERVIEW → HIRED → COMPLIANCE → DEPLOYED
```

**Alternative branches:** `NEEDS_ATTENTION`, `MATCHED`, `TALENT_POOL`, `ONBOARDING`, `BACKOUT`, `ARCHIVED`

**Gate checks enforced by backend:**
1. → `CLIENT_ENDORSEMENT` requires passed `INITIAL_SCREENING` interview
2. → `FINAL_INTERVIEW` requires `ENDORSED` client endorsement
3. → `HIRED` requires passed `FINAL_INTERVIEW`
4. → `DEPLOYED` requires all mandatory compliance `APPROVED` and unexpired

### 2.4 Deployment Status Machine
```
PENDING_ORIENTATION → READY → DISPATCHED → ACTIVE → ENDED | CANCELLED
```

### 2.5 Standard Response Format
```typescript
// Success
{ success: true, message: string, data: T }

// Error
{ success: false, message: string, error?: unknown }

// Validation (400)
{ success: false, message: string, error: [{ field: string, message: string }] }
```

### 2.6 Key Enums (frontend must mirror)
```typescript
enum ApplicationStatus {
  SUBMITTED, PARSING, REVIEW, NEEDS_ATTENTION, MATCHED, TALENT_POOL,
  INITIAL_SCREENING, CLIENT_ENDORSEMENT, FINAL_INTERVIEW,
  HIRED, ONBOARDING, COMPLIANCE, DEPLOYED, BACKOUT, ARCHIVED
}

enum DeploymentStatus { PENDING_ORIENTATION, READY, DISPATCHED, ACTIVE, ENDED, CANCELLED }
enum EmploymentStatus { ACTIVE, INACTIVE, SEPARATED, AVAILABLE_FOR_REDEPLOYMENT }
enum InterviewType { INITIAL_SCREENING, FINAL_INTERVIEW }
enum JobStatus { DRAFT, OPEN, CLOSED }
enum TalentPoolStatus { ACTIVE, PLACED, INACTIVE }
enum CandidateAvailability { AVAILABLE, UNAVAILABLE, UNKNOWN }
enum TalentPoolContactOutcome { INTERESTED, NOT_INTERESTED, NO_RESPONSE, UNAVAILABLE }
enum DocumentCategory { RESUME, PHOTO, ASSET, POST_HIRE, VAULT_201 }
enum AssetVerificationState { UNVERIFIED, VERIFIED, REJECTED, EXPIRED }
```

---

## 3. Frontend Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Build | Vite |
| Routing | TanStack Router (code-based) |
| Server State | TanStack Query v5 |
| Tables | TanStack Table v8 |
| Validation | Zod |
| Styling | Tailwind CSS v4 (CSS-first `@theme`) |
| Icons | Lucide React |
| HTTP | Fetch API (typed client) |

---

## 4. Directory Structure

```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css                    # Tailwind v4 entry + design tokens
    ├── components/
    │   ├── common/
    │   │   ├── PageHeader.tsx
    │   │   ├── StatusBadge.tsx
    │   │   ├── ScoreBadge.tsx
    │   │   ├── PipelineIndicator.tsx
    │   │   ├── EmptyState.tsx
    │   │   ├── LoadingState.tsx
    │   │   ├── ErrorState.tsx
    │   │   ├── ConfirmDialog.tsx
    │   │   ├── NotificationBell.tsx
    │   │   ├── SearchFilters.tsx
    │   │   └── Pagination.tsx
    │   └── ui/
    │       ├── Button.tsx
    │       ├── Input.tsx
    │       ├── Select.tsx
    │       ├── Textarea.tsx
    │       ├── Dialog.tsx
    │       └── Badge.tsx
    ├── layouts/
    │   ├── AuthLayout.tsx
    │   ├── ApplicantLayout.tsx
    │   ├── TALayout.tsx
    │   └── AdminLayout.tsx
    ├── pages/
    │   ├── auth/
    │   │   ├── LoginPage.tsx
    │   │   ├── RegisterPage.tsx
    │   │   ├── ForgotPasswordPage.tsx
    │   │   ├── ResetPasswordPage.tsx
    │   │   └── SetupAccountPage.tsx
    │   ├── applicant/
    │   │   ├── ApplicantDashboard.tsx
    │   │   ├── ProfilePage.tsx
    │   │   ├── JobsPage.tsx
    │   │   ├── JobDetailPage.tsx
    │   │   ├── MyApplicationsPage.tsx
    │   │   ├── ApplicationDetailPage.tsx
    │   │   └── NotificationsPage.tsx
    │   ├── ta/
    │   │   ├── TADashboard.tsx
    │   │   ├── ApplicationsPage.tsx
    │   │   ├── ApplicationDetailPage.tsx
    │   │   ├── InterviewsPage.tsx
    │   │   ├── MRFListPage.tsx
    │   │   ├── MRFCreatePage.tsx
    │   │   ├── MRFDetailPage.tsx
    │   │   ├── TalentPoolPage.tsx
    │   │   ├── ClientsPage.tsx
    │   │   ├── ClientDetailPage.tsx
    │   │   ├── CompliancePage.tsx
    │   │   ├── DeploymentsPage.tsx
    │   │   ├── DeploymentDetailPage.tsx
    │   │   ├── JobPostingsPage.tsx
    │   │   ├── JobPostingDetailPage.tsx
    │   │   ├── AnalyticsPage.tsx
    │   │   └── EmployeesPage.tsx
    │   ├── admin/
    │   │   ├── AdminDashboard.tsx
    │   │   ├── UsersPage.tsx
    │   │   ├── UserDetailPage.tsx
    │   │   ├── ScoringConfigPage.tsx
    │   │   ├── AuditLogPage.tsx
    │   │   └── RevalidationStatusPage.tsx
    │   └── common/
    │       ├── NotFoundPage.tsx
    │       ├── ForbiddenPage.tsx
    │       └── ChangePasswordPage.tsx
    ├── hooks/
    │   ├── useAuth.ts
    │   ├── useNotifications.ts
    │   └── useDocumentDownload.ts
    ├── lib/
    │   ├── api/
    │   │   ├── client.ts
    │   │   ├── auth.api.ts
    │   │   ├── applicant.api.ts
    │   │   ├── applicant-jobs.api.ts
    │   │   ├── ta.api.ts
    │   │   ├── admin.api.ts
    │   │   ├── employees.api.ts
    │   │   ├── documents.api.ts
    │   │   └── notifications.api.ts
    │   ├── types/
    │   │   ├── auth.types.ts
    │   │   ├── applicant.types.ts
    │   │   ├── application.types.ts
    │   │   ├── ta.types.ts
    │   │   ├── admin.types.ts
    │   │   ├── client.types.ts
    │   │   ├── employee.types.ts
    │   │   ├── document.types.ts
    │   │   ├── notification.types.ts
    │   │   └── enums.ts
    │   └── utils.ts
    └── providers/
        ├── AuthProvider.tsx
        └── QueryProvider.tsx
```
