# Client-Centric Applicant Simulation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a robust, modular simulation engine that populates realistic Philippine job applicants tailored to MEGS' 6 client industry sectors across all recruitment stages with in-memory generated PDF resumes, profile headshots, and stage-specific relational entities.

**Architecture:** A modular TypeScript service layer (`backend/src/services/simulation/`) containing domain profile definitions, an in-memory `pdfkit` resume builder, an applicant profile generator with `@faker-js/faker`, a stage progression simulator, and a teardown utility, driven by a versatile CLI runner (`backend/scripts/simulate-applicants.ts`).

**Tech Stack:** Node.js, Express 5, TypeScript, Prisma 7.8, `@faker-js/faker`, `pdfkit`, Supabase Storage / Auth, PostgreSQL.

---

## Global Constraints

- Runtime: TypeScript via `tsx` under Node.js in `backend/`.
- Database: Prisma 7.8 connecting to Supabase PostgreSQL.
- Storage: Supabase Storage bucket `applicant-assets` with StoredDocument records.
- Account Domain Isolation: All simulated accounts must use emails ending with `@sim.megs-recruitment.com`.
- Safety Guarantee: Purge routines must never delete or alter admin accounts, talent acquisition accounts, client records, manpower requests, or non-simulated applicant profiles.
- Client Sectors Covered:
  1. Manufacturing (Machine Operators, Assembly Crew, QA/QC, Production Supervisors)
  2. Logistics & Transport (Delivery Drivers, Messengers, Fleet Dispatchers, Logistics Clerks)
  3. Warehousing & Storage (Forklift Operators, Warehouse Crew, Material Handlers, Inventory Encoders)
  4. Retail, Sales & Distribution (Merchandisers, Cashiers/Baggers, Brand Ambassadors, Stock Clerks)
  5. Hotel & Restaurant (Food Servers, Kitchen Helpers, Dining Stewards, Banquet Crew)
  6. Gaming & Casino (Floor Attendants, Cashier Personnel, Utility Helpers, Front-Line Support)

---

### Task 1: Install `@faker-js/faker` & Register CLI Script

**Files:**
- Modify: `backend/package.json`

**Interfaces:**
- Produces: `@faker-js/faker` in `devDependencies`, `npm run seed:applicants` script in `backend/package.json`.

- [ ] **Step 1: Install `@faker-js/faker`**
Run: `npm install --save-dev @faker-js/faker` in `backend/`

- [ ] **Step 2: Add `seed:applicants` script to `backend/package.json`**
Add `"seed:applicants": "tsx scripts/simulate-applicants.ts"` to `scripts`.

- [ ] **Step 3: Verify installation**
Run: `npm run build` or verify `@faker-js/faker` can be imported via node/tsx.

- [ ] **Step 4: Commit**
```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore: add @faker-js/faker dependency and seed:applicants script"
```

---

### Task 2: Client Industry Domain Dataset

**Files:**
- Create: `backend/src/services/simulation/client-profiles.data.ts`

**Interfaces:**
- Produces:
  - `export type ClientIndustry = 'MANUFACTURING' | 'LOGISTICS' | 'WAREHOUSING' | 'RETAIL' | 'HOSPITALITY' | 'GAMING'`
  - `export interface IndustryRoleTemplate { title: string; skills: string[]; certifications: string[]; pastEmployers: string[]; summaryTemplates: string[]; experienceBullets: string[]; }`
  - `export const INDUSTRY_TEMPLATES: Record<ClientIndustry, IndustryRoleTemplate[]>`
  - `export const PH_CITIES: { city: string; province: string }[]`
  - `export const PH_UNIVERSITIES: string[]`

- [ ] **Step 1: Implement `client-profiles.data.ts`**
Include:
- Realistic Philippine cities (Makati, Taguig, Pasig, Quezon City, Caloocan, Biñan, Santa Rosa, Calamba, Angeles, Cebu City, Mandaue).
- TESDA NC II certifications (Forklift Operation NC II, Food & Beverage Services NC II, Commercial Cooking NC II, SMAW NC II).
- Professional Driver's License restriction codes (Restriction 1, 2, 3).
- Realistically styled Philippine enterprise employers for each vertical (e.g., San Miguel, Universal Robina, Jollibee Group, SM Retail, 2GO Logistics, Solaire Resort).

