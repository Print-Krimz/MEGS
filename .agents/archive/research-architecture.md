# CAP2 Research-Paper Alignment and Remediation Plan

## 1. Executive Summary

Current weighted alignment is approximately **39/100: partially aligned with significant corrections required**.

The backend already supports authentication, applicant profiles, job applications, recruitment statuses, interviews, notifications, basic post-hire records, and administration. Deterministic TF-IDF, cosine similarity, exact KNN, configurable Candidate Fit scoring, and durable revalidation also exist in source and pass focused tests.

Critical gaps remain:

- No React/Tailwind frontend.
- Scoring migrations are unapplied and feature flags are absent.
- No Client, MRF, Deployment, Contract, report-export, consent, or complete compliance lifecycle.
- Sensitive documents use public URLs.
- No dashboard, time-to-fill analytics, XLSX/PDF reporting, email reminders, integration tests, UAT, or research-evaluation evidence.
- Several workflows allow invalid status transitions.
- The paper inaccurately describes Gemini and the implemented algorithms.

### Locked decisions

- Freeze the existing Gemini integration exactly:
  - Model: `gemini-2.5-flash`.
  - Input: extracted resume text, job title, job requirements.
  - Output: `score`, `summary`, `strengths`, `gaps`.
  - Persistence: `Application.aiScore` and `Application.aiSummary`.
  - Threshold: score ≥60 produces `MATCHED`; lower scores produce `TALENT_POOL`.
  - No new Gemini calls, prompts, fields, OCR, NER, vector normalization, or responsibilities.
- Preserve the tested algorithm implementation:
  - capped, sublinear TF-IDF;
  - lexical cosine similarity;
  - exact cosine-KNN;
  - KNN retrieves candidates and deterministic Candidate Fit ranks them.
- Revise the paper where its Gemini, TF-IDF, cosine, or KNN descriptions conflict with these locked implementations.
- Preserve the three roles: Applicant, Talent Acquisition, and Administrator.
- Applicant views remain status-only; they must never receive Gemini scores, Gemini summaries, deterministic scores, weight breakdowns, or KNN similarity.
- Implement incrementally with a quality gate after every phase.

## 2. Research-to-System Traceability Matrix

