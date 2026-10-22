import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceChip } from "../../components/ta/walk-in/SourceChip";

describe("SourceChip", () => {
  it('renders the "Walk-in" text for WALK_IN applications', () => {
    render(<SourceChip source="WALK_IN" />);
    expect(screen.getByText("Walk-in")).toBeInTheDocument();
  });

  it.each([
    ["ONLINE", "ONLINE"],
    ["undefined", undefined],
    ["null", null],
  ])("renders nothing when the source is %s", (_label, source) => {
    const { container } = render(<SourceChip source={source as "ONLINE" | undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
