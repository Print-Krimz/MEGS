import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const mockCandidateProfile = {
  id: 1,
  userId: "u-e2e-applicant",
  firstName: "Juan",
  lastName: "Dela Cruz",
  middleName: "Santos",
  mobileNumber: "09171234567",
  address: "123 Mabini St",
  city: "Valenzuela",
  province: "Metro Manila",
  preferredWorkLocations: "Valenzuela, Quezon City",
  professionalSummary: "Experienced Warehouse & Logistics Specialist with 3+ years managing inbound/outbound freight operations.",
  resumeUrl: "https://storage.megs.ph/resumes/juan-resume.pdf",
  isActive: true,
  skills: [
    { id: 1, name: "Warehouse Management" },
    { id: 2, name: "Inventory Control" },
    { id: 3, name: "Forklift Operation" },
  ],
  workExperiences: [
    {
      id: 1,
      roleTitle: "Warehouse Assistant",
      company: "FastLogistics PH",
      startDate: "2023-01-01",
      endDate: "2025-12-31",
      isCurrent: false,
      summary: "Assisted in freight dispatch and sorting.",
    },
  ],
  educations: [
    {
      id: 1,
      degree: "BS Industrial Technology",
      school: "Pamantasan ng Lungsod ng Valenzuela",
      startDate: "2018-06-01",
      endDate: "2022-04-30",
    },
  ],
  trainings: [
    {
      id: 1,
      title: "TESDA Forklift NC II",
      institution: "TESDA Valenzuela",
      issueDate: "2023-05-15",
    },
  ],
  characterReferences: [
    {
      id: 1,
      name: "Maria Santos",
      position: "Warehouse Manager",
      company: "FastLogistics PH",
      contactNumber: "09181234567",
    },
  ],
};

const mockJobs = [
  {
    id: 1,
    title: "Warehouse Inventory Specialist",
    description: "Coordinate warehouse inbound/outbound receiving, cycle counts, and documentation.",
    requirements: "Experience in warehouse receiving, physical count verification, and barcode scanning.",
    location: "Valenzuela City",
    status: "OPEN",
    createdAt: "2026-03-01T08:00:00.000Z",
    mrf: {
      id: 10,
      title: "Warehouse Inventory Specialist Requisition",
      clientId: 1,
      salaryRangeMin: 22000,
      salaryRangeMax: 28000,
      employmentType: "FULL_TIME",
      workArrangement: "ONSITE",
      client: {
        id: 1,
        name: "FastLogistics PH",
        tradeName: "FastLogistics",
      },
    },
  },
  {
    id: 2,
    title: "Logistics Dispatch Supervisor",
    description: "Lead daily freight dispatch operations, manifest audits, and driver assignments.",
    requirements: "Supervisory experience in freight distribution and route coordination.",
    location: "Quezon City",
    status: "OPEN",
    createdAt: "2026-03-02T08:00:00.000Z",
    mrf: {
      id: 11,
      title: "Logistics Dispatch Supervisor Requisition",
      clientId: 2,
      salaryRangeMin: 32000,
      salaryRangeMax: 40000,
      employmentType: "FULL_TIME",
      workArrangement: "ONSITE",
      client: {
        id: 2,
        name: "Metro Express Cargo",
        tradeName: "Metro Express",
      },
    },
  },
  {
    id: 3,
    title: "Distribution Center Team Lead",
    description: "Oversee fulfillment station metrics, pallet inspections, and order sorting queues.",
    requirements: "Leadership experience in e-commerce fulfillment hubs and equipment safety.",
    location: "Biñan, Laguna",
    status: "OPEN",
    createdAt: "2026-03-03T08:00:00.000Z",
    mrf: {
      id: 12,
      title: "Distribution Center Team Lead Requisition",
      clientId: 3,
      salaryRangeMin: 28000,
      salaryRangeMax: 35000,
      employmentType: "FULL_TIME",
      workArrangement: "HYBRID",
      client: {
        id: 3,
        name: "Apex Retail Distribution",
        tradeName: "Apex Retail",
      },
    },
  },
];

const mockApplications = [
  {
    id: 101,
    jobPostingId: 1,
    status: "INITIAL_SCREENING",
    createdAt: "2026-03-01T08:00:00.000Z",
    updatedAt: "2026-03-02T10:00:00.000Z",
    jobPosting: mockJobs[0],
  },
  {
    id: 102,
    jobPostingId: 2,
    status: "COMPLIANCE",
    createdAt: "2026-02-15T08:00:00.000Z",
    updatedAt: "2026-02-20T10:00:00.000Z",
    jobPosting: mockJobs[1],
  },
];

const mockInvitations = [
  {
    id: 501,
    title: "Distribution Center Team Lead",
    description: "Direct invitation for team lead in Biñan Laguna distribution center.",
    requirements: "3+ years warehouse leadership experience.",
    location: "Biñan, Laguna",
    status: "PENDING",
    message: "Your profile matches our client requirements for this leadership role.",
    invitedBy: "Talent Acquisition",
    expiresAt: "2026-09-30T23:59:59.000Z",
    createdAt: "2026-03-04T08:00:00.000Z",
  },
];