| ID | Research requirement | Paper reference | Current implementation/evidence | Status | Gap and required action | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | Centralized web hiring/deployment system | Lines 191-193, 440-442 | Express API in `backend/server.ts`; no frontend | Partially Aligned | Build the role-based React application and deployment domain | Critical |
| R-02 | Applicant registration/profile | Lines 199-204, 275-278 | Applicant routes/services and `ApplicantProfile` | Fully Aligned backend | Add frontend and E2E evidence | High |
| R-03 | Resume upload | Lines 201-214 | Default/custom uploads in applicant services | Partially Aligned | Replace public URLs with private document records | Critical |
| R-04 | Job board/application history | Lines 277-278 | `/api/applicant-jobs/*` | Partially Aligned | Add applicant UI; decide public job visibility through documented contract | High |
| R-05 | PDF text extraction | Lines 206-214 | `pdf-parse` in `resume.worker.ts` | Partially Aligned | Support and document text-based PDFs only | High |
| R-06 | OCR, DOCX, and NER extraction | Lines 206-214, 463, 471 | Not present; conflicts with frozen Gemini contract | Requires Clarification—resolved | Revise paper to remove OCR, DOCX, NER, and automatic structured-field claims | Critical documentation |
| R-07 | Gemini assessment | Lines 534, 567, 595-596 | `gemini.ts:39-104`; `resume.worker.ts:119-157` | Documented but Implemented Differently | Document the exact frozen assessment contract | Critical documentation |
| R-08 | Human hiring authority | Lines 147, 326 | TA invokes hiring operations | Partially Aligned | Add prerequisite enforcement and recruiter-decision records | Critical |
| R-09 | TF-IDF with stuffing protection | Lines 546-551 | `backend/src/scoring/text.ts` | Documented but Implemented Differently | Keep code; correct paper formula, corpus, cap, logarithms, normalization | Critical documentation |
| R-10 | Cosine similarity | Lines 558-561 | Lexical TF-IDF cosine in `text.ts` | Documented but Implemented Differently | Remove Gemini-normalized/semantic-vector claims | Critical documentation |
| R-11 | KNN talent pooling | Lines 230, 552-556 | Exact cosine-KNN in `knn.ts` and talent-pool service | Documented but Implemented Differently | Replace Euclidean paper formula with exact cosine-KNN specification | Critical documentation |
| R-12 | 40/25/15/10/10 Candidate Fit | Line 458 | Implemented in scoring configuration/service | Partially Aligned | Deploy schema and supply structured job requirements for every dimension | Critical |
| R-13 | Configurable weights totaling 100% | Ranking/configuration requirements | Admin configuration source exists | Partially Aligned | Apply migration, enable routes, add Admin UI/integration tests | Critical |
| R-14 | Historical score reproducibility | Reporting/audit objectives | Versioned immutable CandidateScore source | Partially Aligned | Deploy and preserve source/configuration versions | High |
| R-15 | Dynamic talent pool | Lines 224-230, 271 | Archive/restore plus disabled KNN routes | Partially Aligned | Enable KNN and add availability/re-engagement state | High |
| R-16 | Client and MRF management | Lines 138, 216-230, 452-454 | Free-text JobPosting only | Not Implemented | Add Client and ManpowerRequest domains | Critical |
| R-17 | Controlled recruitment pipeline | Lines 270, 604 | Nine-state enum and partial transition map | Partially Aligned | Centralize state machine and block transition bypasses | Critical |
| R-18 | Interviews and seven-day compliance | Lines 138, 463-486 | Interview service and SLA report | Partially Aligned | Separate interview SLA from onboarding-compliance deadline | High |
| R-19 | Digital 201 file | Lines 281, 475, 484 | Vault201/PostHireDocument | Partially Aligned | Add checklist, private files, history, access audit | Critical |
| R-20 | Deployment record | Lines 224-230, 272-283 | No Deployment model | Not Implemented | Add deployment, client/site, contract, dispatch, and status history | Critical |
| R-21 | Active deployment monitoring | Lines 605-606 | No implementation | Not Implemented | Add query APIs, alerts, dashboard, and UI | Critical |
| R-22 | Expiry and compliance email alerts | Lines 228-230, 535, 595 | In-app notifications only | Not Implemented | Add durable SMTP outbox and scheduler using Nodemailer | High |
| R-23 | In-app real-time notifications | Lines 441-442 | REST and SSE notification routes | Fully Aligned backend | Add reconnect/event-ID behavior and UI | Medium |
| R-24 | Recruiter dashboard | Lines 232-238, 606 | No frontend/dashboard API | Not Implemented | Add verified KPI API and charts | Critical |
| R-25 | Time-to-fill/drop-off metrics | Lines 238, 477, 606 | Interview SLA is not time-to-fill | Not Implemented | Add status history and formal KPI definitions | High |
| R-26 | PDF/XLSX reports | Lines 240-246, 464, 478, 607 | No export service | Not Implemented | Add report jobs, files, templates, and validation | High |
| R-27 | Admin user management | Lines 261-265 | `/api/admin/users` | Fully Aligned backend | Add frontend and staff-provisioning tests | Medium |
| R-28 | Comprehensive audit trail | Lines 254, 263, 586-588 | AuditLog plus selected calls | Partially Aligned | Define and enforce a complete auditable-event catalog | High |
| R-29 | Configuration and backup | Line 264 | Policy/scoring configuration; no backup workflow | Partially Aligned | Use managed backups and a restore-drill runbook; revise “backup module” wording | High |
| R-30 | JWT authentication and RBAC | Lines 459, 570, 600-601 | Supabase JWT plus DB roles | Partially Aligned | Migrate browser transport to server-owned HttpOnly cookies | Critical |
| R-31 | Privacy and consent | Lines 331, 585-588 | No consent model; public document URLs | Not Implemented | Add versioned consent and private storage access | Critical |
| R-32 | Upload safety | Security and 201 testing claims | 5 MB limit only | Not Implemented | Add file-kind allowlists, magic-byte checks, hashing, quarantine, malware scan | Critical |
| R-33 | Validation/error handling | Functional/NFR requirements | Zod on many routes; inconsistent domain errors | Partially Aligned | Add typed domain errors and centralized redaction | High |
| R-34 | Performance/scalability | Lines 444-494 | KNN cap/telemetry source only | Partially Aligned | Enable telemetry and benchmark 5,000 eligible candidates | Medium |
| R-35 | Responsive/accessibility/browser support | Lines 514-526, 541-542 | No frontend | Not Implemented | Implement and verify WCAG/keyboard/responsive/browser requirements | High |
| R-36 | Unit testing | Lines 461-486 | 28 tests currently pass | Fully Aligned for recent scoring source | Expand coverage to all modules | Medium |
| R-37 | Integration/system/UAT/ISO evaluation | Lines 461-494 | No reproducible evidence | Not Implemented | Add live integration, E2E, UAT, performance, security, and ISO evidence | Critical |
| R-38 | Three-layer client/server architecture | Lines 440-442, 575-584 | Backend application/data layers exist | Partially Aligned | Add presentation layer and update architecture diagram | High |
| R-39 | PostgreSQL data model | Lines 454, 564 | Prisma/Postgres present | Partially Aligned | Add absent business entities and apply migrations | Critical |
| R-40 | Role matrix | Lines 260-320 | Admin inherits all TA route mutations | Documented but Implemented Differently | Enforce per-operation permissions and correct contradictory paper matrix | High |
| R-41 | Payroll/background/government exclusions | Lines 323-332 | No related integrations | Fully Aligned | Keep explicitly out of scope | None |
| R-42 | Expected dashboard/export/deployment outputs | Lines 602-607 | Only API responses and basic records exist | Not Implemented | Implement output modules and validate against fixtures | High |

