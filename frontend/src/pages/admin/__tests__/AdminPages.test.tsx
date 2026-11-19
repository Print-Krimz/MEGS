import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { notify } from "../../../lib/feedback";
import { adminApi } from "../../../lib/api/admin.api";
import { employeesApi } from "../../../lib/api/employees.api";
import { ActionMenu } from "../../../components/common/ActionMenu";
import { AdminDashboard } from "../AdminDashboard";
import { UsersPage } from "../UsersPage";
import { ScoringConfigPage } from "../ScoringConfigPage";
import { ScoringQualityPage } from "../ScoringQualityPage";
import { DatabaseMaintenancePage } from "../DatabaseMaintenancePage";
import { AuditLogsPage } from "../AuditLogsPage";

vi.mock("../../../lib/feedback", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
  formatErrorMessage: vi.fn((e: any) => e?.message || "Error"),
  fieldErrorsFrom: vi.fn(() => ({})),
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "admin@megs.ph", role: "ADMINISTRATOR" },
    isAuthenticated: true,
  }),
}));

// Router state the tests can steer: current URL search and the navigate spy.
const router = vi.hoisted(() => ({ search: {} as Record<string, unknown>, navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, search: _search, params: _params, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => router.navigate,
  useSearch: () => router.search,
  useParams: () => ({}),
  useBlocker: () => ({ status: "idle", proceed: vi.fn(), reset: vi.fn() }),
}));

vi.mock("../../../lib/api/admin.api", () => ({
  adminApi: {
    listUsersPage: vi.fn(),
    getUserSummary: vi.fn(),
    inviteTA: vi.fn(),
    resendTAInvitation: vi.fn(),
    cancelTAInvitation: vi.fn(),
    updateUserRole: vi.fn(),
    updateUserStatus: vi.fn(),
    reassignTaRecords: vi.fn(),
    getScoringConfig: vi.fn(),
    getScoringConfigHistory: vi.fn(),
    updateScoringConfig: vi.fn(),
    restoreDefaultScoringConfig: vi.fn(),
    getQualityMetrics: vi.fn(),
    listDatabaseBackups: vi.fn(),
    listDatabaseRestores: vi.fn(),
    triggerDatabaseBackup: vi.fn(),
    renameDatabaseBackup: vi.fn(),
    downloadDatabaseBackup: vi.fn(),
    restoreDatabaseBackup: vi.fn(),
    restoreUploadedBackup: vi.fn(),
    exportAuditReport: vi.fn(),
    listAuditLogs: vi.fn(),
    getDashboardSummary: vi.fn(),
    getFilterOptions: vi.fn(),
    listMrfs: vi.fn(),
    assignMrf: vi.fn(),
  },
}));

vi.mock("../../../lib/api/employees.api", () => ({
  employeesApi: {
    getCredentialAlerts: vi.fn(),
    getRedeploymentQueuePage: vi.fn(),
    getRedeploymentQueueSummary: vi.fn(),
    listEmployees: vi.fn(),
    // Write paths: the Admin Workforce page must never reach these.
    updateEmployee: vi.fn(),
    createEmployee: vi.fn(),
    requestDocumentUpdate: vi.fn(),
    reviewDocument: vi.fn(),
  },
}));

/** navigate() gets either a search object or an updater function; resolve it against the current URL search. */
const searchOf = (arg: { search?: unknown }): Record<string, unknown> =>
  typeof arg.search === "function" ? (arg.search as (prev: Record<string, unknown>) => Record<string, unknown>)(router.search) : (arg.search as Record<string, unknown>);

const DAY = 24 * 60 * 60 * 1000;
const isoIn = (days: number) => new Date(Date.now() + days * DAY).toISOString();

