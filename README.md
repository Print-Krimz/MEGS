# MEGS - Manpower Enterprise Growth System

Backend service for the MEGS Recruitment, Applicant Tracking, and Talent Acquisition platform.

---

## Tech Stack

- **Runtime & Language**: Node.js (ES Modules), TypeScript
- **Framework**: Express 5
- **Database & ORM**: PostgreSQL (Supabase), Prisma ORM
- **AI & Vector Search**: Google Gemini API, Xenova Transformers, pgvector
- **Authentication & Storage**: Supabase Auth & Storage

---

## Prerequisites

- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **PostgreSQL Database** or **Supabase Project** (with `vector` extension enabled)
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
Create `.env` inside `backend/` based on `.env.example`:
```bash
cp .env.example .env
```

Fill in your credentials in `.env`:
```env
DATABASE_URL="postgresql://postgres.[YOUR_PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[YOUR_PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
PORT=3000

SUPABASE_URL="https://[YOUR_PROJECT_REF].supabase.co"
SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"
SUPABASE_SECRET_KEY="your-supabase-service-role-secret-key"

GEMINI_API_KEY="your-google-gemini-api-key"

DYNAMIC_CANDIDATE_SCORING_ENABLED="true"
KNN_TALENT_POOLING_ENABLED="true"
CANDIDATE_SCORE_REVALIDATION_ENABLED="true"
```

### 4. Run Database Migrations & Generate Prisma Client
```bash
# Push migrations to database
npx prisma migrate dev

# Generate Prisma Client
npx prisma generate
```

---

## Running the Application

### Development Mode
```bash
npm run dev
```

### Type-checking
```bash
npx tsc --noEmit
```

### Running Tests
```bash
npm test
```

### Production Build
```bash
npm run build
npm start
```
