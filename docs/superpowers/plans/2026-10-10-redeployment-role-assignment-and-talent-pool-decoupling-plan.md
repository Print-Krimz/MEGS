# Redeployment Role Assignment and Talent Pool Decoupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple job invitations and role offers from `TalentPoolMembership` so Talent Acquisition can offer open roles to deployed/redeployment workers directly without error, while ensuring redeployment workers never enter or undergo the Talent Pool.

**Architecture:**
- Update `TalentPoolInvitation` schema to add `applicantProfileId` and make `membershipId` nullable.
- Update `talent-pool-invitation.service.ts` to support both Talent Pool candidates (unselected/failed applicants) and Redeployment employees (deployed/ended workers wanting new placements).
- Update `getMyJobInvitations` and `respondToJobInvitation` to work through `applicantProfileId`.
- Update `listRedeploymentQueue` and remove the legacy code in `endEmployeeDeployment` that forcefully pushed redeployment employees into `TalentPoolMembership`.

**Tech Stack:**
- PostgreSQL (Supabase), Prisma ORM 7.8, Express 5, TypeScript 6.0, React 19, TanStack Query & Router, Tailwind CSS v4.

## Global Constraints
- Preserve strict boundary: Talent Pool is strictly for candidates who did NOT pass; redeployment workers must NEVER undergo the Talent Pool.
- Deployed workers who want to redeploy can be offered roles for their upcoming placement without being blocked by active deployment checks.
- Do not break existing KNN semantic matching or discovery of unselected candidates in the Talent Pool.
- Maintain full type safety and pass all tests and lint checks.

---

### Task 1: Database Migration & Schema Update for `TalentPoolInvitation`

**Files:**
- Modify: `backend/prisma/schema/talent-pool.prisma`
- Modify: `backend/prisma/schema/applicant.prisma`
- Create: `backend/prisma/schema/migrations/20261010160000_decouple_invitations_from_talent_pool/migration.sql`

**Interfaces:**
- Consumes: `TalentPoolInvitation`, `TalentPoolMembership`, `ApplicantProfile`
- Produces: `TalentPoolInvitation` with `applicantProfileId Int` and optional `membershipId Int?`

- [ ] **Step 1: Write and apply database migration SQL**

Apply migration to Supabase:
```sql
ALTER TABLE "TalentPoolInvitation" ADD COLUMN IF NOT EXISTS "applicantProfileId" INTEGER;

UPDATE "TalentPoolInvitation" ti
SET "applicantProfileId" = tm."applicantProfileId"
FROM "TalentPoolMembership" tm
WHERE ti."membershipId" = tm."id" AND ti."applicantProfileId" IS NULL;

ALTER TABLE "TalentPoolInvitation" ALTER COLUMN "applicantProfileId" SET NOT NULL;
ALTER TABLE "TalentPoolInvitation" ALTER COLUMN "membershipId" DROP NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TalentPoolInvitation_applicantProfileId_fkey'
  ) THEN
    ALTER TABLE "TalentPoolInvitation" 
    ADD CONSTRAINT "TalentPoolInvitation_applicantProfileId_fkey" 
    FOREIGN KEY ("applicantProfileId") REFERENCES "ApplicantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "TalentPoolInvitation_applicantProfileId_status_idx" 
ON "TalentPoolInvitation"("applicantProfileId", "status");
```

- [ ] **Step 2: Update Prisma Schema files**

In `backend/prisma/schema/talent-pool.prisma`:
```prisma
model TalentPoolInvitation {
  id                  Int                        @id @default(autoincrement())
  applicantProfileId  Int
  applicantProfile    ApplicantProfile           @relation(fields: [applicantProfileId], references: [id], onDelete: Cascade)

  membershipId        Int?
  membership          TalentPoolMembership?      @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  ...
  @@index([applicantProfileId, status])
  @@index([membershipId, status])
  @@index([jobPostingId, status])
  @@index([status, createdAt(sort: Desc)])
}
```

In `backend/prisma/schema/applicant.prisma`:
Add `invitations TalentPoolInvitation[]` to `ApplicantProfile`.

