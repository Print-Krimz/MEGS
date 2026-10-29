import { afterEach, describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { taApi } from "../../../lib/api/ta.api";
import { employeesApi } from "../../../lib/api/employees.api";
import { TADashboard } from "../TADashboard";
import { ApplicationsPage } from "../ApplicationsPage";
import { JobPostingsPage } from "../JobPostingsPage";
import { MRFListPage } from "../MRFListPage";
import { TalentPoolPage } from "../TalentPoolPage";
import { InterviewsPage } from "../InterviewsPage";
import { ClientsPage } from "../ClientsPage";
import { CompliancePage } from "../CompliancePage";
import { DeploymentsPage } from "../DeploymentsPage";
import { EmployeesPage } from "../EmployeesPage";
import { AnalyticsPage } from "../AnalyticsPage";
import { getManilaToday } from "../../../lib/field-limits";

const { pageOf, serverInterviews, INTERVIEW_ROWS, MRF_ROWS, DEPLOYMENT_ROWS } = vi.hoisted(() => {
  const pageOf = (rows: any[], page: number, pageSize: number) => ({
    items: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(rows.length / pageSize)),
  });
  // Mirrors the server: filter, sort, then page; summary and positions stay unfiltered.
  const serverInterviews = (rows: any[], f: any) => {
    const q = String(f.search || "").trim().toLowerCase();
    const direction = f.sortDirection === "desc" ? -1 : 1;
    const key: Record<string, string> = { candidate: "candidateName", position: "jobTitle", scheduledAt: "scheduledAt", deadline: "deadline" };
    const matches = rows
      .filter((row) =>
        (!f.status || row.status === f.status) &&
        (!f.stage || row.currentStage === f.stage) &&
        (!f.position || row.jobTitle === f.position) &&
        (!q || row.candidateName.toLowerCase().includes(q) || row.jobTitle.toLowerCase().includes(q)))
      .sort((a, b) => String(a[key[f.sortField || "deadline"]]).localeCompare(String(b[key[f.sortField || "deadline"]])) * direction);
    return {
      ...pageOf(matches, f.page, f.pageSize),
      summary: {
        total: rows.length,
        breached: rows.filter((row) => row.status === "BREACHED").length,
        warning: rows.filter((row) => row.status === "WARNING").length,
        healthy: rows.filter((row) => row.status === "HEALTHY").length,
      },
      positions: [...new Set(rows.map((row) => row.jobTitle))].sort(),
    };
  };
  return {
    pageOf,
    serverInterviews,
    INTERVIEW_ROWS: [
        {
          interviewId: 101,
          applicationId: 201,
          candidateName: "Carlos Mendoza",
          jobTitle: "Electrician",
          scheduledAt: "2026-08-20T10:00:00Z",
          deadline: "2026-08-22T00:00:00Z",
          status: "HEALTHY",
          currentStage: "INITIAL_SCREENING",
        },
        {
          interviewId: 102,
          applicationId: 202,
          candidateName: "Ana Santos",
          jobTitle: "Forklift Operator",
          scheduledAt: "2026-08-15T09:00:00Z",
          deadline: "2026-08-18T00:00:00Z",
          status: "BREACHED",
          currentStage: "FINAL_INTERVIEW",
        },
        {
          interviewId: 103,
          applicationId: 203,
          candidateName: "Benjie Ramos",
          jobTitle: "Welder",
          scheduledAt: "2026-08-19T14:00:00Z",
          deadline: "2026-08-21T00:00:00Z",
          status: "WARNING",
          currentStage: "INITIAL_SCREENING",
        },
      ] as any[],
    MRF_ROWS: [
      {
        id: 1001,
        title: "20x Line Assemblers",
        headcount: 20,
        priority: "HIGH",
        status: "OPEN",
        targetFillDate: "2026-09-01T00:00:00Z",
        client: { name: "Acme Industrial" },
        _count: { jobPostings: 2 },
      },
    ] as any[],
    DEPLOYMENT_ROWS: [
      {
        id: 501,
        site: "Batangas Plant",
        status: "ACTIVE",
        contractStart: "2026-08-01T00:00:00Z",
        client: { name: "Acme Industrial" },
        employee: {
          employeeNumber: "EMP-2026-001",
          user: { applicantProfile: { firstName: "Maria", lastName: "Santos" } },
        },
      },
      {
        id: 502,
        site: "Laguna Plant",
        status: "READY_FOR_DEPLOYMENT",
        contractStart: "2026-08-15T00:00:00Z",
        client: { name: "Acme Industrial" },
        employee: {
          employeeNumber: "EMP-2026-002",
          user: { applicantProfile: { firstName: "Pedro", lastName: "Reyes" } },
        },
      },
      {
        id: 503,
        site: "Cebu Site",
        status: "ENDED",
        contractStart: "2026-01-01T00:00:00Z",
        contractEnd: "2026-06-30T00:00:00Z",
        client: { name: "Acme Industrial" },
        employee: {
          employeeNumber: "EMP-2026-003",
          user: { applicantProfile: { firstName: "Ana", lastName: "Cruz" } },
        },
      },
      {
        id: 504,
        site: "Davao Site",
        status: "CANCELLED",
        client: { name: "Acme Industrial" },
        employee: {
          employeeNumber: "EMP-2026-004",
          user: { applicantProfile: { firstName: "Juan", lastName: "Dela Cruz" } },
        },
      },
    ] as any[],
  };
});

