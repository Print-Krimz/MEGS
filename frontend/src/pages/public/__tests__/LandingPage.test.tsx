import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LandingPage } from "../LandingPage";
import { applicantJobsApi } from "../../../lib/api/applicant-jobs.api";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, search, ...props }: any) => {
    const searchString = search ? `?${new URLSearchParams(search).toString()}` : "";
    return (
      <a href={`${to}${searchString}`} data-search={JSON.stringify(search)} {...props}>
        {children}
      </a>
    );
  },
  useNavigate: () => mockNavigate,
  useSearch: () => ({}),
  useParams: () => ({}),
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("../../../lib/api/applicant-jobs.api", () => ({
  applicantJobsApi: {
    getJobs: vi.fn(),
    getJobById: vi.fn(),
  },
}));

const mockJobs = [
  {
    id: 1,
    title: "Warehouse Inventory Associate",
    description: "Manage incoming stock and inventory logistics in warehouse.",
    location: "Valenzuela, Metro Manila",
    status: "OPEN",
    createdAt: "2026-03-01T08:00:00.000Z",
    mrf: {
      employmentType: "FULL_TIME",
      client: {
        name: "Star Meg",
        industry: "Logistics",
      },
    },
  },
  {
    id: 2,
    title: "Logistics Operations Lead",
    description: "Supervise daily transport and supply chain dispatch operations.",
    location: "Quezon City, Metro Manila",
    status: "OPEN",
    createdAt: "2026-03-02T08:00:00.000Z",
    mrf: {
      employmentType: "REGULAR",
      client: {
        name: "Global Freight Corp",
        industry: "Supply Chain",
      },
    },
  },
];

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe("Redesigned MEGS LandingPage (Canva Unified Hub)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    (applicantJobsApi.getJobs as any).mockResolvedValue(mockJobs);
  });

  it("renders the hero with Canva slogan, dual CTAs, and credibility badges", async () => {
    renderWithClient(<LandingPage />);

    expect(
      screen.getByRole("heading", { name: /Better People for Better Results\./i })
    ).toBeDefined();

    expect(
      screen.getByText(/Serving Top 1,000 Corporations Since May 1997/i)
    ).toBeDefined();

    expect(
      screen.getByRole("link", { name: /Explore Open Roles/i })
    ).toBeDefined();

    expect(
      screen.getByRole("link", { name: /Request Manpower Proposal/i })
    ).toBeDefined();
  });

  it("renders the prominent job search bar with inputs and popular specializations", async () => {
    renderWithClient(<LandingPage />);

    const keywordInput = screen.getByLabelText(/Job title or keyword/i);
    const locationInput = screen.getAllByLabelText(/Location/i)[0];
    const searchButton = screen.getByRole("button", { name: /^Search Jobs$/i });

    expect(keywordInput).toBeDefined();
    expect(locationInput).toBeDefined();
    expect(searchButton).toBeDefined();

    expect(screen.getByText(/Popular specializations:/i)).toBeDefined();
    expect(screen.getAllByRole("button", { name: "Forklift Operator" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Warehouse Crew" }).length).toBeGreaterThan(0);
  });

  it("renders the navigation header with brand seal, anchor links and auth actions", async () => {
    renderWithClient(<LandingPage />);

    expect(screen.getByRole("banner")).toBeDefined();
    expect(screen.getByLabelText("MEGS Home")).toBeDefined();

    expect(screen.getAllByRole("link", { name: /About/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Services/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Branches & Map/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Find Jobs/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Contact/i }).length).toBeGreaterThan(0);

    const logInLinks = screen.getAllByRole("link", { name: /Log In/i });
    expect(logInLinks.length).toBeGreaterThan(0);

    const createAccountLinks = screen.getAllByRole("link", { name: /Create Account/i });
    expect(createAccountLinks.length).toBeGreaterThan(0);
  });

  it("renders the PJAR Group and PALSCON affiliates trust bar", async () => {
    renderWithClient(<LandingPage />);

    expect(screen.getAllByText(/A PJAR Group Company/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Proud PALSCON Member")).toBeDefined();
    expect(screen.getByAltText(/Philippine Association of Local Service Contractors/i)).toBeDefined();
  });

  it("renders the Company Background, Mission, Vision, and 3 Core Values", async () => {
    renderWithClient(<LandingPage />);

    expect(screen.getByText(/Trusted Workforce Partner to the Philippines' Top 1,000 Corporations/i)).toBeDefined();
    expect(screen.getByText(/Corporate Mission/i)).toBeDefined();
    expect(screen.getByText(/5-Year Strategic Vision/i)).toBeDefined();

    expect(screen.getByText("Integrity")).toBeDefined();
    expect(screen.getByText("Loyalty")).toBeDefined();
    expect(screen.getByText("Respect")).toBeDefined();
  });

  it("renders the 6 Salient Services and Accident Insurance Card", async () => {
    renderWithClient(<LandingPage />);

    expect(screen.getByText(/Salient Features of Our Manpower Services/i)).toBeDefined();
    expect(screen.getByText(/Complete Recruitment & Sourcing Relief/i)).toBeDefined();
    expect(screen.getByText(/Zero Legal Liabilities \(DOLE D\.O\. 40, S\.2003\)/i)).toBeDefined();
    expect(screen.getByText("₱100,000.00")).toBeDefined();
    expect(screen.getByText("₱10,000.00")).toBeDefined();
  });

  it("renders the 6 partner industries including Gaming & Casino", async () => {
    renderWithClient(<LandingPage />);

    expect(screen.getByText(/Partner Industries We Support/i)).toBeDefined();
    expect(screen.getAllByText(/Manufacturing/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Logistics & Transport/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Warehousing & Storage/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Retail, Sales & Distribution/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hotel & Restaurant/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Gaming & Casino/i).length).toBeGreaterThan(0);
  });


  it("renders the 6 branch offices and interactive Philippine map with selection", async () => {
    renderWithClient(<LandingPage />);

    expect(screen.getByText(/6 Strategic Branch Offices Across the Philippines/i)).toBeDefined();
    expect(screen.getByAltText(/Map of the Philippines with MEGS Branch Locations/i)).toBeDefined();

    // Verify all 6 branches render
    expect(screen.getAllByText(/Valenzuela Central Office/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Quezon City Branch/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Biñan, Laguna Branch/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tanauan, Batangas Branch/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Cebu Branch/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Davao City Branch/i).length).toBeGreaterThan(0);

    // Click Davao City branch card to test interaction
    const davaoCards = screen.getAllByText(/Davao City Branch/i);
    fireEvent.click(davaoCards[0]);

    // Active status should update
    expect(screen.getByText(/Active Branch: Davao/i)).toBeDefined();
  });

  it("renders the executive contact and proposal generator", async () => {
    renderWithClient(<LandingPage />);

    expect(screen.getAllByText("John Patrick Ramos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Vice-President for Operations").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/patrickramos@pjar-group\.com/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/0917-629-1864/i).length).toBeGreaterThan(0);
  });

  it("renders live job listings from the recruitment API", async () => {
    renderWithClient(<LandingPage />);

    await waitFor(() => {
      expect(screen.getByText("Warehouse Inventory Associate")).toBeDefined();
      expect(screen.getByText("Logistics Operations Lead")).toBeDefined();
    });

    expect(screen.getAllByText("Star Meg").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Global Freight Corp").length).toBeGreaterThan(0);
  });

  it("renders the comprehensive footer with full 6-branch directory and DOLE compliance", async () => {
    renderWithClient(<LandingPage />);

    expect(screen.getByText(/Nationwide Office Directory/i)).toBeDefined();
    expect(screen.getByText(/DOLE D\.O\. 174-17 & D\.O\. 40-03 Compliant/i)).toBeDefined();
    expect(screen.getAllByText(/MAR Employment for Good Services/i).length).toBeGreaterThan(0);
  });
});
