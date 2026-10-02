# Task 1 Brief: Update CompliancePage.tsx with Candidate-Centric Cards

## Context
Recruiters manage candidate onboarding in the Pre-employment Requirements tab. Currently, overview cards displayed document totals (182) as the hero numbers, confusing users into thinking 182 candidates were waiting when only 27 were in the queue.
This task changes the 4 overview cards so candidate headcount is the primary hero number, with document volume shown in the subtext, matching the table 1:1.

## Target File
`frontend/src/pages/ta/CompliancePage.tsx`

## Requirements
1. Update `candidateMetrics` computation in `useMemo`:
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

2. Update the 4 overview cards in JSX:
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

3. Update `getHeaderContent()`:
- `WAITING_REVIEW`:
  - Title: `"Ready for review"`
  - Description: `"Showing " + candidateMetrics.waitingReview + " candidate(s) with documents needing verification"`
- `WAITING_CANDIDATE`:
  - Title: `"Awaiting candidate submission"`
  - Description: `"Showing " + candidateMetrics.waitingCandidate + " candidate(s) (" + candidateMetrics.pendingDocs + " pending documents)"`
- `APPROVED`:
  - Title: `"Approved candidates"`
  - Description: `"Showing " + candidateMetrics.fullyApproved + " candidate(s) ready for deployment"`
- default:
  - Title: `"Pre-employment compliance queue"`
  - Description: `"Showing " + sortedApps.length + " active candidate(s) in pre-employment verification"`

4. Verification:
- Run `npm run build` in `frontend/` to confirm 0 TypeScript / bundling errors.
- Write implementer report to `c:\Users\cnico\OneDrive\Desktop\MEGS\.superpowers\sdd\2026-10-02-candidate-centric-compliance-metrics-plan\task-1-report.md`.
