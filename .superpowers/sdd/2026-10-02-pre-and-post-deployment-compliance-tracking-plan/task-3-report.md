# Task 3 Report: Deployed Applicant Submission Experience

Status: DONE

## Summary of Completed Work
1. **Contextual Status Banner**:
   - In `frontend/src/pages/applicant/ApplicationDetailPage.tsx`, updated the status banner for `ApplicationStatus.DEPLOYED`.
   - When unapproved or to-follow items remain: displays "Deployed to work site - Follow-up requirements pending" with badge indicating the count of pending follow-up requirements.
   - When all items are approved: displays "Deployed to work site - 100% Compliant" ("All pre-employment and post-deployment requirements are verified. Your 201 file is complete.").
2. **Grouped Requirements Checklist**:
   - For deployed applications, partitions the requirements into two cards:
     - "Requirements to follow up (Action needed)" for items with `reviewStatus !== "APPROVED"`, showing target deadlines, status badge, rejection notes (if rejected), and upload/replace button.
     - "Verified 201 clearances" for items with `reviewStatus === "APPROVED"`, showing green checkmark and view document button.
   - For non-deployed applications, preserves the existing standard pre-employment requirements list.
3. **Stop-Slop and HCI Compliance**:
   - Replaced all em-dashes with standard hyphens.
   - Maintained clean plain language and proper disabled upload button states.
4. **Verification**:
   - Created `frontend/src/pages/applicant/__tests__/ApplicationDetailPage.test.tsx` testing deployed with pending follow-ups, deployed 100% compliant, non-deployed layout, and upload mutation. All 4 tests passed.
   - `npx tsc -b` exited with code 0.
   - `npx oxlint` exited with 0 warnings, 0 errors.
