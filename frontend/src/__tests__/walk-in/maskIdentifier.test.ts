import { describe, it, expect } from "vitest";
import { maskIdentifier } from "../../lib/utils";

describe("maskIdentifier", () => {
  it("returns an empty string for a walk-in placeholder address on @megs.internal", () => {
    const masked = maskIdentifier("walkin_3f2a9c1e@megs.internal");
    expect(masked).toBe("");
    expect(masked).not.toContain("walkin");
    expect(masked).not.toContain("megs.internal");
  });

  it("masks a phone-derived @applicant.megs.local placeholder without leaking the full number", () => {
    const masked = maskIdentifier("639171234567@applicant.megs.local");
    expect(masked).toBe("639****567");
    expect(masked).not.toContain("639171234567");
    expect(masked).not.toContain("applicant.megs.local");
  });

  it("still masks a real email address", () => {
    const masked = maskIdentifier("juan.delacruz@example.com");
    expect(masked).toContain("@example.com");
    expect(masked).not.toContain("juan.delacruz");
  });
});
