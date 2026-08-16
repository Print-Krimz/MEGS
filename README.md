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
| **AI Assessment & Search** | Google Gemini (`gemini-2.5-flash`), Xenova Transformers, pgvector |
| **Frontend Framework** | React 19, Vite 8, TypeScript |
| **UI & Styling** | Tailwind CSS v4, Lucide Icons |
| **State & Navigation** | TanStack Query v5, TanStack Router, TanStack Table |
| **Validation** | Zod v4 (strict contract validation) |

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

# Google Gemini AI API Key & Model
GEMINI_API_KEY="your-google-gemini-api-key"
GEMINI_MODEL="gemini-2.5-flash"

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

> 💡 **Development Fallback:** If `GMAIL_USER` and `GMAIL_APP_PASSWORD` are not configured, the backend automatically falls back to a development console logger (`[DEV EMAIL LOG]`), printing all outbound emails and links directly to the terminal without failing.

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

## 🔐 Default Seeded Accounts & Roles

Admin and Talent Acquisition (TA) roles do not allow public self-registration. They are provisioned automatically via `npm run seed` or `npm run seed:accounts`:

| Role | Default Email | Default Password | Access / Capabilities |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin@megs-recruitment.com` | `AdminPassword123!` | System configuration, user management, audit logs, AI scoring tuning, revalidation queue |
| **Talent Acquisition (TA)** | `ta@megs-recruitment.com` | `TAPassword123!` | Job postings, MRF management, candidate screening, endorsements, compliance, deployments, talent pool |
| **Applicant** | *Self-registered* | *User-defined* | Job application, document upload, status tracking, candidate profile management |

*(Note: Custom credentials can be set via `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TA_EMAIL`, and `TA_PASSWORD` in `backend/.env`)*

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
