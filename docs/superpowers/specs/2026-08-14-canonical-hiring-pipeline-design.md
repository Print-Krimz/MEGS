# Canonical Hiring Pipeline — Design Specification

## Problem Statement

The MEGS recruitment system has a state machine in `ta.applications.service.ts` but **10 out of 11 status-changing code paths bypass it**. Only `updateTAApplicationStatus` enforces the `ALLOWED_TRANSITIONS` map. The remaining 10 locations (AI service, resume worker, interviews, post-hire, deployments, archive/restore) directly call `prisma.application.update({ data: { status: ... } })`, skipping transition validation, audit trails, and side-effects like Talent Pool membership updates.

Additionally, the target pipeline from the requirements introduces three stages that do not exist in the current system:
- **CLIENT_ENDORSEMENT** — completely missing
- **COMPLIANCE** — exists as a deployment gate check but not as a pipeline stage
- **TA_DECISION** / **AI_ANALYSIS** — currently mapped as REVIEW/PARSING but not named as distinct stages

---

## Current Architecture

### Existing ApplicationStatus Enum
```
SUBMITTED → PARSING → REVIEW → NEEDS_ATTENTION
                        ↓
              INITIAL_SCREENING → FINAL_INTERVIEW → HIRED → ONBOARDING → DEPLOYED
                                                                          ↓
                                                                        ARCHIVED
              MATCHED → (from REVIEW)
              TALENT_POOL → (reusable candidate pool)
              BACKOUT → (candidate withdrew)
```

### Status Mutation Audit Results

| # | Location | Status Set To | Uses State Machine? | Audit Trail? |
|---|----------|--------------|---------------------|--------------|
| 1 | `updateTAApplicationStatus` | Any allowed | ✅ Yes | ✅ RecruiterDecision |
| 2 | `submitApplicationService` | SUBMITTED | ❌ (creation) | ✅ AuditLog |
| 3 | `queueApplicationAnalysis` | PARSING | ❌ | ❌ |
| 4 | `processResumeJob` (no resume) | NEEDS_ATTENTION | ❌ | ❌ |
| 5 | `processResumeJob` (parse error) | NEEDS_ATTENTION | ❌ | ❌ |
| 6 | `processResumeJob` (AI error) | NEEDS_ATTENTION | ❌ | ❌ |
| 7 | `processResumeJob` (success) | REVIEW | ❌ | ❌ |
| 8 | `updateToOnboarding` | ONBOARDING | ❌ | ✅ RecruiterDecision |
| 9 | `executeHiring` | HIRED | ❌ | ✅ RecruiterDecision |
| 10 | `createDeployment` | DEPLOYED | ❌ | ✅ RecruiterDecision |
| 11 | `updateInterviewResult` (NO_SHOW) | ARCHIVED | ❌ | ❌ |
| 12 | `archiveTAApplication` | ARCHIVED | ❌ | ❌ |
| 13 | `restoreTAApplication` | SUBMITTED | ❌ | ❌ |

### Critical Bugs Found

1. **`updateToOnboarding` blocks the HIRED→ONBOARDING transition** — The validation `["HIRED", "ONBOARDING"].includes(application.status)` throws an error when the application IS in HIRED status. This is a logic inversion bug.

2. **`executeHiring` skips the FINAL_INTERVIEW requirement** — The check for a passed FINAL_INTERVIEW only exists in `updateTAApplicationStatus`, not in `executeHiring`. A candidate could be hired without passing the final interview through the `/hire` endpoint.

3. **`createDeployment` skips Talent Pool cleanup** — When deploying, the `TalentPoolMembership` status is not updated to `PLACED`, unlike in `updateTAApplicationStatus`.

4. **`updateInterviewResult` NO_SHOW can archive any application** — There's no check on the current application status before archiving. A DEPLOYED or HIRED application could be archived via a NO_SHOW on an old interview record.

---

## Design

