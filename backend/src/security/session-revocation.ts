import { createHash } from "node:crypto";
import { sharedCommand, usesSharedStore } from "./shared-store.js";

const localRevocations = new Map<string, number>();
const tokenKey = (token: string): string => `megs:revoked:${createHash("sha256").update(token).digest("hex")}`;

export const revokeSession = async (token: string, expiresAt: number): Promise<void> => {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.max(1, Math.ceil(expiresAt - now + 30));
  if (usesSharedStore()) await sharedCommand("SET", tokenKey(token), "1", "EX", String(ttl));
  else if (process.env.NODE_ENV === "production") throw new Error("Shared session revocation is required");
  else {
    for (const [key, expiry] of localRevocations) if (expiry <= now) localRevocations.delete(key);
    localRevocations.set(tokenKey(token), now + ttl);
  }
};

export const isSessionRevoked = async (token: string): Promise<boolean> => {
  if (usesSharedStore()) return (await sharedCommand("EXISTS", tokenKey(token))) === 1;
  if (process.env.NODE_ENV === "production") throw new Error("Shared session revocation is required");
  const expiry = localRevocations.get(tokenKey(token));
  if (!expiry) return false;
  if (expiry <= Date.now() / 1000) { localRevocations.delete(tokenKey(token)); return false; }
  return true;
};
