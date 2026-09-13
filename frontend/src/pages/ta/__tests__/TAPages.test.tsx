import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
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
      summary: { total: 12, breached: 1, warning: 2, healthy: 9 },
      details: [
        {
          interviewId: 101,
          applicationId: 201,
          candidateName: "Carlos Mendoza",
          jobTitle: "Electrician",
          scheduledAt: "2026-08-20T10:00:00Z",
          deadline: "2026-08-22T00:00:00Z",
          status: "HEALTHY",
        },
      ],
    }),
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
    expect(await screen.findByText("Forklift Operator")).toBeDefined();
    expect(await screen.findByText("Juan Dela Cruz")).toBeDefined();
    expect(await screen.findByText("Active Job Postings")).toBeDefined();

    const mrfButton = await screen.findByRole("link", { name: /New Requisition \(MRF\)/i });
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
    expect(await screen.findByText("Active Job Postings")).toBeDefined();
    expect(await screen.findByText("Forklift Operator")).toBeDefined();
    expect(await screen.findByText("Client Account")).toBeDefined();
  });

  it("renders MRFListPage with manpower requisitions and client filter", async () => {
    renderWithClient(<MRFListPage />);
    expect(await screen.findByText("Client Requisitions (MRF)")).toBeDefined();
    expect(await screen.findByText("20x Line Assemblers")).toBeDefined();
    expect(await screen.findByText("Client Account")).toBeDefined();
  });

  it("renders TalentPoolPage search container and validates empty query", async () => {
    renderWithClient(<TalentPoolPage />);
    expect(await screen.findByText("Candidate pool")).toBeDefined();

    // Clicking search with empty input shows validation message and does NOT call api
    const searchBtn = screen.getByRole("button", { name: /Search Talent Pool/i });
    fireEvent.click(searchBtn);

    expect(await screen.findByText(/Please enter keywords/i)).toBeDefined();
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

    const searchBtn = screen.getByRole("button", { name: /Search Talent Pool/i });
    fireEvent.click(searchBtn);

    expect(await screen.findByText("Carlos Mendoza")).toBeDefined();
    expect(await screen.findByText("carlos.mendoza@example.com")).toBeDefined();
    expect(await screen.findByText("Senior TypeScript Engineer")).toBeDefined();
    expect(await screen.findByText("Makati, Metro Manila")).toBeDefined();
    expect(await screen.findByText("94% Match")).toBeDefined();
    // Click Invite to Apply
    const inviteBtn = screen.getByRole("button", { name: /Invite to Apply/i });
    fireEvent.click(inviteBtn);

    expect(await screen.findByText("Invite Candidate to Apply")).toBeDefined();
    expect(await screen.findByText(/Send an in-app and email job invitation to Carlos Mendoza/i)).toBeDefined();
  });


  it("renders InterviewsPage with 7-day SLA compliance tracking", async () => {
    renderWithClient(<InterviewsPage />);
    expect(await screen.findByText("Interview schedule")).toBeDefined();
    expect(await screen.findByText("Carlos Mendoza")).toBeDefined();
  });

  it("renders ClientsPage with corporate partners", async () => {
    renderWithClient(<ClientsPage />);
    expect(await screen.findByText("Client Corporate Accounts")).toBeDefined();
    expect(await screen.findByText("Acme Industrial")).toBeDefined();
  });

  it("renders CompliancePage with 201 clearance overview", async () => {
    renderWithClient(<CompliancePage />);
    expect(await screen.findByText("Requirements Documents")).toBeDefined();
    expect(await screen.findByText("Total Clearances Tracked")).toBeDefined();
  });

  it("renders DeploymentsPage with site assignments and verified status workflow", async () => {
    renderWithClient(<DeploymentsPage />);
    expect(await screen.findByText("Workforce Site Deployments")).toBeDefined();
    expect(await screen.findByText("Batangas Plant")).toBeDefined();
    expect(await screen.findByText("Laguna Plant")).toBeDefined();
    expect(await screen.findByText("Cebu Site")).toBeDefined();

    // Verify valid status badges are present (in table and filter)
    expect((await screen.findAllByText("Active on Site")).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText("Scheduled for Site")).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText("Assignment Completed")).length).toBeGreaterThanOrEqual(1);

    // Verify status update buttons only appear on non-terminal rows (2 non-terminal rows out of 3)
    const updateStatusButtons = await screen.findAllByRole("button", { name: "Update Status" });
    expect(updateStatusButtons.length).toBe(2);

    // Click Update Status on the READY_FOR_DEPLOYMENT row (2nd button)
    fireEvent.click(updateStatusButtons[1]);
    expect(await screen.findByText("Update the employee's current deployment status.")).toBeDefined();
  });

  it("renders EmployeesPage with personnel and 201 roster", async () => {
    renderWithClient(<EmployeesPage />);
    expect(await screen.findByText("Employee records (201)")).toBeDefined();
  });

  it("renders AnalyticsPage with personal workload and telemetry reports", async () => {
    renderWithClient(<AnalyticsPage />);
    expect(await screen.findByText("Recruitment reports")).toBeDefined();
    expect(await screen.findByText("My Recruitment Activity Trend")).toBeDefined();
    expect(await screen.findByText("Export Reports")).toBeDefined();
  });
});
