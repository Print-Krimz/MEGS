import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

const mocks = vi.hoisted(() => ({
  appFindUnique: vi.fn(),
  appFindMany: vi.fn(),
  checkInFindUnique: vi.fn(),
  checkInFindMany: vi.fn(),
}));

vi.mock("../../src/utils/prisma.js", () => ({
  default: {
    application: { findUnique: mocks.appFindUnique, findMany: mocks.appFindMany },
    walkInCheckIn: { findUnique: mocks.checkInFindUnique, findMany: mocks.checkInFindMany },
  },
}));
vi.mock("../../src/utils/supabase.js", () => ({ default: {}, supabase: {} }));
vi.mock("../../src/security/errors.js", async (orig) => ({ ...(await orig<any>()), safeLogError: vi.fn() }));

import { streamCheckInHandler, streamTrackingHandler } from "../../src/controllers/public/public-live.controller.js";
import { __liveHubStats } from "../../src/services/live-updates.service.js";
import { hashToken } from "../../src/services/ta/walk-in-tokens.js";
import { safeLogError } from "../../src/security/errors.js";

const TOKEN = "good-token";

const makeRes = () => {
  const res: any = new EventEmitter();
  res.headers = {} as Record<string, string>;
  res.body = "";
  res.statusCode = 200;
  res.writableEnded = false;
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
  res.set = (h: Record<string, string>) => { Object.assign(res.headers, h); return res; };
  res.flushHeaders = vi.fn();
  res.write = (chunk: string) => { res.body += chunk; return true; };
  res.end = vi.fn((chunk?: string) => { if (chunk) res.body += chunk; res.writableEnded = true; });
  res.json = (payload: unknown) => { res.body += JSON.stringify(payload); return res; };
  return res;
};

let ipSeq = 0;
const makeReq = (headers: Record<string, string>, params: Record<string, string>, ip = `10.0.0.${++ipSeq}`) =>
  ({ headers, params, ip, socket: { remoteAddress: ip } }) as any;

const appRow = { id: 5, trackingTokenHash: hashToken(TOKEN) };
const app = (status: string, at = 1) => ({ id: 5, status, updatedAt: new Date(at), interviews: [] });
const checkInRow = (status: string, overrides: Record<string, unknown> = {}) => ({
  id: 9,
  status,
  expiresAt: new Date(Date.now() + 3_600_000),
  viewTokenHash: hashToken(TOKEN),
  ...overrides,
});