### Approach: Centralize All Status Transitions Through the State Machine

Rather than introducing a separate "workflow engine" or complex abstraction, we will:

1. **Expand the existing `ALLOWED_TRANSITIONS` map** to include the new stages (CLIENT_ENDORSEMENT, COMPLIANCE)
2. **Add pre-transition hooks** to the existing `updateTAApplicationStatus` for business rule enforcement (passed interview check, compliance check, endorsement check)
3. **Route ALL status-changing code paths through `updateTAApplicationStatus`** — including the worker, AI service, post-hire, deployments, archive/restore, and interview NO_SHOW
4. **Support a `SYSTEM` actor** for automated transitions (worker, background jobs) so audit trails are always recorded

### Target Pipeline (Adapted to Existing Architecture)

```
SUBMITTED                    // Applicant applies
    ↓ (auto)
PARSING                      // Resume worker picks it up
    ↓ (auto)
REVIEW                       // AI analysis complete, TA reviews
    ↓ (TA action)
INITIAL_SCREENING            // TA schedules screening interview
    ↓ (requires PASS on INITIAL_SCREENING interview)
CLIENT_ENDORSEMENT           // [NEW] Client reviews candidate
    ↓ (requires ENDORSED outcome)
FINAL_INTERVIEW              // TA schedules final interview
    ↓ (requires PASS on FINAL_INTERVIEW interview)
HIRED                        // TA completes hiring, Employee created
    ↓
COMPLIANCE                   // [NEW] Compliance requirements checked
    ↓ (requires all mandatory requirements APPROVED)
DEPLOYED                     // Deployment created

Side paths (always available where appropriate):
  → TALENT_POOL              // Candidate pooled for future roles
  → BACKOUT                  // Candidate withdrew
  → ARCHIVED                 // Discarded
  → NEEDS_ATTENTION          // Error requiring manual intervention
```

### Key Design Decisions

**Decision 1: Keep REVIEW instead of splitting into AI_ANALYSIS + TA_DECISION**

The current SUBMITTED → PARSING → REVIEW flow already captures the AI analysis phase (PARSING) and the TA review phase (REVIEW). Splitting REVIEW into two separate stages (AI_ANALYSIS + TA_DECISION) would add complexity without real value — the TA already reviews AI results at the REVIEW stage.

Mapping to the user's target pipeline:
- `AI_ANALYSIS` = `PARSING` (existing) — The AI is processing the resume
- `TA_DECISION` = `REVIEW` (existing) — TA reviews AI results and decides next step

**Decision 2: Add CLIENT_ENDORSEMENT as a new ApplicationStatus enum value**

This is a new pipeline stage between INITIAL_SCREENING and FINAL_INTERVIEW. It requires:
- A new `ClientEndorsement` model to track endorsement outcomes (PENDING, ENDORSED, DECLINED)
- A pre-transition hook that blocks INITIAL_SCREENING → CLIENT_ENDORSEMENT unless the screening interview result is PASS
- A pre-transition hook that blocks CLIENT_ENDORSEMENT → FINAL_INTERVIEW unless an ENDORSED outcome exists

**Decision 3: Add COMPLIANCE as a new ApplicationStatus enum value**

Currently compliance is enforced only during deployment creation. Making it a named stage:
- Makes the pipeline visible and trackable
- Allows the TA dashboard to show candidates in the compliance stage
- Provides a clear gate between HIRED and DEPLOYED

The pre-transition hook blocks COMPLIANCE → DEPLOYED unless `isFullyCompliant()` returns true.

**Decision 4: Remove ONBOARDING from the pipeline**

The current HIRED → ONBOARDING → DEPLOYED flow uses ONBOARDING as an intermediate stage. In the target pipeline, COMPLIANCE replaces ONBOARDING as the intermediate stage between HIRED and DEPLOYED. The ONBOARDING concept is still represented — it's what happens during the COMPLIANCE stage (compliance checks, document collection, orientation).

