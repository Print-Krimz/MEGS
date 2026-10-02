# Design: Candidate-Centric Pre-Employment Compliance Metrics

## 1. Overview & Problem Statement
On the Pre-employment Requirements queue (`/ta/workforce` tab 3), recruiters manage candidate onboarding documents. Previously, the top overview cards displayed raw document checklist totals (e.g., `182`) as the primary hero number. Because the table below displays **candidates**, recruiters naturally interpreted `182` as candidate headcount, causing confusion when the table only showed 27 candidates ($26 \text{ candidates} \times 7 \text{ documents} = 182$).

This design aligns the interface with enterprise HR/ATS standards (Workday, Greenhouse, Lever): **Candidate Headcount is the primary hero number**, with **Document Volume as clear secondary context**.

## 2. Card Hierarchy & Specifications

The 4 interactive overview cards will display candidate counts as their primary figure with document workload in the subtext:

| Card | Primary Hero Number | Card Title / Label | Subtext (Document Context) | Filter Action |
|:---|:---:|:---|:---|:---|
| **1. All Compliance** | `{totalCandidates}` (e.g., `27`) | Candidates in compliance | `{totalRequirements} requirements tracked` | Shows all active compliance candidates (`ALL`) |
| **2. Awaiting Submission** | `{waitingCandidateCandidates}` (e.g., `26`) | Awaiting submission | `{pendingDocs} pending documents` | Filters to candidates with $\ge 1$ pending document (`WAITING_CANDIDATE`) |
| **3. Needs TA Review** | `{waitingReviewCandidates}` (e.g., `0`) | Ready for review | `{submittedDocs} documents to verify` | Filters to candidates with $\ge 1$ submitted document (`WAITING_REVIEW`) |
| **4. Cleared / Ready** | `{fullyApprovedCandidates}` (e.g., `0`) | Cleared candidates | `Ready for contract & orientation` | Filters to candidates whose requirements are 100% satisfied (`APPROVED`) |

## 3. Cognitive Ergonomics & 1:1 Mapping
1. **1:1 Click-to-Table Row Alignment:** When a recruiter clicks a card displaying `26`, the candidate queue immediately shows **26 rows**. The mental expectation matches the visual reality with zero cognitive dissonance.
2. **Clear Distinction Between People and Checklists:** Recruiters see both dimensions at a glance:
   - *How many people need follow-up?* **26 candidates.**
   - *How much document paperwork is pending?* **182 documents.**
3. **Table Header Feedback:** When a filter is active, the table header explicitly reaffirms the candidate count and document count (e.g., `Showing 26 candidates · 182 pending documents`).

## 4. Frontend Implementation Details
- **File:** `frontend/src/pages/ta/CompliancePage.tsx`
- **State Calculation:** Derive `candidateMetrics` from `complianceApps` in `useMemo`:
  - `totalCandidates`: Total applications in `COMPLIANCE` (27).
  - `waitingCandidateCandidates`: Applications with `pendingCount > 0` (26).
  - `waitingReviewCandidates`: Applications with `submittedCount > 0` (0).
  - `fullyApprovedCandidates`: Applications where `approvedCount + toFollowCount === totalCount` (0).
  - `pendingDocs`: Total requirements across all applications with status `PENDING` (182).
  - `submittedDocs`: Total requirements across all applications with status `SUBMITTED` (0).
  - `approvedDocs`: Total requirements with status `APPROVED` (0).
  - `totalRequirements`: Total requirements across active compliance applications (183).
- **Interactive Card Rendering:**
  - Hero number renders candidate count in `text-2xl font-bold font-mono`.
  - Title renders clear state in `text-xs font-semibold`.
  - Subtext renders document context in `text-[11px] font-mono`.

## 5. Verification Plan
1. **Frontend Unit Tests:** Update `CompliancePage.test.tsx` to assert that:
   - Card 1 shows 4 candidates and 12 requirements tracked for mock data.
   - Card 2 shows 1 candidate and 4 pending documents.
   - Card 3 shows 1 candidate and 3 documents needing review.
   - Card 4 shows 1 cleared candidate ready for contract.
   - Clicking each card properly filters candidates.
2. **Type Checking:** Run `npx tsc --noEmit` in `frontend/` (0 errors).
3. **Frontend Build:** Run `npm run build` (0 errors).
4. **Interactive Browser Verification:** Verify in browser that clicking Card 2 shows 26 candidates and Card 1 shows 27 candidates.
