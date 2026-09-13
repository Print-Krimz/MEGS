import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProfilePage } from "../ProfilePage";
import { applicantApi } from "../../../lib/api/applicant.api";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
  useBlocker: () => ({ status: "idle" }),
  useParams: () => ({}),
}));

vi.mock("../../../lib/api/applicant.api", () => ({
  applicantApi: {
    getProfile: vi.fn(),
    upsertProfile: vi.fn(),
    addWorkExperience: vi.fn(),
    deleteWorkExperience: vi.fn(),
    addEducation: vi.fn(),
    deleteEducation: vi.fn(),
    updateSkills: vi.fn(),
    addTraining: vi.fn(),
    deleteTraining: vi.fn(),
    addReference: vi.fn(),
    deleteReference: vi.fn(),
    addAsset: vi.fn(),
    deleteAsset: vi.fn(),
    uploadPhoto: vi.fn(),
    uploadResume: vi.fn(),
  },
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "adrian@example.com", role: "APPLICANT" },
    refreshUser: vi.fn(),
  }),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("ProfilePage HCI Overhaul", () => {
  it("opens on a concise Overview and switches semantic profile sections", async () => {
    vi.mocked(applicantApi.getProfile).mockResolvedValueOnce({
      id: 1,
      userId: "u1",
      firstName: "Adrian",
      lastName: "Reyes",
      mobileNumber: "0917-845-2391",
      address: "Antipolo City, Rizal",
      workExperiences: [
        { id: 10, roleTitle: "Junior Web Dev", company: "TechNova", startDate: "2024-01-01", isCurrent: true, summary: "Built APIs" },
      ],
      educations: [
        { id: 20, degree: "Bachelor of Science", school: "State University", startDate: "2020-01-01", fieldOfStudy: "IT" },
      ],
      skills: ["React", "TypeScript"],
      trainings: [
        { id: 30, title: "Web Dev Workshop", provider: "DICT" },
      ],
      characterReferences: [],
      assets: [],
    } as any);

    renderWithClient(<ProfilePage />);

    expect(await screen.findByRole("heading", { name: "Overview" })).toBeDefined();
    expect(screen.getByRole("tablist", { name: "Candidate profile sections" })).toBeDefined();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(screen.getByRole("tab", { name: "Personal Info" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Experience & Education" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Applications" })).toBeDefined();

    // Switch to the combined qualifications section
    const qualificationsTab = screen.getByRole("tab", { name: "Experience & Education" });
    fireEvent.click(qualificationsTab);

    expect(await screen.findByText("Junior Web Dev")).toBeDefined();
    expect(screen.getByText("TechNova")).toBeDefined();

    // Open the Skills disclosure inside the combined section
    const skillsDisclosure = screen.getByRole("button", { name: /^Skills/ });
    fireEvent.click(skillsDisclosure);

    expect(await screen.findByText("React")).toBeDefined();
    expect(screen.getByText("TypeScript")).toBeDefined();
  });

  it("renders personal demographic fields including religion, height, and weight in personal information form", async () => {
    vi.mocked(applicantApi.getProfile).mockResolvedValueOnce({
      id: 1,
      userId: "u1",
      firstName: "Adrian",
      lastName: "Reyes",
      gender: "Male",
      civilStatus: "Single",
      nationality: "Filipino",
      religion: "Roman Catholic",
      height: 175,
      weight: 70,
      workExperiences: [],
      educations: [],
      skills: [],
      trainings: [],
      characterReferences: [],
      assets: [],
    } as any);

    renderWithClient(<ProfilePage />);

    // Switch to the Personal Info tab
    const personalTab = await screen.findByRole("tab", { name: "Personal Info" });
    fireEvent.click(personalTab);

    // Verify professional personal fields in default open disclosure (Identity & Contact)
    expect(screen.getByLabelText(/First Name/i)).toBeDefined();
    expect(screen.getByLabelText(/Last Name/i)).toBeDefined();

    // Open the Background disclosure which houses demographics
    const backgroundDisclosure = screen.getByRole("button", { name: /^Background/ });
    fireEvent.click(backgroundDisclosure);

    // Verify demographic fields are rendered
    expect(screen.getByLabelText(/Gender/i)).toBeDefined();
    expect(screen.getByLabelText(/Civil Status/i)).toBeDefined();
    expect(screen.getByLabelText(/Nationality/i)).toBeDefined();
    expect(screen.getByLabelText(/Religion/i)).toBeDefined();
    expect(screen.getByLabelText(/Height \(cm\)/i)).toBeDefined();
    expect(screen.getByLabelText(/Weight \(kg\)/i)).toBeDefined();
    expect(screen.getByLabelText(/Preferred Work Locations/i)).toBeDefined();
  });
});