If ONBOARDING must be preserved for backward compatibility, we can keep it but the preferred path is:
- HIRED → COMPLIANCE → DEPLOYED

**Decision 5: Keep MATCHED or remove it**

MATCHED is currently a valid transition from REVIEW but appears to have no distinct purpose beyond REVIEW. It seems like a legacy status from before the scoring system was built. If it's still used by the frontend, we'll keep it. Otherwise, candidates scored above a threshold remain in REVIEW with their score visible.

**Decision 6: Compliance requirements generated from MRF**

When an application enters COMPLIANCE (after being HIRED), the system should auto-generate compliance requirements from the associated MRF/Client template if available. This links Priority 4 (MRF as authoritative source) with Priority 5 (Compliance module).

---

### Proposed ApplicationStatus Enum (Updated)

```prisma
enum ApplicationStatus {
  SUBMITTED
  PARSING
  REVIEW
  NEEDS_ATTENTION
  MATCHED              // Keep for backward compatibility
  TALENT_POOL
  INITIAL_SCREENING
  CLIENT_ENDORSEMENT   // NEW
  FINAL_INTERVIEW
  HIRED
  COMPLIANCE           // NEW (replaces ONBOARDING)
  DEPLOYED
  BACKOUT
  ARCHIVED
}
```

### Proposed ALLOWED_TRANSITIONS Map (Updated)

```typescript
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED:           ["PARSING", "NEEDS_ATTENTION", "BACKOUT", "ARCHIVED"],
  PARSING:             ["REVIEW", "NEEDS_ATTENTION", "ARCHIVED"],
  REVIEW:              ["INITIAL_SCREENING", "MATCHED", "TALENT_POOL", "BACKOUT", "ARCHIVED"],
  NEEDS_ATTENTION:     ["PARSING", "REVIEW", "TALENT_POOL", "BACKOUT", "ARCHIVED"],
  MATCHED:             ["INITIAL_SCREENING", "TALENT_POOL", "ARCHIVED"],
  TALENT_POOL:         ["INITIAL_SCREENING", "ARCHIVED"],
  INITIAL_SCREENING:   ["CLIENT_ENDORSEMENT", "TALENT_POOL", "BACKOUT", "ARCHIVED"],
  CLIENT_ENDORSEMENT:  ["FINAL_INTERVIEW", "TALENT_POOL", "BACKOUT", "ARCHIVED"],
  FINAL_INTERVIEW:     ["HIRED", "TALENT_POOL", "BACKOUT", "ARCHIVED"],
  HIRED:               ["COMPLIANCE", "BACKOUT"],
  COMPLIANCE:          ["DEPLOYED", "BACKOUT"],
  DEPLOYED:            ["ARCHIVED"],
  BACKOUT:             [],
  ARCHIVED:            [],
};
```

### Pre-Transition Business Rules

```typescript
const PRE_TRANSITION_RULES: Record<string, (applicationId: number) => Promise<void>> = {
  // Require passed INITIAL_SCREENING interview before CLIENT_ENDORSEMENT
  CLIENT_ENDORSEMENT: async (applicationId) => {
    const screening = await prisma.interview.findFirst({
      where: { applicationId, type: "INITIAL_SCREENING", result: { in: ["PASS", "PASSED"] } },
    });
    if (!screening) {
      throw new Error("Cannot move to CLIENT_ENDORSEMENT. A passed INITIAL_SCREENING interview is required.");
    }
  },

  // Require ENDORSED client endorsement before FINAL_INTERVIEW
  FINAL_INTERVIEW: async (applicationId) => {
    const endorsement = await prisma.clientEndorsement.findFirst({
      where: { applicationId, outcome: "ENDORSED" },
    });
    if (!endorsement) {
      throw new Error("Cannot move to FINAL_INTERVIEW. Client endorsement (ENDORSED) is required.");
    }
  },

  // Require passed FINAL_INTERVIEW before HIRED
  HIRED: async (applicationId) => {
    const finalInterview = await prisma.interview.findFirst({
      where: { applicationId, type: "FINAL_INTERVIEW", result: { in: ["PASS", "PASSED"] } },
    });
    if (!finalInterview) {
      throw new Error("Cannot move to HIRED. A passed FINAL_INTERVIEW is required.");
    }
  },

  // Require all mandatory compliance requirements APPROVED before DEPLOYED
  DEPLOYED: async (applicationId) => {
    const compliant = await isFullyCompliant(applicationId);
    if (!compliant) {
      throw new Error("Cannot deploy. All mandatory compliance requirements must be APPROVED.");
    }
  },
};
```

