import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CompliancePage } from "../CompliancePage";
import { taApi } from "../../../lib/api/ta.api";
import { ApplicationStatus } from "../../../lib/types/enums";

// Mock router Link
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, ...props }: any) => {
    const href = typeof to === "string" && params
      ? Object.entries(params).reduce(
          (acc, [k, v]) => acc.replace(`$${k}`, String(v)),
          to
        )
      : to;
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/ta/workforce" }),
  useRouter: () => ({ state: { location: { pathname: "/ta/workforce" } } }),
}));

// Mock feedback notification
vi.mock("../../../lib/feedback", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock taApi
vi.mock("../../../lib/api/ta.api", () => ({
  taApi: {
    getComplianceOverview: vi.fn(),
    listApplications: vi.fn(),
    reviewComplianceRequirement: vi.fn(),
  },
}));

const mockOverview = {
  totalRequirements: 12,
  statusBreakdown: {
    PENDING: 4,
    SUBMITTED: 3,
    APPROVED: 5,
    REJECTED: 0,
  },
};

const mockApplications = [
  {
    id: 101,
    status: ApplicationStatus.COMPLIANCE,
    createdAt: "2026-08-10T10:00:00Z",
    user: {
      email: "carlos@megs.ph",
      applicantProfile: { firstName: "Carlos", lastName: "Mendoza" },
    },
    jobPosting: { id: 1, title: "Forklift Operator", location: "Laguna" },
    complianceRequirements: [
      {
        id: 1,
        applicationId: 101,
        documentLabel: "NBI Clearance",
        isRequired: true,
        reviewStatus: "SUBMITTED",
        reviewNotes: null,
      },
      {
        id: 2,
        applicationId: 101,
        documentLabel: "Medical Exam",
        isRequired: true,
        reviewStatus: "APPROVED",
        reviewNotes: "Cleared fit to work",
      },
    ],
  },
  {
    id: 102,
    status: ApplicationStatus.COMPLIANCE,
    createdAt: "2026-08-15T09:00:00Z",
    user: {
      email: "ana@megs.ph",
      applicantProfile: { firstName: "Ana", lastName: "Santos" },
    },
    jobPosting: { id: 2, title: "Electrician", location: "Batangas" },
    complianceRequirements: [
      {
        id: 3,
        applicationId: 102,
        documentLabel: "SSS Verification",
        isRequired: true,
        reviewStatus: "PENDING",
        reviewNotes: null,
      },
      {
        id: 4,
        applicationId: 102,
        documentLabel: "Barangay Clearance",
        isRequired: true,
        reviewStatus: "PENDING",
        reviewNotes: null,
      },
    ],
  },
  {
    id: 103,
    status: ApplicationStatus.COMPLIANCE,
    createdAt: "2026-08-12T14:00:00Z",
    user: {
      email: "benjie@megs.ph",
      applicantProfile: { firstName: "Benjie", lastName: "Ramos" },
    },
    jobPosting: { id: 1, title: "Forklift Operator", location: "Laguna" },
    complianceRequirements: [
      {
        id: 5,
        applicationId: 103,
        documentLabel: "Drug Test",
        isRequired: true,
        reviewStatus: "APPROVED",
        reviewNotes: "Negative result",
      },
      {
        id: 6,
        applicationId: 103,
        documentLabel: "Health Certificate",
        isRequired: true,
        reviewStatus: "APPROVED",
        reviewNotes: "Valid for 1 year",
      },
    ],
  },
  {
    id: 104,
    status: ApplicationStatus.COMPLIANCE,
    createdAt: "2026-08-01T08:00:00Z",
    user: {
      email: "dina@megs.ph",
      applicantProfile: { firstName: "Dina", lastName: "Cruz" },
    },
    jobPosting: { id: 3, title: "Welder", location: "Cavite" },
    complianceRequirements: [],
  },
  {
    id: 105,
    status: ApplicationStatus.FINAL_INTERVIEW, // Non-compliance candidate, should be filtered out
    createdAt: "2026-08-05T08:00:00Z",
    user: {
      email: "other@megs.ph",
      applicantProfile: { firstName: "Other", lastName: "Person" },
    },
    jobPosting: { id: 1, title: "Forklift Operator", location: "Laguna" },
    complianceRequirements: [],
  },
];

describe("CompliancePage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.mocked(taApi.getComplianceOverview).mockResolvedValue(mockOverview as any);
    vi.mocked(taApi.listApplications).mockResolvedValue(mockApplications as any);
    vi.mocked(taApi.reviewComplianceRequirement).mockResolvedValue({
      id: 1,
      applicationId: 101,
      documentLabel: "NBI Clearance",
      isRequired: true,
      reviewStatus: "APPROVED",
      reviewNotes: "Verified valid",
      createdAt: "",
      updatedAt: "",
    });
  });

  const renderComponent = (hideHeader?: boolean) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <CompliancePage hideHeader={hideHeader} />
      </QueryClientProvider>
    );
  };

  it("renders metric cards with proper aria-pressed state and queue table", async () => {
    renderComponent();

    // Check top level header
    expect(await screen.findByRole("heading", { name: "Pre-employment requirements" })).toBeDefined();

    // Metric cards
    const trackedCard = screen.getByRole("button", { name: /Candidates in compliance/i });
    const waitingCandidateCard = screen.getByRole("button", { name: /Awaiting submission/i });
    const waitingReviewCard = screen.getByRole("button", { name: /Ready for review/i });
    const approvedCard = screen.getByRole("button", { name: /Cleared candidates/i });

    expect(trackedCard.getAttribute("aria-pressed")).toBe("true");
    expect(waitingCandidateCard.getAttribute("aria-pressed")).toBe("false");
    expect(waitingReviewCard.getAttribute("aria-pressed")).toBe("false");
    expect(approvedCard.getAttribute("aria-pressed")).toBe("false");

    // Contextual table header default
    expect(screen.getByText("Pre-employment compliance queue")).toBeDefined();
    expect(screen.getByText(/active candidate\(s\) in pre-employment verification/i)).toBeDefined();

    // Non-compliance candidate should not appear
    expect(screen.queryByText("Other Person")).toBeNull();

    // Compliance candidates should appear in the table
    expect(screen.getAllByText("Carlos Mendoza").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ana Santos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Benjie Ramos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dina Cruz").length).toBeGreaterThan(0);
  });

  it("displays calculated compliance progress badges", async () => {
    renderComponent();
    await screen.findByText("Pre-employment compliance queue");

    // Carlos: 1 submitted -> "1 awaiting review"
    expect(screen.getAllByText("1 awaiting review").length).toBeGreaterThan(0);

    // Ana: 2 pending -> "2 pending submission"
    expect(screen.getAllByText("2 pending submission").length).toBeGreaterThan(0);

    // Benjie: all approved -> "All 2 approved"
    expect(screen.getAllByText("All 2 approved").length).toBeGreaterThan(0);

    // Dina: 0 requirements -> "No requirements"
    expect(screen.getAllByText("No requirements").length).toBeGreaterThan(0);
  });

  it("supports interactive metric card filtering and contextual header updates", async () => {
    renderComponent();
    await screen.findByText("Pre-employment compliance queue");

    const waitingReviewCard = screen.getByRole("button", { name: /Ready for review/i });
    const waitingCandidateCard = screen.getByRole("button", { name: /Awaiting submission/i });
    const approvedCard = screen.getByRole("button", { name: /Cleared candidates/i });
    const trackedCard = screen.getByRole("button", { name: /Candidates in compliance/i });

    // 1. Filter by Ready for review (Card 3)
    fireEvent.click(waitingReviewCard);
    expect(waitingReviewCard.getAttribute("aria-pressed")).toBe("true");
    expect(trackedCard.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("heading", { name: "Ready for review" })).toBeDefined();
    expect(screen.getByText(/Showing 1 candidate\(s\) with documents needing verification/i)).toBeDefined();
    expect(screen.getAllByText("Carlos Mendoza").length).toBeGreaterThan(0);
    expect(screen.queryByText("Ana Santos")).toBeNull();
    expect(screen.queryByText("Benjie Ramos")).toBeNull();

    // 2. Filter by Awaiting submission (Card 2)
    fireEvent.click(waitingCandidateCard);
    expect(waitingCandidateCard.getAttribute("aria-pressed")).toBe("true");
    expect(waitingReviewCard.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("heading", { name: "Awaiting candidate submission" })).toBeDefined();
    expect(screen.getByText(/Showing 1 candidate\(s\) \(2 pending documents\)/i)).toBeDefined();
    expect(screen.getAllByText("Ana Santos").length).toBeGreaterThan(0);
    expect(screen.queryByText("Carlos Mendoza")).toBeNull();
    expect(screen.queryByText("Benjie Ramos")).toBeNull();

    // 3. Filter by Cleared candidates (Card 4)
    fireEvent.click(approvedCard);
    expect(approvedCard.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { name: "Approved candidates" })).toBeDefined();
    expect(screen.getByText(/Showing 1 candidate\(s\) ready for deployment/i)).toBeDefined();
    expect(screen.getAllByText("Benjie Ramos").length).toBeGreaterThan(0);
    expect(screen.queryByText("Carlos Mendoza")).toBeNull();
    expect(screen.queryByText("Ana Santos")).toBeNull();

    // 4. Return to ALL (Card 1)
    fireEvent.click(trackedCard);
    expect(trackedCard.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { name: "Pre-employment compliance queue" })).toBeDefined();
    expect(screen.getByText(/Showing 4 active candidate\(s\) in pre-employment verification/i)).toBeDefined();
    expect(screen.getAllByText("Carlos Mendoza").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ana Santos").length).toBeGreaterThan(0);
  });

  it("supports SearchFilters by candidate name, email, job title, and reset", async () => {
    renderComponent();
    await screen.findByText("Pre-employment compliance queue");

    const searchInput = screen.getByPlaceholderText("Search candidate, email, or job opening...");

    // Search by name
    fireEvent.change(searchInput, { target: { value: "Ana" } });
    expect(screen.getAllByText("Ana Santos").length).toBeGreaterThan(0);
    expect(screen.queryByText("Carlos Mendoza")).toBeNull();
    expect(screen.queryByText("Benjie Ramos")).toBeNull();

    // Search by email
    fireEvent.change(searchInput, { target: { value: "carlos@megs.ph" } });
    expect(screen.getAllByText("Carlos Mendoza").length).toBeGreaterThan(0);
    expect(screen.queryByText("Ana Santos")).toBeNull();

    // Reset filters
    const resetBtn = screen.getByRole("button", { name: /Reset Filters/i });
    fireEvent.click(resetBtn);
    expect((searchInput as HTMLInputElement).value).toBe("");
    expect(screen.getAllByText("Carlos Mendoza").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ana Santos").length).toBeGreaterThan(0);
  });

  it("supports dropdown filters for Job Opening and Requirement Status", async () => {
    renderComponent();
    await screen.findByText("Pre-employment compliance queue");

    const selects = screen.getAllByRole("combobox");
    const jobSelect = selects[0];
    const statusSelect = selects[1];

    // Filter by Job Opening
    fireEvent.change(jobSelect, { target: { value: "Electrician" } });
    expect(screen.getAllByText("Ana Santos").length).toBeGreaterThan(0);
    expect(screen.queryByText("Carlos Mendoza")).toBeNull();
    expect(screen.queryByText("Benjie Ramos")).toBeNull();

    // Reset Job Opening
    fireEvent.change(jobSelect, { target: { value: "" } });
    expect(screen.getAllByText("Carlos Mendoza").length).toBeGreaterThan(0);

    // Filter by Requirement Status dropdown
    fireEvent.change(statusSelect, { target: { value: "WAITING_REVIEW" } });
    expect(screen.getAllByText("Carlos Mendoza").length).toBeGreaterThan(0);
    expect(screen.queryByText("Ana Santos")).toBeNull();
    expect(screen.queryByText("Benjie Ramos")).toBeNull();
  });

  it("supports interactive column sorting on Candidate and Submitted", async () => {
    renderComponent();
    await screen.findByText("Pre-employment compliance queue");

    // Click candidate sort button
    const candidateSortBtn = screen.getByRole("button", { name: /^Candidate$/i });
    fireEvent.click(candidateSortBtn); // Sort asc: Ana, Benjie, Carlos, Dina

    let rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("Ana Santos");
    expect(rows[2].textContent).toContain("Benjie Ramos");
    expect(rows[3].textContent).toContain("Carlos Mendoza");
    expect(rows[4].textContent).toContain("Dina Cruz");

    // Click candidate sort button again -> desc: Dina, Carlos, Benjie, Ana
    fireEvent.click(candidateSortBtn);
    rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("Dina Cruz");
    expect(rows[2].textContent).toContain("Carlos Mendoza");
    expect(rows[3].textContent).toContain("Benjie Ramos");
    expect(rows[4].textContent).toContain("Ana Santos");

    // Sort by Submitted date
    const submittedSortBtn = screen.getByRole("button", { name: /^Submitted$/i });
    fireEvent.click(submittedSortBtn); // Sort asc: Dina (Aug 1), Carlos (Aug 10), Benjie (Aug 12), Ana (Aug 15)
    rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("Dina Cruz");
    expect(rows[2].textContent).toContain("Carlos Mendoza");
    expect(rows[3].textContent).toContain("Benjie Ramos");
    expect(rows[4].textContent).toContain("Ana Santos");
  });

  it("opens Quick Review dialog and executes requirement review", async () => {
    renderComponent();
    await screen.findByText("Pre-employment compliance queue");

    // Click "Quick review" for Carlos Mendoza specifically
    const carlosEl = screen.getAllByText("Carlos Mendoza")[0];
    const carlosContainer = carlosEl.closest("article") || carlosEl.closest("tr");
    const quickReviewBtn = within(carlosContainer!).getByRole("button", { name: /Quick review/i });
    fireEvent.click(quickReviewBtn);

    // Dialog should open
    expect(await screen.findByRole("dialog")).toBeDefined();
    expect(screen.getByText("Quick compliance review")).toBeDefined();
    expect(screen.getByText(/Review documents for Carlos Mendoza • Forklift Operator/i)).toBeDefined();

    // Displays requirement list
    expect(screen.getAllByText("NBI Clearance").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Medical Exam")).toBeDefined();

    // Default selected requirement is the SUBMITTED one: "NBI Clearance"
    expect(screen.getByText(/Reviewing:/i).textContent).toContain("NBI Clearance");

    // Fill review notes
    const notesInput = screen.getByPlaceholderText("Explain what was verified or what needs correction...");
    fireEvent.change(notesInput, { target: { value: "Verified valid" } });

    // Submit review
    const saveBtn = screen.getByRole("button", { name: /Save review/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(taApi.reviewComplianceRequirement).toHaveBeenCalledWith(1, {
        reviewStatus: "APPROVED",
        reviewNotes: "Verified valid",
      });
    });

    // Success feedback message appears
    expect(await screen.findByText("The requirement was approved.")).toBeDefined();
  });

  it("provides accessible external link to application detail page", async () => {
    renderComponent();
    await screen.findByText("Pre-employment compliance queue");

    const link = screen.getByRole("link", { name: "View application for Carlos Mendoza" });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("/ta/applications/101");
  });

  it("harmonizes 4 Pre-employment KPI cards using unified anti-slop surface styling", async () => {
    renderComponent();
    await screen.findByText("Pre-employment compliance queue");

    const trackedCard = screen.getByRole("button", { name: /Candidates in compliance/i });
    const waitingCandidateCard = screen.getByRole("button", { name: /Awaiting submission/i });
    const waitingReviewCard = screen.getByRole("button", { name: /Ready for review/i });
    const approvedCard = screen.getByRole("button", { name: /Cleared candidates/i });

    // Active card uses dark neutral border and ring
    expect(trackedCard.className).toContain("border-slate-800");
    expect(trackedCard.className).toContain("ring-slate-800/20");

    // Inactive cards use neutral border-slate-200/90 and bg-white without rainbow borders
    expect(waitingCandidateCard.className).toContain("border-slate-200/90");
    expect(waitingCandidateCard.className).not.toContain("border-amber-200");
    expect(waitingCandidateCard.className).not.toContain("bg-amber-50/20");

    expect(waitingReviewCard.className).toContain("border-slate-200/90");
    expect(waitingReviewCard.className).not.toContain("border-blue-200");
    expect(waitingReviewCard.className).not.toContain("bg-blue-50/20");

    expect(approvedCard.className).toContain("border-slate-200/90");
    expect(approvedCard.className).not.toContain("border-emerald-200");
    expect(approvedCard.className).not.toContain("bg-emerald-50/20");
  });
});
