import { describe, expect, it, vi } from "vitest";

vi.mock("../utils/supabase.js", () => ({ default: { auth: { getUser: vi.fn() } } }));
vi.mock("../utils/prisma.js", () => ({ default: { user: { findUnique: vi.fn() } } }));

import { requireRole } from "./auth.middleware.js";

const response = () => {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json };
};

describe("admin role guard", () => {
  it("allows an administrator", () => {
    const res = response();
    const next = vi.fn();
    requireRole("ADMINISTRATOR")({ user: { id: "admin", email: "admin@example.test", role: "ADMINISTRATOR" } } as any, res as any, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects a Talent Acquisition user from an Admin-only endpoint", () => {
    const res = response();
    const next = vi.fn();
    requireRole("ADMINISTRATOR")({ user: { id: "ta", email: "ta@example.test", role: "TALENT_ACQUISITION" } } as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
