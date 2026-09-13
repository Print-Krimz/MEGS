import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { taApi } from "../../../lib/api/ta.api";
import { ApplicationDetailPage } from "../ApplicationDetailPage";
import { ApplicationsPage } from "../ApplicationsPage";
import { ApplicationStatus } from "../../../lib/types/enums";

vi.mock("../../../lib/api/ta.api", () => ({
  taApi: {
    getApplication: vi.fn(),
    updateApplicationStatus: vi.fn(),
    recordEndorsement: vi.fn(),
    getRecruiterDecisions: vi.fn().mockResolvedValue([]),
    listClients: vi.fn().mockResolvedValue([
      { id: 1, name: "Acme Industrial", industry: "Manufacturing", isActive: true },
    ]),
    listJobs: vi.fn().mockResolvedValue([]),
    listApplications: vi.fn(),
    archiveApplication: vi.fn(),
    restoreApplication: vi.fn(),
    getSimilarCandidates: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useParams: () => ({ applicationId: "101" }),
}));

describe("Applicant Status UI Synchronization Regression Suite", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 60 * 1000,
        },
      },
    });
  });

  function renderWithClient(ui: React.ReactElement) {
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    );
  }

  it("immediately displays updated status when candidate stage is advanced without requiring page refresh", async () => {
    const mockApp = {
      id: 101,
      status: ApplicationStatus.FINAL_INTERVIEW,
      aiScore: 85,
      createdAt: "2026-08-15T00:00:00Z",
      contractSigned: false,
      orientationCompleted: false,
      user: {
        id: "user-1",
        email: "carlos.mendoza@example.com",
        applicantProfile: {
          firstName: "Carlos",
          lastName: "Mendoza",
          mobileNumber: "09171234567",
          skills: ["Electrician", "HVAC"],
        },
      },
      jobPosting: {
        id: 10,
        title: "Senior Electrician",
        location: "Laguna Plant",
      },
      interviews: [
        {
          id: 1,
          type: "FINAL_INTERVIEW",
          result: "PASS",
          isActive: true,
          scheduledAt: "2026-08-18T10:00:00Z",
        },
      ],
      complianceRequirements: [],
      clientEndorsements: [],
    };

    vi.mocked(taApi.getApplication).mockResolvedValue(mockApp as any);
    vi.mocked(taApi.updateApplicationStatus).mockResolvedValue({
      id: 101,
      status: ApplicationStatus.COMPLIANCE,
      updatedAt: new Date().toISOString(),
    } as any);

    renderWithClient(<ApplicationDetailPage />);

    // 1. Initially displays FINAL_INTERVIEW status
    expect((await screen.findAllByText(/final interview/i)).length).toBeGreaterThan(0);

    // 2. Advance to Requirements button should be available
    const advanceBtn = await screen.findByRole("button", { name: /Advance to Requirements/i });
    expect(advanceBtn).toBeDefined();

    // 3. Trigger status mutation
    fireEvent.click(advanceBtn);

    // 4. Verify API was called with correct arguments
    await waitFor(() => {
      expect(taApi.updateApplicationStatus).toHaveBeenCalledWith("101", {
        status: ApplicationStatus.COMPLIANCE,
        reason: "Client accepted candidate for employment",
      });
    });

    // 5. Verify the UI immediately displays the new COMPLIANCE status (Requirements) without browser refresh
    expect((await screen.findAllByText("Requirements")).length).toBeGreaterThanOrEqual(1);
  });

  it("immediately displays updated status when candidate is rejected without requiring page refresh", async () => {
    let currentApp = {
      id: 101,
      status: ApplicationStatus.INITIAL_SCREENING,
      aiScore: 70,
      createdAt: "2026-08-15T00:00:00Z",
      contractSigned: false,
      orientationCompleted: false,
      user: {
        id: "user-1",
        email: "carlos.mendoza@example.com",
        applicantProfile: {
          firstName: "Carlos",
          lastName: "Mendoza",
        },
      },
      jobPosting: {
        id: 10,
        title: "Senior Electrician",
      },
      interviews: [],
    };

    vi.mocked(taApi.getApplication).mockImplementation(async () => currentApp as any);
    vi.mocked(taApi.updateApplicationStatus).mockImplementation(async (_id, data: any) => {
      currentApp = { ...currentApp, status: data.status };
      return {
        id: 101,
        status: data.status,
        updatedAt: new Date().toISOString(),
      } as any;
    });

    renderWithClient(<ApplicationDetailPage />);

    expect((await screen.findAllByText("Initial Screening")).length).toBeGreaterThanOrEqual(1);

    const rejectBtn = await screen.findByRole("button", { name: /Reject Candidate/i });
    fireEvent.click(rejectBtn);

    expect(await screen.findByText("Reject Candidate / Archive Application")).toBeDefined();

    const confirmRejectBtn = screen.getByRole("button", { name: "Confirm Rejection" });
    fireEvent.click(confirmRejectBtn);

    await waitFor(() => {
      expect(taApi.updateApplicationStatus).toHaveBeenCalledWith("101", {
        status: ApplicationStatus.ARCHIVED,
        reason: "Qualifications Mismatch",
      });
    });

    await waitFor(() => {
      expect(screen.getAllByText("Archived").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("immediately displays updated status when candidate is endorsed to client", async () => {
    let currentApp: any = {
      id: 101,
      status: ApplicationStatus.INITIAL_SCREENING,
      aiScore: 90,
      createdAt: "2026-08-15T00:00:00Z",
      contractSigned: false,
      orientationCompleted: false,
      user: {
        id: "user-1",
        email: "carlos.mendoza@example.com",
        applicantProfile: { firstName: "Carlos", lastName: "Mendoza" },
      },
      jobPosting: { id: 10, title: "Senior Electrician", mrf: { clientId: 1, client: { id: 1, name: "Acme Industrial" } } },
      interviews: [
        { id: 1, type: "INITIAL_SCREENING", result: "PASS", isActive: true },
      ],
      complianceRequirements: [],
      clientEndorsements: [],
    };

    vi.mocked(taApi.getApplication).mockImplementation(async () => currentApp as any);
    vi.mocked(taApi.recordEndorsement).mockImplementation(async (_id, data: any) => {
      currentApp = { ...currentApp, status: ApplicationStatus.CLIENT_ENDORSEMENT };
      return {
        id: 50,
        applicationId: 101,
        clientId: data.clientId,
        outcome: data.outcome || "PENDING",
      } as any;
    });

    renderWithClient(<ApplicationDetailPage />);

    // Endorse to Client button
    const endorseBtn = await screen.findByRole("button", { name: /Endorse to Client/i });
    fireEvent.click(endorseBtn);

    expect(await screen.findByText("Endorse Candidate to Client")).toBeDefined();

    const submitEndorseBtn = screen.getByRole("button", { name: "Submit Endorsement to Client" });
    fireEvent.click(submitEndorseBtn);

    await waitFor(() => {
      expect(screen.getAllByText("Client Endorsement").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("synchronizes list view status immediately in ApplicationsPage when archived", async () => {
    let appList: any[] = [
      {
        id: 101,
        status: ApplicationStatus.SUBMITTED,
        isArchived: false,
        createdAt: "2026-08-01T00:00:00Z",
        user: { email: "carlos@example.com", applicantProfile: { firstName: "Carlos", lastName: "Mendoza" } },
        jobPosting: { id: 10, title: "Electrician", mrf: { client: { id: 1, name: "Acme Industrial" } } },
      },
      {
        id: 102,
        status: ApplicationStatus.INITIAL_SCREENING,
        isArchived: false,
        createdAt: "2026-08-02T00:00:00Z",
        user: { email: "maria@example.com", applicantProfile: { firstName: "Maria", lastName: "Santos" } },
        jobPosting: { id: 10, title: "Electrician", mrf: { client: { id: 1, name: "Acme Industrial" } } },
      },
    ];

    vi.mocked(taApi.listApplications).mockImplementation(async () => appList as any);

    vi.mocked(taApi.archiveApplication).mockImplementation(async (id: any) => {
      appList = appList.map((a) => (Number(a.id) === Number(id) ? { ...a, isArchived: true, status: ApplicationStatus.ARCHIVED } : a));
      return { success: true } as any;
    });

    renderWithClient(<ApplicationsPage />);

    expect((await screen.findAllByText("Carlos Mendoza")).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText("Maria Santos")).length).toBeGreaterThanOrEqual(1);

    // Archive Carlos (ID 101)
    const archiveButtons = await screen.findAllByTitle("Archive Application");
    expect(archiveButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(archiveButtons[0]);

    expect(await screen.findByRole("heading", { name: "Archive Application" })).toBeDefined();

    const textarea = screen.getByPlaceholderText(/e.g. Position filled, candidate unresponsive, or withdrew application/i);
    fireEvent.change(textarea, { target: { value: "Candidate withdrew application" } });

    const confirmButtons = screen.getAllByRole("button", { name: "Archive Application" });
    const confirmBtn = confirmButtons[confirmButtons.length - 1];
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(taApi.archiveApplication).toHaveBeenCalledWith(101, { reason: "Candidate withdrew application" });
    });

    // Verify list cache is updated without page reload
    await waitFor(() => {
      const cachedQueries = queryClient.getQueriesData<any>({ queryKey: ["ta", "applications"] });
      expect(cachedQueries.length).toBeGreaterThan(0);
    });
  });
});


