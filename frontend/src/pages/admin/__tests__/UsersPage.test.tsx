import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { adminApi } from "../../../lib/api/admin.api";
import { UsersPage } from "../UsersPage";
import { AdminDashboard } from "../AdminDashboard";

vi.mock("../../../lib/feedback", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), loading: vi.fn(), dismiss: vi.fn() },
  formatErrorMessage: vi.fn((e: any) => e?.message || "Error"),
  fieldErrorsFrom: vi.fn(() => ({})),
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "admin-1", email: "admin@megs.ph", role: "ADMINISTRATOR" }, isAuthenticated: true }),
}));

const router = vi.hoisted(() => ({ search: {} as Record<string, unknown>, navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, search, params: _params, ...props }: any) => (
    <a href={to} data-search={search ? JSON.stringify(search) : undefined} {...props}>{children}</a>
  ),
  useNavigate: () => router.navigate,
  useSearch: () => router.search,
}));

vi.mock("../../../lib/api/admin.api", () => ({
  adminApi: {
    listUsersPage: vi.fn(),
    getUserSummary: vi.fn(),
    getDashboardSummary: vi.fn(),
    resendTAInvitation: vi.fn(),
    cancelTAInvitation: vi.fn(),
    updateUserRole: vi.fn(),
    updateUserStatus: vi.fn(),
    inviteTA: vi.fn(),
    reassignTaRecords: vi.fn(),
    getFilterOptions: vi.fn(),
    getScoringConfig: vi.fn(),
    getQualityMetrics: vi.fn(),
    listDatabaseBackups: vi.fn(),
    listAuditLogs: vi.fn(),
  },
}));

const base = { createdAt: "2026-08-01T00:00:00Z", isActive: true, accountStatus: "ACTIVE" };
const USERS = [
  { ...base, id: "admin-1", email: "admin@megs.ph", role: "ADMINISTRATOR" },
  { ...base, id: "ta-1", email: "one@megs.ph", role: "TALENT_ACQUISITION", lastLoginAt: "2026-10-20T08:00:00Z" },
  { ...base, id: "ta-2", email: "two@megs.ph", role: "TALENT_ACQUISITION" },
  { ...base, id: "ta-3", email: "off@megs.ph", role: "TALENT_ACQUISITION", isActive: false, accountStatus: "DEACTIVATED" },
  { ...base, id: "ta-4", email: "invite@megs.ph", role: "TALENT_ACQUISITION", accountStatus: "PENDING", invitationStatus: "PENDING" },
];

const renderPage = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  router.search = {};
  vi.mocked(adminApi.listUsersPage).mockResolvedValue({ items: USERS, total: 5, page: 1, pageSize: 10, totalPages: 1 } as never);
  vi.mocked(adminApi.getFilterOptions).mockResolvedValue({ recruiters: [] } as never);
  vi.mocked(adminApi.updateUserStatus).mockResolvedValue({} as never);
});

