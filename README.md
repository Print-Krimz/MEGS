# MEGS — Recruitment Management System (RMS)

An intelligent, full-stack Recruitment Management, Applicant Tracking, and Talent Acquisition platform built with the PERN stack (PostgreSQL / Supabase, Express 5, React 19, Node.js), Prisma 7.8, Google Gemini AI, Nodemailer Gmail SMTP, and pgvector semantic talent pooling.

---

## 🏛 System Architecture

```text
MEGS/
├── backend/                  # Express 5 + TypeScript + Prisma 7.8 API Server
│   ├── prisma/
│   │   ├── schema/           # Multi-schema domain models (13 domain schemas)
│   │   │   └── migrations/   # Sequential SQL migrations
│   │   └── seed.ts           # Authoritative Admin/TA bootstrap & scoring seed
│   ├── scripts/              # Account sync, bucket init, & admin recovery tools
│   ├── src/
│   │   ├── controllers/      # Admin, TA, Applicant, Employee, Document controllers
│   │   ├── routes/           # RESTful API route definitions
│   │   ├── services/         # Business logic, scoring engine, AI resume parsing
│   │   ├── utils/            # Supabase, Prisma, Gemini, Mailer utilities
│   │   └── workers/          # Async background queue workers (Resume, Email)
│   └── server.ts             # Express server entry point (Port 3000)
│
├── frontend/                 # React 19 + Vite + Tailwind CSS v4 Single Page App
│   ├── src/
│   │   ├── components/       # Reusable UI primitives, dialogs, modals, badges
│   │   ├── layouts/          # Role-based layouts (Admin, TA, Applicant, Auth)
│   │   ├── pages/            # Domain views (Admin, TA, Applicant, Auth, Public)
│   │   ├── lib/api/          # Axios/Fetch API clients & TanStack Query hooks
│   │   └── routes.tsx        # Client-side router configuration
│   └── vite.config.ts        # Vite build & development server config (Port 5173)
```

---

## 🚀 Tech Stack

| Domain | Technology |
| :--- | :--- |
| **Backend Runtime** | Node.js (ES Modules), TypeScript, Express 5.2 |
| **Database & ORM** | PostgreSQL (Supabase), Prisma ORM 7.8 (Multi-Schema partitioned) |
| **Authentication & Storage** | Supabase Auth (Server-side service role) & Supabase Storage Vault |
| **Email Service** | Nodemailer with Gmail SMTP / Google App Passwords |
| **AI Assessment & Search** | Google Gemini (`gemini-2.5-flash`), Google Gemini Embeddings (`gemini-embedding-001`), pgvector |
| **Frontend Framework** | React 19, Vite 8, TypeScript |
| **UI & Styling** | Tailwind CSS v4, Lucide Icons |
| **State & Navigation** | TanStack Query v5, TanStack Router, TanStack Table |
| **Validation** | Zod v4 (strict contract validation) |

---

## 🔐 Development Security Hardening

> **Review status:** These changes are on the `security/surgical-auth-hardening` development branch and Draft Pull Request #2. They have not been merged into `main` or deployed to production.

This branch addresses five confirmed authentication and secret-handling vulnerabilities while preserving legitimate applicant, staff, onboarding, recovery, and notification behavior.

### 1. Strict JWT Verification

**Problem:** The previous custom token verification did not consistently prove every token was authentic and issued for this application. Incomplete signature, algorithm, issuer, audience, or time validation could allow forged or incorrectly configured tokens to reach protected endpoints.

**Fix:** Authentication now uses the provider-supported verification flow and explicitly validates the signature, permitted algorithm, issuer, audience, expiration, applicable time claims, subject, and authentication assurance level. The existing database identity lookup and active-account validation still run after the token is verified.

**Result:** Unsigned, tampered, expired, wrong-issuer, wrong-audience, and unsupported-algorithm tokens are rejected. Valid provider tokens continue through the normal login and account checks.

### 2. Backend Staff MFA Enforcement

**Problem:** Administrator and TA authorization could depend too heavily on frontend behavior. A staff session without cryptographically verified AAL2 could attempt to call protected backend operations directly.

**Fix:** The backend now requires a verified AAL2 session for ordinary administrator and TA operations. Only the exact authenticated routes needed for MFA enrollment, challenge, recovery, and logout bypass that requirement, and those routes cannot grant normal staff access.

**Result:** Staff cannot enter protected operations until MFA is verified. Applicants keep their intended access, and staff can still complete MFA setup or account recovery.

