// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MRFCreatePage } from "../MRFCreatePage";
import { taApi } from "../../../lib/api/ta.api";
import { notify } from "../../../lib/feedback";
import { MRF_ROLE_PRESETS, getMRFPresetById } from "../../../lib/mrf-presets";
import type { ManpowerRequest } from "../../../lib/types/ta.types";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
}));

vi.mock("../../../lib/api/ta.api", () => ({
  taApi: {
    listClients: vi.fn(),
    createMRF: vi.fn(),
    listMRFs: vi.fn(),
  },
}));

vi.mock("../../../lib/feedback", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
  formatErrorMessage: vi.fn((err: any) => err?.message || "An error occurred"),
}));

const mockClients = [
  {
    id: 101,
    name: "Apex Logistics Corp",
    tradeName: "Apex Logistics",
    industry: "Warehousing & Freight",
    street: "123 Warehouse Way",
    city: "Santa Rosa",
    province: "Laguna",
    postalCode: "4026",
    address: "123 Warehouse Way, Santa Rosa, Laguna, 4026",
    isActive: true,
  },
  {
    id: 102,
    name: "Global Freight Solutions",
    tradeName: "Global Freight",
    industry: "Maritime & Logistics",
    street: "456 Port Road",
    city: "General Trias",
    province: "Cavite",
    postalCode: "4107",
    address: "456 Port Road, General Trias, Cavite, 4107",
    isActive: true,
  },
];

