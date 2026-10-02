import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  PostDeploymentCompliancePage,
} from "../PostDeploymentCompliancePage";
import {
  calculateDaysOnSite,
  calculateUrgencyStatus,
  getWorkerUrgencyCategory,
} from "../../../lib/compliance-queue";
import { taApi } from "../../../lib/api/ta.api";
import { ApplicationStatus, DeploymentStatus } from "../../../lib/types/enums";
import type { Application } from "../../../lib/types";

// Mock router Link
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, ...props }: any) => {
    const href =
      typeof to === "string" && params
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
  useSearch: () => ({ tab: "post_deployment" }),
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
    getComplianceQueue: vi.fn(),
    reviewComplianceRequirement: vi.fn(),
  },
}));

// Mock documentsApi
vi.mock("../../../lib/api/documents.api", () => ({
  documentsApi: {
    getPreview: vi.fn().mockResolvedValue({
      id: 1,
      originalName: "medical_cert.pdf",
      mimeType: "application/pdf",
      sizeBytes: 102400,
      url: "https://example.com/medical_cert.pdf",
    }),
  },
}));

describe("PostDeploymentCompliancePage Helpers", () => {
  it("calculates days on site cleanly", () => {
    // contractStart valid date
    const days = calculateDaysOnSite("2026-09-14");
    expect(typeof days).toBe("number");
    expect(days).toBeGreaterThanOrEqual(0);

    // contractStart null/undefined
    expect(calculateDaysOnSite(null)).toBeNull();
    expect(calculateDaysOnSite(undefined)).toBeNull();
    expect(calculateDaysOnSite("invalid-date")).toBeNull();
  });

  it("calculates urgency status for overdue, upcoming, healthy, and null dates", () => {
    // Null date
    const noTarget = calculateUrgencyStatus(null);
    expect(noTarget.category).toBe("NO_TARGET");
    expect(noTarget.label).toBe("No target date");
    expect(noTarget.variant).toBe("neutral");

    // Past date (overdue)
    const overdue = calculateUrgencyStatus("2026-01-01");
    expect(overdue.category).toBe("OVERDUE");
    expect(overdue.label).toMatch(/Overdue \(\d+ days?\)/i);
    expect(overdue.variant).toBe("danger");

    // Upcoming date (near future, e.g. within 2 days from today)
    const today = new Date();
    const nearDate = new Date(today);
    nearDate.setDate(today.getDate() + 3);
    const nearDateStr = nearDate.toISOString().split("T")[0];
    const upcoming = calculateUrgencyStatus(nearDateStr);
    expect(upcoming.category).toBe("UPCOMING");
    expect(upcoming.label).toMatch(/Due in \d+ days?/i);
    expect(upcoming.variant).toBe("warning");

    // Distant future date (> 7 days)
    const farDate = new Date(today);
    farDate.setDate(today.getDate() + 30);
    const farDateStr = farDate.toISOString().split("T")[0];
    const healthy = calculateUrgencyStatus(farDateStr);
    expect(healthy.category).toBe("HEALTHY");
    expect(healthy.label).toMatch(/^Target:/i);
    expect(healthy.variant).toBe("primary");
  });

  it("evaluates worker overall urgency category based on requirements", () => {
    const mockAppOverdue: Application = {
      id: 1,
      userId: "user-1",
      jobPostingId: 10,
      status: ApplicationStatus.DEPLOYED,
      isArchived: false,
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
      complianceRequirements: [
        {
          id: 101,
          applicationId: 1,
          documentLabel: "NBI Clearance",
          isRequired: true,
          reviewStatus: "TO_FOLLOW",
          toFollowExpectedAt: "2026-01-01",
          createdAt: "2026-08-01T00:00:00Z",
          updatedAt: "2026-08-01T00:00:00Z",
        },
      ],
    };

    expect(getWorkerUrgencyCategory(mockAppOverdue)).toBe("OVERDUE");
  });
});

