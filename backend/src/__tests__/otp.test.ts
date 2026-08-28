import { describe, it, expect } from "vitest";
import {
  generateNumericOtp,
  hashOtp,
  verifyOtpHash,
  generateSecureToken,
  hashToken,
} from "../utils/otp.js";

describe("OTP & Security Helpers", () => {
  it("generates a 6-digit numeric OTP string", () => {
    const otp = generateNumericOtp();
    expect(otp).toMatch(/^\d{6}$/);
    const num = parseInt(otp, 10);
    expect(num).toBeGreaterThanOrEqual(100000);
    expect(num).toBeLessThan(1000000);
  });

  it("hashes and verifies OTP accurately using timing-safe comparison", () => {
    const otp = "123456";
    const hash = hashOtp(otp);
    expect(hash).toBeDefined();
    expect(hash).not.toBe(otp);
    expect(verifyOtpHash(otp, hash)).toBe(true);
    expect(verifyOtpHash("654321", hash)).toBe(false);
  });

  it("generates and hashes cryptographically secure tokens", () => {
    const token = generateSecureToken();
    expect(token).toHaveLength(64);
    const hashed = hashToken(token);
    expect(hashed).toHaveLength(64);
    expect(hashed).toBe(hashToken(token));
  });
});
