# Pre-Employment and Post-Deployment Compliance Lifecycle Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide clean lifecycle separation for candidate compliance by partitioning the workflow into a Pre-Employment Queue (candidates pending deployment) and a Post-Deployment Follow-ups Queue (active deployed workers with to-follow documents), with mobile-ready post-deployment document upload for workers.

**Architecture:** Maintain a unified `ComplianceRequirement` data model while introducing stage-aware queries (`scope = "PRE_DEPLOYMENT" | "POST_DEPLOYMENT"`). The Workforce management view adds a dedicated "Post-Deployment Follow-ups" operational tab. The Applicant portal separates to-follow requirements from verified records when the application is `DEPLOYED`.

**Tech Stack:** Express 5, TypeScript, Prisma 7.8, React 19, Vite, TanStack Query, TanStack Router, Tailwind CSS v4, Lucide React, Vitest.

## Global Constraints
- Do not create redundant document tables; reuse `ComplianceRequirement` linked to `Application` and `Employee`.
- Status `TO_FOLLOW` must never block candidate progression to `CONTRACT_AND_ORIENTATION` or `DEPLOYED`.
- Follow strict stop-slop prose rules: active voice, human subjects, no filler phrases, no adverbs, no em-dashes.
- Follow frontend-hci rules: 4-state UI handling (loading, error, empty, success), plain language without IT jargon, visual restraint without gradient or pill badge clutter.
- All date calculations must respect Asia/Manila calendar date utilities (`toManilaDateOnly`, `manilaDateString`).

---

### Task 1: Backend Scoped Compliance Queries & Follow-Up Endpoints

**Files:**
- Modify: `backend/src/schemas/ta.schema.ts`
- Modify: `backend/src/services/ta/ta.compliance.service.ts`
- Modify: `backend/src/controllers/ta/ta.compliance.controller.ts`
- Modify: `backend/src/routes/ta/ta.compliance.routes.ts`
- Test: `backend/tests/services/ta.compliance.scope.test.ts`

**Interfaces:**
- Consumes: `prisma.application`, `prisma.complianceRequirement`, `prisma.deployment`
- Produces:
  ```typescript
  export interface DeployedFollowUpApplication {
    applicationId: number;
    candidateName: string;
    candidateEmail: string;
    employeeNumber: string | null;
    jobTitle: string;
    clientName: string;
    deploymentDate: Date | null;
    daysOnSite: number;
    pendingRequirements: {
      id: number;
      documentLabel: string;
      reviewStatus: string;
      toFollowExpectedAt: Date | null;
      documentId: number | null;
    }[];
    urgency: "HEALTHY" | "UPCOMING" | "OVERDUE";
  }
  ```

- [ ] **Step 1: Write the failing backend test**

Create `backend/tests/services/ta.compliance.scope.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getScopedComplianceApplications } from "../../src/services/ta/ta.compliance.service.js";
import prisma from "../../src/utils/prisma.js";

vi.mock("../../src/utils/prisma.js", () => ({
  default: {
    application: {
      findMany: vi.fn(),
    },
  },
}));

describe("getScopedComplianceApplications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters pre-employment candidates by COMPLIANCE and CONTRACT_AND_ORIENTATION stages", async () => {
    (prisma.application.findMany as any).mockResolvedValueOnce([
      { id: 101, status: "COMPLIANCE", complianceRequirements: [{ id: 1, reviewStatus: "PENDING" }] },
    ]);

    const result = await getScopedComplianceApplications("PRE_DEPLOYMENT");
    expect(prisma.application.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["COMPLIANCE", "CONTRACT_AND_ORIENTATION"] },
        }),
      })
    );
    expect(result).toHaveLength(1);
  });

  it("filters post-deployment workers by DEPLOYED status with to-follow requirements", async () => {
    (prisma.application.findMany as any).mockResolvedValueOnce([
      {
        id: 201,
        status: "DEPLOYED",
        complianceRequirements: [
          { id: 2, reviewStatus: "TO_FOLLOW", toFollowExpectedAt: new Date("2026-10-30") },
        ],
      },
    ]);

    const result = await getScopedComplianceApplications("POST_DEPLOYMENT");
    expect(prisma.application.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "DEPLOYED",
          complianceRequirements: {
            some: {
              reviewStatus: { in: ["TO_FOLLOW", "PENDING", "SUBMITTED", "REJECTED"] },
            },
          },
        }),
      })
    );
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test backend/tests/services/ta.compliance.scope.test.ts` in `backend` workspace.
Expected: FAIL with "getScopedComplianceApplications is not a function".