const mockPastMRFs: ManpowerRequest[] = [
  {
    id: 12,
    clientId: 101,
    title: "Heavy Forklift Driver",
    headcount: 5,
    location: "Santa Rosa, Laguna",
    priority: "HIGH",
    status: "OPEN",
    requiredSkills: "Forklift Operation, Pallet Stacking, Safety NC II",
    requiredExperience: "3 years of relevant experience",
    requiredEducation: "Vocational / Technical Course (TESDA)",
    requiredCertifications: "TESDA NC II Forklift",
    description: "Operate heavy counterbalance forklifts in cold storage facility.",
    salaryRangeMin: 22000,
    salaryRangeMax: 28000,
    employmentType: "Full-Time",
    workArrangement: "On-site",
    ageMin: 21,
    ageMax: 45,
    genderPreference: "ANY",
    tattooPolicy: "ALLOWED",
    createdAt: "2026-03-15T08:00:00.000Z",
    updatedAt: "2026-03-15T08:00:00.000Z",
    createdById: "user-1",
    client: {
      id: 101,
      name: "Apex Logistics Corp",
      status: "ACTIVE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  },
  {
    id: 34,
    clientId: 102,
    title: "Cavite Warehouse Picker",
    headcount: 10,
    location: "Cavite Economic Zone",
    priority: "URGENT",
    status: "OPEN",
    requiredSkills: "RF Scanning, Picking, Packing, 5S",
    requiredExperience: "1 year of relevant experience",
    requiredEducation: "High School / Senior High School Graduate",
    requiredCertifications: "BOSH Safety",
    description: "Perform RF barcode scanning and outbound order fulfillment.",
    salaryRangeMin: 17000,
    salaryRangeMax: 23000,
    employmentType: "Contractual",
    workArrangement: "On-site",
    ageMin: 18,
    ageMax: 40,
    genderPreference: "ANY",
    tattooPolicy: "NO_VISIBLE",
    createdAt: "2026-03-20T08:00:00.000Z",
    updatedAt: "2026-03-20T08:00:00.000Z",
    createdById: "user-2",
    client: {
      id: 102,
      name: "Global Freight Solutions",
      status: "ACTIVE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  },
];

describe("MRFCreatePage Accelerators & Form Workflow", () => {
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

    vi.mocked(taApi.listClients).mockResolvedValue(mockClients as any);
    vi.mocked(taApi.listMRFs).mockResolvedValue(mockPastMRFs as any);
  });

  afterEach(() => {
    cleanup();
  });

  function renderPage() {
    return render(
      <QueryClientProvider client={queryClient}>
        <MRFCreatePage />
      </QueryClientProvider>
    );
  }

  it("Test 1: Renders Quick Fill Accelerators banner containing the 'Clone from Past MRF' button and 'Apply Role Template...' select dropdown", async () => {
    renderPage();

    // Verify main page header
    expect(screen.getByRole("heading", { level: 1, name: /Create manpower request/i })).toBeInTheDocument();

    // Verify Quick Fill Accelerators banner container and copy
    expect(screen.getByText("Quick Fill Accelerators")).toBeInTheDocument();
    expect(
      screen.getByText("Pre-fill specifications from industry templates or past requisitions")
    ).toBeInTheDocument();

    // Verify Clone from Past MRF button
    const cloneButton = screen.getByRole("button", { name: /Clone from Past MRF/i });
    expect(cloneButton).toBeInTheDocument();

    // Verify role template select dropdown with default placeholder and catalog items
    const templateSelect = screen.getByLabelText("Apply Role Template");
    expect(templateSelect).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Apply Role Template..." })).toBeInTheDocument();

    // Spot-check standard role presets in dropdown
    expect(screen.getByRole("option", { name: "Forklift Operator" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Warehouse Associate" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Production Line Assembler" })).toBeInTheDocument();
  });

  it("Test 2: Selecting 'Forklift Operator' from the role template dropdown immediately populates Title, Skills, Experience, Education, Certifications, and Job Description", async () => {
    renderPage();

    const templateSelect = screen.getByLabelText("Apply Role Template");
    const forkliftPreset = getMRFPresetById("forklift-operator")!;
    expect(forkliftPreset).toBeDefined();

    // Select Forklift Operator template
    fireEvent.change(templateSelect, { target: { value: "forklift-operator" } });

    // Assert inputs are immediately populated with preset specifications
    expect(screen.getByLabelText(/Request title/i)).toHaveValue(forkliftPreset.title);
    expect(screen.getByLabelText(/Required skills/i)).toHaveValue(forkliftPreset.requiredSkills);
    expect(screen.getByLabelText(/Required experience/i)).toHaveValue(forkliftPreset.requiredExperience);
    expect(screen.getByLabelText(/Minimum education/i)).toHaveValue(forkliftPreset.requiredEducation);
    expect(screen.getByLabelText(/Required certifications & licenses/i)).toHaveValue(forkliftPreset.requiredCertifications);
    expect(screen.getByLabelText(/Notes for this client/i)).toHaveValue(forkliftPreset.description);

    // Assert compensation and employment specifications are also pre-filled
    expect(screen.getByLabelText(/Minimum monthly salary/i)).toHaveValue(forkliftPreset.salaryMin);
    expect(screen.getByLabelText(/Maximum monthly salary/i)).toHaveValue(forkliftPreset.salaryMax);
    expect(screen.getByLabelText(/Employment Type/i)).toHaveValue(forkliftPreset.employmentType);
    expect(screen.getByLabelText(/Work Arrangement/i)).toHaveValue(forkliftPreset.workArrangement);

    // Verify feedback notification
    expect(notify.success).toHaveBeenCalledWith(
      "Template Applied",
      expect.stringContaining(forkliftPreset.label)
    );
  });

  it("Test 3: Clicking 'Clone from Past MRF' opens CloneMRFModal, displays past MRFs, and selecting a past MRF clones its fields into the form", async () => {
    renderPage();

    // Modal should initially be closed
    expect(screen.queryByRole("heading", { name: "Clone Past Manpower Request" })).not.toBeInTheDocument();

    // Click "Clone from Past MRF"
    const cloneButton = screen.getByRole("button", { name: /Clone from Past MRF/i });
    fireEvent.click(cloneButton);

    // Modal dialog opens
    expect(await screen.findByRole("heading", { name: "Clone Past Manpower Request" })).toBeInTheDocument();
    expect(taApi.listMRFs).toHaveBeenCalledWith({ sortBy: "createdAt" });

    // Wait for past MRFs to display
    expect(await screen.findByText(/Heavy Forklift Driver/i)).toBeInTheDocument();
    expect(screen.getByText(/Cavite Warehouse Picker/i)).toBeInTheDocument();

    // Select MRF #12 card to clone
    const mrfCard12 = await screen.findByTestId("mrf-card-12");
    const cloneCardButton = within(mrfCard12).getByRole("button", { name: /Clone Specification/i });
    fireEvent.click(cloneCardButton);

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Clone Past Manpower Request" })).not.toBeInTheDocument();
    });

    const targetMRF = mockPastMRFs[0];

    // Assert cloned form fields
    expect(screen.getByLabelText(/Request title/i)).toHaveValue(targetMRF.title);
    expect(screen.getByLabelText(/Number of workers needed/i)).toHaveValue(targetMRF.headcount);
    expect(screen.getByLabelText(/Priority/i)).toHaveValue(targetMRF.priority);
    expect(screen.getByLabelText(/Required skills/i)).toHaveValue(targetMRF.requiredSkills);
    expect(screen.getByLabelText(/Required experience/i)).toHaveValue(targetMRF.requiredExperience);
    expect(screen.getByLabelText(/Minimum education/i)).toHaveValue(targetMRF.requiredEducation);
    expect(screen.getByLabelText(/Required certifications & licenses/i)).toHaveValue(targetMRF.requiredCertifications);
    expect(screen.getByLabelText(/Notes for this client/i)).toHaveValue(targetMRF.description);
    expect(screen.getByLabelText(/Minimum monthly salary/i)).toHaveValue(targetMRF.salaryRangeMin);
    expect(screen.getByLabelText(/Maximum monthly salary/i)).toHaveValue(targetMRF.salaryRangeMax);
    expect(screen.getByLabelText(/Employment Type/i)).toHaveValue(targetMRF.employmentType);
    expect(screen.getByLabelText(/Work Arrangement/i)).toHaveValue(targetMRF.workArrangement);
    expect(screen.getByLabelText(/Minimum age/i)).toHaveValue(targetMRF.ageMin);
    expect(screen.getByLabelText(/Maximum age/i)).toHaveValue(targetMRF.ageMax);

    // Verify feedback notification
    expect(notify.success).toHaveBeenCalledWith(
      "MRF Cloned",
      expect.stringContaining(`MRF #${targetMRF.id}`)
    );
  });

  it("Test 4: Verifies client preservation logic: if a client is already chosen and preserveClient: true, the selected client is not replaced. If preserveClient: false, updates client and location", async () => {
    renderPage();

    await waitFor(() => expect(taApi.listClients).toHaveBeenCalled());

    // 1. Initial State: Select Client 102 (Global Freight Solutions)
    const clientInput = screen.getByPlaceholderText("Search or select client account...");
    fireEvent.focus(clientInput);

    const client102Option = await screen.findByRole("option", { name: /Global Freight Solutions/i });
    fireEvent.click(client102Option);

    expect(clientInput).toHaveValue("Global Freight Solutions (Global Freight)");
    expect(screen.getByLabelText(/Work site/i)).toHaveValue("456 Port Road, General Trias, Cavite, 4107");

    // 2. Open Clone Modal with preserveClient: true (default)
    const cloneButton = screen.getByRole("button", { name: /Clone from Past MRF/i });
    fireEvent.click(cloneButton);

    expect(await screen.findByRole("heading", { name: "Clone Past Manpower Request" })).toBeInTheDocument();

    const preserveCheckbox = screen.getByRole("checkbox", {
      name: /Keep currently selected client/i,
    });
    expect(preserveCheckbox).toBeChecked();

    // Clone MRF #12 which belongs to Client 101 (Apex Logistics Corp)
    const mrfCard12 = await screen.findByTestId("mrf-card-12");
    fireEvent.click(within(mrfCard12).getByRole("button", { name: /Clone Specification/i }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Clone Past Manpower Request" })).not.toBeInTheDocument();
    });

    // Verification: Client was PRESERVED as 102 and work site remained unchanged
    expect(clientInput).toHaveValue("Global Freight Solutions (Global Freight)");
    expect(screen.getByLabelText(/Work site/i)).toHaveValue("456 Port Road, General Trias, Cavite, 4107");
    expect(screen.getByLabelText(/Request title/i)).toHaveValue("Heavy Forklift Driver");

    // 3. Open Clone Modal again, this time UNCHECKING preserveClient (preserveClient: false)
    fireEvent.click(cloneButton);
    expect(await screen.findByRole("heading", { name: "Clone Past Manpower Request" })).toBeInTheDocument();

    const preserveCheckbox2 = screen.getByRole("checkbox", {
      name: /Keep currently selected client/i,
    });
    expect(preserveCheckbox2).toBeChecked();
    fireEvent.click(preserveCheckbox2);
    expect(preserveCheckbox2).not.toBeChecked();

    // Clone MRF #12 again
    const mrfCard12Second = await screen.findByTestId("mrf-card-12");
    fireEvent.click(within(mrfCard12Second).getByRole("button", { name: /Clone Specification/i }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Clone Past Manpower Request" })).not.toBeInTheDocument();
    });

    // Verification: Client and location were OVERWRITTEN from MRF #12
    expect(clientInput).toHaveValue("Apex Logistics Corp (Apex Logistics)");
    expect(screen.getByLabelText(/Work site/i)).toHaveValue("Santa Rosa, Laguna");
  });

  it("Test 5: Successful submission: After applying a preset, selecting client and date, submitting the form passes validation and invokes taApi.createMRF with the populated payload", async () => {
    vi.mocked(taApi.createMRF).mockResolvedValueOnce({
      id: 999,
      title: "Warehouse Associate / Material Handler",
    } as any);

    renderPage();

    await waitFor(() => expect(taApi.listClients).toHaveBeenCalled());

    // 1. Apply Preset: Warehouse Associate
    const templateSelect = screen.getByLabelText("Apply Role Template");
    const preset = getMRFPresetById("warehouse-associate")!;
    fireEvent.change(templateSelect, { target: { value: "warehouse-associate" } });

    expect(screen.getByLabelText(/Request title/i)).toHaveValue(preset.title);

    // 2. Select Client 101 (Apex Logistics Corp)
    const clientInput = screen.getByPlaceholderText("Search or select client account...");
    fireEvent.focus(clientInput);
    const client101Option = await screen.findByRole("option", { name: /Apex Logistics Corp/i });
    fireEvent.click(client101Option);

    // 3. Set target fill date
    const targetDate = "2026-12-15";
    fireEvent.change(screen.getByLabelText(/Target fill date/i), { target: { value: targetDate } });

    // 4. Submit form
    const submitButton = screen.getByRole("button", { name: /Create request/i });
    fireEvent.click(submitButton);

    // 5. Verify taApi.createMRF payload matches populated values
    await waitFor(() => {
      expect(taApi.createMRF).toHaveBeenCalledTimes(1);
    });

    expect(vi.mocked(taApi.createMRF).mock.calls[0][0]).toEqual({
      clientId: 101,
      title: preset.title,
      headcount: 1,
      priority: "NORMAL",
      location: "123 Warehouse Way, Santa Rosa, Laguna, 4026",
      targetFillDate: new Date(targetDate).toISOString(),
      requiredSkills: preset.requiredSkills,
      requiredExperience: preset.requiredExperience,
      requiredEducation: preset.requiredEducation,
      requiredCertifications: preset.requiredCertifications,
      description: preset.description,
      salaryRangeMin: preset.salaryMin,
      salaryRangeMax: preset.salaryMax,
      employmentType: preset.employmentType,
      workArrangement: preset.workArrangement,
      ageMin: null,
      ageMax: null,
      genderPreference: "ANY",
      tattooPolicy: "ALLOWED",
    });

    // 6. Verify mutation success side effects: toast & navigation
    await waitFor(() => {
      expect(notify.success).toHaveBeenCalledWith(
        "Manpower request created",
        expect.stringContaining("Request #999")
      );
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/ta/mrfs/$mrfId",
        params: { mrfId: "999" },
      });
    });
  });
});
