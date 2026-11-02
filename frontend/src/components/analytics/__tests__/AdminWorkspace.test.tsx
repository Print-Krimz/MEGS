// @vitest-environment jsdom
import { useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, ...props }: any) => (
    <a href={params ? to.replace(/\$(\w+)/g, (_: string, key: string) => params[key]) : to} {...props}>
      {children}
    </a>
  ),
}));

import { OperationsWorkspace, RequestProgressList, StagePipeline, StuckList, TeamTable } from "../index";
import { formatRecruiterName } from "../../../lib/recruiter-label";
import type { RequestRow, StageTableRow, StuckCandidate, TeamRow } from "../../../lib/types/analytics.types";

afterEach(cleanup);

describe("formatRecruiterName", () => {
  it("shows a real name or the full email as stored, never a shortened form", () => {
    expect(formatRecruiterName("Alice Recruiter")).toEqual({ label: "Alice Recruiter" });
    expect(formatRecruiterName("ta-201-1790159306112@megs.com")).toEqual({ label: "ta-201-1790159306112@megs.com" });
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

  it("shows the short label on the tab and keeps the full label and count as its name", () => {
    render(<OperationsWorkspace tabs={[{ key: "r", label: "Client requests", shortLabel: "Requests", count: 4, content: <p>x</p> }]} active="r" onChange={vi.fn()} />);
    const tab = screen.getByRole("tab", { name: "Client requests 4" });
    expect(tab.textContent).toContain("Requests");
    expect(tab.textContent).not.toContain("Client requests");
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
    expect(screen.getByRole("group", { name: "Requirements, 54, 26 overdue" })).toBeDefined();
    expect(screen.getByText(/26 overdue/)).toBeDefined();
    expect(screen.getByRole("group", { name: "Final interview, 4, 3 overdue" })).toBeDefined();
    expect(screen.getByRole("group", { name: "Deployed, 2" })).toBeDefined();
    expect(screen.getByRole("img", { name: "Requirements: within limit 28, overdue 26" })).toBeDefined();
    expect(screen.queryByText(/Watch|Bottleneck|by age only|Show period details/)).toBeNull();
    // Without onSelectStage nothing is a button
    expect(screen.queryByRole("button", { name: /Show these candidates/ })).toBeNull();
  });

  it("draws every bar in one colour and the overdue part in red", () => {
    render(<StagePipeline rows={rows} />);
    const colours = (name: string) =>
      Array.from(screen.getByRole("img", { name }).querySelectorAll<HTMLElement>(".flex > div")).map((d) => d.style.backgroundColor);
    expect(colours("Requirements: within limit 28, overdue 26")).toEqual(["rgb(11, 49, 93)", "rgb(200, 16, 46)"]);
    expect(colours("Submitted: within limit 29, overdue 1")[0]).toBe("rgb(11, 49, 93)");
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
    expect(within(table).getByRole("row", { name: /Final interview/, hidden: true }).textContent).toContain("Not enough data (n=4)");
    expect(within(table).getByRole("row", { name: /Contract signing/, hidden: true }).textContent).toContain("No one in this stage");
    expect(within(table).getByRole("row", { name: /Deployed/, hidden: true }).textContent).toContain("None");
  });

  it("shows a footer under the rows when given one", () => {
    render(<StagePipeline rows={rows} footer={<p>Client answers: 3 approved</p>} />);
    expect(screen.getByText("Client answers: 3 approved")).toBeDefined();
  });

  it("names each stage row from its visible text and puts the footer on the View as table row", () => {
    const { container } = render(<StagePipeline rows={rows} footer={<p>Client answers: 3 approved</p>} />);
    expect(screen.getByRole("group", { name: /^Requirements, 54, 26 overdue/ })).toBeDefined();
    expect(screen.getByText("Candidates in each stage today.")).toBeDefined();
    const footer = screen.getByText("Client answers: 3 approved");
    expect(footer.closest("div")?.parentElement).toBe(container.querySelector("details")?.parentElement);
  });

  it("lets a backed-up stage be chosen to list its candidates", () => {
    const onSelect = vi.fn();
    render(<StagePipeline rows={rows} onSelectStage={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Requirements, 54, 26 overdue. Show these candidates" }));
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
  });
});

describe("admin lists", () => {
  const team = (id: string, name: string, over: Partial<TeamRow> = {}): TeamRow => ({
    recruiterId: id, name, active: 0, overdue: 0, overdueEstimated: 0, openRequisitions: 0, requestedSeats: 0, filledSeats: 0, fillRate: null,
    sentToClient: 0, newStarts: 0, redeployStarts: 0, placed: 0, backouts: 0, backoutRate: null, backoutRateBase: 0, medianDaysToFill: null, daysToFillSample: 0, ...over,
  });
  const stuck = (id: number, over: Partial<StuckCandidate> = {}): StuckCandidate => ({
    applicationId: id, candidateName: `Candidate ${id}`, jobTitle: "Welder", clientName: "Acme", mrfId: 9, recruiterId: "ta-1", recruiterName: "Alice",
    stage: "COMPLIANCE", stageLabel: "Requirements", daysInStage: 20, slaDays: 14, daysOver: 6, urgency: "overdue", estimated: false, ...over,
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
    expect(header("Active").getAttribute("aria-sort")).toBe("none");
    const order = () => screen.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("rowheader")[0].textContent);
    expect(order()).toEqual(["Alice", "Bea", "Cy"]);

    fireEvent.click(within(header("Active")).getByRole("button"));
    expect(header("Active").getAttribute("aria-sort")).toBe("descending");
    expect(header("Overdue").getAttribute("aria-sort")).toBe("none");
    expect(order()).toEqual(["Bea", "Cy", "Alice"]);
    fireEvent.click(within(header("Active")).getByRole("button"));
    expect(header("Active").getAttribute("aria-sort")).toBe("ascending");
    expect(order()).toEqual(["Alice", "Cy", "Bea"]);
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
    expect(row.textContent).toContain("Not enough data (n=3)");
    const pick = screen.getByRole("button", { name: /Show this recruiter's numbers/ });
    expect(pick.getAttribute("title")).toBe("Show this recruiter's numbers");
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
    expect(li.textContent).toContain("No recruiter assigned");
    expect(li.textContent).toContain("1/4 seats");
    expect(li.textContent).toMatch(/Target .*2026/);
    expect(within(li).queryByRole("img")).toBeNull();
    expect(screen.getAllByRole("group", { name: "Filter by status" })[0].textContent).toMatch(/All.*Overdue.*At risk.*On track.*Filled.*No candidates/);
  });

  it("StuckList has no recruiter select, badges Critical or Overdue, and says when a wait is estimated", () => {
    render(<StuckList rows={[stuck(1, { urgency: "critical" }), stuck(2, { estimated: true })]} total={2} />);
    expect(screen.queryByLabelText("Recruiter")).toBeNull();
    expect(screen.getByText("Critical", { selector: "span.border" })).toBeDefined();
    expect(screen.getByText("Overdue", { selector: "span.border" })).toBeDefined();
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
