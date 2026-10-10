# Workforce UI Simplification and Declutter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Streamline the MEGS Workforce user interface by eliminating the redundant Document Alerts tab, replacing clustered table row buttons with clean primary actions and overflow menus across Deployments and 201 records, and adding in-place role assignment to the Redeployment queue.

**Architecture:** Use existing MEGS UI primitives (`ActionMenu`, `Button`, `Dialog`, `StatusBadge`, `ComboBox`) to reduce cognitive clutter without creating new abstractions. Keep authoritative contracts intact while providing in-place modal flows.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query, TanStack Router, Vitest, Express 5, Prisma 7.

## Global Constraints

- Retain existing backend endpoints and database schemas unless specifically instructed to add fields to responses.
- Adhere to the MEGS 10-point Human-Computer Interaction (HCI) checklist: single primary action per row, no redundant badges, plain user language.
- Every async mutation button must show loading states and disabled indicators during submissions.
- Do not introduce external dependencies; use existing `ActionMenu` from `frontend/src/components/common/ActionMenu.tsx`.

---

### Task 1: Remove Redundant Document Alerts Tab from Workforce Navigation

**Files:**
- Modify: `frontend/src/pages/ta/WorkforcePage.tsx`
- Modify: `frontend/src/routes.tsx:418-472`
- Test: `frontend/src/pages/ta/__tests__/WorkforcePage.test.tsx`

**Interfaces:**
- Consumes: `Tabs` from `../../components/common`
- Produces: `WorkforceTab` type without `credential_alerts`

- [ ] **Step 1: Write test asserting 5 core tabs on WorkforcePage**

In `frontend/src/pages/ta/__tests__/WorkforcePage.test.tsx`, update the tab count test to assert exactly 5 tabs (`Deployments`, `Employee Records (201)`, `Pre-employment Queue`, `Post-Deployment Follow-ups`, `Redeployment`) and assert that `Document Alerts` is not rendered.

- [ ] **Step 2: Run test to observe failure**

Run: `npm --prefix frontend test frontend/src/pages/ta/__tests__/WorkforcePage.test.tsx`
Expected: FAIL due to missing Redeployment tab or extra Document Alerts tab.

- [ ] **Step 3: Update WorkforcePage.tsx and routes.tsx**

In `frontend/src/pages/ta/WorkforcePage.tsx`:
- Remove `credential_alerts` from `WorkforceTab` and `VALID_TABS`.
- Remove the `Document Alerts` entry from `Tabs` items.
- Remove `EmployeeCredentialAlertsPage` lazy import and tab panel render.

In `frontend/src/routes.tsx`:
- Remove `credential_alerts` from `WorkforceSearch` interface and `validateSearch` logic.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test frontend/src/pages/ta/__tests__/WorkforcePage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ta/WorkforcePage.tsx frontend/src/routes.tsx frontend/src/pages/ta/__tests__/WorkforcePage.test.tsx
git commit -m "feat(workforce): remove redundant document alerts tab and retain 5 core tabs"
```

---

### Task 2: Streamline Deployments Table Row Actions

**Files:**
- Modify: `frontend/src/pages/ta/DeploymentsPage.tsx:220-385`

**Interfaces:**
- Consumes: `ActionMenu` from `../../components/common/ActionMenu`
- Produces: Compact single-button + overflow menu per deployment row

- [ ] **Step 1: Update DeploymentsPage desktop table actions**

In `frontend/src/pages/ta/DeploymentsPage.tsx`:
- Import `ActionMenu` from `../../components/common`.
- Replace the horizontal row of up to 4 buttons (`Confirm start`, `End assignment`, `Record check-in`, `View details`) with:
  - If `READY_FOR_DEPLOYMENT`: Primary button `Confirm start`, plus `ActionMenu` containing `View details`.
  - If `ACTIVE`: Primary button `View details`, plus `ActionMenu` containing `Record check-in` and `End assignment` (`tone: "danger"`).
  - Other statuses: Primary button `View details`.

- [ ] **Step 2: Update DeploymentsPage mobile card actions**

Update the mobile layout (`md:hidden` block) to use the same consolidated structure so mobile cards do not wrap 4 buttons.

- [ ] **Step 3: Run frontend type check and verify build**

Run: `npm --prefix frontend run typecheck`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ta/DeploymentsPage.tsx
git commit -m "refactor(deployments): streamline table row actions with ActionMenu"
```

---

### Task 3: Consolidate Badges and Actions in 201 Clearance Vault

**Files:**
- Modify: `frontend/src/pages/ta/EmployeeDetailPage.tsx:640-690`

**Interfaces:**
- Consumes: `ActionMenu` from `../../components/common/ActionMenu`
- Produces: Single status badge and consolidated action trigger per verified document