## 3. Existing System Architecture

### Current flows

- **Frontend:** absent.
- **Backend:** Express routes → controllers → services → Prisma/Supabase/Gemini.
- **Database:** Prisma connects directly to Supabase PostgreSQL.
- **Authentication:** login returns Supabase access and refresh tokens; protected routes verify `Authorization: Bearer`.
- **Applicant processing:** authenticated Applicant creates profile, uploads a resume, and applies.
- **Gemini:** the existing worker extracts text from a text-based PDF, sends that text and job context to Gemini, stores its assessment, and applies the threshold-60 status rule.
- **Deterministic ranking:** source builds applicant features, calculates five dimensions, persists a versioned score, and offers TF-IDF/cosine KNN retrieval. Its migrations are unapplied and feature flags are absent.
- **Hiring:** TA can update statuses, schedule interviews, upload post-hire documents, and create Vault201.
- **Deployment:** absent after Vault201 creation.
- **Notifications:** database records plus an in-process SSE emitter.
- **Reports/dashboard:** absent except an interview SLA response and inactive scoring-quality service.

### Target architecture

```text
React/Vite frontend
        |
Credentialed Express REST API
        |
Authorization + validation + business services
        |
        +-- Supabase Auth through server-owned cookies
        +-- Prisma -> Supabase PostgreSQL
        +-- Private Supabase Storage
        +-- Frozen Gemini assessment flow
        +-- Deterministic scoring/KNN services
        +-- Durable revalidation and email-outbox workers
```

The frontend must never import Supabase, receive tokens, or access the database/storage directly.

## 4. Misalignment Findings

### Codebase must be updated

- Deploy and activate deterministic scoring.
- Add Client/MRF, application-history, recruiter-decision, compliance, deployment, document, report, consent, and outbox domains.
- Enforce legal application transitions and post-hire prerequisites.
- Replace public document URLs with authorized private access.
- Implement server-owned cookie authentication, exact-origin CORS, CSRF protection, and rate limiting.
- Implement dashboard, reports, alerts, and the complete frontend.
- Expand audit logging and testing.

### Research paper documentation must be updated

