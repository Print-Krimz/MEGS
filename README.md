# MEGS - Manpower Enterprise Growth System

An enterprise-grade Recruitment, Applicant Tracking (ATS), and Talent Acquisition backend built with Node.js, Express, TypeScript, Prisma ORM, Supabase PostgreSQL, and Google Gemini AI.

---

## Overview

MEGS streamlines the entire manpower recruitment lifecycle:
1. **Applicant Portal**: Profile management, work experiences, skills, document uploads, and one-click application submission with custom or default resume support.
2. **AI Resume Parsing & Matching**: Asynchronous resume parsing using Google Gemini AI, producing structured extraction summaries, match scores, and automated talent pooling.
3. **Deterministic & KNN Candidate Scoring**: Multi-dimensional candidate fit scoring (Skills, Experience, Location, Compliance, Education/Certifications) combined with vector embeddings (`all-MiniLM-L6-v2`) and pgvector KNN similarity search.
4. **Talent Acquisition Workflow**: Job posting lifecycle (DRAFT → OPEN → CLOSED), application pipeline stage management, recruiter audit decision trail, and interview SLA tracking (7-day compliance SLA).
5. **Client & MRF Management**: Client onboarding, Manpower Request Forms (MRF), and headcount fulfillment tracking.
6. **Compliance Checklist & Deployment**: Mandatory pre-employment document verification, deployment lifecycle transitions (PENDING_ORIENTATION → READY → DISPATCHED → ACTIVE → ENDED), and automatic Vault201 record creation upon hiring.
7. **Real-time Notifications & Reporting**: Server-Sent Events (SSE) for in-app alerts, PDF and XLSX exportable analytics reports.

---

## Tech Stack

- **Runtime & Language**: Node.js (ES Modules), TypeScript (Strict Mode)
- **Framework**: Express 5
- **Database & ORM**: PostgreSQL (Supabase), Prisma ORM with `@prisma/adapter-pg`
- **AI & Vector Search**: Google Gemini API (`@google/genai`), Xenova Transformers (`@xenova/transformers` / `all-MiniLM-L6-v2`), pgvector
- **Authentication & Storage**: Supabase Auth (JWT & RBAC), Supabase Storage (Signed URLs)
- **Reporting & Exports**: PDFKit (PDF generation), ExcelJS (Spreadsheet generation)
- **Testing**: Vitest

---

## Architecture & Project Structure

```
MEGS/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema & relationships
│   │   └── migrations/            # Migration history
│   ├── src/
│   │   ├── __tests__/             # Integration & constraint tests
│   │   ├── controllers/
│   │   │   ├── admin/             # System audit & user management
│   │   │   ├── applicant/         # Applicant profile & job applications
│   │   │   ├── core/              # Auth, documents, notifications
│   │   │   └── ta/                # TA jobs, pipeline, interviews, scoring
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts # Supabase JWT verification & RBAC
│   │   │   ├── upload.middleware.ts # Multer memory storage & Supabase upload
│   │   │   └── validate.middleware.ts # Zod schema validation
│   │   ├── routes/                # Route definitions & mounting
│   │   ├── schemas/               # Zod validation schemas
│   │   ├── services/
│   │   │   ├── admin/             # Admin service logic
│   │   │   ├── analytics/         # Pipeline metrics & PDF/XLSX export
│   │   │   ├── applicant/         # Profile & application logic
│   │   │   ├── core/              # Auth & notification services
│   │   │   ├── document/          # Stored document handling & signed URLs
│   │   │   ├── scoring/           # KNN & deterministic fit-score engine
│   │   │   └── ta/                # TA pipeline, MRF, interviews, posthire
│   │   ├── types/                 # Express & custom type definitions
│   │   ├── utils/                 # Prisma, Supabase, Gemini, Audit, SSE
│   │   └── workers/
│   │       ├── email.worker.ts    # Background email dispatcher
│   │       └── resume.worker.ts   # P-Queue rate-limited Gemini resume worker
│   ├── server.ts                  # Application entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── .gitignore
└── README.md
```

