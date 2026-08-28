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

    // Switch to Resume & Photo tab
    const docsTabBtn = await screen.findByRole("button", { name: /Resume & Photo/i });
    fireEvent.click(docsTabBtn);

    // Look for resume upload input in Resume & Photo section
    const uploadInput = await screen.findByTestId("resume-autofill-upload-input");
    expect(uploadInput).toBeDefined();

    // Create a dummy PDF file
    const file = new File(["dummy pdf content"], "juan-resume.pdf", { type: "application/pdf" });
    fireEvent.change(uploadInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(applicantApi.uploadResume).toHaveBeenCalled();
    });

    // Switch back to Personal tab to review auto-filled information
    const personalTabBtn = await screen.findByRole("button", { name: /Personal/i });
    fireEvent.click(personalTabBtn);

    // Form fields should now be auto-filled
    await waitFor(() => {
      expect(screen.getByDisplayValue("Juan")).toBeDefined();
      expect(screen.getByDisplayValue("Dela Cruz")).toBeDefined();
      expect(screen.getByDisplayValue("09171234567")).toBeDefined();
      expect(screen.getByDisplayValue("1995-06-15")).toBeDefined();
      expect(screen.getByDisplayValue("Calamba City")).toBeDefined();
      expect(screen.getByDisplayValue("Filipino")).toBeDefined();
      expect(screen.getByDisplayValue("Roman Catholic")).toBeDefined();
      expect(screen.getByDisplayValue("173")).toBeDefined();
      expect(screen.getByDisplayValue("68")).toBeDefined();
      expect(screen.getByDisplayValue("Barangay Real, Calamba City")).toBeDefined();
      expect(screen.getByDisplayValue("Certified Logistics Specialist")).toBeDefined();
    });

    // Check for extracted indicators
    expect(screen.getAllByText(/Extracted from resume/i).length).toBeGreaterThan(0);

    // Switch to References tab and check that extracted character reference appears immediately
    const refTabBtn = await screen.findByRole("button", { name: /References/i });
    fireEvent.click(refTabBtn);
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

    // Switch to Resume & Photo tab
    const docsTabBtn = await screen.findByRole("button", { name: /Resume & Photo/i });
    fireEvent.click(docsTabBtn);

    const uploadInput = await screen.findByTestId("resume-autofill-upload-input");
    const file = new File(["dummy scanned content"], "scanned-resume.pdf", { type: "application/pdf" });
    fireEvent.change(uploadInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(applicantApi.uploadResume).toHaveBeenCalled();
    });

    // Switch to Personal tab to verify existing values
    const personalTabBtn = await screen.findByRole("button", { name: /Personal/i });
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

    // Switch to Resume & Photo tab
    const docsTabBtn = await screen.findByRole("button", { name: /Resume & Photo/i });
    fireEvent.click(docsTabBtn);

    const uploadInput = await screen.findByTestId("resume-autofill-upload-input");
    const file = new File(["dummy pdf content"], "maria-resume.pdf", { type: "application/pdf" });
    fireEvent.change(uploadInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(applicantApi.uploadResume).toHaveBeenCalled();
    });

    // Switch to Work History tab and check that extracted work experience is present
    const expTabBtn = await screen.findByRole("button", { name: /Work History/i });
    fireEvent.click(expTabBtn);
    expect(await screen.findByText("Global Logistics Corp")).toBeDefined();
    expect(screen.getByText("Warehouse Admin")).toBeDefined();

    // Switch to Education tab and check that extracted education is present
    const eduTabBtn = await screen.findByRole("button", { name: /Education/i });
    fireEvent.click(eduTabBtn);
    expect(await screen.findByText("Polytechnic University of the Philippines")).toBeDefined();
    expect(screen.getByText("BS Business")).toBeDefined();

    // Switch to Skills tab and check that extracted skills are present
    const skillsTabBtn = await screen.findByRole("button", { name: /Skills/i });
    fireEvent.click(skillsTabBtn);
    expect(await screen.findByText("Supply Chain")).toBeDefined();
    expect(screen.getByText("Inventory Control")).toBeDefined();
  });
});

