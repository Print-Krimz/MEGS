import { isIP } from "node:net";
type Environment = Record<string, string | undefined>;
const bypassFlags = ["DISABLE_CAPTCHA", "DISABLE_RATE_LIMIT", "DISABLE_OTP", "DISABLE_MFA"];

export const isLocalBypassEnabled = (flag: string, env: Environment = process.env): boolean =>
  (env.NODE_ENV === "development" || env.NODE_ENV === "test") && env[flag] === "true";

export const allowedOrigins = (env: Environment = process.env): Set<string> => {
  const configured = [env.FRONTEND_URL, ...(env.CORS_ALLOWED_ORIGINS || "").split(",")].filter(Boolean) as string[];
  if (env.NODE_ENV !== "production") configured.push("http://localhost:5173", "http://127.0.0.1:5173");
  const origins = new Set<string>();
  for (const value of configured) {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
      throw new Error("Frontend origins must be exact HTTP(S) origins without paths or credentials");
    }
    if (env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("Production frontend origins require HTTPS");
    origins.add(url.origin);
  }
  return origins;
};

export const proxyTrust = (env: Environment = process.env): false | number | string[] => {
  const value = env.TRUST_PROXY?.trim();
  if (!value || value === "false") return false;
  if (/^[1-9]\d?$/.test(value)) return Number(value);
  const addresses = value.split(",").map(item => item.trim());
  for (const item of addresses) {
    if (["loopback", "linklocal", "uniquelocal"].includes(item)) continue;
    const [address, prefix, extra] = item.split("/");
    const family = isIP(address || "");
    const bits = prefix === undefined ? (family === 4 ? 32 : 128) : Number(prefix);
    if (extra !== undefined || !family || prefix !== undefined && !/^\d+$/.test(prefix) || !Number.isInteger(bits) ||
      (family === 4 ? bits < 8 || bits > 32 : bits < 32 || bits > 128 || /ffff:|\./i.test(address!))) {
      throw new Error("TRUST_PROXY must describe trusted ingress addresses or a verified hop count");
    }
  }
  return addresses;
};

export const validateRuntimeSecurity = (env: Environment = process.env): void => {
  if (env.NODE_ENV && !["production", "development", "test"].includes(env.NODE_ENV)) throw new Error("NODE_ENV must be production, development or test");
  if (env.NODE_ENV === "production") {
    for (const flag of bypassFlags) if (env[flag] === "true") throw new Error(`${flag} cannot disable production security`);
    for (const key of ["OTP_SECRET", "BACKUP_ENCRYPTION_SECRET"]) {
      if ((env[key]?.trim().length || 0) < 32) throw new Error(`${key} requires an explicit dedicated secret of at least 32 characters`);
    }
    for (const key of ["FRONTEND_URL", "TRUST_PROXY", "REDIS_URL", "TURNSTILE_HOSTNAMES"]) {
      if (!env[key]?.trim()) throw new Error(`${key} must be explicitly configured in production`);
    }
    if (!(env.TURNSTILE_SECRET || env.TURNSTILE_SECRET_KEY)?.trim()) throw new Error("Turnstile secret must be explicitly configured in production");
    const redis = new URL(env.REDIS_URL!);
    if (!['redis:', 'rediss:'].includes(redis.protocol)) throw new Error("REDIS_URL must use Redis transport");
  }
  allowedOrigins(env);
  proxyTrust(env);
};
