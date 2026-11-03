// @vitest-environment jsdom
import { recruiterDisplayName } from "../../../lib/recruiter-label";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params: _p, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const { downloadCsvMock } = vi.hoisted(() => ({ downloadCsvMock: vi.fn() }));
vi.mock("../../../lib/csv", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../../lib/csv")>()), downloadCsv: downloadCsvMock }));

import { ActionItemsList, BackoutReasonsDonut, ClientReviewPanel, DueSoonList, StagePipeline, StuckList } from "../index";
import type { BackoutSummary, ClientReview, DueSoonCandidate, StageTableRow, StuckCandidate, TAPendingActionItem } from "../../../lib/types/analytics.types";

const stuckRow = (id: number, over: Partial<StuckCandidate> = {}): StuckCandidate => ({
  applicationId: id,
  candidateName: `Candidate ${id}`,
  jobTitle: "Electrician",
  clientName: "Acme",
  mrfId: 5,
  recruiterId: "ta-1",
  recruiterName: "Alice",
  stage: "COMPLIANCE",
  stageLabel: "Requirements",
  daysInStage: 9,
  slaDays: 7,
  daysOver: 2,
  urgency: "overdue",
  estimated: false,
  lastActivityAt: "2026-10-30T00:00:00Z",
  lastNote: "Waiting on NBI, clearance",
  ...over,
});

const renderWithQuery = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

afterEach(cleanup);
beforeEach(() => downloadCsvMock.mockClear());

describe("StuckList selection", () => {
  const rows = [stuckRow(1), stuckRow(2), stuckRow(3, { urgency: "critical", daysOver: 9 })];

  it("has no checkboxes unless selectable", () => {
    render(<StuckList rows={rows} total={3} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("labels each row checkbox, shows the count, and clears", () => {
    render(<StuckList rows={rows} total={3} selectable />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Candidate 1" }));
    expect(screen.getByText("1 selected")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.queryByText("1 selected")).toBeNull();
  });

  it("select all picks every row on the page and is indeterminate when only some are ticked", () => {
    render(<StuckList rows={rows} total={3} selectable />);
    const all = screen.getByRole("checkbox", { name: "Select all on this page" }) as HTMLInputElement;
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Candidate 2" }));
    expect(all.indeterminate).toBe(true);
    expect(all.checked).toBe(false);
    fireEvent.click(all);
    expect(all.indeterminate).toBe(false);
    expect(all.checked).toBe(true);
    expect(screen.getByText("3 selected")).toBeDefined();
    fireEvent.click(all);
    expect(screen.queryByText(/selected$/)).toBeNull();
  });

  it("drops ticked rows a filter hides, so a bulk action only reaches rows on screen", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    render(<StuckList rows={rows} total={3} selectable bulkActions={[{ key: "remind", label: "Remind recruiter", run }]} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Candidate 1" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Candidate 3" }));
    expect(screen.getByText("2 selected")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /^Critical/ }));
    expect(screen.getByText("1 selected")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Remind recruiter" }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    expect(run.mock.calls[0][0].map((r: StuckCandidate) => r.applicationId)).toEqual([3]);
    await waitFor(() => expect(screen.queryByText("1 selected")).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("checkbox", { name: "Select all on this page" }));
  });

  it("keeps the selection when the action fails", async () => {
    const run = vi.fn().mockRejectedValue(new Error("down"));
    render(<StuckList rows={rows} total={3} selectable bulkActions={[{ key: "remind", label: "Remind recruiter", run }]} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Candidate 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Remind recruiter" }));
    await waitFor(() => expect(run).toHaveBeenCalled());
    await waitFor(() => expect((screen.getByRole("button", { name: "Remind recruiter" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByText("1 selected")).toBeDefined();
  });

  it("exports the selected rows as CSV with the plan's columns and a formula guard", () => {
    const risky = stuckRow(4, { candidateName: "=SUM(A1)", lastNote: "Said \"call\", later" });
    render(<StuckList rows={[rows[0], risky]} total={2} selectable />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all on this page" }));
    fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
    expect(downloadCsvMock).toHaveBeenCalledTimes(1);
    const [fileName, csv] = downloadCsvMock.mock.calls[0] as [string, string];
    expect(fileName).toMatch(/^MEGS_overdue_candidates_\d{4}-\d{2}-\d{2}$/);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Candidate,Job,Client,Recruiter,Stage,Days in stage,Days allowed,Days over,Urgency,Last activity,Last note");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("Candidate 1,Electrician,Acme,Alice,Requirements,9,7,2,Overdue,2026-10-30,\"Waiting on NBI, clearance\"");
    expect(lines[2].startsWith("'=SUM(A1),")).toBe(true);
    expect(lines[2]).toContain('"Said ""call"", later"');
    expect(screen.getByText("Exported 2 candidates.")).toBeDefined();
  });

  it("runs a row action on that row", async () => {
    const run = vi.fn();
    render(<StuckList rows={rows} total={3} selectable rowActions={[{ key: "remind", label: "Remind", run }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Remind: Candidate 2" }));
    await waitFor(() => expect(run).toHaveBeenCalledWith(expect.objectContaining({ applicationId: 2 })));
  });

  it("drops candidates that left the list from the selection", () => {
    const { rerender } = render(<StuckList rows={rows} total={3} selectable />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all on this page" }));
    expect(screen.getByText("3 selected")).toBeDefined();
    rerender(<StuckList rows={rows.slice(0, 2)} total={2} selectable />);
    expect(screen.getByText("2 selected")).toBeDefined();
  });
});

describe("ClientReviewPanel", () => {
  const data: ClientReview = {
    avgDays: 6,
    sample: 9,
    clients: [
      { clientId: 1, clientName: "Acme", inReview: 6, avgDays: 6.2, limitDays: 5, overdue: 2 },
      { clientId: 2, clientName: "Globex", inReview: 3, avgDays: null, limitDays: 5, overdue: 0 },
    ],
  };

  it("ranks clients, flags the one over its limit in words, and says too few where the average is hidden", () => {
    render(<ClientReviewPanel data={data} />);
    expect(screen.getByText("Slowest client reviews")).toBeDefined();
    expect(screen.getByText("Average days in client review vs each client's limit")).toBeDefined();
    const items = screen.getAllByRole("listitem");
    expect(items[0].textContent).toContain("Acme");
    expect(items[0].textContent).toContain("6.2 days avg");
    expect(items[0].textContent).toContain("over the 5 days limit");
    expect(items[0].textContent).toContain("2 overdue");
    expect(items[1].textContent).toContain("Too few to show (3 cases)");
    expect(within(items[1]).queryByRole("img")).toBeNull();
    expect(within(items[0]).getByRole("img", { name: /Acme, average 6.2 days, limit 5 days/ })).toBeDefined();
  });

  it("says when no one is in client review", () => {
    render(<ClientReviewPanel data={{ avgDays: null, sample: 0, clients: [] }} />);
    expect(screen.getByText("No candidates in client review.")).toBeDefined();
  });
});

describe("DueSoonList", () => {
  const due = (id: number, daysLeft: number): DueSoonCandidate => ({ ...stuckRow(id), daysOver: 0, daysLeft });

  it("shows up to 5 rows with due wording and a more count", () => {
    const rows = [due(1, 0), due(2, 1), due(3, 2), due(4, 2), due(5, 2), due(6, 2)];
    renderWithQuery(<DueSoonList rows={rows} total={8} viewer="ta" />);
    expect(screen.getByText("Due soon")).toBeDefined();
    expect(screen.getByText("Due today")).toBeDefined();
    expect(screen.getByText("Due in 1 day")).toBeDefined();
    expect(screen.getAllByText("Due in 2 days")).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: /^Quick view/ })).toHaveLength(5);
    expect(screen.getByText("+3 more")).toBeDefined();
  });

  it("is plain when nothing is due", () => {
    renderWithQuery(<DueSoonList rows={[]} total={0} viewer="ta" />);
    expect(screen.getByText("Nothing due in the next 2 days.")).toBeDefined();
  });

  it("opens the quick view with the due time instead of days over", () => {
    renderWithQuery(<DueSoonList rows={[due(1, 1)]} total={1} viewer="ta" />);
    fireEvent.click(screen.getByRole("button", { name: "Quick view: Candidate 1" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Due")).toBeDefined();
    expect(within(dialog).queryByText("Over by")).toBeNull();
  });
});

describe("Bulk actions beside Select all", () => {
  const rows = [stuckRow(1), stuckRow(2)];
  it("shows the count and actions on the Select all row only once something is ticked", () => {
    render(<StuckList viewer="ta" rows={rows} total={2} selectable />);
    expect(screen.queryByRole("group", { name: "Actions for the ticked candidates" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Candidate 2" }));
    const bar = screen.getByRole("group", { name: "Actions for the ticked candidates" });
    expect(bar.textContent).toContain("1 selected");
    for (const name of ["Move stage", "Export selected", "Clear selection"]) expect(within(bar).getByRole("button", { name })).toBeDefined();
  });
  it("has no Move stage for an administrator", () => {
    render(<StuckList rows={rows} total={2} selectable />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Candidate 1" }));
    expect(within(screen.getByRole("group", { name: "Actions for the ticked candidates" })).queryByRole("button", { name: "Move stage" })).toBeNull();
  });
});

describe("ActionItemsList", () => {
  const item = (id: string, over: Partial<TAPendingActionItem> = {}): TAPendingActionItem => ({
    id,
    type: "CLIENT_ENDORSEMENT",
    title: "Record the client answer",
    candidateName: "Juan Cruz",
    jobTitle: "Welder",
    applicationId: 7,
    urgency: "HIGH",
    agingDays: 4,
    targetUrl: "/ta/applications/7",
    createdAt: "2026-10-30T00:00:00Z",
    ...over,
  });

  it("marks a deadline before today as High and N days overdue; today or later reads Due in N days with the date", () => {
    const now = new Date("2026-11-02T04:00:00Z");
    render(
      <ActionItemsList
        now={now}
        total={2}
        rows={[
          item("late", { title: "Review Clearance", urgency: "MEDIUM", agingDays: undefined, deadline: "2026-10-25T00:00:00Z" }),
          item("soon", { title: "Sign contract", urgency: "MEDIUM", agingDays: undefined, deadline: "2026-11-07T00:00:00Z" }),
        ]}
      />
    );
    const [late, soon] = screen.getAllByRole("listitem");
    expect(late.textContent).toContain("8 days overdue");
    expect(late.textContent).toContain("High");
    expect(late.textContent).toContain("Was due Oct 25, 2026");
    expect(soon.textContent).toContain("Due in 5 days");
    expect(soon.textContent).toContain("Nov 7, 2026");
    expect(soon.textContent).toContain("Medium");
  });

  it("lists each task with its urgency in words, age, and an Open link, and counts what is shown", () => {
    render(<ActionItemsList rows={[item("a"), item("b", { urgency: "NORMAL", agingDays: undefined, deadline: "2026-11-05T00:00:00Z" })]} total={9} />);
    expect(screen.getByText("High")).toBeDefined();
    expect(screen.getByText("Low")).toBeDefined();
    expect(screen.getByText("Waiting 4 days")).toBeDefined();
    expect(screen.getByText(/^Due in \d+ days?$/)).toBeDefined();
    expect(screen.getAllByText("Client review").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /^Open: Record the client answer, Juan Cruz/ })[0].getAttribute("href")).toBe("/ta/applications/7");
    expect(screen.getByText(/Showing 2 of 9/)).toBeDefined();
    expect(screen.getByRole("link", { name: "See all on Overview" }).getAttribute("href")).toBe("/ta");
  });

  it("is plain when nothing is waiting", () => {
    render(<ActionItemsList rows={[]} total={0} />);
    expect(screen.getByText("Nothing is waiting on you.")).toBeDefined();
  });
});

describe("BackoutReasonsDonut", () => {
  const data = {
    withdrawals: 2,
    backouts: 8,
    byParty: { APPLICANT: 5, CLIENT: 3, AGENCY: 2 },
    byStage: [],
    topReasons: [
      { reason: "A", label: "Found other work", count: 5 },
      { reason: "B", label: "Pay too low", count: 2 },
    ],
    noShows: 0,
    byClient: [],
    byRequest: [],
    recent: [],
  } as BackoutSummary;

  it("shows reasons with counts and the rest as Other", () => {
    render(<BackoutReasonsDonut data={data} />);
    expect(screen.getByRole("heading", { name: "Why candidates backed out" })).toBeDefined();
    const legend = screen.getByRole("list", { name: /legend/ });
    expect(legend.textContent).toContain("Found other work");
    expect(legend.textContent).toContain("Other");
    expect(within(legend).getByText("5")).toBeDefined();
    expect(screen.getByRole("img", { name: /Other 3/ })).toBeDefined();
  });

  it("says nothing was recorded when no one backed out", () => {
    render(<BackoutReasonsDonut data={{ ...data, withdrawals: 0, backouts: 0, topReasons: [] }} />);
    expect(screen.getByText("Nothing recorded in these dates.")).toBeDefined();
  });
});

describe("StagePipeline average wait", () => {
  const row = (stage: string, label: string, over: Partial<StageTableRow> = {}): StageTableRow => ({
    stage: stage as StageTableRow["stage"], label, inStageNow: 4, overdue: 0, overdueEstimated: 0, entered: 4, backedOut: 0, avgDaysInStage: 2.5, medianDaysInStage: 2, typicalWaitSample: 5, slaDays: 3, ...over,
  });

  it("states the average against the limit, in red words when over, and hides it when too thin", () => {
    render(
      <StagePipeline
        rows={[
          row("COMPLIANCE", "Requirements"),
          row("FINAL_INTERVIEW", "Final interview", { avgDaysInStage: 4.5 }),
          row("CLIENT_ENDORSEMENT", "Client review", { avgDaysInStage: 6 }),
          row("INITIAL_INTERVIEW", "Initial interview", { avgDaysInStage: null }),
          row("DEPLOYED", "Deployed", { avgDaysInStage: 3 }),
        ]}
      />
    );
    expect(screen.getByText("avg 2.5 days vs 3-day limit")).toBeDefined();
    expect(screen.getByText(/avg 4.5 days vs 3-day limit/).textContent).toContain("over the limit");
    expect(screen.getByText("avg 6 days vs client limit")).toBeDefined();
    expect(screen.getAllByText(/^avg /)).toHaveLength(3);
    // The average also describes its row for screen readers.
    expect(screen.getByRole("group", { name: "Requirements, 4" }).getAttribute("aria-describedby")).toBeTruthy();
  });
});

describe("recruiterDisplayName", () => {
  it("keeps real names and turns an email into one title-cased name with no second line", () => {
    expect(recruiterDisplayName("Ferdinand Rito")).toEqual({ label: "Ferdinand Rito" });
    expect(recruiterDisplayName("sales_food_001@175dev.com")).toEqual({ label: "Sales Food 001", full: "sales_food_001@175dev.com" });
    expect(recruiterDisplayName("naheje4599@37xiao.com").email).toBeUndefined();
  });
});