---

## Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **PostgreSQL Database** or a **Supabase Project** (with the `vector` extension enabled for KNN talent pooling)
- **Google Gemini API Key** (from [Google AI Studio](https://aistudio.google.com/app/apikey))

---

## Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Print-Krimz/MEGS.git
cd MEGS/backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```

Open `.env` and fill in your credentials:
```env
# Supabase PostgreSQL Connection String (Transaction Pooler)
DATABASE_URL="postgresql://postgres.[YOUR_PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Supabase Direct Connection String (Session Mode for Migrations)
DIRECT_URL="postgresql://postgres.[YOUR_PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Server Port
PORT=3000

# Supabase Auth & Storage API
SUPABASE_URL="https://[YOUR_PROJECT_REF].supabase.co"
SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"
SUPABASE_SECRET_KEY="your-supabase-service-role-secret-key"

# Google Gemini API Key
GEMINI_API_KEY="your-google-gemini-api-key"

# Feature Flags
DYNAMIC_CANDIDATE_SCORING_ENABLED="true"
KNN_TALENT_POOLING_ENABLED="true"
CANDIDATE_SCORE_REVALIDATION_ENABLED="true"
```

### 4. Run Database Migrations & Generate Prisma Client
```bash
# Push migrations and sync schema
npx prisma migrate dev

# Generate TypeScript Prisma Client
npx prisma generate
```

*(Optional)* Open Prisma Studio to inspect your database graphically:
```bash
npm run db:studio
```

---

## Running the Application

### Development Mode (with hot-reload)
```bash
npm run dev
```
The API server will start on `http://localhost:3000`.

### Type-checking
```bash
npx tsc --noEmit
```

### Running Tests
Execute the comprehensive Vitest test suite (includes database constraint and phase validation tests):
```bash
npm test
```

### Production Build
```bash
npm run build
npm start
```

---

## API Summary & Role-Based Access Control (RBAC)

All endpoints (except health and public auth) require a Bearer token in the `Authorization` header (`Authorization: Bearer <jwt_token>`).

### Roles:
- `APPLICANT`: Job search, profile management, application submissions.
- `TALENT_ACQUISITION`: Job posting creation, pipeline stage progression, candidate scoring, interview scheduling, MRF management, deployments.
- `ADMINISTRATOR`: System audit logs, dynamic policy management, user role assignments, scoring configuration revisions.

### Key Route Groups:
- **Auth & Profile**: `/api/auth/register`, `/api/auth/login`, `/api/applicant/profile`
- **Job Search & Applications**: `/api/applicant/jobs`, `/api/applicant/jobs/:id/apply`
- **TA Pipeline & Decisions**: `/api/ta/applications`, `/api/ta/applications/:id/status`, `/api/ta/applications/:id/decisions`
- **Candidate Scoring & KNN**: `/api/ta/jobs/:jobId/rank-candidates`, `/api/ta/jobs/:jobId/talent-pool`, `/api/ta/candidates/:candidateId/similar`
- **Interviews & Compliance**: `/api/ta/applications/:id/interviews`, `/api/ta/compliance/interviews`, `/api/ta/applications/:id/compliance`
- **Clients & MRF**: `/api/ta/clients`, `/api/ta/mrfs`, `/api/ta/mrfs/:id/link-job`
- **Deployments & Post-Hire**: `/api/ta/applications/:id/deploy`, `/api/ta/deployments/:id/status`, `/api/ta/applications/:id/hire`
- **Analytics & Exports**: `/api/ta/analytics/pipeline`, `/api/ta/reports/pipeline?format=pdf|xlsx`, `/api/ta/reports/deployments`
- **Real-Time Notifications (SSE)**: `/api/notifications/stream`

---

## License

This project is licensed under the ISC License.
