import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getUser: vi.fn(),
  listFactors: vi.fn(),
  deleteFactor: vi.fn(),
  enroll: vi.fn(),
}));

vi.mock("../../src/utils/prisma.js", () => ({ default: {} }));
vi.mock("../../src/utils/audit.js", () => ({ logAudit: vi.fn() }));
vi.mock("../../src/utils/supabase.js", () => ({
  default: { auth: { getUser: m.getUser, admin: { mfa: { listFactors: m.listFactors, deleteFactor: m.deleteFactor } } } },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { mfa: { enroll: m.enroll } } }),
}));

import { enrollMfa } from "../../src/services/core/mfa.service.js";

const tokenWithAal = (aal: string) =>
  `h.${Buffer.from(JSON.stringify({ aal })).toString("base64url")}.s`;
const enrolled = { data: { id: "f-new", type: "totp", totp: { qr_code: "qr", secret: "s", uri: "u" } }, error: null };

beforeEach(() => {
  vi.clearAllMocks();
  m.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  m.deleteFactor.mockResolvedValue({ error: null });
  m.enroll.mockResolvedValue(enrolled);
});

describe("MFA enrollment preserves verified factors", () => {
  it("enrolls a fresh account with no factors", async () => {
    m.listFactors.mockResolvedValue({ data: { factors: [] }, error: null });
    const result = await enrollMfa(tokenWithAal("aal1"));
    expect(result.factorId).toBe("f-new");
    expect(m.deleteFactor).not.toHaveBeenCalled();
  });

  it("deletes unverified factors only, then enrolls", async () => {
    m.listFactors.mockResolvedValue({ data: { factors: [{ id: "stale", status: "unverified" }] }, error: null });
    await enrollMfa(tokenWithAal("aal1"));
    expect(m.deleteFactor).toHaveBeenCalledTimes(1);
    expect(m.deleteFactor).toHaveBeenCalledWith({ id: "stale", userId: "u1" });
  });

  it("rejects an AAL1 session on an account with a verified factor and deletes nothing", async () => {
    m.listFactors.mockResolvedValue({
      data: { factors: [{ id: "v1", status: "verified" }, { id: "stale", status: "unverified" }] },
      error: null,
    });
    await expect(enrollMfa(tokenWithAal("aal1"))).rejects.toThrow(/current authentication code/);
    expect(m.deleteFactor).not.toHaveBeenCalled();
    expect(m.enroll).not.toHaveBeenCalled();
  });

  it("allows an AAL2 session to add a factor, never deleting the verified one", async () => {
    m.listFactors.mockResolvedValue({ data: { factors: [{ id: "v1", status: "verified" }] }, error: null });
    await enrollMfa(tokenWithAal("aal2"));
    expect(m.deleteFactor).not.toHaveBeenCalled();
    expect(m.enroll).toHaveBeenCalledTimes(1);
  });

  it("does not retry-delete verified factors when the provider enroll call fails", async () => {
    m.listFactors.mockResolvedValue({ data: { factors: [{ id: "v1", status: "verified" }] }, error: null });
    m.enroll.mockResolvedValue({ data: null, error: { message: "AAL2 required" } });
    await expect(enrollMfa(tokenWithAal("aal2"))).rejects.toThrow("AAL2 required");
    expect(m.enroll).toHaveBeenCalledTimes(1);
    expect(m.deleteFactor).not.toHaveBeenCalled();
  });

  it("does not delete anything when enroll throws a network error", async () => {
    m.listFactors.mockResolvedValue({ data: { factors: [{ id: "v1", status: "verified" }] }, error: null });
    m.enroll.mockRejectedValue(new Error("network down"));
    await expect(enrollMfa(tokenWithAal("aal2"))).rejects.toThrow("network down");
    expect(m.deleteFactor).not.toHaveBeenCalled();
  });

  it("fails closed when the factor list cannot be read", async () => {
    m.listFactors.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(enrollMfa(tokenWithAal("aal1"))).rejects.toThrow();
    m.listFactors.mockRejectedValue(new Error("network down"));
    await expect(enrollMfa(tokenWithAal("aal1"))).rejects.toThrow();
    expect(m.deleteFactor).not.toHaveBeenCalled();
    expect(m.enroll).not.toHaveBeenCalled();
  });

  it("rejects an invalid session token", async () => {
    m.getUser.mockResolvedValue({ data: { user: null }, error: { message: "bad" } });
    await expect(enrollMfa("bad")).rejects.toThrow(/session/);
    expect(m.listFactors).not.toHaveBeenCalled();
  });
});
