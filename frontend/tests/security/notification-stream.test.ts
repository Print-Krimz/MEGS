import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectNotificationStream } from "../../src/lib/notification-stream";

describe("notification reconnect and session replacement", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  function connect(transport: any) {
    let token: string | null = "first-session";
    let restart: () => void = () => {};
    const unsubscribe = vi.fn();
    const dispose = connectNotificationStream({
      url: "https://api.example.com/api/notifications/stream",
      getToken: () => token, onMessage: vi.fn(), transport,
      subscribeSession: (listener) => { restart = listener; return unsubscribe; },
    });
    return { dispose, unsubscribe, changeToken: (value: string | null) => { token = value; restart(); } };
  }
  it.each([401, 403])("stops retries on HTTP %s, resumes only with a changed session", async (status) => {
    const transport = vi.fn(async (_url, options) => {
      await options.onopen(new Response("", { status }));
    });
    const connection = connect(transport);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(transport).toHaveBeenCalledTimes(1);
    connection.changeToken("replacement-session");
    await vi.advanceTimersByTimeAsync(1);
    expect(transport.mock.calls[1][1].headers.Authorization).toBe("Bearer replacement-session");
    connection.dispose();
  });
  it("bounds transient retries and refreshes the Bearer header for new sessions", async () => {
    const transport = vi.fn(async () => { throw new Error("network"); });
    const connection = connect(transport);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(transport).toHaveBeenCalledTimes(5);
    expect(transport.mock.calls.every((call: any[]) => !call[0].includes("token="))).toBe(true);
    connection.changeToken("second-session");
    await vi.advanceTimersByTimeAsync(1);
    expect(transport).toHaveBeenCalledTimes(6);
    expect((transport.mock.calls[5] as any)[1].headers.Authorization).toBe("Bearer second-session");
    connection.dispose();
  });
  it("reconnects a closed stream, cleans active connections and timers on logout/unmount", async () => {
    const transport = vi.fn(async (_url, options) => { options.onclose(); });
    const connection = connect(transport);
    await vi.advanceTimersByTimeAsync(1001);
    expect(transport).toHaveBeenCalledTimes(2);
    const previousSignal = transport.mock.calls[1][1].signal;
    connection.changeToken(null);
    expect(previousSignal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(transport).toHaveBeenCalledTimes(2);
    connection.dispose();
    expect(connection.unsubscribe).toHaveBeenCalledOnce();
  });
  it("accepts SSE success, forwards notifications and prevents library infinite retry", async () => {
    const transport = vi.fn(async (_url, options) => {
      await options.onopen(new Response("", { headers: { "content-type": "text/event-stream" } }));
      expect(() => options.onerror(new Error("disconnected"))).toThrow();
    });
    const connection = connect(transport);
    await vi.advanceTimersByTimeAsync(1);
    expect(transport).toHaveBeenCalledOnce();
    connection.dispose();
  });
});
