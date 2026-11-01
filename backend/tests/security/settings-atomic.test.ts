import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ user: vi.fn(), transaction: vi.fn(), update: vi.fn(), audit: vi.fn() }));
vi.mock("../../src/utils/prisma.js", () => ({ default: { user: { findUnique: m.user }, $transaction: m.transaction } }));
vi.mock("../../src/utils/supabase.js", () => ({ default: {} }));
vi.mock("../../src/security/auth-policy.js", () => ({ STAFF_ROLES: new Set(["ADMINISTRATOR", "TALENT_ACQUISITION"]), isMfaEnforced: vi.fn() }));
import { updateProfile } from "../../src/services/core/settings.service.js";
let savedName: string;
beforeEach(() => {
  vi.clearAllMocks(); savedName = "Old";
  m.user.mockResolvedValue({ id: "self", role: "ADMINISTRATOR", isActive: true, accountStatus: "ACTIVE", displayName: "Old" });
  m.update.mockResolvedValue({ count: 1 }); m.audit.mockResolvedValue({});
  m.transaction.mockImplementation(async (fn) => {
    let pending = savedName;
    const tx = { user: { updateMany: async (args: any) => { const result = await m.update(args); if (result.count) pending = args.data.displayName; return result; } }, auditLog: { create: m.audit } };
    const result = await fn(tx); savedName = pending; return result;
  });
});
describe("settings audit transaction", () => {
  it("rolls back the name when the audit insert fails", async () => {
    m.audit.mockRejectedValue(new Error("audit unavailable"));
    await expect(updateProfile("self", "New")).rejects.toThrow();
    expect(savedName).toBe("Old");
  });
  it("commits an audit with immutable actor and target and before/after", async () => {
    await updateProfile("self", "New");
    expect(savedName).toBe("New");
    expect(m.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "self", action: "STAFF_DISPLAY_NAME_UPDATED", entity: "User", details: JSON.stringify({ targetEntityId: "self", before: "Old", after: "New" }) }) });
    expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "self", isActive: true, accountStatus: "ACTIVE", displayName: "Old", role: { in: ["ADMINISTRATOR", "TALENT_ACQUISITION"] } }) }));
  });
});
