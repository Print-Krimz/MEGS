import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminMRFDetailPage } from "../AdminMRFDetailPage";
import { adminApi } from "../../../lib/api/admin.api";

// Mock useParams
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useParams: () => ({ mrfId: "42" }),
  useNavigate: () => vi.fn(),
}));

// Mock adminApi
vi.mock("../../../lib/api/admin.api", () => ({
  adminApi: {
    getMRFDetails: vi.fn(),
  },
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("AdminMRFDetailPage Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state while fetching MRF details", () => {
    vi.mocked(adminApi.getMRFDetails).mockReturnValue(new Promise(() => {}));
    renderWithClient(<AdminMRFDetailPage />);
    expect(screen.getByText("Loading request details...")).toBeDefined();
  });

  it("renders friendly not found state when MRF record does not exist", async () => {
    const notFoundError = new Error("Manpower Request not found");
    (notFoundError as any).status = 404;
    vi.mocked(adminApi.getMRFDetails).mockRejectedValue(notFoundError);
    renderWithClient(<AdminMRFDetailPage />);
    expect(await screen.findByText("Manpower Request Not Available")).toBeDefined();
    expect(screen.getByText(/was not found or may have been deleted/)).toBeDefined();
    expect(screen.getByRole("button", { name: /Return to Notifications/i })).toBeDefined();
  });

  it("renders error state when MRF details query fails with generic error", async () => {
    vi.mocked(adminApi.getMRFDetails).mockRejectedValue(new Error("Network failure"));
    renderWithClient(<AdminMRFDetailPage />);
    expect(await screen.findByText("Unable to load this information")).toBeDefined();
    expect(screen.getByRole("button", { name: /Try Again/i })).toBeDefined();
  });

  it("renders comprehensive read-only MRF details in Admin layout context", async () => {
    const mockMRF = {
      id: 42,
      title: "Senior Full Stack Developer",
      headcount: 2,
      location: "Makati City, Metro Manila",
      status: "OPEN",
      priority: "HIGH",
      targetFillDate: "2026-09-15T00:00:00.000Z",
      createdAt: "2026-08-20T00:00:00.000Z",
      description: "Looking for an experienced TypeScript and React engineer to lead recruitment platform modules.",
      requiredSkills: "TypeScript, React 19, PostgreSQL, Node.js",
      requiredExperience: "5+ years full-stack development",
      client: {
        id: 10,
        name: "Acme Corporation",
        industry: "Enterprise Software",
        contactEmail: "hr@acme.corp",
      },
      jobPostings: [
        {
          id: 101,
          title: "Full Stack Engineer - Core Platform",
          location: "Makati City",
          status: "PUBLISHED",
        },
      ],
      complianceTemplates: [
        { id: 1, documentLabel: "NBI Clearance", isRequired: true },
        { id: 2, documentLabel: "Fit to Work Medical Exam", isRequired: true },
      ],
    };

    vi.mocked(adminApi.getMRFDetails).mockResolvedValue(mockMRF);
    renderWithClient(<AdminMRFDetailPage />);

    // Title & Header
    expect(await screen.findByRole("heading", { name: "Senior Full Stack Developer", level: 1 })).toBeDefined();
    expect(screen.getByText(/MRF Reference #42/)).toBeDefined();
    expect(screen.getByText(/Read-Only Oversight/)).toBeDefined();

    // Breadcrumbs
    const breadcrumbs = screen.getByRole("navigation", { name: /Breadcrumb/i });
    expect(breadcrumbs).toBeDefined();
    expect(screen.getByRole("link", { name: "Administration" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Notifications" })).toBeDefined();

    // Metrics
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("OPEN")).toBeDefined();
    expect(screen.getByText("Priority: HIGH")).toBeDefined();

    // Description & Skills
    expect(screen.getByText(/Looking for an experienced TypeScript and React engineer/)).toBeDefined();
    expect(screen.getByText("TypeScript, React 19, PostgreSQL, Node.js")).toBeDefined();
    expect(screen.getByText("5+ years full-stack development")).toBeDefined();

    // Linked Job Requisition
    expect(screen.getByText("Full Stack Engineer - Core Platform")).toBeDefined();
    expect(screen.getByText("Requisition #101")).toBeDefined();

    // Client Info
    expect(screen.getAllByText("Acme Corporation").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Industry: Enterprise Software")).toBeDefined();

    // Compliance templates
    expect(screen.getByText("NBI Clearance")).toBeDefined();
    expect(screen.getByText("Fit to Work Medical Exam")).toBeDefined();
    expect(screen.getAllByText("Mandatory").length).toBe(2);

    // Back to notifications button
    expect(screen.getByRole("button", { name: /Back to Notifications/i })).toBeDefined();
  });

  it("renders the 3 operational tabs with badges and switches between them smoothly", async () => {
    const mockMRFWithDeployments = {
      id: 42,
      title: "Senior Full Stack Developer",
      headcount: 2,
      location: "Makati City, Metro Manila",
      status: "OPEN",
      priority: "HIGH",
      targetFillDate: "2026-09-15T00:00:00.000Z",
      createdAt: "2026-08-20T00:00:00.000Z",
      description: "Looking for an experienced TypeScript and React engineer.",
      requiredSkills: "TypeScript, React 19",
      requiredExperience: "5+ years",
      client: {
        id: 10,
        name: "Acme Corporation",
        industry: "Enterprise Software",
        contactEmail: "hr@acme.corp",
      },
      jobPostings: [
        {
          id: 101,
          title: "Full Stack Engineer - Core Platform",
          location: "Makati City",
          status: "PUBLISHED",
          isEvergreen: true,
        },
      ],
      complianceTemplates: [
        { id: 1, documentLabel: "NBI Clearance", isRequired: true },
      ],
      deployments: [
        {
          id: 501,
          status: "ACTIVE",
          site: "Makati Alpha",
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
      ],
      fulfillment: {
        deployedCount: 1,
        fulfillmentRate: 50,
        remainingCount: 1,
        isFulfilled: false,
      },
    };

    vi.mocked(adminApi.getMRFDetails).mockResolvedValue(mockMRFWithDeployments as any);
    renderWithClient(<AdminMRFDetailPage />);

    await screen.findByRole("heading", { name: "Senior Full Stack Developer", level: 1 });

    // Verify 3 tabs exist with role="tab"
    const deploymentsTab = screen.getByRole("tab", { name: /Deployed Personnel/i });
    const jobsTab = screen.getByRole("tab", { name: /Linked Job Openings/i });
    const specsTab = screen.getByRole("tab", { name: /Order Specifications/i });

    expect(deploymentsTab).toBeDefined();
    expect(jobsTab).toBeDefined();
    expect(specsTab).toBeDefined();

    // Tab badges
    expect(deploymentsTab.textContent).toContain("1 / 2");
    expect(jobsTab.textContent).toContain("1");
    expect(specsTab.textContent).toContain("1 reqs");

    // Initially active tab is Deployed Personnel
    expect(screen.getByText("Juan Dela Cruz")).toBeDefined();
    expect(screen.getByText("EMP-2026-0077")).toBeDefined();

    // Click on Linked Job Openings tab
    fireEvent.click(jobsTab);
    expect(screen.getByText("Full Stack Engineer - Core Platform")).toBeDefined();
    expect(screen.getByText("Keep Open After Fill")).toBeDefined();

    // Click on Order Specifications tab
    fireEvent.click(specsTab);
    expect(screen.getByText(/Looking for an experienced TypeScript and React engineer/)).toBeDefined();
    expect(screen.getByText("NBI Clearance")).toBeDefined();
  });

  it("filters deployed personnel in real-time by worker name, employee ID, or site", async () => {
    const mockMRFWithTwoDeployments = {
      id: 42,
      title: "Senior Full Stack Developer",
      headcount: 2,
      status: "OPEN",
      client: { name: "Acme Corporation" },
      jobPostings: [],
      complianceTemplates: [],
      deployments: [
        {
          id: 501,
          status: "ACTIVE",
          site: "Makati Alpha",
          employee: {
            id: 77,
            employeeNumber: "EMP-2026-0077",
            user: {
              email: "juan@example.com",
              applicantProfile: { firstName: "Juan", lastName: "Dela Cruz" },
            },
          },
        },
        {
          id: 502,
          status: "DEPLOYED",
          site: "Taguig Beta",
          employee: {
            id: 88,
            employeeNumber: "EMP-2026-0088",
            user: {
              email: "maria@example.com",
              applicantProfile: { firstName: "Maria", lastName: "Santos" },
            },
          },
        },
      ],
    };

    vi.mocked(adminApi.getMRFDetails).mockResolvedValue(mockMRFWithTwoDeployments as any);
    renderWithClient(<AdminMRFDetailPage />);

    await screen.findByRole("heading", { name: "Senior Full Stack Developer", level: 1 });

    const searchInput = screen.getByPlaceholderText(/Search deployed personnel/i);
    expect(searchInput).toBeDefined();

    // Search for Maria
    fireEvent.change(searchInput, { target: { value: "Maria" } });
    expect(screen.getByText("Maria Santos")).toBeDefined();
    expect(screen.queryByText("Juan Dela Cruz")).toBeNull();

    // Search for employee number 0077
    fireEvent.change(searchInput, { target: { value: "0077" } });
    expect(screen.getByText("Juan Dela Cruz")).toBeDefined();
    expect(screen.queryByText("Maria Santos")).toBeNull();

    // Clear search
    fireEvent.change(searchInput, { target: { value: "" } });
    expect(screen.getByText("Juan Dela Cruz")).toBeDefined();
    expect(screen.getByText("Maria Santos")).toBeDefined();
  });
});
