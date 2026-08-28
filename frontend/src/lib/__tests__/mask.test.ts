import { describe, it, expect } from "vitest";
import { maskEmail } from "../utils";

describe("Email Masking Utility (maskEmail)", () => {
  it("masks long email local parts preserving first 2 chars and domain", () => {
    expect(maskEmail("juan.delacruz@gmail.com")).toBe("ju***********@gmail.com");
    expect(maskEmail("fohol97207@bocably.com")).toBe("fo********@bocably.com");
  });

  it("handles short emails with length <= 2 safely", () => {
    expect(maskEmail("ab@gmail.com")).toBe("a*@gmail.com");
    expect(maskEmail("a@gmail.com")).toBe("*@gmail.com");
  });

  it("handles medium emails with length 3-4 safely", () => {
    expect(maskEmail("bob@gmail.com")).toBe("b*b@gmail.com");
    expect(maskEmail("john@gmail.com")).toBe("j**n@gmail.com");
  });

  it("safely handles null, undefined, empty, and invalid emails without crashing", () => {
    expect(maskEmail("")).toBe("");
    expect(maskEmail(null as any)).toBe("");
    expect(maskEmail(undefined as any)).toBe("");
    expect(maskEmail("invalid-email")).toBe("invalid-email");
  });

  it("trims whitespace before masking", () => {
    expect(maskEmail("  applicant@megs.com  ")).toBe("ap*******@megs.com");
  });
});