const USERS = {
  admin: { id: "admin-1", email: "admin@megs.ph", role: "ADMINISTRATOR", accountStatus: "ACTIVE", isActive: true, createdAt: "2026-08-01T00:00:00Z" },
  invited: { id: "ta-1", email: "recruiter@megs.ph", role: "TALENT_ACQUISITION", accountStatus: "PENDING", invitationStatus: "PENDING", isActive: true, createdAt: "2026-08-05T00:00:00Z" },
  busy: { id: "ta-2", email: "busy@megs.ph", role: "TALENT_ACQUISITION", accountStatus: "ACTIVE", isActive: true, createdAt: "2026-08-06T00:00:00Z" },
  idle: { id: "ta-3", email: "idle@megs.ph", role: "TALENT_ACQUISITION", accountStatus: "ACTIVE", isActive: true, createdAt: "2026-08-07T00:00:00Z" },
};

const teamRow = (over: Record<string, unknown>) => ({
  recruiterId: "x", name: "X", active: 0, overdue: 0, overdueEstimated: 0, openRequisitions: 0, requestedSeats: 0, filledSeats: 0,
  fillRate: 0, sentToClient: 0, newStarts: 0, redeployStarts: 0, placed: 0, backouts: 0, backoutRate: 0, medianDaysToFill: null, ...over,
});

/** A dashboard summary with nothing wrong; tests override the parts they care about. */
const calmDashboard = (over: Record<string, any> = {}) => ({
  dateRange: { days: 7 },
  kpis: {
    requestedSeats: 10, openSeats: 4, placementsStarted: 3, backoutsAfterClientReview: 0, overdueCandidates: 0, criticalCandidates: 0,
    fillRate: 60,
    requisitions: { overdue: 0, atRisk: 0 },
  },
  team: [
    teamRow({ recruiterId: "ta-2", name: "Busy Recruiter", active: 5, openRequisitions: 2 }),
    teamRow({ recruiterId: "ta-3", name: "Idle Recruiter" }),
  ],
  unassigned: { applicants: 0, overdue: 0, overdueEstimated: 0, requests: 0, requestedSeats: 0, oldestWaitDays: null },
  requests: [],
  backouts: { withdrawals: 0 },
  stageTable: [],
  stuck: [],
  stuckTotal: 0,
  ...over,
});

const CONFIG = {
  id: 1,
  version: 1,
  revision: 3,
  scope: "DEFAULT",
  status: "ACTIVE",
  activatedAt: "2026-08-10T00:00:00Z",
  weights: { SKILLS: 30, EXPERIENCE: 25, LOCATION: 15, COMPLIANCE: 15, EDUCATION_CERTIFICATIONS: 15 },
  knnSettings: { defaultK: 10, maximumK: 50, minimumSimilarity: 0.5, excludeCurrentlyHired: true },
  matchThreshold: 60,
};

const QUALITY = {
  totalCalculated: 150,
  averageFitScore: 79.5,
  minFitScore: 35,
  maxFitScore: 98,
  coveragePercentage: 100,
  knnLatencyP95: 38,
  scoreDistribution: { "80-100": 70, "60-79": 50, "40-59": 20, "20-39": 10, "0-19": 0 },
};

const BACKUP = {
  id: "b-1",
  filename: "megs_backup_2026-08-14.enc.gz",
  displayName: "Nightly copy",
  sizeBytes: 1048576,
  checksumSha256: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  status: "SUCCESS",
  backupType: "MANUAL",
  encryptionMethod: "AES-256-GCM",
  tablesIncluded: ["User", "JobPosting"],
  initiatedBy: { id: "admin-1", email: "admin@megs.ph" },
  createdAt: "2026-08-14T00:00:00Z",
};

const mrf = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  title: `Request ${id}`,
  status: "OPEN",
  priority: "MEDIUM",
  headcount: 5,
  targetFillDate: isoIn(30),
  createdAt: "2026-08-01T00:00:00Z",
  clientId: 1,
  client: { id: 1, name: "Acme" },
  assignedTaId: "ta-2",
  assignedTa: { id: "ta-2", email: "busy@megs.ph", applicantProfile: { firstName: "Busy", lastName: "Recruiter" } },
  fulfillment: { deployedCount: 1, remainingCount: 4, fulfillmentRate: 20, headcount: 5 },
  ...over,
});

