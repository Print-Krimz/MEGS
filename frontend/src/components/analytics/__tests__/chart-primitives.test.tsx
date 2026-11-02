import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BarMark, ChartLegend, DataTableToggle, StackedBar } from "../chart-primitives";

describe("chart primitives", () => {
  it("names a bar with label, value and share", () => {
    render(<BarMark label="Client review" value={5} max={20} color="#27749B" />);
    const bar = screen.getByRole("img", { name: "Client review: 5 (25%)" });
    expect(bar.getAttribute("title")).toBe("Client review: 5 (25%)");
    expect(bar.getAttribute("tabindex")).toBeNull();
  });

  it("makes a bar focusable on request and takes a custom share", () => {
    render(<BarMark label="Skills" value={3} max={9} pct="first step" color="#27749B" focusable />);
    expect(screen.getByRole("img", { name: "Skills: 3 (first step)" }).getAttribute("tabindex")).toBe("0");
  });

  it("lists non-empty segments of a stacked bar", () => {
    render(
      <StackedBar
        label="Requirements"
        segments={[
          { key: "a", label: "Overdue", value: 2, color: "#C8102E" },
          { key: "b", label: "Waiting", value: 0, color: "#7B8494" },
        ]}
      />
    );
    expect(screen.getByRole("img", { name: "Requirements: Overdue 2" })).toBeDefined();
  });

  it("renders a legend and a table alternative", () => {
    render(
      <>
        <ChartLegend items={[{ key: "a", label: "Moved on", color: "#1A55C4", value: 4 }]} />
        <DataTableToggle caption="Stages" columns={["Stage", "Count"]} rows={[{ key: "x", cells: ["Submitted", 7] }]} />
      </>
    );
    expect(screen.getByLabelText("Legend").textContent).toContain("Moved on");
    expect(screen.getByText("View as table")).toBeDefined();
    expect(screen.getByRole("rowheader", { name: "Submitted", hidden: true })).toBeDefined();
  });
});
