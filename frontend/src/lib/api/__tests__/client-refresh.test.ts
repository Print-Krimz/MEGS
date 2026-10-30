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

  describe("proactive refresh", () => {
    const jwt = (exp?: number) => {
      const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
      return `${b64({ alg: "none" })}.${b64({ sub: "u1", ...(exp === undefined ? {} : { exp }) })}.sig`;
    };
    const inSeconds = (s: number) => Math.floor(Date.now() / 1000) + s;
    const refreshMock = (fresh: string) =>
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.endsWith("/api/auth/refresh")) {
          await new Promise((r) => setTimeout(r, 5));
          return ok({ access_token: fresh, refresh_token: "new-refresh" });
        }
        const auth = (init.headers as Record<string, string>).Authorization;
        return auth === `Bearer ${fresh}` ? ok({ hello: "world" }) : unauthorized();
      });

    it("refreshes before sending when exp is within 30 s", async () => {
      const fresh = jwt(inSeconds(3600));
      localStorage.setItem("access_token", jwt(inSeconds(10)));
      const fetchMock = refreshMock(fresh);
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await expect(apiRequest("/api/me")).resolves.toEqual({ hello: "world" });

      const urls = fetchMock.mock.calls.map(([u]) => String(u));
      expect(urls).toHaveLength(2);
      expect(urls[0]).toMatch(/\/api\/auth\/refresh$/);
      expect(urls[1]).toMatch(/\/api\/me$/);
      expect(localStorage.getItem("access_token")).toBe(fresh);
    });

    it("does not refresh a token that is valid for more than 30 s", async () => {
      localStorage.setItem("access_token", jwt(inSeconds(300)));
      const fetchMock = vi.fn(async () => ok({ n: 1 }));
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await apiRequest("/api/me");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("does not refresh for public auth paths or logout", async () => {
      localStorage.setItem("access_token", jwt(inSeconds(1)));
      const fetchMock = vi.fn(async () => ok({ n: 1 }));
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await apiRequest("/api/auth/login", { method: "POST" });
      await apiRequest("/api/public/jobs");
      await apiRequest("/api/auth/logout", { method: "POST" });
      expect(fetchMock.mock.calls.map(([u]) => new URL(String(u)).pathname)).toEqual([
        "/api/auth/login",
        "/api/public/jobs",
        "/api/auth/logout",
      ]);
    });

    it("concurrent requests share one proactive refresh", async () => {
      const fresh = jwt(inSeconds(3600));
      localStorage.setItem("access_token", jwt(inSeconds(5)));
      const fetchMock = refreshMock(fresh);
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await Promise.all([apiRequest("/api/a"), apiRequest("/api/b"), apiRequest("/api/c")]);

      const urls = fetchMock.mock.calls.map(([u]) => String(u));
      expect(urls.filter((u) => u.endsWith("/api/auth/refresh"))).toHaveLength(1);
      expect(urls).toHaveLength(4);
      expect(urls[0]).toMatch(/\/api\/auth\/refresh$/);
    });

    it("token without exp or undecodable falls back to the 401 path without looping", async () => {
      for (const token of [jwt(), "not-a-jwt"]) {
        localStorage.setItem("access_token", token);
        localStorage.setItem("refresh_token", "old-refresh");
        const fetchMock = vi.fn(async (url: string) =>
          url.endsWith("/api/auth/refresh") ? ok({ access_token: "new-access", refresh_token: "r2" }) : unauthorized()
        );
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        await expect(apiRequest("/api/me")).rejects.toBeInstanceOf(ApiError);
        // request, refresh after the 401, one retry: the first call is not a refresh
        expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/me$/);
        expect(fetchMock).toHaveBeenCalledTimes(3);
      }
    });

    it("never sends a request under a session that changed during the refresh", async () => {
      localStorage.setItem("access_token", jwt(inSeconds(5)));
      let release: (v: unknown) => void = () => {};
      const sent: string[] = [];
      const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
        if (url.endsWith("/api/auth/refresh")) return new Promise((r) => { release = r; });
        sent.push((init.headers as Record<string, string>).Authorization);
        return ok({ n: 1 });
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const pending = Promise.allSettled([apiRequest("/api/a"), apiRequestBlob("/api/b")]);
      await new Promise((r) => setTimeout(r, 5));
      localStorage.setItem("access_token", "b-access");
      bumpSessionGeneration();
      release(ok({ access_token: "late", refresh_token: "late" }));

      const results = await pending;
      expect(results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
      expect(sent).toEqual([]);
      expect(localStorage.getItem("access_token")).toBe("b-access");
    });

    it("a failed proactive refresh keeps the 401 path and does not loop", async () => {
      localStorage.setItem("access_token", jwt(inSeconds(5)));
      const fetchMock = vi.fn(async () => unauthorized());
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await expect(apiRequest("/api/me")).rejects.toBeInstanceOf(ApiError);
      expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(3);
      expect(localStorage.getItem("access_token")).toBeNull();
      expect(window.location.href).toContain("/login");
    });
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
