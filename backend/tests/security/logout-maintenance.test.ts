import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
const mocks = vi.hoisted(() => ({ revoke: vi.fn(), logout: vi.fn() }));
vi.mock("../../src/security/session-revocation.js", () => ({ revokeSession: mocks.revoke }));
vi.mock("../../src/services/core/auth.service.js", () => ({
  registerUser: vi.fn(), verifyOtp: vi.fn(), resendOtp: vi.fn(), loginUser: vi.fn(), logoutUser: mocks.logout,
  requestPasswordReset: vi.fn(), resetUserPassword: vi.fn(), changeUserPassword: vi.fn(), setupAccount: vi.fn(), getInvitationDetails: vi.fn(),
}));
vi.mock("../../src/utils/notification.js", async () => ({ notificationEmitter: new (await import("node:events")).EventEmitter() }));
import { logout } from "../../src/controllers/core/auth.controller.js";
import { acquireMaintenanceSlot, finishMaintenance } from "../../src/middleware/maintenance-limit.middleware.js";
const response = () => Object.assign(new EventEmitter(), { locals: {}, status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn() });

describe("logout and maintenance lifecycle", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.revoke.mockResolvedValue(undefined); mocks.logout.mockResolvedValue({ success: true }); });
  it.each(["Bearer synthetic-token", "Bearer   synthetic-token", "Bearer\tsynthetic-token", "bearer synthetic-token"])("revokes the exact authenticated token with %s", async header => {
    const res = response(); const exp = Date.now() / 1000 + 300;
    await logout({ headers: { authorization: header }, user: { id: "owner", tokenExpiresAt: exp } } as any, res as any);
    expect(mocks.revoke).toHaveBeenCalledWith("synthetic-token", exp);
    expect(mocks.logout).toHaveBeenCalledWith("synthetic-token", "owner");
    expect(res.json.mock.calls[0]![0].success).toBe(true);
  });
  it("does not report successful logout when shared revocation fails", async () => {
    mocks.revoke.mockRejectedValue(new Error("offline")); const res = response();
    await logout({ headers: { authorization: "Bearer synthetic-token" }, user: { id: "owner", tokenExpiresAt: Date.now() / 1000 + 300 } } as any, res as any);
    expect(res.json.mock.calls[0]![0].success).toBe(false); expect(mocks.logout).not.toHaveBeenCalled();
  });
  it("reserves maintenance before buffering and does not release running work on client close", async () => {
    const first = response(); const second = response(); const next = vi.fn();
    acquireMaintenanceSlot({ complete: true } as any, first as any, next);
    first.emit("close"); acquireMaintenanceSlot({ complete: true } as any, second as any, next);
    expect(second.status).toHaveBeenCalledWith(429);
    await finishMaintenance(vi.fn().mockResolvedValue(undefined))({} as any, first as any, next);
    const third = response(); acquireMaintenanceSlot({ complete: true } as any, third as any, next);
    expect(third.status).not.toHaveBeenCalled(); third.emit("finish");
  });
  it("releases aborted upload reservations and handler failures", async () => {
    const res = response(); const next = vi.fn();
    acquireMaintenanceSlot({ complete: false } as any, res as any, next); res.emit("close");
    const second = response(); acquireMaintenanceSlot({ complete: true } as any, second as any, next);
    expect(second.status).not.toHaveBeenCalled();
    await finishMaintenance(() => { throw new Error("synthetic failure"); })({} as any, second as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
