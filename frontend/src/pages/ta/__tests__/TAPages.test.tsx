import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
        HIRED: 4,
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
    searchTalentPool: vi.fn().mockResolvedValue([]),
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
    expect(await screen.findByText("Talent Acquisition Operations")).toBeDefined();
    expect(await screen.findByText("Forklift Operator")).toBeDefined();
    expect(await screen.findByText("Juan Dela Cruz")).toBeDefined();
  });

  it("renders ApplicationsPage with candidate list and stage filter", async () => {
    renderWithClient(<ApplicationsPage />);
    expect(await screen.findByText("Candidate Applications Pipeline")).toBeDefined();
    expect(await screen.findByText("Juan Dela Cruz")).toBeDefined();
  });

  it("renders JobPostingsPage with requisitions", async () => {
    renderWithClient(<JobPostingsPage />);
    expect(await screen.findByText("Job Postings & Requisitions")).toBeDefined();
    expect(await screen.findByText("Forklift Operator")).toBeDefined();
  });

  it("renders MRFListPage with manpower requisitions", async () => {
    renderWithClient(<MRFListPage />);
    expect(await screen.findByText("Manpower Requests (MRF)")).toBeDefined();
    expect(await screen.findByText("20x Line Assemblers")).toBeDefined();
  });

  it("renders TalentPoolPage search container and validates empty query", async () => {
    renderWithClient(<TalentPoolPage />);
    expect(await screen.findByText("Talent Pool & Candidate Matching")).toBeDefined();
    expect(await screen.findByText("Search Talent Pool")).toBeDefined();

    // Clicking search with empty input shows validation message and does NOT call api
    const searchBtn = screen.getByRole("button", { name: /Search Talent Pool/i });
    fireEvent.click(searchBtn);

    expect(await screen.findByText(/Please enter keywords/i)).toBeDefined();
  });

  it("renders InterviewsPage with 7-day SLA compliance tracking", async () => {
    renderWithClient(<InterviewsPage />);
    expect(await screen.findByText("Interview Schedules & 7-Day SLA Compliance")).toBeDefined();
    expect(await screen.findByText("Carlos Mendoza")).toBeDefined();
  });

  it("renders ClientsPage with corporate partners", async () => {
    renderWithClient(<ClientsPage />);
    expect(await screen.findByText("Client Corporate Accounts")).toBeDefined();
    expect(await screen.findByText("Acme Industrial")).toBeDefined();
  });

  it("renders CompliancePage with 201 clearance overview", async () => {
    renderWithClient(<CompliancePage />);
    expect(await screen.findByText("201 Pre-Employment Compliance Tracking")).toBeDefined();
    expect(await screen.findByText("Total Clearances Tracked")).toBeDefined();
  });

  it("renders DeploymentsPage with site assignments and verified status workflow", async () => {
    renderWithClient(<DeploymentsPage />);
    expect(await screen.findByText("Workforce Site Deployments")).toBeDefined();
    expect(await screen.findByText("Batangas Plant")).toBeDefined();
    expect(await screen.findByText("Laguna Plant")).toBeDefined();
    expect(await screen.findByText("Cebu Site")).toBeDefined();

    // Verify valid status badges are present
    expect(await screen.findByText("Active")).toBeDefined();
    expect(await screen.findByText("Ready for Deployment")).toBeDefined();
    expect(await screen.findByText("Ended")).toBeDefined();

    // Verify status update buttons only appear on non-terminal rows (2 non-terminal rows out of 3)
    const updateStatusButtons = await screen.findAllByRole("button", { name: "Update Status" });
    expect(updateStatusButtons.length).toBe(2);

    // Click Update Status on the READY_FOR_DEPLOYMENT row (2nd button)
    fireEvent.click(updateStatusButtons[1]);
    expect(await screen.findByText("Update the employee's current deployment status.")).toBeDefined();
  });

  it("renders EmployeesPage with personnel and 201 roster", async () => {
    renderWithClient(<EmployeesPage />);
    expect(await screen.findByText("Personnel & Digital 201 Records")).toBeDefined();
    expect(await screen.findByText("EMP-2026-088")).toBeDefined();
  });

  it("renders AnalyticsPage with pipeline and time-to-fill reports", async () => {
    renderWithClient(<AnalyticsPage />);
    expect(await screen.findByText("Recruitment Analytics & Operations Intelligence")).toBeDefined();
    expect(await screen.findByText("Avg Time-To-Fill")).toBeDefined();
  });
});
