# MEGS Backend — Recruitment Management System API

The production API server and asynchronous worker engine for the MEGS Recruitment Management System, built with **Express 5**, **TypeScript**, **Prisma ORM 7.8** (Multi-Schema PostgreSQL with pgvector), **Supabase Auth & Storage**, and **Google Gemini AI**.

---

## 🏛 Architecture & Directory Structure

```text
backend/
├── prisma/
│   ├── schema/           # Multi-file partitioned schemas (10 domain files)
│   │   ├── migrations/   # Sequential SQL migrations
│   │   ├── main.prisma   # Datasource & generator config
│   │   ├── user.prisma   # Auth & user accounts
│   │   ├── applicant.prisma
│   │   ├── job.prisma
│   │   ├── scoring.prisma# AI scoring profiles & 768d vectors
│   │   ├── talent-pool.prisma
│   │   ├── employee.prisma
│   │   └── maintenance.prisma
│   └── seed.ts           # Authoritative admin & test account bootstrap
├── src/
│   ├── controllers/      # Admin, TA, Applicant, Document, and Employee controllers
│   ├── middleware/       # JWT auth guards, role authorizers, rate-limiters, Zod validators
│   ├── routes/           # RESTful API route definitions
│   ├── schemas/          # Zod validation schemas
│   ├── services/         # Business logic, scoring engine, AI resume parsing, report builders
│   │   └── scoring/      # Gemini 768d embeddings, KNN matching, dynamic weights
│   ├── utils/            # Prisma singleton, Supabase service client, Gemini client, Mailer
│   └── workers/          # Background queues for resume parsing and email delivery
├── server.ts             # Server entry point (Port 3000)
└── package.json          # Dependencies & npm scripts
```

---

## 🚀 Tech Stack

| Domain | Technology | Purpose |
| :--- | :--- | :--- |
| **Runtime & Language** | Node.js (ESM), TypeScript | Type-safe backend runtime |
| **HTTP Framework** | Express 5 | Centralized error handling, async routes, SSE streaming |
| **Database & ORM** | PostgreSQL, Prisma ORM 7.8 | Multi-schema partitioned models with connection pooling |
| **Vector Engine** | pgvector (768-dim) | Semantic candidate-to-job talent matching via cosine distance |
| **AI Assessment** | Google Gemini (gemini-2.5-flash) | Structured resume parsing & advisory requirement matching |
| **AI Embeddings** | Gemini (gemini-embedding-001) | 768-dimensional profile & requirement vector embeddings |
| **Authentication & Storage** | Supabase Service Role | Server-side token validation & private document vaults |
| **Email Service** | Nodemailer (Gmail SMTP) | Transactional notifications, invitations, and password resets |
| **Validation** | Zod | Strict request DTO validation middleware |

---

## 🛠 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and fill in your project credentials:

```bash
cp .env.example .env
```

Refer to [`.env.example`](.env.example) for the complete list of required environment variables and placeholder formats.

### 3. Initialize Database & Client

```bash
# Generate Prisma client from multi-file schemas
npm run db:generate

# Apply migrations
npm run db:migrate

# Seed Admin bootstrap account
npm run seed:admin
```

### 4. Development Server

Start the development server with live reload (runs on `http://localhost:3000`):

```bash
npm run dev
```

### 5. Production Build

```bash
npm run build
npm start
```
