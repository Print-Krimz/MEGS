import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiRequest, apiRequestBlob, ApiError } from "../client";
import { bumpSessionGeneration } from "../../auth/session-generation";

const ok = (data: unknown) => ({ status: 200, ok: true, json: async () => ({ success: true, data }) });
const unauthorized = () => ({ status: 401, ok: false, json: async () => ({ success: false, message: "expired" }) });

// Node 26 ships its own localStorage that can shadow jsdom's; use a plain in-memory store.
const memoryStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
};

describe("API Client - silent token refresh", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    delete (window as any).location;
    (window as any).location = { pathname: "/ta/queue", search: "", href: "http://localhost/ta/queue" };
    localStorage.setItem("access_token", "old-access");
    localStorage.setItem("refresh_token", "old-refresh");
  });

  afterEach(() => {
    (window as any).location = originalLocation;
  });

  it("refreshes on 401, stores new tokens and retries the original request once", async () => {
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/api/auth/refresh")) {
        return ok({ access_token: "new-access", refresh_token: "new-refresh" });
      }
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === "Bearer new-access" ? ok({ hello: "world" }) : unauthorized();
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiRequest("/api/me")).resolves.toEqual({ hello: "world" });

    expect(localStorage.getItem("access_token")).toBe("new-access");
    expect(localStorage.getItem("refresh_token")).toBe("new-refresh");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(window.location.href).toBe("http://localhost/ta/queue");
  });

  it("clears tokens and redirects to /login when the refresh fails", async () => {
    globalThis.fetch = vi.fn(async () => unauthorized()) as unknown as typeof fetch;

    await expect(apiRequest("/api/me")).rejects.toBeInstanceOf(ApiError);

    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
    expect(window.location.href).toContain("/login");
  });

  it("does not loop when the retried request is still 401", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith("/api/auth/refresh") ? ok({ access_token: "new-access", refresh_token: "r2" }) : unauthorized()
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiRequest("/api/me")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("shares one refresh call between concurrent 401s", async () => {
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/api/auth/refresh")) {
        await new Promise((r) => setTimeout(r, 10));
        return ok({ access_token: "new-access", refresh_token: "new-refresh" });
      }
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === "Bearer new-access" ? ok({ n: 1 }) : unauthorized();
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await Promise.all([apiRequest("/api/a"), apiRequest("/api/b"), apiRequest("/api/c")]);

    const refreshCalls = fetchMock.mock.calls.filter(([u]) => String(u).endsWith("/api/auth/refresh"));
    expect(refreshCalls).toHaveLength(1);
  });

  it("never replays A's request under B's token after the session changes", async () => {
    const releasers: Array<(v: unknown) => void> = [];
    const seen: string[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      const auth = (init.headers as Record<string, string>).Authorization;
      if (url.endsWith("/api/auth/refresh")) return ok({ access_token: "x", refresh_token: "x" });
      seen.push(auth);
      if (auth === "Bearer old-access") return new Promise((r) => { releasers.push(r); });
      return ok({ for: auth });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const pending = apiRequest("/api/a");
    const pendingBlob = apiRequestBlob("/api/b");
    const settled = Promise.allSettled([pending, pendingBlob]);
    localStorage.setItem("access_token", "b-access");
    bumpSessionGeneration();
    releasers.forEach((r) => r(unauthorized()));
    const results = await settled;
    expect(results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    expect(seen).not.toContain("Bearer b-access");
    expect(localStorage.getItem("access_token")).toBe("b-access");
  });

  it("a refresh that finishes after logout does not restore credentials", async () => {
    let release: (v: unknown) => void = () => {};
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/api/auth/refresh")) return new Promise((r) => { release = r; });
      return unauthorized();
    }) as unknown as typeof fetch;
    const pending = apiRequest("/api/me");
    await new Promise((r) => setTimeout(r, 5));
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    bumpSessionGeneration();
    release(ok({ access_token: "late", refresh_token: "late" }));
    await expect(pending).rejects.toBeDefined();
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });
});
