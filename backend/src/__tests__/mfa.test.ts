import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyRecoveryCodeFormat,
} from '../services/core/mfa.service.js';

describe('MFA Recovery Code Engine', () => {
  it('generates 8 formatted recovery codes with hashes', () => {
    const { plainCodes, hashedCodes } = generateRecoveryCodes();
    expect(plainCodes).toHaveLength(8);
    expect(hashedCodes).toHaveLength(8);

    plainCodes.forEach((code) => {
      expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(verifyRecoveryCodeFormat(code)).toBe(true);
    });

    hashedCodes.forEach((hash) => {
      expect(hash).toHaveLength(64);
    });
  });

  it("correctly hashes recovery codes case-insensitively without dashes", () => {
    const code = "A1B2-C3D4";
    const hash1 = hashRecoveryCode(code);
    const hash2 = hashRecoveryCode("a1b2c3d4");
    const hash3 = hashRecoveryCode("A1B2 C3D4");
    expect(hash1).toBe(hash2);
    expect(hash1).toBe(hash3);
  });

  it("validates recovery code format correctly", () => {
    expect(verifyRecoveryCodeFormat("ABCD-1234")).toBe(true);
    expect(verifyRecoveryCodeFormat("abcd1234")).toBe(true);
    expect(verifyRecoveryCodeFormat("ABCD1234")).toBe(true);
    expect(verifyRecoveryCodeFormat("ABCD-123")).toBe(false);
    expect(verifyRecoveryCodeFormat("ABCD-12345")).toBe(false);
    expect(verifyRecoveryCodeFormat("")).toBe(false);
    expect(verifyRecoveryCodeFormat("INVALID!#")).toBe(false);
  });

  it("throws an error when verifying an invalid format recovery code", async () => {
    const { verifyRecoveryCode } = await import("../services/core/mfa.service.js");
    await expect(verifyRecoveryCode("user-123", "invalid")).rejects.toThrow("Invalid recovery code format");
  });

  it("handles recovery code lookup failure", async () => {
    const { verifyRecoveryCode } = await import("../services/core/mfa.service.js");
    await expect(verifyRecoveryCode("user-nonexistent", "A1B2-C3D4")).rejects.toThrow(
      "Invalid or already used recovery code"
    );
  });
});




