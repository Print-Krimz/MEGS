import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { json, mockShell } from "./helpers/mock-shell";

const taUser = {
  id: "u-ta-overview",
  email: "clarisse.reyes@megs.ph",
  role: "TALENT_ACQUISITION",
  accountStatus: "ACTIVE",
  createdAt: "2026-01-10T00:00:00.000Z",
  applicantProfile: {
    firstName: "Clarisse",
    lastName: "Reyes",
  },
};

const adminUser = {
  id: "u-admin-overview",
  email: "admin@megs.ph",
  role: "ADMINISTRATOR",
  accountStatus: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
  applicantProfile: {
    firstName: "System",
    lastName: "Administrator",
  },
};

function manilaDay(offsetDays = 0): string {
  const base = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const y = Number(part("year"));
  const m = Number(part("month"));
  const d = Number(part("day"));
  const shifted = new Date(Date.UTC(y, m - 1, d + offsetDays));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

async function saveShot(page: Page, testInfo: TestInfo, filename: string): Promise<string> {
  const target = process.env.OVERVIEW_SCREENSHOT_DIR
    ? path.join(process.env.OVERVIEW_SCREENSHOT_DIR, filename)
    : testInfo.outputPath(filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  await page.screenshot({ path: target, fullPage: true });
  return target;
}

function buildEmptyAnalyticsExtras() {
  const today = manilaDay(0);
  const weekAgo = manilaDay(-6);
  return {
    dateRange: { startDate: weekAgo, endDate: today, days: 7 },
    previousPeriod: {
      startDate: manilaDay(-13),
      endDate: manilaDay(-7),
      placementsStarted: 2,
      newStarts: 2,
      redeployStarts: 0,
      medianDaysToFill: 15,
      daysToFillSample: 2,
      backoutRate: 0,
      backoutRateBase: 2,
    },
    clientReview: { avgDays: null, sample: 2, clients: [] },
    dueSoon: [],
    dueSoonTotal: 0,
    trend: { granularity: "day" as const, points: [] },
    requests: [],
    stageTable: [],
    sources: [],
    dropOff: [],
    backouts: {
      withdrawals: 0,
      backouts: 0,
      byParty: { APPLICANT: 0, CLIENT: 0, AGENCY: 0 },
      byStage: [],
      topReasons: [],
      noShows: 0,
      byClient: [],
      byRequest: [],
      recent: [],
    },
    closures: {
      rejected: { total: 0, talentPool: 0, archive: 0, notRecorded: 0 },
      backedOut: { total: 0, talentPool: 0, archive: 0, notRecorded: 0 },
      topRejectionReasons: [],
      rejectedByStage: [],
    },
    clientDecisions: { accepted: 3, declined: 1 },
    stuck: [],
    stuckTotal: 0,
    filterOptions: {
      clients: [],
      mrfs: [],
      jobPostings: [],
      recruiters: [],
      stages: [],
    },
  };
}

async function trackUnmockedApi(page: Page): Promise<string[]> {
  const unmocked: string[] = [];
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      unmocked.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "Not mocked", data: null }),
      });
    },
  );
  return unmocked;
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
}

interface SetupTAOptions {
  emptyWorklist?: boolean;
  failPipelineUntil?: () => boolean;
}

