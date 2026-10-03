import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
vi.mock("../../src/utils/supabase.js", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return { default: createClient("https://signed-fixture.supabase.co", "synthetic-publishable-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }) };
});
import { verifyAccessToken } from "../../src/security/auth-token.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), alg: "RS256", use: "sig", kid: "test-key" };
function token(overrides: Record<string, unknown> = {}, algorithm = "RS256") {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: algorithm, typ: "JWT", kid: "test-key" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ sub: "11111111-1111-4111-8111-111111111111", email: "synthetic@example.test",
    iss: "https://signed-fixture.supabase.co/auth/v1", aud: "authenticated", exp: now + 300, iat: now - 30, aal: "aal2", ...overrides })).toString("base64url");
  return `${header}.${body}.${sign("RSA-SHA256", Buffer.from(`${header}.${body}`), privateKey).toString("base64url")}`;
}
describe("real signed fixtures through Supabase's supported verifier", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://signed-fixture.supabase.co";
    process.env.SUPABASE_JWT_ALGORITHMS = "RS256";
    process.env.SUPABASE_JWT_AUDIENCE = "authenticated";
    delete process.env.SUPABASE_JWT_ISSUER;
    vi.stubGlobal("fetch", vi.fn(async (url: unknown) => {
      if (!String(url).endsWith("/.well-known/jwks.json")) throw new Error("Unexpected provider network request in test");
      return new Response(JSON.stringify({ keys: [jwk] }), { status: 200, headers: { "content-type": "application/json" } });
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });
  it("accepts a valid locally signed staff session without external calls", async () => {
    expect(await verifyAccessToken(token())).toMatchObject({ aal: "aal2", sub: "11111111-1111-4111-8111-111111111111" });
  });
  it("rejects tampering without resigning", async () => {
    const parts = token().split(".");
    const claims = JSON.parse(Buffer.from(parts[1]!, "base64url").toString()); claims.sub = "attacker";
    parts[1] = Buffer.from(JSON.stringify(claims)).toString("base64url");
    await expect(verifyAccessToken(parts.join("."))).rejects.toThrow();
  });
  it.each([
    ["expired", () => ({ exp: Math.floor(Date.now() / 1000) - 100 })],
    ["issuer", () => ({ iss: "https://attacker.test/auth/v1" })],
    ["audience", () => ({ aud: "service_role" })],
    ["future time", () => ({ nbf: Math.floor(Date.now() / 1000) + 300 })],
  ])("rejects a valid signature with invalid %s claims", async (_name, override) => {
    await expect(verifyAccessToken(token(override()))).rejects.toThrow();
  });
  it("rejects unsigned and unsupported-algorithm headers", async () => {
    await expect(verifyAccessToken(token({}, "none"))).rejects.toThrow();
    await expect(verifyAccessToken(token({}, "HS512"))).rejects.toThrow();
  });
});
