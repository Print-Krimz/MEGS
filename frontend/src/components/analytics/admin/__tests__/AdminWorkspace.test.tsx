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

import { BackoutPanel, OperationsWorkspace, RequestProgressList, StagePipeline } from "../index";
import { formatRecruiterName } from "../../../../lib/recruiter-label";
import type { BackoutSummary, RequestRow, StageTableRow } from "../../../../lib/types/analytics.types";

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
    stage: key as any, label, inStageNow: 0, overdue: 0, overdueEstimated: 0, entered: 0, backedOut: 0, avgDaysInStage: null, medianDaysInStage: null, slaDays: 7, ...over,
  });
  const rows = [
    stage("APPLIED", "New applications", { inStageNow: 30, overdue: 1, entered: 24, medianDaysInStage: 3 }),
    stage("COMPLIANCE", "Requirements", { inStageNow: 54, overdue: 20, overdueEstimated: 6, backedOut: 3, medianDaysInStage: 8, slaDays: 14 }),
    stage("FINAL_INTERVIEW", "Final interview", { inStageNow: 4, overdue: 3, medianDaysInStage: 9, slaDays: 5 }),
    stage("DEPLOYED", "Awaiting start", { inStageNow: 2 }),
  ];

  it("names every stage with its count and overdue total, adding backed-up estimates, and never flags Deployed", () => {
    render(<StagePipeline rows={rows} rangeLabel="this week" />);
    expect(screen.getByRole("group", { name: "Requirements: 54 in stage, 26 overdue" })).toBeDefined();
    expect(screen.getByRole("group", { name: "Final interview: 4 in stage, 3 overdue" })).toBeDefined();
    expect(screen.getByRole("group", { name: "Submitted: 30 in stage, 1 overdue" })).toBeDefined();
    expect(screen.getByRole("group", { name: "Deployed: 2 in stage" })).toBeDefined();
    expect(screen.getByRole("img", { name: "Requirements: within limit 28, overdue 26" })).toBeDefined();
    expect(screen.queryByText(/Watch|Bottleneck|by age only|Show period details/)).toBeNull();
    // Without onSelectStage nothing is a button
    expect(screen.queryByRole("button", { name: /Show these candidates/ })).toBeNull();
  });

  it("holds entered, typical wait, limit and backed out in a Details table", () => {
    const { container } = render(<StagePipeline rows={rows} rangeLabel="this week" />);
    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.querySelector("summary")?.textContent).toBe("Details");
    const table = within(details).getByRole("table", { hidden: true });
    expect(within(table).getAllByRole("columnheader", { hidden: true }).map((h) => h.textContent)).toEqual([
      "Stage", "Entered", "In stage", "Overdue", "Overdue by age", "Typical wait", "Limit", "Backed out",
    ]);
    const req = within(table).getByRole("row", { name: /Requirements/, hidden: true });
    expect(req.textContent).toContain("8 days");
    expect(req.textContent).toContain("14 days");
    expect(within(table).getByRole("row", { name: /Deployed/, hidden: true }).textContent).toContain("None");
  });

  it("lets a backed-up stage be chosen to list its candidates", () => {
    const onSelect = vi.fn();
    render(<StagePipeline rows={rows} rangeLabel="this week" onSelectStage={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Requirements: 54 in stage, 26 overdue. Show these candidates" }));
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

describe("compact backouts", () => {
  const data: BackoutSummary = {
    withdrawals: 1, backouts: 3, noShows: 1, byParty: { APPLICANT: 2, CLIENT: 1, AGENCY: 1 },
    byStage: [{ stage: "COMPLIANCE", label: "Requirements", APPLICANT: 1, CLIENT: 1, AGENCY: 1, total: 3 }],
    topReasons: [{ reason: "ACCEPTED_OTHER_OFFER", count: 2 }],
    byClient: [{ clientName: "Gamma", count: 2 }, { clientName: "Beta", count: 1 }],
    byRequest: [{ mrfId: 4, title: "25x Warehouse Staff", clientName: "Gamma", count: 2 }],
    recent: [],
  };

  it("keeps the three headline numbers and folds the breakdown behind a toggle", () => {
    const { container } = render(<BackoutPanel data={data} rangeLabel="this week" showStageBars compact />);
    expect(screen.getByText("After client review")).toBeDefined();
    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.textContent).toContain("25x Warehouse Staff");
    expect(screen.getByText("Breakdown")).toBeDefined();
  });
});
