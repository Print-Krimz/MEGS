import { describe, it, expect } from "vitest";
import { maskEmail } from "../utils/mask.js";

describe("Backend Email Masking Utility (maskEmail)", () => {
  it("masks long email local parts preserving first 2 chars and domain", () => {
    expect(maskEmail("juan.delacruz@gmail.com")).toBe("ju***********@gmail.com");
  });

  it("handles short and medium emails", () => {
    expect(maskEmail("ab@gmail.com")).toBe("a*@gmail.com");
    expect(maskEmail("john@gmail.com")).toBe("j**n@gmail.com");
  });

  it("handles empty or invalid inputs", () => {
    expect(maskEmail("")).toBe("");
    expect(maskEmail(null as any)).toBe("");
  });
});