import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), updateMany: vi.fn(), audit: vi.fn(), factors: vi.fn(), enforced: vi.fn() }));
vi.mock("../../src/utils/prisma.js", () => ({ default: { user: { findUnique: mocks.findUnique, updateMany: mocks.updateMany } } }));
vi.mock("../../src/utils/audit.js", () => ({ logAudit: mocks.audit }));
vi.mock("../../src/utils/supabase.js", () => ({ default: { auth: { admin: { mfa: { listFactors: mocks.factors } } } } }));
vi.mock("../../src/security/auth-policy.js", () => ({ STAFF_ROLES: new Set(["ADMINISTRATOR", "TALENT_ACQUISITION"]), isMfaEnforced: mocks.enforced }));
import { getSettings, updateProfile } from "../../src/services/core/settings.service.js";
const staff = { id: "self", role: "TALENT_ACQUISITION", displayName: "Old", email: "staff@example.com", phoneNumber: null, isActive: true, accountStatus: "ACTIVE", applicantProfile: null };
beforeEach(() => { vi.clearAllMocks(); mocks.findUnique.mockResolvedValue(staff); mocks.updateMany.mockResolvedValue({ count: 1 }); mocks.enforced.mockResolvedValue(true); mocks.factors.mockResolvedValue({ data: { factors: [{ status: "verified" }] }, error: null }); });
describe("settings service", () => {
  it("returns independent account and unknown enrollment on provider failure", async () => {
    mocks.factors.mockRejectedValue(new Error("offline"));
    expect(await getSettings("self")).toEqual({ account: { id: "self", role: staff.role, name: "Old", email: staff.email, phoneNumber: null }, mfa: { required: true, enrolled: null } });
  });
  it("returns applicant profile and hides synthetic contact without creating profiles", async () => {
    mocks.findUnique.mockResolvedValue({ ...staff, role: "APPLICANT", displayName: "ignored", email: "639123456789@applicant.megs.local", applicantProfile: { firstName: "李", lastName: "明" } });
    const result = await getSettings("self");
    expect(result.account.name).toBe("李 明"); expect(result.account.email).toBeNull(); expect(result.mfa).toBeNull();
  });
  it("rejects applicant and inactive account changes", async () => {
    for (const user of [{ ...staff, role: "APPLICANT" }, { ...staff, isActive: false }]) { mocks.findUnique.mockResolvedValueOnce(user); await expect(updateProfile("self", "New")).rejects.toThrow(); }
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("does not write or audit unchanged names", async () => { await updateProfile("self", "Old"); expect(mocks.updateMany).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled(); });
  it("rejects concurrent demotion or deactivation", async () => { mocks.updateMany.mockResolvedValue({ count: 0 }); await expect(updateProfile("self", "New")).rejects.toThrow(); expect(mocks.audit).not.toHaveBeenCalled(); });
  it("audits actual changes using the self id", async () => { await updateProfile("self", "New"); expect(mocks.audit).toHaveBeenCalledWith("self", expect.any(String), "User", "self", expect.objectContaining({ before: "Old", after: "New" })); });
});