---

## New Database Models

### ClientEndorsement Model

```prisma
model ClientEndorsement {
  id            Int         @id @default(autoincrement())
  applicationId Int
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Restrict)
  clientId      Int
  client        Client      @relation(fields: [clientId], references: [id], onDelete: Restrict)
  outcome       String      @default("PENDING") // PENDING, ENDORSED, DECLINED
  endorsedById  String?     // The TA who recorded the endorsement
  endorsedBy    User?       @relation("EndorsementActor", fields: [endorsedById], references: [id])
  notes         String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@index([applicationId, outcome])
}
```

### MRF ComplianceTemplate Model

```prisma
model MRFComplianceTemplate {
  id        Int              @id @default(autoincrement())
  mrfId     Int?
  mrf       ManpowerRequest? @relation(fields: [mrfId], references: [id], onDelete: Cascade)
  clientId  Int?
  client    Client?          @relation(fields: [clientId], references: [id], onDelete: Cascade)
  documentLabel    String
  isRequired       Boolean  @default(true)
  createdAt        DateTime @default(now())

  @@index([mrfId])
  @@index([clientId])
}
```

### ComplianceRequirement Updates

Add `expiresAt` field to the existing `ComplianceRequirement` model for expiration tracking:

```prisma
model ComplianceRequirement {
  // ... existing fields ...
  expiresAt    DateTime?     // When the document expires (for renewables like medical certs)
}
```

---

## MRF as Authoritative Requirements Source

### Current State
- MRF has text fields: `requiredSkills`, `requiredExperience`, `requiredEducation`, `requiredCertifications`
- Job Posting has: `title`, `description`, `requirements` (freeform text)
- AI scoring uses Job Posting `requirements` text only
- MRF can be linked to Job Posting via `mrfId`

### Proposed Changes

1. **MRF structured fields become the source of truth** — The existing text fields are already reasonable. Add optional structured JSON fields for richer data:

```prisma
model ManpowerRequest {
  // ... existing fields ...
  salaryRangeMin         Float?
  salaryRangeMax         Float?
  employmentType         String?    // FULL_TIME, PART_TIME, CONTRACT
  workArrangement        String?    // ONSITE, REMOTE, HYBRID
  complianceRequirements String?    // JSON array of required document types
}
```

2. **Job Posting inherits MRF data** — When creating a Job Posting from an MRF, auto-populate `requirements` from MRF structured fields. The Job Posting `requirements` field becomes a formatted composite of MRF data.

3. **AI scoring uses MRF requirements when available** — When the Job Posting has a linked MRF, the resume worker should include MRF structured requirements in the Gemini prompt alongside the Job Posting requirements.

4. **Compliance template generation** — When HIRED → COMPLIANCE, if the application's Job Posting has a linked MRF with `complianceRequirements`, auto-generate `ComplianceRequirement` records for that application.

---

## Service Architecture

All changes fit within the existing service structure:

