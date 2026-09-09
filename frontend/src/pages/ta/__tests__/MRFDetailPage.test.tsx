import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MRFDetailPage } from "../MRFDetailPage";
import { taApi } from "../../../lib/api/ta.api";

// Mock useParams
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useParams: () => ({ mrfId: "12" }),
  useNavigate: () => vi.fn(),
}));

// Mock taApi
vi.mock("../../../lib/api/ta.api", () => ({
  taApi: {
    getMRFDetails: vi.fn(),
    listJobs: vi.fn(),
    linkJobToMRF: vi.fn(),
    addMRFComplianceTemplate: vi.fn(),
    removeMRFComplianceTemplate: vi.fn(),
    updateMRF: vi.fn(),
  },
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const mockMRFWithData = {
  id: 12,
  title: "Senior Logistics Coordinator",
  headcount: 3,
  location: "Taguig City",
  status: "OPEN",
  priority: "HIGH",
  targetFillDate: "2026-10-01T00:00:00.000Z",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  clientId: 5,
  createdById: "user-test-01",
  description: "Coordinates regional warehouse inbound and outbound logistics.",
  requiredSkills: "Inventory management, ERP SAP, Forklift safety",
  client: {
    id: 5,
    name: "TransGlobal Logistics",
    industry: "Supply Chain",
    contactEmail: "ops@transglobal.ph",
  },
  jobPostings: [
    {
      id: 201,
      title: "Warehouse Logistics Officer",
      location: "Taguig Hub",
      status: "PUBLISHED",
      isEvergreen: false,
    },
    {
      id: 202,
      title: "Inventory Control Specialist",
      location: "Taguig Hub",
      status: "PUBLISHED",
      isEvergreen: true,
    },
  ],
  complianceTemplates: [
    { id: 1, documentLabel: "NBI Clearance", isRequired: true },
    { id: 2, documentLabel: "Forklift Operator Certification", isRequired: true },
  ],
  deployments: [
    {
      id: 501,
      status: "ACTIVE",
      site: "Taguig Hub Alpha",
      contractStart: "2026-09-01",
      contractEnd: "2027-09-01",
      employee: {
        id: 77,
        employeeNumber: "EMP-2026-0077",
        user: {
          email: "juan.delacruz@example.com",
          applicantProfile: {
            firstName: "Juan",
            lastName: "Dela Cruz",
            mobileNumber: "+639171234567",
          },
        },
      },
    },
    {
      id: 502,
      status: "DEPLOYED",
      site: "Taguig Hub Beta",
      contractStart: "2026-09-05",
      contractEnd: "2027-09-05",
      employee: {
        id: 88,
        employeeNumber: "EMP-2026-0088",
        user: {
          email: "maria.santos@example.com",
          applicantProfile: {
            firstName: "Maria",
            lastName: "Santos",
            mobileNumber: "+639189876543",
          },
        },
      },
    },
  ],
  fulfillment: {
    deployedCount: 2,
    fulfillmentRate: 67,
    remainingCount: 1,
    isFulfilled: false,
  },
};

describe("MRFDetailPage Tabbed Navigation & Search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(taApi.getMRFDetails).mockResolvedValue(mockMRFWithData as unknown as any);
    vi.mocked(taApi.listJobs).mockResolvedValue([]);
  });

  it("renders the 3 operational tabs with badges", async () => {
    renderWithClient(<MRFDetailPage />);

    expect(await screen.findByRole("heading", { name: "Senior Logistics Coordinator" })).toBeDefined();

    // Verify Tab buttons exist
    const deploymentsTab = screen.getByRole("tab", { name: /Deployed Personnel/i });
    const jobsTab = screen.getByRole("tab", { name: /Linked Job Openings/i });
    const specsTab = screen.getByRole("tab", { name: /Order Specifications/i });

    expect(deploymentsTab).toBeDefined();
    expect(jobsTab).toBeDefined();
    expect(specsTab).toBeDefined();

    // Badges inside tabs
    expect(deploymentsTab.textContent).toContain("2 / 3");
    expect(jobsTab.textContent).toContain("2");
  });

  it("switches tabs when clicked without unmounting DOM content", async () => {
    renderWithClient(<MRFDetailPage />);

    await screen.findByRole("heading", { name: "Senior Logistics Coordinator" });

    // Initially on Deployed Personnel tab
    expect(screen.getByText("Juan Dela Cruz")).toBeDefined();

    // Click on Linked Job Openings tab
    const jobsTab = screen.getByRole("tab", { name: /Linked Job Openings/i });
    fireEvent.click(jobsTab);

    // Linked job postings are clearly visible
    expect(screen.getByText("Warehouse Logistics Officer")).toBeDefined();
    expect(screen.getByText("Inventory Control Specialist")).toBeDefined();

    // Click on Order Specifications tab
    const specsTab = screen.getByRole("tab", { name: /Order Specifications/i });
    fireEvent.click(specsTab);

    // Specifications and compliance templates are visible
    expect(screen.getByText(/Coordinates regional warehouse inbound and outbound logistics/)).toBeDefined();
    expect(screen.getByText("Forklift Operator Certification")).toBeDefined();
  });

  it("filters deployed personnel in real-time by worker name, employee ID, or site", async () => {
    renderWithClient(<MRFDetailPage />);

    await screen.findByRole("heading", { name: "Senior Logistics Coordinator" });

    const searchInput = screen.getByPlaceholderText(/Search deployed personnel/i);
    expect(searchInput).toBeDefined();

    // Filter by name "Maria"
    fireEvent.change(searchInput, { target: { value: "Maria" } });

    expect(screen.getByText("Maria Santos")).toBeDefined();
    expect(screen.queryByText("Juan Dela Cruz")).toBeNull();

    // Filter by employee ID "0077"
    fireEvent.change(searchInput, { target: { value: "0077" } });

    expect(screen.getByText("Juan Dela Cruz")).toBeDefined();
    expect(screen.queryByText("Maria Santos")).toBeNull();

    // Filter by site "Beta"
    fireEvent.change(searchInput, { target: { value: "Beta" } });

    expect(screen.getByText("Maria Santos")).toBeDefined();
    expect(screen.queryByText("Juan Dela Cruz")).toBeNull();

    // Clear search
    fireEvent.change(searchInput, { target: { value: "" } });
    expect(screen.getByText("Juan Dela Cruz")).toBeDefined();
    expect(screen.getByText("Maria Santos")).toBeDefined();
  });
});
