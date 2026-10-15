import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
const mocks = vi.hoisted(() => ({ account: vi.fn(), revoked: vi.fn() }));
vi.mock("../../src/utils/prisma.js", () => ({ default: { user: { findUnique: mocks.account } } }));
vi.mock("../../src/security/session-revocation.js", () => ({ isSessionRevoked: mocks.revoked }));
vi.mock("../../src/services/core/notification.service.js", () => ({
  getNotificationsService: vi.fn(), getUnreadCountService: vi.fn(), markAsReadService: vi.fn(), markAllAsReadService: vi.fn(),
}));
vi.mock("../../src/utils/notification.js", async () => ({ notificationEmitter: new (await import("node:events")).EventEmitter() }));
import { notificationEmitter } from "../../src/utils/notification.js";
import { streamNotifications } from "../../src/controllers/core/notification.controller.js";

const active = { role: "APPLICANT", isActive: true, accountStatus: "ACTIVE", mustChangePassword: false };
function connection(exp = Date.now() / 1000 + 300, user = { role: "APPLICANT", aal: "aal1" }) {
  const res = Object.assign(new EventEmitter(), {
    setHeader: vi.fn(), flushHeaders: vi.fn(), write: vi.fn(), end: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn(), writableEnded: false,
  });
  streamNotifications({ user: { id: "user", ...user, tokenExpiresAt: exp }, headers: { authorization: "Bearer fake" } } as any, res as any);
  return res;
}
describe("notification session lifetime", () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
    mocks.account.mockResolvedValue(active); mocks.revoked.mockResolvedValue(false);
  });
  afterEach(() => { notificationEmitter.removeAllListeners(); vi.useRealTimers(); vi.clearAllMocks(); });
  it("rejects absent or already expired verified expiry", () => {
    expect(connection(Date.now() / 1000).status).toHaveBeenCalledWith(401);
    expect(connection(0).status).toHaveBeenCalledWith(401);
  });
  it("delivers to an active applicant, then closes exactly at verified expiry and cleans listeners", async () => {
    const res = connection(Date.now() / 1000 + 2);
    notificationEmitter.emit("notification:user", { id: 7 });
    await vi.advanceTimersByTimeAsync(1);
    expect(res.write).toHaveBeenCalledWith('data: {"id":7}\n\n');
    await vi.advanceTimersByTimeAsync(1999);
    expect(res.end).toHaveBeenCalledOnce();
    expect(notificationEmitter.listenerCount("notification:user")).toBe(0);
  });
  it.each([
    { ...active, isActive: false }, { ...active, accountStatus: "LOCKED" },
    { ...active, mustChangePassword: true }, { ...active, role: "ADMINISTRATOR" }, null,
  ])("closes before delivering after account permission changes", async (account) => {
    const res = connection(); mocks.account.mockResolvedValue(account);
    notificationEmitter.emit("notification:user", { id: 8 });
    await vi.advanceTimersByTimeAsync(1);
    expect(res.end).toHaveBeenCalledOnce(); expect(res.write).toHaveBeenCalledTimes(1);
  });
  it("checks shared logout revocation and fails closed on unavailable checks", async () => {
    const res = connection(); mocks.revoked.mockResolvedValue(true);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(res.end).toHaveBeenCalledOnce();
    const res2 = connection(); mocks.revoked.mockRejectedValue(new Error("offline"));
    notificationEmitter.emit("notification:user", { id: 9 });
    await vi.advanceTimersByTimeAsync(1); expect(res2.end).toHaveBeenCalledOnce();
  });
  it("closes on local logout signal or disconnected client", () => {
    const res = connection(); notificationEmitter.emit("session:closed:user"); expect(res.end).toHaveBeenCalledOnce();
    const res2 = connection(); res2.emit("close"); expect(notificationEmitter.listenerCount("notification:user")).toBe(0);
  });
  it("preserves verified staff AAL2 deliveries and denies missing staff MFA", async () => {
    vi.stubEnv("DISABLE_MFA", "false");
    mocks.account.mockResolvedValue({ ...active, role: "ADMINISTRATOR" });
    const valid = connection(undefined, { role: "ADMINISTRATOR", aal: "aal2" });
    notificationEmitter.emit("notification:user", { id: 10 });
    await vi.advanceTimersByTimeAsync(1);
    expect(valid.write).toHaveBeenCalledTimes(2);
    valid.emit("close");
    const denied = connection(undefined, { role: "ADMINISTRATOR", aal: "aal1" });
    notificationEmitter.emit("notification:user", { id: 11 });
    await vi.advanceTimersByTimeAsync(1);
    expect(denied.end).toHaveBeenCalledOnce(); expect(denied.write).toHaveBeenCalledTimes(1);
    vi.unstubAllEnvs();
  });
});