describe("PostDeploymentCompliancePage Component", () => {
  let queryClient: QueryClient;

  const mockActiveWorkers: Application[] = [
    {
      id: 501,
      userId: "u-501",
      jobPostingId: 12,
      status: ApplicationStatus.DEPLOYED,
      isArchived: false,
      createdAt: "2026-08-10T08:00:00Z",
      updatedAt: "2026-09-14T08:00:00Z",
      user: {
        id: "u-501",
        email: "juan.delacruz@megs.ph",
        applicantProfile: {
          id: 1,
          userId: "u-501",
          firstName: "Juan",
          lastName: "Dela Cruz",
          mobileNumber: "+639171234567",
        } as any,
        employee: {
          id: 10,
          employeeNumber: "EMP-2026-0042",
          status: "ACTIVE",
        },
      },
      jobPosting: {
        id: 12,
        title: "Forklift Operator",
        postedById: "ta-1",
        description: "Warehouse logistics",
        requirements: "Certified",
        status: "ACTIVE" as any,
        createdAt: "2026-08-01T00:00:00Z",
        updatedAt: "2026-08-01T00:00:00Z",
        mrf: {
          id: 3,
          title: "Warehouse Expansion",
          clientId: 40,
          client: {
            id: 40,
            name: "Acme Logistics",
          },
        },
      },
      deployments: [
        {
          id: 77,
          employeeId: 10,
          clientId: 40,
          status: DeploymentStatus.ACTIVE,
          contractStart: "2026-09-14",
          createdById: "ta-admin",
          createdAt: "2026-09-14T00:00:00Z",
          updatedAt: "2026-09-14T00:00:00Z",
        },
      ],
      complianceRequirements: [
        {
          id: 801,
          applicationId: 501,
          documentLabel: "Fit to Work Medical Exam",
          isRequired: true,
          reviewStatus: "TO_FOLLOW",
          toFollowExpectedAt: "2026-01-15", // Overdue in the past
          createdAt: "2026-08-10T00:00:00Z",
          updatedAt: "2026-09-14T00:00:00Z",
        },
      ],
    },
    {
      id: 502,
      userId: "u-502",
      jobPostingId: 14,
      status: ApplicationStatus.DEPLOYED,
      isArchived: false,
      createdAt: "2026-08-12T08:00:00Z",
      updatedAt: "2026-09-20T08:00:00Z",
      user: {
        id: "u-502",
        email: "maria.santos@megs.ph",
        applicantProfile: {
          id: 2,
          userId: "u-502",
          firstName: "Maria",
          lastName: "Santos",
          mobileNumber: "+639189876543",
        } as any,
        employee: {
          id: 11,
          employeeNumber: "EMP-2026-0099",
          status: "ACTIVE",
        },
      },
      jobPosting: {
        id: 14,
        title: "Quality Inspector",
        postedById: "ta-1",
        description: "Assembly line inspection",
        requirements: "Experience needed",
        status: "ACTIVE" as any,
        createdAt: "2026-08-01T00:00:00Z",
        updatedAt: "2026-08-01T00:00:00Z",
        mrf: {
          id: 4,
          title: "Manufacturing QA",
          clientId: 41,
          client: {
            id: 41,
            name: "Apex Electronics",
          },
        },
      },
      deployments: [
        {
          id: 78,
          employeeId: 11,
          clientId: 41,
          status: DeploymentStatus.ACTIVE,
          contractStart: "2026-09-20",
          createdById: "ta-admin",
          createdAt: "2026-09-20T00:00:00Z",
          updatedAt: "2026-09-20T00:00:00Z",
        },
      ],
      complianceRequirements: [
        {
          id: 802,
          applicationId: 502,
          documentLabel: "NBI Clearance",
          isRequired: true,
          reviewStatus: "TO_FOLLOW",
          toFollowExpectedAt: "2099-12-31", // Distant future (healthy)
          createdAt: "2026-08-12T00:00:00Z",
          updatedAt: "2026-09-20T00:00:00Z",
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderComponent = (props: { hideHeader?: boolean } = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <PostDeploymentCompliancePage {...props} />
      </QueryClientProvider>
    );
  };

  it("renders 4-state UI: Loading state", () => {
    vi.mocked(taApi.getComplianceQueue).mockReturnValue(new Promise(() => {}));
    renderComponent();

    expect(screen.getByText("Loading post-deployment follow-up records...")).toBeDefined();
  });

  it("renders 4-state UI: Error state with retry", async () => {
    vi.mocked(taApi.getComplianceQueue).mockRejectedValue(new Error("Network Error"));
    renderComponent();

    expect(await screen.findByText("Failed to load post-deployment records.")).toBeDefined();

    const retryBtn = screen.getByRole("button", { name: /try again/i });
    expect(retryBtn).toBeDefined();
    fireEvent.click(retryBtn);
    expect(taApi.getComplianceQueue).toHaveBeenCalled();
  });

  it("renders 4-state UI: Empty state when no records are returned", async () => {
    vi.mocked(taApi.getComplianceQueue).mockResolvedValue([]);
    renderComponent();

    expect(await screen.findByText("No pending follow-up requirements")).toBeDefined();
    expect(
      screen.getByText("All deployed workers have verified compliance files.")
    ).toBeDefined();
  });

  it("renders high-density data table with worker details, badge, site assignment, and follow-up document", async () => {
    vi.mocked(taApi.getComplianceQueue).mockResolvedValue(mockActiveWorkers);
    renderComponent();

    // 1. Worker info & Employee badge
    const juanElements = await screen.findAllByText("Juan Dela Cruz");
    expect(juanElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("juan.delacruz@megs.ph").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("EMP-2026-0042").length).toBeGreaterThanOrEqual(1);

    // 2. Site Assignment
    expect(screen.getAllByText("Forklift Operator").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Acme Logistics").length).toBeGreaterThanOrEqual(1);

    // 3. Deployment Info
    expect(screen.getAllByText(/days on site/i).length).toBeGreaterThan(0);

    // 4. Missing/Follow-Up Document badge
    expect(screen.getAllByText("Fit to Work Medical Exam").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("NBI Clearance").length).toBeGreaterThanOrEqual(1);

    // 5. Target Due Date & Urgency badge
    expect(screen.getAllByText(/Overdue/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Target:/i).length).toBeGreaterThanOrEqual(1);

    // 6. Action button
    const reviewButtons = screen.getAllByRole("button", { name: "Quick review" });
    expect(reviewButtons.length).toBeGreaterThan(0);
  });

  it("filters workers by search input across name, job title, and client", async () => {
    vi.mocked(taApi.getComplianceQueue).mockResolvedValue(mockActiveWorkers);
    renderComponent();

    const juanElements = await screen.findAllByText("Juan Dela Cruz");
    expect(juanElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Maria Santos").length).toBeGreaterThanOrEqual(1);

    // Search by client name
    const searchInput = screen.getByPlaceholderText(/Search by candidate name/i);
    fireEvent.change(searchInput, { target: { value: "Apex" } });

    expect(screen.queryAllByText("Juan Dela Cruz").length).toBe(0);
    expect(screen.getAllByText("Maria Santos").length).toBeGreaterThanOrEqual(1);

    // Reset search
    fireEvent.change(searchInput, { target: { value: "" } });
    expect(screen.getAllByText("Juan Dela Cruz").length).toBeGreaterThanOrEqual(1);
  });

  it("filters workers by urgency level", async () => {
    vi.mocked(taApi.getComplianceQueue).mockResolvedValue(mockActiveWorkers);
    renderComponent();

    const juanElements = await screen.findAllByText("Juan Dela Cruz");
    expect(juanElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Maria Santos").length).toBeGreaterThanOrEqual(1);

    // Change urgency filter to OVERDUE
    const urgencySelect = screen.getByRole("combobox", { name: /Urgency/i });
    fireEvent.change(urgencySelect, { target: { value: "OVERDUE" } });

    expect(screen.getAllByText("Juan Dela Cruz").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText("Maria Santos").length).toBe(0);

    // Change urgency filter to HEALTHY
    fireEvent.change(urgencySelect, { target: { value: "HEALTHY" } });
    expect(screen.queryAllByText("Juan Dela Cruz").length).toBe(0);
    expect(screen.getAllByText("Maria Santos").length).toBeGreaterThanOrEqual(1);
  });

  it("opens quick review dialog and submits review decision", async () => {
    vi.mocked(taApi.getComplianceQueue).mockResolvedValue(mockActiveWorkers);
    vi.mocked(taApi.reviewComplianceRequirement).mockResolvedValue({
      id: 801,
      applicationId: 501,
      documentLabel: "Fit to Work Medical Exam",
      isRequired: true,
      reviewStatus: "APPROVED",
      createdAt: "2026-08-10T00:00:00Z",
      updatedAt: "2026-10-02T00:00:00Z",
    });

    renderComponent();

    const juanElements = await screen.findAllByText("Juan Dela Cruz");
    expect(juanElements.length).toBeGreaterThanOrEqual(1);

    const quickReviewButtons = screen.getAllByRole("button", { name: "Quick review" });
    fireEvent.click(quickReviewButtons[0]);

    // Dialog opens
    expect(await screen.findByRole("dialog")).toBeDefined();
    expect(screen.getByText(/Quick compliance review/i)).toBeDefined();

    // Select "APPROVED" decision
    const decisionSelect = screen.getByRole("combobox", { name: /Review decision/i });
    fireEvent.change(decisionSelect, { target: { value: "APPROVED" } });

    // Click Save review
    const saveButton = screen.getByRole("button", { name: "Save review" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(taApi.reviewComplianceRequirement).toHaveBeenCalledWith(
        801,
        expect.objectContaining({
          reviewStatus: "APPROVED",
        })
      );
    });
  });

  it("only displays target date field when reviewStatus is TO_FOLLOW and sends null when cleared", async () => {
    vi.mocked(taApi.getComplianceQueue).mockResolvedValue(mockActiveWorkers);
    vi.mocked(taApi.reviewComplianceRequirement).mockResolvedValue({
      id: 801,
      applicationId: 501,
      documentLabel: "Fit to Work Medical Exam",
      isRequired: true,
      reviewStatus: "TO_FOLLOW",
      toFollowExpectedAt: null,
      createdAt: "2026-08-10T00:00:00Z",
      updatedAt: "2026-10-02T00:00:00Z",
    });

    renderComponent();

    const juanElements = await screen.findAllByText("Juan Dela Cruz");
    expect(juanElements.length).toBeGreaterThanOrEqual(1);

    const quickReviewButtons = screen.getAllByRole("button", { name: "Quick review" });
    fireEvent.click(quickReviewButtons[0]);

    // Initial status for 801 is TO_FOLLOW, target date input should be visible
    expect(screen.getByText("Target completion date")).toBeDefined();

    // Change to APPROVED, target date input should be hidden
    const decisionSelect = screen.getByRole("combobox", { name: /Review decision/i });
    fireEvent.change(decisionSelect, { target: { value: "APPROVED" } });
    expect(screen.queryByText("Target completion date")).toBeNull();

    // Switch back to TO_FOLLOW and clear the date
    fireEvent.change(decisionSelect, { target: { value: "TO_FOLLOW" } });
    expect(screen.getByText("Target completion date")).toBeDefined();

    const dateInputs = document.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBeGreaterThan(0);
    fireEvent.change(dateInputs[0], { target: { value: "" } });

    // Click Save review
    const saveButton = screen.getByRole("button", { name: "Save review" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(taApi.reviewComplianceRequirement).toHaveBeenCalledWith(
        801,
        expect.objectContaining({
          reviewStatus: "TO_FOLLOW",
          toFollowExpectedAt: null,
        })
      );
    });
  });
});