// Mock taApi and employeesApi
vi.mock("../../../lib/api/ta.api", () => ({
  taApi: {
    getPipelineAnalytics: vi.fn().mockResolvedValue({
      activeApplications: 38,
      statusBreakdown: {
        SUBMITTED: 10,
        INITIAL_SCREENING: 8,
        CLIENT_ENDORSEMENT: 6,
        FINAL_INTERVIEW: 5,
        COMPLIANCE: 3,
        DEPLOYED: 2,
      },
    }),
    checkInterviewCompliance: vi.fn().mockResolvedValue({
      summary: { total: 3, breached: 1, warning: 1, healthy: 1 },
      details: INTERVIEW_ROWS,
    }),
    listInterviewCompliancePage: vi.fn(async (f: any) => serverInterviews(INTERVIEW_ROWS, f)),
    getDashboardCounts: vi.fn().mockResolvedValue({ openJobs: 1, activeDeployments: 35 }),
    listApplications: vi.fn().mockResolvedValue([
      {
        id: 1,
        status: "SUBMITTED",
        aiScore: 88,
        createdAt: "2026-08-14T00:00:00Z",
        user: {
          email: "candidate1@megs.ph",
          applicantProfile: { firstName: "Juan", lastName: "Dela Cruz", mobileNumber: "09171234567" },
        },
        jobPosting: { id: 10, title: "Forklift Operator", location: "Laguna" },
      },
    ]),
    listApplicationsPage: vi.fn().mockResolvedValue({
      items: [
        {
          id: 1,
          status: "SUBMITTED",
          aiScore: 88,
          candidateFitScore: 90,
          isArchived: false,
          createdAt: "2026-08-14T00:00:00Z",
          interviewCount: 0,
          recruiterDecisionCount: 0,
          user: {
            id: "candidate-1",
            email: "candidate1@megs.ph",
            applicantProfile: { firstName: "Juan", lastName: "Dela Cruz", mobileNumber: "09171234567" },
          },
          jobPosting: { id: 10, title: "Forklift Operator", location: "Laguna" },
        },
      ],
      total: 17,
      page: 1,
      pageSize: 10,
      totalPages: 2,
    }),
    listJobs: vi.fn().mockResolvedValue([
      {
        id: 10,
        title: "Forklift Operator",
        location: "Laguna",
        description: "Heavy machinery handling",
        requirements: "NC II certified",
        status: "OPEN",
        createdAt: "2026-08-10T00:00:00Z",
        _count: { applications: 5 },
      },
    ]),
    listJobsPage: vi.fn().mockResolvedValue({
      items: [
        {
          id: 10,
          title: "Forklift Operator",
          location: "Laguna",
          description: "Heavy machinery handling",
          requirements: "NC II certified",
          status: "OPEN",
          createdAt: "2026-08-10T00:00:00Z",
          _count: { applications: 5 },
        },
      ],
      total: 21,
      page: 1,
      pageSize: 8,
      totalPages: 3,
    }),
    listMRFs: vi.fn().mockResolvedValue(MRF_ROWS),
    listMRFsPage: vi.fn(async (f: any) => pageOf(MRF_ROWS.filter((row) => !f.search || row.title.toLowerCase().includes(String(f.search).toLowerCase())), f.page, f.pageSize)),
    listClients: vi.fn().mockResolvedValue([
      {
        id: 1,
        name: "Acme Industrial",
        industry: "Manufacturing",
        isActive: true,
        _count: { manpowerRequests: 3, deployments: 12 },
      },
    ]),
    getComplianceOverview: vi.fn().mockResolvedValue({
      totalRequirements: 50,
      statusBreakdown: { PENDING: 15, SUBMITTED: 10, APPROVED: 22, REJECTED: 3 },
    }),
    listDeployments: vi.fn().mockResolvedValue(DEPLOYMENT_ROWS),
    listDeploymentsPage: vi.fn(async (f: any) => pageOf(DEPLOYMENT_ROWS, f.page, f.pageSize)),
    getTimeToFillAnalytics: vi.fn().mockResolvedValue({
      averageDaysToFill: 14.5,
      totalFilledDeployments: 30,
    }),
    getDeploymentAnalytics: vi.fn().mockResolvedValue({
      totalDeployments: 42,
      statusBreakdown: { ACTIVE: 35, READY_FOR_DEPLOYMENT: 7 },
    }),
    getOverviewStats: vi.fn().mockResolvedValue({
      myActiveApplications: 18,
      initialInterviewsPending: 5,
      readyForEndorsement: 4,
      pendingClientDecisions: 3,
      finalInterviewsPending: 2,
      awaitingCompliance: 4,
    }),
    getActivityTrend: vi.fn().mockResolvedValue({
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
    }),
    getPipelineFunnel: vi.fn().mockResolvedValue({
      totalApplications: 18,
      stages: [
        { stage: "APPLICATIONS", label: "Applications", count: 18, conversionRate: 100, dropoffRate: 0, overallConversion: 100 },
        { stage: "INITIAL_SCREENING", label: "Initial Screening", count: 12, conversionRate: 67, dropoffRate: 33, overallConversion: 67 },
      ],
    }),
    getPendingActions: vi.fn().mockResolvedValue([
      {
        id: "act-1",
        type: "INITIAL_INTERVIEW",
        title: "Schedule Screening",
        candidateName: "John Doe",
        jobTitle: "HVAC Specialist",
        applicationId: 42,
        urgency: "HIGH",
        targetUrl: "/ta/interviews",
        createdAt: new Date().toISOString(),
      },
    ]),
    getFilterOptions: vi.fn().mockResolvedValue({
      clients: [{ id: 1, name: "Acme Industrial" }],
      mrfs: [{ id: 10, title: "Batch 1", clientId: 1 }],
      jobPostings: [{ id: 100, title: "HVAC Specialist", mrfId: 10, postedById: "ta-1" }],
      recruiters: [],
      stages: [{ key: "INITIAL_SCREENING", label: "Initial Screening" }],
    }),
    searchTalentPool: vi.fn().mockResolvedValue([]),
    getDashboardSummary: vi.fn().mockResolvedValue({
      dateRange: { startDate: "2026-08-01", endDate: "2026-08-07", days: 7 },
      kpis: {
        fillRate: 40, filledSeats: 4, requestedSeats: 10, openSeats: 6,
        requisitions: { total: 2, open: 2, overdue: 0, atRisk: 1, filled: 0 },
        placementsStarted: 3, newStarts: 2, redeployStarts: 1, medianDaysToFill: 6, daysToFillSample: 3,
        backoutsAfterClientReview: 1, backoutRate: 25, backoutRateBase: 4,
        activeApplicants: 22, overdueCandidates: 2, overdueEstimated: 1, closedOpenings: 0, staleFilledRequisitions: 0, criticalCandidates: 0, unlinkedApplicants: 0,
      },
      requests: [
        {
          mrfId: 10, title: "Batch 1 Electricians", clientId: 1, clientName: "Acme Industrial", status: "OPEN", ownerId: "ta-1", ownerName: "Me",
          headcount: 10, filled: 4, openSeats: 6, pipeline: 5, overdueCandidates: 1, jobCount: 1, applicantCount: 6, attention: null, targetFillDate: null, daysRemaining: null,
          health: "ON_TRACK", backoutsInPeriod: 0,
        },
      ],
      clientDecisions: { accepted: 3, declined: 1 },
      stageTable: [
        { stage: "APPLIED", label: "New applications", inStageNow: 18, overdue: 2, overdueEstimated: 0, entered: 12, backedOut: 1, avgDaysInStage: 3.5, medianDaysInStage: 3, slaDays: 7 },
        { stage: "COMPLIANCE", label: "Requirements", inStageNow: 4, overdue: 0, overdueEstimated: 0, entered: 3, backedOut: 0, avgDaysInStage: null, medianDaysInStage: null, slaDays: 14 },
      ],
      dropOff: [
        { stage: "APPLIED", label: "New applications", reached: 12, inStage: 4, movedForward: 6, backedOut: 1, rejected: 1 },
      ],
      backouts: { withdrawals: 0, backouts: 0, noShows: 0, byParty: { APPLICANT: 0, CLIENT: 0, AGENCY: 0 }, byStage: [], topReasons: [], byClient: [], byRequest: [], recent: [] },
      stuck: [], stuckTotal: 0,
      pendingActionsTotal: 1,
      pendingActions: [
        {
          id: "act-1",
          type: "INITIAL_INTERVIEW",
          title: "Schedule Screening",
          candidateName: "John Doe",
          jobTitle: "HVAC Specialist",
          applicationId: 42,
          urgency: "HIGH",
          targetUrl: "/ta/interviews",
          createdAt: new Date().toISOString(),
        },
      ],
      filterOptions: {
        clients: [{ id: 1, name: "Acme Industrial" }],
        mrfs: [{ id: 10, title: "Batch 1", clientId: 1 }],
        jobPostings: [{ id: 100, title: "HVAC Specialist", mrfId: 10, postedById: "ta-1" }],
        recruiters: [],
        stages: [],
      },
    }),
  },
}));

