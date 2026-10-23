import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiRequest, ApiError } from "../../lib/api/client";

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: "",
  json: async () => body,
});

function headersOf(fetchMock: ReturnType<typeof vi.fn>, callIndex = 0): Record<string, string> {
  const init = fetchMock.mock.calls[callIndex][1] as RequestInit;
  return (init.headers ?? {}) as Record<string, string>;
}

describe("apiRequest public paths (walk-in and claim)", () => {
  const originalLocation = window.location;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("access_token", "staff-token");
    localStorage.setItem("refresh_token", "staff-refresh");
    delete (window as { location?: Location }).location;
    (window as unknown as { location: Partial<Location> }).location = {
      pathname: "/t/WLK-2026-0042",
      search: "?token=abc",
      href: "http://localhost:5173/t/WLK-2026-0042?token=abc",
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    (window as unknown as { location: Location }).location = originalLocation;
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("sends no Authorization header to /api/public/track/:code even when a staff token is stored", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, data: { ok: true } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await apiRequest("/api/public/track/WLK-2026-0042?token=abc");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(headersOf(fetchMock).Authorization).toBeUndefined();
  });

  it("sends no Authorization header to /api/auth/claim/start", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, data: { message: "sent" } }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await apiRequest("/api/auth/claim/start", { method: "POST", body: JSON.stringify({ phone: "09171234567" }) });

    expect(headersOf(fetchMock).Authorization).toBeUndefined();
  });

  it("does not redirect to /login when a public track request answers 401", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { success: false, message: "Unauthorized" })) as unknown as typeof fetch;

    await expect(apiRequest("/api/public/track/WLK-2026-0042?token=bad")).rejects.toMatchObject({ status: 401 });
    await expect(apiRequest("/api/public/track/WLK-2026-0042?token=bad")).rejects.toBeInstanceOf(ApiError);

    expect(window.location.href).toBe("http://localhost:5173/t/WLK-2026-0042?token=abc");
  });

  it("does not redirect to /login when a claim request answers 401", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { success: false, message: "Unauthorized" })) as unknown as typeof fetch;

    await expect(
      apiRequest("/api/auth/claim/verify", { method: "POST", body: JSON.stringify({ phone: "09171234567", otp: "000000" }) }),
    ).rejects.toMatchObject({ status: 401 });

    expect(window.location.href).toBe("http://localhost:5173/t/WLK-2026-0042?token=abc");
  });

  it("control: a protected TA route still sends the staff token and redirects on 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: { matches: [] } }))
      .mockResolvedValueOnce(jsonResponse(401, { success: false, message: "Session expired" }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await apiRequest("/api/ta/walk-ins/check-duplicate?phone=09171234567");
    expect(headersOf(fetchMock, 0).Authorization).toBe("Bearer staff-token");

    await expect(apiRequest("/api/ta/applications")).rejects.toMatchObject({ status: 401 });
    expect(window.location.href).toMatch(/^\/login/);
    expect(localStorage.getItem("access_token")).toBeNull();
  });
});
