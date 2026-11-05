// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import { render, screen, cleanup, fireEvent, within, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { adminApi } from "../../../lib/api/admin.api";
import { AdminAnalyticsPage } from "../AdminAnalyticsPage";

const { navigateMock, searchMock } = vi.hoisted(() => ({ navigateMock: vi.fn(), searchMock: { value: {} as Record<string, unknown> } }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params: _p, search, state, ...props }: any) => (
    <a href={to} data-search={search ? JSON.stringify(search) : undefined} data-state={state ? JSON.stringify(state) : undefined} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
  useSearch: () => searchMock.value,
}));

vi.mock("../../../lib/api/admin.api", () => ({
  adminApi: {
    getDashboardSummary: vi.fn(),
    exportPipelineReport: vi.fn(),
    exportDeploymentReport: vi.fn(),
    remindRecruiters: vi.fn(),
  },
}));

const { notifyMock } = vi.hoisted(() => ({ notifyMock: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../../lib/feedback", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../../lib/feedback")>()), notify: notifyMock }));

const stage = (key: string, label: string, over: Record<string, unknown> = {}) => ({
  stage: key, label, inStageNow: 0, overdue: 0, overdueEstimated: 0, entered: 0, backedOut: 0, avgDaysInStage: null, medianDaysInStage: null, slaDays: 7, ...over,
});

const req = (id: number, over: Record<string, unknown> = {}) => ({
  mrfId: id, title: `Request ${id}`, clientId: 1, clientName: "Acme", status: "OPEN", ownerId: "ta-1", ownerName: "Alice", headcount: 10,
  filled: 2, openSeats: 8, pipeline: 3, overdueCandidates: 0, jobCount: 1, applicantCount: 4, attention: null, targetFillDate: null, daysRemaining: null, health: "ON_TRACK", backoutsInPeriod: 0, ...over,
});

const DASHBOARD = {
  dateRange: { startDate: "2026-10-01T00:00:00Z", endDate: "2026-10-07T00:00:00Z", days: 7 },
  previousPeriod: { startDate: "2026-09-24", endDate: "2026-09-30", placementsStarted: 4, newStarts: 2, redeployStarts: 2, medianDaysToFill: 14, daysToFillSample: 5, backoutRate: 10, backoutRateBase: 5 },
  clientReview: {
    avgDays: 6.2,
    sample: 8,
    clients: [{ clientId: 1, clientName: "Acme", inReview: 8, avgDays: 6.2, limitDays: 5, overdue: 3 }],
  },
  dueSoon: [],
  dueSoonTotal: 0,
  kpis: {
    fillRate: 40, filledSeats: 12, requestedSeats: 30, openSeats: 18,
    requisitions: { total: 4, open: 3, overdue: 2, atRisk: 1, filled: 1 },
    placementsStarted: 5, newStarts: 3, redeployStarts: 2, medianDaysToFill: 12, daysToFillSample: 5,
    backoutsAfterClientReview: 1, backoutRate: 17, backoutRateBase: 6, activeApplicants: 20, overdueCandidates: 4,
    overdueEstimated: 0, closedOpenings: 0, criticalCandidates: 2, lateRequests: 4, unlinkedApplicants: 0, staleFilledRequisitions: 0,
  },
  team: [],
  unassigned: { applicants: 0, overdue: 0, overdueEstimated: 0, requests: 0, requestedSeats: 0, oldestWaitDays: null },
  requests: [
    req(1, { health: "OVERDUE" }),
    req(2, { health: "OVERDUE" }),
    req(3, { health: "AT_RISK" }),
    req(4, { attention: "NO_OPENING" }),
    req(5, { attention: "NO_APPLICANTS" }),
    req(6, { health: "OVERDUE", ownerId: null, ownerName: "No recruiter assigned" }),
  ],
  trend: { granularity: "week", points: [] },
  backouts: { withdrawals: 0, backouts: 0, byParty: { APPLICANT: 0, CLIENT: 0, AGENCY: 0 }, byStage: [], topReasons: [], noShows: 0, byClient: [], byRequest: [], recent: [] },
  clientDecisions: { accepted: 0, declined: 0 },
  stageTable: [stage("COMPLIANCE", "Requirements", { inStageNow: 5, overdue: 2, slaDays: 14 })],
  stuck: [],
  stuckTotal: 0,
  filterOptions: { clients: [], mrfs: [], jobPostings: [], recruiters: [], stages: [] },
};

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AdminAnalyticsPage />
    </QueryClientProvider>
  );

