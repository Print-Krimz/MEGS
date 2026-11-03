// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

import { AnalyticsKpi } from "../AnalyticsKpi";

const GOOD = "text-[#1B6B3A]";
const LOSS = "text-[#B42318]";

/**
 * The change line is the element holding the spoken sentence. Its text is the visible change ("+3 vs previous 7 days")
 * followed by the sentence read aloud, so the visible part is checked by containment.
 */
const changeLine = (spoken: string) => screen.getByText(spoken).parentElement as HTMLElement;

describe("AnalyticsKpi change line", () => {
  it("shows a rise in green when up is good, with a sign and the earlier period", () => {
    render(
      <AnalyticsKpi
        label="Starts"
        value={14}
        delta={{ current: 14, previous: 11, better: "up", periodLabel: "previous 7 days" }}
      />
    );
    const line = changeLine("Up 3 from 11 in the previous 7 days");
    expect(line.textContent).toContain("+3 vs previous 7 days");
    expect(line.className).toContain(GOOD);
  });

  it("shows a fall in green when down is good, using days", () => {
    render(
      <AnalyticsKpi
        label="Days to fill"
        value="9.5 days"
        delta={{ current: 9.5, previous: 11, unit: "days", better: "down", periodLabel: "previous 7 days" }}
      />
    );
    const line = changeLine("Down 1.5 days from 11 days in the previous 7 days");
    expect(line.textContent).toContain("-1.5 days vs previous 7 days");
    expect(line.className).toContain(GOOD);
  });

  it("shows a rise in red when up is bad", () => {
    render(
      <AnalyticsKpi
        label="Days to fill"
        value={12}
        delta={{ current: 12, previous: 11, unit: "days", better: "down", periodLabel: "previous 7 days" }}
      />
    );
    const line = changeLine("Up 1 day from 11 days in the previous 7 days");
    expect(line.textContent).toContain("+1 day vs previous 7 days");
    expect(line.className).toContain(LOSS);
  });

  it("reads percent changes as points", () => {
    render(
      <AnalyticsKpi
        label="Backout rate"
        value="62.5%"
        delta={{ current: 62.5, previous: 58, unit: "%", better: "down", periodLabel: "previous 30 days" }}
      />
    );
    const line = changeLine("Up 4.5 percentage points from 58% in the previous 30 days");
    expect(line.textContent).toContain("+4.5 pts vs previous 30 days");
    expect(line.className).toContain(LOSS);
  });

  it("says no change in neutral text, with no sign", () => {
    render(
      <AnalyticsKpi
        label="Starts"
        value={5}
        delta={{ current: 5, previous: 5, better: "up", periodLabel: "previous 7 days" }}
      />
    );
    const line = changeLine("No change from 5 in the previous 7 days");
    expect(line.textContent).toContain("No change vs previous 7 days");
    expect(line.className).toContain("text-slate-600");
    expect(line.className).not.toContain(GOOD);
    expect(line.className).not.toContain(LOSS);
  });

  it("hides the change line when either value is missing", () => {
    const { rerender } = render(
      <AnalyticsKpi label="Starts" value={5} delta={{ current: 5, previous: null, better: "up", periodLabel: "previous 7 days" }} />
    );
    expect(screen.queryByText(/vs previous 7 days/)).toBeNull();
    rerender(<AnalyticsKpi label="Starts" value={5} delta={{ current: null, previous: 4, better: "up", periodLabel: "previous 7 days" }} />);
    expect(screen.queryByText(/vs previous 7 days/)).toBeNull();
  });

  it("renders without a delta as before", () => {
    render(<AnalyticsKpi label="Starts" value={5} detail="2 new" />);
    expect(screen.queryByText(/vs /)).toBeNull();
    expect(screen.getByText("2 new")).toBeDefined();
  });
});