```
src/services/ta/
  ta.applications.service.ts    — Enhanced with centralized transition + pre-transition rules
  ta.interviews.service.ts      — Modified to use state machine for NO_SHOW archiving
  ta.compliance.service.ts      — Enhanced with expiration check + auto-generation from MRF
  ta.deployments.service.ts     — Modified to use state machine for DEPLOYED transition
  ta.posthire.service.ts        — Modified to use state machine for HIRED + COMPLIANCE transitions
  ta.endorsement.service.ts     — [NEW] Client endorsement CRUD + outcome recording
  ta.ai.service.ts              — Modified to use state machine for PARSING transition
  ta.mrf.service.ts             — Enhanced with compliance template management

src/workers/
  resume.worker.ts              — Modified to use state machine for REVIEW/NEEDS_ATTENTION transitions
```

No new architectural patterns. No new middleware. No event sourcing. No CQRS. Just centralized enforcement in the existing `updateTAApplicationStatus` function.

---

## Audit Trail

The existing `RecruiterDecision` model already records:
- `applicationId`, `actorId`, `fromStatus`, `toStatus`, `reason`, `createdAt`

This is sufficient for the audit trail requirement. The centralized transition function will ensure a `RecruiterDecision` is ALWAYS created, even for system-initiated transitions (using a `SYSTEM` actor ID constant).

---

## Role Mapping (Unchanged)

| Role | Responsibilities |
|------|-----------------|
| APPLICANT | Submit applications, upload resumes, submit compliance documents, view own progress |
| TALENT_ACQUISITION | Review AI analysis, conduct screenings, record endorsements, manage interviews, verify compliance, manage pipeline |
| ADMINISTRATOR | System administration, user management, configuration, oversight |

No new roles needed.

---

## Risks and Migration Considerations

1. **ONBOARDING status removal** — Any applications currently in ONBOARDING status need to be migrated to COMPLIANCE. Check if any frontend views depend on ONBOARDING.

2. **MATCHED status** — Need to verify if the frontend uses this. If not actively used, can be kept for backward compatibility but removed from the primary flow.

3. **CLIENT_ENDORSEMENT as new stage** — All existing applications currently in INITIAL_SCREENING or FINAL_INTERVIEW were not endorsed. Need a migration strategy for in-flight applications.

4. **COMPLIANCE as new stage** — All existing applications currently HIRED but not yet DEPLOYED may need to be moved to COMPLIANCE.

5. **MRF compliance template** — Existing compliance requirements were manually created. The auto-generation from MRF templates is additive and doesn't conflict.

6. **Pre-transition rule enforcement** — The HIRED check for FINAL_INTERVIEW already exists in `updateTAApplicationStatus`. Adding CLIENT_ENDORSEMENT and COMPLIANCE checks follows the same pattern.

---

## Open Questions for User Review

> [!IMPORTANT]
> **1. ONBOARDING status**: Should we keep `ONBOARDING` as a distinct stage alongside `COMPLIANCE`, or replace it entirely with `COMPLIANCE`? The current proposal replaces it, since compliance IS the onboarding process. If you need both, the pipeline becomes: `HIRED → ONBOARDING → COMPLIANCE → DEPLOYED`.

> [!IMPORTANT]
> **2. MATCHED status**: Is `MATCHED` actively used in the frontend? If not, should we remove it from the transition map or keep it for backward compatibility?

> [!IMPORTANT]  
> **3. In-flight application migration**: For applications currently between INITIAL_SCREENING and FINAL_INTERVIEW (i.e., they never went through CLIENT_ENDORSEMENT), should we:
> - (a) Grandfather them through — allow them to proceed without endorsement, or
> - (b) Require them to go through endorsement before proceeding?

> [!IMPORTANT]
> **4. Client entity for endorsement**: Client endorsement requires a `clientId`. Should this be derived from the Job Posting's MRF → Client relationship, or should the TA manually select the client during endorsement?

> [!IMPORTANT]
> **5. Compliance document expiration**: Should expiration be actively monitored (e.g., a scheduled job that marks expired documents), or passively checked only at deployment time?
