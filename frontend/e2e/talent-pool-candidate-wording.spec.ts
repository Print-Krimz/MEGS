import { test, expect } from "@playwright/test";

test.describe("Talent Pool Internal vs Candidate-Friendly Wording E2E", () => {
  const mockCandidateUser = {
    id: "cand-uuid-101",
    email: "applicant@example.com",
    role: "APPLICANT",
    accountStatus: "ACTIVE",
    isActive: true,
    applicantProfile: {
      firstName: "Maria",
      lastName: "Santos",
      mobileNumber: "09181234567",
    },
  };

  const mockTAUser = {
    id: "ta-uuid-202",
    email: "recruiter@megs-recruitment.com",
    role: "TALENT_ACQUISITION",
    accountStatus: "ACTIVE",
    isActive: true,
    applicantProfile: { firstName: "Sarah", lastName: "Recruiter" },
  };

  const mockPooledApplication = {
    id: 101,
    jobPostingId: 201,
    userId: "cand-uuid-101",
    status: "TALENT_POOL",
    isArchived: false,
    createdAt: "2026-08-20T08:00:00Z",
    updatedAt: "2026-08-28T10:00:00Z",
    jobPosting: {
      id: 201,
      title: "Logistics Warehouse Clerk",
      location: "Calamba, Laguna",
      description: "Manage inbound and outbound inventory records.",
      status: "OPEN",
    },
    interviews: [],
    complianceRequirements: [],
  };

  test("TA/Admin sees 'Talent Pool' internally in staff views", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("access_token", "mock-ta-jwt-token");
      localStorage.setItem("user_role", "TALENT_ACQUISITION");
    });

    await page.route("**/api/auth/mfa/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { enabled: false },
        }),
      });
    });

    await page.route("**/api/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { user: mockTAUser },
        }),
      });
    });

    await page.route("**/api/ta/jobs**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.route("**/api/ta/talent-pool/search**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            items: [
              {
                candidate: {
                  id: 1,
                  applicantProfileId: 1,
                  firstName: "Maria",
                  lastName: "Santos",
                  email: "applicant@example.com",
                  mobileNumber: "09181234567",
                  availability: "AVAILABLE",
                  currentRole: "Logistics Warehouse Clerk",
                },
                similarity: 0.88,
              },
            ],
          },
        }),
      });
    });

    await page.route("**/api/notifications**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.route("**/api/notifications/unread-count", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { count: 0 } }),
      });
    });

    await page.goto("/ta/talent-pool");

    // Internal TA views show Talent Pool
    await expect(page.getByRole("heading", { name: "Candidate pool" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Talent Pool/i })).toBeVisible();

    // Perform search to verify candidate card in talent pool
    await page.getByLabel(/Search by Skills, Keywords/i).fill("Logistics");
    await page.keyboard.press("Enter");

    await expect(page.getByText("Maria Santos")).toBeVisible();
  });

  test("Applicant sees 'Future Opportunities' and candidate-friendly message on portal & notifications", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("access_token", "mock-cand-jwt-token");
      localStorage.setItem("user_role", "APPLICANT");
    });

    await page.route("**/api/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { user: mockCandidateUser },
        }),
      });
    });

    await page.route("**/api/applicant/profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: 1,
            userId: "cand-uuid-101",
            firstName: "Maria",
            lastName: "Santos",
            mobileNumber: "09181234567",
            isActive: true,
            skills: [],
            workExperiences: [],
            educations: [],
            trainings: [],
            characterReferences: [],
            assets: [],
            createdAt: "2026-08-20T08:00:00Z",
            updatedAt: "2026-08-28T10:00:00Z",
          },
        }),
      });
    });

    await page.route("**/api/applicant-jobs/my-applications", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [mockPooledApplication],
        }),
      });
    });

    await page.route("**/api/applicant-jobs/applications/101", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: mockPooledApplication,
        }),
      });
    });

    await page.route("**/api/applicant-jobs/jobs**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    // Mock both legacy and newly generated notifications
    await page.route("**/api/notifications**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 99,
              userId: "cand-uuid-101",
              title: "Application Update",
              message: "Your application has been moved to TALENT POOL.", // legacy stored string
              type: "APPLICATION_STATUS",
              isRead: false,
              createdAt: "2026-08-28T10:00:00Z",
            },
            {
              id: 98,
              userId: "cand-uuid-101",
              title: "Application Update",
              message: "Your application has been moved to REVIEW.",
              type: "APPLICATION_STATUS",
              isRead: false,
              createdAt: "2026-08-28T09:00:00Z",
            },
          ],
        }),
      });
    });

    await page.route("**/api/notifications/unread-count", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { count: 2 } }),
      });
    });

    // 1. Check My Applications Page
    await page.goto("/app/applications");

    // Candidate should see Future Opportunities badge
    await expect(page.getByText("Future Opportunities").first()).toBeVisible();

    // Candidate should NOT see Talent Pool anywhere in the rendered page
    await expect(page.locator("body")).not.toContainText("Talent Pool");

    // Supporting message must be visible on the application card
    const expectedMessage =
      "You were not selected for this position, but your profile may be considered for future job opportunities that match your qualifications.";
    await expect(page.getByText(expectedMessage).first()).toBeVisible();

    // 2. Check Application Detail Page
    await page.goto("/app/applications/101");

    await expect(page.getByText("Future Opportunities").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Status: Future Opportunities" })).toBeVisible();
    await expect(page.getByText(expectedMessage)).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Talent Pool");

    // 3. Check Notifications Page
    await page.goto("/app/notifications");
    await expect(page.getByText(expectedMessage)).toBeVisible();
    await expect(page.getByText("Your application is currently under review.")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("TALENT POOL");
  });
});
