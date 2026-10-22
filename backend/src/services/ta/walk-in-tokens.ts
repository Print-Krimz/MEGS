// Tracking code and token helpers for walk-in slips and texted links.
// Kept free of database and Supabase imports so any service can use them.
import crypto from "node:crypto";
import type { ApplicationSource } from "@prisma/client";

export type WalkInSource = Exclude<ApplicationSource, "ONLINE">;

const CODE_PREFIX: Record<WalkInSource, string> = { WALK_IN: "WLK" };

export const buildTrackingCode = (source: WalkInSource, applicationId: number, year: number): string =>
  `${CODE_PREFIX[source]}-${year}-${String(applicationId).padStart(4, "0")}`;

export const hashToken = (token: string): string => crypto.createHash("sha256").update(token).digest("hex");

export const generateTrackingToken = (): { token: string; hash: string } => {
  const token = crypto.randomBytes(16).toString("base64url");
  return { token, hash: hashToken(token) };
};

export const tokenMatches = (token: string, hash: string | null | undefined): boolean => {
  if (!token || !hash) return false;
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