async function setupTAOverview(page: Page, opts: SetupTAOptions = {}): Promise<string[]> {
  const unmocked = await trackUnmockedApi(page);

  await mockShell(page, taUser);

  await page.route("**/api/ta/analytics/pipeline*", (route) => {
    if (opts.failPipelineUntil?.()) {
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "Pipeline unavailable" }),
      });
    }
    return route.fulfill(
      json({
        activeApplications: 43,
        statusBreakdown: {
          SUBMITTED: 0,
          INITIAL_SCREENING: 2,
          CLIENT_ENDORSEMENT: 0,
          FINAL_INTERVIEW: 0,
          COMPLIANCE: 3,
          CONTRACT_SIGNING: 1,
          DEPLOYED: 2,
        },
      }),
    );
  });

  await page.route("**/api/ta/compliance/interviews*", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("scheduledOnly") === "true") {
      return route.fulfill(
        json({
          items: [
            {
              interviewId: 101,
              applicationId: 501,
              candidateName: "Aethan Del Rosario",
              jobTitle: "Industrial Electrician",
              clientName: "Apex Manufacturing",
              scheduledAt: `${manilaDay(1)}T09:30:00+08:00`,
              deadline: `${manilaDay(2)}T17:00:00+08:00`,
              status: "HEALTHY",
              currentStage: "INITIAL_SCREENING",
            },
            {
              interviewId: 102,
              applicationId: 502,
              candidateName: "Bianca Villanueva",
              jobTitle: "Forklift Operator",
              clientName: "Northport Logistics",
              scheduledAt: `${manilaDay(2)}T14:00:00+08:00`,
              deadline: `${manilaDay(3)}T17:00:00+08:00`,
              status: "HEALTHY",
              currentStage: "FINAL_INTERVIEW",
            },
          ],
          total: 2,
          page: 1,
          pageSize: 50,
          totalPages: 1,
          summary: opts.emptyWorklist
            ? { total: 2, breached: 0, warning: 0, healthy: 2 }
            : { total: 4, breached: 1, warning: 1, healthy: 2 },
          positions: [],
        }),
      );
    }
    return route.fulfill(
      json({
        items: [],
        total: 1,
        page: 1,
        pageSize: 1,
        totalPages: 1,
        summary: opts.emptyWorklist
          ? { total: 2, breached: 0, warning: 0, healthy: 2 }
          : { total: 4, breached: 1, warning: 1, healthy: 2 },
        positions: [],
      }),
    );
  });

  await page.route("**/api/ta/dashboard-counts*", (route) =>
    route.fulfill(
      json({
        openJobs: 17,
        activeDeployments: 33,
        awaitingStart: 4,
      }),
    ),
  );

  await page.route("**/api/employees/redeployment-queue/summary*", (route) =>
    route.fulfill(
      json({
        stages: {
          NEEDS_PLACEMENT: opts.emptyWorklist ? 0 : 2,
        },
      }),
    ),
  );

  const pendingActions = opts.emptyWorklist
    ? []
    : [
        {
          id: "act-1",
          type: "INITIAL_INTERVIEW",
          title: "Record initial interview result",
          candidateName: "Aethan Del Rosario",
          jobTitle: "Industrial Electrician",
          applicationId: 501,
          urgency: "HIGH",
          agingDays: 4,
          deadline: `${manilaDay(-2)}T17:00:00+08:00`,
          targetUrl: "/ta/applications/501",
          createdAt: `${manilaDay(-5)}T08:00:00+08:00`,
        },
        {
          id: "act-2",
          type: "COMPLIANCE_REVIEW",
          title: "Review NBI clearance",
          candidateName: "Marco Dizon",
          jobTitle: "Warehouse Supervisor",
          applicationId: 503,
          urgency: "HIGH",
          agingDays: 3,
          deadline: `${manilaDay(-1)}T17:00:00+08:00`,
          targetUrl: "/ta/applications/503",
          createdAt: `${manilaDay(-4)}T08:00:00+08:00`,
        },
        {
          id: "act-3",
          type: "CLIENT_ENDORSEMENT",
          title: "Follow up client decision",
          candidateName: "Nathaniel Cruz",
          jobTitle: "Maintenance Technician",
          applicationId: 504,
          urgency: "MEDIUM",
          agingDays: 2,
          deadline: `${manilaDay(0)}T17:00:00+08:00`,
          targetUrl: "/ta/applications/504",
          createdAt: `${manilaDay(-2)}T08:00:00+08:00`,
        },
        {
          id: "act-4",
          type: "CONTRACT_SIGNING",
          title: "Confirm contract signing slot",
          candidateName: "Camille Bautista",
          jobTitle: "Quality Inspector",
          applicationId: 505,
          urgency: "MEDIUM",
          agingDays: 1,
          deadline: `${manilaDay(0)}T18:00:00+08:00`,
          targetUrl: "/ta/applications/505",
          createdAt: `${manilaDay(-1)}T08:00:00+08:00`,
        },
        {
          id: "act-5",
          type: "START_CONFIRMATION",
          title: "Confirm deployment start date",
          candidateName: "Paolo Mendoza",
          jobTitle: "Safety Officer",
          applicationId: 506,
          urgency: "NORMAL",
          agingDays: 0,
          deadline: `${manilaDay(3)}T17:00:00+08:00`,
          targetUrl: "/ta/applications/506",
          createdAt: `${manilaDay(0)}T08:00:00+08:00`,
        },
      ];

  await page.route("**/api/ta/analytics/dashboard*", (route) =>
    route.fulfill(
      json({
        ...buildEmptyAnalyticsExtras(),
        kpis: {
          openSeats: 100,
          requestedSeats: 103,
          fillRate: 3,
          filledSeats: 3,
          placementsStarted: 4,
          newStarts: 3,
          redeployStarts: 1,
          medianDaysToFill: 14,
          daysToFillSample: 4,
          backoutsAfterClientReview: 0,
          backoutRate: 0,
          backoutRateBase: 4,
          lateRequests: 2,
          overdueTotal: 2,
          activeApplicants: 43,
          overdueCandidates: 2,
          overdueEstimated: 0,
          closedOpenings: 0,
          criticalCandidates: 1,
          unlinkedApplicants: 0,
          staleFilledRequisitions: 0,
          requisitions: { total: 10, open: 8, overdue: 1, atRisk: 1, filled: 2 },
        },
        pendingActionsTotal: opts.emptyWorklist ? 0 : 9,
        pendingActions,
      }),
    ),
  );

  await page.route("**/api/ta/deployments*", (route) =>
    route.fulfill(
      json([
        {
          id: 701,
          employeeId: 201,
          clientId: 10,
          status: "ACTIVE",
          contractStart: `${manilaDay(-150)}T00:00:00+08:00`,
          contractEnd: `${manilaDay(5)}T00:00:00+08:00`,
          createdById: taUser.id,
          createdAt: `${manilaDay(-150)}T00:00:00+08:00`,
          updatedAt: `${manilaDay(-10)}T00:00:00+08:00`,
          client: { id: 10, name: "Apex Manufacturing" },
          employee: {
            id: 201,
            employeeNumber: "EMP-201",
            user: {
              applicantProfile: { firstName: "Rafael", lastName: "Soriano" },
            },
          },
        },
        {
          id: 702,
          employeeId: 202,
          clientId: 11,
          status: "ACTIVE",
          contractStart: `${manilaDay(-140)}T00:00:00+08:00`,
          contractEnd: `${manilaDay(18)}T00:00:00+08:00`,
          createdById: taUser.id,
          createdAt: `${manilaDay(-140)}T00:00:00+08:00`,
          updatedAt: `${manilaDay(-10)}T00:00:00+08:00`,
          client: { id: 11, name: "Northport Logistics" },
          employee: {
            id: 202,
            employeeNumber: "EMP-202",
            user: {
              applicantProfile: { firstName: "Elena", lastName: "Navarro" },
            },
          },
        },
      ]),
    ),
  );

  await page.route("**/api/ta/analytics/compliance*", (route) =>
    route.fulfill(
      json({
        totalRequirements: 25,
        statusBreakdown: {
          PENDING: 4,
          SUBMITTED: opts.emptyWorklist ? 0 : 2,
          APPROVED: 18,
          REJECTED: 1,
        },
      }),
    ),
  );

  await page.route("**/api/employees/credential-alerts*", (route) =>
    route.fulfill(
      json([
        {
          requirementId: 901,
          documentId: 301,
          documentLabel: "TESDA NC II Certificate",
          reviewStatus: "APPROVED",
          validityStatus: "HAS_EXPIRY",
          expiresAt: `${manilaDay(10)}T00:00:00+08:00`,
          alertType: "EXPIRING_SOON",
          employeeId: 203,
          employeeNumber: "EMP-203",
          employeeName: "Jerome Mercado",
          employeeStatus: "ACTIVE",
          clientName: "Apex Manufacturing",
          jobTitle: "CNC Machinist",
        },
      ]),
    ),
  );

  return unmocked;
}