### 3. Consistent Account-State and Password-Change Enforcement

**Problem:** Disabled-account and forced-password-change restrictions were applied inconsistently. URL substring exceptions could also match unintended route variations.

**Fix:** Shared authorization policy now applies account-state and password-change rules in one place. Exceptions use explicit route and HTTP method combinations for onboarding, verification, password change, recovery, and logout.

**Result:** Restricted accounts cannot use ordinary application operations or bypass controls with modified URLs. Legitimate onboarding, recovery, password-change, and logout flows remain available.

### 4. Safe Secrets, Backup Encryption, and Staff Seeding

**Problem:** Production secret fallbacks and default seed credentials could create predictable secrets or silently reset existing staff passwords. Backup encryption also lacked an explicit key-version strategy for future key changes.

**Fix:** Production now requires explicit OTP, encryption, and staff seed credentials. Seeds no longer silently overwrite existing staff passwords or clear required-password-change state. New backup data records a key version, while the existing encryption format remains recoverable through an explicitly configured legacy key.

**Result:** Production cannot quietly start with insecure fallback secrets, seed runs cannot unexpectedly take over staff accounts, and existing backups remain recoverable during a controlled key transition. This branch does not run seeds, rotate keys, re-encrypt stored backups, or add a database migration.

### 5. Authentication-Token Leakage Prevention

**Problem:** Invitation, recovery, and OTP values could be written to logs. Missing production email configuration could report success without delivering mail, and query-string JWT authentication could expose reusable credentials through URLs and infrastructure logs.

**Fix:** Authentication values are redacted from mail and application logs. Production email fails clearly when SMTP is not configured. Debug invitation links and general query-string JWT authentication were removed, and notification authentication uses the compatible authenticated client flow with token-expiration handling.

**Result:** Usable authentication tokens no longer appear in normal logs or URLs, mail delivery failures are visible, and authenticated notifications continue without query-string credentials.

### Verification Results

- **34 security regression and compatibility tests passed across 7 test files.**
- Coverage includes forged and malformed JWTs, staff MFA, applicant access, account states, forced password changes, route-bypass attempts, login compatibility, recovery, mail redaction, OTP handling, and backup-key compatibility.
- Frontend lint completed successfully with existing warnings.
- Full backend TypeScript validation is currently blocked by the repository's pre-existing stale Prisma client.
- The frontend production build is currently blocked by the repository's pre-existing missing `leaflet` dependency.

### Required Before Deployment

Configure the documented JWT issuer and audience settings, OTP secret, versioned backup encryption key, and production SMTP settings. If legacy encrypted backups exist, retain the explicit legacy recovery key until an approved migration is completed.

---

## 📋 Prerequisites

- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **PostgreSQL / Supabase Project** (with `pgvector` enabled)
- **Google Gemini API Key** (from [Google AI Studio](https://aistudio.google.com/app/apikey))
- **Gmail Account with App Password** (for transactional emails & password resets)

---

## ⚙️ Installation & Environment Setup

### 1. Clone Repository
```bash
git clone https://github.com/Print-Krimz/MEGS.git
cd MEGS
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
```
Create a supabase account and create your own project
Configure `backend/.env` with your project credentials:
```env
# Database Configuration (PostgreSQL / Supabase)
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Server Port
PORT=3000

# Supabase Auth & Storage API
SUPABASE_URL="https://[YOUR_PROJECT_REF].supabase.co"
SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"
SUPABASE_SECRET_KEY="your-supabase-service-role-secret-key"
SUPABASE_JWT_ALGORITHMS="HS256,RS256,ES256"
SUPABASE_JWT_AUDIENCE="authenticated"
OTP_SECRET="replace-with-a-random-otp-hmac-secret"
BACKUP_ENCRYPTION_SECRET="replace-with-a-random-backup-encryption-secret"
BACKUP_ENCRYPTION_KEY_ID="v1"

# Google Gemini AI API Key & Model
GEMINI_API_KEY="your-google-gemini-api-key"
GEMINI_MODEL="gemini-2.5-flash"
GEMINI_EMBEDDING_MODEL="gemini-embedding-001"

# Email Configuration (Nodemailer / Gmail SMTP)
GMAIL_USER="your-email@gmail.com"
GMAIL_APP_PASSWORD="your-16-character-app-password"
EMAIL_FROM="MEGS Recruitment <your-email@gmail.com>"

# Optional Feature Flags
DYNAMIC_CANDIDATE_SCORING_ENABLED="true"
KNN_TALENT_POOLING_ENABLED="true"
CANDIDATE_SCORE_REVALIDATION_ENABLED="true"
```

---

## 📧 Email Service (Gmail SMTP) Setup

MEGS uses **Nodemailer** with Gmail SMTP for transactional notifications, including:
- ✉️ **Administrator & TA Invitation Links** (Account setup emails)
- 🔑 **Password Reset Requests** (Secure tokenized reset links)
- 📢 **Applicant Status Changes & Screening Results**
- 📅 **Interview Scheduling & Deployment Alerts**

### How to Generate a Google App Password:
1. Go to your **[Google Account Security Settings](https://myaccount.google.com/security)**.
2. Under "How you sign in to Google", ensure **2-Step Verification** is turned **ON**.
3. Go to **[App Passwords](https://myaccount.google.com/apppasswords)** (or search "App Passwords" in your account).
4. Enter an app name (e.g., `MEGS Recruitment`) and click **Create**.
5. Google will generate a **16-character passcode** (e.g., `abcd efgh ijkl mnop`).
6. Copy this passcode into `GMAIL_APP_PASSWORD` in `backend/.env` (spaces are automatically stripped by the server).
7. Set `GMAIL_USER` and `EMAIL_FROM` with your full Gmail address.

> **Development fallback:** Outside production, missing SMTP credentials use a redacted console preview. Production email delivery fails clearly when SMTP is not configured; tokens and OTP values are never written to this preview.

---

## 🗄 Database Migrations & Authoritative Bootstrap Seed

```bash
# Push database migrations
npx prisma migrate dev

# Generate Prisma Client
npx prisma generate

# Run authoritative bootstrap seed (Admin, TA, Scoring Config v1, Storage Buckets)
npm run seed
```

---

## 🔐 Seeded Accounts & Roles

Admin and Talent Acquisition (TA) roles do not allow public self-registration. `npm run seed` requires explicit `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TA_EMAIL`, and `TA_PASSWORD` values. `npm run seed:admin` requires the two administrator values. The seed does not change passwords or activation state for existing accounts, and newly created staff must change their bootstrap password.

| Role | Provisioning | Access / Capabilities |
| :--- | :--- | :--- |
| **System Administrator** | Explicit seed credentials | System configuration, user management, audit logs, AI scoring tuning, revalidation queue |
| **Talent Acquisition (TA)** | Explicit seed credentials | Job postings, MRF management, candidate screening, endorsements, compliance, deployments, talent pool |
| **Applicant** | Self-registered | Job application, document upload, status tracking, candidate profile management |

For existing unversioned backups, set `BACKUP_ENCRYPTION_LEGACY_SECRETS` temporarily to the exact former encryption secret before restore. New backups include `BACKUP_ENCRYPTION_KEY_ID`; older versioned keys can be supplied through `BACKUP_ENCRYPTION_LEGACY_KEYS`. Never commit these values.

---

## 💻 Frontend Setup & Development

```bash
cd ../frontend
npm install
```

---

## 🛠 Running the Application

### Development Servers

Open two terminals or run concurrently:

**Backend Server (Port 3000):**
```bash
cd backend
npm run dev
```

**Frontend Client (Port 5173):**
```bash
cd frontend
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 📦 Available Scripts

### Backend (`backend/`)
- `npm run dev`: Start backend development server with hot-reloading (`tsx watch`).
- `npm run build`: Compile TypeScript into `dist/`.
- `npm run start`: Run production server from `dist/server.js`.
- `npm test`: Run backend unit and integration tests (`vitest`).
- `npm run seed`: Run authoritative bootstrap seed (Admin, TA, Scoring Config v1, Storage Buckets).
- `npm run seed:accounts`: Sync or reset Admin and TA credentials in Supabase Auth & PostgreSQL.
- `npm run db:migrate`: Run Prisma database migrations.
- `npm run db:generate`: Regenerate Prisma Client.
- `npm run db:clean`: Wipe mock records and reset database to clean Admin/TA baseline.
- `npm run db:studio`: Open Prisma Studio database viewer.

### Frontend (`frontend/`)
- `npm run dev`: Start Vite development server at `http://localhost:5173`.
- `npm run build`: Type-check and compile production bundle with Vite.
- `npm run test`: Run frontend unit and component tests (`vitest`).
- `npm run preview`: Preview production build locally.
