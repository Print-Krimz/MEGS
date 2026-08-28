import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApplicationStatus } from "../../../lib/types/enums";
import { PipelineIndicator } from "../PipelineIndicator";

describe("PipelineIndicator", () => {
  it("uses consistent, plain-language applicant stages", () => {
    render(<PipelineIndicator currentStatus={ApplicationStatus.COMPLIANCE} audience="applicant" />);

    expect(screen.getAllByText("Final interview").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Employment documents (201)").length).toBeGreaterThan(0);
    expect(screen.queryByText("Client Evaluation")).toBeNull();
    expect(screen.queryByText("Hired")).toBeNull();
  });
});
