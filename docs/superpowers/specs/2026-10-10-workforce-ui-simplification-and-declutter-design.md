# Workforce UI Simplification and Declutter Design

Date: 2026-10-10
Author: MEGS Engineering Team
Status: Draft (Pending Review)

## 1. Problem Statement

The MEGS Workforce interface currently exhibits unnecessary visual clutter and confusing navigation across several key views:

1. **Deployments Table:** Each table row displays up to four separate action buttons (`Confirm start`, `End assignment`, `Record check-in`, `View details`) side by side, consuming horizontal space and reducing readability.
2. **201 Clearance Vault:** Verified document rows render multiple status badges and buttons simultaneously (`Approved`, `View`, `Record validity`, `Validity not recorded`, `Request updated copy`), creating a wall of buttons.
3. **Document Alerts Tab:** A standalone sixth tab displays document records without explicit status chips, duplicating workflows already handled by Post-Deployment Follow-ups and 201 records.
4. **Redeployment Queue:** A `Responsible TA / follow-up` column and `Set follow-up` modal add unused complexity. Additionally, clicking `Find placement` routes to the employee profile page instead of opening an assignment workflow directly in the queue.

## 2. Goals & Constraints

- Follow the MEGS Human-Computer Interaction (HCI) standards: simplicity, low cognitive load, zero duplication, and purposeful density.
- Eliminate redundant tabs and consolidate actions into predictable patterns.
- Keep primary actions visible; group auxiliary actions into an overflow menu (`ActionMenu`).
- Enable recruiters to complete redeployment workflows directly within the queue.

## 3. Detailed Design

### 3.1 Workforce Navigation (`WorkforcePage.tsx`)

- Remove the `credential_alerts` tab identifier from `WorkforceTab` and `VALID_TABS`.
- Remove the `Document Alerts` tab item from the tabs configuration.
- Retire the tab panel mapping for `credential_alerts`.
- Retain the five core operational views:
  1. `deployments` (Site Deployments)
  2. `employees` (Employee Records 201)
  3. `clearances` (Pre-employment Queue)
  4. `post_deployment` (Post-Deployment Follow-ups)
  5. `redeployment` (Redeployment Queue)

### 3.2 Deployments Table (`DeploymentsPage.tsx`)

- Standardize table row actions to one primary button plus a three-dot `ActionMenu`:
  - **Scheduled assignments (`READY_FOR_DEPLOYMENT`):**
    - Primary button: `Confirm start`
    - Overflow menu: `View details`
  - **Active assignments (`ACTIVE`):**
    - Primary button: `View details`
    - Overflow menu: `Record check-in`, `End assignment` (danger tone)
  - **Ended / Cancelled assignments:**
    - Primary button: `View details`
- Apply the same pattern to both desktop table rows and mobile card views.

### 3.3 Employee 201 Clearance Vault (`EmployeeDetailPage.tsx`)

- Consolidate document badges into a single status indicator per row:
  - `Expired` (red badge) when the expiration date is past.
  - `Expiring soon` (amber badge) when expiration occurs within 30 days.
  - `Validity unrecorded` (amber badge) when validity is marked unknown.
  - `No expiry` (slate badge) when no expiration date applies.
  - `Approved` (emerald badge) when valid.
- Consolidate row actions:
  - Primary button: `View` (opens `DocumentPreviewModal`).
  - Overflow menu / secondary trigger: `Record validity` and `Request updated copy`.

### 3.4 Redeployment Queue (`RedeploymentQueuePage.tsx`)

- **Remove follow-up functions:**
  - Remove `Responsible TA / follow-up` column from table header and body.
  - Remove `Set follow-up` button, modal dialog, and `updateRedeploymentFollowUp` mutation call.
  - Clean up unused state variables (`ownerId`, `followUpAt`, `notes`).
- **In-place Role Assignment:**
  - Rename the action button from `Find placement` to `Assign to Open Role`.
  - Clicking `Assign to Open Role` opens an in-page modal dialog directly on the Redeployment screen.
  - The modal allows selecting an open job posting, viewing client name and location, entering an optional note, and submitting the invitation.
  - Update `backend/src/services/employee/employee.service.ts` so `listRedeploymentQueue` returns `applicantProfileId` in each item payload.

## 4. Verification Plan

1. Verify TypeScript compilation on both frontend and backend.
2. Run test suites:
   - `frontend/src/pages/ta/__tests__/TAPages.test.tsx`
   - `frontend/src/pages/ta/__tests__/WorkforcePage.test.tsx`
3. Manual inspection of:
   - Workforce page top navigation (5 tabs total).
   - Deployments table (single button + `ActionMenu`).
   - 201 Clearance Vault (single status badge + `View` button).
   - Redeployment queue (no follow-up column; in-place `Assign to Open Role` dialog).
