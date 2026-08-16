# Host Company Hiring & Canonical Recruitment Pipeline Specification

This document details the recruitment workflow, Manpower Request (MRF) lifecycle, AI-assisted candidate screening, deterministic scoring, digital 201 compliance, and deployment process for the MEGS Recruitment Management System.

---

## 1. End-to-End Pipeline Overview

The MEGS recruitment engine follows an authoritative, linear multi-stage state machine:

```text
┌─────────────┐     ┌───────────────────┐     ┌────────────────────┐
│  SUBMITTED  ├───► │ INITIAL_SCREENING ├───► │ CLIENT_ENDORSEMENT │
└─────────────┘     └───────────────────┘     └─────────┬──────────┘
                                                        │
                                                        ▼
┌────────────┐     ┌────────────┐     ┌─────────────────┴──┐
│  DEPLOYED  │◄────┤ COMPLIANCE │◄────┤  FINAL_INTERVIEW   │
└────────────┘     └────────────┘     └────────────────────┘
```

### Terminal & Alternative States
- **`TALENT_POOL`**: Candidate is qualified but not selected for the current opening; placed in the active talent pool for future MRF semantic matching.
- **`REJECTED`**: Candidate failed mandatory screening or interview requirements; recorded with rejection reasons.
- **`WITHDRAWN`**: Candidate withdrew their application voluntarily.

---

## 2. Pipeline Stages & Pre-Transition Rules

### Stage 1: `SUBMITTED`
- **Trigger:** Applicant applies to an active Job Posting and uploads a resume.
- **Automated Processing:** Asynchronous resume worker (`resume.worker.ts`) parses the resume using Google Gemini (`gemini-2.5-flash`), computes embedding vectors using Xenova Transformers, and generates an initial advisory score against MRF requirements.
- **Recruiter View:** Shows application with parsed skills, experience timeline, and advisory score breakdown.

### Stage 2: `INITIAL_SCREENING`
- **Requirement:** Recruiter reviews the parsed profile and AI advisory score.
- **Actions:** Recruiter conducts phone or video screening, records screening notes, and updates status.

### Stage 3: `CLIENT_ENDORSEMENT`
- **Requirement:** Candidate successfully passes initial screening.
- **Actions:** Recruiter creates a `ClientEndorsement` record linking the candidate to the client/host company. Recruiter records client feedback (`ENDORSED` or `DECLINED`).

### Stage 4: `FINAL_INTERVIEW`
- **Pre-transition Enforcement:** To transition to `HIRED`, a `FINAL_INTERVIEW` record with status `PASS` / `PASSED` must exist.
- **Actions:** Client interview schedule is logged, reminders are sent, and final interview outcome is recorded.

### Stage 5: `HIRED`
- **Trigger:** Candidate passes client final interview and accepts the job offer.
- **System Action:** Status transitions to `HIRED`. Automatically generates required digital 201 compliance checklists from MRF templates.

### Stage 6: `COMPLIANCE` (Digital 201 Verification)
- **Requirement:** Candidate uploads all required compliance documents (e.g., NBI/Police Clearance, Medical Exam, SSS/TIN/PhilHealth numbers, Diploma/Transcript).
- **Recruiter Action:** TA inspects and approves each mandatory document. Document expiration dates are tracked for recurring clearances.

### Stage 7: `DEPLOYED`
- **Pre-transition Enforcement:** All mandatory compliance documents must have status `APPROVED` and valid non-expired dates before the candidate can be marked `DEPLOYED`.
- **System Action:** Creates active `Employee` record, assigns deployment metadata (start date, reporting manager, host company placement), and completes the hiring lifecycle.

---

## 3. Manpower Request (MRF) as Authoritative Source

The **Manpower Request (MRF)** represents the client host company's hiring requisition:
- **Core Requirements:** Required skills, minimum experience years, education level, and certifications.
- **Job Posting Inheritance:** When a Job Posting is linked to an MRF (`mrfId`), the Job Posting inherits requirements directly from the MRF.
- **Compliance Templates:** MRF defines specific client compliance requirements (`MRFComplianceTemplate`), ensuring every hired candidate automatically receives the exact required document checklist.

---

## 4. Deterministic Scoring & AI Ethics Guardrails

1. **AI is Advisory Only:** The Google Gemini assessment is an advisory tool to accelerate screening. The system never auto-rejects candidates purely on AI output.
2. **Audit Trails:** All status changes, endorsement notes, and interview outcomes are logged in `RecruiterDecision` and `AuditLog` models with actor IDs and timestamps.
3. **Candidate Privacy:** Applicant contact information and compliance documents are restricted to authorized recruiters and administrators.
