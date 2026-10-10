import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { taApi } from "../../../lib/api/ta.api";
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

// Mock taApi and employeesApi
vi.mock("../../../lib/api/ta.api", () => ({
  taApi: {
    getPipelineAnalytics: vi.fn().mockResolvedValue({
      totalApplications: 45,
      activeApplications: 38,
      archivedApplications: 7,
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
      details: [
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
      ],
    }),
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
    listMRFs: vi.fn().mockResolvedValue([
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
    ]),
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
    listDeployments: vi.fn().mockResolvedValue([
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
    ]),
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
      overview: {
        myActiveApplications: 18,
        initialInterviewsPending: 5,
        readyForEndorsement: 4,
        pendingClientDecisions: 3,
        finalInterviewsPending: 2,
        awaitingCompliance: 4,
      },
      activity: {
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
      },
      funnel: {
        totalApplications: 18,
        stages: [
          { stage: "APPLICATIONS", label: "Applications", count: 18, conversionRate: 100, dropoffRate: 0, overallConversion: 100 },
          { stage: "INITIAL_SCREENING", label: "Initial Screening", count: 12, conversionRate: 67, dropoffRate: 33, overallConversion: 67 },
        ],
      },
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
        stages: [{ key: "INITIAL_SCREENING", label: "Initial Screening" }],
      },
    }),
  },
}));