- [ ] **Step 2: Verify type checking**
Run `npx tsc --noEmit` in `backend/` to ensure no syntax or type errors.

- [ ] **Step 3: Commit**
```bash
git add backend/src/services/simulation/client-profiles.data.ts
git commit -m "feat(simulation): add client industry templates and Philippine domain datasets"
```

---

### Task 3: In-Memory PDF Resume Builder

**Files:**
- Create: `backend/src/services/simulation/resume-pdf-builder.ts`

**Interfaces:**
- Consumes: Candidate profile data (name, email, phone, location, summary, work experiences, skills, educations)
- Produces: `export async function buildResumePdfBuffer(data: ResumePdfData): Promise<Buffer>`

- [ ] **Step 1: Implement `buildResumePdfBuffer` with `pdfkit`**
- Create a `PDFDocument` with standard margins (40pt).
- Render Header: Full Name (bold, 18pt), contact bar (email, mobile, city/province).
- Render Section Divider & Professional Summary.
- Render Work Experience section: Role, Company, Date range, bullet points.
- Render Education section: Degree, University, Graduation year.
- Render Core Competencies / Skills as a formatted multi-column list.
- Stream chunks to a Buffer and return.

- [ ] **Step 2: Unit test PDF generation**
Create a quick test script to verify `buildResumePdfBuffer` resolves with a valid PDF buffer (> 1KB, starting with `%PDF-`).

- [ ] **Step 3: Commit**
```bash
git add backend/src/services/simulation/resume-pdf-builder.ts
git commit -m "feat(simulation): implement in-memory 1-page PDF resume builder"
```

---

### Task 4: Applicant Profile Generator & Media Uploader

**Files:**
- Create: `backend/src/services/simulation/applicant-generator.ts`

**Interfaces:**
- Consumes: `client-profiles.data.ts`, `resume-pdf-builder.ts`, Supabase client, Prisma client.
- Produces: `export async function generateSimulatedApplicant(industry?: ClientIndustry): Promise<SimulatedApplicantResult>`

- [ ] **Step 1: Implement `generateSimulatedApplicant`**
- Generate Filipino name, gender, birthday, mobile (`0917...`), statutory IDs (SSS, PhilHealth, Pag-IBIG, TIN).
- Pick an industry and role from `INDUSTRY_TEMPLATES`.
- Generate realistic past work experiences (1 to 3 positions) and education.
- Generate User in Supabase Auth via `supabase.auth.admin.createUser` with `email: applicant.<hash>@sim.megs-recruitment.com` and password `Applicant123!`.
- Upsert User and `ApplicantProfile` in Postgres with relational `WorkExperience`, `Education`, and `ApplicantSkill`.
- Generate PDF resume buffer via `buildResumePdfBuffer`, upload to Supabase Storage `applicant-assets/simulated/<userId>/resume.pdf`, create `StoredDocument`, set `ApplicantProfile.resumeUrl`.
- Upload a realistic profile headshot photo buffer to Supabase Storage and set `ApplicantProfile.photoUrl`.

- [ ] **Step 2: Verify applicant generation**
Run a single applicant generation test to confirm database insertion and Supabase Storage uploads succeed without error.

- [ ] **Step 3: Commit**
```bash
git add backend/src/services/simulation/applicant-generator.ts
git commit -m "feat(simulation): implement applicant profile generator with Supabase media uploads"
```

---

### Task 5: Pipeline Stage Progression Simulator

**Files:**
- Create: `backend/src/services/simulation/stage-simulator.ts`

**Interfaces:**
- Consumes: Applicant user ID, JobPosting ID, target stage `ApplicationStatus`.
- Produces: `export async function advanceApplicationToStage(params: StageAdvanceParams): Promise<Application>`