const alertRow = (id: number, expiresAt: string) => ({
  requirementId: id,
  documentId: id,
  documentLabel: `Credential ${id}`,
  reviewStatus: "APPROVED",
  validityStatus: "HAS_EXPIRY",
  expiresAt,
  alertType: "EXPIRING_SOON",
  employeeId: id,
  employeeNumber: `E-${id}`,
  employeeName: `Worker ${id}`,
  employeeStatus: "ACTIVE",
  clientName: "Acme",
  jobTitle: "Guard",
});

const createQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const renderWithClient = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={createQueryClient()}>{ui}</QueryClientProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  router.search = {};

  vi.mocked(adminApi.getDashboardSummary).mockResolvedValue(calmDashboard() as never);
  vi.mocked(adminApi.getUserSummary).mockResolvedValue({
    totalUsers: 4,
    pendingInvitations: 1,
    expiredInvitations: 0,
    inactiveAccounts: 0,
    failedJobs: 0,
    pendingRequests: 0,
  } as never);
  vi.mocked(adminApi.getFilterOptions).mockResolvedValue({
    clients: [], mrfs: [], jobPostings: [], stages: [],
    recruiters: [
      { id: "ta-2", email: "busy@megs.ph", name: "Busy Recruiter" },
      { id: "ta-3", email: "idle@megs.ph", name: "Idle Recruiter" },
    ],
  } as never);
  vi.mocked(adminApi.getScoringConfig).mockResolvedValue(CONFIG as never);
  vi.mocked(adminApi.getScoringConfigHistory).mockResolvedValue([] as never);
  vi.mocked(adminApi.getQualityMetrics).mockResolvedValue(QUALITY as never);
  vi.mocked(adminApi.listDatabaseBackups).mockResolvedValue([BACKUP] as never);
  vi.mocked(adminApi.listDatabaseRestores).mockResolvedValue([] as never);
  vi.mocked(adminApi.listAuditLogs).mockResolvedValue([
    { id: 1, action: "SCORING_CONFIG_ACTIVATED", userId: "admin-1", entity: "CandidateScoringConfiguration", entityId: "1", createdAt: "2026-08-14T00:00:00Z" },
  ] as never);
  vi.mocked(adminApi.listUsersPage).mockImplementation((async (query: { role?: string }) => {
    const all = [USERS.admin, USERS.invited, USERS.busy, USERS.idle];
    const items =
      query.role === "TALENT_ACQUISITION"
        ? [USERS.invited, USERS.busy, USERS.idle]
        : query.role === "ADMINISTRATOR"
          ? [USERS.admin]
          : all;
    return { items, total: items.length, page: 1, pageSize: 10, totalPages: 1 };
  }) as never);
  vi.mocked(adminApi.listMrfs).mockResolvedValue([] as never);

  vi.mocked(employeesApi.getCredentialAlerts).mockResolvedValue([] as never);
  vi.mocked(employeesApi.getRedeploymentQueueSummary).mockResolvedValue({ total: 0 } as never);
  vi.mocked(employeesApi.getRedeploymentQueuePage).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25, totalPages: 1 } as never);
  vi.mocked(employeesApi.listEmployees).mockResolvedValue([] as never);
});

