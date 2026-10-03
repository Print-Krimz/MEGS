import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../src/security/session-revocation.js", () => ({ isSessionRevoked: vi.fn().mockResolvedValue(false) }));

const mocks = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("../../src/security/auth-token.js", () => ({
  verifyAccessToken: mocks.verifyAccessToken,
}));
vi.mock("../../src/utils/prisma.js", () => ({
  default: { user: { findUnique: mocks.findUnique } },
}));

import { authenticateJWT } from "../../src/middleware/auth.middleware.js";
import { isSessionRevoked } from "../../src/security/session-revocation.js";

const activeUser = {
  id: "user-123",
  email: "user@example.com",
  role: "APPLICANT",
  isActive: true,
  accountStatus: "ACTIVE",
  mustChangePassword: false,
};

const request = (overrides: Record<string, unknown> = {}) =>
  ({
    method: "GET",
    baseUrl: "/api/applicant",
    path: "/profile",
    originalUrl: "/api/applicant/profile",
    headers: { authorization: "Bearer valid.jwt.signature" },
    query: {},
    ...overrides,
  }) as any;

const response = () => {
  const state = { status: 200, body: undefined as unknown };
  return {
    state,
    value: {
      status(code: number) {
        state.status = code;
        return this;
      },
      json(body: unknown) {
        state.body = body;
        return this;
      },
    } as any,
  };
};

describe("authentication policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSessionRevoked).mockResolvedValue(false);
    mocks.verifyAccessToken.mockResolvedValue({ sub: "user-123", aal: "aal1" });
    mocks.findUnique.mockResolvedValue(activeUser);
  });

  it("denies shared-store outages with 503 rather than invalidating the login", async () => {
    vi.mocked(isSessionRevoked).mockRejectedValue(new Error("offline"));
    const res = response(); const next = vi.fn();
    await authenticateJWT(request(), res.value, next);
    expect(res.state.status).toBe(503); expect(next).not.toHaveBeenCalled();
  });

  it("does not accept a JWT from the query string", async () => {
    const res = response();
    const next = vi.fn();
    await authenticateJWT(request({ headers: {}, query: { token: "valid.jwt.signature" } }), res.value, next);
    expect(res.state.status).toBe(401);
    expect(mocks.verifyAccessToken).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("preserves AAL1 applicant access", async () => {
    const res = response();
    const next = vi.fn();
    await authenticateJWT(request(), res.value, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("requires AAL2 for staff operations", async () => {
    mocks.findUnique.mockResolvedValue({ ...activeUser, role: "ADMINISTRATOR" });
    const denied = response();
    await authenticateJWT(request({ baseUrl: "/api/admin", path: "/users" }), denied.value, vi.fn());
    expect(denied.state.status).toBe(403);

    mocks.verifyAccessToken.mockResolvedValue({ sub: "user-123", aal: "aal2" });
    const allowed = response();
    const next = vi.fn();
    await authenticateJWT(request({ baseUrl: "/api/admin", path: "/users" }), allowed.value, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it.each(["PENDING", "INVITED", "PENDING_VERIFICATION", "DEACTIVATED"])(
    "denies %s accounts",
    async (accountStatus) => {
      mocks.findUnique.mockResolvedValue({ ...activeUser, accountStatus });
      const res = response();
      await authenticateJWT(request(), res.value, vi.fn());
      expect(res.state.status).toBe(403);
    }
  );

  it("denies a disabled account even when its status is ACTIVE", async () => {
    mocks.findUnique.mockResolvedValue({ ...activeUser, isActive: false });
    const res = response();
    await authenticateJWT(request(), res.value, vi.fn());
    expect(res.state.status).toBe(403);
  });

  it("does not bypass forced password change through query text", async () => {
    mocks.findUnique.mockResolvedValue({ ...activeUser, mustChangePassword: true });
    const res = response();
    await authenticateJWT(
      request({ originalUrl: "/api/applicant/profile?next=/api/auth/logout" }),
      res.value,
      vi.fn()
    );
    expect(res.state.status).toBe(403);
  });

  it("allows only the exact password-change and logout routes during forced change", async () => {
    mocks.findUnique.mockResolvedValue({ ...activeUser, mustChangePassword: true });
    for (const path of ["/change-password", "/logout"]) {
      const res = response();
      const next = vi.fn();
      await authenticateJWT(
        request({ method: "POST", baseUrl: "/api/auth", path }),
        res.value,
        next
      );
      expect(next).toHaveBeenCalledOnce();
    }
  });
});
