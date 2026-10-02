# Candidate-Centric Pre-Employment Compliance Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Pre-employment Requirements metrics cards from raw document counters into candidate-centric KPI cards with clear document workload subtext, matching the candidate queue table 1:1.

**Architecture:** Frontend React 19 component refinement in `CompliancePage.tsx`. We derive candidate-level metrics and aggregate document status counts via `useMemo`, render candidate counts as the primary hero numbers, display clear document volume subtexts, and align table header copy with filtered results.

**Tech Stack:** React 19, TypeScript, TanStack Query, Tailwind CSS v4, Vitest, Testing Library.

## Global Constraints
- Primary hero numbers in the 4 overview cards must represent candidate headcount.
- Secondary subtext in the 4 overview cards must clearly state document counts (e.g. `182 pending documents`).
- The 4 cards must retain their interactive filtering functionality (`ALL`, `WAITING_CANDIDATE`, `WAITING_REVIEW`, `APPROVED`).
- Card accessible names and roles must preserve button accessibility and ARIA attributes (`aria-pressed`).
- Table header copy must provide clear context on active candidate count and document count.

---

### Task 1: Update CompliancePage.tsx with Candidate-Centric Cards

**Files:**
- Modify: `frontend/src/pages/ta/CompliancePage.tsx:210-240`, `frontend/src/pages/ta/CompliancePage.tsx:415-445`, `frontend/src/pages/ta/CompliancePage.tsx:615-715`

**Interfaces:**
- Consumes: `complianceApps: Application[]`, `getComplianceCounts(app: Application)`
- Produces: `candidateMetrics` state with `totalCandidates`, `waitingCandidate`, `waitingReview`, `fullyApproved`, `totalDocs`, `pendingDocs`, `submittedDocs`, `approvedDocs`

- [ ] **Step 1: Verify candidateMetrics calculation in CompliancePage.tsx**
Ensure `candidateMetrics` computes:
```tsx
  const candidateMetrics = useMemo(() => {
    let waitingReview = 0;
    let waitingCandidate = 0;
    let fullyApproved = 0;
    let toFollow = 0;

    let pendingDocs = 0;
    let submittedDocs = 0;
    let approvedDocs = 0;
    let toFollowDocs = 0;

    for (const app of complianceApps) {
      const { submittedCount, pendingCount, approvedCount, toFollowCount, totalCount } = getComplianceCounts(app);
      if (submittedCount > 0) waitingReview++;
      if (pendingCount > 0) waitingCandidate++;
      if (totalCount > 0 && approvedCount + toFollowCount === totalCount) fullyApproved++;
      if (toFollowCount > 0) toFollow++;

      pendingDocs += pendingCount;
      submittedDocs += submittedCount;
      approvedDocs += approvedCount;
      toFollowDocs += toFollowCount;
    }

    return {
      totalCandidates: complianceApps.length,
      waitingReview,
      waitingCandidate,
      fullyApproved,
      toFollow,
      totalDocs: pendingDocs + submittedDocs + approvedDocs + toFollowDocs,
      pendingDocs,
      submittedDocs,
      approvedDocs,
      toFollowDocs,
    };
  }, [complianceApps]);
```

- [ ] **Step 2: Update the 4 overview cards JSX**
Update the 4 buttons to render candidate headcount as the primary hero number, with document count as the secondary subtext:
- **Card 1 (ALL):**
  - Title: `Candidates in compliance`
  - Hero Number: `{candidateMetrics.totalCandidates}`
  - Subtext: `{candidateMetrics.totalDocs} requirements tracked`
- **Card 2 (WAITING_CANDIDATE):**
  - Title: `Awaiting submission`
  - Hero Number: `{candidateMetrics.waitingCandidate}`
  - Subtext: `{candidateMetrics.pendingDocs} pending documents`
- **Card 3 (WAITING_REVIEW):**
  - Title: `Ready for review`
  - Hero Number: `{candidateMetrics.waitingReview}`
  - Subtext: `{candidateMetrics.submittedDocs} documents to verify`
- **Card 4 (APPROVED):**
  - Title: `Cleared candidates`
  - Hero Number: `{candidateMetrics.fullyApproved}`
  - Subtext: `Ready for contract & orientation`

- [ ] **Step 3: Update contextual table header description**
Update `getHeaderContent()` to reflect candidate count and document count:
- `WAITING_REVIEW`: Title: `Ready for review`, Description: `Showing ${candidateMetrics.waitingReview} candidate(s) with documents needing verification`
- `WAITING_CANDIDATE`: Title: `Awaiting candidate submission`, Description: `Showing ${candidateMetrics.waitingCandidate} candidate(s) (${candidateMetrics.pendingDocs} pending documents)`
- `APPROVED`: Title: `Approved candidates`, Description: `Showing ${candidateMetrics.fullyApproved} candidate(s) ready for deployment`
- Default: Title: `Pre-employment compliance queue`, Description: `Showing ${sortedApps.length} active candidate(s) in pre-employment verification`

- [ ] **Step 4: Verify typecheck & build**
Run: `npm run build` in `frontend/`
Expected: 0 errors

- [ ] **Step 5: Commit changes**
```bash
git add frontend/src/pages/ta/CompliancePage.tsx
git commit -m "feat(ta): render candidate-centric compliance metric cards"
```

---

### Task 2: Update Unit Tests and Verify Regression Free

**Files:**
- Modify: `frontend/src/pages/ta/__tests__/CompliancePage.test.tsx`

**Interfaces:**
- Consumes: `mockApplications` (Carlos Mendoza: 1 submitted; Ana Santos: 2 pending; Benjie Ramos: 2 approved; Dina Cruz: 0 reqs)
- Produces: Passing Vitest assertions for candidate counts and document subtext

- [ ] **Step 1: Update CompliancePage.test.tsx assertions**
Update test "renders metric cards with proper aria-pressed state and queue table" and "supports interactive metric card filtering":
- Assert Card 1 button has accessible text matching `/Candidates in compliance/i` with count `4` and `12 requirements tracked` (or `6 requirements tracked` based on mockApplications).
- Assert Card 2 button has accessible text matching `/Awaiting submission/i` with count `1` and `2 pending documents`.
- Assert Card 3 button has accessible text matching `/Ready for review/i` with count `1` and `1 documents to verify`.
- Assert Card 4 button has accessible text matching `/Cleared candidates/i` with count `1` and `Ready for deployment`.
- Verify clicking each card properly filters candidates.

- [ ] **Step 2: Run test suite**
Run: `npm test src/pages/ta/__tests__/CompliancePage.test.tsx`
Expected: PASS (all 8 tests)

- [ ] **Step 3: Run TAPages.test.tsx**
Run: `npm test src/pages/ta/__tests__/TAPages.test.tsx`
Expected: PASS (all 14 tests)

- [ ] **Step 4: Commit test updates**
```bash
git add frontend/src/pages/ta/__tests__/CompliancePage.test.tsx
git commit -m "test(ta): verify candidate-centric metric cards and filtering in CompliancePage"
```
