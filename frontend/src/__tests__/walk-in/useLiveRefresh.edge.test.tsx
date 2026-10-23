import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

interface Call {
  url: string;
  opts: any;
  resolve: () => void;
  reject: (e: unknown) => void;
}

const calls = vi.hoisted(() => [] as Call[]);

vi.mock("@microsoft/fetch-event-source", () => ({
  fetchEventSource: (url: string, opts: any) =>
    new Promise<void>((resolve, reject) => {
      calls.push({ url, opts, resolve, reject });
      opts.signal?.addEventListener("abort", () => resolve());
    }),
}));

import { useLiveRefresh } from "../../hooks/useLiveRefresh";

const URL_ = "http://api.test/api/public/track/WLK-1/stream";
const sse = (status: number, type = "text/event-stream") =>
  ({ ok: status >= 200 && status < 300, status, headers: new Headers({ "content-type": type }) }) as Response;

const last = () => calls[calls.length - 1];
const emit = (event: string) => act(() => last().opts.onmessage({ event, data: "{}", id: "", retry: undefined }));
const setVisibility = (state: "hidden" | "visible") => {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
};
const failWith = async (error: unknown) => {
  await act(async () => {
    last().reject(error);
  });
};
// Runs the handler the way the library does and returns whatever it threw.
const thrownBy = async (fn: () => unknown): Promise<unknown> => {
  try {
    await fn();
  } catch (e) {
    return e;
  }
  return undefined;
};

describe("useLiveRefresh edge cases", () => {
  beforeEach(() => {
    calls.length = 0;
    vi.useFakeTimers();
    setVisibility("visible");
  });
  afterEach(() => vi.useRealTimers());

  it("calls the latest onChange after a rerender, never a stale one", () => {
    const first = vi.fn();
    const second = vi.fn();
    const headers = { "x-tracking-token": "t" };
    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useLiveRefresh({ url: URL_, headers, enabled: true, onChange: cb }),
      { initialProps: { cb: first } },
    );
    rerender({ cb: second });
    emit("ready");
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("aborts the old stream and reconnects with the new token when the token changes", () => {
    const { rerender } = renderHook(
      ({ token }: { token: string }) =>
        useLiveRefresh({ url: URL_, headers: { "x-tracking-token": token }, enabled: true, onChange: () => {} }),
      { initialProps: { token: "first-token" } },
    );
    const old = last();
    rerender({ token: "second-token" });
    expect(old.opts.signal.aborted).toBe(true);
    expect(calls).toHaveLength(2);
    expect(last().opts.headers).toEqual({ "x-tracking-token": "second-token" });
    expect(last().url).not.toContain("second-token");
  });

  it("a disabled hook never connects, even on online or visibility events", () => {
    renderHook(() => useLiveRefresh({ url: URL_, headers: { "x-tracking-token": "t" }, enabled: false, onChange: () => {} }));
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    setVisibility("hidden");
    setVisibility("visible");
    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(calls).toHaveLength(0);
  });

  it("removes its online and visibility listeners on unmount", () => {
    const { unmount } = renderHook(() =>
      useLiveRefresh({ url: URL_, headers: { "x-tracking-token": "t" }, enabled: true, onChange: () => {} }),
    );
    expect(calls).toHaveLength(1);
    unmount();
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    setVisibility("hidden");
    setVisibility("visible");
    expect(calls).toHaveLength(1);
  });

  it("retries a 503 with backoff", async () => {
    renderHook(() => useLiveRefresh({ url: URL_, headers: { "x-tracking-token": "t" }, enabled: true, onChange: () => {} }));
    const error = await thrownBy(() => last().opts.onopen(sse(503, "application/json")));
    await failWith(error);
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(calls.length).toBeGreaterThan(1);
  });

  it("retries a 429 once the Retry-After delay has passed", async () => {
    renderHook(() => useLiveRefresh({ url: URL_, headers: { "x-tracking-token": "t" }, enabled: true, onChange: () => {} }));
    const error = await thrownBy(() => last().opts.onopen(sse(429, "application/json")));
    await failWith(error);
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(calls.length).toBeGreaterThan(1);
  });
});
