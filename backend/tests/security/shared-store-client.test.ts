import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn() }));
vi.mock("../../src/utils/prisma.js", () => ({ default: { $queryRaw: db.query, $executeRaw: db.execute } }));
import { connectSharedStore, PostgresRateLimitStore, cleanupSecurityState } from "../../src/security/shared-store.js";

describe("existing PostgreSQL security store boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); db.query.mockResolvedValue([]); db.execute.mockResolvedValue(1); });
  it("checks both additive tables without any Redis config or network client", async () => {
    await connectSharedStore(); expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls.map(call => call[0].join("")).join(" ")).not.toContain('"SecurityControl"');
  });
  it("fails startup when the migration/database is unavailable", async () => {
    db.query.mockRejectedValue(new Error("missing security tables"));
    await expect(connectSharedStore()).rejects.toThrow("missing security tables");
  });
  it("uses a parameterized atomic upsert with the database clock and namespaces", async () => {
    const expiry = new Date(Date.now() + 60000); db.query.mockResolvedValue([{ hits: 2, expiresAt: expiry }]);
    const store = new PostgresRateLimitStore("auth"); store.init({ windowMs: 60000 } as any);
    expect(await store.increment("synthetic'key")).toEqual({ totalHits: 2, resetTime: expiry });
    const [sql, key, window] = db.query.mock.calls[0]!;
    expect(sql.join("?")).toContain('ON CONFLICT ("key") DO UPDATE');
    expect(sql.join("?")).not.toContain("synthetic"); expect(key).toBe("rate:auth:synthetic'key"); expect(window).toBe(60000);
    db.query.mockRejectedValue(new Error("offline")); await expect(store.increment("key")).rejects.toThrow("offline");
  });
  it("supports decrement/reset and bounded cleanup, keeping failures visible", async () => {
    const store = new PostgresRateLimitStore("test");
    await store.decrement("key"); await store.resetKey("key"); await cleanupSecurityState();
    expect(db.execute).toHaveBeenCalledTimes(4);
    expect(db.execute.mock.calls[2]![0].join("")).toContain("LIMIT 1000");
  });
});
