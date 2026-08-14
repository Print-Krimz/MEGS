import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("../utils/supabase.js", () => ({
  default: { auth: { getUser: (...args: any[]) => mockGetUser(...args) } },
}));

vi.mock("../utils/prisma.js", () => ({
  default: { user: { findUnique: (...args: any[]) => mockFindUnique(...args) } },
}));

import { authenticateJWT, requireRole } from "./auth.middleware.js";

const mockResponse = () => {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json };
};

describe("auth.middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requireRole guard", () => {
    it("allows an administrator", () => {
      const res = mockResponse();
      const next = vi.fn();
      requireRole("ADMINISTRATOR")({ user: { id: "admin", email: "admin@example.test", role: "ADMINISTRATOR" } } as any, res as any, next);
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("rejects a Talent Acquisition user from an Admin-only endpoint with 403", () => {
      const res = mockResponse();
      const next = vi.fn();
      requireRole("ADMINISTRATOR")({ user: { id: "ta", email: "ta@example.test", role: "TALENT_ACQUISITION" } } as any, res as any, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("rejects unauthorized access when user is not on request", () => {
      const res = mockResponse();
      const next = vi.fn();
      requireRole("ADMINISTRATOR")({} as any, res as any, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe("authenticateJWT", () => {
    it("rejects request without authorization header with 401", async () => {
      const res = mockResponse();
      const next = vi.fn();
      await authenticateJWT({ headers: {} } as any, res as any, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects invalid Supabase token with 401", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "Invalid token" } });
      const res = mockResponse();
      const next = vi.fn();
      await authenticateJWT({ headers: { authorization: "Bearer invalid-token" } } as any, res as any, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects deactivated account with 403", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } }, error: null });
      mockFindUnique.mockResolvedValueOnce({ id: "user-123", email: "test@example.com", role: "APPLICANT", isActive: false, accountStatus: "DEACTIVATED" });

      const res = mockResponse();
      const next = vi.fn();
      await authenticateJWT({ headers: { authorization: "Bearer valid-token" } } as any, res as any, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects uncompleted INVITED accounts with 403", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-invited" } }, error: null });
      mockFindUnique.mockResolvedValueOnce({ id: "user-invited", email: "ta@example.com", role: "TALENT_ACQUISITION", isActive: true, accountStatus: "INVITED" });

      const res = mockResponse();
      const next = vi.fn();
      await authenticateJWT({ headers: { authorization: "Bearer valid-token" } } as any, res as any, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("enforces mustChangePassword by blocking general endpoints with 403", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-pwd-reset" } }, error: null });
      mockFindUnique.mockResolvedValueOnce({
        id: "user-pwd-reset",
        email: "user@example.com",
        role: "ADMINISTRATOR",
        isActive: true,
        accountStatus: "ACTIVE",
        mustChangePassword: true,
      });

      const res = mockResponse();
      const next = vi.fn();
      await authenticateJWT({
        headers: { authorization: "Bearer valid-token" },
        path: "/users",
        originalUrl: "/api/admin/users",
      } as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mustChangePassword: true }));
      expect(next).not.toHaveBeenCalled();
    });

    it("allows mustChangePassword user to call /api/auth/change-password", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-pwd-reset" } }, error: null });
      mockFindUnique.mockResolvedValueOnce({
        id: "user-pwd-reset",
        email: "user@example.com",
        role: "ADMINISTRATOR",
        isActive: true,
        accountStatus: "ACTIVE",
        mustChangePassword: true,
      });

      const req: any = {
        headers: { authorization: "Bearer valid-token" },
        path: "/change-password",
        originalUrl: "/api/auth/change-password",
      };
      const res = mockResponse();
      const next = vi.fn();

      await authenticateJWT(req, res as any, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.user).toBeDefined();
      expect(req.user.mustChangePassword).toBe(true);
    });
  });
});