describe("Overview (AdminDashboard)", () => {
  it("renders the headline numbers and the team workload", async () => {
    renderWithClient(<AdminDashboard />);
    expect(await screen.findByRole("heading", { name: "Overview" }, { timeout: 8000 })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Open seats" }, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Requests at risk" })).toBeInTheDocument();
    expect((await screen.findAllByText("Busy Recruiter")).length).toBeGreaterThan(0);
  });

  it("shows zero-state captions when nothing needs attention", async () => {
    renderWithClient(<AdminDashboard />);
    expect(await screen.findByText("1 (1 pending, 0 expired)")).toBeInTheDocument();
    expect(screen.getByText("0 waiting")).toBeInTheDocument();
    expect(screen.getByText("0 overdue · 0 at risk")).toBeInTheDocument();
    expect(screen.getByText("All checks normal")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "View reports" })).toHaveLength(1);
  });

  it("highlights overdue, failed jobs, and unassigned work when counts are above zero", async () => {
    vi.mocked(adminApi.getUserSummary).mockResolvedValue({
      totalUsers: 4,
      pendingInvitations: 1,
      expiredInvitations: 2,
      inactiveAccounts: 1,
      failedJobs: 3,
      pendingRequests: 2,
    } as never);
    vi.mocked(adminApi.getDashboardSummary).mockResolvedValue(
      calmDashboard({
        kpis: { ...calmDashboard().kpis, requisitions: { overdue: 2, atRisk: 1 } },
        unassigned: { applicants: 4, overdue: 1, overdueEstimated: 0, requests: 1, requestedSeats: 3, oldestWaitDays: 6 },
      }) as never,
    );
    renderWithClient(<AdminDashboard />);
    expect(await screen.findByText("3 (1 pending, 2 expired)")).toBeInTheDocument();
    expect(screen.getByText("3 items need attention")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Failed scoring jobs\s*3/i })).toBeInTheDocument();
    expect(screen.getByText("2 waiting")).toBeInTheDocument();
    expect(screen.getByText("2 overdue · 1 at risk")).toBeInTheDocument();
    expect(screen.getByText("Unassigned work")).toBeInTheDocument();
  });

  it("shows an error with retry when the summary fails", async () => {
    vi.mocked(adminApi.getDashboardSummary).mockRejectedValueOnce(new Error("Summary unavailable"));
    renderWithClient(<AdminDashboard />);
    const retries = await screen.findAllByRole("button", { name: /try again/i });
    expect(retries.length).toBeGreaterThan(0);
    fireEvent.click(retries[0]);
    expect(await screen.findByRole("link", { name: "Open seats" })).toBeInTheDocument();
  });

  it("shows the latest backup status on the overview tile", async () => {
    renderWithClient(<AdminDashboard />);
    expect(await screen.findByRole("link", { name: /Latest backup/i })).toBeInTheDocument();
    expect(await screen.findByText(/Completed/)).toBeInTheDocument();
    expect(screen.queryByText(/Total backups|Backups available/)).not.toBeInTheDocument();
  });

  it("shows No backups yet when there are no backups", async () => {
    vi.mocked(adminApi.listDatabaseBackups).mockResolvedValue([] as never);
    renderWithClient(<AdminDashboard />);
    expect(await screen.findByText("No backups yet")).toBeInTheDocument();
  });

  it("keeps a real zero on a headline tile instead of hiding it", async () => {
    vi.mocked(adminApi.getDashboardSummary).mockResolvedValue(
      calmDashboard({ kpis: { ...calmDashboard().kpis, openSeats: 0, requestedSeats: 0 } }) as never,
    );
    renderWithClient(<AdminDashboard />);
    const tile = (await screen.findByRole("link", { name: "Open seats" })).parentElement!;
    expect(await within(tile).findByText("0")).toBeInTheDocument();
    expect(within(tile).getByText("No seats requested")).toBeInTheDocument();
  });
});

