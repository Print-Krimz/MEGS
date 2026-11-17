import crypto from "node:crypto";
import "./env.js";

// A signed token in every job alert email lets the applicant stop alerts without logging in.
// It names one user and can only turn alerts OFF, so it is safe to put in a URL.
const secret = (): string => {
  const value = (process.env.JOB_ALERT_TOKEN_SECRET || process.env.OTP_SECRET || "").trim();
  if (value.length < 32) throw new Error("JOB_ALERT_TOKEN_SECRET (or OTP_SECRET) must be at least 32 characters");
  return value;
};

const sign = (userId: string): string =>
  crypto.createHmac("sha256", secret()).update(`job-alerts-unsubscribe:${userId}`).digest("base64url");

export const createUnsubscribeToken = (userId: string): string => `${userId}.${sign(userId)}`;

/** The user id inside a valid token, or null. */
export const verifyUnsubscribeToken = (token: string): string | null => {
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const userId = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(userId));
  return given.length === expected.length && crypto.timingSafeEqual(given, expected) ? userId : null;
};
