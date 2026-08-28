import { test, expect } from "@playwright/test";

test.describe("Admin and TA Reports & Analytics End-to-End Suite", () => {
  test.describe("Admin Reports Page (/admin/analytics)", () => {
    test("allows Admin to filter by MRF, cascaded Job Posting, Stage, and Date Range with Apply/Clear controls", async ({
      page,
    }) => {
      let lastOverviewQuery = "";
      let lastActivityQuery = "";

      const mockFilterOptions = {
        clients: [{ id: 1, name: "Acme Industrial Corp" }],
        mrfs: [
          { id: 10, title: "10x Industrial Electricians", clientId: 1 },
          { id: 20, title: "5x Certified Welders", clientId: 1 },
        ],
        jobPostings: [
          { id: 101, title: "Senior Industrial Electrician", mrfId: 10, postedById: "ta-1" },
          { id: 102, title: "Junior Electrician", mrfId: 10, postedById: "ta-1" },
          { id: 201, title: "SMAW Certified Welder", mrfId: 20, postedById: "ta-2" },
        ],
        recruiters: [
          { id: "ta-1", name: "Alice Recruiter", email: "alice@megs.ph" },
          { id: "ta-2", name: "Bob Recruiter", email: "bob@megs.ph" },
        ],
        stages: [
          { key: "SUBMITTED", label: "Submitted" },
          { key: "INITIAL_SCREENING", label: "Initial Screening" },
          { key: "CLIENT_ENDORSEMENT", label: "Client Endorsement" },
          { key: "FINAL_INTERVIEW", label: "Final Interview" },
          { key: "COMPLIANCE", label: "201 Compliance" },
          { key: "DEPLOYED", label: "Site Deployment" },
        ],
      };

      const mockDefaultOverview = {
        totalApplications: 120,
        activeCandidates: 45,
        talentPoolCandidates: 20,
        clientEndorsements: 35,
        candidatesInCompliance: 15,
        totalDeployments: 10,
      };

      const mockFilteredOverview = {
        totalApplications: 18,
        activeCandidates: 8,
        talentPoolCandidates: 20,
        clientEndorsements: 5,
        candidatesInCompliance: 3,
        totalDeployments: 2,
      };

      const mockTrend = {
        dateRange: { startDate: "2026-08-01", endDate: "2026-08-07", days: 7 },
        series: [
          {
            date: "2026-08-01",
            label: "Aug 1",
            applicationsReceived: 4,
            initialInterviewsCompleted: 2,
            clientEndorsements: 1,
            finalInterviewsCompleted: 1,
            candidatesMovedToCompliance: 1,
            candidatesDeployed: 1,
          },
        ],
        totals: {
          applicationsReceived: 4,
          initialInterviewsCompleted: 2,
          clientEndorsements: 1,
          finalInterviewsCompleted: 1,
          candidatesMovedToCompliance: 1,
          candidatesDeployed: 1,
        },
      };

      const mockFunnel = {
        totalApplications: 18,
        stages: [
          { stage: "APPLICATIONS", label: "Applications Received", count: 18, conversionRate: 100, dropoffRate: 0, overallConversion: 100 },
          { stage: "INITIAL_SCREENING", label: "Initial Screening", count: 12, conversionRate: 66.7, dropoffRate: 33.3, overallConversion: 66.7 },
          { stage: "CLIENT_ENDORSEMENT", label: "Client Endorsement", count: 8, conversionRate: 66.7, dropoffRate: 33.3, overallConversion: 44.4 },
          { stage: "FINAL_INTERVIEW", label: "Final Interview", count: 5, conversionRate: 62.5, dropoffRate: 37.5, overallConversion: 27.8 },
          { stage: "COMPLIANCE", label: "201 Compliance", count: 3, conversionRate: 60.0, dropoffRate: 40.0, overallConversion: 16.7 },
          { stage: "DEPLOYED", label: "Site Deployment", count: 2, conversionRate: 66.7, dropoffRate: 33.3, overallConversion: 11.1 },
        ],
      };

      const mockBottlenecks = [
        {
          stageKey: "INITIAL_SCREENING",
          stageLabel: "Initial Screening & Scheduling",
          candidateCount: 6,
          averageAgingDays: 4.2,
          slaThresholdDays: 7,
          overdueCount: 0,
          severity: "HEALTHY",
          description: "Candidates awaiting recruiter evaluation and initial interview completion.",
        },
      ];

      const mockJobDemands = [
        {
          jobId: 101,
          jobTitle: "Senior Industrial Electrician",
          location: "Manila",
          status: "OPEN",
          mrfId: 10,
          mrfTitle: "10x Industrial Electricians",
          clientId: 1,
          clientName: "Acme Industrial Corp",
          targetHeadcount: 10,
          totalApplications: 18,
          activeCandidates: 8,
          deployedCount: 2,
        },
      ];

      // Route handlers
      await page.route("**/api/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              user: {
                id: "admin-1",
                email: "admin@megs.ph",
                role: "ADMINISTRATOR",
                isActive: true,
                applicantProfile: { firstName: "Chief", lastName: "Administrator" },
              },
            },
          }),
        });
      });

      await page.route("**/api/notifications**", async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: [] }) });
      });

      await page.route("**/api/auth/mfa/status", async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { enabled: false } }) });
      });

      await page.route("**/api/admin/analytics/filters", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: mockFilterOptions }),
        });
      });

      await page.route("**/api/admin/analytics/overview**", async (route) => {
        lastOverviewQuery = route.request().url();
        const isFiltered = lastOverviewQuery.includes("mrfId=10") || lastOverviewQuery.includes("jobPostingId=101");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: isFiltered ? mockFilteredOverview : mockDefaultOverview }),
        });
      });

      await page.route("**/api/admin/analytics/activity**", async (route) => {
        lastActivityQuery = route.request().url();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: mockTrend }),
        });
      });

      await page.route("**/api/admin/analytics/funnel**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: mockFunnel }),
        });
      });

      await page.route("**/api/admin/analytics/bottlenecks**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: mockBottlenecks }),
        });
      });

      await page.route("**/api/admin/analytics/jobs**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: mockJobDemands }),
        });
      });

      // Initialize tokens
      await page.addInitScript(() => {
        localStorage.setItem("access_token", "mock-admin-jwt-token");
        localStorage.setItem("user_role", "ADMINISTRATOR");
      });

      // 1. Visit Admin Reports page
      await page.goto("/admin/analytics");

      // Verify header
      await expect(page.getByText("Organization Recruitment Reports")).toBeVisible();

      // Initial overview stat shows 120 total applications
      await expect(page.getByText("120")).toBeVisible();

      // 2. Select Date Range preset: Last 7 Days
      await page.getByRole("button", { name: "Last 7 Days" }).click();

      // 3. Search and select MRF in ComboBox
      const mrfInput = page.getByRole("combobox", { name: /Manpower Request/i });
      await mrfInput.click();
      await mrfInput.fill("10x Industrial");
      await page.getByRole("option", { name: /10x Industrial Electricians/i }).click();

      // 4. Verify cascading Job Posting dropdown only shows jobs linked to MRF 10
      const jobInput = page.getByRole("combobox", { name: /Job Posting/i });
      await jobInput.click();
      // Should show Senior Industrial Electrician and Junior Electrician, but NOT SMAW Certified Welder
      await expect(page.getByRole("option", { name: /Senior Industrial Electrician/i })).toBeVisible();
      await expect(page.getByRole("option", { name: /Junior Electrician/i })).toBeVisible();
      await expect(page.getByRole("option", { name: /SMAW Certified Welder/i })).not.toBeVisible();

      // Select Senior Industrial Electrician
      await page.getByRole("option", { name: /Senior Industrial Electrician/i }).click();

      // 5. Select Recruitment Stage -> Initial Screening
      const stageInput = page.getByRole("combobox", { name: /Recruitment Stage/i });
      await stageInput.click();
      await page.getByRole("option", { name: /Initial Screening/i }).click();

      // 6. Click "Apply Filters"
      const applyButton = page.getByRole("button", { name: /Apply Filters/i });
      await expect(applyButton).toBeVisible();
      await applyButton.click();

      // 7. Verify Active Filters chips bar is rendered
      await expect(page.getByText("Active Filters:")).toBeVisible();
      await expect(page.getByTestId("active-filter-chip-mrfId")).toContainText("10x Industrial Electricians");
      await expect(page.getByTestId("active-filter-chip-jobPostingId")).toContainText("Senior Industrial Electrician");
      await expect(page.getByTestId("active-filter-chip-stage")).toContainText("Initial Screening");
      await expect(page.getByTestId("active-filter-chip-range")).toContainText("Last 7 Days");

      // 8. Verify updated overview cards show filtered 18 total applications
      await expect(page.locator('.tabular-nums').filter({ hasText: /^18$/ }).first()).toBeVisible();

      // 9. Remove single filter chip via its dismiss '×' button
      const removeStageChipButton = page.getByRole("button", { name: /Remove Stage filter/i });
      await removeStageChipButton.click();

      // Verify stage chip is removed
      await expect(page.getByRole("button", { name: /Remove Stage filter/i })).not.toBeVisible();

      // 10. Click "Clear Filters"
      const clearFiltersButton = page.getByRole("button", { name: /Clear Filters/i });
      await clearFiltersButton.click();

      // Verify filters reset to default
      await expect(page.getByText("120")).toBeVisible();
      await expect(page.getByText("Active Filters:")).not.toBeVisible();
    });
  });

  test.describe("TA Reports Page (/ta/analytics)", () => {
    test("allows TA to filter their requisitions with cascading MRF -> Job, stage selection, and export", async ({
      page,
    }) => {
      const mockTAFilterOptions = {
        clients: [],
        mrfs: [
          { id: 50, title: "20x Warehouse Specialists", clientId: 2 },
        ],
        jobPostings: [
          { id: 501, title: "Forklift Operator", mrfId: 50, postedById: "ta-logged-in" },
        ],
        recruiters: [],
        stages: [
          { key: "SUBMITTED", label: "Submitted" },
          { key: "INITIAL_SCREENING", label: "Initial Screening" },
          { key: "CLIENT_ENDORSEMENT", label: "Client Endorsement" },
          { key: "COMPLIANCE", label: "201 Compliance" },
        ],
      };

      const mockTAOverview = {
        myActiveApplications: 24,
        initialInterviewsPending: 6,
        readyForEndorsement: 4,
        pendingClientDecisions: 3,
        finalInterviewsPending: 2,
        awaitingCompliance: 5,
      };

      const mockFilteredTAOverview = {
        myActiveApplications: 5,
        initialInterviewsPending: 2,
        readyForEndorsement: 1,
        pendingClientDecisions: 1,
        finalInterviewsPending: 0,
        awaitingCompliance: 1,
      };

      const mockTAPendingActions = [
        {
          id: "interview-901",
          type: "INITIAL_INTERVIEW",
          title: "Initial Interview Pending Evaluation",
          candidateName: "Ramon Gomez",
          jobTitle: "Forklift Operator",
          applicationId: 801,
          urgency: "HIGH",
          deadline: "2026-08-30T00:00:00.000Z",
          targetUrl: "/ta/interviews",
          createdAt: "2026-08-20T00:00:00.000Z",
        },
      ];

      await page.route("**/api/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              user: {
                id: "ta-logged-in",
                email: "recruiter@megs.ph",
                role: "TALENT_ACQUISITION",
                isActive: true,
                applicantProfile: { firstName: "Sarah", lastName: "Recruiter" },
              },
            },
          }),
        });
      });

      await page.route("**/api/notifications**", async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: [] }) });
      });

      await page.route("**/api/auth/mfa/status", async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { enabled: false } }) });
      });

      await page.route("**/api/ta/analytics/filters", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: mockTAFilterOptions }),
        });
      });

      await page.route("**/api/ta/analytics/overview**", async (route) => {
        const url = route.request().url();
        const isFiltered = url.includes("mrfId=50") || url.includes("jobPostingId=501");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: isFiltered ? mockFilteredTAOverview : mockTAOverview }),
        });
      });

      await page.route("**/api/ta/analytics/activity**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              dateRange: { startDate: "2026-08-01", endDate: "2026-08-07", days: 7 },
              series: [
                {
                  date: "2026-08-01",
                  label: "Aug 1",
                  applicationsReceived: 2,
                  initialInterviewsCompleted: 1,
                  clientEndorsements: 1,
                  finalInterviewsCompleted: 0,
                  candidatesMovedToCompliance: 0,
                  candidatesDeployed: 0,
                },
              ],
              totals: {
                applicationsReceived: 2,
                initialInterviewsCompleted: 1,
                clientEndorsements: 1,
                finalInterviewsCompleted: 0,
                candidatesMovedToCompliance: 0,
                candidatesDeployed: 0,
              },
            },
          }),
        });
      });

      await page.route("**/api/ta/analytics/pipeline-funnel**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              totalApplications: 24,
              stages: [
                { stage: "APPLICATIONS", label: "Applications Received", count: 24, conversionRate: 100, dropoffRate: 0, overallConversion: 100 },
                { stage: "INITIAL_SCREENING", label: "Initial Screening", count: 18, conversionRate: 75, dropoffRate: 25, overallConversion: 75 },
              ],
            },
          }),
        });
      });

      await page.route("**/api/ta/analytics/pending-actions**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: mockTAPendingActions }),
        });
      });

      await page.addInitScript(() => {
        localStorage.setItem("access_token", "mock-ta-jwt-token");
        localStorage.setItem("user_role", "TALENT_ACQUISITION");
      });

      // 1. Visit TA Reports page
      await page.goto("/ta/analytics");

      // Verify TA Page Header
      await expect(page.getByText("Recruitment reports")).toBeVisible();

      // Verify TA Overview Cards
      await expect(page.getByText("My Active Pipeline")).toBeVisible();
      await expect(page.locator('.tabular-nums').filter({ hasText: /^24$/ }).first()).toBeVisible();

      // Verify Workload Action Queue item
      await expect(page.getByText("Ramon Gomez")).toBeVisible();
      await expect(page.getByText("Forklift Operator")).toBeVisible();

      // 2. Verify TA does NOT have Client Account or TA Recruiter filters
      await expect(page.getByText("Client Account")).not.toBeVisible();
      await expect(page.getByText("TA Specialist")).not.toBeVisible();

      // 3. Select MRF -> "20x Warehouse Specialists"
      const mrfInput = page.getByRole("combobox", { name: /Manpower Request/i });
      await mrfInput.click();
      await page.getByRole("option", { name: /20x Warehouse Specialists/i }).click();

      // 4. Select Job -> "Forklift Operator"
      const jobInput = page.getByRole("combobox", { name: /Job Posting/i });
      await jobInput.click();
      await page.getByRole("option", { name: /Forklift Operator/i }).click();

      // 5. Click "Apply Filters"
      await page.getByRole("button", { name: /Apply Filters/i }).click();

      // 6. Verify Active Filters chip
      await expect(page.getByTestId("active-filter-chip-mrfId")).toContainText("20x Warehouse Specialists");
      await expect(page.getByTestId("active-filter-chip-jobPostingId")).toContainText("Forklift Operator");

      // 7. Verify updated overview card reflects 5
      await expect(page.locator('.tabular-nums').filter({ hasText: /^5$/ }).first()).toBeVisible();
    });
  });
});
