# Client-Centric Applicant Simulation Engine Design

**Date:** 2026-09-20  
**Status:** Approved by User  
**Target:** Backend CLI Seeder (`backend/scripts/simulate-applicants.ts`) and modular simulation services (`backend/src/services/simulation/`)

---

## 1. Executive Summary & Client Alignment

The Recruitment Management System (MEGS) supplies skilled front-line, technical, industrial, and service personnel to client enterprises across six core industry verticals:
1. **Manufacturing**: Electronics assembly, food processing lines, plastic extrusion, packaging operations, precision machinery plants.
   - *Key Roles:* Machine Operators, Assembly Crew, QA/QC Personnel, Production Supervisors.
2. **Logistics & Transport**: Multi-modal freight forwarding, delivery fleet operations, courier transport, route planning, supply chain dispatching.
   - *Key Roles:* Delivery Drivers, Messengers, Fleet Dispatchers, Logistics Clerks.
3. **Warehousing & Storage**: High-density distribution centers, inventory scanning, goods receiving, palletizing, order sorting, industrial forklift maneuvers.
   - *Key Roles:* Forklift Operators, Warehouse Crew, Material Handlers, Inventory Encoders.
4. **Retail, Sales & Distribution**: Hypermarkets, department stores, retail chains, fast-moving consumer goods (FMCG) distribution networks.
   - *Key Roles:* Sales Promo / Merchandisers, Cashiers & Baggers, Brand Ambassadors, Stock Clerks.
5. **Hotel & Restaurant**: Premier hotels, restaurant chains, catering services, banquet halls, cafeterias, hospitality dining floors.
   - *Key Roles:* Food Servers, Kitchen Helpers, Dining Stewards, Banquet Crew.
6. **Gaming & Casino**: Integrated resort gaming facilities, entertainment complexes, high-volume recreation centers, guest operations support.
   - *Key Roles:* Floor Attendants, Cashier Personnel, Utility Helpers, Front-Line Support.

The **Applicant Simulation Engine** automates the generation of realistic, localized Philippine candidate profiles and populates them across all recruitment lifecycle stages with real PDF resumes, profile headshots, interview records, client endorsements, and compliance verification checklists tailored specifically to these client needs.

---

## 2. System Architecture & Components

```
backend/
├── scripts/
│   └── simulate-applicants.ts            # CLI execution entrypoint
└── src/
    └── services/
        └── simulation/
            ├── client-profiles.data.ts   # Industry templates (skills, past employers, certifications)
            ├── applicant-generator.ts    # Profile synthesizer using @faker-js/faker
            ├── resume-pdf-builder.ts     # In-memory PDF synthesis via pdfkit
            ├── stage-simulator.ts        # Stage advancement & child record generator
            └── simulation-cleanup.ts     # Safe teardown of simulated records
```

### Component Breakdown
- **`client-profiles.data.ts`**: Houses authentic Philippine industry job templates, TESDA certifications (e.g. Heavy Equipment Operation - Forklift NC II, Food and Beverage Services NC II, Commercial Cooking NC II), driving licenses (Restrictions 1, 2, 3), and realistic past Philippine employers.
- **`applicant-generator.ts`**: Employs `@faker-js/faker` to generate Filipino names, mobile numbers (`0917-xxx-xxxx`), residences (Metro Manila, Calabarzon, Central Luzon, Cebu), and validly formatted statutory government IDs (SSS, PhilHealth, Pag-IBIG, TIN).
- **`resume-pdf-builder.ts`**: Uses `pdfkit` to compile a professional 1-page PDF document in memory matching the candidate's industry profile, then streams the buffer directly to the Supabase Storage `applicant-assets` bucket and registers a `StoredDocument` record.
- **`stage-simulator.ts`**: Binds the applicant to a `JobPosting`, generates realistic AI match scores and summary evaluations, and populates the appropriate relational records based on the target hiring stage.
- **`simulation-cleanup.ts`**: Scans exclusively for accounts tagged with the simulated email pattern (`*.sim.megs-recruitment.com`) and removes associated database records and Supabase Storage files without touching real accounts, client records, or system configuration.

---

## 3. Pipeline Stage & Data Model Specification

