# Redeployment Role Assignment and Talent Pool Decoupling Design

- **Date:** 2026-10-10
- **Status:** Approved by User
- **Area:** Talent Acquisition / Workforce / Redeployment Queue / Talent Pool / Worker Portal

---

## 1. Problem Statement & Context

In the MEGS recruitment management system, two candidate classifications exist with distinct operational boundaries:
1. **Talent Pool Candidates:** Applicants who applied for roles but did **not pass** (for example, rejected in interviews, candidate screening, or client endorsements). They are placed in the Talent Pool as reserve candidates for future opportunities.
2. **Redeployment Candidates / Deployed Workers:** Proven agency employees who were successfully hired and deployed. When their client assignment ends or they want to redeploy, they enter the Redeployment Queue. **They do not undergo or belong to the Talent Pool.**

### The Problem
Previously, the job invitation and role offering system was strictly bound to `TalentPoolMembership`:
- `TalentPoolInvitation` required a non-nullable foreign key `membershipId` pointing to `TalentPoolMembership`.
- `sendTalentPoolJobInvitation` strictly enforced `profile.talentPoolMembership.status === 'ACTIVE'` and threw an error if an employee had an active deployment.
- When Talent Acquisition clicked **Assign to Open Role** on the Redeployment Queue for workers without Talent Pool membership, the system failed with:
  > `ASSIGNMENT FAILED: Candidate is not an active member of the Talent Pool.`
- Furthermore, `endEmployeeDeployment` previously attempted to force redeployment workers into `TalentPoolMembership`, violating the fundamental business boundary that deployed workers must not undergo the Talent Pool.

---

## 2. Goals & Constraints

- **Decouple Invitations from Talent Pool:** Allow TA to offer job opportunities to both Talent Pool members and Redeployment workers.
- **Strict Boundary Preservation:** Deployed employees and redeployment workers must never undergo or be placed into the Talent Pool.
- **Support Deployed Workers:** Allow offering upcoming roles to workers whose deployment is concluding so recruiters can line up their next assignment without blockages.
- **Seamless Worker Experience:** Workers view opportunities in their portal under `/app/invitations` and can review and accept or decline.
- **Intelligent Fast-Tracking:** Sourced redeployment workers accepting roles with the same client advance straight to `COMPLIANCE` and reuse valid 201 documents.
- **Zero Breakage:** Existing Talent Pool discovery (KNN semantic search, candidate matching) remains fully functional for unselected applicants.

---

## 3. Detailed Architecture & Design

### 3.1 Database Schema (`TalentPoolInvitation`)
Modify `TalentPoolInvitation` in `backend/prisma/schema/talent-pool.prisma`:
- Add `applicantProfileId Int`: Direct foreign key to `ApplicantProfile` (`applicantProfile ApplicantProfile @relation(...)`).
- Make `membershipId Int?` nullable:
  - When inviting a Talent Pool member (who failed a previous stage), `membershipId` links to their `TalentPoolMembership`.
  - When inviting an Employee / Redeployment worker, `membershipId` is `null`.
- Add `invitations TalentPoolInvitation[]` relation to `ApplicantProfile`.

#### Migration Strategy
1. Add `applicantProfileId` column to `"TalentPoolInvitation"`.
2. Backfill existing records:
   ```sql
   UPDATE "TalentPoolInvitation" ti
   SET "applicantProfileId" = tm."applicantProfileId"
   FROM "TalentPoolMembership" tm
   WHERE ti."membershipId" = tm."id" AND ti."applicantProfileId" IS NULL;
   ```
3. Set `applicantProfileId` to `NOT NULL` and add foreign key to `"ApplicantProfile"("id")` with `ON DELETE CASCADE`.
4. Alter `"membershipId"` to `DROP NOT NULL`.
5. Create index on `("applicantProfileId", "status")`.

---

### 3.2 Backend Service Logic

#### 3.2.1 `sendTalentPoolJobInvitation` (`talent-pool-invitation.service.ts`)
- **Qualification Check:** Sourcing is valid if either:
  1. Candidate has active Talent Pool membership (`profile.talentPoolMembership?.status === 'ACTIVE'`), OR
  2. Candidate is an employee eligible for redeployment (`profile.user.employee?.status === 'AVAILABLE_FOR_REDEPLOYMENT'` or has deployment history / is in redeployment).
