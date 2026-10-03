import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => ({
  createClient: vi.fn(), connect: vi.fn(), sendCommand: vi.fn(), on: vi.fn(),
  client: { isReady: false } as { isReady: boolean; connect?: unknown; sendCommand?: unknown; on?: unknown },
}));
vi.mock("redis", () => ({ createClient: transport.createClient }));

describe("shared security store connection boundary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("REDIS_URL", "rediss://synthetic-cache.invalid:6380");
    transport.client.isReady = false;
    transport.createClient.mockReturnValue(Object.assign(transport.client, {
      connect: transport.connect, sendCommand: transport.sendCommand, on: transport.on,
    }));
    transport.connect.mockImplementation(async () => { transport.client.isReady = true; });
    transport.sendCommand.mockResolvedValue(1);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("shares one connection attempt and disables offline queuing and unbounded reconnects", async () => {
    const { connectSharedStore } = await import("../../src/security/shared-store.js");
    await Promise.all(Array.from({ length: 12 }, () => connectSharedStore()));
    expect(transport.createClient).toHaveBeenCalledTimes(1);
    expect(transport.connect).toHaveBeenCalledTimes(1);
    expect(transport.createClient).toHaveBeenCalledWith({
      url: "rediss://synthetic-cache.invalid:6380", disableOfflineQueue: true,
      socket: { connectTimeout: 5000, reconnectStrategy: false },
    });
    expect(transport.on).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("rejects connection failure without issuing commands or substituting local counters", async () => {
    transport.connect.mockRejectedValue(new Error("synthetic transport unavailable"));
    const { sharedCommand } = await import("../../src/security/shared-store.js");
    await expect(sharedCommand("EXISTS", "synthetic-revocation-key")).rejects.toThrow("transport unavailable");
    expect(transport.sendCommand).not.toHaveBeenCalled();
  });

  it("refuses commands when the connection has lost readiness", async () => {
    const { connectSharedStore, sharedCommand } = await import("../../src/security/shared-store.js");
    await connectSharedStore();
    transport.client.isReady = false;
    await expect(sharedCommand("EXISTS", "synthetic-revocation-key")).rejects.toThrow("unavailable");
    expect(transport.sendCommand).not.toHaveBeenCalled();
  });

  it("applies the command deadline and propagates command errors", async () => {
    const { sharedCommand } = await import("../../src/security/shared-store.js");
    await expect(sharedCommand("EXISTS", "synthetic-revocation-key")).resolves.toBe(1);
    expect(transport.sendCommand).toHaveBeenCalledWith(["EXISTS", "synthetic-revocation-key"], { timeout: 5000 });
    transport.sendCommand.mockRejectedValue(new Error("synthetic command deadline"));
    await expect(sharedCommand("EXISTS", "synthetic-revocation-key")).rejects.toThrow("command deadline");
  });

  it("requires shared storage in production but permits the explicit local development boundary", async () => {
    vi.stubEnv("REDIS_URL", "");
    const { connectSharedStore } = await import("../../src/security/shared-store.js");
    await expect(connectSharedStore()).rejects.toThrow("required in production");
    vi.stubEnv("NODE_ENV", "development");
    await expect(connectSharedStore()).resolves.toBeUndefined();
    expect(transport.createClient).not.toHaveBeenCalled();
  });
});