- [ ] **Step 3: Implement scoped query service and controller endpoints**

In `backend/src/services/ta/ta.compliance.service.ts`:
Implement `getScopedComplianceApplications`:
```typescript
export type ComplianceScope = "PRE_DEPLOYMENT" | "POST_DEPLOYMENT" | "ALL";

export const getScopedComplianceApplications = async (scope: ComplianceScope = "ALL") => {
  const whereClause: any = {
    isArchived: false,
  };

  if (scope === "PRE_DEPLOYMENT") {
    whereClause.status = { in: ["COMPLIANCE", "CONTRACT_AND_ORIENTATION"] };
  } else if (scope === "POST_DEPLOYMENT") {
    whereClause.status = "DEPLOYED";
    whereClause.complianceRequirements = {
      some: {
        reviewStatus: { in: ["TO_FOLLOW", "PENDING", "SUBMITTED", "REJECTED"] },
      },
    };
  }

  return await prisma.application.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          applicantProfile: {
            select: { firstName: true, lastName: true, middleName: true, phone: true },
          },
          employee: {
            select: { id: true, employeeNumber: true, status: true },
          },
        },
      },
      jobPosting: {
        select: {
          id: true,
          title: true,
          mrf: {
            select: {
              id: true,
              mrfNumber: true,
              client: { select: { id: true, name: true } },
            },
          },
        },
      },
      deployments: {
        where: { isActive: true },
        take: 1,
        orderBy: { startDate: "desc" },
      },
      complianceRequirements: {
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
};
```

In `backend/src/controllers/ta/ta.compliance.controller.ts`:
Add `getScopedApplicationsHandler`:
```typescript
export const getScopedApplicationsHandler = async (req: Request, res: Response) => {
  try {
    const scope = (req.query.scope as ComplianceScope) || "ALL";
    const applications = await getScopedComplianceApplications(scope);
    return res.json({ success: true, data: applications });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to fetch compliance applications" });
  }
};
```

In `backend/src/routes/ta/ta.compliance.routes.ts`:
Register `GET /queue` with `getScopedApplicationsHandler`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test backend/tests/services/ta.compliance.scope.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add backend/src/services/ta/ta.compliance.service.ts backend/src/controllers/ta/ta.compliance.controller.ts backend/src/routes/ta/ta.compliance.routes.ts backend/tests/services/ta.compliance.scope.test.ts
git commit -m "feat(compliance): add scoped pre and post deployment compliance query service"
```

---

### Task 2: Frontend API Client & Post-Deployment Follow-ups View

**Files:**
- Modify: `frontend/src/lib/api/ta.api.ts`
- Create: `frontend/src/pages/ta/PostDeploymentCompliancePage.tsx`
- Modify: `frontend/src/pages/ta/WorkforcePage.tsx`
- Test: `frontend/src/pages/ta/__tests__/PostDeploymentCompliancePage.test.tsx`

**Interfaces:**
- Consumes: `taApi.getComplianceQueue(scope)`
- Produces: `<PostDeploymentCompliancePage hideHeader?: boolean />`, updated Workforce tab items.

- [ ] **Step 1: Write the failing frontend component test**

Create `frontend/src/pages/ta/__tests__/PostDeploymentCompliancePage.test.tsx`:
```tsx
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PostDeploymentCompliancePage } from "../PostDeploymentCompliancePage";
import { taApi } from "../../../lib/api/ta.api";