- [ ] **Step 1: Refactor Verified 201 Documents row display**

In `frontend/src/pages/ta/EmployeeDetailPage.tsx`:
- Import `ActionMenu` from `../../components/common`.
- For each verified document row:
  - Replace the dual badges (`Approved` + `Validity not recorded` / `Expired`) with a single status badge:
    - If `expiresAt` < today: `StatusBadge status="Expired" type="raw" size="sm"`
    - If `expiresAt` within 30 days: `StatusBadge status="Expiring soon" type="raw" size="sm"`
    - If `validityStatus === "UNKNOWN"`: `StatusBadge status="Validity unrecorded" type="raw" size="sm"`
    - If `validityStatus === "NO_EXPIRY"`: `StatusBadge status="No expiry" type="raw" size="sm"`
    - Else: `StatusBadge status="Approved" type="raw" size="sm"`
  - Provide a single `View` button when `documentId` exists.
  - Provide an `ActionMenu` containing:
    - `Record validity` (opens validity modal)
    - `Request updated copy` (opens document update request modal)

- [ ] **Step 2: Run frontend type check**

Run: `npm --prefix frontend run typecheck`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ta/EmployeeDetailPage.tsx
git commit -m "refactor(employee-detail): consolidate badges and actions in 201 clearance vault"
```

---

### Task 4: Overhaul Redeployment Queue & In-Place Role Assignment

**Files:**
- Modify: `backend/src/services/employee/employee.service.ts:448-485`
- Modify: `frontend/src/lib/api/employees.api.ts:11-20`
- Modify: `frontend/src/pages/ta/RedeploymentQueuePage.tsx`

**Interfaces:**
- Consumes: `taApi.listJobs` and `taApi.sendTalentPoolInvitation`
- Produces: In-place `Assign to Open Role` dialog directly within `RedeploymentQueuePage`

- [ ] **Step 1: Include applicantProfileId in backend listRedeploymentQueue**

In `backend/src/services/employee/employee.service.ts`:
- Ensure `listRedeploymentQueue` includes `applicantProfileId: profile?.id ?? null` in each item.
- Update `RedeploymentQueueResponse` type in `frontend/src/lib/api/employees.api.ts` to include `applicantProfileId: number | null`.

- [ ] **Step 2: Clean up follow-up functions from RedeploymentQueuePage**

In `frontend/src/pages/ta/RedeploymentQueuePage.tsx`:
- Remove `Responsible TA / follow-up` header column and row cells.
- Remove `Set follow-up` button.
- Remove `Dialog` modal for follow-up, `updateRedeploymentFollowUp` mutation, and unused state variables (`ownerId`, `followUpAt`, `notes`).

- [ ] **Step 3: Add in-place Role Assignment dialog**

In `frontend/src/pages/ta/RedeploymentQueuePage.tsx`:
- Add action button labeled `Assign to Open Role`.
- Clicking opens a dialog containing:
  - Role selection combobox querying open jobs (`taApi.listJobs({ status: "OPEN" })`).
  - Job option labels formatted with title, client name, and site location.
  - Optional note textarea.
  - Primary button `Send assignment invitation` invoking `taApi.sendTalentPoolInvitation`.
  - Proper error and success notifications.

- [ ] **Step 4: Run typecheck and test**

Run: `npm --prefix frontend run typecheck`
Run: `npm --prefix backend run build` (or `npx tsc --noEmit`)
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/employee/employee.service.ts frontend/src/lib/api/employees.api.ts frontend/src/pages/ta/RedeploymentQueuePage.tsx
git commit -m "feat(redeployment): remove follow-up columns and add in-place role assignment dialog"
```

---

### Task 5: Final End-to-End Verification & HCI Audit

**Files:**
- All modified files

- [ ] **Step 1: Run complete test suites**

Run: `npm --prefix frontend test`
Run: `npm --prefix backend test`

- [ ] **Step 2: Check 10-Point HCI Review Checklist**

1. Understandability: Is each screen clear to a first-time user?
2. Zero Duplication: No redundant badges or duplicate buttons.
3. Plain Language: Action buttons use direct verbs (`Assign to Open Role`, `View details`).
4. Smart Automation: In-place modal prevents tedious navigation redirects.
5. Consistency: Buttons follow standard primary vs `ActionMenu` hierarchy.
6. Anti-Slop: No visual noise or decorative excess.
7. Next-Step Clarity: High visibility for active tasks.
8. Error Recovery: Dialogs have clear cancel and dismiss actions.
9. Task-Based Hierarchy: Most frequent actions are one click away.
10. Purpose-Built Design: Clean industrial design tailored to recruiter operations.

- [ ] **Step 3: Final Commit & Clean up**

```bash
git status
```
Confirm working tree is clean.
