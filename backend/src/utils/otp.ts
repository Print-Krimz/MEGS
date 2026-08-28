import crypto from "crypto";

const OTP_SECRET = process.env.OTP_SECRET || "megs-otp-signing-salt-2026";

export const generateNumericOtp = (): string => {
  return crypto.randomInt(100000, 1000000).toString();
};

export const hashOtp = (otp: string): string => {
  return crypto.createHmac("sha256", OTP_SECRET).update(otp.trim()).digest("hex");
};

export const verifyOtpHash = (plainOtp: string, hashedOtp: string): boolean => {
  try {
    const computed = hashOtp(plainOtp);
    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(hashedOtp, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

export const generateSecureToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

export const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
};
