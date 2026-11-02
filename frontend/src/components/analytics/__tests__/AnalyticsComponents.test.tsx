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

import { AnalyticsFilterBar, ExportMenu } from "../index";
import type { AnalyticsFilterOptions } from "../../../lib/types/analytics.types";

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

  it("applies a combobox choice at once", () => {
    const handleChange = vi.fn();
    render(<AnalyticsFilterBar filters={{ range: "7d" }} onChange={handleChange} options={mockOptions} showClientFilter />);
    fireEvent.click(screen.getByRole("button", { name: "More filters" }));
    fireEvent.click(screen.getByRole("combobox", { name: /^Client$/ }));
    fireEvent.click(screen.getByRole("option", { name: /Acme Corp/ }));
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ range: "7d", clientId: 1 }));
    expect(screen.queryByRole("button", { name: /Apply filters/i })).toBeNull();
  });

  it("offers one Clear filters control, calls the request Client request, and shows dates formatted", () => {
    render(
      <AnalyticsFilterBar
        filters={{ range: "custom", startDate: "2026-10-01", endDate: "2026-10-31", mrfId: 10 }}
        onChange={vi.fn()}
        options={mockOptions}
      />
    );
    expect(screen.getAllByRole("button", { name: /Clear (filters|all)/i })).toHaveLength(1);
    expect(screen.getByTestId("active-filter-chip-range").textContent).toContain("Oct 1, 2026 to Oct 31, 2026");
    expect(screen.getByTestId("active-filter-chip-mrfId").textContent).toContain("Client request:");
    fireEvent.click(screen.getByRole("button", { name: "More filters" }));
    expect(screen.getByText("Client request")).toBeDefined();
    expect(screen.queryByText("Hiring request")).toBeNull();
  });

  it("announces the filters in words after a change, not on first render", () => {
    const { container, rerender } = render(<AnalyticsFilterBar filters={{ range: "7d" }} onChange={vi.fn()} options={mockOptions} showClientFilter />);
    const live = () => container.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(live().textContent).toBe("");
    rerender(<AnalyticsFilterBar filters={{ range: "30d", clientId: 1 }} onChange={vi.fn()} options={mockOptions} showClientFilter />);
    expect(live().textContent).toBe("Showing results for Last 30 days, Client: Acme Corp");
  });

  it("opens the export menu as a plain disclosure with its helper text and exact items", () => {
    render(<ExportMenu fileNamePrefix="MEGS" onExport={vi.fn()} />);
    const toggle = screen.getByRole("button", { name: "Export" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryByRole("menuitem")).toBeNull();
    expect(screen.getByText("Uses the dates and filters above.")).toBeDefined();
    for (const name of ["Candidates by stage (PDF)", "Candidates by stage (Excel)", "Starts and backouts (PDF)", "Starts and backouts (Excel)"]) {
      expect(screen.getByRole("button", { name })).toBeDefined();
    }
  });

  it("closes the export menu on Escape, returning focus to its button, and on an outside click", () => {
    render(<ExportMenu fileNamePrefix="MEGS" onExport={vi.fn()} />);
    const toggle = screen.getByRole("button", { name: "Export" });
    fireEvent.click(toggle);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
    expect(screen.queryByText("Uses the dates and filters above.")).toBeNull();

    fireEvent.click(toggle);
    fireEvent.mouseDown(document.body);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("disables the export button while a report is being prepared", async () => {
    let finish: (blob: Blob) => void = () => {};
    const onExport = vi.fn(() => new Promise<Blob>((resolve) => { finish = resolve; }));
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    render(<ExportMenu fileNamePrefix="MEGS" onExport={onExport} />);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.click(screen.getByRole("button", { name: "Starts and backouts (Excel)" }));
    expect(onExport).toHaveBeenCalledWith("deployments", "xlsx");
    const busy = screen.getByRole("button", { name: "Preparing" }) as HTMLButtonElement;
    expect(busy.getAttribute("aria-disabled")).toBe("true");
    expect(busy.disabled).toBe(false);
    expect(screen.getByRole("status").textContent).toBe("Preparing the report");
    fireEvent.click(busy);
    expect(busy.getAttribute("aria-expanded")).toBe("false");
    finish(new Blob(["x"]));
    await waitFor(() => expect(screen.getByRole("button", { name: "Export" }).getAttribute("aria-disabled")).toBe("false"));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Export" })));
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("keeps the date range in one select on phones, with the same labels and URL state", () => {
    const handleChange = vi.fn();
    render(<AnalyticsFilterBar filters={{ range: "7d" }} onChange={handleChange} options={mockOptions} />);
    const select = screen.getByRole("combobox", { name: "Date range" }) as HTMLSelectElement;
    expect(select.value).toBe("7d");
    expect(select.className).toContain("min-h-11");
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(["Last 7 days", "Last 30 days", "Last 90 days", "Custom range"]);
    fireEvent.change(select, { target: { value: "90d" } });
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ range: "90d", startDate: undefined, endDate: undefined }));
    fireEvent.change(select, { target: { value: "custom" } });
    expect(screen.getByLabelText("From")).toBeDefined();
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it("gives the chip remove button a 24px target, larger on phones", () => {
    render(<AnalyticsFilterBar filters={{ range: "30d" }} onChange={vi.fn()} options={mockOptions} />);
    const remove = screen.getByRole("button", { name: "Remove Date filter" });
    expect(remove.className).toContain("min-h-6");
    expect(remove.className).toContain("min-w-6");
    expect(remove.className).toContain("max-md:min-h-11");
  });

  it("hides the extra filters again when asked", () => {
    render(<AnalyticsFilterBar filters={{ range: "30d", clientId: 1 }} onChange={vi.fn()} options={mockOptions} showClientFilter />);
    fireEvent.click(screen.getByRole("button", { name: "More filters" }));
    expect(screen.getByRole("button", { name: "Hide filters" }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Hide filters" }));
    expect(screen.getByRole("button", { name: "More filters" }).getAttribute("aria-expanded")).toBe("false");
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

});
