import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkforcePage, WorkforceTab } from "../WorkforcePage";

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

vi.mock("../PostDeploymentCompliancePage", () => ({
  PostDeploymentCompliancePage: ({ hideHeader }: { hideHeader?: boolean }) => (
    <div data-testid="post-deployment-view">
      <span>Post-Deployment Follow-ups View Content</span>
      {hideHeader && <span data-testid="hide-header-flag">Header Hidden</span>}
    </div>
  ),
}));

vi.mock("../RedeploymentQueuePage", () => ({
  RedeploymentQueuePage: () => (
    <div data-testid="redeployment-view">
      <span>Redeployment View Content</span>
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

  const renderComponent = (initialTab?: WorkforceTab) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <WorkforcePage initialTab={initialTab} />
      </QueryClientProvider>
    );
  };

  const waitForActiveView = (testId: string) => screen.findByTestId(testId);

  it("renders the consolidated page header and 5 sub-navigation tabs", async () => {
    renderComponent();
    await waitForActiveView("deployments-view");

    expect(screen.getByRole("heading", { name: "Workforce" })).toBeDefined();
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByRole("tab", { name: /Deployments/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Employee Records \(201\)/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Pre-employment Queue/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Post-Deployment Follow-ups/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Redeployment/i })).toBeDefined();
    expect(screen.queryByRole("tab", { name: /Document Alerts/i })).toBeNull();
    expect(screen.queryByText(/Document Alerts/i)).toBeNull();
  });

  it("defaults to Site Deployments view and hides duplicate child header", async () => {
    renderComponent();
    await waitForActiveView("deployments-view");

    expect(screen.getByTestId("deployments-view")).toBeDefined();
    expect(screen.getByText("Deployments View Content")).toBeDefined();
    expect(screen.getByTestId("hide-header-flag")).toBeDefined();
    expect(screen.queryByTestId("employees-view")).toBeNull();
    expect(screen.queryByTestId("compliance-view")).toBeNull();
    expect(screen.queryByTestId("post-deployment-view")).toBeNull();
    expect(screen.queryByTestId("redeployment-view")).toBeNull();
  });

  it("switches to Employee Records when clicked", async () => {
    renderComponent();
    await waitForActiveView("deployments-view");

    const employeesTab = screen.getByRole("tab", { name: /Employee Records \(201\)/i });
    fireEvent.click(employeesTab);
    await waitForActiveView("employees-view");

    expect(screen.getByTestId("employees-view")).toBeDefined();
    expect(screen.getByText("Employees 201 View Content")).toBeDefined();
    expect(screen.queryByTestId("deployments-view")).toBeNull();
  });

  it("switches to Pre-employment Queue when clicked", async () => {
    renderComponent();
    await waitForActiveView("deployments-view");

    const clearancesTab = screen.getByRole("tab", { name: /Pre-employment Queue/i });
    fireEvent.click(clearancesTab);
    await waitForActiveView("compliance-view");

    expect(screen.getByTestId("compliance-view")).toBeDefined();
    expect(screen.getByText("Compliance Clearances View Content")).toBeDefined();
    expect(screen.queryByTestId("deployments-view")).toBeNull();
  });

  it("switches to Post-Deployment Follow-ups when clicked", async () => {
    renderComponent();
    await waitForActiveView("deployments-view");

    const postDeploymentTab = screen.getByRole("tab", { name: /Post-Deployment Follow-ups/i });
    fireEvent.click(postDeploymentTab);
    await waitForActiveView("post-deployment-view");

    expect(screen.getByTestId("post-deployment-view")).toBeDefined();
    expect(screen.getByText("Post-Deployment Follow-ups View Content")).toBeDefined();
    expect(screen.getByTestId("hide-header-flag")).toBeDefined();
    expect(screen.queryByTestId("deployments-view")).toBeNull();
  });

  it("switches to Redeployment when clicked", async () => {
    renderComponent();
    await waitForActiveView("deployments-view");

    const redeploymentTab = screen.getByRole("tab", { name: /Redeployment/i });
    fireEvent.click(redeploymentTab);
    await waitForActiveView("redeployment-view");

    expect(screen.getByTestId("redeployment-view")).toBeDefined();
    expect(screen.getByText("Redeployment View Content")).toBeDefined();
    expect(screen.queryByTestId("deployments-view")).toBeNull();
  });

  it("respects initialTab prop if provided", async () => {
    renderComponent("post_deployment");
    await waitForActiveView("post-deployment-view");

    expect(screen.getByTestId("post-deployment-view")).toBeDefined();
    expect(screen.queryByTestId("deployments-view")).toBeNull();
  });
});