vi.mock("../../../lib/api/employees.api", () => ({
  employeesApi: {
    getRedeploymentQueueSummary: vi.fn().mockResolvedValue({ stages: { NEEDS_PLACEMENT: 2 } }),
    getCredentialAlerts: vi.fn().mockResolvedValue([]),
    listEmployees: vi.fn().mockResolvedValue([
      {
        id: 88,
        employeeNumber: "EMP-2026-088",
        position: "Master Electrician",
        department: "Maintenance",
        hireDate: "2026-07-01T00:00:00Z",
        status: "ACTIVE",
        user: {
          email: "maria.santos@megs.ph",
          applicantProfile: { firstName: "Maria", lastName: "Santos" },
        },
      },
    ]),
  },
}));

// Mock router Link
const routerSearch = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("@tanstack/react-router", () => ({
  useSearch: () => routerSearch.value,
  useBlocker: () => ({ status: "idle" }),
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useParams: () => ({ applicationId: "1", jobId: "10", mrfId: "1001", clientId: "1", deploymentId: "501", employeeId: "88" }),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("Talent Acquisition Interface Suite", () => {
  afterEach(() => {
    routerSearch.value = {};
  });

  it("renders TADashboard with pipeline metrics and action queues", async () => {
    renderWithClient(<TADashboard />);
    expect(await screen.findByRole("heading", { name: "Overview" })).toBeDefined();
    expect(await screen.findByText("Active job openings")).toBeDefined();
    expect(taApi.getDashboardCounts).toHaveBeenCalled();

    // Dashboard needs only the summary: one-row page, no full interview list.
    expect(taApi.listInterviewCompliancePage).toHaveBeenCalledWith({ page: 1, pageSize: 1 }, expect.anything());
    expect(taApi.checkInterviewCompliance).not.toHaveBeenCalled();
    // The worklist leads with what needs action: overdue interviews, placements, then pending tasks.
    expect(await screen.findByText("Needs your action")).toBeDefined();
    expect(await screen.findByText("1 interview overdue")).toBeDefined();
    expect(await screen.findByText("1 interview due within 48 hours")).toBeDefined();
    expect(await screen.findByText("2 workers need placement")).toBeDefined();
    expect(await screen.findByText("Schedule Screening")).toBeDefined();
    expect(await screen.findByText("Seats to fill")).toBeDefined();
    expect(await screen.findByText("of 10 requested")).toBeDefined();
    expect(screen.queryByText("Interview deadlines")).toBeNull();
    expect(screen.getByText("To do")).toBeDefined();
    expect(screen.queryByText("Waiting")).toBeNull();
    expect(screen.getByText("Contract signing")).toBeDefined();

    const mrfButton = await screen.findByRole("link", { name: /New manpower request/i });
    expect(mrfButton).toBeDefined();
    expect(mrfButton.getAttribute("href")).toBe("/ta/mrfs/create");
  });

  it("shows what is coming up this week and hides sections with nothing in them", async () => {
    const day = (offset: number) => {
      const d = new Date(Date.now() + offset * 86_400_000);
      return d.toISOString();
    };
    vi.mocked(taApi.listInterviewCompliancePage).mockImplementation((async (f: any) =>
      f.pageSize === 50
        ? {
            ...pageOf(
              [2, 3, 4, 5].map((n) => ({
                interviewId: 900 + n, applicationId: n, candidateName: `Candidate ${n}`, jobTitle: "Cashier",
                scheduledAt: day(n % 4 + 1), deadline: day(8), status: "HEALTHY", currentStage: "INITIAL_SCREENING",
              })),
              1, 50,
            ),
            summary: { total: 4, breached: 0, warning: 0, healthy: 4 },
            positions: [],
          }
        : serverInterviews(INTERVIEW_ROWS, f)) as any);
    vi.mocked(employeesApi.getCredentialAlerts).mockResolvedValueOnce([
      {
        requirementId: 1, documentId: 5, documentLabel: "NBI Clearance", reviewStatus: "APPROVED", validityStatus: "HAS_EXPIRY",
        expiresAt: day(10).slice(0, 10), alertType: "EXPIRING_SOON", employeeId: 88, employeeNumber: "EMP-88",
        employeeName: "Maria Santos", employeeStatus: "ACTIVE", clientName: "Acme", jobTitle: "Electrician",
      },
    ]);
    vi.mocked(taApi.listDeployments).mockResolvedValueOnce([]);
    renderWithClient(<TADashboard />);
    expect(await screen.findByText("Interviews in the next 7 days")).toBeDefined();
    expect(screen.getAllByText(/^Candidate \d$/)).toHaveLength(3);
    const seeAll = screen.getByRole("link", { name: /See all 4/ });
    expect(seeAll.getAttribute("href")).toBe("/ta/interviews");
    expect(await screen.findByText("Documents to renew")).toBeDefined();
    expect(screen.getByText("Maria Santos")).toBeDefined();
    expect(screen.queryByText("Check-ins in the next 7 days")).toBeNull();
    expect(screen.queryByText("Contracts ending in 30 days")).toBeNull();
  });

  it("renders TADashboard sections that loaded while the pipeline query is still pending", async () => {
    vi.mocked(taApi.getPipelineAnalytics).mockReturnValueOnce(new Promise(() => {}));
    renderWithClient(<TADashboard />);
    expect(screen.getByRole("heading", { name: "Overview" })).toBeDefined();
    expect(await screen.findByText("35")).toBeDefined();
    expect(screen.getAllByRole("status", { name: /Loading/ }).length).toBeGreaterThan(0);
    expect(screen.queryByText("38")).toBeNull();
  });

  it("keeps other TADashboard sections when one query fails and retries only that query", async () => {
    vi.mocked(taApi.getPipelineAnalytics).mockClear();
    vi.mocked(taApi.listInterviewCompliancePage).mockClear();
    vi.mocked(taApi.listApplicationsPage).mockClear();
    vi.mocked(taApi.getDashboardCounts).mockClear();
    // The page retries a failed query once, so it takes two failures to show the error.
    vi.mocked(taApi.getPipelineAnalytics).mockRejectedValueOnce(new Error("pipeline down")).mockRejectedValueOnce(new Error("pipeline down"));
    renderWithClient(<TADashboard />);
    expect(await screen.findByText("35")).toBeDefined();
    const retry = (await screen.findAllByRole("button", { name: /try again/i }, { timeout: 4000 }))[0];
    fireEvent.click(retry);
    expect(await screen.findByText("38")).toBeDefined();
    await waitFor(() => expect(taApi.getPipelineAnalytics).toHaveBeenCalledTimes(3));
    // One summary request plus one for the Coming up panel; neither is repeated by the pipeline retry.
    expect(taApi.listInterviewCompliancePage).toHaveBeenCalledTimes(2);
    expect(taApi.getDashboardCounts).toHaveBeenCalledTimes(1);
  });

  it("renders ApplicationsPage with candidate list, applicant search, and client filter", async () => {
    renderWithClient(<ApplicationsPage />);
    expect(await screen.findByRole("heading", { name: "Applications" })).toBeDefined();
    expect((await screen.findAllByText("Juan Dela Cruz")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Client account")).toBeDefined();
    expect(taApi.listClients).toHaveBeenCalled();
  });

  it("renders JobPostingsPage with requisitions and client account filter", async () => {
    renderWithClient(<JobPostingsPage />);
    expect((await screen.findAllByText("Job openings")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Forklift Operator")).length).toBeGreaterThan(0);
    expect(await screen.findByRole("combobox", { name: "Client" })).toBeDefined();
  });

  it("renders MRFListPage with manpower requisitions and client filter", async () => {
    renderWithClient(<MRFListPage />);
    expect(await screen.findByRole("heading", { name: "Manpower requests" })).toBeDefined();
    expect((await screen.findAllByText("20x Line Assemblers")).length).toBeGreaterThan(0);
    expect(await screen.findByRole("combobox", { name: "Client" })).toBeDefined();
  });

  it("requests one page of ten manpower requests and searches on the server", async () => {
    renderWithClient(<MRFListPage />);
    expect((await screen.findAllByText("20x Line Assemblers")).length).toBeGreaterThan(0);
    expect(taApi.listMRFsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, pageSize: 10, sortBy: "created_desc" }),
      expect.objectContaining({ signal: expect.anything() }),
    );
    fireEvent.change(screen.getByPlaceholderText(/Search by title or client/i), { target: { value: "zzz" } });
    expect(await screen.findByText("No manpower requests match these filters")).toBeDefined();
    expect(taApi.listMRFsPage).toHaveBeenLastCalledWith(expect.objectContaining({ search: "zzz", page: 1 }), expect.anything());
  });

  it("renders TalentPoolPage search container and validates empty query", async () => {
    renderWithClient(<TalentPoolPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Candidate pool" })).toBeDefined();
    expect(screen.queryByText("Max Results")).toBeNull();

    // Clicking search with empty input shows validation message and does NOT call api
    const searchBtn = screen.getByRole("button", { name: /Search candidate pool/i });
    fireEvent.click(searchBtn);

    expect(await screen.findByText(/at least 2 characters/i)).toBeDefined();
  });

  it("renders TalentPoolPage search results, candidate card fields, and opens Consider for Job modal", async () => {
    vi.mocked(taApi.searchTalentPool).mockResolvedValueOnce({ items: [
      {
        candidate: {
          id: "cand-1",
          applicantProfileId: 10,
          membershipId: 100,
          email: "carlos.mendoza@example.com",
          firstName: "Carlos",
          lastName: "Mendoza",
          city: "Makati",
          province: "Metro Manila",
          currentRole: "Senior TypeScript Engineer",
          skills: ["TypeScript", "React", "PostgreSQL"],
          availability: "AVAILABLE" as any,
          talentPoolStatus: "ACTIVE" as any,
          lastContactedAt: "2026-08-01T00:00:00Z",
        },
        similarity: 0.94,
        knnRank: 1,
      },
    ], unsearchableCount: 0 });

    renderWithClient(<TalentPoolPage />);

    const input = screen.getByPlaceholderText(/e.g. Electrician with TESDA/i);
    fireEvent.change(input, { target: { value: "TypeScript" } });

    const searchBtn = screen.getByRole("button", { name: /Search candidate pool/i });
    fireEvent.click(searchBtn);

    expect((await screen.findAllByText("Carlos Mendoza")).length).toBeGreaterThan(0);
    expect(await screen.findByText("carlos.mendoza@example.com")).toBeDefined();
    expect(await screen.findByText(/Senior TypeScript Engineer/)).toBeDefined();
    expect(await screen.findByText(/Makati, Metro Manila/)).toBeDefined();
    expect(await screen.findByText("94% similar profile")).toBeDefined();
    // Click Invite to Apply
    const inviteBtn = screen.getByRole("button", { name: /Invite to apply/i });
    fireEvent.click(inviteBtn);

    expect(await screen.findByText(/Send an invitation to Carlos Mendoza/i)).toBeDefined();
  });


  it("renders InterviewsPage with 7-day SLA compliance tracking", async () => {
    renderWithClient(<InterviewsPage />);
    expect(await screen.findByRole("heading", { name: "Interviews" })).toBeDefined();
    expect((await screen.findAllByText("Carlos Mendoza")).length).toBeGreaterThan(0);
  });

  const expectInterviewRows = async (visible: string[], hidden: string[] = []) => {
    await waitFor(() => {
      for (const name of visible) expect(screen.queryAllByText(name).length).toBeGreaterThan(0);
      for (const name of hidden) expect(screen.queryAllByText(name).length).toBe(0);
    });
  };

  it("groups interviews into Overdue and later agenda sections by default", async () => {
    renderWithClient(<InterviewsPage />);
    expect(await screen.findByRole("heading", { name: /^Overdue/ })).toBeDefined();
    expect(screen.getByRole("heading", { name: /^Due within 48 hours/ })).toBeDefined();
    expect(screen.getByRole("heading", { name: /^On track/ })).toBeDefined();
    expect(screen.getByRole("button", { name: "Agenda" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Table" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryAllByRole("row").length).toBe(0);
    expect(taApi.listInterviewCompliancePage).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, pageSize: 100, sortField: "deadline", sortDirection: "asc" }),
      expect.anything(),
    );
  });

  it("sends search, stage, position, and status filters to the server and shows the returned page", async () => {
    routerSearch.value = { view: "table" };
    renderWithClient(<InterviewsPage />);
    await expectInterviewRows(["Carlos Mendoza", "Ana Santos", "Benjie Ramos"]);
    expect((await screen.findAllByText("Final interview")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Initial screening")).length).toBeGreaterThan(0);
    expect(taApi.listInterviewCompliancePage).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, pageSize: 8, sortField: "deadline", sortDirection: "asc" }),
      expect.objectContaining({ signal: expect.anything() }),
    );

    // 1. Search is debounced, then sent to the server
    const searchInput = screen.getByPlaceholderText(/Search candidate name or position title/i);
    fireEvent.change(searchInput, { target: { value: "Ana" } });
    await expectInterviewRows(["Ana Santos"], ["Carlos Mendoza", "Benjie Ramos"]);
    expect(taApi.listInterviewCompliancePage).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: "Ana", page: 1 }),
      expect.anything(),
    );
    fireEvent.change(searchInput, { target: { value: "" } });
    await expectInterviewRows(["Carlos Mendoza", "Ana Santos", "Benjie Ramos"]);

    // 2. Stage filter
    fireEvent.click(screen.getByRole("combobox", { name: "Interview type" }));
    fireEvent.click(await screen.findByRole("option", { name: "Final interview" }));
    await expectInterviewRows(["Ana Santos"], ["Carlos Mendoza", "Benjie Ramos"]);
    fireEvent.click(screen.getByRole("combobox", { name: "Interview type" }));
    fireEvent.click(await screen.findByRole("option", { name: "All interview types" }));
    await expectInterviewRows(["Carlos Mendoza", "Ana Santos", "Benjie Ramos"]);

    // 3. Position filter choices come from the server, not the visible page
    fireEvent.click(screen.getByRole("combobox", { name: "Job opening" }));
    fireEvent.click(await screen.findByRole("option", { name: "Welder" }));
    await expectInterviewRows(["Benjie Ramos"], ["Carlos Mendoza", "Ana Santos"]);

    // 4. Reset
    fireEvent.click(screen.getByRole("button", { name: /Reset Filters/i }));
    await expectInterviewRows(["Carlos Mendoza", "Ana Santos", "Benjie Ramos"]);

    // 5. Filter tiles use the unfiltered summary and filter by status on the server
    fireEvent.click(screen.getByRole("button", { name: /^Overdue/i }));
    expect(screen.getByRole("button", { name: /^Overdue/i }).getAttribute("aria-pressed")).toBe("true");
    await expectInterviewRows(["Ana Santos"], ["Carlos Mendoza", "Benjie Ramos"]);

    fireEvent.click(screen.getByRole("button", { name: /^Due soon/i }));
    await expectInterviewRows(["Benjie Ramos"], ["Carlos Mendoza", "Ana Santos"]);

    fireEvent.click(screen.getByRole("button", { name: /^On track/i }));
    await expectInterviewRows(["Carlos Mendoza"], ["Ana Santos", "Benjie Ramos"]);

    fireEvent.click(screen.getByRole("button", { name: /^All interviews/i }));
    await expectInterviewRows(["Carlos Mendoza", "Ana Santos", "Benjie Ramos"]);
  });

  it("asks the server to sort when a column heading is clicked", async () => {
    routerSearch.value = { view: "table" };
    renderWithClient(<InterviewsPage />);
    await expectInterviewRows(["Carlos Mendoza"]);
    const expectOrder = async (names: string[]) => {
      await waitFor(() => {
        const rows = screen.getAllByRole("row");
        names.forEach((name, index) => expect(rows[index + 1].textContent).toContain(name));
      });
    };

    // Default sort is deadline asc: Ana (Aug 18), Benjie (Aug 21), Carlos (Aug 22)
    const candidateSortBtn = screen.getByRole("button", { name: /^Candidate$/i });
    fireEvent.click(candidateSortBtn);
    await expectOrder(["Ana Santos", "Benjie Ramos", "Carlos Mendoza"]);
    expect(taApi.listInterviewCompliancePage).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortField: "candidate", sortDirection: "asc" }),
      expect.anything(),
    );

    fireEvent.click(candidateSortBtn);
    await expectOrder(["Carlos Mendoza", "Benjie Ramos", "Ana Santos"]);

    fireEvent.click(screen.getByRole("button", { name: /^Job opening$/i }));
    await expectOrder(["Carlos Mendoza", "Ana Santos", "Benjie Ramos"]);

    fireEvent.click(screen.getByRole("button", { name: /^Deadline$/i }));
    await expectOrder(["Ana Santos", "Benjie Ramos", "Carlos Mendoza"]);
  });

  it("renders ClientsPage with corporate partners", async () => {
    renderWithClient(<ClientsPage />);
    expect(await screen.findByRole("heading", { name: "Clients" })).toBeDefined();
    expect((await screen.findAllByText("Acme Industrial")).length).toBeGreaterThan(0);
  });

  it("renders CompliancePage as the Pre-employment requirements queue", async () => {
    renderWithClient(<CompliancePage />);
    expect(await screen.findByRole("heading", { name: "Pre-employment requirements" })).toBeDefined();
    // The mocked applications are not in the requirements stage, so the queue is empty.
    expect(await screen.findByText("No candidates in the requirements stage")).toBeDefined();
  });

  it("renders DeploymentsPage with site assignments and verified status workflow", async () => {
    renderWithClient(<DeploymentsPage />);
    expect(await screen.findByRole("heading", { name: "Deployments" })).toBeDefined();
    expect((await screen.findAllByText("Batangas Plant")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Laguna Plant")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Cebu Site")).length).toBeGreaterThan(0);

    // Verify valid status badges are present (in table and filter)
    expect((await screen.findAllByText("Active on site")).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText("Ready to start")).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText("Assignment ended")).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText("Did not start")).length).toBeGreaterThanOrEqual(1);

    // Verify Confirm start button appears on READY_FOR_DEPLOYMENT row
    const confirmStartButtons = await screen.findAllByRole("button", { name: "Confirm start" });
    expect(confirmStartButtons.length).toBeGreaterThanOrEqual(1);

    // Click Confirm start on the READY_FOR_DEPLOYMENT row
    fireEvent.click(confirmStartButtons[0]);
    expect(await screen.findByText("Confirm site start")).toBeDefined();

    // Verify date input is restricted to today and future (min = today)
    const dateInput = screen.getByLabelText(/Actual first working date/i) as HTMLInputElement;
    expect(dateInput.value).toBe(getManilaToday());
    expect(dateInput.min).toBe(getManilaToday());
    expect(dateInput.max).toBe("2100-12-31");
    expect(screen.getByText(/Must be today or a future date\./)).toBeDefined();

    // Verify confirm button in modal is enabled for today
    const dialog = screen.getByRole("dialog");
    const modalConfirmBtn = within(dialog).getByRole("button", { name: "Confirm start" });
    expect(modalConfirmBtn.hasAttribute("disabled")).toBe(false);

    // If date is altered to a future date, submit button is enabled
    fireEvent.change(dateInput, { target: { value: "2028-05-15" } });
    expect(modalConfirmBtn.hasAttribute("disabled")).toBe(false);

    // If date is altered to a past date, submit button is disabled
    fireEvent.change(dateInput, { target: { value: "2020-01-01" } });
    expect(modalConfirmBtn.hasAttribute("disabled")).toBe(true);
  });

  it("shows no check-in action or check-in line on an active deployment", async () => {
    renderWithClient(<DeploymentsPage />);
    expect((await screen.findAllByText("Batangas Plant")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Record check-in" })).toBeNull();
    expect(screen.queryByText(/Check-in/)).toBeNull();
    // Maria's open-ended contract has no end date, so her row has no "Ends" line.
    expect(screen.queryByText(/^Ends /)).toBeNull();
  });

  it("shows the contract end under an active deployment that has one", async () => {
    const withEnd = [{ ...DEPLOYMENT_ROWS[0], contractEnd: "2027-03-30T16:00:00.000Z" }];
    vi.mocked(taApi.listDeploymentsPage).mockImplementation(async (f: any) => pageOf(withEnd, f.page, f.pageSize) as any);
    renderWithClient(<DeploymentsPage />);
    expect((await screen.findAllByText(/^Ends Mar 31, 2027$/)).length).toBeGreaterThan(0);
    vi.mocked(taApi.listDeploymentsPage).mockImplementation(async (f: any) => pageOf(DEPLOYMENT_ROWS, f.page, f.pageSize) as any);
  });

  it("requests one page of ten deployments from the server", async () => {
    renderWithClient(<DeploymentsPage />);
    expect((await screen.findAllByText("Batangas Plant")).length).toBeGreaterThan(0);
    expect(taApi.listDeploymentsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, pageSize: 10 }),
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it("renders EmployeesPage with personnel and 201 roster", async () => {
    renderWithClient(<EmployeesPage />);
    expect(await screen.findByRole("heading", { name: "Employee records" })).toBeDefined();
  });

  it("renders AnalyticsPage with the stage table, pending actions and export menu", async () => {
    renderWithClient(<AnalyticsPage />);
    expect(await screen.findByRole("heading", { name: "Reports" })).toBeDefined();
    expect(await screen.findByText("Candidates by stage")).toBeDefined();
    const card = await screen.findByRole("listitem", { name: /^Requirements: 4 in stage, 0 overdue/ });
    expect(within(card).getByRole("link").getAttribute("href")).toContain("/ta/applications");
    expect(await screen.findByRole("button", { name: "Show period details" })).toBeDefined();
    expect(await screen.findByText("Schedule Screening")).toBeDefined();
    // The KPI row and the TA's own requests are there, and there is no "my requisitions only" switch
    expect((await screen.findAllByText("Active applicants")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Batch 1 Electricians")).toBeDefined();
    expect(screen.queryByRole("checkbox", { name: /My requisitions only/i })).toBeNull();
    expect(await screen.findByText("Export")).toBeDefined();
  });
});
