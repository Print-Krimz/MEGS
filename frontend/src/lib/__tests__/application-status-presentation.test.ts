import { describe, expect, it } from "vitest";
import { ApplicationStatus } from "../types/enums";
import { getApplicationStatusPresentation, formatNotificationMessage } from "../utils";

describe("application status presentation", () => {
  it("hides resume-processing implementation details from applicants", () => {
    const presentation = getApplicationStatusPresentation(
      ApplicationStatus.PARSING,
      "applicant"
    );

    expect(presentation.label).toBe("Application received");
    expect(presentation.label).not.toMatch(/parsing|resume/i);
  });

  it("uses a plain term with the familiar 201 acronym for applicant paperwork", () => {
    const presentation = getApplicationStatusPresentation(
      ApplicationStatus.COMPLIANCE,
      "applicant"
    );

    expect(presentation.label).toBe("Employment documents (201)");
  });

  it("keeps the staff-facing processing state understandable without an internal code", () => {
    const presentation = getApplicationStatusPresentation(
      ApplicationStatus.PARSING,
      "staff"
    );

    expect(presentation.label).toBe("Resume review in progress");
  });

  it("presents TALENT_POOL as 'Future Opportunities' for applicants without internal HR jargon", () => {
    const presentation = getApplicationStatusPresentation(
      ApplicationStatus.TALENT_POOL,
      "applicant"
    );

    expect(presentation.label).toBe("Future Opportunities");
    expect(presentation.label).not.toMatch(/talent\s*pool/i);
  });

  it("presents TALENT_POOL as 'Talent Pool' for internal TA and Admin staff", () => {
    const presentation = getApplicationStatusPresentation(
      ApplicationStatus.TALENT_POOL,
      "staff"
    );

    expect(presentation.label).toBe("Talent Pool");
  });

  it("formats legacy 'moved to TALENT POOL' notifications to candidate-friendly future opportunities message", () => {
    const legacyMsg = "Your application has been moved to TALENT POOL.";
    const formatted = formatNotificationMessage(legacyMsg, "APPLICANT");

    expect(formatted).toBe(
      "You were not selected for this position, but your profile may be considered for future job opportunities that match your qualifications."
    );
    expect(formatted).not.toContain("TALENT POOL");
  });

  it("formats legacy 'moved to REVIEW' notifications to candidate-friendly text", () => {
    const legacyMsg = "Your application has been moved to REVIEW.";
    const formatted = formatNotificationMessage(legacyMsg, "APPLICANT");

    expect(formatted).toBe("Your application is currently under review.");
  });
});


