import { test, expect } from "@playwright/test";

test.describe("Admin Score Reassessment Queue & End-to-End Workflow", () => {
  let revalidationFetchCount = 0;

  const mockRevalidationData = {
    counts: {
      PENDING: 3,
      PROCESSING: 1,
      COMPLETED: 142,
      FAILED: 2,
    },
    failures: [
      {
        id: "task-f01a",
        target: "Application #101 (Maria Santos - Senior React Developer)",
        attempts: 3,
        lastError: "Vector embedding dimension mismatch (expected 384, received 0)",
      },
      {
        id: "task-f02b",
        target: "Applicant Profile #502 (John Doe)",
        attempts: 2,
        lastError: "Connection timeout while parsing resume asset",
      },
    ],
  };

  const setupAuthAndMocks = async (page: any) => {
    revalidationFetchCount = 0;

    await page.addInitScript(() => {
      localStorage.setItem("access_token", "mock-admin-jwt-token");
      localStorage.setItem("user_role", "ADMINISTRATOR");
    });

    await page.route("**/api/me", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: "admin-uuid-001",
              email: "admin@megs-recruitment.com",
              role: "ADMINISTRATOR",
              accountStatus: "ACTIVE",
              isActive: true,
              applicantProfile: { firstName: "Chief", lastName: "Admin" },
            },
          },
        }),
      });
    });

    await page.route("**/api/auth/mfa/status", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { mfaEnabled: false },
        }),
      });
    });

    await page.route("**/api/notifications", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            data: [],
            unreadCount: 0,
            total: 0,
            page: 1,
            limit: 10,
            totalPages: 1,
          },
        }),
      });
    });

    await page.route("**/api/admin/candidate-scoring/revalidation-status", async (route: any) => {
      revalidationFetchCount++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: mockRevalidationData,
        }),
      });
    });
  };

  test("renders queue telemetry counters and failure exceptions table accurately", async ({ page }) => {
    await setupAuthAndMocks(page);

    await page.goto("/admin/revalidation");

    // Header and description
    await expect(page.locator("h1")).toContainText("Score update queue");
    await expect(
      page.getByText("Track candidate score recalculations when scoring weights or candidate profiles are updated")
    ).toBeVisible();

    // Metric counters
    await expect(page.getByText("Pending in Queue")).toBeVisible();
    await expect(page.locator("div").filter({ hasText: /^3$/ })).toBeVisible();
    await expect(page.getByText("Waiting in queue")).toBeVisible();

    await expect(page.getByText("Processing Now")).toBeVisible();
    await expect(page.locator("div").filter({ hasText: /^1$/ })).toBeVisible();
    await expect(page.getByText("Currently reassessing")).toBeVisible();

    await expect(page.getByText("Completed Reassessments")).toBeVisible();
    await expect(page.getByText("142")).toBeVisible();
    await expect(page.getByText("Up-to-date candidate match scores")).toBeVisible();

    await expect(page.getByText("Failed Updates")).toBeVisible();
    await expect(page.locator("div").filter({ hasText: /^2$/ })).toBeVisible();
    await expect(page.getByText("Unable to complete update")).toBeVisible();

    // Reassessment Errors & Exceptions Table
    await expect(page.getByText("Reassessment Errors & Exceptions")).toBeVisible();
    await expect(page.getByText("task-f01a")).toBeVisible();
    await expect(page.getByText("Application #101 (Maria Santos - Senior React Developer)")).toBeVisible();
    await expect(page.getByText("Vector embedding dimension mismatch (expected 384, received 0)")).toBeVisible();

    await expect(page.getByText("task-f02b")).toBeVisible();
    await expect(page.getByText("Applicant Profile #502 (John Doe)")).toBeVisible();
    await expect(page.getByText("Connection timeout while parsing resume asset")).toBeVisible();
  });

  test("Refresh Status button retrieves fresh telemetry without browser reload", async ({ page }) => {
    await setupAuthAndMocks(page);

    await page.goto("/admin/revalidation");
    await expect(page.locator("h1")).toContainText("Score update queue");

    const initialFetchCount = revalidationFetchCount;
    expect(initialFetchCount).toBeGreaterThanOrEqual(1);

    // Click 'Refresh Status' button
    const refreshBtn = page.getByRole("button", { name: /Refresh Status/i });
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();

    // Verify background query refetched without full page reload
    await expect(page.locator("h1")).toContainText("Score update queue");
    expect(revalidationFetchCount).toBeGreaterThan(initialFetchCount);
  });

  test("renders empty state when there are zero failed jobs", async ({ page }) => {
    await setupAuthAndMocks(page);

    // Override route with 0 failures
    await page.route("**/api/admin/candidate-scoring/revalidation-status", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            counts: {
              PENDING: 0,
              PROCESSING: 0,
              COMPLETED: 150,
              FAILED: 0,
            },
            failures: [],
          },
        }),
      });
    });

    await page.goto("/admin/revalidation");

    await expect(page.getByText("All assessment tasks up to date")).toBeVisible();
    await expect(
      page.getByText("No processing errors or failed score updates detected in the queue.")
    ).toBeVisible();
  });
});
