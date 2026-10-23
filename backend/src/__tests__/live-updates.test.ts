import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkInFindMany: vi.fn(),
  appFindMany: vi.fn(),
}));

vi.mock("../utils/prisma.js", () => ({
  default: {
    walkInCheckIn: { findMany: mocks.checkInFindMany },
    application: { findMany: mocks.appFindMany },
  },
}));
vi.mock("../security/errors.js", async (orig) => ({ ...(await orig<any>()), safeLogError: vi.fn() }));

import { __liveHubStats, subscribeLive } from "../services/live-updates.service.js";
import { safeLogError } from "../security/errors.js";

const app = (id: number, status = "APPLIED", at = 1000, interviewAt?: number) => ({
  id,
  status,
  updatedAt: new Date(at),
  interviews: interviewAt ? [{ updatedAt: new Date(interviewAt) }] : [],
});

describe("live updates hub", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.checkInFindMany.mockReset().mockResolvedValue([]);
    mocks.appFindMany.mockReset().mockResolvedValue([]);
  });
  afterEach(() => vi.useRealTimers());

  it("runs the timer only while subscribers exist", () => {
    expect(__liveHubStats().timerRunning).toBe(false);
    const a = subscribeLive({ kind: "application", id: 1 }, () => {});
    const b = subscribeLive({ kind: "application", id: 2 }, () => {});
    expect(__liveHubStats()).toEqual({ subscribers: 2, timerRunning: true });
    a();
    a();
    expect(__liveHubStats()).toEqual({ subscribers: 1, timerRunning: true });
    b();
    expect(__liveHubStats()).toEqual({ subscribers: 0, timerRunning: false });
  });

  it("records a baseline silently, then notifies only subscribers of the changed id", async () => {
    mocks.appFindMany.mockResolvedValue([app(1), app(2)]);
    const one = vi.fn();
    const oneB = vi.fn();
    const two = vi.fn();
    const offs = [
      subscribeLive({ kind: "application", id: 1 }, one),
      subscribeLive({ kind: "application", id: 1 }, oneB),
      subscribeLive({ kind: "application", id: 2 }, two),
    ];
    await vi.advanceTimersByTimeAsync(3000);
    expect(one).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3000);
    expect(one).not.toHaveBeenCalled();

    mocks.appFindMany.mockResolvedValue([app(1, "SCREENING"), app(2)]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(one).toHaveBeenCalledTimes(1);
    expect(oneB).toHaveBeenCalledTimes(1);
    expect(two).not.toHaveBeenCalled();

    mocks.appFindMany.mockResolvedValue([app(1, "SCREENING", 1000, 5000), app(2)]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(one).toHaveBeenCalledTimes(2);
    offs.forEach((off) => off());
  });

  it("uses at most two batched queries per tick regardless of subscribers", async () => {
    mocks.checkInFindMany.mockResolvedValue(
      [10, 11, 12].map((id) => ({ id, status: "PENDING", updatedAt: new Date(1), applicationId: id === 10 ? 1 : null })),
    );
    mocks.appFindMany.mockResolvedValue([app(1), app(2), app(3)]);
    const offs = [
      ...[1, 2, 3].flatMap((id) => [
        subscribeLive({ kind: "application", id }, () => {}),
        subscribeLive({ kind: "application", id }, () => {}),
      ]),
      ...[10, 11, 12].map((id) => subscribeLive({ kind: "checkIn", id }, () => {})),
    ];
    await vi.advanceTimersByTimeAsync(3000);
    expect(mocks.checkInFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.appFindMany).toHaveBeenCalledTimes(1);
    offs.forEach((off) => off());
  });

  it("notifies a check-in when its linked application changes or it becomes confirmed", async () => {
    const row = (status: string, applicationId: number | null) => ({ id: 10, status, updatedAt: new Date(1), applicationId });
    mocks.checkInFindMany.mockResolvedValue([row("PENDING", null)]);
    const onChange = vi.fn();
    const off = subscribeLive({ kind: "checkIn", id: 10 }, onChange);
    await vi.advanceTimersByTimeAsync(3000);
    mocks.checkInFindMany.mockResolvedValue([row("CONFIRMED", 7)]);
    mocks.appFindMany.mockResolvedValue([app(7)]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(onChange).toHaveBeenCalledTimes(1);
    mocks.appFindMany.mockResolvedValue([app(7, "INTERVIEW")]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(onChange).toHaveBeenCalledTimes(2);
    off();
  });

  it("keeps the timer running after a failing tick", async () => {
    mocks.appFindMany.mockRejectedValueOnce(new Error("db down")).mockResolvedValue([app(1)]);
    const onChange = vi.fn();
    const off = subscribeLive({ kind: "application", id: 1 }, onChange);
    await vi.advanceTimersByTimeAsync(3000);
    expect(__liveHubStats().timerRunning).toBe(true);
    await vi.advanceTimersByTimeAsync(3000);
    expect(mocks.appFindMany).toHaveBeenCalledTimes(2);
    expect(onChange).not.toHaveBeenCalled();
    off();
  });

  it("keeps the timer running when the check-in query fails, and recovers", async () => {
    mocks.checkInFindMany.mockRejectedValueOnce(new Error("db down")).mockResolvedValue([]);
    const off = subscribeLive({ kind: "checkIn", id: 10 }, () => {});
    await vi.advanceTimersByTimeAsync(3000);
    expect(__liveHubStats()).toEqual({ subscribers: 1, timerRunning: true });
    await vi.advanceTimersByTimeAsync(3000);
    expect(mocks.checkInFindMany).toHaveBeenCalledTimes(2);
    off();
  });

  it("contains a synchronous throw from the query inside the tick", async () => {
    mocks.appFindMany.mockImplementationOnce(() => {
      throw new Error("sync boom");
    });
    const off = subscribeLive({ kind: "application", id: 1 }, () => {});
    await vi.advanceTimersByTimeAsync(3000);
    expect(__liveHubStats().timerRunning).toBe(true);
    await vi.advanceTimersByTimeAsync(3000);
    expect(mocks.appFindMany).toHaveBeenCalledTimes(2);
    off();
  });

  it("logs a throwing subscriber and still notifies the others", async () => {
    mocks.appFindMany.mockResolvedValue([app(1)]);
    const bad = vi.fn(() => {
      throw new Error("boom");
    });
    const good = vi.fn();
    const offs = [subscribeLive({ kind: "application", id: 1 }, bad), subscribeLive({ kind: "application", id: 1 }, good)];
    await vi.advanceTimersByTimeAsync(3000);
    mocks.appFindMany.mockResolvedValue([app(1, "SCREENING")]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(bad).toHaveBeenCalledTimes(1);
    expect(good).toHaveBeenCalledTimes(1);
    expect(safeLogError).toHaveBeenCalledWith("Live updates: subscriber callback", expect.any(Error));
    offs.forEach((off) => off());
  });

  it("a subscriber that unsubscribes inside its own callback leaves the others intact", async () => {
    mocks.appFindMany.mockResolvedValue([app(1)]);
    const other = vi.fn();
    let leave!: () => void;
    leave = subscribeLive({ kind: "application", id: 1 }, () => leave());
    const offOther = subscribeLive({ kind: "application", id: 1 }, other);
    await vi.advanceTimersByTimeAsync(3000);
    mocks.appFindMany.mockResolvedValue([app(1, "SCREENING")]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(other).toHaveBeenCalledTimes(1);
    expect(__liveHubStats()).toEqual({ subscribers: 1, timerRunning: true });
    mocks.appFindMany.mockResolvedValue([app(1, "INTERVIEW")]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(other).toHaveBeenCalledTimes(2);
    offOther();
    expect(__liveHubStats()).toEqual({ subscribers: 0, timerRunning: false });
  });

  it("does not start an overlapping tick while the previous query is still pending", async () => {
    let release!: () => void;
    mocks.appFindMany.mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve([]))));
    const off = subscribeLive({ kind: "application", id: 1 }, () => {});
    await vi.advanceTimersByTimeAsync(9000);
    expect(mocks.appFindMany).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(3000);
    expect(mocks.appFindMany).toHaveBeenCalledTimes(2);
    off();
  });
});