interface SetupAdminOptions {
  healthy?: boolean;
}

async function setupAdminOverview(page: Page, opts: SetupAdminOptions = {}): Promise<string[]> {
  const unmocked = await trackUnmockedApi(page);

  await mockShell(page, adminUser);

  // Registered AFTER mockShell so it takes priority over mockShell's default summary.
  await page.route("**/api/admin/users/summary*", (route) =>
    route.fulfill(
      json(
        opts.healthy
          ? {
              totalUsers: 12,
              recruiters: 4,
              administrators: 2,
              pendingInvitations: 1,
              expiredInvitations: 0,
              inactiveAccounts: 0,
              failedJobs: 0,
              pendingRequests: 0,
            }
          : {
              totalUsers: 12,
              recruiters: 4,
              administrators: 2,
              pendingInvitations: 2,
              expiredInvitations: 1,
              inactiveAccounts: 1,
              failedJobs: 2,
              pendingRequests: 3,
            },
      ),
    ),
  );

  await page.route("**/api/admin/maintenance/backups*", (route) =>
    route.fulfill(
      json([
        {
          id: 1,
          filename: "megs-backup-20261119.enc",
          displayName: null,
          sizeBytes: 2_450_000,
          checksumSha256: "e3b0c44298fc1c149afbf4c8996fb924",
          status: "COMPLETED",
          backupType: "SCHEDULED_ROUTINE",
          encryptionMethod: "AES-256-GCM",
          tablesIncluded: ["users", "applications"],
          errorMessage: null,
          durationMs: 1420,
          initiatedBy: null,
          progress: null,
          createdAt: `${manilaDay(0)}T02:00:00+08:00`,
          completedAt: `${manilaDay(0)}T02:00:02+08:00`,
        },
      ]),
    ),
  );

  await page.route("**/api/admin/analytics/dashboard*", (route) =>
    route.fulfill(
      json({
        ...buildEmptyAnalyticsExtras(),
        stuckTotal: 4,
        kpis: {
          openSeats: 28,
          requestedSeats: 40,
          fillRate: 70,
          filledSeats: 12,
          placementsStarted: 5,
          newStarts: 4,
          redeployStarts: 1,
          medianDaysToFill: 12,
          daysToFillSample: 5,
          backoutsAfterClientReview: 1,
          backoutRate: 17,
          backoutRateBase: 6,
          lateRequests: 3,
          overdueTotal: 4,
          activeApplicants: 52,
          overdueCandidates: 3,
          overdueEstimated: 1,
          closedOpenings: 0,
          criticalCandidates: 2,
          unlinkedApplicants: 0,
          staleFilledRequisitions: 0,
          requisitions: {
            total: 9,
            open: 7,
            overdue: 2,
            atRisk: 1,
            onTrack: 6,
            filled: 2,
          },
        },
        team: [
          {
            recruiterId: "ta-1",
            name: "Clarisse Reyes",
            active: 22,
            overdue: 3,
            overdueEstimated: 0,
            openRequisitions: 4,
            requestedSeats: 20,
            filledSeats: 12,
            fillRate: 60,
            sentToClient: 5,
            newStarts: 3,
            redeployStarts: 1,
            placed: 4,
            backouts: 1,
            backoutRate: 20,
            backoutRateBase: 5,
            medianDaysToFill: 11,
            daysToFillSample: 4,
          },
          {
            recruiterId: "ta-2",
            name: "Miguel Santos",
            active: 16,
            overdue: 1,
            overdueEstimated: 0,
            openRequisitions: 2,
            requestedSeats: 12,
            filledSeats: 10,
            fillRate: 83,
            sentToClient: 3,
            newStarts: 1,
            redeployStarts: 0,
            placed: 1,
            backouts: 0,
            backoutRate: 0,
            backoutRateBase: 1,
            medianDaysToFill: 14,
            daysToFillSample: 1,
          },
          {
            recruiterId: "ta-3",
            name: "Andrea Lim",
            active: 11,
            overdue: 0,
            overdueEstimated: 0,
            openRequisitions: 1,
            requestedSeats: 8,
            filledSeats: 6,
            fillRate: 75,
            sentToClient: 2,
            newStarts: 0,
            redeployStarts: 0,
            placed: 0,
            backouts: 0,
            backoutRate: null,
            backoutRateBase: 0,
            medianDaysToFill: null,
            daysToFillSample: 0,
          },
        ],
        unassigned: {
          requests: 1,
          applicants: 3,
          overdue: 1,
          overdueEstimated: 0,
          requestedSeats: 4,
          oldestWaitDays: 6,
        },
      }),
    ),
  );

  await page.route("**/api/admin/audit-logs*", (route) =>
    route.fulfill(
      json([
        {
          id: 501,
          action: "INVITED_TA",
          entity: "User",
          entityId: "ta-4",
          createdAt: `${manilaDay(0)}T08:45:00+08:00`,
          user: {
            id: adminUser.id,
            email: adminUser.email,
            role: "ADMINISTRATOR",
            applicantProfile: { firstName: "System", lastName: "Administrator" },
          },
        },
        {
          id: 502,
          action: "CANDIDATE_SCORING_CONFIGURATION_ACTIVATED",
          entity: "CandidateScoringConfiguration",
          entityId: "7",
          createdAt: `${manilaDay(0)}T07:30:00+08:00`,
          user: {
            id: adminUser.id,
            email: adminUser.email,
            role: "ADMINISTRATOR",
            applicantProfile: { firstName: "System", lastName: "Administrator" },
          },
        },
        {
          id: 503,
          action: "MRF_CREATED",
          entity: "ManpowerRequest",
          entityId: "44",
          createdAt: `${manilaDay(-1)}T16:15:00+08:00`,
          user: {
            id: "ta-1",
            email: "clarisse.reyes@megs.ph",
            role: "TALENT_ACQUISITION",
            applicantProfile: { firstName: "Clarisse", lastName: "Reyes" },
          },
        },
        {
          id: 504,
          action: "DATABASE_BACKUP_SUCCESS",
          entity: "DatabaseBackup",
          entityId: "1",
          createdAt: `${manilaDay(0)}T02:00:02+08:00`,
          user: null,
        },
        {
          id: 505,
          action: "USER_LOGGED_IN",
          entity: "User",
          entityId: "ta-2",
          createdAt: `${manilaDay(-1)}T09:05:00+08:00`,
          user: {
            id: "ta-2",
            email: "miguel.santos@megs.ph",
            role: "TALENT_ACQUISITION",
            applicantProfile: { firstName: "Miguel", lastName: "Santos" },
          },
        },
      ]),
    ),
  );

  return unmocked;
}

