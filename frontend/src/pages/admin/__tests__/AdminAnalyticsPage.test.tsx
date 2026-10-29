// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
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
  },
}));

const stage = (key: string, label: string, over: Record<string, unknown> = {}) => ({
  stage: key, label, inStageNow: 0, overdue: 0, overdueEstimated: 0, entered: 0, backedOut: 0, avgDaysInStage: null, medianDaysInStage: null, slaDays: 7, ...over,
});

const req = (id: number, over: Record<string, unknown> = {}) => ({
  mrfId: id, title: `Request ${id}`, clientId: 1, clientName: "Acme", status: "OPEN", ownerId: "ta-1", ownerName: "Alice", headcount: 10,
  filled: 2, openSeats: 8, pipeline: 3, overdueCandidates: 0, jobCount: 1, applicantCount: 4, attention: null, targetFillDate: null, daysRemaining: null, health: "ON_TRACK", backoutsInPeriod: 0, ...over,
});

const DASHBOARD = {
  dateRange: { startDate: "2026-10-01T00:00:00Z", endDate: "2026-10-07T00:00:00Z" },
  kpis: {
    fillRate: 40, filledSeats: 12, requestedSeats: 30, openSeats: 18,
    requisitions: { total: 4, open: 3, overdue: 2, atRisk: 1, filled: 1 },
    placementsStarted: 5, newStarts: 3, redeployStarts: 2, medianDaysToFill: 12, daysToFillSample: 5,
    backoutsAfterClientReview: 1, backoutRate: 17, backoutRateBase: 6, activeApplicants: 20, overdueCandidates: 4,
    overdueEstimated: 0, closedOpenings: 0, criticalCandidates: 2, unlinkedApplicants: 0, staleFilledRequisitions: 0,
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

describe("AdminAnalyticsPage", () => {
  it("orders the page: KPIs, stage chart, attention strip, lists, backouts", async () => {
    renderPage();
    const kpi = (await screen.findByText("Seats filled")).closest("a,div,article") as HTMLElement;
    const stages = screen.getByText("Candidates by stage");
    const attention = screen.getByRole("region", { name: "Needs attention" });
    const workspace = screen.getByRole("region", { name: "Operations workspace" });
    const backouts = screen.getByText("Withdrawals and backouts");
    expect(before(kpi, stages)).toBe(true);
    expect(before(stages, attention)).toBe(true);
    expect(before(attention, workspace)).toBe(true);
    expect(before(workspace, backouts)).toBe(true);
  });

  it("shows the period caption and no Now or In period tags", async () => {
    renderPage();
    expect((await screen.findByText(/Seats and late requests: today · Others:/)).textContent).toMatch(/Oct/);
    expect(screen.queryByText("Now")).toBeNull();
    expect(screen.queryByText("In period")).toBeNull();
  });

  it("names the stage row and opens the waiting list from it, with short tab names", async () => {
    renderPage();
    const row = await screen.findByRole("button", { name: "Requirements: 5 in stage, 2 overdue. Show these candidates" });
    fireEvent.click(row);
    expect(screen.getByRole("tab", { name: "Waiting 0" }).getAttribute("aria-selected")).toBe("true");
    expect(within(screen.getByRole("tablist")).getByText("Requests")).toBeDefined();
    expect(screen.getByRole("tab", { name: "Client requests 5" })).toBeDefined();
  });

  it("lists critical waits and overdue requests in the attention strip", async () => {
    renderPage();
    expect(await screen.findByRole("link", { name: /2\s*critical waits/ })).toBeDefined();
    expect(screen.getByRole("link", { name: /2\s*overdue requests/ })).toBeDefined();
    expect(screen.queryByText(/Nothing needs attention/)).toBeNull();
  });

  it("hides the attention strip when nothing needs it and keeps the status text screen-reader only", async () => {
    const calm = {
      ...DASHBOARD,
      kpis: { ...DASHBOARD.kpis, criticalCandidates: 0, requisitions: { ...DASHBOARD.kpis.requisitions, overdue: 0 } },
      requests: [],
    };
    vi.mocked(adminApi.getDashboardSummary).mockResolvedValue(calm as never);
    renderPage();
    await screen.findByText("Candidates by stage");
    expect(screen.queryByRole("region", { name: "Needs attention" })).toBeNull();
    expect(screen.queryByText(/Updating the numbers/)?.className ?? "sr-only").toContain("sr-only");
  });

  it("counts exactly the overdue and at-risk rows the Late requests tile opens (unowned rows excluded)", async () => {
    const { unmount } = renderPage();
    const tile = await screen.findByRole("link", { name: /Late requests/ });
    expect(tile.textContent).toMatch(/3/);
    expect(tile.textContent).toMatch(/2 overdue · 1 at risk/);
    fireEvent.click(tile);
    expect(navigateMock).toHaveBeenCalledWith(expect.objectContaining({ search: expect.objectContaining({ tab: "requests", health: "LATE" }) }));
    unmount();

    searchMock.value = { tab: "requests", health: "LATE" };
    renderPage();
    expect(await screen.findByRole("button", { name: /^Overdue or at risk 3$/ })).toBeDefined();
    expect(screen.getAllByRole("img", { name: /seats filled/ })).toHaveLength(3);
  });

  it("no opening counts and opens only requests with no opening, not ones without applicants", async () => {
    const { unmount } = renderPage();
    fireEvent.click(await screen.findByRole("link", { name: /1\s*no opening/ }));
    expect(navigateMock).toHaveBeenCalledWith(expect.objectContaining({ search: expect.objectContaining({ tab: "requests", health: "NO_OPENING" }) }));
    unmount();

    searchMock.value = { tab: "requests", health: "NO_OPENING" };
    renderPage();
    expect(await screen.findByRole("button", { name: /^No opening 1$/ })).toBeDefined();
    expect(screen.getAllByRole("img", { name: /seats filled/ })).toHaveLength(1);
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

  it("falls back to the default report when the search is invalid", async () => {
    searchMock.value = { range: "forever", clientId: "abc", tab: "nope", health: "x" };
    renderPage();
    await screen.findByText("Candidates by stage");
    expect(adminApi.getDashboardSummary).toHaveBeenCalledWith({ range: "7d" }, expect.anything());
    expect(screen.getByRole("tab", { name: /Waiting/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("gives request links the report search as return state", async () => {
    searchMock.value = { range: "30d", tab: "requests", health: "LATE" };
    renderPage();
    const link = await screen.findByRole("link", { name: "Request 1" });
    expect(JSON.parse(link.getAttribute("data-state") ?? "{}")).toEqual({ adminReport: { range: "30d", tab: "requests", health: "LATE" } });
  });
});
