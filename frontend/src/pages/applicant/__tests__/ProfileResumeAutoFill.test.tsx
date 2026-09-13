import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProfilePage } from "../ProfilePage";
import { applicantApi } from "../../../lib/api/applicant.api";

vi.mock("../../../lib/api/applicant.api");
vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "maria@example.com", role: "APPLICANT" },
    isAuthenticated: true,
    refreshUser: vi.fn(),
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
  useBlocker: () => ({ status: "idle" }),
  useParams: () => ({}),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe("ProfilePage Resume Auto-Fill & Extraction UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads resume, extracts data, and automatically fills empty personal fields with visual indicators", async () => {
    let currentProfile: any = {
      id: 1,
      userId: "u1",
      firstName: "",
      lastName: "",
      mobileNumber: "",
      address: "",
      province: "",
      city: "",
      professionalSummary: "",
      isActive: true,
      skills: [],
      workExperiences: [],
      educations: [],
      trainings: [],
      characterReferences: [],
      assets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(applicantApi.getProfile).mockImplementation(async () => currentProfile);

    const updatedProfile = {
      id: 1,
      userId: "u1",
      firstName: "",
      lastName: "",
      gender: "Male",
      dateOfBirth: "1995-06-15T00:00:00.000Z",
      birthPlace: "Calamba City",
      nationality: "Filipino",
      civilStatus: "Single",
      religion: "Roman Catholic",
      height: 173,
      weight: 68,
      isActive: true,
      resumeUrl: "/api/documents/100/download",
      characterReferences: [
        {
          id: 1,
          applicantProfileId: 1,
          name: "Engr. Roberto Gomez",
          relationship: "Operations Manager",
          phone: "09181234567",
          email: "roberto@example.com",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(applicantApi.uploadResume).mockImplementationOnce(async () => {
      currentProfile = updatedProfile;
      return {
        profile: updatedProfile,
        resumeUrl: "/api/documents/100/download",
        extractionStatus: "SUCCESS",
        extractedData: {
          firstName: "Juan",
          lastName: "Dela Cruz",
          mobileNumber: "09171234567",
          dateOfBirth: "1995-06-15",
          birthPlace: "Calamba City",
          gender: "Male",
          nationality: "Filipino",
          civilStatus: "Single",
          religion: "Roman Catholic",
          height: 173,
          weight: 68,
          province: "Laguna",
          city: "Calamba",
          address: "Barangay Real, Calamba City",
          professionalSummary: "Certified Logistics Specialist",
          skills: ["Forklift Operation", "Inventory Management"],
          workExperiences: [
            {
              company: "Apex Warehouse Logistics",
              roleTitle: "Inventory Supervisor",
              startDate: "2020-01-01",
            },
          ],
          educations: [
            {
              school: "Laguna University",
              degree: "BS Industrial Technology",
            },
          ],
          trainings: [
            {
              title: "TESDA NC II Forklift",
            },
          ],
          characterReferences: [
            {
              name: "Engr. Roberto Gomez",
              relationship: "Operations Manager",
              phone: "09181234567",
              email: "roberto@example.com",
            },
          ],
        },
      };
    });

    renderWithClient(<ProfilePage />);

    // Resume upload is visible on the first Overview section
    const uploadInput = await screen.findByTestId("resume-autofill-upload-input");
    expect(uploadInput).toBeDefined();

    // Create a dummy PDF file
    const file = new File(["dummy pdf content"], "juan-resume.pdf", { type: "application/pdf" });
    fireEvent.change(uploadInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(applicantApi.uploadResume).toHaveBeenCalled();
    });
    expect(await screen.findByText("Resume parsed — your profile has been filled automatically. Review the details below.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Review filled details" })).toBeDefined();

    // Switch back to Personal tab to review auto-filled information
    const personalTabBtn = await screen.findByRole("tab", { name: "Personal Info" });
    fireEvent.click(personalTabBtn);

    // Core identity and contact fields should now be auto-filled
    await waitFor(() => {
      expect(screen.getByDisplayValue("Juan")).toBeDefined();
      expect(screen.getByDisplayValue("Dela Cruz")).toBeDefined();
      expect(screen.getByDisplayValue("09171234567")).toBeDefined();
      expect(screen.getByDisplayValue("1995-06-15")).toBeDefined();
    });

    // Expand the progressive Background section for secondary fields
    fireEvent.click(await screen.findByRole("button", { name: /^Background/ }));
    await waitFor(() => {
      expect(screen.getByDisplayValue("Filipino")).toBeDefined();
      expect(screen.getByDisplayValue("Roman Catholic")).toBeDefined();
      expect(screen.getByDisplayValue("173")).toBeDefined();
      expect(screen.getByDisplayValue("68")).toBeDefined();
    });

    // Address and summary remain available through their own disclosures
    fireEvent.click(await screen.findByRole("button", { name: /^Address & work preferences/ }));
    await waitFor(() => {
      expect(screen.getByDisplayValue("Barangay Real, Calamba City")).toBeDefined();
    });
    fireEvent.click(await screen.findByRole("button", { name: /^Professional summary/ }));
    await waitFor(() => {
      expect(screen.getByDisplayValue("Certified Logistics Specialist")).toBeDefined();
    });

    // Check for extracted indicators
    expect(screen.getAllByText(/Extracted from resume/i).length).toBeGreaterThan(0);

    // Switch to Qualifications and expand References
    const qualificationsTab = await screen.findByRole("tab", { name: "Experience & Education" });
    fireEvent.click(qualificationsTab);
    const refDisclosure = await screen.findByRole("button", { name: /^References/ });
    fireEvent.click(refDisclosure);
    expect(await screen.findByText("Engr. Roberto Gomez")).toBeDefined();
    expect(screen.getByText(/09181234567/)).toBeDefined();
  });

  it("handles extraction unavailable gracefully and keeps form editable", async () => {
    vi.mocked(applicantApi.getProfile).mockResolvedValue({
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

    vi.mocked(applicantApi.uploadResume).mockResolvedValueOnce({
      profile: {
        id: 1,
        userId: "u1",
        firstName: "Maria",
        lastName: "Santos",
        isActive: true,
        resumeUrl: "/api/documents/101/download",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      resumeUrl: "/api/documents/101/download",
      extractionStatus: "UNAVAILABLE",
      extractedData: null,
    });

    renderWithClient(<ProfilePage />);

    const uploadInput = await screen.findByTestId("resume-autofill-upload-input");
    const file = new File(["dummy scanned content"], "scanned-resume.pdf", { type: "application/pdf" });
    fireEvent.change(uploadInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(applicantApi.uploadResume).toHaveBeenCalled();
    });

    expect(await screen.findByText(/couldn't fill profile details from this file/i)).toBeDefined();

    // Switch to Personal tab to verify existing values
    const personalTabBtn = await screen.findByRole("tab", { name: "Personal Info" });
    fireEvent.click(personalTabBtn);

    // Existing fields remain intact and editable
    expect(screen.getByDisplayValue("Maria")).toBeDefined();
    expect(screen.getByDisplayValue("Santos")).toBeDefined();
  });

  it("populates extracted work experiences, education, and skills into applicant profile immediately upon upload", async () => {
    let currentProfile: any = {
      id: 1,
      userId: "u1",
      firstName: "Maria",
      lastName: "Santos",
      isActive: true,
      skills: [],
      workExperiences: [],
      educations: [],
      trainings: [],
      characterReferences: [],
      assets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(applicantApi.getProfile).mockImplementation(async () => currentProfile);

    const updatedProfile = {
      id: 1,
      userId: "u1",
      firstName: "Maria",
      lastName: "Santos",
      isActive: true,
      resumeUrl: "/api/documents/102/download",
      skills: [{ id: 1, name: "Supply Chain" }, { id: 2, name: "Inventory Control" }],
      workExperiences: [
        {
          id: 1,
          applicantProfileId: 1,
          company: "Global Logistics Corp",
          roleTitle: "Warehouse Admin",
          startDate: "2021-01-01",
          isCurrent: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      educations: [
        {
          id: 1,
          applicantProfileId: 1,
          school: "Polytechnic University of the Philippines",
          degree: "BS Business",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      trainings: [
        {
          id: 1,
          applicantProfileId: 1,
          title: "Six Sigma Yellow Belt",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      characterReferences: [],
      assets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(applicantApi.uploadResume).mockImplementationOnce(async () => {
      currentProfile = updatedProfile;
      return {
        profile: updatedProfile,
        resumeUrl: "/api/documents/102/download",
        extractionStatus: "SUCCESS",
        extractedData: {
          workExperiences: [
            { company: "Global Logistics Corp", roleTitle: "Warehouse Admin", startDate: "2021-01-01" },
          ],
          educations: [
            { school: "Polytechnic University of the Philippines", degree: "BS Business" },
          ],
          skills: ["Supply Chain", "Inventory Control"],
          trainings: [
            { title: "Six Sigma Yellow Belt" },
          ],
        },
      };
    });

    renderWithClient(<ProfilePage />);

    const uploadInput = await screen.findByTestId("resume-autofill-upload-input");
    const file = new File(["dummy pdf content"], "maria-resume.pdf", { type: "application/pdf" });
    fireEvent.change(uploadInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(applicantApi.uploadResume).toHaveBeenCalled();
    });

    // Switch to Qualifications and check extracted work experience
    const qualificationsTab = await screen.findByRole("tab", { name: "Experience & Education" });
    fireEvent.click(qualificationsTab);
    expect(await screen.findByText("Global Logistics Corp")).toBeDefined();
    expect(screen.getByText("Warehouse Admin")).toBeDefined();

    // Expand Education and check that extracted education is present
    const eduDisclosure = await screen.findByRole("button", { name: /^Education/ });
    fireEvent.click(eduDisclosure);
    expect(await screen.findByText("Polytechnic University of the Philippines")).toBeDefined();
    expect(screen.getByText("BS Business")).toBeDefined();

    // Expand Skills and check that extracted skills are present
    const skillsDisclosure = await screen.findByRole("button", { name: /^Skills/ });
    fireEvent.click(skillsDisclosure);
    expect(await screen.findByText("Supply Chain")).toBeDefined();
    expect(screen.getByText("Inventory Control")).toBeDefined();
  });

  it("shows an actionable error when resume upload fails", async () => {
    vi.mocked(applicantApi.getProfile).mockResolvedValue({
      id: 1,
      userId: "u1",
      firstName: "Maria",
      lastName: "Santos",
      isActive: true,
      skills: [],
      workExperiences: [],
      educations: [],
      trainings: [],
      characterReferences: [],
      assets: [],
    } as any);
    vi.mocked(applicantApi.uploadResume).mockRejectedValueOnce(new Error("Network unavailable"));

    renderWithClient(<ProfilePage />);
    const input = await screen.findByTestId("resume-autofill-upload-input");
    fireEvent.change(input, { target: { files: [new File(["pdf"], "resume.pdf", { type: "application/pdf" })] } });

    expect((await screen.findByRole("alert")).textContent).toContain("Failed to upload resume: Network unavailable");
  });

  it("displays aligned Resume and Candidate Photo boxes stating 5 MB limits and enforces 5 MB validation", async () => {
    const profile = {
      id: 1,
      userId: "u1",
      firstName: "Maria",
      lastName: "Santos",
      mobileNumber: "09171234567",
      resumeUrl: null,
      photoUrl: null,
      isActive: true,
      skills: [],
      workExperiences: [],
      educations: [],
      trainings: [],
      characterReferences: [],
      assets: [],
    };

    vi.mocked(applicantApi.getProfile).mockResolvedValue(profile as any);

    renderWithClient(<ProfilePage />);

    // Resume is visible on the first Overview section
    expect(await screen.findByText("Save time on profile setup")).toBeDefined();
    expect(screen.getByText(/PDF only, up to 5 MB/i)).toBeDefined();
    expect(screen.getByText("Change photo")).toBeDefined();

    // Verify the photo upload affordance
    expect(screen.getByText(/PNG or JPG up to 5 MB/i)).toBeDefined();

    // The Overview exposes photo management without a second document card
    expect(screen.getByText("Candidate photo")).toBeDefined();

    // Test oversize photo file rejection (> 5MB)
    const photoInput = screen.getByTestId("photo-upload-input");
    const largePhoto = new File(["a".repeat(100)], "large-avatar.png", { type: "image/png" });
    Object.defineProperty(largePhoto, "size", { value: 6 * 1024 * 1024 });
    fireEvent.change(photoInput, { target: { files: [largePhoto] } });

    expect(await screen.findByText(/Maximum photo upload size is 5 MB/i)).toBeDefined();
    expect(applicantApi.uploadPhoto).not.toHaveBeenCalled();

    // Test oversize resume file rejection (> 5MB) from the same first section
    const resumeInput = screen.getByTestId("resume-autofill-upload-input");
    expect(screen.getByText("No resume uploaded yet")).toBeDefined();
    const largeResume = new File(["a".repeat(100)], "large-cv.pdf", { type: "application/pdf" });
    Object.defineProperty(largeResume, "size", { value: 6 * 1024 * 1024 });
    fireEvent.change(resumeInput, { target: { files: [largeResume] } });

    expect(await screen.findByText(/Maximum resume upload size is 5 MB/i)).toBeDefined();
    expect(applicantApi.uploadResume).not.toHaveBeenCalled();

    // Test valid photo upload under 5MB triggers uploadPhoto
    fireEvent.click(await screen.findByRole("tab", { name: "Overview" }));
    const overviewPhotoInput = screen.getByTestId("photo-upload-input");
    vi.mocked(applicantApi.uploadPhoto).mockResolvedValueOnce({
      photoUrl: "/api/documents/200/download",
    } as any);

    const validPhoto = new File(["valid image content"], "avatar.png", { type: "image/png" });
    Object.defineProperty(validPhoto, "size", { value: 1.5 * 1024 * 1024 });
    fireEvent.change(overviewPhotoInput, { target: { files: [validPhoto] } });

    await waitFor(() => {
      expect(applicantApi.uploadPhoto).toHaveBeenCalledTimes(1);
    });
  });

  it("replaces existing resume, updates existing profile fields, and opens resume preview with direct fileUrl", async () => {
    let currentProfile: any = {
      id: 1,
      userId: "u1",
      firstName: "OldFirst",
      lastName: "OldLast",
      mobileNumber: "09111111111",
      address: "Old Address",
      province: "Old Province",
      city: "Old City",
      professionalSummary: "Old Professional Summary",
      resumeUrl: "https://storage.supabase.co/applicant-assets/old-resume.pdf",
      isActive: true,
      skills: ["OldSkill"],
      workExperiences: [],
      educations: [],
      trainings: [],
      characterReferences: [],
      assets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(applicantApi.getProfile).mockImplementation(async () => currentProfile);

    const newResumeUrl = "https://storage.supabase.co/applicant-assets/new-resume.pdf";
    const updatedProfile = {
      ...currentProfile,
      firstName: "UpdatedFirst",
      lastName: "UpdatedLast",
      mobileNumber: "09998887777",
      address: "New Tech Boulevard",
      city: "Makati City",
      province: "Metro Manila",
      professionalSummary: "Senior Systems Architect with 8+ years experience",
      resumeUrl: newResumeUrl,
      skills: [{ id: 1, name: "Cloud Architecture" }, { id: 2, name: "Node.js" }],
    };

    vi.mocked(applicantApi.uploadResume).mockImplementationOnce(async () => {
      currentProfile = updatedProfile;
      return {
        profile: updatedProfile,
        resumeUrl: newResumeUrl,
        extractionStatus: "SUCCESS",
        extractedData: {
          firstName: "UpdatedFirst",
          lastName: "UpdatedLast",
          mobileNumber: "09998887777",
          address: "New Tech Boulevard",
          city: "Makati City",
          province: "Metro Manila",
          professionalSummary: "Senior Systems Architect with 8+ years experience",
          skills: ["Cloud Architecture", "Node.js"],
        },
      };
    });

    renderWithClient(<ProfilePage />);

    expect(await screen.findByText("Replace resume")).toBeDefined();
    const input = screen.getByTestId("resume-autofill-upload-input");
    const file = new File(["new pdf data"], "new-resume.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(applicantApi.uploadResume).toHaveBeenCalledTimes(1);
    });

    // Verify "View PDF" button triggers preview with new resumeUrl
    const viewPdfBtn = await screen.findByRole("button", { name: "View PDF" });
    fireEvent.click(viewPdfBtn);

    // Switch to Personal Info tab to verify updated fields
    const personalTabBtn = await screen.findByRole("tab", { name: "Personal Info" });
    fireEvent.click(personalTabBtn);

    await waitFor(() => {
      expect(screen.getByDisplayValue("UpdatedFirst")).toBeDefined();
      expect(screen.getByDisplayValue("UpdatedLast")).toBeDefined();
      expect(screen.getByDisplayValue("09998887777")).toBeDefined();
    });

    // Expand Professional summary
    fireEvent.click(await screen.findByRole("button", { name: /^Professional summary/ }));
    await waitFor(() => {
      expect(screen.getByDisplayValue("Senior Systems Architect with 8+ years experience")).toBeDefined();
    });
  });
});
