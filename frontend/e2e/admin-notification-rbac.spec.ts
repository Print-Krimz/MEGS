import { test, expect } from "@playwright/test";

test.describe("Admin Notifications RBAC & Cross-Role Routing Protection Suite", () => {
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

  const mockApplicantUser = {
    id: "applicant-uuid-003",
    email: "applicant@example.com",
    role: "APPLICANT",
    accountStatus: "ACTIVE",
    isActive: true,
    applicantProfile: { firstName: "Juan", lastName: "Dela Cruz" },
  };

  const mockMRFRecord = {
    id: 1,
    title: "Senior Full Stack Developer",
    headcount: 2,
    location: "Makati City",
    status: "OPEN",
    priority: "HIGH",
    targetFillDate: "2026-09-30T00:00:00Z",
    createdAt: "2026-08-28T06:00:00Z",
    description: "Full stack developer for recruitment modules.",
    requiredSkills: "React 19, TypeScript, PostgreSQL",
    requiredExperience: "4+ years",
    client: {
      id: 1,
      name: "Acme Corporation",
      industry: "Information Technology",
      contactEmail: "contact@acme.corp",
    },
    jobPostings: [
      {
        id: 101,
        title: "Senior Full Stack Developer - Requisition",
        location: "Makati City",
        status: "PUBLISHED",
      },
    ],
    complianceTemplates: [
      { id: 1, documentLabel: "NBI Clearance", isRequired: true },
    ],
  };

  const mockNotifications = [
    {
      id: 1,
      userId: "admin-uuid-001",
      title: "New Manpower Request (MRF)",
      message: 'MRF "Senior Full Stack Developer" created for Acme Corporation. Headcount: 2.',
      type: "INFO",
      link: "/admin/mrfs/1",
      isRead: false,
      createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    },
    {
      id: 2,
      userId: "admin-uuid-001",
      title: "New Manpower Request (MRF)",
      message: 'MRF "Senior Logistics Dispatcher" created for Apex Retail Distribution. Headcount: 1.',
      type: "INFO",
      link: "/admin/mrfs/2",
      isRead: false,
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
  ];

  const setupAuthMocks = async (page: any, user: typeof mockAdminUser) => {
    await page.addInitScript((role: string) => {
      localStorage.setItem("access_token", `mock-${role.toLowerCase()}-jwt-token`);
      localStorage.setItem("user_role", role);
    }, user.role);

    await page.route("**/api/me", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { user } }),
      });
    });

    await page.route("**/api/auth/mfa/status", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { enabled: false } }),
      });
    });

    await page.route("**/api/notifications**", async (route: any) => {
      if (route.request().url().includes("/unread-count")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: { count: 2 } }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: mockNotifications }),
        });
      }
    });

    await page.route("**/api/notifications/*/read", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { isRead: true } }),
      });
    });

    // Admin MRF details route
    await page.route("**/api/admin/mrfs/1", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: mockMRFRecord }),
      });
    });
  };

  test("1. Admin clicks 'Open' on MRF notification and stays within authorized Admin functionality", async ({ page }) => {
    await setupAuthMocks(page, mockAdminUser);

    // 1. Go to Admin Notifications page
    await page.goto("/admin/notifications");

    // Verify page header
    await expect(page.locator("h1")).toContainText("Notifications");
    await expect(page.getByText("Stay informed about access, score reviews, and important updates.")).toBeVisible();

    // Verify MRF notification card is visible with 'View Record' and 'Open' action
    const mrfNotification = page.getByText('MRF "Senior Full Stack Developer" created for Acme Corporation. Headcount: 2.');
    await expect(mrfNotification).toBeVisible();
    await expect(page.getByText("View Record").first()).toBeVisible();

    // 2. Click 'Open' on the notification
    const openBtn = page.getByRole("button", { name: /^Open$/i }).first();
    await openBtn.click();

    // 3. Verify Admin stays within /admin/mrfs/1 (NOT /ta/mrfs/1)
    await page.waitForURL("**/admin/mrfs/1", { timeout: 10000 });
    expect(page.url()).toContain("/admin/mrfs/1");
    expect(page.url()).not.toContain("/ta/");

    // 4. Verify Admin layout elements are present
    await expect(page.getByText("Administration", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Senior Full Stack Developer", { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/Read-Only Oversight/i)).toBeVisible();
    await expect(page.getByText("Acme Corporation", { exact: true })).toBeVisible();
    await expect(page.getByText("Required Headcount")).toBeVisible();

    // 5. Verify TA-specific mutation buttons (Link Requisition, Add Template, Update Status) are NOT present on Admin page
    await expect(page.getByRole("button", { name: /Link Requisition/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /Update Status/i })).not.toBeVisible();

    // 6. Verify back navigation returns to Admin notifications
    await page.getByRole("button", { name: /Back to Notifications/i }).click();
    await page.waitForURL("**/admin/notifications", { timeout: 10000 });
    expect(page.url()).toContain("/admin/notifications");
  });

  test("2. Admin attempting direct URL manipulation to TA-only routes is blocked and redirected to /forbidden", async ({ page }) => {
    await setupAuthMocks(page, mockAdminUser);

    // Try navigating to TA MRF detail
    await page.goto("/ta/mrfs/1");
    await page.waitForURL("**/forbidden**", { timeout: 10000 });
    await expect(page.getByText("Access Restricted")).toBeVisible();

    // Try navigating to TA dashboard
    await page.goto("/ta");
    await page.waitForURL("**/forbidden**", { timeout: 10000 });
    await expect(page.getByText("Access Restricted")).toBeVisible();

    // Try navigating to TA applications
    await page.goto("/ta/applications");
    await page.waitForURL("**/forbidden**", { timeout: 10000 });
    await expect(page.getByText("Access Restricted")).toBeVisible();
  });

  test("3. TA user attempting direct URL manipulation to Admin routes is blocked and redirected to /forbidden", async ({ page }) => {
    await setupAuthMocks(page, mockTAUser);

    // Try navigating to Admin MRF detail
    await page.goto("/admin/mrfs/1");
    await page.waitForURL("**/forbidden**", { timeout: 10000 });
    await expect(page.getByText("Access Restricted")).toBeVisible();

    // Try navigating to Admin Users
    await page.goto("/admin/users");
    await page.waitForURL("**/forbidden**", { timeout: 10000 });
    await expect(page.getByText("Access Restricted")).toBeVisible();

    // Try navigating to Admin scoring
    await page.goto("/admin/scoring");
    await page.waitForURL("**/forbidden**", { timeout: 10000 });
    await expect(page.getByText("Access Restricted")).toBeVisible();
  });

  test("4. Applicant user attempting direct URL manipulation to internal staff routes is blocked and redirected to /forbidden", async ({ page }) => {
    await setupAuthMocks(page, mockApplicantUser);

    // Try navigating to Admin routes
    await page.goto("/admin");
    await page.waitForURL("**/forbidden**", { timeout: 10000 });
    await expect(page.getByText("Access Restricted")).toBeVisible();

    // Try navigating to TA routes
    await page.goto("/ta");
    await page.waitForURL("**/forbidden**", { timeout: 10000 });
    await expect(page.getByText("Access Restricted")).toBeVisible();

    // Try navigating to TA MRF detail
    await page.goto("/ta/mrfs/1");
    await page.waitForURL("**/forbidden**", { timeout: 10000 });
    await expect(page.getByText("Access Restricted")).toBeVisible();
  });
});