describe("UsersPage matrix", () => {
  it("sends the status filter from the URL to the API", async () => {
    router.search = { status: "invited" };
    renderPage(<UsersPage />);
    await waitFor(() => expect(adminApi.listUsersPage).toHaveBeenCalledWith(expect.objectContaining({ status: "invited" }), expect.anything()));
  });

  it("sends the last sign-in filter and shows Never for accounts that have not signed in", async () => {
    router.search = { lastLogin: "never" };
    renderPage(<UsersPage />);
    await waitFor(() => expect(adminApi.listUsersPage).toHaveBeenCalledWith(expect.objectContaining({ lastLogin: "never" }), expect.anything()));
    expect((await screen.findAllByText("Never")).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("columnheader", { name: "Last sign-in" })).toHaveLength(1);
  });

  it("opens the Change role dialog instead of saving when the inline role changes", async () => {
    renderPage(<UsersPage />);
    const selects = await screen.findAllByRole("combobox", { name: "Role for one@megs.ph" });
    fireEvent.change(selects[0], { target: { value: "ADMINISTRATOR" } });
    expect(await screen.findByText("Choose what one@megs.ph can access.")).toBeInTheDocument();
    expect(adminApi.updateUserRole).not.toHaveBeenCalled();
  });

  it("has no inline role select for yourself or a pending invite", async () => {
    renderPage(<UsersPage />);
    await screen.findAllByText("one@megs.ph");
    expect(screen.queryByRole("combobox", { name: "Role for admin@megs.ph" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Role for invite@megs.ph" })).toBeNull();
  });

  it("disables selecting yourself", async () => {
    renderPage(<UsersPage />);
    const boxes = await screen.findAllByRole("checkbox", { name: "Select admin@megs.ph" });
    expect(boxes[0]).toBeDisabled();
  });

  it("offers only the bulk actions that fit every selected row", async () => {
    renderPage(<UsersPage />);
    fireEvent.click((await screen.findAllByRole("checkbox", { name: "Select one@megs.ph" }))[0]);
    expect(screen.getByRole("button", { name: "Deactivate" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reactivate" })).toBeNull();

    fireEvent.click(screen.getAllByRole("checkbox", { name: "Select off@megs.ph" })[0]);
    expect(screen.queryByRole("button", { name: "Deactivate" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reactivate" })).toBeNull();
    expect(screen.getByText(/No action fits this mix/)).toBeInTheDocument();
  });

  it("warns about records, runs per-user calls and lists failures", async () => {
    vi.mocked(adminApi.updateUserStatus).mockImplementation((async (id: string) => {
      if (id === "ta-2") throw new Error("Boom");
      return {};
    }) as never);
    renderPage(<UsersPage />);
    fireEvent.click((await screen.findAllByRole("checkbox", { name: "Select one@megs.ph" }))[0]);
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Select two@megs.ph" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(await screen.findByText(/stay Admin-only until you reassign them/)).toBeInTheDocument();

    const confirm = screen.getAllByRole("button", { name: "Deactivate" }).at(-1)!;
    fireEvent.click(confirm);
    await waitFor(() => expect(adminApi.updateUserStatus).toHaveBeenCalledTimes(2));
    expect(adminApi.updateUserStatus).toHaveBeenCalledWith("ta-1", false);
    expect(await screen.findByText("two@megs.ph", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });
});

const teamRow = (recruiterId: string, name: string, active: number, overdue: number, fillRate: number) => ({ recruiterId, name, active, overdue, fillRate });
const DASHBOARD = {
  kpis: {
    fillRate: 40, openSeats: 12, placementsStarted: 5,
    requisitions: { total: 9, open: 6, overdue: 2, atRisk: 1, filled: 3 },
  },
  stuckTotal: 7,
  team: [
    teamRow("r-calm", "Calm Recruiter", 9, 0, 55),
    teamRow("r-late", "Late Recruiter", 4, 3, 20),
    teamRow("r-busy", "Busy Recruiter", 11, 0, 60),
  ],
};

function mockDashboard(summary: Record<string, number>, dashboard: unknown = DASHBOARD) {
  vi.mocked(adminApi.getUserSummary).mockResolvedValue({
    totalUsers: 9, recruiters: 4, administrators: 1, pendingInvitations: 2, expiredInvitations: 1, inactiveAccounts: 3, failedJobs: 0, pendingRequests: 0, ...summary,
  } as never);
  vi.mocked(adminApi.getDashboardSummary).mockResolvedValue(dashboard as never);
  vi.mocked(adminApi.listDatabaseBackups).mockResolvedValue([] as never);
  vi.mocked(adminApi.listAuditLogs).mockResolvedValue([] as never);
}

describe("AdminDashboard", () => {
  it("shows needs-attention counts and links invitation and inactive tiles to the filtered Users page", async () => {
    mockDashboard({ failedJobs: 2, pendingRequests: 3 });
    renderPage(<AdminDashboard />);
    const invites = await screen.findByRole("link", { name: /Invitations/i });
    expect(invites).toHaveAttribute("data-search", JSON.stringify({ status: "invited" }));
    expect(screen.getByRole("link", { name: /Inactive accounts/i })).toHaveAttribute(
      "data-search",
      JSON.stringify({ status: "inactive" }),
    );
    expect(screen.getByText("3 (2 pending, 1 expired)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Failed scoring jobs\s*2/i })).toHaveAttribute(
      "href",
      "/admin/scoring/quality",
    );
    const requests = screen.getByRole("link", { name: /Applicant requests/i });
    expect(requests).toHaveAttribute("href", "/admin/analytics");
    expect(requests).toHaveTextContent("3 waiting");
    expect(screen.getByRole("link", { name: /Latest backup/i })).toHaveAttribute("href", "/admin/maintenance");
    expect(screen.queryByText("Database")).not.toBeInTheDocument();
    expect(screen.queryByText("Server load")).not.toBeInTheDocument();
  });

  it("says when nothing needs a retry", async () => {
    mockDashboard({});
    renderPage(<AdminDashboard />);
    expect(await screen.findByRole("link", { name: /Failed scoring jobs\s*0/i })).toBeInTheDocument();
    expect(screen.getByText("0 waiting")).toBeInTheDocument();
  });

  it("shows the team tiles linked to reports", async () => {
    mockDashboard({});
    renderPage(<AdminDashboard />);
    expect(await screen.findByText("40% filled")).toBeInTheDocument();
    expect(screen.getByText("Past their stage limit")).toBeInTheDocument();
    expect(screen.getByText("2 overdue · 1 at risk")).toBeInTheDocument();
    expect(screen.getByText("Last 7 days")).toBeInTheDocument();
    expect(screen.getByText("Overdue candidates").closest("div")).toHaveTextContent("7");
    expect(screen.getByText("Open seats").closest("div")).toHaveTextContent("12");
    expect(screen.getByText("Requests at risk").closest("div")).toHaveTextContent("3");
    expect(screen.getByText("Started this week").closest("div")).toHaveTextContent("5");
    for (const name of ["Overdue candidates", "Open seats", "Requests at risk", "Started this week"]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", "/admin/analytics");
    }
    expect(adminApi.getDashboardSummary).toHaveBeenCalledWith({ range: "7d" }, expect.anything());
  });

  it("lists team workload with the most overdue recruiter first", async () => {
    mockDashboard({});
    renderPage(<AdminDashboard />);
    expect(await screen.findByText("Late Recruiter")).toBeInTheDocument();
    const names = screen.getAllByText(/ Recruiter$/).map(el => el.textContent);
    expect(names).toEqual(["Late Recruiter", "Busy Recruiter", "Calm Recruiter"]);
    expect(screen.getByText("3 overdue")).toHaveClass("text-rose-700");
    expect(screen.getAllByText("0 overdue")).toHaveLength(2);
    expect(screen.getByText("11 active · 60% filled")).toBeInTheDocument();
    expect(screen.queryByText(/unassigned/i)).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no recruiters", async () => {
    mockDashboard({}, { ...DASHBOARD, team: [] });
    renderPage(<AdminDashboard />);
    expect(await screen.findByText("No recruiters yet")).toBeInTheDocument();
  });
});
