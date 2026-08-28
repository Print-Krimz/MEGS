# Talent Pool In-App Job Invitation & Tracking System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully tracked, in-system Talent Pool Job Invitation & Response workflow allowing TA recruiters to invite pooled candidates directly inside MEGS, delivering instant in-app alerts + branded Gmail notifications and a 1-click Accept/Decline experience for candidates, while auto-syncing application pipeline records and availability status.

**Architecture:** Extend Prisma schema with `TalentPoolInvitation` linked to `TalentPoolMembership`, `JobPosting`, and `User`. Implement Express services for sending invitations (with SSE in-app notifications and Gmail email dispatches via nodemailer), listing pending/historical invitations, and processing candidate acceptances (auto-creating `Application` records + AI scoring) or declines (auto-updating candidate availability and reasons). Expose dedicated TA and Applicant API endpoints and render interactive responsive UI components in both TA and Applicant portals.

**Tech Stack:** Express 5, TypeScript, Prisma 7.8, PostgreSQL, Nodemailer (Gmail / SMTP), TanStack React Query v5, TanStack Router, React 19, Tailwind CSS v4, Zod, Vitest.

## User Review Required
> [!IMPORTANT]
> - **Dual Notification Channel:** When an invitation is sent, the candidate receives both an **in-app real-time notification** AND an official **Gmail email** containing job requisition highlights, recruiter notes, and a direct action link.
> - **Candidate Acceptance:** Automatically creates a real `Application` record with status `SUBMITTED`, auto-triggers the AI scoring pipeline, and notifies the TA recruiter via in-app alert and email.
> - **Candidate Decline:** Allows selecting a reason (`SALARY_MISMATCH`, `UNAVAILABLE_EMPLOYED`, `LOCATION_COMMUTE`, `NOT_INTERESTED`, `OTHER`). If `UNAVAILABLE_EMPLOYED` is chosen, the system automatically updates the candidate's `TalentPoolMembership.availability` to `UNAVAILABLE` so recruiters don't re-invite unavailable candidates.

## Global Constraints
- Do not bypass the PERN architecture or authoritative database state machine.
- All invitation state transitions (`PENDING` -> `ACCEPTED` / `DECLINED` / `CANCELLED`) must be atomic via Prisma transactions.
- Candidate acceptance must automatically create an `Application` in `SUBMITTED` state and trigger AI resume scoring revalidation without corrupting historical application records.
- Preserves responsive design across Mobile (375px), Tablet (768px), and Desktop (1440px) matching the established industrial utilitarian design tokens.

---

### Task 1: Database Schema & Migration for Talent Pool Invitations

**Files:**
- Modify: `backend/prisma/schema/talent-pool.prisma`
- Modify: `backend/prisma/schema/job.prisma`
- Modify: `backend/prisma/schema/user.prisma`
- Create: `backend/prisma/schema/migrations/20260821120000_talent_pool_invitations/migration.sql`

**Interfaces:**
- Produces: `TalentPoolInvitation` model, `TalentPoolInvitationStatus` enum (`PENDING`, `ACCEPTED`, `DECLINED`, `CANCELLED`, `EXPIRED`), relation fields on `TalentPoolMembership`, `JobPosting`, and `User`.

- [ ] **Step 1: Update Prisma schema files**

Update `backend/prisma/schema/talent-pool.prisma`:
```prisma
enum TalentPoolInvitationStatus {
  PENDING
  ACCEPTED
  DECLINED
  CANCELLED
  EXPIRED
}

model TalentPoolInvitation {
  id               Int                        @id @default(autoincrement())
  membershipId     Int
  membership       TalentPoolMembership       @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  jobPostingId     Int
  jobPosting       JobPosting                 @relation(fields: [jobPostingId], references: [id], onDelete: Restrict)
  invitedById      String
  invitedBy        User                       @relation("InvitationRecruiter", fields: [invitedById], references: [id])
  status           TalentPoolInvitationStatus @default(PENDING)
  message          String?
  declineReason    String?
  responseNotes    String?
  expiresAt        DateTime?
  respondedAt      DateTime?
  createdAt        DateTime                   @default(now())
  updatedAt        DateTime                   @updatedAt

  @@index([membershipId, status])
  @@index([jobPostingId, status])
  @@index([status, createdAt(sort: Desc)])
}
```

