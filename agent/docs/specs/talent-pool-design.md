# Talent Pool & Semantic Candidate Discovery Specification

This specification outlines the architecture, database schema, availability management, and KNN vector search capabilities of the MEGS Talent Pool.

---

## 1. Objectives

- **Reusable Candidate Sourcing:** Maintain a high-quality reservoir of vetted applicants who can be quickly matched to newly opened MRFs.
- **Availability Tracking:** Track real-time candidate availability (`AVAILABLE`, `UNAVAILABLE`, `UNKNOWN`) and engagement history.
- **Semantic Discovery:** Leverage local vector embeddings and pgvector cosine similarity to surface top-matching candidates for new job requisitions without manual boolean queries.

---

## 2. Database Schema (`talent-pool.prisma`)

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
  applicantProfile     ApplicantProfile      @relation(fields: [applicantProfileId], references: [id], onDelete: Cascade)
  
  sourceApplicationId  Int?                  
  sourceApplication    Application?          @relation(fields: [sourceApplicationId], references: [id], onDelete: SetNull)
  
  status               TalentPoolStatus      @default(ACTIVE)
  availability         CandidateAvailability @default(UNKNOWN)
  
  addedById            String
  addedBy              User                  @relation("PoolAddedBy", fields: [addedById], references: [id])
  addedAt              DateTime              @default(now())
  
  lastContactedAt      DateTime?
  notes                String?
  
  contacts             TalentPoolContact[]
  
  createdAt            DateTime              @default(now())
  updatedAt            DateTime              @updatedAt

  @@index([status, availability])
}

model TalentPoolContact {
  id           Int                      @id @default(autoincrement())
  membershipId Int
  membership   TalentPoolMembership     @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  contactedById String
  contactedBy  User                     @relation("ContactActor", fields: [contactedById], references: [id])
  channel      String                   // EMAIL, PHONE, SMS
  outcome      TalentPoolContactOutcome
  notes        String?
  contactedAt  DateTime                 @default(now())

  @@index([membershipId, contactedAt])
}
```

---

## 3. Semantic Vector Search & Match Algorithm

1. **Embedding Generation:**
   - When an applicant profile is created or updated, `@xenova/transformers` (`all-MiniLM-L6-v2`) generates a 384-dimensional vector from skills, experience summary, and job titles.
   - The vector is stored in PostgreSQL using the pgvector `vector(384)` type.
2. **K-Nearest Neighbors (KNN) Query:**
   - When a recruiter searches for candidates for an MRF/Job, the MRF description and requirements are embedded.
   - Cosine distance (`<=>`) queries return the closest matching candidates:
     ```sql
     SELECT id, applicant_profile_id, 1 - (embedding <=> $1) AS similarity
     FROM "ApplicantProfile"
     WHERE status = 'ACTIVE'
     ORDER BY embedding <=> $1
     LIMIT 20;
     ```
3. **Filtering & Sourcing Action:**
   - Recruiter filters results by location, availability, and minimum match score.
   - Recruiter can invite candidate directly or create an application linked to the new Job Posting.
