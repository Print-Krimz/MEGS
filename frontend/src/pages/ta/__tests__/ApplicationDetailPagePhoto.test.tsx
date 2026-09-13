import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { taApi } from "../../../lib/api/ta.api";
import { ApplicationDetailPage } from "../ApplicationDetailPage";
import { ApplicationStatus } from "../../../lib/types/enums";

vi.mock("../../../lib/api/ta.api", () => ({
  taApi: {
    getApplication: vi.fn(),
    updateApplicationStatus: vi.fn(),
    recordEndorsement: vi.fn(),
    getRecruiterDecisions: vi.fn().mockResolvedValue([]),
    listClients: vi.fn().mockResolvedValue([
      { id: 1, name: "Acme Corp", industry: "Engineering", isActive: true },
    ]),
    listJobs: vi.fn().mockResolvedValue([]),
    listApplications: vi.fn(),
    archiveApplication: vi.fn(),
    restoreApplication: vi.fn(),
    getSimilarCandidates: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../lib/api/documents.api", () => ({
  documentsApi: {
    getPreview: vi.fn(),
    getDownloadUrl: vi.fn((id) => `/api/documents/${id}/download`),
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

describe("Candidate Identification Photo on TA Application Detail", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const renderWithClient = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    );
  };

  it("renders candidate photo with signed URL and allows full photo inspection", async () => {
    const mockApp = {
      id: 101,
      status: ApplicationStatus.SUBMITTED,
      jobPostingId: "job-1",
      jobPosting: {
        id: "job-1",
        title: "Site Supervisor",
        location: "Manila",
        requirements: [],
        mrf: {
          id: 10,
          title: "MRF Site Supervisor",
          clientId: 1,
          client: { id: 1, name: "Acme Corp" },
        },
      },
      user: {
        id: "usr-cand-1",
        email: "carlos@example.com",
        applicantProfile: {
          id: 50,
          firstName: "Carlos",
          lastName: "Mendoza",
          mobileNumber: "+639171234567",
          photoUrl: "https://mock-storage.supabase.co/signed/carlos-avatar.jpg?token=abc",
          skills: ["Electrical", "Safety"],
          workExperiences: [],
          educations: [],
          trainings: [],
          assets: [],
          characterReferences: [],
        },
      },
      candidateScores: [],
      interviews: [],
      complianceRequirements: [],
      clientEndorsements: [],
    };

    vi.mocked(taApi.getApplication).mockResolvedValue(mockApp as any);

    renderWithClient(<ApplicationDetailPage />);

    // Verify Identification Photo and candidate profile are visible immediately on initial view
    expect(await screen.findByText("Personal & Contact Demographics")).toBeDefined();
    expect(await screen.findByText("Application Resume (CV)")).toBeDefined();

    // Verify img element has the resolved signed URL
    const img = screen.getByAltText("Profile") as HTMLImageElement;
    expect(img).toBeDefined();
    expect(img.src).toContain("https://mock-storage.supabase.co/signed/carlos-avatar.jpg?token=abc");

    // Click profile photo avatar to inspect
    fireEvent.click(img);

    // Verify DocumentPreviewModal is opened displaying the photo
    expect(await screen.findByRole("dialog")).toBeDefined();
    expect(screen.getAllByText("Carlos Mendoza").length).toBeGreaterThanOrEqual(1);
  });

  it("renders fallback avatar when candidate has no photo uploaded", async () => {
    const mockApp = {
      id: 101,
      status: ApplicationStatus.SUBMITTED,
      jobPostingId: "job-1",
      jobPosting: {
        id: "job-1",
        title: "Site Supervisor",
        location: "Manila",
        requirements: [],
        mrf: {
          id: 10,
          title: "MRF Site Supervisor",
          clientId: 1,
          client: { id: 1, name: "Acme Corp" },
        },
      },
      user: {
        id: "usr-cand-2",
        email: "maria@example.com",
        applicantProfile: {
          id: 51,
          firstName: "Maria",
          lastName: "Santos",
          mobileNumber: "+639189876543",
          photoUrl: null,
          skills: [],
          workExperiences: [],
          educations: [],
          trainings: [],
          assets: [],
          characterReferences: [],
        },
      },
      candidateScores: [],
      interviews: [],
      complianceRequirements: [],
      clientEndorsements: [],
    };

    vi.mocked(taApi.getApplication).mockResolvedValue(mockApp as any);

    renderWithClient(<ApplicationDetailPage />);

    expect(await screen.findByText("Personal & Contact Demographics")).toBeDefined();
    expect(screen.getByText("MS")).toBeDefined();
    expect(screen.getByText("No Resume Attached")).toBeDefined();
  });

  it("opens candidate resume in DocumentPreviewModal using latest resolved resumeUrl", async () => {
    const mockApp = {
      id: 101,
      status: ApplicationStatus.SUBMITTED,
      jobPostingId: "job-1",
      resumeUrl: "https://mock-storage.supabase.co/signed/candidate-new-resume.pdf?token=xyz",
      jobPosting: {
        id: "job-1",
        title: "Site Supervisor",
        location: "Manila",
        requirements: [],
        mrf: null,
      },
      user: {
        id: "usr-cand-3",
        email: "juan@example.com",
        applicantProfile: {
          id: 52,
          firstName: "Juan",
          lastName: "Dela Cruz",
          photoUrl: null,
          resumeUrl: "https://mock-storage.supabase.co/signed/candidate-new-resume.pdf?token=xyz",
          skills: [],
          workExperiences: [],
          educations: [],
          trainings: [],
          assets: [],
          characterReferences: [],
        },
      },
      candidateScores: [],
      interviews: [],
      complianceRequirements: [],
      clientEndorsements: [],
    };

    vi.mocked(taApi.getApplication).mockResolvedValue(mockApp as any);

    renderWithClient(<ApplicationDetailPage />);

    expect(await screen.findByText("Application Resume (CV)")).toBeDefined();

    // Verify inline iframe has resolved resume URL
    const iframe = screen.getByTitle("Juan Dela Cruz - Application Resume") as HTMLIFrameElement;
    expect(iframe).toBeDefined();
    expect(iframe.src).toContain("candidate-new-resume.pdf");

    // Click Fullscreen button to open modal
    const fullscreenBtn = screen.getByRole("button", { name: /Open Fullscreen/i });
    fireEvent.click(fullscreenBtn);

    // Verify modal is open and has iframe or viewer with the signed resume URL
    expect(await screen.findByRole("dialog")).toBeDefined();
    expect(screen.getAllByText("Application Resume (CV)").length).toBeGreaterThanOrEqual(1);
  });

  it("collapses resume panel when Hide Resume is clicked and restores when View Resume is clicked", async () => {
    const mockApp = {
      id: 101,
      status: ApplicationStatus.SUBMITTED,
      jobPostingId: "job-1",
      resumeUrl: "https://mock-storage.supabase.co/signed/resume.pdf",
      jobPosting: {
        id: "job-1",
        title: "Site Supervisor",
        location: "Manila",
        requirements: [],
        mrf: null,
      },
      user: {
        id: "usr-cand-4",
        email: "elena@example.com",
        applicantProfile: {
          id: 53,
          firstName: "Elena",
          lastName: "Reyes",
          photoUrl: null,
          resumeUrl: "https://mock-storage.supabase.co/signed/resume.pdf",
          skills: [],
          workExperiences: [],
          educations: [],
          trainings: [],
          assets: [],
          characterReferences: [],
        },
      },
      candidateScores: [],
      interviews: [],
      complianceRequirements: [],
      clientEndorsements: [],
    };

    vi.mocked(taApi.getApplication).mockResolvedValue(mockApp as any);

    renderWithClient(<ApplicationDetailPage />);

    // Initial desktop view: Resume panel is visible
    expect(await screen.findByText("Application Resume (CV)")).toBeDefined();

    // Click Hide Resume button
    const hideBtn = screen.getByRole("button", { name: /Hide Resume/i });
    fireEvent.click(hideBtn);

    // Resume panel should be collapsed
    expect(screen.queryByText("Application Resume (CV)")).toBeNull();

    // "View Resume" button should now be visible
    const viewResumeBtn = screen.getByRole("button", { name: /View Resume/i });
    expect(viewResumeBtn).toBeDefined();

    // Click View Resume button
    fireEvent.click(viewResumeBtn);

    // Resume panel should be restored
    expect(await screen.findByText("Application Resume (CV)")).toBeDefined();
  });

  it("prioritizes Employment History before Competencies & Skills in recruiter screening flow", async () => {
    const mockApp = {
      id: 101,
      status: ApplicationStatus.SUBMITTED,
      jobPostingId: "job-1",
      resumeUrl: "https://mock-storage.supabase.co/signed/resume.pdf",
      jobPosting: {
        id: "job-1",
        title: "Site Supervisor",
        location: "Manila",
        requirements: [],
        mrf: null,
      },
      user: {
        id: "usr-cand-5",
        email: "screening@example.com",
        applicantProfile: {
          id: 54,
          firstName: "Roberto",
          lastName: "Cruz",
          photoUrl: null,
          resumeUrl: "https://mock-storage.supabase.co/signed/resume.pdf",
          skills: ["AutoCAD", "Safety Inspection"],
          workExperiences: [
            {
              id: 1,
              roleTitle: "Lead Inspector",
              company: "BuildCorp",
              startDate: "2020-01-01",
              endDate: "2023-01-01",
              isCurrent: false,
              summary: "Site supervision and compliance audits",
            },
          ],
          educations: [
            {
              id: 1,
              degree: "BS Civil Engineering",
              school: "Mapua University",
              fieldOfStudy: "Civil Engineering",
            },
          ],
          trainings: [],
          assets: [],
          characterReferences: [],
        },
      },
      candidateScores: [],
      interviews: [],
      complianceRequirements: [],
      clientEndorsements: [],
    };

    vi.mocked(taApi.getApplication).mockResolvedValue(mockApp as any);

    renderWithClient(<ApplicationDetailPage />);

    const demographicsHeading = await screen.findByText("Personal & Contact Demographics");
    const requisitionHeading = screen.getByText("Target Job Requisition");
    const suitabilityHeading = screen.getByText("Suitability Match");
    const employmentHeading = screen.getByText("Employment History");
    const educationHeading = screen.getByText("Educational Attainment");
    const skillsHeading = screen.getByText("Competencies & Skills");

    expect(demographicsHeading).toBeDefined();
    expect(requisitionHeading).toBeDefined();
    expect(suitabilityHeading).toBeDefined();
    expect(employmentHeading).toBeDefined();
    expect(educationHeading).toBeDefined();
    expect(skillsHeading).toBeDefined();

    // Verify DOM order: Employment History comes before Competencies & Skills
    expect(employmentHeading.compareDocumentPosition(skillsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("remembers resume collapsed state when switching between candidate sub-tabs", async () => {
    const mockApp = {
      id: 101,
      status: ApplicationStatus.SUBMITTED,
      jobPostingId: "job-1",
      resumeUrl: "https://mock-storage.supabase.co/signed/resume.pdf",
      jobPosting: {
        id: "job-1",
        title: "Site Supervisor",
        location: "Manila",
        requirements: [],
        mrf: null,
      },
      user: {
        id: "usr-cand-6",
        email: "persist@example.com",
        applicantProfile: {
          id: 55,
          firstName: "Teresa",
          lastName: "Diaz",
          photoUrl: null,
          resumeUrl: "https://mock-storage.supabase.co/signed/resume.pdf",
          skills: [],
          workExperiences: [],
          educations: [],
          trainings: [],
          assets: [],
          characterReferences: [],
        },
      },
      candidateScores: [],
      interviews: [],
      complianceRequirements: [],
      clientEndorsements: [],
    };

    vi.mocked(taApi.getApplication).mockResolvedValue(mockApp as any);

    renderWithClient(<ApplicationDetailPage />);

    // Collapse resume
    expect(await screen.findByText("Application Resume (CV)")).toBeDefined();
    const hideBtn = screen.getByRole("button", { name: /Hide Resume/i });
    fireEvent.click(hideBtn);
    expect(screen.queryByText("Application Resume (CV)")).toBeNull();
    expect(screen.getByRole("button", { name: /View Resume/i })).toBeDefined();

    // Switch to Compliance & Deployment tab
    const complianceTab = screen.getByRole("tab", { name: /Compliance & Deployment/i });
    fireEvent.click(complianceTab);
    expect(screen.getByText("Pre-Employment Requirements Checklist")).toBeDefined();

    // Switch back to Candidate & Evaluation tab
    const evalTab = screen.getByRole("tab", { name: /Candidate & Evaluation/i });
    fireEvent.click(evalTab);

    // Verify resume panel remains collapsed and View Resume is still visible
    expect(screen.queryByText("Application Resume (CV)")).toBeNull();
    expect(screen.getByRole("button", { name: /View Resume/i })).toBeDefined();
  });
});