Add `invitations TalentPoolInvitation[]` to `TalentPoolMembership` in `talent-pool.prisma`, `talentPoolInvitations TalentPoolInvitation[]` to `JobPosting` in `job.prisma`, and `sentInvitations TalentPoolInvitation[] @relation("InvitationRecruiter")` in `user.prisma`.

- [ ] **Step 2: Generate migration SQL and run prisma generate**

Create migration file `backend/prisma/schema/migrations/20260821120000_talent_pool_invitations/migration.sql`:
```sql
CREATE TYPE "TalentPoolInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED');

CREATE TABLE "TalentPoolInvitation" (
    "id" SERIAL NOT NULL,
    "membershipId" INTEGER NOT NULL,
    "jobPostingId" INTEGER NOT NULL,
    "invitedById" TEXT NOT NULL,
    "status" "TalentPoolInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "declineReason" TEXT,
    "responseNotes" TEXT,
    "expiresAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TalentPoolInvitation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TalentPoolInvitation_membershipId_status_idx" ON "TalentPoolInvitation"("membershipId", "status");
CREATE INDEX "TalentPoolInvitation_jobPostingId_status_idx" ON "TalentPoolInvitation"("jobPostingId", "status");
CREATE INDEX "TalentPoolInvitation_status_createdAt_idx" ON "TalentPoolInvitation"("status", "createdAt" DESC);

ALTER TABLE "TalentPoolInvitation" ADD CONSTRAINT "TalentPoolInvitation_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "TalentPoolMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TalentPoolInvitation" ADD CONSTRAINT "TalentPoolInvitation_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TalentPoolInvitation" ADD CONSTRAINT "TalentPoolInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

Run: `npx prisma generate` in `backend` directory.

---

### Task 2: Backend Zod Schemas & Validation

**Files:**
- Modify: `backend/src/schemas/candidate-scoring.schema.ts`
- Create: `backend/src/schemas/talent-pool-invitation.schema.ts`
- Test: `backend/src/schemas/__tests__/talent-pool-invitation.schema.test.ts`

**Interfaces:**
- Produces: `sendInvitationSchema`, `respondInvitationSchema`, `listInvitationsQuerySchema`.

- [ ] **Step 1: Write failing schema tests**

```typescript
import { describe, it, expect } from "vitest";
import { talentPoolInvitationSchema } from "../talent-pool-invitation.schema.js";

describe("talentPoolInvitationSchema", () => {
  it("validates send invitation input successfully", () => {
    const valid = talentPoolInvitationSchema.sendInvitation.parse({
      applicantProfileId: 10,
      targetJobId: 5,
      message: "We would like to invite you for the Electrician role.",
      expiresInDays: 7,
    });
    expect(valid.applicantProfileId).toBe(10);
    expect(valid.targetJobId).toBe(5);
  });

  it("validates accept response input", () => {
    const valid = talentPoolInvitationSchema.respondInvitation.parse({
      decision: "ACCEPT",
      notes: "I am excited to apply!",
    });
    expect(valid.decision).toBe("ACCEPT");
  });

  it("requires declineReason when declining", () => {
    const valid = talentPoolInvitationSchema.respondInvitation.parse({
      decision: "DECLINE",
      declineReason: "SALARY_MISMATCH",
      notes: "Looking for higher compensation",
    });
    expect(valid.declineReason).toBe("SALARY_MISMATCH");
  });
});
```

- [ ] **Step 2: Implement validation schema in `backend/src/schemas/talent-pool-invitation.schema.ts`**

```typescript
import { z } from "zod";

