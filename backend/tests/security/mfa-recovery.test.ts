import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  findUnique: vi.fn(),
  verifyRecoveryCode: vi.fn(),
  resetMfaAfterRecovery: vi.fn(),
}));

vi.mock("../../src/utils/supabase.js", () => ({
  default: { auth: { getUser: mocks.getUser } },
}));
vi.mock("../../src/utils/prisma.js", () => ({
  default: { user: { findUnique: mocks.findUnique } },
}));
vi.mock("../../src/services/core/mfa.service.js", () => ({
  enrollMfa: vi.fn(),
  verifyMfaEnrollment: vi.fn(),
  verifyMfaLogin: vi.fn(),
  verifyRecoveryCode: mocks.verifyRecoveryCode,
  resetMfaAfterRecovery: mocks.resetMfaAfterRecovery,
  getUserMfaFactors: vi.fn(),
  resetUserMfa: vi.fn(),
}));

import { verifyMfaRecoveryHandler } from "../../src/controllers/core/mfa.controller.js";

describe("MFA recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "staff-1" } }, error: null });
    mocks.verifyRecoveryCode.mockResolvedValue({ valid: true, remainingCodes: 7 });
    mocks.resetMfaAfterRecovery.mockResolvedValue(undefined);
    mocks.findUnique.mockResolvedValue({
      id: "staff-1",
      email: "staff@example.com",
      role: "ADMINISTRATOR",
      accountStatus: "ACTIVE",
      mustChangePassword: false,
    });
  });

  it("requires MFA re-enrollment instead of returning an AAL1 access token", async () => {
    const state: { status: number; body?: any } = { status: 200 };
    const res = {
      status(code: number) {
        state.status = code;
        return this;
      },
      json(body: unknown) {
        state.body = body;
        return this;
      },
    } as any;

    await verifyMfaRecoveryHandler(
      { body: { token: "aal1-token", recoveryCode: "ABCD-EFGH" }, headers: {} } as any,
      res
    );

    expect(mocks.resetMfaAfterRecovery).toHaveBeenCalledWith("staff-1");
    expect(state.body.data).toMatchObject({
      mfaSetupRequired: true,
      tempToken: "aal1-token",
    });
    expect(state.body.data).not.toHaveProperty("access_token");
  });
});