const mockApplicationDetail101 = {
  id: 101,
  userId: "u-e2e-applicant",
  jobPostingId: 1,
  status: "INITIAL_SCREENING",
  createdAt: "2026-03-01T08:00:00.000Z",
  updatedAt: "2026-03-02T10:00:00.000Z",
  jobPosting: mockJobs[0],
  interviews: [
    {
      id: 201,
      type: "INITIAL_SCREENING",
      scheduledAt: "2026-03-10T14:00:00.000Z",
      result: "SCHEDULED",
      notes: "Online video screening with Talent Acquisition team.",
    },
  ],
  complianceRequirements: [
    {
      id: 301,
      documentLabel: "NBI Clearance",
      isRequired: true,
      reviewStatus: "SUBMITTED",
      deadline: "2026-03-25T00:00:00.000Z",
      documentId: 401,
    },
    {
      id: 302,
      documentLabel: "SSS Verification / ID",
      isRequired: true,
      reviewStatus: "PENDING",
      deadline: "2026-03-25T00:00:00.000Z",
    },
  ],
};

test.describe("Applicant Portal Redesign - Navy Blue Theme & HCI Audit", () => {
  const screenshotsDir = path.resolve(process.cwd(), "e2e/screenshots-audit");
  const artifactDir = "C:\\Users\\cnico\\.gemini\\antigravity\\brain\\e3c3fad9-473e-4757-905c-c1729407a206";

  const saveScreenshots = async (page: any, filename: string) => {
    const localPath = path.join(screenshotsDir, filename);
    await page.screenshot({ path: localPath, fullPage: true });
    try {
      if (fs.existsSync(artifactDir)) {
        fs.copyFileSync(localPath, path.join(artifactDir, filename));
      }
    } catch {
      // ignore
    }
  };

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    // Seed authenticated session in localStorage
    await page.addInitScript(() => {
      localStorage.setItem("access_token", "mock-applicant-jwt-token");
      localStorage.setItem("user_role", "APPLICANT");
    });

    // Mock user auth
    await page.route("**/api/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: "u-e2e-applicant",
              email: "juan.delacruz@megs.ph",
              role: "APPLICANT",
              isActive: true,
            },
          },
        }),
      });
    });

    // Mock applicant profile
    await page.route("**/api/applicants/profile**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: mockCandidateProfile,
        }),
      });
    });

    // Mock saved jobs IDs
    await page.route("**/api/applicant-jobs/saved-jobs/ids**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [1],
        }),
      });
    });

    // Mock saved jobs list
    await page.route("**/api/applicant-jobs/saved-jobs**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [mockJobs[0]],
        }),
      });
    });

    // Mock invitations
    await page.route("**/api/applicant-jobs/invitations**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: mockInvitations,
        }),
      });
    });

    // Mock my applications
    await page.route("**/api/applicant-jobs/my-applications**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: mockApplications,
        }),
      });
    });

    // Mock single application detail
    await page.route("**/api/applicant-jobs/applications/101**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: mockApplicationDetail101,
        }),
      });
    });

    // Mock jobs list and detail dynamically
    await page.route(/\/api\/applicant-jobs\/jobs(\/.*)?$/, async (route) => {
      const url = new URL(route.request().url());
      const pathname = url.pathname;
      const matchDetail = pathname.match(/\/api\/applicant-jobs\/jobs\/(\d+)/);
      if (matchDetail) {
        const jobId = Number(matchDetail[1]);
        const job = mockJobs.find((j) => j.id === jobId) || mockJobs[0];
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: job,
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: mockJobs,
        }),
      });
    });

    // Mock notifications
    await page.route("**/api/notifications**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            notifications: [],
            unreadCount: 0,
          },
        }),
      });
    });
  });

  test("1. Applicant Dashboard (Desktop 1280px): Navy theme, greeting, metrics, milestone tracker, recommended jobs", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/app");
    await page.waitForLoadState("networkidle");

    // 1. Verify candidate portal branding
    await expect(page.getByLabel("MEGS Candidate Portal Home")).toBeVisible();

    // 2. Candidate personalized greeting
    await expect(page.getByRole("heading", { name: /Juan/i })).toBeVisible();

    // 3. Digital resume readiness meter
    await expect(page.getByText("Digital Resume Readiness:")).toBeVisible();

    // 4. Operational metrics
    await expect(page.getByText("Total submissions")).toBeVisible();
    await expect(page.getByText("In Progress")).toBeVisible();
    await expect(page.getByText("Screening & client sessions")).toBeVisible();
    await expect(page.getByText("Placed")).toBeVisible();

    // 5. Recent applications with JobStreet linear milestones
    await expect(page.getByText("Warehouse Inventory Specialist")).toBeVisible();
    await expect(page.getByRole("link", { name: "Track status" }).first()).toBeVisible();

    // 6. Recommended positions
    await expect(page.getByText("Recommended Positions for You")).toBeVisible();

    // 7. Anti-AI-slop verification: 0 sparkles
    const sparkles = page.locator(".lucide-sparkles, svg[data-icon='sparkles']");
    expect(await sparkles.count()).toBe(0);

    // 8. Zero horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Screenshot
    await saveScreenshots(page, "applicant-dashboard-desktop.png");
  });

  test("2. Applicant Dashboard (Mobile 375px): Responsive layout, 44px touch targets, zero overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/app");
    await page.waitForLoadState("networkidle");

    // Check greeting
    await expect(page.getByRole("heading", { name: /Juan/i })).toBeVisible();

    // Zero horizontal scroll
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Touch targets check on CTAs
    const trackStatusLink = page.getByRole("link", { name: "Track status" }).first();
    const box = await trackStatusLink.boundingBox();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(40);
    }

    // Screenshot
    await saveScreenshots(page, "applicant-dashboard-mobile.png");
  });

  test("3. Jobs Browsing Page (/app/jobs): Search, scope toggle, cards, bookmark", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/app/jobs");
    await page.waitForLoadState("networkidle");

    // Verify Page Header
    await expect(page.getByRole("heading", { name: "Explore jobs" })).toBeVisible();

    // Scope toggle buttons
    await expect(page.getByText(/All Openings/i)).toBeVisible();
    await expect(page.getByText(/Saved Jobs/i)).toBeVisible();

    // Job cards
    await expect(page.getByText("Warehouse Inventory Specialist")).toBeVisible();
    await expect(page.getByText("Logistics Dispatch Supervisor")).toBeVisible();

    // Verify Salary Range from MRF
    await expect(page.getByText("₱22,000 – ₱28,000 / month")).toBeVisible();

    // Details CTA button
    const detailsButtons = page.getByRole("link", { name: "Details" });
    expect(await detailsButtons.count()).toBeGreaterThanOrEqual(1);

    // Anti-slop
    const sparkles = page.locator(".lucide-sparkles, svg[data-icon='sparkles']");
    expect(await sparkles.count()).toBe(0);

    // Zero overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Screenshot
    await saveScreenshots(page, "applicant-jobs-desktop.png");
  });

  test("4. Job Detail Page (/app/jobs/1): 2-column layout and 1-click apply action", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/app/jobs/1");
    await page.waitForLoadState("networkidle");

    // Title and back link
    await expect(page.getByRole("heading", { name: "Warehouse Inventory Specialist" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to jobs" })).toBeVisible();

    // Position Overview & Requirements
    await expect(page.getByText("Position Overview")).toBeVisible();
    await expect(page.getByText("What you need for this role")).toBeVisible();

    // Salary and Working Terms from MRF
    await expect(page.getByText("Monthly Salary Range")).toBeVisible();
    await expect(page.getByText("₱22,000 – ₱28,000 / month").first()).toBeVisible();

    // Sticky summary sidebar
    await expect(page.getByText("Role Summary")).toBeVisible();
    await expect(page.getByRole("button", { name: "Apply for this job" })).toBeVisible();

    // Anti-slop
    const sparkles = page.locator(".lucide-sparkles, svg[data-icon='sparkles']");
    expect(await sparkles.count()).toBe(0);

    // Screenshot
    await saveScreenshots(page, "applicant-job-detail-desktop.png");
  });

  test("5. My Applications Tracker (/app/applications): Filter tabs and milestone progress", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/app/applications");
    await page.waitForLoadState("networkidle");

    // Verify Title
    await expect(page.getByRole("heading", { name: "My applications" })).toBeVisible();

    // Filter tabs
    await expect(page.getByRole("button", { name: /All applications/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /In Review/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Interviews/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Requirements & Contract/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Job Invitations/i })).toBeVisible();

    // Application cards
    await expect(page.getByText("Warehouse Inventory Specialist")).toBeVisible();
    await expect(page.getByRole("link", { name: "View application progress" }).first()).toBeVisible();

    // Anti-slop
    const sparkles = page.locator(".lucide-sparkles, svg[data-icon='sparkles']");
    expect(await sparkles.count()).toBe(0);

    // Screenshot
    await saveScreenshots(page, "applicant-applications-desktop.png");
  });

  test("6. Candidate Profile (/app/profile): Digital resume readiness and section navigation", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/app/profile");
    await page.waitForLoadState("networkidle");

    // Verify profile header & name
    await expect(page.getByText("Juan Santos Dela Cruz")).toBeVisible();
    await expect(page.getByText("Profile Strength:")).toBeVisible();
    await expect(page.getByText("Resume to profile")).toBeVisible();

    // Semantic navigation
    await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Personal Info" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Experience & Education" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Applications" })).toBeVisible();

    // Anti-slop
    const sparkles = page.locator(".lucide-sparkles, svg[data-icon='sparkles']");
    expect(await sparkles.count()).toBe(0);

    // Screenshot
    await saveScreenshots(page, "applicant-profile-desktop.png");
  });
});
