import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApplicantDashboard } from "../ApplicantDashboard";
import { ApplicationDetailPage } from "../ApplicationDetailPage";
import { MyApplicationsPage } from "../MyApplicationsPage";
import { applicantApi } from "../../../lib/api/applicant.api";
import { applicantJobsApi } from "../../../lib/api/applicant-jobs.api";
import { ApplicationStatus, JobStatus } from "../../../lib/types/enums";

vi.mock("../../../lib/api/applicant.api", () => ({
  applicantApi: {
    getProfile: vi.fn(),
    upsertProfile: vi.fn(),
    addWorkExperience: vi.fn(),
    deleteWorkExperience: vi.fn(),
    addEducation: vi.fn(),
    deleteEducation: vi.fn(),
    addSkill: vi.fn(),
    deleteSkill: vi.fn(),
    addTraining: vi.fn(),
    deleteTraining: vi.fn(),
    addReference: vi.fn(),
    deleteReference: vi.fn(),
  },
}));

vi.mock("../../../lib/api/applicant-jobs.api", () => ({
  applicantJobsApi: {
    getJobs: vi.fn(),
    getJobDetail: vi.fn(),
    applyForJob: vi.fn(),
    getMyApplications: vi.fn(),
    getApplicationDetail: vi.fn(),
  },
}));

vi.mock("../../../lib/api/notification.api", () => ({
  notificationApi: {
    getUnreadCount: vi.fn().mockResolvedValue({ count: 0 }),
    getNotifications: vi.fn().mockResolvedValue([]),
    markAsRead: vi.fn().mockResolvedValue({ id: 1, isRead: true }),
    markAllAsRead: vi.fn().mockResolvedValue({ count: 0 }),
  },
}));

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

    expect(await screen.findByRole("heading", { name: /Maria/i })).toBeDefined();
    expect(screen.getByText("Warehouse Inventory Clerk")).toBeDefined();
    expect(screen.getByText("Applications")).toBeDefined();
  });

  it("renders ApplicationDetailPage with candidate-friendly Future Opportunities wording and supporting message when status is TALENT_POOL", async () => {
    vi.mocked(applicantJobsApi.getApplicationDetail).mockResolvedValueOnce({
      id: 101,
      jobPostingId: 201,
      userId: "u1",
      status: ApplicationStatus.TALENT_POOL,
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      jobPosting: {
        id: 201,
        postedById: "ta-1",
        title: "Logistics Specialist",
        location: "Laguna Technopark",
        requirements: "Logistics experience",
        description: "Oversee warehouse logistics and distribution",
        status: JobStatus.OPEN,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      complianceRequirements: [],
      interviews: [],
    } as any);

    renderWithClient(<ApplicationDetailPage />);

    // Must show Future Opportunities badge / banner
    const badges = await screen.findAllByText("Future Opportunities");
    expect(badges.length).toBeGreaterThan(0);
    // Must not show Talent Pool
    expect(screen.queryByText(/^Talent Pool$/i)).toBeNull();

    // Must show the candidate-friendly supporting message
    expect(
      await screen.findByText(
        "You were not selected for this position, but your profile may be considered for future job opportunities that match your qualifications."
      )
    ).toBeDefined();
  });

  it("renders MyApplicationsPage with Future Opportunities badge for pooled applications", async () => {
    vi.mocked(applicantJobsApi.getMyApplications).mockResolvedValueOnce([
      {
        id: 101,
        jobPostingId: 201,
        userId: "u1",
        status: ApplicationStatus.TALENT_POOL,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        jobPosting: {
          id: 201,
          postedById: "ta-1",
          title: "Senior Forklift Operator",
          location: "Calamba, Laguna",
          requirements: "Heavy equipment license",
          description: "Operate forklift safely",
          status: JobStatus.OPEN,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    ]);

    renderWithClient(<MyApplicationsPage />);

    // Must show Future Opportunities badge / banner
    const badges = await screen.findAllByText("Future Opportunities");
    expect(badges.length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Talent Pool$/i)).toBeNull();
    expect(screen.getByText("Senior Forklift Operator")).toBeDefined();

    // Must show supporting message on the application card
    expect(
      await screen.findByText(
        "You were not selected for this position, but your profile may be considered for future job opportunities that match your qualifications."
      )
    ).toBeDefined();
  });


  it("renders ApplicantDashboard displaying Future Opportunities without counting TALENT_POOL as in-progress", async () => {
    vi.mocked(applicantApi.getProfile).mockResolvedValueOnce({
      id: 1,
      userId: "u1",
      firstName: "Maria",
      lastName: "Santos",
      mobileNumber: "09181234567",
      isActive: true,
      skills: [],
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
        status: ApplicationStatus.TALENT_POOL,
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

    // Badge on dashboard must show Future Opportunities
    expect(await screen.findByText("Future Opportunities")).toBeDefined();
    expect(screen.queryByText(/^Talent Pool$/i)).toBeNull();

    // Verify counter displays
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
  });
});