- If neither applies, reject with: `"Candidate is neither an active member of the Talent Pool nor eligible for redeployment."`
- **Active Deployment Exception:** If the candidate is an employee in redeployment or seeking redeployment, do not block invitation sending with active deployment checks.
- **Transactional Creation:**
  - Create invitation with `applicantProfileId: profile.id` and `membershipId: profile.talentPoolMembership?.id ?? null`.
  - Only create `TalentPoolContact` if `membershipId` is present (for Talent Pool tracking). Do not create `TalentPoolMembership` for redeployment candidates.
  - Send in-app notification and email to worker: `"New Opportunity: You've been offered [Job Title] with [Client Name]. Review details in your portal."`
  - Log audit event.

#### 3.2.2 `getMyJobInvitations` (`talent-pool-invitation.service.ts`)
- Query invitations by `applicantProfileId: profile.id` directly.
- Remove the check requiring `profile.talentPoolMembership`.
- Returns invitations for both applicants and redeployment employees.

#### 3.2.3 `respondToJobInvitation` (`talent-pool-invitation.service.ts`)
- Resolve applicant user via `invitation.applicantProfile.userId`.
- When `decision === 'ACCEPT'`:
  - Create `Application` for target `jobPostingId`.
  - If candidate has prior deployments with the same client, route to `COMPLIANCE` and reuse valid clearance documents.
  - If new client, route to `SUBMITTED`.
  - Record audit log: Note whether accepted from Redeployment offer or Talent Pool invitation.
- When `decision === 'DECLINE'`:
  - Mark invitation `DECLINED` with `declineReason`.
  - For redeployment workers, keep status as `AVAILABLE_FOR_REDEPLOYMENT` so TA can offer alternative placements.

#### 3.2.4 `listRedeploymentQueue` (`employee.service.ts`)
- In `listRedeploymentQueue`, resolve pending invitations via `profile.invitations` where `status: 'PENDING'`.
- Reflect `nextAction`: `"Waiting for applicant response"` when an offer is pending.

#### 3.2.5 Removal of Legacy Talent Pool Shoving (`employee.service.ts`)
- In `endEmployeeDeployment`, remove lines 982-995 where `AVAILABLE_FOR_REDEPLOYMENT` employees were upserted into `TalentPoolMembership`.
- Employees completing assignments will never undergo the Talent Pool.

---

### 3.3 Frontend Experience

#### 3.3.1 Redeployment Queue (`RedeploymentQueuePage.tsx`)
- Clicking **Assign to Open Role** opens the modal dialog.
- Selecting an open requisition and clicking **Send opportunity** invokes `taApi.sendTalentPoolInvitation`.
- Now succeeds cleanly for all redeployment workers (such as Juan Dela Cruz, Adrian Santos Reyes, Adrian Reyes, Nathaniel Cruz).
- Toast confirms: *"Assignment sent. The worker can review and accept the open role from their portal."*
- Row status updates to *"Waiting for applicant response"*.

#### 3.3.2 Worker Portal (`JobInvitationsPage.tsx`)
- Worker logs in and views opportunity card under `/app/invitations`.
- Can inspect role title, location, client, recruiter note, and expiration date.
- Worker clicks **Accept**, instantly creating their application.

---

## 4. Verification Plan

1. **Database & Types:** Apply SQL migration, update Prisma schema, run `prisma generate`, and run `tsc --noEmit`.
2. **Redeployment Assignment Test:**
   - As TA, navigate to `/ta/workforce?tab=redeployment`.
   - Click **Assign to Open Role** on Juan Dela Cruz (`EMP-2026-2844`).
   - Select an open job requisition and submit.
   - Verify success toast appears with zero errors.
   - Verify row updates to show *"Waiting for applicant response"*.
3. **Worker Portal Verification:**
   - Verify invitation query returns the pending offer for Juan Dela Cruz.
   - Simulate/verify invitation acceptance.
   - Confirm application created and properly routed.
4. **Test Suites:** Run backend and frontend automated test suites.
