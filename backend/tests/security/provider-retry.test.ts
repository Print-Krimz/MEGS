import { afterEach, describe, expect, it, vi } from "vitest";
import { withProviderRetry } from "../../src/security/provider-retry.js";

describe("Gemini transient retry without repeating record writes", () => {
  afterEach(() => vi.useRealTimers());
  it("honors Retry-After and succeeds after 429/503 with one final result", async () => {
    vi.useFakeTimers();
    const request = vi.fn().mockRejectedValueOnce({ status: 429, headers: { "retry-after": "3" } })
      .mockRejectedValueOnce({ status: 503 }).mockResolvedValue("result");
    const run = withProviderRetry(request);
    await vi.advanceTimersByTimeAsync(2999); expect(request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); expect(request).toHaveBeenCalledTimes(2);
    await vi.runAllTimersAsync(); expect(await run).toBe("result"); expect(request).toHaveBeenCalledTimes(3);
  });
  it("returns a recoverable error for a long quota hint without retrying too early", async () => {
    const request = vi.fn().mockRejectedValue({ status: 429, details: [
      { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "120s" },
    ] });
    await expect(withProviderRetry(request)).rejects.toMatchObject({ retryable: true, retryAfterMs: 120000 });
    expect(request).toHaveBeenCalledOnce();
  });
  it("bounds persistent throttling and never retries cancellation or invalid requests", async () => {
    vi.useFakeTimers();
    const request = vi.fn().mockRejectedValue({ status: 429 });
    const run = expect(withProviderRetry(request)).rejects.toMatchObject({ retryable: true });
    await vi.runAllTimersAsync(); await run; expect(request).toHaveBeenCalledTimes(3);
    for (const error of [{ status: 400 }, { status: 429, name: "TimeoutError" }, { name: "AbortError" }]) {
      const call = vi.fn().mockRejectedValue(error);
      await expect(withProviderRetry(call)).rejects.toEqual(error); expect(call).toHaveBeenCalledOnce();
    }
  });
});
