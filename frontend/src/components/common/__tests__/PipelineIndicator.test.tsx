import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineIndicator } from "../PipelineIndicator";
import { ApplicationStatus } from "../../../lib/types/enums";
import { getPipelineStageIndex } from "../../../lib/pipeline-stages";

describe("PipelineIndicator Component", () => {
  it("renders canonical stages cleanly for active applications", () => {
    render(<PipelineIndicator currentStatus={ApplicationStatus.INITIAL_SCREENING} audience="applicant" />);
    expect(screen.getAllByText(/initial review/i).length).toBeGreaterThan(0);
  });

  it("renders all 7 canonical stage labels", () => {
    render(<PipelineIndicator currentStatus={ApplicationStatus.INITIAL_SCREENING} audience="applicant" />);
    const stageLabels = [
      "Submitted",
      "Initial Review",
      "Client Review",
      "Final Interview",
      "Requirements",
      "Contract & Orientation",
      "Deployed",
    ];

    stageLabels.forEach((label) => {
      expect(screen.getAllByText(new RegExp(label, "i")).length).toBeGreaterThan(0);
    });
  });

  it("places legacy ONBOARDING on stage 6, Contract & Orientation", () => {
    expect(getPipelineStageIndex(ApplicationStatus.ONBOARDING)).toBe(5);
  });

  it("suppresses redundant duplicate terminal alert when hideTerminalAlert is true", () => {
    render(
      <PipelineIndicator
        currentStatus={ApplicationStatus.TALENT_POOL}
        audience="applicant"
        hideTerminalAlert
      />
    );
    expect(screen.queryByText(/Current status:/i)).toBeNull();
  });

  it("displays terminal alert when hideTerminalAlert is false or default", () => {
    render(
      <PipelineIndicator
        currentStatus={ApplicationStatus.TALENT_POOL}
        audience="applicant"
      />
    );
    expect(screen.getByText(/Current status:/i)).toBeDefined();
  });
});
