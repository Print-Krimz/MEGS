import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/utils/supabase.js", () => ({
  default: { auth: { getClaims: vi.fn() } },
}));

import {
  validateVerifiedClaims,
  verifyAccessToken,
} from "../../src/security/auth-token.js";

const now = 2_000_000_000;
const validClaims = () => ({
  sub: "user-123",
  email: "user@example.com",
  iss: "https://project.supabase.co/auth/v1",
  aud: "authenticated",
  exp: now + 300,
  iat: now - 30,
  aal: "aal2",
});

const tokenWithAlgorithm = (alg: string): string =>
  `${Buffer.from(JSON.stringify({ alg, typ: "JWT" })).toString("base64url")}.payload.signature`;

describe("Supabase access-token validation", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_JWT_ALGORITHMS = "HS256,RS256,ES256";
    process.env.SUPABASE_JWT_AUDIENCE = "authenticated";
    delete process.env.SUPABASE_JWT_ISSUER;
  });

  it("accepts verified provider claims with the expected issuer and audience", () => {
    expect(validateVerifiedClaims(validClaims(), { alg: "RS256", typ: "JWT" }, now)).toEqual({
      sub: "user-123",
      email: "user@example.com",
      aal: "aal2",
      exp: now + 300,
    });
  });

  it.each([
    ["expired", { exp: now - 31 }],
    ["wrong issuer", { iss: "https://attacker.example/auth/v1" }],
    ["wrong audience", { aud: "service_role" }],
    ["future not-before", { nbf: now + 31 }],
    ["future issued-at", { iat: now + 31 }],
  ])("rejects %s claims", (_label, override) => {
    expect(() =>
      validateVerifiedClaims(
        { ...validClaims(), ...override },
        { alg: "RS256", typ: "JWT" },
        now
      )
    ).toThrow();
  });

  it.each(["none", "HS384", "RS512"])("rejects unsupported algorithm %s before provider lookup", async (alg) => {
    const getClaims = vi.fn();
    await expect(verifyAccessToken(tokenWithAlgorithm(alg), { getClaims })).rejects.toThrow(
      "Unsupported"
    );
    expect(getClaims).not.toHaveBeenCalled();
  });

  it("rejects a tampered token when the provider verifier rejects its signature", async () => {
    const getClaims = vi.fn().mockResolvedValue({ data: null, error: new Error("bad signature") });
    await expect(
      verifyAccessToken(tokenWithAlgorithm("RS256"), { getClaims })
    ).rejects.toThrow("Invalid or expired");
  });
});
