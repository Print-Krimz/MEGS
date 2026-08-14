# Talent Pool Redesign Spec

## 1. Goal
Transform the current Talent Pool from a simple application status (`TALENT_POOL`) into a reusable, recruiter-managed candidate pool with eligibility tracking, availability, contact history, and semantic discovery. Ensure AI processing is advisory only and doesn't auto-classify candidates.

## 2. Architecture & Database

We will introduce a new schema file: `backend/prisma/schema/talent-pool.prisma` containing:

```prisma
enum TalentPoolStatus {
  ACTIVE
  PLACED
  INACTIVE
}

enum CandidateAvailability {
  AVAILABLE
  UNAVAILABLE
  UNKNOWN
}

enum TalentPoolContactOutcome {
  INTERESTED
  NOT_INTERESTED
  NO_RESPONSE
  UNAVAILABLE
}

model TalentPoolMembership {
  id                   Int                   @id @default(autoincrement())
  applicantProfileId   Int                   @unique
  applicantProfile     ApplicantProfile      @relation(fields: [applicantProfileId], references: [id])
  
  sourceApplicationId  Int?                  
  sourceApplication    Application?          @relation(fields: [sourceApplicationId], references: [id])
  
  status               TalentPoolStatus      @default(ACTIVE)
  availability         CandidateAvailability @default(UNKNOWN)
  
  addedById            String
  addedBy              User                  @relation("PoolAddedBy", fields: [addedById], references: [id])
  addedAt              DateTime              @default(now())
  
  lastContactedAt      DateTime?
  notes                String?
  
  contacts             TalentPoolContact[]
}

model TalentPoolContact {
  id              Int                      @id @default(autoincrement())
  membershipId    Int
  membership      TalentPoolMembership     @relation(fields: [membershipId], references: [id])
  
  jobPostingId    Int
  jobPosting      JobPosting               @relation(fields: [jobPostingId], references: [id])
  
  recruiterId     String
  recruiter       User                     @relation("ContactRecruiter", fields: [recruiterId], references: [id])
  
  outcome         TalentPoolContactOutcome
  notes           String?
  contactedAt     DateTime                 @default(now())
}
```

We will also update `ApplicationStatus` in `backend/prisma/schema/main.prisma`:
- Add `REVIEW` (for successful parses, requiring TA review).
- Add `NEEDS_ATTENTION` (for parse/scoring failures).
- Maintain `TALENT_POOL` strictly as a manual TA status outcome for a specific application.

## 3. Backend Workflow

### Removing Auto AI Routing
- Update `backend/src/workers/resume.worker.ts`: Instead of automatically routing to `MATCHED` or `TALENT_POOL`, route successful parses to `REVIEW`. Route processing errors to `NEEDS_ATTENTION`.

### Talent Pool Eligibility & Search
- Update `backend/src/services/scoring/talent-pool-knn.service.ts`:
  - `discoverTalentPoolForJob`: Only include candidates with an `ACTIVE` `TalentPoolMembership`, `availability != UNAVAILABLE`, not deployed/hired, and with `hasConsentedToAi == true`.
  - The query must rank by semantic similarity to the selected Job Posting/MRF.

### Consider for Job Action
- Add a new endpoint to handle `Consider for Job`.
- Validate candidate eligibility (Active, not hired, no existing application for the target job).
- Create a NEW `Application` for the target job (leaving the old application untouched).
- Calculate and persist a new `CandidateScore` tied to the new application.
- Record a `TalentPoolContact` (e.g., `INTERESTED`).

## 4. Frontend UI Redesign

- Overhaul the current Talent Pool page.
- At the top, the TA selects a Target Job/MRF.
- The UI lists eligible candidates, showing their Name, Current Role, Skills, Location, Availability, Last Contact Date, and Semantic Match % to the selected job.
- Each candidate row/card has actions: `[View Profile]`, `[Record Contact]`, and `[Consider for Job]`.
- Implement a modal/drawer for `Record Contact` to capture the `TalentPoolContactOutcome` and notes.

## 5. Migration Strategy
- Generate a Prisma migration for the new enums and models.
- Since we are adding statuses to `ApplicationStatus`, it is an additive change.
- Existing `ApplicationStatus.TALENT_POOL` applications will not be automatically converted unless requested; TA will manually add them to the pool to trigger `TalentPoolMembership` creation.

## 6. Testing
- Test that low AI scores do NOT enter the Talent Pool.
- Test that parsing errors transition to `NEEDS_ATTENTION`.
- Test that TA manually adding a candidate creates `TalentPoolMembership`.
- Test that searching respects eligibility rules.
- Test that `Consider for Job` creates a NEW application and does not corrupt existing scores.
