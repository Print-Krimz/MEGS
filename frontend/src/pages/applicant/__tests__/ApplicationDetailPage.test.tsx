import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApplicationDetailPage } from "../ApplicationDetailPage";
import { applicantJobsApi } from "../../../lib/api/applicant-jobs.api";
import { ApplicationStatus, JobStatus } from "../../../lib/types/enums";

vi.mock("@tanstack/react-router", () => ({
  useParams: vi.fn(() => ({ applicationId: "123" })),
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../../../lib/api/applicant-jobs.api", () => ({
  applicantJobsApi: {
    getApplicationDetail: vi.fn(),
    uploadComplianceDocument: vi.fn(),
  },
}));

vi.mock("../../../lib/feedback", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/feedback")>();
  return {
    ...actual,
    notify: {
      success: vi.fn(),
      error: vi.fn(),
    },
  };
});

const mockJob = {
  id: 1,
  postedById: "recruiter-1",
  title: "Forklift Operator",
  description: "Operate heavy machinery at warehouse.",
  requirements: "Valid license and certificate",
  location: "Calamba, Laguna",
  status: JobStatus.OPEN,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

describe("ApplicationDetailPage - Post-Deployment Compliance Lifecycle", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchInterval: false,
        },
      },
    });
  });

  const renderWithClient = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    );
  };

  it("renders 'Requirements to follow up (Action needed)' and upload buttons for deployed applicant with pending items", async () => {
    vi.mocked(applicantJobsApi.getApplicationDetail).mockResolvedValue({
      id: 123,
      applicantId: "app-1",
      jobPostingId: 1,
      status: ApplicationStatus.DEPLOYED,
      createdAt: "2026-09-10T00:00:00.000Z",
      updatedAt: "2026-09-20T00:00:00.000Z",
      jobPosting: mockJob,
      interviews: [],
      complianceRequirements: [
        {
          id: 10,
          applicationId: 123,
          documentLabel: "Medical Clinic Result",
          isRequired: true,
          reviewStatus: "TO_FOLLOW",
          toFollowExpectedAt: "2026-10-15T00:00:00.000Z",
          createdAt: "2026-09-15T00:00:00.000Z",
          updatedAt: "2026-09-15T00:00:00.000Z",
        },
        {
          id: 11,
          applicationId: 123,
          documentLabel: "Barangay Clearance",
          isRequired: true,
          reviewStatus: "REJECTED",
          reviewNotes: "Document image is blurred.",
          deadline: "2026-10-20T00:00:00.000Z",
          createdAt: "2026-09-15T00:00:00.000Z",
          updatedAt: "2026-09-16T00:00:00.000Z",
        },
        {
          id: 12,
          applicationId: 123,
          documentLabel: "SSS E-1 Form",
          isRequired: true,
          reviewStatus: "APPROVED",
          documentId: 99,
          createdAt: "2026-09-15T00:00:00.000Z",
          updatedAt: "2026-09-16T00:00:00.000Z",
        },
      ],
    } as any);

    renderWithClient(<ApplicationDetailPage />);

    // Check banner header and description
    expect(
      await screen.findByText("Deployed to work site - Follow-up requirements pending")
    ).toBeInTheDocument();
    expect(
      screen.getByText("You are actively deployed. Upload your remaining requirements once available.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("2 requirement(s) pending follow-up")
    ).toBeInTheDocument();

    // Check grouped sections
    expect(
      screen.getByText("Requirements to follow up (Action needed)")
    ).toBeInTheDocument();
    expect(screen.getByText(/Medical Clinic Result/i)).toBeInTheDocument();
    expect(screen.getByText(/Barangay Clearance/i)).toBeInTheDocument();
    expect(screen.getByText("TO_FOLLOW")).toBeInTheDocument();
    expect(screen.getByText("REJECTED")).toBeInTheDocument();
    expect(screen.getByText("Document image is blurred.")).toBeInTheDocument();

    // Target date formatting
    expect(screen.getAllByText(/Target date:/i).length).toBe(2);

    // Upload buttons
    const uploadButtons = screen.getAllByRole("button", { name: /Upload File/i });
    expect(uploadButtons.length).toBe(2);

    // Verified 201 clearances section
    expect(screen.getByText("Verified 201 clearances")).toBeInTheDocument();
    expect(screen.getByText(/SSS E-1 Form/i)).toBeInTheDocument();
    expect(screen.getByText("1 verified")).toBeInTheDocument();
  });

  it("renders '100% Compliant' banner and 'Verified 201 clearances' for deployed applicant with all items approved", async () => {
    vi.mocked(applicantJobsApi.getApplicationDetail).mockResolvedValue({
      id: 124,
      applicantId: "app-1",
      jobPostingId: 1,
      status: ApplicationStatus.DEPLOYED,
      createdAt: "2026-09-10T00:00:00.000Z",
      updatedAt: "2026-09-20T00:00:00.000Z",
      jobPosting: mockJob,
      interviews: [],
      complianceRequirements: [
        {
          id: 20,
          applicationId: 124,
          documentLabel: "NBI Clearance",
          isRequired: true,
          reviewStatus: "APPROVED",
          documentId: 101,
          createdAt: "2026-09-15T00:00:00.000Z",
          updatedAt: "2026-09-16T00:00:00.000Z",
        },
        {
          id: 21,
          applicationId: 124,
          documentLabel: "Medical Exam Result",
          isRequired: true,
          reviewStatus: "APPROVED",
          documentId: 102,
          createdAt: "2026-09-15T00:00:00.000Z",
          updatedAt: "2026-09-16T00:00:00.000Z",
        },
      ],
    } as any);

    renderWithClient(<ApplicationDetailPage />);

    // Check completion banner
    expect(
      await screen.findByText("Deployed to work site - 100% Compliant")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "All pre-employment and post-deployment requirements are verified. Your 201 file is complete."
      )
    ).toBeInTheDocument();

    // Verified 201 clearances section
    expect(screen.getByText("Verified 201 clearances")).toBeInTheDocument();
    expect(screen.getByText(/NBI Clearance/i)).toBeInTheDocument();
    expect(screen.getByText(/Medical Exam Result/i)).toBeInTheDocument();

    // No pending section
    expect(
      screen.queryByText("Requirements to follow up (Action needed)")
    ).not.toBeInTheDocument();

    // Approved badges and view buttons
    expect(screen.getAllByText("Approved").length).toBe(2);
    expect(screen.getAllByRole("button", { name: /View/i }).length).toBe(2);
  });

  it("renders normal requirements checklist for non-deployed candidate", async () => {
    vi.mocked(applicantJobsApi.getApplicationDetail).mockResolvedValue({
      id: 125,
      applicantId: "app-1",
      jobPostingId: 1,
      status: ApplicationStatus.COMPLIANCE,
      createdAt: "2026-09-10T00:00:00.000Z",
      updatedAt: "2026-09-20T00:00:00.000Z",
      jobPosting: mockJob,
      interviews: [],
      complianceRequirements: [
        {
          id: 30,
          applicationId: 125,
          documentLabel: "Birth Certificate",
          isRequired: true,
          reviewStatus: "PENDING",
          createdAt: "2026-09-15T00:00:00.000Z",
          updatedAt: "2026-09-15T00:00:00.000Z",
        },
      ],
    } as any);

    renderWithClient(<ApplicationDetailPage />);

    // Normal requirements header
    expect(await screen.findByRole("heading", { name: "Requirements" })).toBeInTheDocument();
    expect(screen.getByText(/Birth Certificate/i)).toBeInTheDocument();

    // Deployed sections should not be present
    expect(
      screen.queryByText("Requirements to follow up (Action needed)")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Verified 201 clearances")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Deployed to work site -/i)
    ).not.toBeInTheDocument();
  });

  it("handles document upload submission for pending to-follow item", async () => {
    vi.mocked(applicantJobsApi.getApplicationDetail).mockResolvedValue({
      id: 123,
      applicantId: "app-1",
      jobPostingId: 1,
      status: ApplicationStatus.DEPLOYED,
      createdAt: "2026-09-10T00:00:00.000Z",
      updatedAt: "2026-09-20T00:00:00.000Z",
      jobPosting: mockJob,
      interviews: [],
      complianceRequirements: [
        {
          id: 10,
          applicationId: 123,
          documentLabel: "Medical Clinic Result",
          isRequired: true,
          reviewStatus: "TO_FOLLOW",
          toFollowExpectedAt: "2026-10-15T00:00:00.000Z",
          createdAt: "2026-09-15T00:00:00.000Z",
          updatedAt: "2026-09-15T00:00:00.000Z",
        },
      ],
    } as any);
    vi.mocked(applicantJobsApi.uploadComplianceDocument).mockResolvedValue({
      id: 55,
      requirementId: 10,
      fileName: "medical.pdf",
    });

    const { container } = renderWithClient(<ApplicationDetailPage />);

    expect(await screen.findByText(/Medical Clinic Result/i)).toBeInTheDocument();

    const uploadBtn = screen.getByRole("button", { name: /Upload File/i });
    fireEvent.click(uploadBtn);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const file = new File(["dummy content"], "medical.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(applicantJobsApi.uploadComplianceDocument).toHaveBeenCalledWith(10, file);
    });
  });
});