- [ ] **Step 1: Implement stage advancement handler**
- Create `Application` linking `userId` and `jobPostingId`.
- If stage is `REVIEW` or later: synthesize or calculate `CandidateScore` (80–95 for high stages, 65–75 for earlier stages), and save `aiScore`, `aiSummary`.
- If stage is `INITIAL_SCREENING` or later: create `Interview` record (`type: INITIAL_SCREENING`, `result: PASS`, 7-day compliance deadline).
- If stage is `CLIENT_ENDORSEMENT` or later: create `ClientEndorsement` (`outcome: ENDORSED`, notes from client evaluation).
- If stage is `FINAL_INTERVIEW` or later: create `Interview` record (`type: FINAL_INTERVIEW`, `result: PASS`, panel feedback).
- If stage is `COMPLIANCE` or later: create `ComplianceRequirement` records for NBI, Medical Fit-to-Work, SSS, PhilHealth, Pag-IBIG.
- If stage is `CONTRACT_AND_ORIENTATION` or later: set `contractSigned: true`, `orientationCompleted: true`.
- If stage is `HIRED` or `DEPLOYED`: create `Employee` record and `Deployment` record linked to Client and MRF.
- If stage is `TALENT_POOL`: create `TalentPoolMembership` with availability `AVAILABLE`.
- Log `RecruiterDecision` for each status transition to preserve realistic audit trails.

- [ ] **Step 2: Commit**
```bash
git add backend/src/services/simulation/stage-simulator.ts
git commit -m "feat(simulation): implement multi-stage hiring progression simulator"
```

---

### Task 6: Simulation Cleanup & Teardown Service

**Files:**
- Create: `backend/src/services/simulation/simulation-cleanup.ts`

**Interfaces:**
- Produces: `export async function purgeSimulatedApplicants(): Promise<{ purgedUsersCount: number, purgedStorageFilesCount: number }>`

- [ ] **Step 1: Implement `purgeSimulatedApplicants`**
- Query all users where `email` ends with `@sim.megs-recruitment.com`.
- Delete related deployments, employees, compliance requirements, client endorsements, interviews, scores, applications, profiles, and stored documents.
- Delete files from Supabase Storage `applicant-assets` under `simulated/`.
- Delete users from Supabase Auth (`supabase.auth.admin.deleteUser`).
- Delete users from PostgreSQL.
- Safety check: Verify zero real accounts or non-simulated records are modified.

- [ ] **Step 2: Commit**
```bash
git add backend/src/services/simulation/simulation-cleanup.ts
git commit -m "feat(simulation): implement safe cleanup and purge utility"
```

---

### Task 7: CLI Runner Entrypoint

**Files:**
- Create: `backend/scripts/simulate-applicants.ts`

**Interfaces:**
- Command: `tsx scripts/simulate-applicants.ts [options]`
- Options: `--count=<N>`, `--industry=<NAME>`, `--jobId=<ID>`, `--live-ai`, `--purge`

- [ ] **Step 1: Implement CLI arg parsing and batch runner**
- Parse arguments (`process.argv`).
- If `--purge`: execute `purgeSimulatedApplicants()` and print summary table.
- If seeding:
  - Query active job postings (or target `--jobId`).
  - Distribute generation evenly across the 6 client industries and target stages (`SUBMITTED`, `INITIAL_SCREENING`, `CLIENT_ENDORSEMENT`, `FINAL_INTERVIEW`, `COMPLIANCE`, `CONTRACT_AND_ORIENTATION`, `HIRED`, `DEPLOYED`, `TALENT_POOL`).
  - Print progress logs with colorful console status indicators and final summary table.

- [ ] **Step 2: Commit**
```bash
git add backend/scripts/simulate-applicants.ts
git commit -m "feat(simulation): add simulate-applicants CLI entrypoint"
```

---

### Task 8: End-to-End Execution & Verification

- [ ] **Step 1: Run Simulation CLI**
Execute: `npm run seed:applicants -- --count=12` in `backend/`
Verify:
- 12 candidates generated across industries and stages.
- PDF resumes generated and stored in Supabase Storage.
- Real candidate cards appear on the MEGS TA Kanban / Applicants board.

- [ ] **Step 2: Verify Safe Purge**
Execute: `npm run seed:applicants -- --purge` in `backend/`
Verify:
- Simulated candidates and storage assets purged cleanly.
- Preserved admin and TA accounts remain intact.

- [ ] **Step 3: Re-seed with fresh 12–18 candidates for presentation ready state**
Execute: `npm run seed:applicants -- --count=12`
Verify:
- Active demo dataset is populated and ready for showcase.