vi.mock("../../../lib/api/ta.api", () => ({
  taApi: {
    getComplianceQueue: vi.fn(),
    reviewComplianceRequirement: vi.fn(),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
}));

describe("PostDeploymentCompliancePage", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  it("renders post-deployment follow-up queue header and records", async () => {
    (taApi.getComplianceQueue as any).mockResolvedValueOnce([
      {
        id: 501,
        status: "DEPLOYED",
        user: {
          applicantProfile: { firstName: "Juan", lastName: "Dela Cruz" },
          employee: { employeeNumber: "EMP-2026-0042" },
        },
        jobPosting: {
          title: "Warehouse Staff",
          mrf: { client: { name: "Apex Logistics" } },
        },
        deployments: [{ startDate: "2026-09-15T00:00:00Z" }],
        complianceRequirements: [
          {
            id: 11,
            documentLabel: "Fit to Work Medical Exam",
            reviewStatus: "TO_FOLLOW",
            toFollowExpectedAt: "2026-10-25T00:00:00Z",
          },
        ],
      },
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <PostDeploymentCompliancePage />
      </QueryClientProvider>
    );

    expect(await screen.findByText(/Juan Dela Cruz/i)).toBeDefined();
    expect(screen.getByText(/EMP-2026-0042/i)).toBeDefined();
    expect(screen.getByText(/Apex Logistics/i)).toBeDefined();
    expect(screen.getByText(/Fit to Work Medical Exam/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test frontend/src/pages/ta/__tests__/PostDeploymentCompliancePage.test.tsx` in `frontend`.
Expected: FAIL with "Cannot find module PostDeploymentCompliancePage".

- [ ] **Step 3: Implement taApi endpoint, PostDeploymentCompliancePage, and WorkforcePage tabs**

In `frontend/src/lib/api/ta.api.ts`:
Add:
```typescript
getComplianceQueue: async (scope: "PRE_DEPLOYMENT" | "POST_DEPLOYMENT" | "ALL" = "ALL"): Promise<Application[]> => {
  const res = await api.get<{ success: boolean; data: Application[] }>(`/ta/compliance/queue?scope=${scope}`);
  return res.data.data;
},
```

Create `frontend/src/pages/ta/PostDeploymentCompliancePage.tsx`:
Implement the high-density table displaying:
- Employee name, employee number, site assignment
- Days active on site
- Outstanding requirements badges with `TO_FOLLOW` indicator
- Urgency badge (Healthy / Due soon / Overdue) based on `toFollowExpectedAt`
- Quick Review modal trigger to inspect worker uploads and approve or extend dates.

In `frontend/src/pages/ta/WorkforcePage.tsx`:
Add tab item:
```tsx
{ id: "post_deployment", label: "Post-Deployment Follow-ups", icon: FileClock, panelId: "workforce-post-deployment" },
```
Mount `<PostDeploymentCompliancePage hideHeader />` when `activeTab === "post_deployment"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test frontend/src/pages/ta/__tests__/PostDeploymentCompliancePage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/lib/api/ta.api.ts frontend/src/pages/ta/PostDeploymentCompliancePage.tsx frontend/src/pages/ta/WorkforcePage.tsx frontend/src/pages/ta/__tests__/PostDeploymentCompliancePage.test.tsx
git commit -m "feat(workforce): add post-deployment follow-up queue and workforce tab"
```

---

### Task 3: Deployed Applicant Submission Experience

**Files:**
- Modify: `frontend/src/pages/applicant/ApplicationDetailPage.tsx`
- Test: `frontend/src/pages/applicant/__tests__/ApplicationDetailPage.test.tsx`

**Interfaces:**
- Consumes: `application.complianceRequirements`, `applicantJobsApi.uploadComplianceDocument`
- Produces: Contextual post-deployment banner and segmented To-Follow vs. Completed checklist sections.

- [ ] **Step 1: Write the failing test for Deployed Applicant view**

Update or add in `frontend/src/pages/applicant/__tests__/ApplicationDetailPage.test.tsx`:
```tsx
it("renders post-deployment to-follow section when candidate is deployed with incomplete requirements", async () => {
  // Test that deployed applicant with TO_FOLLOW items sees the 'Requirements to follow up' header
  // and the target completion date badge
});
```

- [ ] **Step 2: Run test to verify expected failure**

Run: `npm test frontend/src/pages/applicant/__tests__/ApplicationDetailPage.test.tsx`
Expected: FAIL due to missing post-deployment to-follow grouping.

- [ ] **Step 3: Implement grouped to-follow view in `ApplicationDetailPage.tsx`**

In `frontend/src/pages/applicant/ApplicationDetailPage.tsx`:
1. Check if `application.status === ApplicationStatus.DEPLOYED`.
2. Compute `pendingFollowUps = compliance.filter((c) => c.reviewStatus !== "APPROVED")`.
3. If `pendingFollowUps.length > 0`:
   - Render informational notice: *"You are actively deployed. Upload your remaining requirements once available."*
   - Segment requirements checklist into:
     - **Requirements to Follow Up (Action Needed):** Shows each unapproved item, `toFollowExpectedAt` target date, and prominent `Upload Document` button.
     - **Verified 201 Clearances:** Shows approved items with checkmark and preview button.
4. If `pendingFollowUps.length === 0`:
   - Render complete notice: *"All pre-employment and post-deployment requirements are verified."*

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test frontend/src/pages/applicant/__tests__/ApplicationDetailPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/pages/applicant/ApplicationDetailPage.tsx frontend/src/pages/applicant/__tests__/ApplicationDetailPage.test.tsx
git commit -m "feat(applicant): group post-deployment to-follow requirements on application detail"
```

---

### Task 4: Employee 201 Clearance Vault Grouping

**Files:**
- Modify: `frontend/src/pages/ta/EmployeeDetailPage.tsx`
- Test: `frontend/src/pages/ta/__tests__/EmployeeDetailPage.test.tsx`

**Interfaces:**
- Consumes: `employee.originatingApplication.complianceRequirements`
- Produces: Segmented Clearance Vault tab distinguishing approved clearances from active follow-up items.

- [ ] **Step 1: Write failing test in EmployeeDetailPage.test.tsx**

Verify that on the Clearance Vault tab (`compliance`), unapproved items appear under a dedicated section titled *"Pending follow-up items"* with their target dates, while approved items appear under *"Verified 201 documents"*.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test frontend/src/pages/ta/__tests__/EmployeeDetailPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Update `EmployeeDetailPage.tsx` clearance tab**

Partition `compliance` list:
- `verifiedItems = compliance.filter((r) => r.reviewStatus === "APPROVED")`
- `followUpItems = compliance.filter((r) => r.reviewStatus !== "APPROVED")`
Render two tidy sections with clean status badges and review shortcuts.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test frontend/src/pages/ta/__tests__/EmployeeDetailPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/pages/ta/EmployeeDetailPage.tsx frontend/src/pages/ta/__tests__/EmployeeDetailPage.test.tsx
git commit -m "feat(employee): partition employee 201 clearance vault into verified and follow-up items"
```

---

### Task 5: End-to-End Build and Test Suite Verification

**Files:**
- Verify: Full repository build and vitest suites

- [ ] **Step 1: Run TypeScript compiler on backend**
Run: `npm run build` in `backend`
Expected: 0 errors.

- [ ] **Step 2: Run backend test suite**
Run: `npm test` in `backend`
Expected: All tests pass.

- [ ] **Step 3: Run TypeScript compiler on frontend**
Run: `npm run build` in `frontend`
Expected: 0 errors.

- [ ] **Step 4: Run frontend test suite**
Run: `npm test` in `frontend`
Expected: All tests pass.

- [ ] **Step 5: Final review and commit**
```bash
git commit --allow-empty -m "chore(compliance): verify complete pre and post deployment compliance test suite"
```