- Remove Gemini OCR, NER, structured-field extraction, vector normalization, and official Candidate Fit claims.
- Describe Gemini as the frozen PDF-text assessment producing score/summary/strengths/gaps.
- Replace the TF-IDF formula with the executable capped/sublinear formula.
- Describe cosine as lexical TF-IDF cosine, not semantic synonym recognition.
- Replace Euclidean KNN with exact cosine-KNN and document K, filtering, tie-breaking, and 5,000-candidate cap.
- Document Gemini score and deterministic Candidate Fit as separate outputs.
- Replace direct Bcrypt wording with Supabase Auth credential management.
- Correct the role matrix and exact application statuses.
- Describe backup as managed infrastructure plus restore drills, not an application CRUD module.
- Use future tense until each module has implementation and test evidence.

## 5. Gemini Role Preservation Assessment

### Frozen contract

The following files and behaviors are protected from functional modification:

- `backend/src/utils/gemini.ts`
- Gemini prompt text.
- Model name and response MIME type.
- Inputs and response object.
- `Application.aiScore` and `Application.aiSummary`.
- `MATCH_SCORE_THRESHOLD = 60`.
- Success, missing-resume, and Gemini-failure status behavior.
- Automatic application-analysis trigger.

### Separation from deterministic scoring

- Gemini retains its existing assessment and status-gating responsibilities.
- Deterministic Candidate Fit remains a separate explainable ranking record.
- TF-IDF/cosine/KNN must never write `aiScore` or `aiSummary`.
- Gemini must never select Candidate Fit weights or write `CandidateScore`.
- TA UI displays two clearly labeled sections:
  - “Gemini Resume Assessment”
  - “Deterministic Candidate Fit”
- Applicant UI displays only application status.

### Paper corrections

Revise paper lines 206-214, 458, 534, 558-561, 567, 595-596, and 602-604 to match the frozen contract. Resume support becomes “text-based PDF extraction followed by Gemini job-fit assessment.” OCR, DOCX, NER, automatic structured-form population, and Gemini-generated mathematical vectors are removed.

## 6. Prioritized Implementation Plan

### Public interfaces and data contracts

All APIs retain `{ success, message, data }`.

New or revised API groups:

- Auth:
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
  - `GET /api/me`
- Documents:
  - `GET /api/documents/:id/download`
- Clients/MRF:
  - `/api/ta/clients`
  - `/api/ta/manpower-requests`
- Decisions/compliance:
  - `/api/ta/applications/:id/decisions`
  - `/api/ta/applications/:id/compliance`
- Deployment:
  - `/api/ta/deployments`
  - `/api/ta/deployments/:id/status`
- Dashboard/reports:
  - `/api/ta/dashboard/summary`
  - `/api/ta/reports`
  - `/api/ta/reports/:id/download`
- Existing scoring configuration/ranking/talent-pool endpoints remain unchanged.

New central entities:

- `StoredDocument`
- `ApplicantConsent`
- `Client`
- `ManpowerRequest`
- `ApplicationStatusHistory`
- `RecruiterDecision`
- `ComplianceRequirement`
- `ComplianceSubmission`
- `Deployment`
- `DeploymentStatusHistory`
- `NotificationOutbox`
- `ReportExport`

### Phase 1: Critical Research and Logic Corrections