export const talentPoolInvitationSchema = {
  sendInvitation: z.object({
    applicantProfileId: z.coerce.number().int().positive("applicantProfileId must be a positive integer"),
    targetJobId: z.coerce.number().int().positive("targetJobId must be a positive integer"),
    message: z.string().max(1000, "Message cannot exceed 1000 characters").optional(),
    expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
  }),

  respondInvitation: z.object({
    decision: z.enum(["ACCEPT", "DECLINE"], { message: "decision must be ACCEPT or DECLINE" }),
    declineReason: z.enum([
      "SALARY_MISMATCH",
      "UNAVAILABLE_EMPLOYED",
      "LOCATION_COMMUTE",
      "NOT_INTERESTED",
      "OTHER"
    ]).optional(),
    notes: z.string().max(500).optional(),
  }),

  listQuery: z.object({
    status: z.enum(["PENDING", "ACCEPTED", "DECLINED", "CANCELLED", "EXPIRED", "ALL"]).default("ALL"),
    jobPostingId: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
};
```

- [ ] **Step 3: Run test to verify it passes**
Run: `npm test src/schemas/__tests__/talent-pool-invitation.schema.test.ts`

---

### Task 3: Backend Invitation Service & Business Logic

**Files:**
- Create: `backend/src/services/ta/talent-pool-invitation.service.ts`
- Create: `backend/src/services/applicant/applicant-invitation.service.ts`
- Test: `backend/src/services/ta/__tests__/talent-pool-invitation.service.test.ts`

**Interfaces:**
- Consumes: Prisma Client, `sendNotification()`, `calculateAndPersistCandidateScore()`, `logAudit()`.
- Produces: `sendTalentPoolJobInvitation()`, `listOutgoingInvitations()`, `getMyJobInvitations()`, `respondToJobInvitation()`.

- [ ] **Step 1: Write failing service tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "../../../utils/prisma.js";
import { sendTalentPoolJobInvitation, respondToJobInvitation } from "../talent-pool-invitation.service.js";

describe("Talent Pool Invitation Service", () => {
  it("sends an invitation and notifies candidate", async () => {
    // Mock prisma responses and assert invitation creation & sendNotification call
  });

  it("handles ACCEPT decision by creating Application in SUBMITTED state", async () => {
    // Mock prisma transaction and assert Application record created
  });

  it("handles DECLINE decision and updates candidate availability", async () => {
    // Mock decline with UNAVAILABLE_EMPLOYED and assert membership availability updated
  });
});
```

- [ ] **Step 2: Implement `talent-pool-invitation.service.ts`**

Implement:
1. `sendTalentPoolJobInvitation({ applicantProfileId, targetJobId, recruiterId, message, expiresInDays })`:
   - Checks candidate exists and has `ACTIVE` talent pool membership.
   - Checks candidate does not already have an active application or `PENDING` invitation for `targetJobId`.
   - Calculates expiration date (`now + expiresInDays`).
   - Creates `TalentPoolInvitation` record.
   - Creates `TalentPoolContact` (outcome: `INTERESTED`, notes: `Job invitation sent`).
   - Dispatches in-app notification: `sendNotification(candidateUserId, "Job Invitation Received", "You've been invited to apply for [Job Title]!", "INFO", "/app/invitations")`.
   - Dispatches Gmail notification via `sendMail(candidateUser.email, "Job Invitation: " + job.title, emailHtmlBody)`.
   - Logs audit event `TALENT_POOL_INVITATION_SENT`.

2. `respondToJobInvitation({ userId, invitationId, decision, declineReason, notes })`:
   - Checks invitation belongs to `userId` and status is `PENDING`.
   - If `ACCEPT`:
     - Updates invitation to `ACCEPTED`, `respondedAt: new Date()`.
     - Transactionally creates `Application` (`status: "SUBMITTED"`, `jobPostingId`, `userId`, `resumeUrl`).
     - Creates `RecruiterDecision` (`fromStatus: "TALENT_POOL_INVITATION"`, `toStatus: "SUBMITTED"`).
     - Queues AI candidate score calculation.
     - Notifies recruiter: `sendNotification(invitation.invitedById, "Job Invitation Accepted", "[Candidate Name] accepted your invitation for [Job Title]!", "SUCCESS")` and sends recruiter notification email.
   - If `DECLINE`:
     - Updates invitation to `DECLINED`, records `declineReason` and `notes`.
     - If `declineReason === "UNAVAILABLE_EMPLOYED"`, updates `TalentPoolMembership.availability = "UNAVAILABLE"`.
     - Notifies recruiter: `sendNotification(invitation.invitedById, "Job Invitation Declined", "[Candidate Name] declined invitation for [Job Title].", "WARNING")` and sends recruiter notification email.

- [ ] **Step 3: Run service tests**
Run: `npm test src/services/ta/__tests__/talent-pool-invitation.service.test.ts`

---

### Task 4: API Controllers, Routes & Integration Tests

**Files:**
- Create: `backend/src/controllers/ta/talent-pool-invitation.ta.controller.ts`
- Create: `backend/src/controllers/applicant/applicant-invitation.controller.ts`
- Modify: `backend/src/routes/ta/ta.routes.ts`
- Modify: `backend/src/routes/applicant/applicant.routes.ts`
- Create: `backend/src/__tests__/talent-pool-invitations.e2e.test.ts`

**Endpoints:**
- `POST /api/v1/ta/talent-pool/invite` — TA sends invitation
- `GET /api/v1/ta/talent-pool/invitations` — TA lists outgoing invitations & response statuses
- `DELETE /api/v1/ta/talent-pool/invitations/:id` — TA cancels pending invitation
- `GET /api/v1/applicant/invitations` — Applicant lists received invitations
- `POST /api/v1/applicant/invitations/:id/respond` — Applicant accepts or declines invitation

- [ ] **Step 1: Implement TA & Applicant Controllers and wire routes**
- [ ] **Step 2: Run End-to-End API tests**
Run: `npm test src/__tests__/talent-pool-invitations.e2e.test.ts`

---

### Task 5: Frontend API Client & TypeScript Types

**Files:**
- Modify: `frontend/src/lib/types/ta.types.ts`
- Modify: `frontend/src/lib/types/applicant.types.ts`
- Modify: `frontend/src/lib/api/ta.api.ts`
- Modify: `frontend/src/lib/api/applicant-jobs.api.ts`
- Test: `frontend/src/lib/api/__tests__/invitation.api.test.ts`

- [ ] **Step 1: Add types and API methods**
Add `sendTalentPoolInvitation`, `listTalentPoolInvitations`, `getMyInvitations`, and `respondToInvitation`.
- [ ] **Step 2: Run API client unit tests**
Run: `npm test src/lib/api/__tests__/invitation.api.test.ts`

---

### Task 6: Frontend UI - TA Portal (Send Invitation & Live Tracking)

**Files:**
- Modify: `frontend/src/pages/ta/TalentPoolPage.tsx`
- Create: `frontend/src/components/ta/SendInvitationModal.tsx`
- Create: `frontend/src/components/ta/InvitationsTrackerDrawer.tsx`
- Test: `frontend/src/pages/ta/__tests__/TalentPoolPage.test.tsx`

- [ ] **Step 1: Add "Invite to Job" Modal to `TalentPoolPage.tsx`**
  - Includes Job selector, custom outreach message textarea, expiration dropdown (3, 7, 14 days), and instant submit.
- [ ] **Step 2: Add status badge indicator on candidate cards**
  - Displays `INVITED (Pending Response)` / `ACCEPTED` / `DECLINED` tags on candidates with recent invitation history.
- [ ] **Step 3: Add "Sent Invitations" tracker tab/drawer**
  - Shows list of all outgoing invitations with live candidate responses, decline reasons, and timestamps.

---

### Task 7: Frontend UI - Applicant Portal (Action Banner & Accept/Decline Modal)

**Files:**
- Create: `frontend/src/pages/applicant/JobInvitationsPage.tsx`
- Modify: `frontend/src/pages/applicant/MyApplicationsPage.tsx`
- Modify: `frontend/src/routes.tsx`
- Test: `frontend/src/pages/applicant/__tests__/JobInvitationsPage.test.tsx`

- [ ] **Step 1: Add "Action Required: Job Invitation" Banner to `MyApplicationsPage.tsx`**
  - Highlights pending invitations prominently at the top of the applications page with unread badge count.
- [ ] **Step 2: Implement `JobInvitationsPage.tsx` (or tab in applications tracker)**
  - Shows full Job Card: Requisition Title, Location, Salary Range, Qualifications, Recruiter Message, Expiration timer.
  - Interactive Action Modal:
    - **[ Accept & Apply ]**: Triggers acceptance, auto-redirects to newly created application with success toast.
    - **[ Decline ]**: Opens quick decline reason selector (`Already employed`, `Salary mismatch`, `Commute distance`, `Not interested`, `Other`) + optional notes.
- [ ] **Step 3: Register route in `frontend/src/routes.tsx` (`/app/invitations`)**

---

### Task 8: Full System Verification & Regression Tests

- [ ] **Step 1: Run full backend test suite**
Run: `npm test` in `backend`
- [ ] **Step 2: Run full frontend test suite & type check**
Run: `npm test` and `npm run build` in `frontend`
- [ ] **Step 3: Verification walkthrough & responsiveness audit**
Verify all screens on Mobile (375px), Tablet (768px), and Desktop (1440px).