vi.mock("../../../lib/api/employees.api", () => ({
  employeesApi: {
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
vi.mock("@tanstack/react-router", () => ({
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
  it("renders TADashboard with pipeline metrics and action queues", async () => {
    renderWithClient(<TADashboard />);
    expect(await screen.findByText("Recruitment overview")).toBeDefined();
    expect((await screen.findAllByText("Forklift Operator")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Juan Dela Cruz")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Active Job Openings")).toBeDefined();
    expect(taApi.getDashboardCounts).toHaveBeenCalled();


    const mrfButton = await screen.findByRole("link", { name: /New manpower request/i });
    expect(mrfButton).toBeDefined();
    expect(mrfButton.getAttribute("href")).toBe("/ta/mrfs/create");
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
    expect(await screen.findByText("Job openings")).toBeDefined();
    expect((await screen.findAllByText("Forklift Operator")).length).toBeGreaterThan(0);
    expect(await screen.findByRole("combobox", { name: "Client" })).toBeDefined();
  });

  it("renders MRFListPage with manpower requisitions and client filter", async () => {
    renderWithClient(<MRFListPage />);
    expect(await screen.findByRole("heading", { name: "Manpower Requests (MRF)" })).toBeDefined();
    expect(await screen.findByText("20x Line Assemblers")).toBeDefined();
    expect(await screen.findByRole("combobox", { name: "Client" })).toBeDefined();
  });

  it("renders TalentPoolPage search container and validates empty query", async () => {
    renderWithClient(<TalentPoolPage />);
    expect(await screen.findByText("Candidate Pool")).toBeDefined();
    expect(screen.queryByText("Max Results")).toBeNull();

    // Clicking search with empty input shows validation message and does NOT call api
    const searchBtn = screen.getByRole("button", { name: /Search candidate pool/i });
    fireEvent.click(searchBtn);

    expect(await screen.findByText(/at least 2 search characters/i)).toBeDefined();
  });

  it("renders TalentPoolPage search results, candidate card fields, and opens Consider for Job modal", async () => {
    vi.mocked(taApi.searchTalentPool).mockResolvedValueOnce([
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
    ]);

    renderWithClient(<TalentPoolPage />);

    const input = screen.getByPlaceholderText(/e.g. Electrician with TESDA/i);
    fireEvent.change(input, { target: { value: "TypeScript" } });

    const searchBtn = screen.getByRole("button", { name: /Search candidate pool/i });
    fireEvent.click(searchBtn);

    expect((await screen.findAllByText("Carlos Mendoza")).length).toBeGreaterThan(0);
    expect(await screen.findByText("carlos.mendoza@example.com")).toBeDefined();
    expect(await screen.findByText("Senior TypeScript Engineer")).toBeDefined();
    expect(await screen.findByText("Makati, Metro Manila")).toBeDefined();
    expect(await screen.findByText("94% Match")).toBeDefined();
    // Click Invite to Apply
    const inviteBtn = screen.getByRole("button", { name: /Invite to apply/i });
    fireEvent.click(inviteBtn);

    expect(await screen.findByText("Invite candidate to apply")).toBeDefined();
    expect(await screen.findByText(/Send an invitation to Carlos Mendoza/i)).toBeDefined();
  });


  it("renders InterviewsPage with 7-day SLA compliance tracking", async () => {
    renderWithClient(<InterviewsPage />);
    expect(await screen.findByText("Interview schedule")).toBeDefined();
    expect((await screen.findAllByText("Carlos Mendoza")).length).toBeGreaterThan(0);
  });

  it("supports multi-criteria filtering by search, stage, position, and status metric cards", async () => {
    renderWithClient(<InterviewsPage />);
    expect((await screen.findAllByText("Carlos Mendoza")).length).toBeGreaterThan(0);

    // Verify all 3 candidates initially rendered
    expect((await screen.findAllByText("Carlos Mendoza")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Ana Santos")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Benjie Ramos")).length).toBeGreaterThan(0);

    // Verify Interview Type badges
    expect((await screen.findAllByText("Final Interview")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Initial Screening")).length).toBeGreaterThan(0);

    // 1. Search filter (filter by candidate name or position title)
    const searchInput = screen.getByPlaceholderText(/Search candidate name or position title/i);
    fireEvent.change(searchInput, { target: { value: "Ana" } });
    expect(screen.getAllByText("Ana Santos").length).toBeGreaterThan(0);
    expect(screen.queryByText("Carlos Mendoza")).toBeNull();
    expect(screen.queryByText("Benjie Ramos")).toBeNull();

    // Reset search
    fireEvent.change(searchInput, { target: { value: "" } });
    expect(screen.getAllByText("Carlos Mendoza").length).toBeGreaterThan(0);

    // 2. Stage filter (FINAL_INTERVIEW)
    const stageSelect = screen.getByLabelText("Interview Stage");
    fireEvent.change(stageSelect, { target: { value: "FINAL_INTERVIEW" } });
    expect(screen.getAllByText("Ana Santos").length).toBeGreaterThan(0);
    expect(screen.queryByText("Carlos Mendoza")).toBeNull();
    expect(screen.queryByText("Benjie Ramos")).toBeNull();

    // Reset stage filter
    fireEvent.change(stageSelect, { target: { value: "" } });
    expect(screen.getAllByText("Carlos Mendoza").length).toBeGreaterThan(0);

    // 3. Position filter (dynamically derived unique job titles)
    const positionSelect = screen.getByLabelText("Target Position");
    fireEvent.change(positionSelect, { target: { value: "Welder" } });
    expect(screen.getAllByText("Benjie Ramos").length).toBeGreaterThan(0);
    expect(screen.queryByText("Carlos Mendoza")).toBeNull();
    expect(screen.queryByText("Ana Santos")).toBeNull();

    // 4. Reset Filters button appears and resets all filters
    const resetFiltersBtn = screen.getByRole("button", { name: /Reset Filters/i });
    fireEvent.click(resetFiltersBtn);
    expect(screen.getAllByText("Carlos Mendoza").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ana Santos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Benjie Ramos").length).toBeGreaterThan(0);

    // 5. Metric card click (Overdue / BREACHED)
    const overdueCard = screen.getByRole("button", { name: /Overdue interviews/i });
    fireEvent.click(overdueCard);
    expect(await screen.findByRole("heading", { name: "Overdue interviews" })).toBeDefined();
    expect(screen.getByText("Applications exceeding the 7-day SLA deadline")).toBeDefined();
    expect(screen.getAllByText("Ana Santos").length).toBeGreaterThan(0);
    expect(screen.queryByText("Carlos Mendoza")).toBeNull();
    expect(screen.queryByText("Benjie Ramos")).toBeNull();

    // 6. Metric card click (Due within 48 hours / WARNING)
    const warningCard = screen.getByRole("button", { name: /Due within 48 hours/i });
    fireEvent.click(warningCard);
    expect(await screen.findByRole("heading", { name: "Interviews due soon" })).toBeDefined();
    expect(screen.getByText("Outcome needed within 48 hours")).toBeDefined();
    expect(screen.getAllByText("Benjie Ramos").length).toBeGreaterThan(0);
    expect(screen.queryByText("Carlos Mendoza")).toBeNull();
    expect(screen.queryByText("Ana Santos")).toBeNull();

    // 7. Metric card click (On track / HEALTHY)
    const healthyCard = screen.getByRole("button", { name: /On track/i });
    fireEvent.click(healthyCard);
    expect(await screen.findByRole("heading", { name: "On-track interviews" })).toBeDefined();
    expect(screen.getByText("Deadlines within target limits")).toBeDefined();
    expect(screen.getAllByText("Carlos Mendoza").length).toBeGreaterThan(0);
    expect(screen.queryByText("Ana Santos")).toBeNull();
    expect(screen.queryByText("Benjie Ramos")).toBeNull();

    // 8. Metric card click (Scheduled interviews / ALL)
    const allCard = screen.getByRole("button", { name: /Scheduled interviews/i });
    fireEvent.click(allCard);
    expect(await screen.findByRole("heading", { name: "Interviews needing attention" })).toBeDefined();
    expect(screen.getByText("Applications that need an interviewer response before the 7-day deadline")).toBeDefined();
    expect(screen.getAllByText("Carlos Mendoza").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ana Santos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Benjie Ramos").length).toBeGreaterThan(0);
  });

  it("supports interactive column sorting on Candidate, Position, Scheduled Date, and Deadline", async () => {
    renderWithClient(<InterviewsPage />);
    expect((await screen.findAllByText("Carlos Mendoza")).length).toBeGreaterThan(0);

    // Default sort is deadline asc:
    // Ana Santos (2026-08-18), Benjie Ramos (2026-08-21), Carlos Mendoza (2026-08-22)
    const candidateSortBtn = screen.getByRole("button", { name: /^Candidate$/i });
    fireEvent.click(candidateSortBtn); // Sort by candidate asc: Ana, Benjie, Carlos
    
    let rows = screen.getAllByRole("row");
    // Row 0 is thead, Row 1 is first tbody row
    expect(rows[1].textContent).toContain("Ana Santos");
    expect(rows[2].textContent).toContain("Benjie Ramos");
    expect(rows[3].textContent).toContain("Carlos Mendoza");

    fireEvent.click(candidateSortBtn); // Sort by candidate desc: Carlos, Benjie, Ana
    rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("Carlos Mendoza");
    expect(rows[2].textContent).toContain("Benjie Ramos");
    expect(rows[3].textContent).toContain("Ana Santos");

    // Sort by Target Position asc: Electrician (Carlos), Forklift Operator (Ana), Welder (Benjie)
    const positionSortBtn = screen.getByRole("button", { name: /^Target Position$/i });
    fireEvent.click(positionSortBtn);
    rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("Carlos Mendoza");
    expect(rows[2].textContent).toContain("Ana Santos");
    expect(rows[3].textContent).toContain("Benjie Ramos");

    // Sort by Deadline asc: Ana (Aug 18), Benjie (Aug 21), Carlos (Aug 22)
    const deadlineSortBtn = screen.getByRole("button", { name: /^Deadline$/i });
    fireEvent.click(deadlineSortBtn);
    rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("Ana Santos");
    expect(rows[2].textContent).toContain("Benjie Ramos");
    expect(rows[3].textContent).toContain("Carlos Mendoza");
  });

  it("renders ClientsPage with corporate partners", async () => {
    renderWithClient(<ClientsPage />);
    expect(await screen.findByRole("heading", { name: "Clients" })).toBeDefined();
    expect(await screen.findByText("Acme Industrial")).toBeDefined();
  });

  it("renders CompliancePage with 201 clearance overview", async () => {
    renderWithClient(<CompliancePage />);
    expect(await screen.findByText("Pre-employment requirements")).toBeDefined();
    expect(await screen.findByText("Candidates in compliance")).toBeDefined();
  });

  it("renders DeploymentsPage with site assignments and verified status workflow", async () => {
    renderWithClient(<DeploymentsPage />);
    expect(await screen.findByText("Site deployments")).toBeDefined();
    expect((await screen.findAllByText("Batangas Plant")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Laguna Plant")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Cebu Site")).length).toBeGreaterThan(0);

    // Verify valid status badges are present (in table and filter)
    expect((await screen.findAllByText("Active on Site")).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText("Scheduled for Site")).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText("Assignment Ended")).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText("Did Not Start")).length).toBeGreaterThanOrEqual(1);

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
    expect(screen.getByText("Must be today or a future date.")).toBeDefined();

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

  it("renders EmployeesPage with personnel and 201 roster", async () => {
    renderWithClient(<EmployeesPage />);
    expect(await screen.findByText("Employee records (201)")).toBeDefined();
  });

  it("renders AnalyticsPage with personal workload and activity reports", async () => {
    renderWithClient(<AnalyticsPage />);
    expect(await screen.findByText("Recruitment reports")).toBeDefined();
    expect(await screen.findByText("Track active candidate stages, overdue reviews, and daily recruitment activity")).toBeDefined();
    expect(await screen.findByText("Recruitment activity")).toBeDefined();
    expect(await screen.findByText("Export reports")).toBeDefined();
  });
});
