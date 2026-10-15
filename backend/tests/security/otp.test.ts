import { afterEach, describe, expect, it } from "vitest";
import { hashOtp, verifyOtpHash } from "../../src/utils/otp.js";

describe("OTP secret requirements", () => {
  afterEach(() => delete process.env.OTP_SECRET);

  it("fails closed without a dedicated secret", () => {
    expect(() => hashOtp("123456")).toThrow("OTP_SECRET");
  });

  it("hashes and verifies OTPs with an explicit secret", () => {
    process.env.OTP_SECRET = "otp-secret-that-is-at-least-32-characters";
    const hash = hashOtp("123456");
    expect(verifyOtpHash("123456", hash)).toBe(true);
    expect(verifyOtpHash("654321", hash)).toBe(false);
  });
});
