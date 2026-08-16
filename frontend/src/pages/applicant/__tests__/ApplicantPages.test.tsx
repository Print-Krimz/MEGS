import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApplicantDashboard } from "../ApplicantDashboard";
import { JobsPage } from "../JobsPage";
import { NotificationsPage } from "../NotificationsPage";
import { applicantApi } from "../../../lib/api/applicant.api";
import { applicantJobsApi } from "../../../lib/api/applicant-jobs.api";
import { notificationApi } from "../../../lib/api/notification.api";
import { ApplicationStatus, JobStatus } from "../../../lib/types/enums";

vi.mock("../../../lib/api/applicant.api");
vi.mock("../../../lib/api/applicant-jobs.api");
vi.mock("../../../lib/api/notification.api");
vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "maria@example.com", role: "APPLICANT" },
    isAuthenticated: true,
  }),
}));

// Mock tanstack router components
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
  useParams: () => ({ jobId: "123", applicationId: "123" }),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe("Applicant Interface Components", () => {
  it("renders ApplicantDashboard with candidate profile and application metrics", async () => {
    vi.mocked(applicantApi.getProfile).mockResolvedValueOnce({
      id: 1,
      userId: "u1",
      firstName: "Maria",
      lastName: "Santos",
      mobileNumber: "09181234567",
      gender: "FEMALE",
      province: "Laguna",
      city: "Calamba",
      dateOfBirth: "1995-05-10",
      birthPlace: "Laguna",
      nationality: "Filipino",
      civilStatus: "SINGLE",
      address: "Brgy. Real, Calamba City",
      resumeUrl: "https://storage/resume.pdf",
      photoUrl: "https://storage/photo.jpg",
      professionalSummary: "Experienced inventory officer",
      isActive: true,
      skills: ["Customer Service"],
      workExperiences: [],
      educations: [],
      trainings: [],
      characterReferences: [],
      assets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    vi.mocked(applicantJobsApi.getMyApplications).mockResolvedValueOnce([
      {
        id: 101,
        jobPostingId: 201,
        userId: "u1",
        status: ApplicationStatus.SUBMITTED,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        jobPosting: {
          id: 201,
          postedById: "ta-1",
          title: "Warehouse Inventory Clerk",
          location: "Calamba, Laguna",
          requirements: "High school graduate",
          description: "Responsible for inventory counts",
          status: JobStatus.OPEN,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    ]);

    vi.mocked(applicantJobsApi.getJobs).mockResolvedValueOnce([]);

    renderWithClient(<ApplicantDashboard />);

    expect(await screen.findByText("Welcome back, Maria")).toBeDefined();
    expect(screen.getByText("Warehouse Inventory Clerk")).toBeDefined();
    expect(screen.getByText("Total Submissions")).toBeDefined();
  });

  it("renders JobsPage with job requisition cards", async () => {
    vi.mocked(applicantJobsApi.getJobs).mockResolvedValueOnce([
      {
        id: 301,
        postedById: "ta-1",
        title: "Site Security Officer",
        location: "Batangas City",
        requirements: "Valid security guard license",
        description: "Enforce safety and site access protocols",
        status: JobStatus.OPEN,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    renderWithClient(<JobsPage />);

    expect(await screen.findByText("Site Security Officer")).toBeDefined();
    expect(screen.getByText("Enforce safety and site access protocols")).toBeDefined();
  });

  it("renders NotificationsPage with active notifications", async () => {
    vi.mocked(notificationApi.getNotifications).mockResolvedValueOnce([
      {
        id: 101,
        userId: "u1",
        title: "Initial Interview Scheduled",
        message: "Your interview with Talent Acquisition is scheduled for Monday 10:00 AM.",
        type: "INTERVIEW_SCHEDULED",
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    ]);

    renderWithClient(<NotificationsPage />);

    expect(await screen.findByText("Initial Interview Scheduled")).toBeDefined();
    expect(
      screen.getByText(
        "Your interview with Talent Acquisition is scheduled for Monday 10:00 AM."
      )
    ).toBeDefined();
  });
});
