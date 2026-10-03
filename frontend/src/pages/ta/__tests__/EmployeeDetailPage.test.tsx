import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EmployeeDetailPage } from "../EmployeeDetailPage";
import { employeesApi } from "../../../lib/api/employees.api";

// Mock router hooks and components
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useParams: () => ({ employeeId: "1" }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/ta/employees/1" }),
  useSearch: () => ({ tab: "compliance" }),
  useRouter: () => ({ state: { location: { pathname: "/ta/employees/1" } } }),
}));

// Mock feedback notification
vi.mock("../../../lib/feedback", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock employeesApi
vi.mock("../../../lib/api/employees.api", () => ({
  employeesApi: {
    getEmployeeDetails: vi.fn(),
    getDigital201: vi.fn(),
    updateEmployeeStatus: vi.fn(),
    updateEmployeeDetails: vi.fn(),
  },
}));

const createBaseMockEmployee = (compliance: any[] = []) => ({
  employee: {
    id: 1,
    employeeNumber: "EMP-2026-001",
    status: "ACTIVE",
    hireDate: "2026-01-01T00:00:00Z",
    position: "Security Officer",
    department: "Operations",
    userId: "usr-1",
  },
  candidate: {
    firstName: "Juan",
    lastName: "Dela Cruz",
    email: "juan.delacruz@example.com",
    mobileNumber: "0917-123-4567",
    address: "123 Mabini St",
    city: "Makati",
    province: "Metro Manila",
    barangay: "Poblacion",
    postalCode: "1200",
  },
  deployments: [],
  employmentHistory: [],
  compliance,
  skills: ["First Aid", "CCTV Monitoring"],
});

describe("EmployeeDetailPage - 201 Clearance Vault Tab", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0 },
      },
    });
    window.history.replaceState({}, "", "/ta/employees/1?tab=compliance");
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <EmployeeDetailPage />
      </QueryClientProvider>
    );
  };

  it("renders Clearance Vault section header with verified count and partitioned items", async () => {
    const mockCompliance = [
      {
        id: 101,
        documentLabel: "SSS Verification Slip",
        reviewStatus: "APPROVED",
        expiresAt: "2027-12-31T00:00:00.000Z",
      },
      {
        id: 102,
        documentLabel: "NBI Clearance",
        reviewStatus: "TO_FOLLOW",
        toFollowExpectedAt: "2025-01-01T00:00:00.000Z", // Past date -> Overdue
      },
      {
        id: 103,
        documentLabel: "Medical Certificate",
        reviewStatus: "PENDING",
        deadline: "2099-12-31T00:00:00.000Z", // Future date -> not overdue
      },
    ];

    vi.mocked(employeesApi.getEmployeeDetails).mockResolvedValue(
      createBaseMockEmployee(mockCompliance) as any
    );

    renderComponent();

    // Verify Section Header and count
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "201 Clearance Vault" })).toBeDefined();
    });
    expect(screen.getByText("1 of 3 verified")).toBeDefined();

    // Verify Sub-header: Pending follow-up items
    expect(screen.getByRole("heading", { name: "Pending follow-up items" })).toBeDefined();
    expect(screen.getByText("NBI Clearance")).toBeDefined();
    expect(screen.getByText("To follow")).toBeDefined();
    expect(screen.getByText("Target date: Jan 1, 2025")).toBeDefined();
    expect(screen.getByText("Overdue")).toBeDefined();

    expect(screen.getByText("Medical Certificate")).toBeDefined();
    expect(screen.getByText("Pending")).toBeDefined();
    expect(screen.getByText("Target date: Dec 31, 2099")).toBeDefined();

    // Verify Sub-header: Verified 201 documents
    expect(screen.getByRole("heading", { name: "Verified 201 documents" })).toBeDefined();
    expect(screen.getByText("SSS Verification Slip")).toBeDefined();
    expect(screen.getByText("Approved")).toBeDefined();
    expect(screen.getByText("Expires: Dec 31, 2027")).toBeDefined();
  });

  it("renders only verified section when all compliance items are approved", async () => {
    const mockCompliance = [
      {
        id: 201,
        documentLabel: "PhilHealth ID Copy",
        reviewStatus: "APPROVED",
        expiresAt: null,
      },
      {
        id: 202,
        documentLabel: "Pag-IBIG Member Record",
        reviewStatus: "APPROVED",
        expiresAt: "2028-06-30T00:00:00.000Z",
      },
    ];

    vi.mocked(employeesApi.getEmployeeDetails).mockResolvedValue(
      createBaseMockEmployee(mockCompliance) as any
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "201 Clearance Vault" })).toBeDefined();
    });
    expect(screen.getByText("2 of 2 verified")).toBeDefined();

    // Pending follow-up section should not exist
    expect(screen.queryByRole("heading", { name: "Pending follow-up items" })).toBeNull();

    // Verified section should exist
    expect(screen.getByRole("heading", { name: "Verified 201 documents" })).toBeDefined();
    expect(screen.getByText("PhilHealth ID Copy")).toBeDefined();
    expect(screen.getByText("Pag-IBIG Member Record")).toBeDefined();
    expect(screen.getByText("Expires: Jun 30, 2028")).toBeDefined();
  });

  it("renders empty verified message when no items are approved", async () => {
    const mockCompliance = [
      {
        id: 301,
        documentLabel: "Barangay Clearance",
        reviewStatus: "TO_FOLLOW",
        toFollowExpectedAt: "2026-11-15T00:00:00.000Z",
      },
      {
        id: 302,
        documentLabel: "Drug Test Result",
        reviewStatus: "REJECTED",
      },
    ];

    vi.mocked(employeesApi.getEmployeeDetails).mockResolvedValue(
      createBaseMockEmployee(mockCompliance) as any
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "201 Clearance Vault" })).toBeDefined();
    });
    expect(screen.getByText("0 of 2 verified")).toBeDefined();

    // Pending section should be displayed
    expect(screen.getByRole("heading", { name: "Pending follow-up items" })).toBeDefined();
    expect(screen.getByText("Barangay Clearance")).toBeDefined();
    expect(screen.getByText("Drug Test Result")).toBeDefined();
    expect(screen.getByText("Rejected")).toBeDefined();

    // Verified section shows empty text
    expect(screen.getByRole("heading", { name: "Verified 201 documents" })).toBeDefined();
    expect(screen.getByText("No verified documents on record yet.")).toBeDefined();
  });

  it("renders empty state when employee has zero compliance documents attached", async () => {
    vi.mocked(employeesApi.getEmployeeDetails).mockResolvedValue(
      createBaseMockEmployee([]) as any
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "201 Clearance Vault" })).toBeDefined();
    });
    expect(screen.getByText("0 of 0 verified")).toBeDefined();
    expect(screen.getByText("No compliance documents attached.")).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Pending follow-up items" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Verified 201 documents" })).toBeNull();
  });

  it("allows switching to Clearance Vault tab by clicking the tab button", async () => {
    // Start on identity tab
    window.history.replaceState({}, "", "/ta/employees/1?tab=identity");

    const mockCompliance = [
      {
        id: 401,
        documentLabel: "TIN ID Document",
        reviewStatus: "APPROVED",
        expiresAt: null,
      },
    ];

    vi.mocked(employeesApi.getEmployeeDetails).mockResolvedValue(
      createBaseMockEmployee(mockCompliance) as any
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Government IDs and personal details/i })).toBeDefined();
    });

    // Switch to Clearance Vault tab
    const vaultTab = screen.getByRole("tab", { name: /Clearance Vault/i });
    fireEvent.click(vaultTab);

    expect(screen.getByRole("heading", { name: "201 Clearance Vault" })).toBeDefined();
    expect(screen.getByText("1 of 1 verified")).toBeDefined();
    expect(screen.getByText("TIN ID Document")).toBeDefined();
  });
});
