import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../StatusBadge";

describe("StatusBadge", () => {
  it("renders with rounded-md geometry instead of rounded-full", () => {
    const { container } = render(<StatusBadge status="SUBMITTED" type="application" />);
    const badge = container.querySelector("span");

    expect(badge).toBeDefined();
    expect(badge?.className).toContain("rounded-md");
    expect(badge?.className).not.toContain("rounded-full");
  });

  it("renders correct semantic label for application status with staff audience", () => {
    render(<StatusBadge status="TALENT_POOL" type="application" audience="staff" />);
    expect(screen.getByText("Talent Pool")).toBeDefined();
  });

  it("renders candidate-friendly label for application status with applicant audience", () => {
    render(<StatusBadge status="TALENT_POOL" type="application" audience="applicant" />);
    expect(screen.getByText("Future Opportunities")).toBeDefined();
    expect(screen.queryByText("Talent Pool")).toBeNull();
  });

  it("renders correct semantic label for deployment status", () => {
    render(<StatusBadge status="ACTIVE" type="deployment" />);
    expect(screen.getByText("Active on Site")).toBeDefined();
  });

  it("renders correct semantic label for employment status", () => {
    render(<StatusBadge status="ACTIVE" type="employment" />);
    expect(screen.getByText("Active Employee")).toBeDefined();
  });

  it("applies sm and md size classes properly while maintaining rounded-md", () => {
    const { container: smContainer } = render(
      <StatusBadge status="SUBMITTED" size="sm" />
    );
    expect(smContainer.querySelector("span")?.className).toContain("text-xs");
    expect(smContainer.querySelector("span")?.className).toContain("rounded-md");

    const { container: mdContainer } = render(
      <StatusBadge status="SUBMITTED" size="md" />
    );
    expect(mdContainer.querySelector("span")?.className).toContain("px-2.5");
    expect(mdContainer.querySelector("span")?.className).toContain("rounded-md");
  });

  it("handles null or undefined status gracefully with fallback label and rounded-md", () => {
    const { container } = render(<StatusBadge status={null} />);
    const badge = container.querySelector("span");
    expect(screen.getByText("Unknown")).toBeDefined();
    expect(badge?.className).toContain("rounded-md");
  });
});
