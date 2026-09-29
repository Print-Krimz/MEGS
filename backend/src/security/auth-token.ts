import supabase from "../utils/supabase.js";

export interface VerifiedAccessToken {
  sub: string;
  email?: string;
  aal: "aal1" | "aal2";
}

interface ClaimsResult {
  data: null | {
    claims: Record<string, unknown>;
    header: Record<string, unknown>;
  };
  error: unknown;
}

interface ClaimsVerifier {
  getClaims: (token: string) => Promise<ClaimsResult>;
}

const DEFAULT_ALLOWED_ALGORITHMS = ["HS256", "RS256", "ES256"];
const CLOCK_SKEW_SECONDS = 30;

const readAllowedAlgorithms = (): Set<string> => {
  const configured = process.env.SUPABASE_JWT_ALGORITHMS
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(configured?.length ? configured : DEFAULT_ALLOWED_ALGORITHMS);
};

const expectedIssuer = (): string => {
  if (process.env.SUPABASE_JWT_ISSUER) {
    return process.env.SUPABASE_JWT_ISSUER.replace(/\/$/, "");
  }
  const projectUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  if (!projectUrl) throw new Error("SUPABASE_URL is required for token validation");
  return `${projectUrl}/auth/v1`;
};

const expectedAudiences = (): Set<string> =>
  new Set(
    (process.env.SUPABASE_JWT_AUDIENCE || "authenticated")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );

const parseJwtHeader = (token: string): Record<string, unknown> => {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new Error("Malformed access token");
  }
  return JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
};

const hasExpectedAudience = (audience: unknown): boolean => {
  const actual = Array.isArray(audience) ? audience : [audience];
  const expected = expectedAudiences();
  return actual.some((value) => typeof value === "string" && expected.has(value));
};

export const validateVerifiedClaims = (
  claims: Record<string, unknown>,
  header: Record<string, unknown>,
  nowSeconds = Math.floor(Date.now() / 1000)
): VerifiedAccessToken => {
  if (typeof header.alg !== "string" || !readAllowedAlgorithms().has(header.alg)) {
    throw new Error("Unsupported access-token algorithm");
  }
  if (header.typ !== undefined && header.typ !== "JWT") {
    throw new Error("Invalid access-token type");
  }
  if (typeof claims.sub !== "string" || !claims.sub.trim()) {
    throw new Error("Access token is missing a subject");
  }
  if (claims.iss !== expectedIssuer()) {
    throw new Error("Access token has an invalid issuer");
  }
  if (!hasExpectedAudience(claims.aud)) {
    throw new Error("Access token has an invalid audience");
  }
  if (typeof claims.exp !== "number" || claims.exp <= nowSeconds - CLOCK_SKEW_SECONDS) {
    throw new Error("Access token is expired or missing an expiry");
  }
  if (typeof claims.iat !== "number" || claims.iat > nowSeconds + CLOCK_SKEW_SECONDS) {
    throw new Error("Access token has an invalid issued-at time");
  }
  if (claims.nbf !== undefined) {
    if (typeof claims.nbf !== "number" || claims.nbf > nowSeconds + CLOCK_SKEW_SECONDS) {
      throw new Error("Access token has an invalid not-before time");
    }
  }
  if (claims.aal !== "aal1" && claims.aal !== "aal2") {
    throw new Error("Access token has an invalid assurance level");
  }

  return {
    sub: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
    aal: claims.aal,
  };
};

export const verifyAccessToken = async (
  token: string,
  verifier: ClaimsVerifier = supabase.auth as unknown as ClaimsVerifier
): Promise<VerifiedAccessToken> => {
  const untrustedHeader = parseJwtHeader(token);
  if (
    typeof untrustedHeader.alg !== "string" ||
    !readAllowedAlgorithms().has(untrustedHeader.alg)
  ) {
    throw new Error("Unsupported access-token algorithm");
  }

  const { data, error } = await verifier.getClaims(token);
  if (error || !data) throw new Error("Invalid or expired access token");
  return validateVerifiedClaims(data.claims, data.header);
};