Each simulated applicant is mapped to a specific hiring stage, creating complete database representations:

| Pipeline Stage (`ApplicationStatus`) | Associated Child Records Created | Business Logic / Attributes |
| :--- | :--- | :--- |
| **`SUBMITTED`** | `Application` | Status: `SUBMITTED`, attached resume `StoredDocument`. |
| **`REVIEW`** | `Application`, `CandidateScore` | AI score (65%–95%), category breakdown (skills, experience, education, location), Gemini summary. |
| **`INITIAL_SCREENING`** | `Interview` | Type: `INITIAL_SCREENING`, scheduled timestamp, 7-day compliance deadline, recruiter notes. |
| **`CLIENT_ENDORSEMENT`** | `ClientEndorsement` | Linked to client organization, outcome: `ENDORSED` (or `PENDING`), client feedback notes. |
| **`FINAL_INTERVIEW`** | `Interview` | Type: `FINAL_INTERVIEW`, result: `PASS`, operational/supervisory evaluation notes. |
| **`COMPLIANCE`** | `ComplianceRequirement` records | Required pre-employment items (NBI Clearance, Fit-to-Work Medical, SSS E-1, PhilHealth MDR, Pag-IBIG MDF, Health Card/Drug Test). Status: `APPROVED` or `SUBMITTED`. |
| **`CONTRACT_AND_ORIENTATION`** | `Application` fields | `contractSigned: true`, contract timestamp, `orientationCompleted: true`, orientation timestamp and notes. |
| **`HIRED` / `DEPLOYED`** | `Employee`, `Deployment` | Generates active `Employee` record (Company ID, Hire Date) and `Deployment` record linked to Client and MRF. |
| **`TALENT_POOL`** | `TalentPoolMembership` | Retained candidate pool with availability status `AVAILABLE`, tags, and KNN feature embedding. |

For every stage transition, a corresponding `RecruiterDecision` record is stored with `actorId` matching the Talent Acquisition user to maintain an audit trail.

---

## 4. Media & Storage Pipeline

1. **PDF Resumes:**
   - Generated via `pdfkit` directly in memory (zero filesystem temp leak).
   - Uploaded to Supabase Storage: `applicant-assets/simulated/<userId>/resume.pdf`.
   - `StoredDocument` created in Postgres with `category: "ASSET"`, `mimeType: "application/pdf"`.
   - Downloadable via `/api/documents/<id>/download`.
2. **Profile Photos:**
   - Curated headshots / diverse avatar buffers uploaded to Supabase Storage: `applicant-assets/simulated/<userId>/avatar.jpg`.
   - Public/signed URL assigned to `ApplicantProfile.photoUrl`.

---

## 5. CLI Interface & Execution Modes

Registered in `backend/package.json`:
```json
{
  "scripts": {
    "seed:applicants": "tsx scripts/simulate-applicants.ts"
  }
}
```

### CLI Options
- `npm run seed:applicants`: Distributes 12–18 candidates across the 6 client industries and all hiring pipeline stages for existing open job postings.
- `npm run seed:applicants -- --count=24`: Generates a custom number of candidates.
- `npm run seed:applicants -- --industry=manufacturing`: Targets a specific client industry vertical.
- `npm run seed:applicants -- --jobId=5`: Attaches simulated applicants directly to a specific open Job Posting.
- `npm run seed:applicants -- --live-ai`: Sends generated PDF resumes through the live Gemini API endpoint and generates vector embeddings via `pgvector` instead of synthetic scoring.
- `npm run seed:applicants -- --purge`: Safely purges all simulated test applicants and their assets.

---

## 6. Security, Isolation & Safety Controls

1. **Domain Isolation:** All simulated users are registered with `applicant.<randomHash>@sim.megs-recruitment.com`.
2. **Auth Integrity:** Users are provisioned in Supabase Auth (`supabase.auth.admin.createUser`) with a standard test password (`Applicant123!`) and `email_confirm: true`, enabling manual login verification if needed.
3. **Preservation Guarantee:** The purge logic strictly selects users matching the `@sim.megs-recruitment.com` domain. Core administrator accounts, talent acquisition accounts, client entities (e.g. Star Meg / Obra), manpower requests, and scoring configurations are preserved.