describe("Users (UsersPage)", () => {
  it("renders staff with invitation status and action buttons", async () => {
    renderWithClient(<UsersPage />);
    expect((await screen.findAllByText("Users")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("admin@megs.ph")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("recruiter@megs.ph")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Invitation pending")).length).toBeGreaterThan(0);
  });

  it("moves focus through the invitation actions and opens the resend dialog", async () => {
    renderWithClient(<UsersPage />);

    const recruiterMenus = await screen.findAllByRole("button", { name: "Actions for recruiter@megs.ph" });
    fireEvent.click(recruiterMenus[0]);

    const resendItem = screen.getByRole("menuitem", { name: "Resend invitation" });
    const cancelItem = screen.getByRole("menuitem", { name: "Cancel invitation" });
    await waitFor(() => expect(document.activeElement).toBe(resendItem));
    fireEvent.keyDown(resendItem, { key: "ArrowDown" });
    expect(document.activeElement).toBe(cancelItem);

    fireEvent.click(resendItem);

    expect(screen.getByText("Send a new account setup link to recruiter@megs.ph")).toBeDefined();
  });

  it("offers Hand over records for every active recruiter and does not block Deactivate on workload", async () => {
    renderWithClient(<UsersPage />);
    for (const email of ["busy@megs.ph", "idle@megs.ph"]) {
      const menus = await screen.findAllByRole("button", { name: `Actions for ${email}` });
      fireEvent.click(menus[0]);
      expect(await screen.findByRole("menuitem", { name: "Hand over records" })).toBeEnabled();
      expect(screen.getByRole("menuitem", { name: "Deactivate account" })).toBeEnabled();
      fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    }
  });

  it("does not offer Hand over records for an administrator", async () => {
    renderWithClient(<UsersPage />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Actions for admin@megs.ph" }))[0]);
    expect(screen.queryByRole("menuitem", { name: "Hand over records" })).not.toBeInTheDocument();
  });

  it("never lets an administrator deactivate their own account", async () => {
    renderWithClient(<UsersPage />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Actions for admin@megs.ph" }))[0]);
    expect(screen.getByRole("menuitem", { name: "Deactivate account" })).toBeDisabled();
  });

  it("keeps a lower-row action menu beside its trigger instead of covering earlier records", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });

    const rect = (top: number, left: number, width: number, height: number): DOMRect => ({
      top, left, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}),
    });
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute("aria-haspopup") === "menu") return rect(700, 500, 44, 44);
      if (this.getAttribute("role") === "menu") return rect(0, 0, 240, 120);
      return rect(0, 0, 0, 0);
    });

    render(
      <ActionMenu
        label="Actions for selected user"
        items={[
          { label: "Change access", onSelect: vi.fn() },
          { label: "Deactivate account", onSelect: vi.fn() },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Actions for selected user" }));
    const menu = await screen.findByRole("menu", { name: "Actions for selected user" });
    await waitFor(() => expect(menu.style.top).toBe("700px"));
    expect(menu.style.left).toBe("256px");
    expect(menu.style.maxHeight).toBe("92px");

    rectSpy.mockRestore();
  });
});

describe("Matching settings (ScoringConfigPage)", () => {
  it("renders factor sliders, advanced options and total allocation", async () => {
    renderWithClient(<ScoringConfigPage />);
    expect((await screen.findAllByText(/Matching settings/i)).length).toBeGreaterThan(0);
    expect(await screen.findByText("Skills")).toBeDefined();
    expect(await screen.findByText("Total: 100%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View match results/i })).toBeInTheDocument();
  });

  it("shows Ready to save, then Balance to 100% and Discard changes after a slider moves, and Discard changes puts it back", async () => {
    renderWithClient(<ScoringConfigPage />);
    expect(await screen.findByText("Ready to save")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save matching settings" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Discard changes" })).not.toBeInTheDocument();

    fireEvent.change(await screen.findByLabelText("Skills"), { target: { value: "40" } });
    expect(await screen.findByRole("button", { name: "Balance to 100%" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Discard changes" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(await screen.findByText("Total: 100%")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard changes" })).not.toBeInTheDocument();
  });

  it("does not show a missing configuration as active or substitute default weights", async () => {
    vi.mocked(adminApi.getScoringConfig).mockResolvedValue(null as never);
    renderWithClient(<ScoringConfigPage />);
    expect(await screen.findByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText("Ready to save")).not.toBeInTheDocument();
    expect(screen.queryByText("30%")).not.toBeInTheDocument();
  });
});