test.describe("TA Overview UX, Accessibility, & Layout", () => {
  test("Desktop 1366x768: layout, KPI strip, deduplicated queues, filters, pipeline fold, 3-column Coming up, and axe", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const unmocked = await setupTAOverview(page);

    await page.goto("/ta");

    // 1. Header: Overview heading + inline As of + single New manpower request CTA
    await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
    await expect(page.getByText(/^As of /)).toBeVisible();
    const newMrfCta = page.getByRole("link", { name: /New manpower request/i });
    await expect(newMrfCta).toHaveCount(1);
    await expect(newMrfCta).toBeVisible();

    // 2. 4 KPI tiles in one horizontal strip above the 2-column workspace
    const kpiLabels = [
      "Active candidates",
      "Active job openings",
      "Seats to fill",
      "Active deployments",
    ];
    const kpiBoxes = [];
    for (const label of kpiLabels) {
      const tileLink = page.getByRole("link", { name: label });
      await expect(tileLink).toBeVisible();
      const box = await tileLink.boundingBox();
      expect(box).not.toBeNull();
      kpiBoxes.push(box!);
    }
    const firstKpiY = kpiBoxes[0].y;
    for (const box of kpiBoxes) {
      expect(Math.abs(box.y - firstKpiY)).toBeLessThanOrEqual(2);
    }

    const needsActionRegion = page.getByRole("region", { name: "Needs your action" });
    const pipelineRegion = page.getByRole("region", { name: "Hiring pipeline" });
    await expect(needsActionRegion).toBeVisible();
    await expect(pipelineRegion).toBeVisible();

    const needsActionBox = await needsActionRegion.boundingBox();
    const pipelineBox = await pipelineRegion.boundingBox();
    expect(needsActionBox).not.toBeNull();
    expect(pipelineBox).not.toBeNull();
    expect(kpiBoxes[0].y + kpiBoxes[0].height).toBeLessThan(needsActionBox!.y);
    expect(Math.abs(needsActionBox!.y - pipelineBox!.y)).toBeLessThanOrEqual(2);

    // 3. Deduplicated Queues strip + individual candidate rows
    await expect(needsActionRegion.getByText("Queues:")).toBeVisible();
    const queueLabels = [
      "1 interview overdue",
      "1 interview due within 48 hours",
      "2 pre-employment documents awaiting review",
      "2 workers need placement",
    ];
    for (const qLabel of queueLabels) {
      await expect(needsActionRegion.getByRole("link", { name: qLabel })).toHaveCount(1);
    }

    const taskList = needsActionRegion.locator("ul");
    await expect(taskList.locator("li")).toHaveCount(5);
    for (const qLabel of queueLabels) {
      await expect(taskList.getByText(qLabel)).toHaveCount(0);
    }

    // 4. Urgency filter tabs update aria-pressed and filter rows accurately
    const filterGroup = needsActionRegion.getByRole("group", { name: "Filter action items" });
    const allTab = filterGroup.getByRole("button", { name: /^All/ });
    const overdueTab = filterGroup.getByRole("button", { name: /^Overdue/ });
    const dueSoonTab = filterGroup.getByRole("button", { name: /^Due soon/ });
    const todoTab = filterGroup.getByRole("button", { name: /^To do/ });

    await expect(allTab).toHaveAttribute("aria-pressed", "true");
    await expect(overdueTab).toHaveAttribute("aria-pressed", "false");

    await overdueTab.click();
    await expect(overdueTab).toHaveAttribute("aria-pressed", "true");
    await expect(allTab).toHaveAttribute("aria-pressed", "false");
    await expect(taskList.locator("li")).toHaveCount(2);
    await expect(taskList.getByText("Aethan Del Rosario")).toBeVisible();
    await expect(taskList.getByText("Marco Dizon")).toBeVisible();

    await dueSoonTab.click();
    await expect(dueSoonTab).toHaveAttribute("aria-pressed", "true");
    await expect(taskList.locator("li")).toHaveCount(2);
    await expect(taskList.getByText("Nathaniel Cruz")).toBeVisible();
    await expect(taskList.getByText("Camille Bautista")).toBeVisible();

    await todoTab.click();
    await expect(todoTab).toHaveAttribute("aria-pressed", "true");
    await expect(taskList.locator("li")).toHaveCount(1);
    await expect(taskList.getByText("Paolo Mendoza")).toBeVisible();

    await allTab.click();
    await expect(allTab).toHaveAttribute("aria-pressed", "true");
    await expect(taskList.locator("li")).toHaveCount(5);

    // 5. All 7 Hiring pipeline stages visible above 768px fold
    const pipelineLinks = pipelineRegion.locator("ul li a");
    await expect(pipelineLinks).toHaveCount(7);
    for (let i = 0; i < 7; i++) {
      const link = pipelineLinks.nth(i);
      const box = await link.boundingBox();
      const text = (await link.innerText()).replace(/\s+/g, " ").trim();
      expect(box).not.toBeNull();
      expect(
        box!.y + box!.height,
        `Pipeline stage "${text}" bottom (${box!.y + box!.height}) should be <= 768px`,
      ).toBeLessThanOrEqual(768);
    }

    // 6. Coming up renders all 3 sections side-by-side in 3 columns
    const comingUpRegion = page.getByRole("region", { name: "Coming up" });
    await expect(comingUpRegion).toBeVisible();
    const comingUpHeadings = comingUpRegion.locator("h3");
    await expect(comingUpHeadings).toHaveCount(3);
    const h3Boxes = [];
    for (let i = 0; i < 3; i++) {
      const box = await comingUpHeadings.nth(i).boundingBox();
      expect(box).not.toBeNull();
      h3Boxes.push(box!);
    }
    expect(Math.abs(h3Boxes[0].y - h3Boxes[1].y)).toBeLessThanOrEqual(2);
    expect(Math.abs(h3Boxes[1].y - h3Boxes[2].y)).toBeLessThanOrEqual(2);
    expect(h3Boxes[0].x).toBeLessThan(h3Boxes[1].x);
    expect(h3Boxes[1].x).toBeLessThan(h3Boxes[2].x);

    // 7. Zero horizontal overflow
    await expectNoHorizontalOverflow(page);

    // 8. Capture screenshot before axe assertion
    expect(unmocked).toEqual([]);
    await saveShot(page, testInfo, "ta-overview-desktop.png");

    // 9. Axe WCAG 2.0/2.1 A+AA scan
    const axeResults = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axeResults.violations).toEqual([]);
  });

  test("Empty worklist shows calm empty state", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const unmocked = await setupTAOverview(page, { emptyWorklist: true });
    await page.goto("/ta");

    const needsActionRegion = page.getByRole("region", { name: "Needs your action" });
    await expect(needsActionRegion.getByText("Nothing needs your action right now.")).toBeVisible();
    expect(unmocked).toEqual([]);
  });

  test("Partial error retry recovers Hiring pipeline without breaking Needs your action", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    let pipelineAttempts = 0;
    let allowPipelineSuccess = false;

    const unmocked = await setupTAOverview(page, {
      failPipelineUntil: () => {
        pipelineAttempts += 1;
        return !allowPipelineSuccess;
      },
    });
    await page.goto("/ta");

    const needsActionRegion = page.getByRole("region", { name: "Needs your action" });
    const pipelineRegion = page.getByRole("region", { name: "Hiring pipeline" });

    // Needs your action and Coming up remain healthy (wait for Coming up to settle so page scrollbar is stable)
    await expect(needsActionRegion.getByText("Aethan Del Rosario")).toBeVisible();
    await expect(page.getByRole("region", { name: "Coming up" }).locator("h3")).toHaveCount(3);

    // Hiring pipeline shows compact retry after initial attempt + 1 automatic retry
    const tryAgainBtn = pipelineRegion.getByRole("button", { name: "Try again" });
    await expect(tryAgainBtn).toBeVisible({ timeout: 5000 });
    expect(pipelineAttempts).toBeGreaterThanOrEqual(2);

    allowPipelineSuccess = true;
    await tryAgainBtn.click();

    await expect(pipelineRegion.getByRole("link", { name: /Initial screening/i })).toBeVisible();
    await expect(needsActionRegion.getByText("Aethan Del Rosario")).toBeVisible();
    expect(unmocked).toEqual([]);
  });

  test("Mobile 390x844: zero horizontal overflow and >= 44px touch targets for filter buttons, queue links, and pipeline rows", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const unmocked = await setupTAOverview(page);
    await page.goto("/ta");

    const needsActionRegion = page.getByRole("region", { name: "Needs your action" });
    await expect(needsActionRegion).toBeVisible();
    await expect(page.getByRole("region", { name: "Coming up" })).toBeVisible();

    await expectNoHorizontalOverflow(page);

    // Filter buttons >= 44px
    const filterButtons = needsActionRegion
      .getByRole("group", { name: "Filter action items" })
      .getByRole("button");
    const filterCount = await filterButtons.count();
    expect(filterCount).toBe(4);
    for (let i = 0; i < filterCount; i++) {
      const box = await filterButtons.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    // Queue links >= 44px
    const queueLinks = needsActionRegion.locator('a[href^="/ta/"]').filter({
      hasText: /^\d+\s+(interview|pre-employment|workers?)/,
    });
    const queueCount = await queueLinks.count();
    expect(queueCount).toBe(4);
    for (let i = 0; i < queueCount; i++) {
      const box = await queueLinks.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    // Hiring pipeline rows >= 44px
    const pipelineLinks = page.getByRole("region", { name: "Hiring pipeline" }).locator("ul li a");
    const pipelineCount = await pipelineLinks.count();
    expect(pipelineCount).toBe(7);
    for (let i = 0; i < pipelineCount; i++) {
      const box = await pipelineLinks.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    expect(unmocked).toEqual([]);

    await saveShot(page, testInfo, "ta-overview-mobile.png");
  });
});

