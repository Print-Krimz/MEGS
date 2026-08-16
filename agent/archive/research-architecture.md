# Historical Research-to-Architecture Alignment Matrix

This document archives the baseline research findings, system domain mappings, and gap analyses formulated during the initial CAP2 development phase.

---

## 1. Traceability Matrix

| Research Domain Requirement | Architecture Implementation | Backend Module / Contract | Status |
| :--- | :--- | :--- | :--- |
| **Manpower Request (MRF) Intake** | Structured client requirements and hiring authorizations. | `backend/src/services/ta/ta.mrf.service.ts` | Completed |
| **AI Resume Screening** | Google Gemini (`gemini-2.5-flash`) structured qualification extraction & advisory evaluation. | `backend/src/workers/resume.worker.ts` | Completed |
| **KNN Vector Similarity** | Xenova Transformers 384-dim embeddings with pgvector cosine distance. | `backend/src/services/scoring/embedding.service.ts` | Completed |
| **Candidate Endorsement** | Multi-party client feedback recording and endorsement outcomes. | `backend/src/services/ta/ta.endorsement.service.ts` | Completed |
| **Structured Interviewing** | Interview scheduling, outcome tracking (PASS/FAIL), and final interview enforcement. | `backend/src/services/ta/ta.interviews.service.ts` | Completed |
| **Digital 201 Compliance** | Multi-file requirement checklists, validation, and expiration dates. | `backend/src/services/ta/ta.compliance.service.ts` | Completed |
| **Deployment Tracking** | Transition from applicant to deployed employee with host placement logs. | `backend/src/services/employee/employee.service.ts` | Completed |
| **Realtime Notifications** | Server-Sent Events (SSE) notification streaming for recruiter actions. | `backend/src/controllers/core/notification.controller.ts` | Completed |

---

## 2. Historical Gap Analysis & Evolution

### Gap 1: In-Flight State Skipping
- **Resolution:** Introduced centralized pre-transition enforcement in `ta.applications.service.ts` ensuring that candidates cannot advance to `HIRED` without a passed `FINAL_INTERVIEW`, and cannot reach `DEPLOYED` without fully approved compliance documents.

### Gap 2: Document Security
- **Resolution:** Moved away from public URLs to private Supabase Storage buckets, issuing short-lived signed URLs through authenticated backend endpoints only.

### Gap 3: Talent Pool Reusability
- **Resolution:** Expanded the Talent Pool from a passive status into a standalone recruiter resource with explicit candidate availability tracking and contact logs.
