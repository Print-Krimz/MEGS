# MEGS Tech Stack Specification

This document defines the authoritative tech stack versions, architectural boundaries, database design, AI integration, and security constraints for the MEGS Recruitment Management System.

---

## 1. Core Architecture Overview

MEGS is built as a monolithic PERN (PostgreSQL, Express 5, React 19, Node.js) platform with dedicated AI screening, vector similarity search, and automated talent matching capabilities.

```text
┌────────────────────────────────────────────────────────┐
│              Frontend (React 19 + Vite)                │
│    TanStack Query · TanStack Router · Tailwind CSS v4   │
└──────────────────────────┬─────────────────────────────┘
                           │ Authenticated HTTP / SSE
┌──────────────────────────▼─────────────────────────────┐
│                 Backend (Express 5 + TS)               │
│  Controllers · Middleware · Services · Workers · BullMQ │
├──────────────────────────┬─────────────────────────────┤
│   Supabase Service API   │        Prisma ORM 7.8       │
│  (Auth, Storage, Vault)  │    (Multi-Schema Postgres)  │
└────────────┬─────────────┴──────────────┬──────────────┘
             │                            │
             ▼                            ▼
┌──────────────────────────┐ ┌───────────────────────────┐
│     Google Gemini AI     │ │    PostgreSQL (Supabase)  │
│  (gemini-2.5-flash LLM)  │ │ (pgvector 384-dim KNN)    │
└──────────────────────────┘ └───────────────────────────┘
```

---

## 2. Technology Stack & Versions

| Layer | Technology | Version | Purpose / Notes |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js | `v20.x+` | ES Modules (`"type": "module"`), strict async patterns |
| **Language** | TypeScript | `v5.x` | Strict type-checking with `@tsconfig/node20` |
| **Backend** | Express | `v5.x` | Modern routing, centralized error handlers, SSE streaming |
| **Database** | PostgreSQL | `v15+` | Hosted on Supabase with `vector` extension enabled |
| **ORM** | Prisma | `v7.8+` | Multi-file schemas (`prisma/schema/*.prisma`) |
| **AI Assessment** | Google Gemini API | `gemini-2.5-flash` | Automated resume parsing & advisory requirement matching |
| **Vector Search** | Xenova Transformers | `@xenova/transformers` | Local 384-dim embeddings (`all-MiniLM-L6-v2`) stored via pgvector |
| **Authentication** | Supabase Auth (Server-side) | `sb_secret_xxx` | Token verification & secure session handling on server |
| **Storage Vault** | Supabase Storage | Private Buckets | Resumes & 201 compliance files accessed via signed URLs |
| **Frontend** | React | `v19.x` | Component composition, functional modern patterns |
| **Build Tool** | Vite | `v6.x` | High-performance bundling and development server |
| **Data Fetching** | TanStack Query | `v5.x` | Server state management, automatic caching & invalidation |
| **Routing** | TanStack Router / React Router | `v7.x` | Type-safe declarative client routing with role guards |
| **Styling** | Tailwind CSS | `v4.x` | CSS-first tokens, industrial utilitarian design system |
| **Validation** | Zod | `v3.x` | Strict runtime request/response and form validation |

---

## 3. Database Architecture (Prisma Multi-Schema)

Prisma 7.8 organizes schemas across modular domain files in `backend/prisma/schema/`:

- **`main.prisma`**: Datasource configuration with PgBouncer connection pooling (`DATABASE_URL`, port 6543) and direct connection (`DIRECT_URL`, port 5432).
- **`user.prisma`**: User accounts, roles (`ADMINISTRATOR`, `TALENT_ACQUISITION`, `APPLICANT`), password reset tokens, and recruiter profiles.
- **`applicant.prisma`**: Applicant profiles, work experience, education, skills, trainings, references, and applications.
- **`job.prisma`**: Manpower Requests (MRF), Job Postings, and Job Categories.
- **`scoring.prisma`**: Dynamic scoring configurations, weight profiles, dimension scores, AI evaluation logs, and audit trails.
- **`talent-pool.prisma`**: Reusable candidate pool, availability statuses, contact records, and KNN matching.
- **`client.prisma`**: Host companies/clients, client contacts, and client endorsement logs.
- **`employee.prisma`**: Digital 201 records, employment status, deployments, and work history.
- **`document.prisma`**: Secure document tracking, verification statuses, and expiration dates.

---

## 4. Security & Isolation Constraints

1. **Supabase Server Isolation:**
   - The Supabase client is initialized exclusively on the backend (`backend/src/utils/supabase.ts`) using the Service Role Secret (`SUPABASE_SECRET_KEY`).
   - The client application never imports `@supabase/supabase-js` or holds administrative credentials.
2. **Private Document Storage:**
   - Document files (resumes, government clearances, health certificates) are stored in private Supabase Storage buckets.
   - Files are uploaded via server-authenticated endpoints (`/api/documents/upload`), with malware and MIME-type verification.
   - Access is restricted to short-lived signed URLs generated dynamically on-demand with role verification.
3. **Single-Write Lifecycle:**
   - Applicant sensitive records (e.g. initial resume uploads) cannot be overwritten directly by unauthorized actors; updates generate new versioned records with audit trails.
4. **SSE Realtime Streaming:**
   - Real-time notifications stream through `/api/notifications/stream` over authenticated Server-Sent Events, avoiding unnecessary heavy WebSocket dependencies.

---

## 5. Deterministic AI Scoring & Matching Architecture

1. **Resume Ingestion & Parsing:**
   - Asynchronous worker (`resume.worker.ts`) reads uploaded PDF/DOCX resumes.
   - Calls Google Gemini (`gemini-2.5-flash`) with structured output schemas to extract education, experience, technical skills, and certifications.
2. **Advisory AI Fit:**
   - Gemini evaluates candidate qualifications against MRF/Job requirements, providing an advisory baseline score (threshold 60).
3. **Vector Similarity (KNN):**
   - `@xenova/transformers` computes candidate profile embeddings.
   - Cosine similarity is queried against Job Posting embeddings using pgvector `<=>` operator.
4. **Dynamic Weighted Composite Fit:**
   - Overall Candidate Fit combines:
     $$\text{Overall Fit} = w_{\text{skills}} \cdot S_{\text{skills}} + w_{\text{exp}} \cdot S_{\text{exp}} + w_{\text{edu}} \cdot S_{\text{edu}} + w_{\text{cert}} \cdot S_{\text{cert}}$$
   - Configured dynamically via Admin scoring profiles in `scoring.prisma`.