| Task | Objective and evidence | Changes | Validation/security | Tests and acceptance | Risk/complexity |
| --- | --- | --- | --- | --- | --- |
| P1-01 | Freeze Gemini contract; paper lines conflict with `gemini.ts` | Add contract characterization tests only; do not alter Gemini files or flow | No additional AI data or calls | Tests assert exact model, prompt structure, inputs, output shape, persistence, and threshold 60 | Medium / M |
| P1-02 | Lock executable algorithm specification | Treat `text.ts`, `knn.ts`, configuration defaults, and tests as authoritative | Protected attributes remain excluded | Formula fixtures, empty-vector behavior, cap behavior, tie-break, source exclusion, >5,000 error | Low / M |
| P1-03 | Deploy deterministic scoring | Back up DB; review and apply the two existing migrations; activate flags in staging in order: scoring → revalidation → KNN | Run database advisors; keep scoring tables inaccessible to `anon`/`authenticated` | Live config, score persistence, stale/revalidation, KNN, rollback, restart tests pass | High / M |
| P1-04 | Enforce one state machine | Add `DEPLOYED`; centralize transitions; reject direct onboarding/hiring; record every transition | TA writes; Admin operational read-only | Invalid transitions return 409; legal transitions create history and audit | High / M |
| P1-05 | Protect documents | Introduce `StoredDocument`; private bucket; signed/streamed download; type-specific limits and checks | No public URLs; SHA-256; quarantine; ClamAV-compatible scanner required in production | Anonymous access fails; ownership/role matrix passes; malicious and mislabeled samples reject | Critical / L |
| P1-06 | Versioned consent | Add consent record and require current resume-analysis policy acceptance before resume upload/application | Never fabricate consent for legacy users; require re-consent | Upload/apply blocked without consent; revoke prevents new analysis without deleting required audit history | High / M |

**Gate:** build/tests pass; staging database is recoverable; scoring works live; no public sensitive document access; Gemini contract tests prove no change.

### Phase 2: Functional Requirement Alignment

| Task | Objective | Database/backend/frontend changes | Acceptance | Risk/complexity |
| --- | --- | --- | --- | --- |
| P2-01 | Client/MRF management | Add Client and ManpowerRequest with title, description, headcount, location, target-fill date, priority, required skills/experience/education/certifications/compliance; link JobPosting | TA creates MRF/job; Admin reads; every ranking target has structured requirements | High / L |
| P2-02 | Human recruiter decisions | Add RecruiterDecision and reason; require actor for pool, advance, reject, hire, and back-out decisions | Every consequential transition has actor, reason, timestamp, and audit | Medium / M |
| P2-03 | Compliance and 201 file | Add requirement checklist and human review states; connect private StoredDocument; preserve Vault201 | Required documents, deadline, expiry, reviewer, and history are visible; no claim of automatic authenticity verification | High / L |
| P2-04 | Deployment lifecycle | Add Deployment linked to hired application, client, and MRF; statuses `PENDING_ORIENTATION`, `READY`, `DISPATCHED`, `ACTIVE`, `ENDED`, `CANCELLED`; record contract dates/site/documents | Only compliant onboarding applications deploy; one active deployment per application; history is immutable | Critical / XL |
| P2-05 | Durable alerts | Add NotificationOutbox and SMTP/Nodemailer worker with leases, retries, idempotency, and delivery audit | Expiry/deadline events create one in-app and one email notification; retries do not duplicate | High / L |
| P2-06 | Analytics and exports | Add dashboard queries and report jobs for rankings, deployments, and pipeline statistics; generate PDF and XLSX | Fixture totals reconcile exactly; exports contain generation time, filters, configuration version, and requesting user | High / L |

**Gate:** Client/MRF-to-deployment workflow succeeds through live APIs; compliance and reports reconcile to seeded fixtures.

### Phase 3: Database and Data-Flow Alignment

| Task | Changes | Constraints/backfill | Acceptance |
| --- | --- | --- | --- |
| P3-01 | Add the new domain models through additive Prisma migrations | Foreign keys use restrictive deletion; timestamps and status indexes included | Prisma validation and migration rollback rehearsal pass |
| P3-02 | Add database uniqueness/invariants | Unique `(userId, jobPostingId)` applications; one active deployment/application; one active global scoring config; valid dates/headcounts | Race-condition tests cannot create duplicates |
| P3-03 | Migrate legacy storage metadata | Parse known Supabase object paths into StoredDocument; preserve unresolved legacy URLs as restricted migration exceptions | Migration report lists every converted/unresolved row; no data is silently discarded |
| P3-04 | Add application/deployment histories | Backfill initial history records with `SYSTEM_MIGRATION` actor, clearly not fabricated user decisions | Every current record has an auditable history origin |
| P3-05 | Secure Supabase database exposure | Preferred: disable unused Data API. Fallback: revoke default privileges and apply grants/RLS for every exposed table | Direct anonymous Data API access fails; server Prisma operations still pass |