- [ ] **Step 3: Run `npx prisma generate` and verify Prisma Client types**

Run: `npm run db:generate` in `backend`.

- [ ] **Step 4: Commit schema changes**

```bash
git add backend/prisma/
git commit -m "feat(schema): decouple TalentPoolInvitation from TalentPoolMembership"
```

---

### Task 2: Update Backend Invitation & Redeployment Services

**Files:**
- Modify: `backend/src/services/ta/talent-pool-invitation.service.ts`
- Modify: `backend/src/services/employee/employee.service.ts`

**Interfaces:**
- Consumes: Updated Prisma schema relations
- Produces: `sendTalentPoolJobInvitation`, `getMyJobInvitations`, `respondToJobInvitation`, `listRedeploymentQueue`

- [ ] **Step 1: Update `sendTalentPoolJobInvitation`**
- In `backend/src/services/ta/talent-pool-invitation.service.ts`:
  - Fetch profile including `user: { include: { applications: true, employee: { include: { deployments: true } } } }` and `talentPoolMembership: true`.
  - Check sourcing eligibility:
    - Candidate has active Talent Pool membership (`profile.talentPoolMembership?.status === 'ACTIVE'`), OR
    - Candidate is an employee with status `AVAILABLE_FOR_REDEPLOYMENT` or has prior deployments or is deployed and eligible for redeployment.
  - If neither, throw `InvalidKnnRequestError("Candidate is neither an active member of the Talent Pool nor eligible for redeployment.")`.
  - For redeployment candidates, allow sending invitations even if they have an active deployment (permitting advancing future assignments).
  - Create `TalentPoolInvitation` with `applicantProfileId: profile.id` and `membershipId: profile.talentPoolMembership?.id ?? null`.
  - Only create `TalentPoolContact` if `membershipId` is present.
  - Send real-time notification to worker.

- [ ] **Step 2: Update `getMyJobInvitations` & `respondToJobInvitation`**
- In `getMyJobInvitations`:
  - Find invitations by `applicantProfileId: profile.id` directly.
- In `respondToJobInvitation`:
  - Include `applicantProfile` directly on invitation lookup.
  - Handle candidate acceptance, creating application, and routing:
    - Same client: `COMPLIANCE` (skip interviews, reuse valid documents).
    - New client: `SUBMITTED`.
  - Log audit and send notifications.

- [ ] **Step 3: Update `listRedeploymentQueue` & remove legacy Talent Pool upsert in `employee.service.ts`**
- In `listRedeploymentQueue`:
  - Query pending invitations from `user.applicantProfile.invitations` where `status: "PENDING"`.
- In `endEmployeeDeployment`:
  - Remove lines 982-995 where `AVAILABLE_FOR_REDEPLOYMENT` employees were upserted into `TalentPoolMembership`.

- [ ] **Step 4: Verify typecheck & test suite**

Run: `npx tsc --noEmit` in `backend`.
Run: `npm test` in `backend`.

- [ ] **Step 5: Commit service changes**

```bash
git add backend/src/services/ta/talent-pool-invitation.service.ts backend/src/services/employee/employee.service.ts
git commit -m "feat(services): allow redeployment role offers without talent pool membership"
```

---

### Task 3: End-to-End Verification & Validation

**Files:**
- Test / Verify:
  - `RedeploymentQueuePage.tsx`
  - `JobInvitationsPage.tsx`
  - Integration script / tests

- [ ] **Step 1: Test sending open role offer to redeployment workers**
- Verify Juan Dela Cruz (`EMP-2026-2844`), Adrian Santos Reyes (`EMP-2026-3717`), and Adrian Reyes (`EMP-2026-3143`) can be invited to an open role via API/UI.
- Confirm response code 200/201 and no `Candidate is not an active member of the Talent Pool` error.

- [ ] **Step 2: Verify worker portal retrieval**
- Verify `getMyJobInvitations` returns the pending invitation for the worker.
- Verify accept workflow triggers application creation.

- [ ] **Step 3: Run comprehensive verification**
- Run frontend and backend test suites and typechecks.
- Verify 10-point HCI checklist and rule compliance.