describe("public live streams", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(mocks).forEach((m) => m.mockReset());
    mocks.appFindMany.mockResolvedValue([app("APPLIED")]);
    mocks.checkInFindMany.mockResolvedValue([]);
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    ["missing token", {}],
    ["wrong token", { "x-tracking-token": "nope" }],
  ])("tracking: %s gives 404 and no subscription", async (_n, headers) => {
    mocks.appFindUnique.mockResolvedValue(appRow);
    const res = makeRes();
    await streamTrackingHandler(makeReq(headers, { code: "abc" }), res);
    expect(res.statusCode).toBe(404);
    expect(res.flushHeaders).not.toHaveBeenCalled();
    expect(__liveHubStats()).toEqual({ subscribers: 0, timerRunning: false });
  });

  it("tracking: unknown code gives 404", async () => {
    mocks.appFindUnique.mockResolvedValue(null);
    const res = makeRes();
    await streamTrackingHandler(makeReq({ "x-tracking-token": TOKEN }, { code: "abc" }), res);
    expect(res.statusCode).toBe(404);
  });

  it("check-in: wrong token gives 404", async () => {
    mocks.checkInFindUnique.mockResolvedValue(checkInRow("PENDING"));
    const res = makeRes();
    await streamCheckInHandler(makeReq({ "x-check-in-token": "bad" }, { publicId: "p" }), res);
    expect(res.statusCode).toBe(404);
    expect(__liveHubStats().subscribers).toBe(0);
  });

  it("tracking: streams ready, changed, keep-alive, and unsubscribes on close", async () => {
    mocks.appFindUnique.mockResolvedValue(appRow);
    const res = makeRes();
    await streamTrackingHandler(makeReq({ "x-tracking-token": TOKEN }, { code: "abc" }), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("text/event-stream");
    expect(res.headers["Cache-Control"]).toBe("no-cache, no-transform");
    expect(res.headers["Connection"]).toBe("keep-alive");
    expect(res.headers["X-Accel-Buffering"]).toBe("no");
    expect(res.headers["Referrer-Policy"]).toBe("no-referrer");
    expect(res.flushHeaders).toHaveBeenCalled();
    expect(res.body).toContain("retry: 15000\n\n");
    expect(res.body).toContain("event: ready\ndata: {}\n\n");
    expect(__liveHubStats()).toEqual({ subscribers: 1, timerRunning: true });

    await vi.advanceTimersByTimeAsync(3000); // baseline
    expect(res.body).not.toContain("changed");
    mocks.appFindMany.mockResolvedValue([app("INTERVIEW", 2)]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(res.body.match(/event: changed\ndata: \{\}\n\n/g)).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(25_000);
    expect(res.body).toContain(": keep-alive\n\n");
    // The payload never carries applicant data or statuses.
    expect(res.body).not.toMatch(/INTERVIEW|APPLIED|name/i);

    res.emit("close");
    res.emit("close");
    expect(__liveHubStats()).toEqual({ subscribers: 0, timerRunning: false });
  });

  it("closes the stream after 15 minutes", async () => {
    mocks.appFindUnique.mockResolvedValue(appRow);
    const res = makeRes();
    await streamTrackingHandler(makeReq({ "x-tracking-token": TOKEN }, { code: "abc" }), res);
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000 + 1);
    expect(res.end).toHaveBeenCalled();
    expect(__liveHubStats().subscribers).toBe(0);
  });

  it("caps open streams at 4 per IP with 429, and frees a slot on close", async () => {
    mocks.appFindUnique.mockResolvedValue(appRow);
    const ip = "203.0.113.7";
    const open = async () => {
      const res = makeRes();
      await streamTrackingHandler(makeReq({ "x-tracking-token": TOKEN }, { code: "abc" }, ip), res);
      return res;
    };
    const streams = [await open(), await open(), await open(), await open()];
    const over = await open();
    expect(over.statusCode).toBe(429);
    expect(over.flushHeaders).not.toHaveBeenCalled();
    streams[0].emit("close");
    const reopened = await open();
    expect(reopened.statusCode).toBe(200);
    [...streams.slice(1), reopened].forEach((s) => s.emit("close"));
  });

  it("check-in: ends the stream once the check-in is dismissed, sending only {}", async () => {
    mocks.checkInFindUnique.mockResolvedValue(checkInRow("PENDING"));
    mocks.checkInFindMany.mockResolvedValue([{ id: 9, status: "PENDING", updatedAt: new Date(1), applicationId: null }]);
    const res = makeRes();
    await streamCheckInHandler(makeReq({ "x-check-in-token": TOKEN }, { publicId: "p" }), res);
    expect(res.statusCode).toBe(200);
    await vi.advanceTimersByTimeAsync(3000);

    mocks.checkInFindUnique.mockResolvedValue(checkInRow("DISMISSED"));
    mocks.checkInFindMany.mockResolvedValue([{ id: 9, status: "DISMISSED", updatedAt: new Date(2), applicationId: null }]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(res.body).toContain("event: changed\ndata: {}\n\n");
    expect(res.end).toHaveBeenCalled();
    expect(res.body).not.toMatch(/DISMISSED/);
    expect(__liveHubStats().subscribers).toBe(0);
  });

  it("check-in: stays open when confirmed", async () => {
    mocks.checkInFindUnique.mockResolvedValue(checkInRow("PENDING"));
    mocks.checkInFindMany.mockResolvedValue([{ id: 9, status: "PENDING", updatedAt: new Date(1), applicationId: null }]);
    const res = makeRes();
    await streamCheckInHandler(makeReq({ "x-check-in-token": TOKEN }, { publicId: "p" }), res);
    await vi.advanceTimersByTimeAsync(3000);
    mocks.checkInFindUnique.mockResolvedValue(checkInRow("CONFIRMED"));
    mocks.checkInFindMany.mockResolvedValue([{ id: 9, status: "CONFIRMED", updatedAt: new Date(2), applicationId: 5 }]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(res.body).toContain("event: changed");
    expect(res.end).not.toHaveBeenCalled();
    res.emit("close");
  });

  it("refuses an over-length token or code before any database lookup", async () => {
    const tracking = makeRes();
    await streamTrackingHandler(makeReq({ "x-tracking-token": "x".repeat(101) }, { code: "abc" }), tracking);
    const longCode = makeRes();
    await streamTrackingHandler(makeReq({ "x-tracking-token": TOKEN }, { code: "c".repeat(41) }), longCode);
    const checkIn = makeRes();
    await streamCheckInHandler(makeReq({ "x-check-in-token": "x".repeat(101) }, { publicId: "p" }), checkIn);
    const longPublicId = makeRes();
    await streamCheckInHandler(makeReq({ "x-check-in-token": TOKEN }, { publicId: "p".repeat(65) }), longPublicId);
    expect([tracking, longCode, checkIn, longPublicId].map((r) => r.statusCode)).toEqual([404, 404, 404, 404]);
    expect(mocks.appFindUnique).not.toHaveBeenCalled();
    expect(mocks.checkInFindUnique).not.toHaveBeenCalled();
  });

  it("ignores a token sent in the query string", async () => {
    const res = makeRes();
    const req = { headers: {}, params: { code: "abc" }, query: { "x-tracking-token": TOKEN }, ip: "10.1.1.1", socket: { remoteAddress: "10.1.1.1" } } as any;
    await streamTrackingHandler(req, res);
    expect(res.statusCode).toBe(404);
    expect(mocks.appFindUnique).not.toHaveBeenCalled();
  });

  it("closing the client clears the keep-alive and lifetime timers, and the response is ended once", async () => {
    mocks.appFindUnique.mockResolvedValue(appRow);
    const res = makeRes();
    await streamTrackingHandler(makeReq({ "x-tracking-token": TOKEN }, { code: "abc" }), res);
    expect(vi.getTimerCount()).toBe(3); // hub tick, keep-alive, lifetime
    res.emit("close");
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000 + 1);
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it("a response error releases the slot and the hub subscription", async () => {
    mocks.appFindUnique.mockResolvedValue(appRow);
    const res = makeRes();
    await streamTrackingHandler(makeReq({ "x-tracking-token": TOKEN }, { code: "abc" }), res);
    res.emit("error", new Error("EPIPE"));
    expect(__liveHubStats()).toEqual({ subscribers: 0, timerRunning: false });
  });

  it("a failing check-in end check is logged and does not escape as a rejection", async () => {
    mocks.checkInFindUnique.mockResolvedValueOnce(checkInRow("PENDING")).mockRejectedValueOnce(new Error("db down"));
    mocks.checkInFindMany
      .mockResolvedValueOnce([{ id: 9, status: "PENDING", updatedAt: new Date(1), applicationId: null }])
      .mockResolvedValue([{ id: 9, status: "CONFIRMED", updatedAt: new Date(2), applicationId: null }]);
    const res = makeRes();
    await streamCheckInHandler(makeReq({ "x-check-in-token": TOKEN }, { publicId: "p" }), res);
    await vi.advanceTimersByTimeAsync(6000);
    expect(res.body).toContain("event: changed");
    expect(res.end).not.toHaveBeenCalled();
    expect(safeLogError).toHaveBeenCalledWith("Live updates: check-in end check", expect.any(Error));
    res.emit("close");
  });

  it("DEFECT public-live.controller.ts:47-51: a database error during the token check answers 404, which the page treats as permanent", async () => {
    // Expected: a retryable 5xx. Actual: openStream maps any gate error to 404, and useLiveRefresh stops on 404 for good.
    mocks.appFindUnique.mockRejectedValue(new Error("connection reset"));
    const res = makeRes();
    await streamTrackingHandler(makeReq({ "x-tracking-token": TOKEN }, { code: "abc" }), res);
    expect(res.statusCode).toBeGreaterThanOrEqual(500);
  });

  it("DEFECT public-live.controller.ts:90-103: a client that leaves during the token check keeps its subscription until the 15-minute lifetime", async () => {
    // Expected: the subscription is released as soon as the client has gone.
    let finish!: (row: unknown) => void;
    mocks.appFindUnique.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const res = makeRes();
    const pending = streamTrackingHandler(makeReq({ "x-tracking-token": TOKEN }, { code: "abc" }), res);
    res.emit("close"); // the client leaves while the database check is still running
    finish(appRow);
    await pending;
    try {
      expect(__liveHubStats().subscribers).toBe(0);
    } finally {
      await vi.advanceTimersByTimeAsync(15 * 60 * 1000 + 1);
    }
  });

  it("DEFECT public-live.controller.ts:133-135: a check-in that lapses by expiry, with no row change, keeps streaming until a change or the lifetime", async () => {
    // Expected: the stream ends one tick after expiresAt, as the JSON endpoint refuses it then.
    mocks.checkInFindUnique.mockResolvedValue(checkInRow("PENDING", { expiresAt: new Date(Date.now() + 5000) }));
    mocks.checkInFindMany.mockResolvedValue([{ id: 9, status: "PENDING", updatedAt: new Date(1), applicationId: null }]);
    const res = makeRes();
    await streamCheckInHandler(makeReq({ "x-check-in-token": TOKEN }, { publicId: "p" }), res);
    try {
      await vi.advanceTimersByTimeAsync(10_000);
      expect(res.end).toHaveBeenCalled();
    } finally {
      res.emit("close");
    }
  });
});
