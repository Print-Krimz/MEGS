import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkforcePage } from "../WorkforcePage";

// Mock router Link
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/ta/workforce" }),
  useSearch: () => ({ tab: undefined }),
  useRouter: () => ({ state: { location: { pathname: "/ta/workforce" } } }),
}));

// Mock child pages to isolate WorkforcePage tab switching
vi.mock("../DeploymentsPage", () => ({
  DeploymentsPage: ({ hideHeader }: { hideHeader?: boolean }) => (
    <div data-testid="deployments-view">
      <span>Deployments View Content</span>
      {hideHeader && <span data-testid="hide-header-flag">Header Hidden</span>}
    </div>
  ),
}));

vi.mock("../EmployeesPage", () => ({
  EmployeesPage: ({ hideHeader }: { hideHeader?: boolean }) => (
    <div data-testid="employees-view">
      <span>Employees 201 View Content</span>
      {hideHeader && <span data-testid="hide-header-flag">Header Hidden</span>}
    </div>
  ),
}));

vi.mock("../CompliancePage", () => ({
  CompliancePage: ({ hideHeader }: { hideHeader?: boolean }) => (
    <div data-testid="compliance-view">
      <span>Compliance Clearances View Content</span>
      {hideHeader && <span data-testid="hide-header-flag">Header Hidden</span>}
    </div>
  ),
}));

describe("WorkforcePage", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  beforeEach(() => {
    window.history.replaceState({}, "", "/ta/workforce");
  });

  const renderComponent = (initialTab?: "deployments" | "employees" | "clearances") => {
    return render(
      <QueryClientProvider client={queryClient}>
        <WorkforcePage initialTab={initialTab} />
      </QueryClientProvider>
    );
  };

  it("renders the consolidated page header and 3 sub-navigation tabs", () => {
    renderComponent();

    expect(screen.getByRole("heading", { name: "Deployments & 201 Records" })).toBeDefined();
    expect(screen.getByRole("button", { name: /Site Deployments/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /201 Employee Files/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Pre-Employment Clearances/i })).toBeDefined();
  });

  it("defaults to Site Deployments view and hides duplicate child header", () => {
    renderComponent();

    expect(screen.getByTestId("deployments-view")).toBeDefined();
    expect(screen.getByText("Deployments View Content")).toBeDefined();
    expect(screen.getByTestId("hide-header-flag")).toBeDefined();
    expect(screen.queryByTestId("employees-view")).toBeNull();
    expect(screen.queryByTestId("compliance-view")).toBeNull();
  });

  it("switches to 201 Employee Files when clicked", () => {
    renderComponent();

    const employeesTab = screen.getByRole("button", { name: /201 Employee Files/i });
    fireEvent.click(employeesTab);

    expect(screen.getByTestId("employees-view")).toBeDefined();
    expect(screen.getByText("Employees 201 View Content")).toBeDefined();
    expect(screen.queryByTestId("deployments-view")).toBeNull();
  });

  it("switches to Pre-Employment Clearances when clicked", () => {
    renderComponent();

    const clearancesTab = screen.getByRole("button", { name: /Pre-Employment Clearances/i });
    fireEvent.click(clearancesTab);

    expect(screen.getByTestId("compliance-view")).toBeDefined();
    expect(screen.getByText("Compliance Clearances View Content")).toBeDefined();
    expect(screen.queryByTestId("deployments-view")).toBeNull();
  });

  it("respects initialTab prop if provided", () => {
    renderComponent("employees");

    expect(screen.getByTestId("employees-view")).toBeDefined();
    expect(screen.queryByTestId("deployments-view")).toBeNull();
  });
});
