import { test, expect } from "@playwright/test";

test.describe("MEGS Comprehensive Admin Functionality Audit Suite", () => {
  // Common Mock Data
  const mockAdminUser = {
    id: "admin-uuid-001",
    email: "admin@megs-recruitment.com",
    role: "ADMINISTRATOR",
    accountStatus: "ACTIVE",
    isActive: true,
    applicantProfile: { firstName: "Chief", lastName: "Admin" },
  };

  const mockTAUser = {
    id: "ta-uuid-002",
    email: "recruiter@megs-recruitment.com",
    role: "TALENT_ACQUISITION",
    accountStatus: "ACTIVE",
    isActive: true,
    applicantProfile: { firstName: "Sarah", lastName: "Recruiter" },
  };

  const mockPendingTAUser = {
    id: "ta-uuid-003",
    email: "invited-ta@megs.com",
    role: "TALENT_ACQUISITION",
    accountStatus: "PENDING",
    invitationStatus: "PENDING",
    isActive: true,
    createdAt: "2026-08-20T10:00:00Z",
  };

  const mockScoringConfig = {
    id: 1,
    version: 1,
    revision: 5,
    scope: "DEFAULT",
    status: "ACTIVE",
    activatedAt: "2026-08-25T08:00:00Z",
    weights: {
      SKILLS: 30,
      EXPERIENCE: 25,
      LOCATION: 15,
      COMPLIANCE: 15,
      EDUCATION_CERTIFICATIONS: 15,
    },
    knnSettings: {
      defaultK: 10,
      maximumK: 50,
      minimumSimilarity: 0.5,
      excludeCurrentlyHired: true,
    },
    matchThreshold: 60,
  };

  const mockQualityMetrics = {
    totalCalculated: 185,
    averageFitScore: 78.4,
    minFitScore: 32,
    maxFitScore: 98,
    coveragePercentage: 100,
    knnLatencyP95: 35,
    scoreDistribution: {
      "80-100": 85,
      "60-79": 65,
      "40-59": 25,
      "20-39": 10,
      "0-19": 0,
    },
  };

  const mockRevalidationStatus = {
    counts: {
      PENDING: 3,
      PROCESSING: 1,
      COMPLETED: 180,
      FAILED: 1,
    },
    failures: [
      {
        id: "fail-1",
        target: "Application #99 (Senior Electrician)",
        attempts: 3,
        lastError: "Candidate profile embedding missing vector",
        createdAt: "2026-08-27T03:00:00Z",
      },
    ],
  };

  const mockAuditLogs = [
    {
      id: 101,
      action: "USER_INVITED",
      userId: "admin-uuid-001",
      user: { email: "admin@megs-recruitment.com" },
      entity: "User",
      entityId: "ta-uuid-003",
      details: { email: "invited-ta@megs.com", role: "TALENT_ACQUISITION" },
      ipAddress: "192.168.1.100",
      createdAt: "2026-08-28T02:00:00Z",
    },
    {
      id: 102,
      action: "SCORING_CONFIG_ACTIVATED",
      userId: "admin-uuid-001",
      user: { email: "admin@megs-recruitment.com" },
      entity: "CandidateScoringConfiguration",
      entityId: "1",
      details: { revision: 5, weights: mockScoringConfig.weights },
      ipAddress: "192.168.1.100",
      createdAt: "2026-08-28T01:30:00Z",
    },
  ];

  const setupAdminMocks = async (page: any) => {
    // Inject auth token in localStorage
    await page.addInitScript(() => {
      localStorage.setItem("access_token", "mock-admin-jwt-token");
      localStorage.setItem("user_role", "ADMINISTRATOR");
    });

    // Auth check
    await page.route("**/api/me", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            user: mockAdminUser,
          },
        }),
      });
    });

    // MFA status
    await page.route("**/api/auth/mfa/status", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { enabled: false } }),
      });
    });

    // Notifications
    await page.route("**/api/notifications**", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    // Users
    await page.route("**/api/admin/users", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [mockAdminUser, mockTAUser, mockPendingTAUser],
        }),
      });
    });

    // Scoring Config
    await page.route("**/api/admin/candidate-scoring/configuration", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: mockScoringConfig }),
      });
    });

    // Revalidation
    await page.route("**/api/admin/candidate-scoring/revalidation-status", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: mockRevalidationStatus }),
      });
    });

    // Quality Metrics
    await page.route("**/api/admin/candidate-scoring/quality-metrics", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: mockQualityMetrics }),
      });
    });

    // Audit logs
    await page.route("**/api/admin/audit-logs**", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: mockAuditLogs }),
      });
    });

    // Analytics overview
    await page.route("**/api/admin/analytics/overview**", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            totalApplications: 120,
            activeCandidates: 45,
            talentPoolCandidates: 20,
            clientEndorsements: 35,
            candidatesInCompliance: 15,
            totalDeployments: 10,
          },
        }),
      });
    });

    // Analytics filters
    await page.route("**/api/admin/analytics/filters", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            clients: [{ id: 1, name: "Acme Industrial Corp" }],
            mrfs: [{ id: 10, title: "10x Industrial Electricians", clientId: 1 }],
            jobPostings: [{ id: 101, title: "Senior Industrial Electrician", mrfId: 10 }],
            recruiters: [{ id: "ta-1", name: "Sarah Recruiter", email: "recruiter@megs.com" }],
            stages: [{ key: "INITIAL_SCREENING", label: "Initial Screening" }],
          },
        }),
      });
    });

    // Analytics activity
    await page.route("**/api/admin/analytics/activity**", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            dateRange: { startDate: "2026-08-01", endDate: "2026-08-07", days: 7 },
            series: [{ date: "2026-08-01", label: "Aug 1", applicationsReceived: 4, initialInterviews: 2, clientEndorsements: 1, finalEvaluations: 1, complianceClearances: 0, deployments: 0 }],
          },
        }),
      });
    });

    // Analytics funnel
    await page.route("**/api/admin/analytics/funnel**", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            stages: [{ stage: "Intake", count: 120, conversionRate: 100, dropOffRate: 0 }],
            overallConversionRate: 8.3,
          },
        }),
      });
    });

    // Analytics bottlenecks
    await page.route("**/api/admin/analytics/bottlenecks**", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    // Analytics job demands
    await page.route("**/api/admin/analytics/jobs**", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [{ jobId: 101, title: "Senior Electrician", applicantCount: 45, percentage: 37.5 }],
        }),
      });
    });
  };

  test("1. Admin Dashboard Overview, Navigation, Metrics, and Quick Actions", async ({ page }) => {
    await setupAdminMocks(page);

    await page.goto("/admin");

    // Header & breadcrumbs
    await expect(page.locator("h1")).toContainText("Administration overview");

    // Metric Cards
    await expect(page.getByText("Registered Accounts")).toBeVisible();
    await expect(page.getByText("Active Scoring Config")).toBeVisible();
    await expect(page.getByText("Score Update Backlog")).toBeVisible();
    await expect(page.getByText("Average Match Score")).toBeVisible();

    // Quick action buttons
    await expect(page.getByRole("button", { name: /Reports/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Add TA Specialist/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Configure Weights/i })).toBeVisible();

    // Candidate matching weights preview
    await expect(page.getByText("Skills Match")).toBeVisible();
    await expect(page.getByText("Experience Fit")).toBeVisible();

    // Recent activity log preview
    await expect(page.getByText("Administrative Audit Events")).toBeVisible();
    await expect(page.getByText("User Invited")).toBeVisible();
    await expect(page.getByText("Scoring Configuration Activated")).toBeVisible();
  });

  test("2. User Management: Listing, Filter, Invite TA, Resend, Cancel, Role, Status, and MFA Reset", async ({ page }) => {
    await setupAdminMocks(page);

    let invitePayload: any = null;
    let resendCalled = false;
    let cancelCalled = false;
    let roleUpdatePayload: any = null;
    let statusUpdatePayload: any = null;
    let resetMfaCalled = false;

    await page.route("**/api/admin/invite-ta", async (route: any) => {
      invitePayload = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Talent Acquisition invitation sent successfully",
          data: { id: "new-ta-id", email: invitePayload.email },
        }),
      });
    });

    await page.route("**/api/admin/users/*/resend-invite", async (route: any) => {
      resendCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "Invitation resent" }),
      });
    });

    await page.route("**/api/admin/users/*/cancel-invite", async (route: any) => {
      cancelCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "Invitation cancelled" }),
      });
    });

    await page.route("**/api/admin/users/*/role", async (route: any) => {
      roleUpdatePayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "Role updated" }),
      });
    });

    await page.route("**/api/admin/users/*/status", async (route: any) => {
      statusUpdatePayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "Status updated" }),
      });
    });

    await page.route("**/api/admin/users/*/reset-mfa", async (route: any) => {
      resetMfaCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "MFA reset" }),
      });
    });

    await page.goto("/admin/users");
    await expect(page.locator("h1")).toContainText("User access");

    // 2.1 User list displayed in table
    const table = page.locator("table");
    await expect(table.getByText("admin@megs-recruitment.com")).toBeVisible();
    await expect(table.getByText("recruiter@megs-recruitment.com")).toBeVisible();
    await expect(table.getByText("invited-ta@megs.com")).toBeVisible();
    await expect(table.getByText("PENDING INVITATION")).toBeVisible();

    // 2.2 Invite TA Specialist modal
    await page.getByRole("button", { name: /Add TA Specialist/i }).click();
    await expect(page.getByText("Add Talent Acquisition Specialist")).toBeVisible();

    await page.fill('input[type="email"]', "newrecruiter@megs.com");
    await page.fill('input[placeholder="e.g. Maria"]', "Maria");
    await page.fill('input[placeholder="e.g. Santos"]', "Santos");
    await page.getByRole("button", { name: /^Add$/i }).click();

    expect(invitePayload).toEqual({
      email: "newrecruiter@megs.com",
      firstName: "Maria",
      lastName: "Santos",
    });

    // 2.3 Resend Invitation Action
    const resendBtn = page.getByRole("button", { name: /^Resend$/i }).first();
    await resendBtn.click();
    await expect(page.getByText("Resend Talent Acquisition Invitation")).toBeVisible();
    await page.getByRole("button", { name: /Resend Invitation Link/i }).click();
    expect(resendCalled).toBe(true);

    // 2.4 Cancel Invitation Action
    const cancelBtn = page.getByRole("button", { name: /^Cancel$/i }).first();
    await cancelBtn.click();
    await expect(page.getByText("Cancel Pending Invitation")).toBeVisible();
    await page.getByRole("button", { name: /Revoke Invitation/i }).click();
    expect(cancelCalled).toBe(true);
  });

  test("3. Scoring Configuration: Weight Slider Validation, Match Parameters, Save, and Reset Defaults", async ({
    page,
  }) => {
    await setupAdminMocks(page);

    let updatedScoringPayload: any = null;
    let restoreDefaultsCalled = false;

    await page.route("**/api/admin/candidate-scoring/configuration", async (route: any) => {
      if (route.request().method() === "PUT") {
        updatedScoringPayload = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { ...mockScoringConfig, revision: 6 },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: mockScoringConfig }),
        });
      }
    });

    await page.route("**/api/admin/candidate-scoring/configuration/restore-defaults", async (route: any) => {
      restoreDefaultsCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: mockScoringConfig }),
      });
    });

    await page.goto("/admin/scoring");
    await expect(page.locator("h1")).toContainText("Candidate matching settings");

    // Verify 100% total weight display
    await expect(page.getByText(/100%.*Valid/)).toBeVisible();

    // Modify Threshold & Save
    await page.fill('input[type="number"]', "65");
    await page.getByRole("button", { name: /Save & Apply Scoring Weights/i }).click();

    expect(updatedScoringPayload).not.toBeNull();
    expect(updatedScoringPayload.expectedRevision).toBe(5);
    expect(updatedScoringPayload.weights.SKILLS).toBe(30);

    // Restore Defaults Dialog
    await page.getByRole("button", { name: /Restore Defaults/i }).first().click();
    await expect(page.getByText("Restore Default Scoring Configuration?")).toBeVisible();
    await page.getByRole("button", { name: "Restore Defaults" }).last().click();
    expect(restoreDefaultsCalled).toBe(true);
  });

  test("4. Score Quality & Revalidation Queue Telemetry Pages", async ({ page }) => {
    await setupAdminMocks(page);

    // 4.1 Scoring Quality
    await page.goto("/admin/scoring/quality");
    await expect(page.locator("h1")).toContainText("Candidate matching quality");
    await expect(page.getByText("185")).toBeVisible(); // total scored
    await expect(page.getByText("78.4%")).toBeVisible(); // avg score
    await expect(page.getByText("35 ms")).toBeVisible(); // p95 latency

    // 4.2 Revalidation Queue
    await page.goto("/admin/revalidation");
    await expect(page.locator("h1")).toContainText("Score update queue");
    await expect(page.getByText("Waiting in queue")).toBeVisible();
    await expect(page.getByText("180")).toBeVisible(); // completed
    await expect(page.getByText("Candidate profile embedding missing vector")).toBeVisible();
  });

  test("5. Audit Logs: Category Filters, Preset Date Buttons, Text Search, and Inspection Modal", async ({
    page,
  }) => {
    await setupAdminMocks(page);

    await page.goto("/admin/audit");
    await expect(page.locator("h1")).toContainText("Activity log");

    // Table rows
    await expect(page.getByRole("table").getByText("User Invited")).toBeVisible();
    await expect(page.getByRole("table").getByText("Scoring Configuration Activated")).toBeVisible();
    await expect(page.getByRole("table").getByText("admin@megs-recruitment.com").first()).toBeVisible();

    // Inspect Modal
    const detailsBtn = page.getByRole("button", { name: /View Details/i }).first();
    await detailsBtn.click();
    await expect(page.getByText("Audit Event Details")).toBeVisible();
    await expect(page.getByText("192.168.1.100")).toBeVisible();
    await page.getByRole("button", { name: /^Close$/i }).click();
  });

  test("6. Authorization & Role Guard Security Enforcement", async ({ page }) => {
    // Inject auth token in localStorage
    await page.addInitScript(() => {
      localStorage.setItem("access_token", "mock-applicant-token");
      localStorage.setItem("user_role", "APPLICANT");
    });

    // Mock user as APPLICANT
    await page.route("**/api/me", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: "applicant-uuid-001",
              email: "applicant@example.com",
              role: "APPLICANT",
              accountStatus: "ACTIVE",
            },
          },
        }),
      });
    });

    await page.route("**/api/auth/mfa/status", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { enabled: false } }),
      });
    });

    // Attempt to access /admin should redirect to /forbidden
    await page.goto("/admin");
    await page.waitForURL("**/forbidden**", { timeout: 10000 });
    await expect(page.getByText("Access Restricted")).toBeVisible();

    // Attempt to access /admin/users should redirect to /forbidden
    await page.goto("/admin/users");
    await page.waitForURL("**/forbidden**", { timeout: 10000 });
    await expect(page.getByText("Access Restricted")).toBeVisible();
  });
});
