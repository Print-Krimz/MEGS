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
const headers = { "x-tracking-token": "secret-token" };
const sse = (status: number, type = "text/event-stream", extra: Record<string, string> = {}) =>
  ({ ok: status >= 200 && status < 300, status, headers: new Headers({ "content-type": type, ...extra }) }) as Response;

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

describe("useLiveRefresh", () => {
  beforeEach(() => {
    calls.length = 0;
    vi.useFakeTimers();
    setVisibility("visible");
  });
  afterEach(() => vi.useRealTimers());

  const setup = (onChange = vi.fn(), enabled = true) => ({
    onChange,
    ...renderHook(() => useLiveRefresh({ url: URL_, headers, enabled, onChange })),
  });

  it("connects with the header and keeps the token out of the URL", () => {
    setup();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(URL_);
    expect(calls[0].url).not.toContain("secret-token");
    expect(calls[0].opts.headers).toEqual(headers);
    expect(calls[0].opts.openWhenHidden).toBe(false);
  });

  it("does not connect while disabled", () => {
    setup(vi.fn(), false);
    expect(calls).toHaveLength(0);
  });

  it("is connected after ready and calls onChange once for a burst of changed events", () => {
    const { result, onChange } = setup();
    expect(result.current.connected).toBe(false);
    emit("ready");
    expect(result.current.connected).toBe(true);
    emit("changed");
    emit("changed");
    emit("changed");
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("calls onChange once after ready to catch up", () => {
    const { onChange } = setup();
    emit("ready");
    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  const openError = async (response: Response) => {
    try {
      await last().opts.onopen(response);
    } catch (e) {
      return e;
    }
    return undefined;
  };

  it("stops for good when the server answers 404", async () => {
    const { result } = setup();
    await failWith(await openError(sse(404, "application/json")));
    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });
    expect(calls).toHaveLength(1);
    expect(result.current.connected).toBe(false);
  });

  it("retries a 503 with backoff", async () => {
    setup();
    await failWith(await openError(sse(503, "application/json")));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(calls).toHaveLength(2);
  });

  it("waits at least the Retry-After delay after a 429, capped at 60 seconds", async () => {
    setup();
    await failWith(await openError(sse(429, "application/json", { "retry-after": "30" })));
    await act(async () => {
      vi.advanceTimersByTime(29_999);
    });
    expect(calls).toHaveLength(1);
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(calls).toHaveLength(2);

    await failWith(await openError(sse(429, "application/json", { "retry-after": "600" })));
    await act(async () => {
      vi.advanceTimersByTime(59_999);
    });
    expect(calls).toHaveLength(2);
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(calls).toHaveLength(3);
  });

  it("pauses while the tab is hidden, then reconnects and catches up on return", () => {
    const { onChange } = setup();
    emit("ready");
    const first = last();
    setVisibility("hidden");
    expect(first.opts.signal.aborted).toBe(true);
    expect(calls).toHaveLength(1);
    setVisibility("visible");
    expect(calls).toHaveLength(2);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("reconnects at once when the server closes the stream", async () => {
    setup();
    emit("ready");
    expect(() => last().opts.onclose()).toThrow();
    await failWith((() => { try { last().opts.onclose(); } catch (e) { return e; } })());
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(calls).toHaveLength(2);
  });

  it("aborts on unmount", () => {
    const { unmount } = setup();
    const signal = last().opts.signal as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it("retries with 1s, 2s, 4s, 8s backoff then gives up until the tab returns", async () => {
    const { result } = setup();
    for (const wait of [1000, 2000, 4000, 8000]) {
      await failWith(new TypeError("network"));
      const before = calls.length;
      await act(async () => {
        vi.advanceTimersByTime(wait - 1);
      });
      expect(calls).toHaveLength(before);
      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(calls).toHaveLength(before + 1);
    }
    await failWith(new TypeError("network"));
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(calls).toHaveLength(5);
    expect(result.current.connected).toBe(false);

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(calls).toHaveLength(6);
  });
});
