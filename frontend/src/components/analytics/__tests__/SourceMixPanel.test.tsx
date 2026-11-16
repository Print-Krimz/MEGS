import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourceMixPanel } from "../SourceMixPanel";

describe("SourceMixPanel", () => {
  it("lists each source with received, hired and the hire rate", () => {
    render(<SourceMixPanel rows={[{ source: "LINKEDIN", received: 4, hired: 1 }, { source: "WALK_IN", received: 2, hired: 0 }]} />);
    const linkedin = screen.getByRole("row", { name: /LinkedIn/ });
    expect(linkedin).toHaveTextContent("4");
    expect(linkedin).toHaveTextContent("25%");
    expect(screen.getByRole("row", { name: /Walk-in/ })).toHaveTextContent("0%");
  });

  it("says so when there are no applications", () => {
    render(<SourceMixPanel rows={[]} />);
    expect(screen.getByText("No applications in these dates.")).toBeInTheDocument();
  });
});