describe("Match results (ScoringQualityPage)", () => {
  it("does not invent coverage or calculation timing in the current results", async () => {
    vi.mocked(adminApi.getQualityMetrics).mockResolvedValue({ ...QUALITY, coveragePercentage: undefined, knnLatencyP95: undefined, minFitScore: undefined } as never);
    renderWithClient(<ScoringQualityPage />);
    expect(await screen.findByText(/Lowest Not available/)).toBeInTheDocument();
    expect(screen.queryByText(/coverage|latency|ms\b/i, { selector: "dd, dt" })).not.toBeInTheDocument();
  });

  it("separates an unscored population from a real zero average", async () => {
    vi.mocked(adminApi.getQualityMetrics).mockResolvedValue({ ...QUALITY, totalCalculated: 0, averageFitScore: 0 } as never);
    const first = renderWithClient(<ScoringQualityPage />);
    expect(await screen.findByText("No match results yet")).toBeInTheDocument();
    expect(screen.queryByText("0.0%")).not.toBeInTheDocument();
    first.unmount();

    vi.mocked(adminApi.getQualityMetrics).mockResolvedValue({ ...QUALITY, totalCalculated: 2, averageFitScore: 0 } as never);
    renderWithClient(<ScoringQualityPage />);
    expect(await screen.findByText("0.0%")).toBeInTheDocument();
  });
});

describe("Backups and recovery (DatabaseMaintenancePage)", () => {
  it("renders snapshot history, filters and the backup actions", async () => {
    renderWithClient(<DatabaseMaintenancePage />);
    expect((await screen.findAllByText("Backups and recovery")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Nightly copy")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Create backup/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Restore from a file/i })).toBeDefined();
    expect((await screen.findAllByRole("button", { name: /actions for/i })).length).toBeGreaterThan(0);
  });

  it("keeps Restore backup disabled until the acknowledgement is checked", async () => {
    vi.mocked(adminApi.restoreDatabaseBackup).mockResolvedValue({ id: "r-1" } as never);
    renderWithClient(<DatabaseMaintenancePage />);
    fireEvent.click((await screen.findAllByRole("button", { name: /actions for Nightly copy/i }))[0]);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Restore this backup" }));

    const dialog = await screen.findByRole("dialog");
    const confirmInput = within(dialog).getByPlaceholderText("Type RESTORE to confirm");
    const confirm = within(dialog).getByRole("button", { name: "Restore backup" });
    expect(confirm).toBeDisabled();

    fireEvent.change(confirmInput, { target: { value: "RESTORE" } });
    expect(confirm).toBeEnabled();

    fireEvent.change(confirmInput, { target: { value: "" } });
    expect(confirm).toBeDisabled();
    expect(adminApi.restoreDatabaseBackup).not.toHaveBeenCalled();
  });
});

describe("Activity history (AuditLogsPage)", () => {
  it("renders the audit ledger with human-readable labels", async () => {
    renderWithClient(<AuditLogsPage />);
    expect((await screen.findAllByText("Activity history")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Matching settings activated")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Configuration")).length).toBeGreaterThan(0);
  });

  it("handles audit log export errors with notify feedback", async () => {
    const error = new Error("Failed to export report");
    vi.mocked(adminApi.exportAuditReport).mockRejectedValueOnce(error);

    renderWithClient(<AuditLogsPage />);
    expect((await screen.findAllByText("Activity history")).length).toBeGreaterThan(0);

    fireEvent.click(await screen.findByRole("button", { name: /Download PDF/i }));

    await waitFor(() => {
      expect(notify.error).toHaveBeenCalledWith("Export Failed", error);
    });
  });
});
