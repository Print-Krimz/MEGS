import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BarMark, ChartLegend, DataTableToggle, DonutChart, StackedBar } from "../chart-primitives";
import { CHART_SURFACE, OUTCOME, REASON_COLORS, contrastRatio } from "../../../lib/chart-palette";

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

describe("DonutChart", () => {
  const slices = [
    { key: "pay", label: "Pay", value: 3, color: REASON_COLORS[0] },
    { key: "location", label: "Location", value: 1, color: REASON_COLORS[1] },
    { key: "other", label: "Other", value: 0, color: REASON_COLORS[4] },
  ];

  it("names the ring with its non-empty slices", () => {
    render(<DonutChart label="Why candidates backed out" slices={slices} centerValue="4" centerLabel="backouts" />);
    expect(screen.getByRole("img", { name: "Why candidates backed out: Pay 3, Location 1" })).toBeDefined();
    expect(screen.getByText("backouts")).toBeDefined();
  });

  it("lists each slice in the legend with its count and share", () => {
    render(<DonutChart label="Why candidates backed out" slices={slices} />);
    const legend = screen.getByRole("list", { name: "Why candidates backed out legend" });
    const pay = within(legend).getByRole("button", { name: /Pay/ });
    expect(within(pay).getByText("3")).toBeDefined();
    expect(within(pay).getByText("75%")).toBeDefined();
    expect(within(legend).getByRole("button", { name: /Location/ }).textContent).toContain("25%");
  });

  it("highlights a slice on focus and dims the others", () => {
    const { container } = render(<DonutChart label="Why candidates backed out" slices={slices} />);
    const legend = screen.getByRole("list", { name: "Why candidates backed out legend" });
    const pay = within(legend).getByRole("button", { name: /Pay/ });
    const arcs = container.querySelectorAll("svg circle");
    expect(arcs).toHaveLength(2);
    fireEvent.focus(pay);
    expect(screen.getByText("Pay: 3 (75%)")).toBeDefined();
    expect((arcs[0] as SVGElement).style.opacity).toBe("1");
    expect((arcs[1] as SVGElement).style.opacity).toBe("0.35");
    fireEvent.blur(pay);
    expect(screen.queryByText("Pay: 3 (75%)")).toBeNull();
    expect((arcs[1] as SVGElement).style.opacity).toBe("1");
  });

  it("says nothing was recorded when every value is zero", () => {
    render(<DonutChart label="Why candidates backed out" slices={[{ key: "a", label: "Pay", value: 0, color: REASON_COLORS[0] }]} />);
    expect(screen.getByRole("img", { name: "Why candidates backed out: nothing recorded" })).toBeDefined();
    expect(screen.getByText("Nothing recorded in these dates.")).toBeDefined();
    expect(screen.queryByText("View as table")).toBeNull();
  });

  it("offers the same numbers as a table", () => {
    render(<DonutChart label="Why candidates backed out" slices={slices} />);
    expect(screen.getByText("View as table")).toBeDefined();
    expect(screen.getByRole("table", { name: "Why candidates backed out", hidden: true })).toBeDefined();
    expect(screen.getByRole("rowheader", { name: "Pay", hidden: true })).toBeDefined();
  });
});

describe("reason and change colours", () => {
  it("keeps reason marks distinct, at 3:1 or better, and never red", () => {
    expect(new Set(REASON_COLORS).size).toBe(REASON_COLORS.length);
    for (const color of REASON_COLORS) expect(contrastRatio(color, CHART_SURFACE)).toBeGreaterThanOrEqual(3);
    expect(REASON_COLORS).not.toContain(OUTCOME.backedOut);
  });

  it("keeps good-change text at 4.5:1 or better on white and on the hover tint", () => {
    expect(contrastRatio("#1B6B3A", "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#1B6B3A", "#F8FAFC")).toBeGreaterThanOrEqual(4.5);
  });
});