beforeEach(() => {
  navigateMock.mockClear();
  searchMock.value = {};
  vi.mocked(adminApi.getDashboardSummary).mockResolvedValue(DASHBOARD as never);
});
afterEach(cleanup);

const before = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

const stuckRow = (id: number) => ({
  applicationId: id, candidateName: `Candidate ${id}`, jobTitle: "Electrician", clientName: "Acme", mrfId: 1, recruiterId: "ta-1", recruiterName: "Alice",
  stage: "COMPLIANCE", stageLabel: "Requirements", daysInStage: 9, slaDays: 7, daysOver: 2, urgency: "overdue", estimated: false, lastActivityAt: null, lastNote: null,
});

describe("AdminAnalyticsPage", () => {
  it("orders the page by the team leader's questions", async () => {
    renderPage();
    await screen.findByText("Candidates by stage");
    const names = screen.getAllByRole("heading", { level: 2, hidden: true }).map((h) => h.textContent);
    const at = (name: string) => names.indexOf(name);
    const order = ["Needs action", "Headline numbers", "Candidates by stage", "Starts and backouts", "Overdue candidates", "Client requests", "Recruiters"].map(at);
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Right now", "In these dates"]);
    expect(screen.queryByText(/Team workload/)).toBeNull();
    expect(screen.queryByText("Late requests")).toBeNull();
  });

  it("shows one page-level empty state when nothing is recorded for the dates", async () => {
    const none = {
      ...DASHBOARD,
      kpis: { ...DASHBOARD.kpis, activeApplicants: 0, placementsStarted: 0, requisitions: { ...DASHBOARD.kpis.requisitions, total: 0 }, criticalCandidates: 0, lateRequests: 0 },
      requests: [],
      backouts: { ...DASHBOARD.backouts, backouts: 0, withdrawals: 0 },
      stageTable: [stage("COMPLIANCE", "Requirements")],
    };
    vi.mocked(adminApi.getDashboardSummary).mockResolvedValue(none as never);
    renderPage();
    expect(await screen.findByText("Nothing recorded for these dates. Try a longer range.")).toBeDefined();
    expect(screen.queryByText("Candidates by stage")).toBeNull();
    expect(screen.queryByText("Why people backed out")).toBeNull();
    // Zero tiles are skipped so zeros do not read as results; the action strip stays.
    expect(screen.getByRole("region", { name: "Needs action" })).toBeDefined();
    expect(screen.queryByRole("region", { name: "Headline numbers" })).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Last 30 days" }).at(-1)!);
    expect(navigateMock).toHaveBeenCalledWith(expect.objectContaining({ search: expect.objectContaining({ range: "30d" }) }));
  });

  it("keeps a non-zero filled-with-no-start chip when nothing else is recorded", async () => {
    vi.mocked(adminApi.getDashboardSummary).mockResolvedValue({
      ...DASHBOARD,
      kpis: { ...DASHBOARD.kpis, activeApplicants: 0, placementsStarted: 0, requisitions: { ...DASHBOARD.kpis.requisitions, total: 0 }, criticalCandidates: 0, lateRequests: 0, staleFilledRequisitions: 3 },
      requests: [],
      backouts: { ...DASHBOARD.backouts, backouts: 0, withdrawals: 0 },
    } as never);
    renderPage();
    expect(await screen.findByText(/Nothing recorded for these dates/)).toBeDefined();
    expect(screen.getByRole("link", { name: /3\s*requests filled with no start/ })).toBeDefined();
  });

  it("shows No seats when no seats were requested, and Not enough data (n=N) in small type for a hidden rate", async () => {
    vi.mocked(adminApi.getDashboardSummary).mockResolvedValue({
      ...DASHBOARD,
      kpis: { ...DASHBOARD.kpis, requestedSeats: 0, filledSeats: 0, openSeats: 0, fillRate: null, medianDaysToFill: null, daysToFillSample: 3 },
    } as never);
    renderPage();
    const seats = (await screen.findAllByRole("link", { name: /Seats filled/ }))[0];
    expect(seats.textContent).toContain("No seats");
    expect(seats.textContent).toContain("No open requests");
    expect(screen.queryByRole("link", { name: /Backout rate/ })).toBeNull();
  });

  it("marks the stale-request chip as a watch item and uses plain wording", async () => {
    vi.mocked(adminApi.getDashboardSummary).mockResolvedValue({ ...DASHBOARD, kpis: { ...DASHBOARD.kpis, staleFilledRequisitions: 2 } } as never);
    renderPage();
    const stale = await screen.findByRole("link", { name: /requests filled with no start/ });
    const critical = screen.getByRole("link", { name: /critical waits/ });
    expect(stale.className).toContain("bg-[#FFF4DC]");
    expect(critical.className).toContain("bg-[#FDF1F2]");
    expect(screen.getByText("Typical, from 5 starts")).toBeDefined();
    expect(screen.getByText("Client answers: 0 accepted, 0 declined")).toBeDefined();
  });

  it("shows days to fill against the previous dates and flags clients past their review limit", async () => {
    renderPage();
    const wait = await screen.findByRole("link", { name: /Client review wait/ });
    expect(wait.textContent).toContain("6.2 days");
    expect(wait.textContent).toContain("1 client past their limit");
    expect(wait.innerHTML).toMatch(/text-\[#B42318\]/);
    const fill = screen.getAllByText("Days to fill")[0].parentElement as HTMLElement;
    expect(fill.textContent).toContain("12 days");
    expect(fill.textContent).toContain("-2 days");
    expect(fill.textContent).toContain("vs previous 7 days");
  });

  it("puts the filters and the Needs action chips in one block and lists the client review panels", async () => {
    renderPage();
    const strip = await screen.findByRole("region", { name: "Needs action" });
    expect(strip.parentElement?.parentElement?.textContent).toContain("Last 7 days");
    expect(screen.getByRole("link", { name: /1\s*client past the review limit/ })).toBeDefined();
    expect(screen.getByText("Slowest client reviews")).toBeDefined();
    expect(screen.getByText("Why candidates backed out")).toBeDefined();
  });

  it("moves focus to the Waiting panel heading when the critical chip is chosen", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("link", { name: /2\s*critical waits/ }));
    const panel = document.getElementById("operations-panel-waiting") as HTMLElement;
    expect(document.activeElement).toBe(panel);
    expect(panel.getAttribute("tabindex")).toBe("-1");
    expect(panel.className).toContain("focus-visible:ring-2");
  });

  it("groups the tiles by time base and has no Now or In period tags", async () => {
    renderPage();
    expect(await screen.findByText("Right now")).toBeDefined();
    expect(screen.getByText("In these dates")).toBeDefined();
    expect(screen.getAllByText("How these are counted")).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: /Seats filled/ }).length).toBeGreaterThan(0);
    expect(screen.queryByText("In period")).toBeNull();
  });

  it("names the stage row and opens the waiting list from it, with short tab names", async () => {
    renderPage();
    const row = await screen.findByRole("button", { name: /^Requirements.*5.*2\ overdue\ \(40%\).*Show these candidates/ });
    fireEvent.click(row);
    expect(screen.getByRole("tab", { name: /Overdue candidates 0$/ }).getAttribute("aria-selected")).toBe("true");
    expect(within(screen.getByRole("tablist")).getByText("Requests")).toBeDefined();
    expect(screen.getByRole("tab", { name: /Client requests 6$/ })).toBeDefined();
  });

  it("lists critical waits and overdue requests in the attention strip", async () => {
    renderPage();
    expect(await screen.findByRole("link", { name: /2\s*critical waits/ })).toBeDefined();
    expect(screen.getByRole("link", { name: /4\s*overdue or at-risk requests/ })).toBeDefined();
    expect(screen.queryByText(/Nothing needs attention/)).toBeNull();
  });

  it("says nothing needs action when nothing does and keeps the status text screen-reader only", async () => {
    const calm = {
      ...DASHBOARD,
      kpis: { ...DASHBOARD.kpis, criticalCandidates: 0, lateRequests: 0, requisitions: { ...DASHBOARD.kpis.requisitions, overdue: 0 } },
      clientReview: { avgDays: 3, sample: 8, clients: [{ clientId: 1, clientName: "Acme", inReview: 8, avgDays: 3, limitDays: 5, overdue: 0 }] },
      requests: [],
    };
    vi.mocked(adminApi.getDashboardSummary).mockResolvedValue(calm as never);
    renderPage();
    await screen.findByText("Candidates by stage");
    expect(within(screen.getByRole("region", { name: "Needs action" })).getByText("Nothing needs action right now.")).toBeDefined();
    expect(screen.queryByText(/Updating the numbers/)?.className ?? "sr-only").toContain("sr-only");
  });

  it("counts the late requests chip from the backend and opens the same rows, including a request with no recruiter", async () => {
    const { unmount } = renderPage();
    const chip = await screen.findByRole("link", { name: /4\s*overdue or at-risk requests/ });
    fireEvent.click(chip);
    expect(navigateMock).toHaveBeenCalledWith(expect.objectContaining({ search: expect.objectContaining({ tab: "requests", health: "LATE" }) }));
    unmount();

    searchMock.value = { tab: "requests", health: "LATE" };
    renderPage();
    expect(await screen.findByRole("button", { name: /^Overdue or at risk 4$/ })).toBeDefined();
    expect(screen.getAllByText(/\/10 seats/)).toHaveLength(4);
    expect(screen.getByText("No recruiter assigned")).toBeDefined();
  });

  it("lists requests marked filled with no start in the strip and opens the requests tab", async () => {
    vi.mocked(adminApi.getDashboardSummary).mockResolvedValue({ ...DASHBOARD, kpis: { ...DASHBOARD.kpis, staleFilledRequisitions: 2 } } as never);
    renderPage();
    fireEvent.click(await screen.findByRole("link", { name: /2\s*requests filled with no start/ }));
    expect(navigateMock).toHaveBeenCalledWith(expect.objectContaining({ search: expect.objectContaining({ tab: "requests" }) }));
  });

  it("still opens only requests with no opening from a saved link", async () => {
    searchMock.value = { tab: "requests", health: "NO_OPENING" };
    renderPage();
    expect(await screen.findByRole("button", { name: /^No job opening 1$/ })).toBeDefined();
    expect(screen.getAllByText(/\/10 seats/)).toHaveLength(1);
    expect(screen.getByText("Request 4")).toBeDefined();
    expect(screen.queryByText("Request 5")).toBeNull();
  });

  it("restores filters, dates and tab from the URL search, and uses them for the data and exports", async () => {
    searchMock.value = { range: "custom", startDate: "2026-09-01", endDate: "2026-09-30", clientId: "7", recruiterId: "ta-1", tab: "requests" };
    renderPage();
    await screen.findByText("Candidates by stage");
    expect(adminApi.getDashboardSummary).toHaveBeenCalledWith(
      { range: "custom", startDate: "2026-09-01", endDate: "2026-09-30", clientId: 7, recruiterId: "ta-1" },
      expect.anything(),
    );
    expect(screen.getByRole("tab", { name: /Client requests/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("shows a recruiter banner above the tabs and Clear removes the recruiter filter", async () => {
    searchMock.value = { recruiterId: "ta-1" };
    vi.mocked(adminApi.getDashboardSummary).mockResolvedValue({
      ...DASHBOARD,
      filterOptions: { ...DASHBOARD.filterOptions, recruiters: [{ id: "ta-1", email: "alice@x.com", name: "Alice Reyes" }] },
    } as never);
    renderPage();
    const banner = await screen.findByText(/Filtered by recruiter/);
    expect(banner.closest("[role=status]")?.textContent).toContain("Alice Reyes");
    navigateMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Clear recruiter filter" }));
    const call = navigateMock.mock.calls[0][0];
    expect(call.search.recruiterId).toBeUndefined();
  });

  it("shows no recruiter banner without a recruiter filter", async () => {
    renderPage();
    await screen.findByText("Candidates by stage");
    expect(screen.queryByText(/Filtered by recruiter/)).toBeNull();
  });

  it("falls back to the default report when the search is invalid", async () => {
    searchMock.value = { range: "forever", clientId: "abc", tab: "nope", health: "x" };
    renderPage();
    await screen.findByText("Candidates by stage");
    expect(adminApi.getDashboardSummary).toHaveBeenCalledWith({ range: "7d" }, expect.anything());
    expect(screen.getByRole("tab", { name: /Overdue candidates/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("gives request links the report search as return state", async () => {
    searchMock.value = { range: "30d", tab: "requests", health: "LATE" };
    renderPage();
    const link = await screen.findByRole("link", { name: "Request 1" });
    expect(JSON.parse(link.getAttribute("data-state") ?? "{}")).toEqual({ adminReport: { range: "30d", tab: "requests", health: "LATE" } });
  });

  it("reminds the recruiters of the ticked overdue candidates and reports the result", async () => {
    vi.mocked(adminApi.getDashboardSummary).mockResolvedValue({ ...DASHBOARD, stuck: [stuckRow(11), stuckRow(12), stuckRow(13)], stuckTotal: 3 } as never);
    vi.mocked(adminApi.remindRecruiters).mockResolvedValue({ reminded: 1, candidates: 2, skipped: 0 });
    renderPage();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Select Candidate 11" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Candidate 13" }));
    fireEvent.click(screen.getByRole("button", { name: "Remind recruiters" }));
    await waitFor(() => expect(adminApi.remindRecruiters).toHaveBeenCalledWith([11, 13]));
    await waitFor(() => expect(notifyMock.success).toHaveBeenCalledWith("Reminded 1 recruiter about 2 candidates."));
  });

  it("reminds about one candidate from the row and tells the person when it fails", async () => {
    vi.mocked(adminApi.getDashboardSummary).mockResolvedValue({ ...DASHBOARD, stuck: [stuckRow(11)], stuckTotal: 1 } as never);
    vi.mocked(adminApi.remindRecruiters).mockRejectedValue(new Error("down"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Remind: Candidate 11" }));
    await waitFor(() => expect(adminApi.remindRecruiters).toHaveBeenCalledWith([11]));
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalledWith("The reminder was not sent. Try again.", expect.any(Error)));
  });

  it("reports an error, not success, when no candidate has a recruiter to remind", async () => {
    vi.mocked(adminApi.getDashboardSummary).mockResolvedValue({ ...DASHBOARD, stuck: [stuckRow(11)], stuckTotal: 1 } as never);
    vi.mocked(adminApi.remindRecruiters).mockResolvedValue({ reminded: 0, candidates: 0, skipped: 1 });
    notifyMock.success.mockClear();
    notifyMock.error.mockClear();
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Remind: Candidate 11" }));
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalledWith("No one was reminded. These candidates have no recruiter."));
    expect(notifyMock.success).not.toHaveBeenCalled();
  });

  it("filters by the recruiter of a row", async () => {
    vi.mocked(adminApi.getDashboardSummary).mockResolvedValue({ ...DASHBOARD, stuck: [stuckRow(11)], stuckTotal: 1 } as never);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Filter by recruiter: Candidate 11" }));
    expect(navigateMock).toHaveBeenCalledWith(expect.objectContaining({ search: expect.objectContaining({ recruiterId: "ta-1" }) }));
  });

  it("renders Starts KPI in In these dates, checks definitions, and filters by client on Acme click", async () => {
    renderPage();
    await screen.findByText("Candidates by stage");

    const inTheseDates = screen.getByRole("region", { name: "In these dates" });
    expect(within(inTheseDates).getByText("Starts")).toBeDefined();
    expect(within(inTheseDates).getByText("5")).toBeDefined();
    expect(within(inTheseDates).getByText("3 new · 2 redeployed")).toBeDefined();

    const howCounted = screen.getByText("How these are counted").closest("details")!;
    expect(within(howCounted).getByText("Starts")).toBeDefined();
    expect(within(howCounted).queryByText("Critical wait")).toBeNull();
    expect(within(howCounted).queryByText("Overdue request")).toBeNull();

    const clientReviewPanel = screen.getByText("Slowest client reviews").closest("section")!;
    fireEvent.click(within(clientReviewPanel).getByRole("button", { name: "Acme" }));
    expect(navigateMock).toHaveBeenCalledWith(
      expect.objectContaining({ search: expect.objectContaining({ clientId: 1 }) }),
    );
  });
});
