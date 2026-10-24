import { beforeEach, describe, expect, it, vi } from "vitest";

type U = { id: string; email: string; role: string; isActive: boolean; accountStatus: string; phoneNumber: string | null };
const db = vi.hoisted(() => ({ users: [] as any[], profile: {} as any }));
const mocks = vi.hoisted(() => ({ sms: vi.fn(), txUserUpdate: vi.fn(), profileUpdate: vi.fn() }));
const userApi = vi.hoisted(() => {
  const matches = (u: any, where: any): boolean => {
    if (where.id?.not && u.id === where.id.not) return false;
    if (typeof where.id === "string" && u.id !== where.id) return false;
    if (where.phoneNumber?.in && !where.phoneNumber.in.includes(u.phoneNumber)) return false;
    if (where.OR) return where.OR.some((c: any) => matches(u, { ...where, OR: undefined, ...c }));
    if (typeof where.email === "string" && u.email !== where.email) return false;
    return true;
  };
  const find = async ({ where }: any) => db.users.find((u: any) => matches(u, where)) ?? null;
  return { findFirst: find, findUnique: find };
});

vi.mock("../../src/utils/supabase.js", () => ({ default: { auth: { admin: {} } } }));
vi.mock("../../src/utils/prisma.js", () => ({ default: {
  user: userApi,
  applicantProfile: { findUnique: async () => db.profile, findFirst: async () => db.profile },
  authOtp: { findFirst: async () => null, updateMany: vi.fn(), create: vi.fn() },
  $transaction: async (fn: any) => fn({
    user: { update: mocks.txUserUpdate },
    applicantProfile: { update: async (a: any) => { mocks.profileUpdate(a); return { ...db.profile, ...a.data }; } },
  }),
} }));
vi.mock("../../src/utils/audit.js", () => ({ logAudit: vi.fn() }));
vi.mock("../../src/utils/env.js", () => ({}));
vi.mock("../../src/utils/mailer.js", () => ({
  sendMail: vi.fn(), sendRegistrationOtpEmail: vi.fn(), sendPasswordResetOtpEmail: vi.fn(),
  redactAuthenticationSecrets: (v: string) => v,
}));
vi.mock("../../src/services/core/mfa.service.js", () => ({ getUserMfaFactors: vi.fn(), createMfaChallenge: vi.fn() }));
vi.mock("../../src/services/applicant/applicant.service.js", () => ({ ensureApplicantProfile: vi.fn() }));
vi.mock("../../src/services/ta/candidate-profile-review.service.js", () => ({
  ProfileSectionError: class extends Error {}, applyEducations: vi.fn(), applyWorkExperiences: vi.fn(), replaceSkills: vi.fn(),
}));
vi.mock("../../src/services/ta/duplicate-identifiers.js", () => ({ findDuplicateIdentifierWarnings: async () => [] }));
vi.mock("../../src/services/scoring/scoring-configuration.service.js", () => ({ revalidateApplicantProfile: vi.fn() }));
vi.mock("../../src/utils/sms.js", async (orig) => ({ ...(await orig<any>()), sendSmsViaTextBee: mocks.sms }));

import { ClaimError, startAccountClaim } from "../../src/services/core/auth.service.js";
import { updateCandidateProfileHandler } from "../../src/controllers/ta/ta.applications.controller.js";

const walkIn = (phone: string): U => ({ id: "u1", email: "639170000001@applicant.megs.local", role: "APPLICANT", isActive: true, accountStatus: "WALK_IN", phoneNumber: phone });

const patch = async (body: any) => {
  const res: any = { statusCode: 200, body: null, status(c: number) { this.statusCode = c; return this; }, json(b: any) { this.body = b; return this; } };
  await updateCandidateProfileHandler({ params: { id: "7" }, body, user: { id: "ta1" } } as any, res);
  return res;
};

describe("walk-in phone number stays in sync for account claiming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("OTP_SECRET", "synthetic-dedicated-otp-key-for-tests-only");
    db.users = [walkIn("+639170000001")];
    db.profile = { id: 7, userId: "u1", firstName: "A", lastName: "B", mobileNumber: "09170000001", province: null, city: null, barangay: null, postalCode: null, address: null };
    mocks.sms.mockResolvedValue({ success: true });
  });

  it("TA edit moves the walk-in account to the new number in E.164", async () => {
    const res = await patch({ mobileNumber: "0921 663 3614" });
    expect(res.statusCode).toBe(200);
    expect(mocks.txUserUpdate).toHaveBeenCalledWith({ where: { id: "u1" }, data: { phoneNumber: "+639216633614" } });
    expect(mocks.profileUpdate.mock.calls[0][0].data.mobileNumber).toBe("09216633614");
  });

  it("rejects a number owned by another applicant", async () => {
    db.users.push({ ...walkIn("+639216633614"), id: "u2", email: "x@example.invalid", accountStatus: "ACTIVE" });
    const res = await patch({ mobileNumber: "09216633614" });
    expect(res.statusCode).toBe(409);
    expect(mocks.txUserUpdate).not.toHaveBeenCalled();
  });

  it("rejects a non-mobile number for a walk-in", async () => {
    const res = await patch({ mobileNumber: "1234567" });
    expect(res.statusCode).toBe(400);
  });

  it("never rewrites the login number of a claimed account", async () => {
    db.users[0].accountStatus = "ACTIVE";
    const res = await patch({ mobileNumber: "09216633614" });
    expect(res.statusCode).toBe(200);
    expect(mocks.txUserUpdate).not.toHaveBeenCalled();
  });

  it("claim finds the account by the new number in any format, and not by the old one", async () => {
    await patch({ mobileNumber: "09216633614" });
    db.users[0].phoneNumber = "+639216633614"; // what the transaction wrote
    for (const typed of ["09216633614", "+639216633614", "9216633614", "0921-663-3614"]) {
      await expect(startAccountClaim(typed)).resolves.toBeDefined();
    }
    await expect(startAccountClaim("09170000001")).rejects.toMatchObject({ status: 404 });
  });

  it("claim says so when the number belongs to a claimed account", async () => {
    db.users[0].accountStatus = "ACTIVE";
    await expect(startAccountClaim("09170000001")).rejects.toBeInstanceOf(ClaimError);
    await expect(startAccountClaim("09170000001")).rejects.toMatchObject({ status: 409 });
  });
});
