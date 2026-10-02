# Task 2 Brief: Update Unit Tests and Verify Regression Free

## Context
Task 1 updated `frontend/src/pages/ta/CompliancePage.tsx` to render candidate-centric metric cards and dynamic header descriptions.
In Task 2, update `frontend/src/pages/ta/__tests__/CompliancePage.test.tsx` so all test assertions match the new accessible names, counts, and contextual headers, and verify that the entire test suite passes.

## Target File
`frontend/src/pages/ta/__tests__/CompliancePage.test.tsx`

## Requirements
1. In `renders metric cards with proper aria-pressed state and queue table`:
   - Query Card 1 with `getByRole("button", { name: /Candidates in compliance/i })`
   - Query Card 2 with `getByRole("button", { name: /Awaiting submission/i })`
   - Query Card 3 with `getByRole("button", { name: /Ready for review/i })`
   - Query Card 4 with `getByRole("button", { name: /Cleared candidates/i })`
   - Verify `aria-pressed` states: Card 1 is `"true"`, Cards 2, 3, 4 are `"false"`.
   - Verify default header: `"Pre-employment compliance queue"` and text containing `"active candidate(s) in pre-employment verification"`.

2. In `supports interactive metric card filtering and contextual header updates`:
   - Test Card 3 click:
     - `fireEvent.click(waitingReviewCard);`
     - Verify `aria-pressed` is `"true"`.
     - Verify text contains `"Showing 1 candidate(s) with documents needing verification"`.
     - Verify "Carlos Mendoza" is displayed and "Ana Santos" is not.
   - Test Card 2 click:
     - `fireEvent.click(waitingCandidateCard);`
     - Verify `aria-pressed` is `"true"`.
     - Verify text contains `"Showing 1 candidate(s) (2 pending documents)"`.
     - Verify "Ana Santos" is displayed and "Carlos Mendoza" is not.
   - Test Card 4 click:
     - `fireEvent.click(approvedCard);`
     - Verify `aria-pressed` is `"true"`.
     - Verify text contains `"Showing 1 candidate(s) ready for deployment"`.
     - Verify "Benjie Ramos" is displayed and "Carlos Mendoza" is not.
   - Test Card 1 click:
     - `fireEvent.click(trackedCard);`
     - Verify `aria-pressed` is `"true"`.
     - Verify text contains `"Showing 4 active candidate(s) in pre-employment verification"`.

3. Run test command:
   ```bash
   npm test src/pages/ta/__tests__/CompliancePage.test.tsx
   ```
   All 8 tests must pass.

4. Run TAPages test command:
   ```bash
   npm test src/pages/ta/__tests__/TAPages.test.tsx
   ```
   All 14 tests must pass.

5. Write implementer report to:
   `c:\Users\cnico\OneDrive\Desktop\MEGS\.superpowers\sdd\2026-10-02-candidate-centric-compliance-metrics-plan\task-2-report.md`
