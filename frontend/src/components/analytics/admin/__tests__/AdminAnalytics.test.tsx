// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, ...props }: any) => (
    <a href={params ? to.replace(/\$(\w+)/g, (_: string, key: string) => params[key]) : to} {...props}>
      {children}
    </a>
  ),
}));

import { AnalyticsFilterBar } from "../../index";
import { AnalyticsKpi, AttentionStrip, BackoutPanel, PlacementTrendChart, RequestProgressList, StagePipeline, StuckList, TeamTable, TeamWorkloadChart } from "../index";
import { AnimatedNumber } from "../motion";
import type {
  AnalyticsFilterOptions,
  BackoutSummary,
  RequestRow,
  StageTableRow,
  StuckCandidate,
  TeamRow,
  Trend,
} from "../../../../lib/types/analytics.types";

describe("Analytics Components Test Suite", () => {
  afterEach(() => {
    cleanup();
  });

  const mockOptions: AnalyticsFilterOptions = {
    clients: [{ id: 1, name: "Acme Corp" }],
    mrfs: [{ id: 10, title: "Q3 Expansion", clientId: 1 }],
    jobPostings: [{ id: 100, title: "Senior Electrician", mrfId: 10, postedById: "user-1" }],
    recruiters: [{ id: "user-1", name: "Recruiter Alice", email: "alice@megs.com" }],
    stages: [
      { key: "INITIAL_SCREENING", label: "Initial Screening" },
      { key: "DEPLOYED", label: "Deployed" },
    ],
  };

  it("renders AnalyticsFilterBar and handles range changes, Apply Filters, and Clear Filters", () => {
    const handleChange = vi.fn();
    render(
      <AnalyticsFilterBar
        filters={{ range: "7d" }}
        onChange={handleChange}
        options={mockOptions}
        showClientFilter={true}
        showRecruiterFilter={true}
      />
    );

    expect(screen.getByText("Last 30 days")).toBeDefined();
    expect(screen.getByText("Last 7 days")).toBeDefined();

    // A preset applies at once; there is nothing left to apply.
    fireEvent.click(screen.getByText("Last 30 days"));
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ range: "30d" }));
    expect(handleChange).toHaveBeenCalledTimes(1);

  });

  it("handles cascading MRF to Job Posting selection and active filter chips", () => {
    const handleChange = vi.fn();
    render(
      <AnalyticsFilterBar
        filters={{ range: "7d", mrfId: 10, jobPostingId: 100 }}
        onChange={handleChange}
        options={mockOptions}
        showClientFilter={true}
        showRecruiterFilter={true}
      />
    );

    // Active filter chips should be rendered
    expect(screen.getByText(/Q3 Expansion/i)).toBeDefined();
    expect(screen.getByText(/Senior Electrician/i)).toBeDefined();

    // Clicking "Clear Filters" button resets all
    const clearBtn = screen.getByRole("button", { name: /Clear filters/i });
    fireEvent.click(clearBtn);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ range: "7d", mrfId: undefined, jobPostingId: undefined })
    );
  });

  it("offers no mine-only scope: a TA's numbers are always their own", () => {
    render(<AnalyticsFilterBar filters={{ range: "7d" }} onChange={vi.fn()} options={mockOptions} />);
    expect(screen.queryByRole("checkbox", { name: /My requisitions only/i })).toBeNull();
  });

  it("will not apply a custom range until both dates are chosen and in order", () => {
    const handleChange = vi.fn();
    render(<AnalyticsFilterBar filters={{ range: "7d" }} onChange={handleChange} options={mockOptions} />);
    fireEvent.click(screen.getByText("Custom range"));
    const apply = screen.getByRole("button", { name: /Apply filters/i }) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toMatch(/start and an end date/);

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-10-10" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-10-12" } });
    expect(apply.disabled).toBe(false);
    fireEvent.click(apply);
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ range: "custom", startDate: "2026-10-10", endDate: "2026-10-12" }));
  });

  it("will not apply a custom range longer than 366 days, counting both ends", () => {
    const handleChange = vi.fn();
    render(<AnalyticsFilterBar filters={{ range: "7d" }} onChange={handleChange} options={mockOptions} />);
    fireEvent.click(screen.getByText("Custom range"));
    const apply = screen.getByRole("button", { name: /Apply filters/i }) as HTMLButtonElement;

    // 2024 is a leap year: 2024-01-01 to 2024-12-31 is exactly 366 days counting both ends, which is allowed.
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2024-01-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2024-12-31" } });
    expect(apply.disabled).toBe(false);

    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2025-01-01" } });
    expect(apply.disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toMatch(/Choose a date range of 366 days or fewer/);
    fireEvent.click(apply);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("hides the extra filters again when asked", () => {
    render(<AnalyticsFilterBar filters={{ range: "30d", clientId: 1 }} onChange={vi.fn()} options={mockOptions} showClientFilter />);
    fireEvent.click(screen.getByRole("button", { name: "More filters" }));
    expect(screen.getByRole("button", { name: "Hide filters" }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Hide filters" }));
    expect(screen.getByRole("button", { name: "More filters" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("explains a KPI behind an (i) and to screen readers, without a line of text on the card", () => {
    render(<AnalyticsKpi label="Days to fill" kind="period" value={4} definition="Calendar days from the request being opened to the start." />);
    const tip = screen.getByRole("button", { name: "About Days to fill" });
    expect(tip.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(tip);
    expect(tip.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("tooltip").textContent).toMatch(/Calendar days from the request being opened/);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(tip.getAttribute("aria-expanded")).toBe("false");
  });

  it("handles recruiter filter selection and active chip display", () => {
    const handleChange = vi.fn();
    render(
      <AnalyticsFilterBar
        filters={{ range: "7d", recruiterId: "user-1" }}
        onChange={handleChange}
        options={mockOptions}
        showRecruiterFilter={true}
      />
    );

    // Active filter chip for recruiter
    const chip = screen.getByTestId("active-filter-chip-recruiterId");
    expect(chip).toBeDefined();
    expect(chip.textContent).toContain("Recruiter Alice");
  });


  const backouts: BackoutSummary = {
    withdrawals: 1,
    backouts: 3,
    byParty: { APPLICANT: 3, CLIENT: 1, AGENCY: 0 },
    byStage: [{ stage: "COMPLIANCE", label: "Requirements", APPLICANT: 2, CLIENT: 1, AGENCY: 0, total: 3 }],
    topReasons: [{ reason: "ACCEPTED_OTHER_OFFER", count: 2 }],
    noShows: 2,
    byClient: [{ clientName: "Acme", count: 3 }, { clientName: "Beta", count: 1 }],
    byRequest: [{ mrfId: 9, title: "10x Electricians", clientName: "Acme", count: 3 }],
    recent: [
      { applicationId: 77, candidateName: "Juan Dela Cruz", jobTitle: "Welder", clientName: "Acme", mrfId: 9, stage: "COMPLIANCE", party: "APPLICANT", reason: "ACCEPTED_OTHER_OFFER", occurredAt: "2026-10-10T02:00:00Z" },
    ],
  };

  it("renders backout totals, reasons and links the latest backouts to the application", () => {
    render(<BackoutPanel data={backouts} rangeLabel="this week" showRecent showStageBars />);
    expect(screen.getAllByText("Accepted another job offer").length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Requirements: 2 applicant, 1 client, 0 agency/)).toBeDefined();
    expect(screen.getByRole("link", { name: "Juan Dela Cruz" }).getAttribute("href")).toBe("/ta/applications/77");
    expect(screen.getByRole("link", { name: "View request" }).getAttribute("href")).toBe("/ta/mrfs/9");
    // Counts come with percentages: 3 of 4 pulled out were applicants
    expect(screen.getByText("3 (75%)")).toBeDefined();
  });

  it("shows no-shows on their own and which clients and requests the backouts hit", () => {
    render(<BackoutPanel data={backouts} rangeLabel="this week" />);
    expect(screen.getByText("No-shows").nextElementSibling?.textContent).toContain("2");
    expect(screen.getByText("By client")).toBeDefined();
    expect(screen.getByText("10x Electricians")).toBeDefined();
  });

  it("reports client answers apart from backouts", () => {
    render(<BackoutPanel data={backouts} clientDecisions={{ accepted: 15, declined: 2 }} rangeLabel="this week" />);
    expect(screen.getByText(/Client answers/).textContent).toMatch(/15 accepted · 2 declined/);
  });

  it("shows an empty state when nothing was recorded", () => {
    const empty: BackoutSummary = { ...backouts, withdrawals: 0, backouts: 0, byStage: [], topReasons: [], recent: [] };
    render(<BackoutPanel data={empty} rangeLabel="this week" showRecent showStageBars />);
    expect(screen.getByText(/None recorded in this period/)).toBeDefined();
  });

  const teamRow = (id: string, name: string, over: Partial<TeamRow> = {}): TeamRow => ({
    recruiterId: id, name, active: 0, overdue: 0, overdueEstimated: 0, openRequisitions: 0, requestedSeats: 0, filledSeats: 0, fillRate: 0,
    sentToClient: 0, newStarts: 0, redeployStarts: 0, placed: 0, backouts: 0, backoutRate: 0, medianDaysToFill: null, ...over,
  });

  it("selects a recruiter from the team table and toggles the selection off", () => {
    const rows = [teamRow("ta-1", "Alice Recruiter", { active: 14, overdue: 3, sentToClient: 5, placed: 4, backouts: 1, backoutRate: 20, medianDaysToFill: 12 })];
    const onSelect = vi.fn();
    const { rerender } = render(<TeamTable rows={rows} rangeLabel="this week" onSelectRecruiter={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Alice Recruiter" }));
    expect(onSelect).toHaveBeenCalledWith("ta-1");

    rerender(<TeamTable rows={rows} rangeLabel="this week" selectedRecruiterId="ta-1" onSelectRecruiter={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Alice Recruiter" }));
    expect(onSelect).toHaveBeenLastCalledWith(undefined);
  });

  it("shows a dash instead of a fake rate when a recruiter has no placements or backouts", () => {
    render(<TeamTable rows={[teamRow("ta-1", "Alice Recruiter", { active: 3 })]} rangeLabel="this week" onSelectRecruiter={vi.fn()} />);
    expect(screen.getByRole("row", { name: /Alice Recruiter/ }).textContent).toContain("—");
  });

  it("shows seats filled with counts and the percentage, and the workload next to results", () => {
    const rows = [teamRow("ta-1", "Alice Recruiter", { active: 14, overdue: 3, overdueEstimated: 2, openRequisitions: 4, requestedSeats: 30, filledSeats: 12, fillRate: 40, placed: 5, newStarts: 3, redeployStarts: 2 })];
    render(<TeamTable rows={rows} rangeLabel="this week" onSelectRecruiter={vi.fn()} />);
    const text = screen.getByRole("row", { name: /Alice Recruiter/ }).textContent;
    expect(text).toContain("12 of 30");
    expect(text).toContain("40%");
    expect(text).toContain("+2 est.");
    expect(text).toContain("3 new · 2 redeploy");
  });

  it("shows the full email when a recruiter has no name", () => {
    const rows = [teamRow("ta-201", "ta-201-1790159306112@megs.com", { active: 5 })];
    render(<TeamWorkloadChart rows={rows} onSelectRecruiter={vi.fn()} />);
    expect(screen.getByRole("button", { name: "ta-201-1790159306112@megs.com" })).toBeDefined();
  });

  it("lists only what needs attention, each scrolling to its section", async () => {
    const scroll = vi.fn();
    const target = document.createElement("div");
    target.id = "waiting-too-long";
    target.scrollIntoView = scroll;
    document.body.appendChild(target);
    render(
      <AttentionStrip
        items={[
          { id: "a", label: "critical waits", count: 3, target: "waiting-too-long", tone: "alert" },
          { id: "b", label: "overdue requests", count: 0, target: "client-requests", tone: "alert" },
        ]}
      />
    );
    expect(screen.queryByText(/overdue requests/)).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: /3\s*critical waits/ }));
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    target.remove();
  });

  it("runs the chip's own action first, so a tab can open before the page scrolls", async () => {
    const calls: string[] = [];
    const target = document.createElement("div");
    target.id = "operations";
    target.scrollIntoView = () => calls.push("scroll");
    document.body.appendChild(target);
    render(<AttentionStrip items={[{ id: "a", label: "overdue requests", count: 7, target: "operations", tone: "alert", onSelect: () => calls.push("select") }]} />);
    fireEvent.click(screen.getByRole("link", { name: /7\s*overdue requests/ }));
    await waitFor(() => expect(calls).toEqual(["select", "scroll"]));
    target.remove();
  });

  it("renders nothing when every count is zero", () => {
    const { container } = render(<AttentionStrip items={[{ id: "a", label: "critical waits", count: 0, target: "x", tone: "alert" }]} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(/Needs attention/)).toBeNull();
  });

  it("makes a KPI card a link to the records behind it, or a jump to a section", () => {
    const { rerender } = render(<AnalyticsKpi label="Active applicants" kind="now" value={5} definition="d" to="/ta/applications" />);
    expect(screen.getByRole("link", { name: /Active applicants/ }).getAttribute("href")).toBe("/ta/applications");
    rerender(<AnalyticsKpi label="Overdue candidates" kind="now" value={5} definition="d" anchor="waiting-too-long" />);
    expect(screen.getByRole("link", { name: /Overdue candidates/ }).getAttribute("href")).toBe("#waiting-too-long");
    rerender(<AnalyticsKpi label="Days to fill" kind="period" value={5} definition="d" />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("pages and searches a long recruiter list, and keeps a selected recruiter visible", () => {
    const rows = Array.from({ length: 23 }, (_, i) => teamRow(`ta-${i}`, `Recruiter ${String(i).padStart(2, "0")}`, { active: i + 1 }));
    const { rerender } = render(<TeamTable rows={rows} rangeLabel="this week" onSelectRecruiter={vi.fn()} pageSize={10} />);
    expect(screen.getAllByRole("button", { name: /^Recruiter \d\d$/ })).toHaveLength(10);
    expect(screen.getByText("1 to 10 of 23 recruiters")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("11 to 20 of 23 recruiters")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getAllByRole("button", { name: /^Recruiter \d\d$/ })).toHaveLength(3);
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);

    // Searching returns to page 1 and narrows the list
    fireEvent.change(screen.getByPlaceholderText("Recruiter name"), { target: { value: "Recruiter 07" } });
    expect(screen.getAllByRole("button", { name: /^Recruiter \d\d$/ })).toHaveLength(1);
    expect(screen.queryByRole("navigation", { name: "recruiters pages" })).toBeNull();

    // A selected recruiter stays listed even when the search does not match them
    rerender(<TeamTable rows={rows} rangeLabel="this week" selectedRecruiterId="ta-3" onSelectRecruiter={vi.fn()} pageSize={10} />);
    expect(screen.getByRole("button", { name: "Recruiter 03" })).toBeDefined();
  });

  const requestRow = (id: number, over: Partial<RequestRow> = {}): RequestRow => ({
    mrfId: id, title: `Request ${id}`, clientId: 1, clientName: "Acme", status: "OPEN", ownerId: "ta-1", ownerName: "Alice", headcount: 10,
    filled: 2, openSeats: 8, pipeline: 3, overdueCandidates: 0, jobCount: 1, applicantCount: 4, attention: null, targetFillDate: null, daysRemaining: null, health: "ON_TRACK", backoutsInPeriod: 0, ...over,
  });

  it("renders client requests with seats, health and due wording", () => {
    const rows = [
      requestRow(1, { title: "20 Warehouse Staff", headcount: 20, filled: 5, openSeats: 15, pipeline: 4, targetFillDate: "2026-10-05T00:00:00Z", daysRemaining: -8, health: "OVERDUE", backoutsInPeriod: 2 }),
      requestRow(2, { title: "5 Welders", headcount: 5, filled: 5, openSeats: 0, health: "FILLED" }),
    ];
    render(<RequestProgressList rows={rows} linkTo="/admin/mrfs/$mrfId" />);
    expect(screen.getByText(/8 days late/)).toBeDefined();
    expect(screen.getByRole("link", { name: "20 Warehouse Staff" }).getAttribute("href")).toBe("/admin/mrfs/1");
    expect(screen.getAllByText("Alice").length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: /20 Warehouse Staff seats filled: 5 \(25%\)/ })).toBeDefined();
    expect(screen.getByText("No target date")).toBeDefined();
  });

  it("filters client requests by status and search, and pages the rest", () => {
    const rows = [
      ...Array.from({ length: 11 }, (_, i) => requestRow(i + 1, { health: "ON_TRACK" })),
      requestRow(50, { title: "Urgent Welders", clientName: "Beta Fab", health: "OVERDUE", targetFillDate: "2026-10-01T00:00:00Z", daysRemaining: -12 }),
    ];
    render(<RequestProgressList rows={rows} linkTo="/admin/mrfs/$mrfId" pageSize={5} />);
    expect(screen.getAllByRole("img", { name: /seats filled/ })).toHaveLength(5);
    expect(screen.getByText("1 to 5 of 12 requests")).toBeDefined();
    // Counts on the status buttons
    expect(screen.getByRole("button", { name: /^Overdue 1$/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /^On track 11$/ })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /^Overdue 1$/ }));
    expect(screen.getAllByRole("img", { name: /seats filled/ })).toHaveLength(1);
    expect(screen.queryByRole("navigation", { name: "requests pages" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^All 12$/ }));
    fireEvent.change(screen.getByPlaceholderText("Request, client or recruiter"), { target: { value: "beta" } });
    expect(screen.getAllByRole("img", { name: /seats filled/ })).toHaveLength(1);

    fireEvent.change(screen.getByPlaceholderText("Request, client or recruiter"), { target: { value: "nothing like this" } });
    expect(screen.getByText(/No match\. Change the status or search/)).toBeDefined();
  });

  const trend = (over: Partial<Trend> = {}): Trend => ({
    granularity: "week",
    points: Array.from({ length: 5 }, (_, i) => ({
      start: `2026-09-${String(14 + i * 7).padStart(2, "0")}`,
      label: `W${i + 1}`,
      newStarts: i === 4 ? 3 : 0,
      redeployStarts: i === 4 ? 1 : 0,
      backouts: i === 4 ? 1 : 0,
      withdrawals: i === 4 ? 2 : 0,
    })),
    ...over,
  });

  it("shows an empty state instead of an empty chart", () => {
    const empty = trend({ points: trend().points.map((p) => ({ ...p, newStarts: 0, redeployStarts: 0, backouts: 0, withdrawals: 0 })) });
    render(<PlacementTrendChart trend={empty} rangeLabel="this week" />);
    expect(screen.getByText(/No starts, backouts or withdrawals in this period/)).toBeDefined();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("highlights requests with nothing moving and filters to the ones with no candidates", () => {
    const rows = [
      requestRow(1, { title: "No job yet", jobCount: 0, applicantCount: 0, attention: "NO_OPENING" }),
      requestRow(2, { title: "Nobody applied", applicantCount: 0, attention: "NO_APPLICANTS" }),
      requestRow(3, { title: "Stuck at first review", pipeline: 0, attention: "FIRST_STAGE_ONLY" }),
      requestRow(4, { title: "Healthy" }),
    ];
    render(<RequestProgressList rows={rows} linkTo="/admin/mrfs/$mrfId" />);
    expect(screen.getByText("No opening")).toBeDefined();
    expect(screen.getByText("No applicants")).toBeDefined();
    expect(screen.getByText("None past review")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /^No candidates 2$/ }));
    expect(screen.getAllByRole("img", { name: /seats filled/ })).toHaveLength(2);
    expect(screen.queryByText("Healthy")).toBeNull();
    expect(screen.queryByText("Stuck at first review")).toBeNull();
  });

  it("guards a request with a headcount of zero instead of showing NaN", () => {
    render(<RequestProgressList rows={[requestRow(1, { headcount: 0, filled: 0, openSeats: 0 })]} linkTo="/ta/mrfs/$mrfId" showOwner={false} />);
    expect(screen.getByRole("img", { name: /seats filled: 0 \(0%\)/ })).toBeDefined();
    expect(screen.queryByText(/NaN/)).toBeNull();
    expect(screen.queryByText(/assigned to/)).toBeNull();
  });

  const stuck = (id: number, over: Partial<StuckCandidate> = {}): StuckCandidate => ({
    applicationId: id, candidateName: `Candidate ${id}`, jobTitle: "Welder", clientName: "Acme", mrfId: 9, recruiterId: "ta-1", recruiterName: "Alice",
    stage: "COMPLIANCE", stageLabel: "Requirements", daysInStage: 20, slaDays: 14, daysOver: 6, urgency: "overdue", estimated: false, ...over,
  });

  it("lists who is waiting too long with urgency, owner and limit, and links to the Admin pages", () => {
    const rows = [
      stuck(1, { urgency: "critical", daysInStage: 30, daysOver: 16 }),
      stuck(2, { stage: "FINAL_INTERVIEW", stageLabel: "Final interview", recruiterId: "ta-2", recruiterName: "Ben", estimated: true }),
    ];
    render(<StuckList rows={rows} total={2} />);
    expect(screen.getByRole("link", { name: "Candidate 1" }).getAttribute("href")).toBe("/admin/applications/1");
    expect(screen.getAllByRole("link", { name: "Welder" })[0].getAttribute("href")).toBe("/admin/mrfs/9");
    expect(screen.getByText("16 days over")).toBeDefined();
    expect(screen.getByRole("img", { name: /Requirements, days in stage, limit 14 days: Within limit 14, Past limit 16/ })).toBeDefined();
    expect(screen.getAllByText(/of 14 days/)).toBeDefined();
    expect(screen.getByText(/· Ben/)).toBeDefined();
    expect(screen.getByText(/Counted from the application date. No stage change was recorded/)).toBeDefined();
  });

  it("serves a TA with their own links and no recruiter filter or name", () => {
    render(<StuckList viewer="ta" rows={[stuck(1, { recruiterName: "You" })]} total={1} title="Overdue candidates" />);
    expect(screen.getByRole("link", { name: "Candidate 1" }).getAttribute("href")).toBe("/ta/applications/1");
    expect(screen.getByRole("link", { name: "Welder" }).getAttribute("href")).toBe("/ta/mrfs/9");
    expect(screen.queryByLabelText("Recruiter")).toBeNull();
    expect(screen.queryByText(/· You/)).toBeNull();
    expect(screen.getByRole("heading", { name: "Overdue candidates" })).toBeDefined();
  });

  it("links a TA's stage cards to their applications in that stage", () => {
    const rows: StageTableRow[] = [
      { stage: "APPLIED", label: "New applications", inStageNow: 2, overdue: 0, overdueEstimated: 0, entered: 1, backedOut: 0, avgDaysInStage: 1, medianDaysInStage: 1, slaDays: 7 },
      { stage: "COMPLIANCE", label: "Requirements", inStageNow: 4, overdue: 1, overdueEstimated: 0, entered: 2, backedOut: 0, avgDaysInStage: 5, medianDaysInStage: 5, slaDays: 14 },
    ];
    render(<StagePipeline rows={rows} rangeLabel="this week" linkStages />);
    expect(screen.getByRole("link", { name: /Requirements/ }).getAttribute("href")).toContain("/ta/applications");
    expect(screen.queryByRole("link", { name: /Submitted/ })).toBeNull();
  });

  it("filters the waiting list by urgency, stage and recruiter", () => {
    const rows = [
      stuck(1, { urgency: "critical" }),
      stuck(2, { stage: "FINAL_INTERVIEW", stageLabel: "Final interview", recruiterId: "ta-2", recruiterName: "Ben" }),
    ];
    render(<StuckList rows={rows} total={2} />);
    fireEvent.click(screen.getByRole("button", { name: /^Critical 1$/ }));
    expect(screen.queryByRole("link", { name: "Candidate 2" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^All 2$/ }));
    fireEvent.change(screen.getByLabelText("Stage"), { target: { value: "FINAL_INTERVIEW" } });
    expect(screen.queryByRole("link", { name: "Candidate 1" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Stage"), { target: { value: "ALL" } });
    fireEvent.change(screen.getByLabelText("Recruiter"), { target: { value: "ta-1" } });
    expect(screen.queryByRole("link", { name: "Candidate 2" })).toBeNull();
  });

  it("explains a capped waiting list and the candidates on closed openings", () => {
    render(<StuckList rows={[stuck(1)]} total={340} closedOpenings={3} />);
    expect(screen.getByText(/Top 1 of 340/)).toBeDefined();
    expect(screen.getByText(/3 more on closed openings/)).toBeDefined();
    cleanup();
    render(<StuckList rows={[]} total={0} />);
    expect(screen.getByText(/No one is past a stage limit/)).toBeDefined();
  });

  it("AnimatedNumber exposes the final value to screen readers and hides the animated frames", () => {
    const { container } = render(<AnimatedNumber value={42} />);
    const sr = container.querySelector(".sr-only") as HTMLElement;
    expect(sr.textContent).toBe("42");
    expect((container.querySelector('[aria-hidden="true"]') as HTMLElement)).not.toBeNull();
    expect(container.textContent).toContain("42");
  });

  it("shows a KPI value without a Now or In period tag", () => {
    const { container } = render(<AnalyticsKpi label="Active applicants" kind="now" value={7} definition="d" />);
    expect(screen.queryByText("Now")).toBeNull();
    expect(screen.queryByText("In period")).toBeNull();
    expect(container.textContent).toContain("7");
  });

  it("calls onSelectStage from a stage row button and shows the TA link rows", () => {
    const rows: StageTableRow[] = [
      { stage: "COMPLIANCE", label: "Requirements", inStageNow: 4, overdue: 1, overdueEstimated: 0, entered: 2, backedOut: 0, avgDaysInStage: 5, medianDaysInStage: 5, slaDays: 14 },
      { stage: "FINAL_INTERVIEW", label: "Final interview", inStageNow: 2, overdue: 0, overdueEstimated: 0, entered: 2, backedOut: 0, avgDaysInStage: 5, medianDaysInStage: 5, slaDays: 5 },
    ];
    const onSelect = vi.fn();
    const { unmount } = render(<StagePipeline rows={rows} rangeLabel="this week" onSelectStage={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Requirements: 4 in stage, 1 overdue. Show these candidates" }));
    expect(onSelect).toHaveBeenCalledWith("COMPLIANCE");
    // A stage with nothing overdue is not a button
    expect(screen.getByRole("group", { name: "Final interview: 2 in stage" })).toBeDefined();
    unmount();
    render(<StagePipeline rows={rows} rangeLabel="this week" linkStages />);
    expect(screen.getByRole("link", { name: "Final interview: 2 in stage. Show these candidates" })).toBeDefined();
    expect(within(screen.getByRole("link", { name: /Requirements/ })).getByRole("img", { name: /within limit 3, overdue 1/ })).toBeDefined();
  });
});
