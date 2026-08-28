import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
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
    expect(screen.getByText("Acme Corporation")).toBeDefined();
    expect(screen.getByText("Industry: Enterprise Software")).toBeDefined();

    // Compliance templates
    expect(screen.getByText("NBI Clearance")).toBeDefined();
    expect(screen.getByText("Fit to Work Medical Exam")).toBeDefined();
    expect(screen.getAllByText("Mandatory").length).toBe(2);

    // Back to notifications button
    expect(screen.getByRole("button", { name: /Back to Notifications/i })).toBeDefined();
  });
});