Supabase treats grants and RLS as distinct controls and recommends disabling the Data API when only trusted server connections are used: [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api). Sensitive documents must use private buckets and signed/authorized downloads: [Supabase Storage access models](https://supabase.com/docs/guides/storage/buckets/fundamentals).

**Gate:** migration status is clean; constraints are integration-tested; database/security advisors have no unresolved critical findings.

### Phase 4: User Interface and Workflow Alignment

Use React, TypeScript, Vite, Tailwind v4, shadcn/Radix, TanStack Query, React Hook Form, and Zod. Use warm-neutral surfaces with one restrained blue accent.

#### Applicant-first delivery

- Cookie authentication and role routing.
- Consent and profile.
- Default resume upload.
- Job board, details, application, and application history.
- Notifications.
- Status-only AI visibility.

#### Talent Acquisition

- Dashboard and time-to-fill.
- Clients, MRFs, and jobs.
- Application pipeline and decisions.
- Separate Gemini assessment and deterministic Candidate Fit sections.
- Candidate ranking and talent-pool search.
- Interviews, onboarding compliance, 201 archive.
- Deployment tracker.
- Report generation and downloads.

#### Administrator

- Users and roles.
- Read-only operational views.
- Scoring configuration/history/revalidation/quality.
- Audit logs.
- Backup/restore-status documentation view if operational data is available.

#### Permission rules

- Applicant: own records only.
- TA: operational read/write.
- Administrator: user/system/scoring configuration; operational read-only.
- Administrator cannot mutate jobs, applications, compliance, or deployments through TA routes.
- Per-route permissions replace the current broad Admin inheritance on all TA mutations.

**Gate:** keyboard, responsive, accessibility, role-boundary, and live-backend E2E checks pass for each completed role.

### Phase 5: Security and Non-Functional Alignment

| Area | Required implementation |
| --- | --- |
| Authentication | Server-owned access/refresh JWT cookies; browser never sees tokens |
| Cookies | HttpOnly; Secure in production; SameSite=Lax; no Domain; appropriate paths |
| Refresh | Rotation through `/api/auth/refresh`; no tokens in response bodies |
| CORS | Exact configured frontend origin and `credentials: true` |
| CSRF | Validate Origin/Sec-Fetch-Site and require custom CSRF header on mutations |
| Rate limits | Login/register/refresh, upload, Gemini-analysis trigger, exports |
| Storage | Private bucket, signed/streamed authorization, quarantine, scanning |
| Errors | Central typed error mapper; redact provider, database, storage, and file paths |
| Audit | Authentication, sensitive reads/downloads, role changes, MRF/job changes, decisions, documents, deployments, configuration, reports |
| Reliability | Durable scoring and email tasks; health/readiness endpoints; graceful shutdown |
| Performance | Pagination and indexes; KNN limit 5,000; P95 telemetry |
| Backup | Supabase-managed backup retention plus monthly restore drill; no unsafe in-app `pg_dump` endpoint |
| Accessibility | WCAG 2.2 AA target, keyboard navigation, labels, focus handling, text-plus-color statuses |

**Gate:** authorization/security suite passes; anonymous document/data access fails; restore drill and production configuration checklist are documented.

### Phase 6: Testing and Research Evaluation Alignment

- Unit tests for formulas, dimensions, transitions, permissions, validation, exports, deadlines, and notifications.
- PostgreSQL integration tests using a disposable CI database.
- Dedicated Supabase test-project tests for Auth and private Storage.
- API tests for every route, status code, response envelope, and role.
- Playwright E2E for Applicant, TA, and Administrator.
- Gemini characterization tests with mocked SDK plus an opt-in live smoke test.
- Algorithm evaluation using de-identified or synthetic applicant/job fixtures:
  - deterministic reruns must be identical;
  - repeated terms above cap must not increase TF;
  - cosine must be finite and within `[0,1]`;
  - exact KNN must match brute-force expected neighbors;
  - tie-breaking must use ascending application ID;
  - final weighted score must reproduce its stored breakdown.
- Performance benchmark:
  - exact KNN at 5,000 eligible candidates;
  - target P95 below 200 ms for retrieval core;
  - API/Gemini queue performance reported separately.
- Security tests for IDOR, role escalation, CSRF, CORS, rate limiting, upload spoofing, private files, and error leakage.
- UAT with MEGS HR/TA evaluators and signed issue disposition.
- ISO/IEC 25010 questionnaire and calculations added only after collection; no invented results.

**Gate:** all automated suites pass; UAT critical defects are closed; metrics and limitations are reproducible.

### Phase 7: Documentation and Final Traceability

- Update `agent/research/research.md` chapter by chapter.
- Update ERD, data dictionary, route/role matrix, use cases, activity diagrams, and architecture.
- Replace all paper algorithm formulas/examples with executable fixtures from tests.
- Document the dual-score model and frozen Gemini contract.
- Update the current alignment report and scoring/frontend roadmaps.
- Add README files covering setup, migrations, flags, Auth, Storage, workers, tests, and deployment.
- Attach test evidence, screenshots of the live system, UAT forms/results, export samples, and restore-drill evidence.
- Re-score all 42 requirements; no requirement remains without evidence or an explicit justified exclusion.

**Gate:** Accessibility, QA, Code Review, Security, Documentation, and research-owner approvals are recorded before final closure.

## 7. Testing Strategy

### Mandatory Gemini preservation cases

1. The SDK receives `gemini-2.5-flash`.
2. `responseMimeType` remains `application/json`.
3. The prompt still receives only resume text, title, and requirements.
4. Response remains exactly score/summary/strengths/gaps.
5. Score remains clamped to 0–100.
6. Score 60 produces MATCHED; 59 produces TALENT_POOL.
7. Success still writes `aiScore` and serialized `aiSummary`.
8. Gemini failure returns the application to SUBMITTED.
9. Missing/unreadable resume follows the current failure behavior.
10. Deterministic scoring never modifies Gemini fields.
11. Talent-pool KNN does not invoke Gemini.
12. No new route or worker introduces an additional Gemini call.

### Workflow cases

- Applicant cannot apply twice, including concurrent requests.
- Applicant cannot access another applicant’s records/documents.
- Admin cannot mutate operational TA resources.
- Hiring cannot occur before final interview.
- Deployment cannot occur before onboarding/compliance.
- Expired or missing required documents prevent deployment activation.
- Time-to-fill derives from the recorded MRF opening and deployment activation timestamps.
- Report totals equal underlying fixture records.
- Configuration changes preserve historical scores and queue revalidation.

## 8. Final Acceptance Criteria

The system is aligned only when:

- All 42 research requirements have current evidence and status.
- Gemini characterization tests prove its role is unchanged.
- Paper Gemini descriptions match the frozen code contract.
- Paper TF-IDF/cosine/KNN formulas exactly match executable tests.
- Both scoring migrations are deployed and feature flags are enabled deliberately.
- Candidate Fit is reproducible, explainable, versioned, and separate from Gemini.
- Client/MRF, compliance, 201, deployment, dashboard, and reporting workflows work end to end.
- Applicant, TA, and Administrator permissions match the revised matrix.
- No sensitive document is served through a permanent public URL.
- Browser authentication uses server-owned cookies and exposes no tokens.
- Critical/high gaps are resolved or formally removed from the approved paper before defense.
- Unit, integration, API, E2E, security, performance, Gemini-contract, and algorithm tests pass.
- UAT and ISO/IEC 25010 evidence is collected and attached.
- Screenshots and reported results come from the running system, not mockups.
- Remaining differences are explicitly justified without overstating system capability.

## 9. Final Recommendation

**Partially aligned with significant corrections required.**

The practical path is incremental remediation, not a rewrite. Preserve the working backend and frozen Gemini workflow, activate and validate the existing deterministic scoring system, then add the missing business domains, secure data handling, frontend, reporting, and research evidence.

The research paper must be corrected in parallel—especially its Gemini, OCR/NER, semantic-cosine, KNN, authentication-library, status, and role descriptions—so the final defense presents one coherent and reproducible system.
