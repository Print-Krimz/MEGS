// @vitest-environment jsdom
import { useState, type ReactElement } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, ...props }: any) => (
    <a href={params ? to.replace(/\$(\w+)/g, (_: string, key: string) => params[key]) : to} {...props}>
      {children}
    </a>
  ),
}));

const apiMocks = vi.hoisted(() => ({ admin: vi.fn(), ta: vi.fn(), move: vi.fn() }));
vi.mock("../../../lib/api/admin.api", () => ({ adminApi: { getApplication: apiMocks.admin } }));
vi.mock("../../../lib/api/ta.api", () => ({ taApi: { getApplication: apiMocks.ta, updateApplicationStatus: apiMocks.move } }));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OperationsWorkspace,RequestProgressList, StagePipeline, StuckList, TeamTable } from "../index";
import { formatRecruiterName } from "../../../lib/recruiter-label";
import type { RequestRow, StageTableRow, StuckCandidate, TeamRow } from "../../../lib/types/analytics.types";

afterEach(() => {
  cleanup();
  apiMocks.admin.mockReset();
  apiMocks.ta.mockReset();
  apiMocks.move.mockReset();
});

const renderWithQuery = (ui: ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

describe("formatRecruiterName", () => {
  it("shows a plain name as stored and splits an email into name and full address", () => {
    expect(formatRecruiterName("Alice Recruiter")).toEqual({ label: "Alice Recruiter" });
    expect(formatRecruiterName("ta-201-1790159306112@megs.com")).toEqual({
      label: "ta-201-1790159306112",
      email: "ta-201-1790159306112@megs.com",
      full: "ta-201-1790159306112@megs.com",
    });
    const labels = ["ta-201-1790119570618@megs.com", "ta-201-1790116860612@megs.com"].map((e) => formatRecruiterName(e).label);
    expect(new Set(labels).size).toBe(2);
  });

  it("labels the missing owner plainly", () => {
    expect(formatRecruiterName("No recruiter assigned").label).toBe("No owner");
    expect(formatRecruiterName(undefined).label).toBe("Unknown");
  });
});

describe("OperationsWorkspace", () => {
  const tabs = [
    { key: "a", label: "First list", count: 3, content: <input aria-label="first search" /> },
    { key: "b", label: "Second list", count: 5, content: <p>second content</p> },
  ];

  it("shows one tab at a time and keeps the others mounted, so a search is not lost", () => {
    const Harness = () => {
      const [active, setActive] = useState("a");
      return <OperationsWorkspace tabs={tabs} active={active} onChange={setActive} />;
    };
    render(<Harness />);
    const search = screen.getByLabelText("first search") as HTMLInputElement;
    fireEvent.change(search, { target: { value: "welder" } });
    expect(screen.getByRole("tab", { name: /First list 3/ }).getAttribute("aria-selected")).toBe("true");

    fireEvent.click(screen.getByRole("tab", { name: /Second list 5/ }));
    expect(screen.getByText("second content")).toBeDefined();
    expect(document.getElementById("operations-panel-a")?.hasAttribute("hidden")).toBe(true);

    fireEvent.click(screen.getByRole("tab", { name: /First list 3/ }));
    expect((screen.getByLabelText("first search") as HTMLInputElement).value).toBe("welder");
  });

  it("names the tab from its visible text and shows the short label only below md", () => {
    render(<OperationsWorkspace tabs={[{ key: "r", label: "Client requests", shortLabel: "Requests", count: 4, content: <p>x</p> }]} active="r" onChange={vi.fn()} />);
    const tab = screen.getByRole("tab");
    expect(tab.hasAttribute("aria-label")).toBe(false);
    expect(screen.getByText("Requests").className).toContain("md:hidden");
    expect(screen.getByText("Client requests").className).toContain("md:inline");
    expect(tab.textContent).toContain("4");
  });

  it("moves between tabs with the arrow keys", () => {
    const onChange = vi.fn();
    render(<OperationsWorkspace tabs={tabs} active="a" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: /First list/ }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("b");
  });
});

describe("StagePipeline", () => {
  const stage = (key: string, label: string, over: Partial<StageTableRow>): StageTableRow => ({
    stage: key as any, label, inStageNow: 0, overdue: 0, overdueEstimated: 0, entered: 0, backedOut: 0, avgDaysInStage: null, medianDaysInStage: null, typicalWaitSample: 0, slaDays: 7, ...over,
  });
  const rows = [
    stage("APPLIED", "Submitted", { inStageNow: 30, overdue: 1, entered: 24, medianDaysInStage: 3, typicalWaitSample: 24 }),
    stage("COMPLIANCE", "Requirements", { inStageNow: 54, overdue: 20, overdueEstimated: 6, backedOut: 3, medianDaysInStage: 8, typicalWaitSample: 40, slaDays: 14 }),
    stage("FINAL_INTERVIEW", "Final interview", { inStageNow: 4, overdue: 3, medianDaysInStage: null, typicalWaitSample: 4, slaDays: 5 }),
    stage("CONTRACT_SIGNING", "Contract signing", { inStageNow: 0 }),
    stage("DEPLOYED", "Deployed", { inStageNow: 2 }),
  ];

  it("names every stage with its count and overdue total, and never flags Deployed", () => {
    render(<StagePipeline rows={rows} />);
    expect(screen.getByRole("group", { name: "Requirements, 54 · 26 overdue (48%)" })).toBeDefined();
    expect(screen.getByText(/26 overdue/)).toBeDefined();
    expect(screen.getByRole("group", { name: "Final interview, 4 · 3 overdue (75%)" })).toBeDefined();
    expect(screen.getByRole("group", { name: "Deployed, 2" })).toBeDefined();
    expect(screen.getByRole("img", { name: "Requirements: on track 28, overdue 26" })).toBeDefined();
    expect(screen.queryByText(/Watch|Bottleneck|by age only|Show period details/)).toBeNull();
    // Without onSelectStage nothing is a button
    expect(screen.queryByRole("button", { name: /Show these candidates/ })).toBeNull();
  });

  const fills = (name: string) =>
    Array.from(screen.getByRole("img", { name }).querySelectorAll<HTMLElement>(".flex > div")).map((d) => d.style.backgroundColor);

  it("uses one on-track colour on every stage and keeps the overdue part red", () => {
    render(<StagePipeline rows={rows} />);
    expect(fills("Requirements: on track 28, overdue 26")).toEqual(["rgb(58, 111, 176)", "rgb(200, 16, 46)"]);
    expect(fills("Submitted: on track 29, overdue 1")[0]).toBe("rgb(58, 111, 176)");
    expect(fills("Final interview: on track 1, overdue 3")[0]).toBe("rgb(58, 111, 176)");
    expect(fills("Deployed: on track 2")).toEqual(["rgb(58, 111, 176)"]);
  });

  it("keeps overdue inside the stage total and shows its share", () => {
    const { container } = render(
      <StagePipeline rows={[stage("COMPLIANCE", "Requirements", { inStageNow: 19, overdue: 10 }), stage("APPLIED", "Submitted", { inStageNow: 38 })]} />,
    );
    expect(screen.getByText(/10 overdue \(53%\)/)).toBeDefined();
    const bars = Array.from(container.querySelectorAll<HTMLElement>('[role="img"]'));
    // Every bar is scaled to the largest stage (38): 19 fills half, 38 fills all
    expect((bars[0].firstElementChild as HTMLElement).style.width).toBe("50%");
    expect((bars[1].firstElementChild as HTMLElement).style.width).toBe("100%");
    const parts = Array.from(bars[0].querySelectorAll<HTMLElement>(".flex > div")).map((d) => d.style.flexGrow);
    expect(parts).toEqual(["9", "10"]);
  });

  it("caps overdue at the stage count and shows an empty track for a stage with no one", () => {
    const { container } = render(
      <StagePipeline rows={[stage("COMPLIANCE", "Requirements", { inStageNow: 5, overdue: 4, overdueEstimated: 3 }), stage("FINAL_INTERVIEW", "Final interview", { inStageNow: 0 })]} />,
    );
    expect(screen.getByRole("group", { name: "Requirements, 5 · 5 overdue (100%)" })).toBeDefined();
    expect(fills("Requirements: overdue 5")).toEqual(["rgb(200, 16, 46)"]);
    const empty = screen.getByRole("img", { name: "Final interview: none" });
    expect(empty.querySelectorAll(".flex > div").length).toBe(0);
    expect((empty.firstElementChild as HTMLElement).style.width).toBe("0%");
    expect(container.textContent).not.toContain("0 overdue");
  });

  it("explains the colours with words as well as swatches", () => {
    render(<StagePipeline rows={rows} />);
    const legend = screen.getByTestId("stage-legend");
    expect(within(legend).getByText("On track")).toBeDefined();
    expect(within(legend).getByText("Overdue")).toBeDefined();
  });

  it("holds the exact values behind View as table, with a sampled typical wait", () => {
    const { container } = render(<StagePipeline rows={rows} />);
    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.querySelector("summary")?.textContent).toBe("View as table");
    const table = within(details).getByRole("table", { hidden: true });
    expect(within(table).getAllByRole("columnheader", { hidden: true }).map((h) => h.textContent)).toEqual([
      "Stage", "Entered", "In stage", "Overdue", "Typical wait", "Days allowed", "Backed out",
    ]);
    const req = within(table).getByRole("row", { name: /Requirements/, hidden: true });
    expect(req.textContent).toContain("20 + 6 estimated");
    expect(req.textContent).toContain("8 days");
    expect(req.textContent).toContain("14 days");
    expect(within(table).getByRole("row", { name: /Final interview/, hidden: true }).textContent).toContain("Too few to show (4 cases)");
    expect(within(table).getByRole("row", { name: /Contract signing/, hidden: true }).textContent).toContain("No one in this stage");
    expect(within(table).getByRole("row", { name: /Deployed/, hidden: true }).textContent).toContain("None");
  });

  it("shows a footer under the rows when given one", () => {
    render(<StagePipeline rows={rows} footer={<p>Client answers: 3 approved</p>} />);
    expect(screen.getByText("Client answers: 3 approved")).toBeDefined();
  });

  it("names each stage row from its visible text and puts the footer on the View as table row", () => {
    const { container } = render(<StagePipeline rows={rows} footer={<p>Client answers: 3 approved</p>} />);
    expect(screen.getByRole("group", { name: /^Requirements, 54 · 26 overdue \(48%\)/ })).toBeDefined();
    expect(screen.getByText(/How many candidates are in each stage right now/)).toBeDefined();
    const footer = screen.getByText("Client answers: 3 approved");
    expect(footer.closest("div")?.parentElement).toBe(container.querySelector("details")?.parentElement);
  });

  it("lets a backed-up stage be chosen to list its candidates", () => {
    const onSelect = vi.fn();
    render(<StagePipeline rows={rows} onSelectStage={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Requirements, 54 · 26 overdue (48%). Show these candidates" }));
    expect(onSelect).toHaveBeenCalledWith("COMPLIANCE");
    // Deployed has no limit, so it cannot be overdue and is not a button
    expect(screen.queryByRole("button", { name: /Deployed/ })).toBeNull();
  });
});

describe("compact client requests table", () => {
  const row = (id: number, over: Partial<RequestRow> = {}): RequestRow => ({
    mrfId: id, title: `Request ${id}`, clientId: 1, clientName: "Acme", status: "OPEN", ownerId: "ta-1", ownerName: "Alice Recruiter", headcount: 10,
    filled: 2, openSeats: 8, pipeline: 3, overdueCandidates: 0, jobCount: 1, applicantCount: 4, attention: null, targetFillDate: null, daysRemaining: null, health: "ON_TRACK", backoutsInPeriod: 0, ...over,
  });

  it("has one row per request with role, recruiter, seats, pipeline status and due", () => {
    render(
      <RequestProgressList
        linkTo="/admin/mrfs/$mrfId"
        rows={[
          row(1, { title: "5x Welders", ownerName: "ta-9-1790159306112@megs.com", attention: "NO_APPLICANTS", health: "OVERDUE", targetFillDate: "2026-10-01T00:00:00Z", daysRemaining: -12 }),
        ]}
      />
    );
    const li = screen.getByText("5x Welders").closest("li") as HTMLElement;
    expect(li.textContent).toContain("Acme");
    expect(li.textContent).toContain("ta-9-1790159306112@megs.com");
    expect(li.textContent).toContain("2/10 seats");
    expect(li.textContent).toContain("No applicants");
    expect(li.textContent).toContain("12 days late");
    expect(screen.queryAllByRole("columnheader")).toHaveLength(0);
  });

  it("leaves the recruiter out for a TA", () => {
    render(<RequestProgressList linkTo="/ta/mrfs/$mrfId" showOwner={false} rows={[row(1)]} />);
    expect(screen.queryByText("Alice Recruiter")).toBeNull();
    expect((screen.getByText("Request 1").closest("li") as HTMLElement).textContent).toContain("3 in pipeline");
  });

  it("applies a filter from outside and shows its chip only while it is active", () => {
    const rows = [
      row(1, { title: "Late one", health: "OVERDUE" }),
      row(2, { title: "Risky", health: "AT_RISK" }),
      row(3, { title: "Fine" }),
      row(4, { title: "No job", attention: "NO_OPENING" }),
      row(5, { title: "No applicants", attention: "NO_APPLICANTS" }),
    ];
    const { rerender } = render(<RequestProgressList linkTo="/admin/mrfs/$mrfId" rows={rows} />);
    expect(screen.queryByRole("button", { name: /No owner/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Overdue or at risk/ })).toBeNull();
    rerender(<RequestProgressList linkTo="/admin/mrfs/$mrfId" rows={rows} focus={{ health: "LATE", nonce: 1 }} />);
    expect(screen.getByRole("button", { name: /^Overdue or at risk 2$/ })).toBeDefined();
    expect(screen.getByRole("link", { name: "Late one" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Risky" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Fine" })).toBeNull();
    // A new nonce re-applies the filter after the user changed it
    fireEvent.click(screen.getByRole("button", { name: /^All 5$/ }));
    expect(screen.getByRole("link", { name: "Fine" })).toBeDefined();
    rerender(<RequestProgressList linkTo="/admin/mrfs/$mrfId" rows={rows} focus={{ health: "NO_OPENING", nonce: 2 }} />);
    expect(screen.getByRole("link", { name: "No job" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "No applicants" })).toBeNull();
    expect(screen.getByRole("button", { name: /^No job opening/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("RequestProgressList follows a second chip click: the new filter is the one pressed", () => {
    const rows = [row(1, { title: "Late one", health: "OVERDUE" }), row(4, { title: "No job", attention: "NO_OPENING" })];
    const { rerender } = render(<RequestProgressList linkTo="/admin/mrfs/$mrfId" rows={rows} focus={{ health: "LATE", nonce: 1 }} />);
    expect(screen.getByRole("button", { name: /^Overdue or at risk/ }).getAttribute("aria-pressed")).toBe("true");
    rerender(<RequestProgressList linkTo="/admin/mrfs/$mrfId" rows={rows} focus={{ health: "NO_OPENING", nonce: 1 }} />);
    expect(screen.getByRole("button", { name: /^No job opening/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: /^Overdue or at risk/ })).toBeNull();
  });

});

describe("admin lists", () => {
  const team = (id: string, name: string, over: Partial<TeamRow> = {}): TeamRow => ({
    recruiterId: id, name, active: 0, overdue: 0, overdueEstimated: 0, openRequisitions: 0, requestedSeats: 0, filledSeats: 0, fillRate: null,
    sentToClient: 0, newStarts: 0, redeployStarts: 0, placed: 0, backouts: 0, backoutRate: null, backoutRateBase: 0, medianDaysToFill: null, daysToFillSample: 0, ...over,
  });
  const stuck = (id: number, over: Partial<StuckCandidate> = {}): StuckCandidate => ({
    applicationId: id, candidateName: `Candidate ${id}`, jobTitle: "Welder", clientName: "Acme", mrfId: 9, recruiterId: "ta-1", recruiterName: "Alice",
    stage: "COMPLIANCE", stageLabel: "Requirements", daysInStage: 20, slaDays: 14, daysOver: 6, urgency: "overdue", estimated: false, lastActivityAt: null, lastNote: null, ...over,
  });

  it("TeamTable has exactly the 8 columns", () => {
    render(<TeamTable rows={[team("a", "Alice")]} onSelectRecruiter={vi.fn()} />);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent?.replace(/[▲▼↕]/g, ""))).toEqual([
      "Recruiter", "Active", "Overdue", "Open requests", "Seats filled", "Starts", "Backout rate", "Days to fill",
    ]);
  });

  it("TeamTable sorts by a clicked header, keeps Overdue descending by default and puts empty values last", () => {
    const rows = [team("a", "Alice", { active: 2, overdue: 9 }), team("b", "Bea", { active: 5, overdue: 1 }), team("c", "Cy", { active: 3, overdue: 4 })];
    render(<TeamTable rows={rows} onSelectRecruiter={vi.fn()} />);
    const header = (name: string) => screen.getByRole("columnheader", { name });
    expect(header("Overdue").getAttribute("aria-sort")).toBe("descending");
    expect(header("Active").hasAttribute("aria-sort")).toBe(false);
    const order = () => screen.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("rowheader")[0].textContent);
    expect(order()).toEqual(["Alice", "Cy", "Bea"]);

    fireEvent.click(within(header("Active")).getByRole("button"));
    expect(header("Active").getAttribute("aria-sort")).toBe("descending");
    expect(header("Overdue").hasAttribute("aria-sort")).toBe(false);
    expect(order()).toEqual(["Bea", "Cy", "Alice"]);
    fireEvent.click(within(header("Active")).getByRole("button"));
    expect(header("Active").getAttribute("aria-sort")).toBe("ascending");
    expect(order()).toEqual(["Alice", "Cy", "Bea"]);
  });

  it("TeamTable Overdue sort uses verified plus estimated, as the cell shows", () => {
    const rows = [team("a", "Alice", { overdue: 3 }), team("b", "Bea", { overdue: 1, overdueEstimated: 5 }), team("c", "Cy", { overdue: 2 })];
    render(<TeamTable rows={rows} onSelectRecruiter={vi.fn()} />);
    const order = () => screen.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("rowheader")[0].textContent);
    const button = within(screen.getByRole("columnheader", { name: /Overdue/ })).getByRole("button");
    expect(order()).toEqual(["Bea", "Alice", "Cy"]);
    fireEvent.click(button);
    expect(order()).toEqual(["Cy", "Alice", "Bea"]);
  });

  it("StuckList follows a second chip click: the new filter is the one pressed", () => {
    const rows = [stuck(1, { urgency: "critical" }), stuck(2)];
    const { rerender } = render(<StuckList rows={rows} total={2} focus={{ urgency: "critical", nonce: 1 }} />);
    expect(screen.queryByRole("link", { name: "Candidate 2" })).toBeNull();
    rerender(<StuckList rows={rows} total={2} focus={{ urgency: "ALL", nonce: 1 }} />);
    expect(screen.getByRole("link", { name: "Candidate 2" })).toBeDefined();
  });

  it("StuckList search filters by candidate, job, client and recruiter, and says when nothing matches", () => {
    const rows = [
      stuck(1, { candidateName: "Maria Santos", clientName: "Acme", jobTitle: "Welder", recruiterName: "Alice" }),
      stuck(2, { candidateName: "Juan Cruz", clientName: "Globex", jobTitle: "Driver", recruiterName: "Bea" }),
    ];
    render(<StuckList rows={rows} total={2} />);
    const box = screen.getByRole("searchbox", { name: /Search/ });
    fireEvent.change(box, { target: { value: "maria" } });
    expect(screen.getByRole("link", { name: "Maria Santos" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Juan Cruz" })).toBeNull();
    fireEvent.change(box, { target: { value: "globex" } });
    expect(screen.getByRole("link", { name: "Juan Cruz" })).toBeDefined();
    fireEvent.change(box, { target: { value: "DRIVER" } });
    expect(screen.getByRole("link", { name: "Juan Cruz" })).toBeDefined();
    fireEvent.change(box, { target: { value: "alice" } });
    expect(screen.getByRole("link", { name: "Maria Santos" })).toBeDefined();
    fireEvent.change(box, { target: { value: "zzz" } });
    expect(screen.getByText("No overdue candidates match “zzz”.")).toBeDefined();
  });

  it("StuckList search ignores the recruiter when the recruiter is not shown", () => {
    render(<StuckList rows={[stuck(1, { recruiterName: "Alice" })]} total={1} showRecruiter={false} />);
    fireEvent.change(screen.getByRole("searchbox", { name: /Search/ }), { target: { value: "alice" } });
    expect(screen.getByText("No overdue candidates match “alice”.")).toBeDefined();
  });

  it("StuckList shows last activity and the note under each row, and nothing when there is no date", () => {
    const iso = new Date(Date.now() - 4 * 86_400_000 - 3_600_000).toISOString();
    render(<StuckList rows={[stuck(1, { lastActivityAt: iso, lastNote: "Waiting for NBI" }), stuck(2)]} total={2} />);
    expect(screen.getByText("Last activity: 4 days ago · Waiting for NBI")).toBeDefined();
    expect(screen.getAllByText(/Last activity:/)).toHaveLength(1);
  });

  it("StuckList Preview opens a dialog, Next steps through the filtered list, Escape closes", () => {
    const rows = [
      stuck(1, { candidateName: "Ana", lastNote: "Called client", lastActivityAt: "2026-10-30T00:00:00.000Z" }),
      stuck(2, { candidateName: "Ben", clientName: "Globex" }),
      stuck(3, { candidateName: "Cy", clientName: "Acme" }),
    ];
    apiMocks.admin.mockResolvedValue({});
    renderWithQuery(<StuckList rows={rows} total={3} />);
    fireEvent.change(screen.getByRole("searchbox", { name: /Search/ }), { target: { value: "acme" } });
    fireEvent.click(screen.getByRole("button", { name: "Quick view: Ana" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Ana" })).toBeDefined();
    expect(within(dialog).getByText("1 of 2")).toBeDefined();
    expect(within(dialog).getByText("Called client")).toBeDefined();
    expect((within(dialog).getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(dialog).getByRole("link", { name: "Open record" }).getAttribute("href")).toBe("/admin/applications/1");
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));
    expect(within(dialog).getByRole("heading", { name: "Cy" })).toBeDefined();
    expect(within(dialog).getByText("2 of 2")).toBeDefined();
    expect((within(dialog).getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("StuckList Quick view links a recruiter's record to the TA page", () => {
    apiMocks.ta.mockResolvedValue({});
    renderWithQuery(<StuckList rows={[stuck(7)]} total={1} viewer="ta" showRecruiter={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Quick view: Candidate 7" }));
    expect(within(screen.getByRole("dialog")).getByRole("link", { name: "Open record" }).getAttribute("href")).toBe("/ta/applications/7");
  });

  it("StuckList Quick view shows the candidate's contact details and match score from the record", async () => {
    apiMocks.ta.mockResolvedValue({
      id: 7,
      createdAt: "2026-10-01T00:00:00.000Z",
      candidateFitScore: 81.6,
      user: { email: "ana@example.com", applicantProfile: { mobileNumber: "09171234567" } },
    });
    renderWithQuery(<StuckList rows={[stuck(7)]} total={1} viewer="ta" showRecruiter={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Quick view: Candidate 7" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Loading profile…")).toBeDefined();
    expect((await within(dialog).findByRole("link", { name: "ana@example.com" })).getAttribute("href")).toBe("mailto:ana@example.com");
    expect(within(dialog).getByRole("link", { name: "09171234567" }).getAttribute("href")).toBe("tel:09171234567");
    expect(within(dialog).getByText("82")).toBeDefined();
    expect(apiMocks.ta).toHaveBeenCalledWith("7");
  });

  it("StuckList Quick view keeps the row facts and offers Retry when the profile fails", async () => {
    apiMocks.ta.mockRejectedValue(new Error("boom"));
    renderWithQuery(<StuckList rows={[stuck(7, { lastNote: "Called client" })]} total={1} viewer="ta" showRecruiter={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Quick view: Candidate 7" }));
    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByText("Could not load the profile.")).toBeDefined();
    expect(within(dialog).getByRole("button", { name: "Retry" })).toBeDefined();
    expect(within(dialog).getByText("Called client")).toBeDefined();
  });

  describe("Quick view next step", () => {
    const compliance = { id: 7, status: "COMPLIANCE", complianceRequirements: [{ isRequired: true, reviewStatus: "APPROVED" }] };
    const open = () => {
      renderWithQuery(<StuckList rows={[stuck(7)]} total={1} viewer="ta" showRecruiter={false} />);
      fireEvent.click(screen.getByRole("button", { name: "Quick view: Candidate 7" }));
      return screen.getByRole("dialog");
    };

    it("moves a recruiter's candidate with the typed note", async () => {
      apiMocks.ta.mockResolvedValue(compliance);
      apiMocks.move.mockResolvedValue({});
      const dialog = open();
      fireEvent.change(await within(dialog).findByLabelText("Note (optional)"), { target: { value: "  Clearances done  " } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Move to contract signing" }));
      expect(await within(dialog).findByRole("status")).toBeDefined();
      expect(apiMocks.move).toHaveBeenCalledWith("7", { status: "CONTRACT_SIGNING", reason: "Clearances done" });
      expect(within(dialog).getByRole("status").textContent).toMatch(/^Moved to /);
    });

    it("sends the default reason when the note is empty", async () => {
      apiMocks.ta.mockResolvedValue(compliance);
      apiMocks.move.mockResolvedValue({});
      const dialog = open();
      fireEvent.click(await within(dialog).findByRole("button", { name: "Move to contract signing" }));
      await within(dialog).findByRole("status");
      expect(apiMocks.move).toHaveBeenCalledWith("7", { status: "CONTRACT_SIGNING", reason: "All mandatory clearances verified and approved." });
    });

    it("shows the backend's refusal in an alert", async () => {
      apiMocks.ta.mockResolvedValue(compliance);
      apiMocks.move.mockRejectedValue(new Error("Candidate is not yours"));
      const dialog = open();
      fireEvent.click(await within(dialog).findByRole("button", { name: "Move to contract signing" }));
      expect((await within(dialog).findByRole("alert")).textContent).toContain("Candidate is not yours");
    });

    it("offers no move to the Admin", async () => {
      apiMocks.admin.mockResolvedValue(compliance);
      renderWithQuery(<StuckList rows={[stuck(7)]} total={1} viewer="admin" showRecruiter />);
      fireEvent.click(screen.getByRole("button", { name: "Quick view: Candidate 7" }));
      const dialog = screen.getByRole("dialog");
      await within(dialog).findByText("Applied");
      expect(within(dialog).queryByRole("button", { name: /^Move to/ })).toBeNull();
      expect(within(dialog).queryByText("Next step")).toBeNull();
    });

    it("only names the step when it needs a dialog", async () => {
      apiMocks.ta.mockResolvedValue({ id: 7, status: "INITIAL_SCREENING", interviews: [] });
      const dialog = open();
      expect(await within(dialog).findByText("Next step: Schedule interview.")).toBeDefined();
      expect(within(dialog).queryByRole("button", { name: /^Move to/ })).toBeNull();
    });
  });

  it("StuckList in-text links are underlined and closed openings sit in the caption", () => {
    render(<StuckList rows={[stuck(1)]} total={1} closedOpenings={2} />);
    expect(screen.getByRole("link", { name: "Candidate 1" }).className).toContain("underline");
    expect(screen.getByText(/2 more are on closed job openings/).closest("p")?.textContent).toContain("longest wait first");
  });

  it("TeamTable shows the two overdue counts, a sampled rate, and says what a name click does", () => {
    const onSelect = vi.fn();
    render(
      <TeamTable
        onSelectRecruiter={onSelect}
        rows={[team("a", "Alice", { overdue: 3, overdueEstimated: 2, requestedSeats: 30, filledSeats: 12, fillRate: 40, placed: 5, backoutRate: null, backoutRateBase: 3 })]}
      />,
    );
    const row = screen.getByRole("row", { name: /Alice/ });
    expect(row.textContent).toContain("3 + 2 estimated");
    expect(row.textContent).toContain("40%");
    expect(row.textContent).toContain("12 of 30");
    expect(row.textContent).toContain("Too few to show (3 cases)");
    const pick = screen.getByRole("button", { name: /Filter the page to this recruiter/ });
    expect(pick.getAttribute("title")).toBe("Filter the page to this recruiter");
    fireEvent.click(pick);
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("RequestProgressList shows a request with no recruiter, with seat text and the due date as text", () => {
    const row: RequestRow = {
      mrfId: 1, title: "Orphan", clientId: 1, clientName: "Acme", status: "OPEN", ownerId: null, ownerName: "No recruiter assigned", headcount: 4,
      filled: 1, openSeats: 3, pipeline: 0, overdueCandidates: 0, jobCount: 0, applicantCount: 0, attention: "NO_OPENING", targetFillDate: "2026-10-01T00:00:00Z",
      daysRemaining: -3, health: "OVERDUE", backoutsInPeriod: 0,
    };
    render(<RequestProgressList linkTo="/admin/mrfs/$mrfId" rows={[row]} />);
    const li = screen.getByText("Orphan").closest("li") as HTMLElement;
    expect(li.textContent).toContain("No recruiter");
    expect(li.textContent).toContain("1/4 seats");
    expect(li.textContent).toMatch(/Target .*2026/);
    expect(within(li).queryByRole("img")).toBeNull();
    expect(screen.getAllByRole("group", { name: "Filter by status" })[0].textContent).toMatch(/All.*Overdue.*At risk.*On track.*Filled.*No candidates/);
  });

  it("StuckList has no recruiter select, badges Critical or Overdue, and says when a wait is estimated", () => {
    render(<StuckList rows={[stuck(1, { urgency: "critical" }), stuck(2, { estimated: true })]} total={2} />);
    expect(screen.queryByLabelText("Recruiter")).toBeNull();
    expect(screen.getByText("Critical", { selector: "span.shrink-0" })).toBeDefined();
    expect(screen.getByText("Overdue", { selector: "span.shrink-0" })).toBeDefined();
    expect(screen.getByText(/estimated from application date/)).toBeDefined();
  });

  it("StuckList hides the recruiter name when showRecruiter is false and keeps the backend order", () => {
    render(<StuckList rows={[stuck(1, { daysOver: 1 }), stuck(2, { daysOver: 30, urgency: "critical" })]} total={2} showRecruiter={false} />);
    expect(screen.queryByText(/· Alice/)).toBeNull();
    expect(screen.getAllByRole("link", { name: /Candidate/ }).map((a) => a.textContent)).toEqual(["Candidate 1", "Candidate 2"]);
  });

  it("puts a visually hidden h2 and the visible caption in a bare tab panel", () => {
    render(
      <OperationsWorkspace
        active="s"
        onChange={vi.fn()}
        tabs={[{ key: "s", label: "Waiting", count: 0, content: <StuckList bare rows={[]} total={0} subtitle="Past the stage limit." /> }]}
      />,
    );
    const panel = screen.getByRole("tabpanel");
    const h2 = within(panel).getByRole("heading", { level: 2 });
    expect(h2.className).toContain("sr-only");
    expect(within(panel).getByText("Past the stage limit.").className).not.toContain("sr-only");
  });
});
