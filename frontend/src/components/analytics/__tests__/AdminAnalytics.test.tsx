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

import { AnalyticsFilterBar } from "../index";
import { AnalyticsKpi, AttentionStrip, KpiGroup, KpiRow, BackoutPanel, LineChart, RequestProgressList, StagePipeline, StuckList, TeamTable } from "../index";
import { AnimatedNumber } from "../motion";
import type {
  AnalyticsFilterOptions,
  BackoutSummary,
  RequestRow,
  StageTableRow,
  StuckCandidate,
  TeamRow,
} from "../../../lib/types/analytics.types";

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

    expect(screen.getByRole("button", { name: "Last 30 days" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Last 7 days" })).toBeDefined();

    // A preset applies at once; there is nothing left to apply.
    fireEvent.click(screen.getByRole("button", { name: "Last 30 days" }));
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

  it("applies a custom range at once when both dates are chosen and in order, with no Apply step", () => {
    const handleChange = vi.fn();
    render(<AnalyticsFilterBar filters={{ range: "7d" }} onChange={handleChange} options={mockOptions} />);
    fireEvent.click(screen.getByRole("button", { name: "Custom range" }));
    expect(screen.queryByRole("button", { name: /Apply filters/i })).toBeNull();
    expect(screen.getByRole("alert").textContent).toMatch(/start and an end date/);

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-10-10" } });
    expect(handleChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-10-12" } });
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ range: "custom", startDate: "2026-10-10", endDate: "2026-10-12" }));
  });

  it("does not apply a custom range longer than 366 days, counting both ends, and links the error to both dates", () => {
    const handleChange = vi.fn();
    render(<AnalyticsFilterBar filters={{ range: "7d" }} onChange={handleChange} options={mockOptions} />);
    fireEvent.click(screen.getByRole("button", { name: "Custom range" }));

    // 2024 is a leap year: 2024-01-01 to 2024-12-31 is exactly 366 days counting both ends, which is allowed.
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2024-01-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2024-12-31" } });
    expect(handleChange).toHaveBeenCalledTimes(1);

    handleChange.mockClear();
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2025-01-01" } });
    expect(handleChange).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/Choose a date range of 366 days or fewer/);
    for (const label of ["From", "To"]) {
      const input = screen.getByLabelText(label);
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(input.getAttribute("aria-describedby")).toBe(alert.id);
    }
  });

  it("hides the extra filters again when asked", () => {
    render(<AnalyticsFilterBar filters={{ range: "30d", clientId: 1 }} onChange={vi.fn()} options={mockOptions} showClientFilter />);
    fireEvent.click(screen.getByRole("button", { name: "More filters" }));
    expect(screen.getByRole("button", { name: "Hide filters" }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Hide filters" }));
    expect(screen.getByRole("button", { name: "More filters" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("states definitions once in a closed disclosure, with no tooltips on tiles", () => {
    const { container } = render(
      <KpiRow definitions={[{ label: "Days to fill", definition: "Typical days from request opened to worker start." }]}>
        <KpiGroup label="In these dates">
          <AnalyticsKpi label="Days to fill" value="4 days" detail="Median, 6 starts" />
        </KpiGroup>
      </KpiRow>
    );
    expect(screen.getByText("In these dates")).toBeDefined();
    expect(container.querySelectorAll("details")).toHaveLength(1);
    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.querySelector("summary")?.textContent).toContain("How these are counted");
    expect(details.textContent).toContain("Typical days from request opened to worker start.");
    expect(container.querySelector("[role=tooltip]")).toBeNull();
    expect(screen.queryByRole("button", { name: /About/ })).toBeNull();
  });

  it("lays every tile out in one equal-width grid, with each group spanning its tile count", () => {
    const { container } = render(
      <KpiRow definitions={[]}>
        <KpiGroup label="Right now">
          <AnalyticsKpi label="Seats filled" value="40%" />
        </KpiGroup>
        <KpiGroup label="In these dates">
          <AnalyticsKpi label="Starts" value={5} />
          <AnalyticsKpi label="Days to fill" value="4 days" />
          <AnalyticsKpi label="Backout rate" value="17%" />
        </KpiGroup>
      </KpiRow>
    );
    const row = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(row.className).toContain("grid");
    expect(row.className).toContain("md:grid-cols-4");
    expect(row.className).not.toContain("flex");
    expect(screen.getByRole("region", { name: "Right now" }).className).toContain("md:col-span-1");
    expect(screen.getByRole("region", { name: "In these dates" }).className).toContain("md:col-span-3");
    const summary = container.querySelector("summary")!;
    expect(summary.className).toContain("underline");
    expect(summary.querySelector("[aria-hidden=true]")).not.toBeNull();
  });

  it("renders words in small type and numbers, percents and days as headlines", () => {
    render(
      <>
        <AnalyticsKpi label="A" value="Not enough data (n=2)" detail="d" />
        <AnalyticsKpi label="B" value="No seats" />
        <AnalyticsKpi label="C" value="62.5%" />
        <AnalyticsKpi label="D" value="12 days" />
        <AnalyticsKpi label="E" value={7} />
      </>
    );
    const sizeOf = (label: string) => screen.getByText(label).nextElementSibling as HTMLElement;
    expect(sizeOf("A").className).toContain("text-base");
    expect(sizeOf("B").className).toContain("text-base");
    for (const l of ["C", "D", "E"]) expect(sizeOf(l).className).toContain("text-3xl");
    expect(screen.getByText("d").className).toContain("text-balance");
  });

  it("gives watch chips the amber look and overdue chips the red look", () => {
    render(
      <AttentionStrip
        items={[
          { key: "a", count: 2, label: "critical waits", href: "#x" },
          { key: "b", count: 1, label: "tasks waiting on you", href: "#y", tone: "watch" },
        ]}
      />
    );
    expect(screen.getByRole("link", { name: /critical waits/ }).className).toContain("bg-[#FDF1F2]");
    const watch = screen.getByRole("link", { name: /tasks waiting on you/ });
    expect(watch.className).toContain("bg-[#FFF4DC]");
    expect(watch.className).not.toContain("bg-[#FDF1F2]");
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
    topReasons: [{ reason: "ACCEPTED_OTHER_OFFER", label: "Accepted another job offer", count: 2 }],
    noShows: 2,
    byClient: [{ clientName: "Acme", count: 3 }, { clientName: "Beta", count: 1 }],
    byRequest: [{ mrfId: 9, title: "10x Electricians", clientName: "Acme", count: 3 }],
    recent: [
      { applicationId: 77, candidateName: "Juan Dela Cruz", jobTitle: "Welder", clientName: "Acme", mrfId: 9, stage: "COMPLIANCE", party: "APPLICANT", reason: "ACCEPTED_OTHER_OFFER", occurredAt: "2026-10-10T02:00:00Z" },
    ],
  };

  it("shows one panel: two counts, no-shows as a line, who backed out in text, and reasons by label", () => {
    render(<BackoutPanel data={{ ...backouts, noShows: 1 }} />);
    expect(screen.getByRole("heading", { name: "Why people backed out" })).toBeDefined();
    expect(screen.getByText("Before client review").nextElementSibling?.textContent).toContain("1");
    expect(screen.getByText("After client review").nextElementSibling?.textContent).toContain("3");
    expect(screen.getByText("1 no-show in these dates")).toBeDefined();
    expect(screen.queryByText("No-shows")).toBeNull();
    expect(screen.getByRole("img", { name: /Who backed out: Applicant 3, Client 1/ })).toBeDefined();
    expect(screen.getByText("Applicant").parentElement?.textContent).toContain("3");
    expect(screen.getAllByText("Accepted another job offer").length).toBeGreaterThan(0);
    for (const gone of ["By client", "By request", "By stage", "Latest"]) expect(screen.queryByText(gone)).toBeNull();
    expect(screen.queryByText(/Client answers/)).toBeNull();
  });

  it("uses plural no-shows, a visible caption and no (i) button", () => {
    render(<BackoutPanel data={{ ...backouts, noShows: 2 }} />);
    expect(screen.getByText("2 no-shows in these dates")).toBeDefined();
    expect(screen.getByText(/A client turning someone down is not a backout/)).toBeDefined();
    expect(screen.queryByRole("button", { name: /Why people backed out/ })).toBeNull();
  });

  it("hides the no-show line at zero, the party bar at zero, and caps reasons at five", () => {
    const reasons = Array.from({ length: 7 }, (_, i) => ({ reason: `R${i}`, label: `Reason ${i}`, count: 7 - i }));
    render(<BackoutPanel data={{ ...backouts, noShows: 0, byParty: { APPLICANT: 0, CLIENT: 0, AGENCY: 0 }, topReasons: reasons }} />);
    expect(screen.queryByText(/no-shows/)).toBeNull();
    expect(screen.queryByText("Who backed out")).toBeNull();
    expect(screen.getByText("Reason 4")).toBeDefined();
    expect(screen.queryByText("Reason 5")).toBeNull();
  });

  it("shows an empty state when nothing was recorded", () => {
    const empty: BackoutSummary = { ...backouts, withdrawals: 0, backouts: 0, byStage: [], topReasons: [], recent: [] };
    render(<BackoutPanel data={empty} />);
    expect(screen.getByText(/Nobody backed out in these dates/)).toBeDefined();
  });

  const teamRow = (id: string, name: string, over: Partial<TeamRow> = {}): TeamRow => ({
    recruiterId: id, name, active: 0, overdue: 0, overdueEstimated: 0, openRequisitions: 0, requestedSeats: 0, filledSeats: 0, fillRate: 0,
    sentToClient: 0, newStarts: 0, redeployStarts: 0, placed: 0, backouts: 0, backoutRate: 0, backoutRateBase: 0, medianDaysToFill: null, daysToFillSample: 0, ...over,
  });

  it("selects a recruiter from the team table and toggles the selection off", () => {
    const rows = [teamRow("ta-1", "Alice Recruiter", { active: 14, overdue: 3, sentToClient: 5, placed: 4, backouts: 1, backoutRate: 20, medianDaysToFill: 12 })];
    const onSelect = vi.fn();
    const { rerender } = render(<TeamTable rows={rows} onSelectRecruiter={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /^Alice Recruiter\./ }));
    expect(onSelect).toHaveBeenCalledWith("ta-1");

    rerender(<TeamTable rows={rows} selectedRecruiterId="ta-1" onSelectRecruiter={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /^Alice Recruiter\./ }));
    expect(onSelect).toHaveBeenLastCalledWith(undefined);
  });

  it("says how few records stand behind a rate instead of showing a fake one", () => {
    render(<TeamTable rows={[teamRow("ta-1", "Alice Recruiter", { active: 3 })]} onSelectRecruiter={vi.fn()} />);
    expect(screen.getByRole("row", { name: /Alice Recruiter/ }).textContent).toContain("Not enough data (n=0)");
  });

  it("shows seats filled with counts and the percentage, and the workload next to results", () => {
    const rows = [teamRow("ta-1", "Alice Recruiter", { active: 14, overdue: 3, overdueEstimated: 2, openRequisitions: 4, requestedSeats: 30, filledSeats: 12, fillRate: 40, placed: 5, newStarts: 3, redeployStarts: 2 })];
    render(<TeamTable rows={rows} onSelectRecruiter={vi.fn()} />);
    const text = screen.getByRole("row", { name: /Alice Recruiter/ }).textContent;
    expect(text).toContain("12 of 30");
    expect(text).toContain("40%");
    expect(text).toContain("3 + 2 estimated");
    expect(text).not.toContain("redeploy");
  });

  it("lists only what needs action, each scrolling to its section", async () => {
    const scroll = vi.fn();
    const target = document.createElement("div");
    target.id = "waiting-too-long";
    target.scrollIntoView = scroll;
    document.body.appendChild(target);
    render(
      <AttentionStrip
        items={[
          { key: "a", label: "critical waits", count: 3, href: "#waiting-too-long" },
          { key: "b", label: "overdue requests", count: 0, href: "#client-requests" },
        ]}
      />
    );
    expect(screen.getByText("Needs action")).toBeDefined();
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
    render(<AttentionStrip items={[{ key: "a", label: "overdue requests", count: 7, href: "#operations", onSelect: () => calls.push("select") }]} />);
    fireEvent.click(screen.getByRole("link", { name: /7\s*overdue requests/ }));
    await waitFor(() => expect(calls).toEqual(["select", "scroll"]));
    target.remove();
  });

  it("says nothing needs action when every count is zero", () => {
    render(<AttentionStrip items={[{ key: "a", label: "critical waits", count: 0, href: "#x" }]} />);
    expect(screen.getByText("Nothing needs action right now.")).toBeDefined();
    expect(screen.getByText("Needs action")).toBeDefined();
    expect(screen.queryByText(/critical waits/)).toBeNull();
  });

  it("makes a KPI tile a link to the records behind it, a jump to a section, or plain", () => {
    const { rerender } = render(<AnalyticsKpi label="Active applicants" value={5} href="/ta/applications" />);
    expect(screen.getByRole("link", { name: /Active applicants/ }).getAttribute("href")).toBe("/ta/applications");
    rerender(<AnalyticsKpi label="Overdue candidates" value={5} href="#waiting-too-long" />);
    expect(screen.getByRole("link", { name: /Overdue candidates/ }).getAttribute("href")).toBe("#waiting-too-long");
    rerender(<AnalyticsKpi label="Seats filled" value={5} onClick={() => {}} />);
    expect(screen.getByRole("button", { name: /Seats filled/ })).toBeDefined();
    rerender(<AnalyticsKpi label="Days to fill" value={5} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("pages and searches a long recruiter list, and keeps a selected recruiter visible", () => {
    const rows = Array.from({ length: 23 }, (_, i) => teamRow(`ta-${i}`, `Recruiter ${String(i).padStart(2, "0")}`, { active: i + 1 }));
    const { rerender } = render(<TeamTable rows={rows} onSelectRecruiter={vi.fn()} pageSize={10} />);
    expect(screen.getAllByRole("button", { name: /^Recruiter \d\d\./ })).toHaveLength(10);
    expect(screen.getByText("1 to 10 of 23 recruiters")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("11 to 20 of 23 recruiters")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getAllByRole("button", { name: /^Recruiter \d\d\./ })).toHaveLength(3);
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);

    // Searching returns to page 1 and narrows the list
    fireEvent.change(screen.getByPlaceholderText("Recruiter name"), { target: { value: "Recruiter 07" } });
    expect(screen.getAllByRole("button", { name: /^Recruiter \d\d\./ })).toHaveLength(1);
    expect(screen.queryByRole("navigation", { name: "recruiters pages" })).toBeNull();

    // A selected recruiter stays listed even when the search does not match them
    rerender(<TeamTable rows={rows} selectedRecruiterId="ta-3" onSelectRecruiter={vi.fn()} pageSize={10} />);
    expect(screen.getByRole("button", { name: /^Recruiter 03\./ })).toBeDefined();
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
    expect(document.body.textContent).toContain("5/20 seats");
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("No target date")).toBeDefined();
  });

  it("filters client requests by status and search, and pages the rest", () => {
    const rows = [
      ...Array.from({ length: 11 }, (_, i) => requestRow(i + 1, { health: "ON_TRACK" })),
      requestRow(50, { title: "Urgent Welders", clientName: "Beta Fab", health: "OVERDUE", targetFillDate: "2026-10-01T00:00:00Z", daysRemaining: -12 }),
    ];
    render(<RequestProgressList rows={rows} linkTo="/admin/mrfs/$mrfId" pageSize={5} />);
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByText("1 to 5 of 12 requests")).toBeDefined();
    // Counts on the status buttons
    expect(screen.getByRole("button", { name: /^Overdue 1$/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /^On track 11$/ })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /^Overdue 1$/ }));
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("navigation", { name: "requests pages" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^All 12$/ }));
    fireEvent.change(screen.getByPlaceholderText("Request, client or recruiter"), { target: { value: "beta" } });
    expect(screen.getAllByRole("link")).toHaveLength(1);

    fireEvent.change(screen.getByPlaceholderText("Request, client or recruiter"), { target: { value: "nothing like this" } });
    expect(screen.getByText(/No match\. Change the status or search/)).toBeDefined();
  });

  const linePoints = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ label: `Oct ${13 + i}`, values: { starts: i === 0 ? 3 : i === 1 ? 3 : 0, backouts: i === n - 1 ? 4 : 0 } }));
  const lineSeries = [{ key: "starts", label: "Starts" }, { key: "backouts", label: "Backouts" }];

  it("draws two lines, names each at its end, and gives a hidden summary", () => {
    const { container } = render(<LineChart title="Results over time" points={linePoints(4)} series={lineSeries} />);
    expect(container.querySelectorAll("svg path")).toHaveLength(2);
    expect(container.querySelectorAll("svg circle").length).toBe(8);
    expect(screen.queryByText("Starts 0")).toBeNull();
    expect(screen.queryByText("Backouts 4")).toBeNull();
    expect(screen.getByRole("list", { name: "Legend" }).textContent).toContain("Backouts");
    const summary = container.querySelector("p.sr-only")?.textContent ?? "";
    expect(summary).toContain("Starts: 6 in total, highest 3 on Oct 13.");
    expect(summary).toContain("Backouts: 4 in total.");
    expect(screen.getByText("View as table")).toBeDefined();
  });

  it("has a fixed height, real-size text and a caption instead of an (i)", () => {
    const { container } = render(<LineChart title="Results over time" subtitle="Daily." points={linePoints(4)} series={lineSeries} />);
    const svg = container.querySelector("svg") as SVGSVGElement;
    expect(svg.getAttribute("height")).toBe("240");
    expect(svg.getAttribute("viewBox")).toBe(`0 0 ${svg.getAttribute("width")} 240`);
    expect(svg.getAttribute("preserveAspectRatio")).toBeNull();
    expect(svg.querySelector("text")?.getAttribute("font-size")).toBe("11");
    expect(screen.getByText("Daily.")).toBeDefined();
    expect(screen.queryByRole("button", { name: /Results over time/ })).toBeNull();
  });

  it("draws no markers with fewer than three points", () => {
    const { container } = render(<LineChart title="Results over time" points={linePoints(2)} series={lineSeries} />);
    expect(container.querySelectorAll("svg path")).toHaveLength(2);
    expect(container.querySelectorAll("svg circle")).toHaveLength(0);
  });

  it("keeps the axis to whole numbers when the maximum is 7", () => {
    const pts = [{ label: "A", values: { starts: 7, backouts: 1 } }, { label: "B", values: { starts: 2, backouts: 0 } }];
    const { container } = render(<LineChart title="Results over time" points={pts} series={lineSeries} />);
    const ticks = Array.from(container.querySelectorAll("svg text.tabular-nums")).map((n) => n.textContent ?? "");
    expect(ticks).toEqual(["0", "4", "8"]);
  });

  it("shows each line's total in the legend and the count over each non-zero point", () => {
    const pts = [{ label: "A", values: { starts: 7, backouts: 1 } }, { label: "B", values: { starts: 2, backouts: 0 } }];
    const { container } = render(<LineChart title="Results over time" points={pts} series={lineSeries} />);
    const legend = screen.getByRole("list", { name: "Legend" });
    expect(legend.textContent).toContain("9");
    expect(legend.textContent).toContain("1");
    const values = Array.from(container.querySelectorAll("svg text[data-point-value]")).map((n) => n.textContent);
    expect(values.sort()).toEqual(["1", "2", "7"]);
  });

  it("draws a marker per series for a single point", () => {
    const { container } = render(<LineChart title="Results over time" points={[{ label: "Oct 13", values: { starts: 2, backouts: 1 } }]} series={lineSeries} />);
    expect(container.querySelectorAll("svg circle")).toHaveLength(2);
  });

  it("shows an empty state instead of an empty chart", () => {
    const empty = linePoints(4).map((p) => ({ ...p, values: { starts: 0, backouts: 0 } }));
    const { container } = render(<LineChart title="Results over time" points={empty} series={lineSeries} emptyText="No starts or backouts in this period." />);
    expect(screen.getByText(/No starts or backouts in this period/)).toBeDefined();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("highlights requests with nothing moving and filters to the ones with no candidates", () => {
    const rows = [
      requestRow(1, { title: "No job yet", jobCount: 0, applicantCount: 0, attention: "NO_OPENING" }),
      requestRow(2, { title: "Nobody applied", applicantCount: 0, attention: "NO_APPLICANTS" }),
      requestRow(3, { title: "Stuck at first review", pipeline: 0, attention: "FIRST_STAGE_ONLY" }),
      requestRow(4, { title: "Healthy" }),
    ];
    render(<RequestProgressList rows={rows} linkTo="/admin/mrfs/$mrfId" />);
    expect(screen.getByText("No job opening")).toBeDefined();
    expect(screen.getByText("No applicants")).toBeDefined();
    expect(screen.getByText("None past first screening")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /^No candidates 2$/ }));
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.queryByText("Healthy")).toBeNull();
    expect(screen.queryByText("Stuck at first review")).toBeNull();
  });

  it("guards a request with a headcount of zero instead of showing NaN", () => {
    render(<RequestProgressList rows={[requestRow(1, { headcount: 0, filled: 0, openSeats: 0 })]} linkTo="/ta/mrfs/$mrfId" showOwner={false} />);
    expect(document.body.textContent).toContain("0/0 seats");
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
    expect(screen.getByRole("img", { name: /Requirements, days in stage, limit 14 days: Within days allowed 14, Past days allowed 16/ })).toBeDefined();
    expect(screen.getAllByText(/of 14 days/)).toBeDefined();
    expect(screen.getByText(/· Ben/)).toBeDefined();
    expect(screen.getByText(/estimated from application date/)).toBeDefined();
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
      { stage: "APPLIED", label: "New applications", inStageNow: 2, overdue: 0, overdueEstimated: 0, entered: 1, backedOut: 0, avgDaysInStage: 1, medianDaysInStage: 1, typicalWaitSample: 5, slaDays: 7 },
      { stage: "COMPLIANCE", label: "Requirements", inStageNow: 4, overdue: 1, overdueEstimated: 0, entered: 2, backedOut: 0, avgDaysInStage: 5, medianDaysInStage: 5, typicalWaitSample: 5, slaDays: 14 },
    ];
    render(<StagePipeline rows={rows} linkStages />);
    expect(screen.getByRole("link", { name: /Requirements/ }).getAttribute("href")).toContain("/ta/applications");
    expect(screen.queryByRole("link", { name: /New applications/ })).toBeNull();
  });

  it("filters the waiting list by urgency and stage", () => {
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
  });

  it("explains a capped waiting list and the candidates on closed openings", () => {
    render(<StuckList rows={[stuck(1)]} total={340} closedOpenings={3} />);
    expect(screen.getByText(/Top 1 of 340/)).toBeDefined();
    expect(screen.getByText(/3 more are on closed job openings/)).toBeDefined();
    cleanup();
    render(<StuckList rows={[]} total={0} />);
    expect(screen.getByText(/No one is past the days allowed/)).toBeDefined();
  });

  it("AnimatedNumber exposes the final value to screen readers and hides the animated frames", () => {
    const { container } = render(<AnimatedNumber value={42} />);
    const sr = container.querySelector(".sr-only") as HTMLElement;
    expect(sr.textContent).toBe("42");
    expect((container.querySelector('[aria-hidden="true"]') as HTMLElement)).not.toBeNull();
    expect(container.textContent).toContain("42");
  });

  it("shows a KPI value without a Now or In period tag", () => {
    const { container } = render(<AnalyticsKpi label="Active applicants" value={7} />);
    expect(screen.queryByText("Now")).toBeNull();
    expect(screen.queryByText("In period")).toBeNull();
    expect(container.textContent).toContain("7");
  });

  it("calls onSelectStage from a stage row button and shows the TA link rows", () => {
    const rows: StageTableRow[] = [
      { stage: "COMPLIANCE", label: "Requirements", inStageNow: 4, overdue: 1, overdueEstimated: 0, entered: 2, backedOut: 0, avgDaysInStage: 5, medianDaysInStage: 5, typicalWaitSample: 5, slaDays: 14 },
      { stage: "FINAL_INTERVIEW", label: "Final interview", inStageNow: 2, overdue: 0, overdueEstimated: 0, entered: 2, backedOut: 0, avgDaysInStage: 5, medianDaysInStage: 5, typicalWaitSample: 5, slaDays: 5 },
    ];
    const onSelect = vi.fn();
    const { unmount } = render(<StagePipeline rows={rows} onSelectStage={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Requirements, 4 · 1 overdue. Show these candidates" }));
    expect(onSelect).toHaveBeenCalledWith("COMPLIANCE");
    // A stage with nothing overdue is not a button
    expect(screen.getByRole("group", { name: "Final interview, 2" })).toBeDefined();
    unmount();
    render(<StagePipeline rows={rows} linkStages />);
    expect(screen.getByRole("link", { name: "Final interview, 2. Show these candidates" })).toBeDefined();
    expect(within(screen.getByRole("link", { name: /Requirements/ })).getByRole("img", { name: /within limit 3, overdue 1/ })).toBeDefined();
  });
});