test.describe("Admin Overview UX, Accessibility, & Layout", () => {
  test("Desktop 1366x768 (active alerts): single View reports link, Manage users CTA, System status alerts, zero overflow, axe", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const unmocked = await setupAdminOverview(page, { healthy: false });
    await page.goto("/admin");

    await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Manage users" })).toBeVisible();
    await expect(page.getByRole("link", { name: "View reports" })).toHaveCount(1);

    const statusSection = page.getByRole("region", { name: "System status" });
    await expect(statusSection).toBeVisible();
    await expect(statusSection.getByText(/need attention/)).toBeVisible();

    await expectNoHorizontalOverflow(page);

    const axeResults = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axeResults.violations).toEqual([]);

    expect(unmocked).toEqual([]);

    await saveShot(page, testInfo, "admin-overview-desktop.png");
  });

  test("Desktop 1366x768 (all healthy): All checks normal renders cleanly", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const unmocked = await setupAdminOverview(page, { healthy: true });
    await page.goto("/admin");

    const statusSection = page.getByRole("region", { name: "System status" });
    await expect(statusSection).toBeVisible();
    await expect(statusSection.getByText("All checks normal")).toBeVisible();
    await expect(statusSection.getByText(/need attention/)).toHaveCount(0);

    await expectNoHorizontalOverflow(page);
    expect(unmocked).toEqual([]);

    await saveShot(page, testInfo, "admin-overview-healthy-desktop.png");
  });

  test("Mobile 390x844: zero horizontal overflow and single View reports link", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const unmocked = await setupAdminOverview(page, { healthy: false });
    await page.goto("/admin");

    await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "View reports" })).toHaveCount(1);
    await expect(page.getByText(/need attention/)).toBeVisible();

    await expectNoHorizontalOverflow(page);

    expect(unmocked).toEqual([]);

    await saveShot(page, testInfo, "admin-overview-mobile.png");
  });
});
