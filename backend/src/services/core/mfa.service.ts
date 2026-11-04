import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import prisma from "../../utils/prisma.js";
import supabase from "../../utils/supabase.js";
import { logAudit } from "../../utils/audit.js";
import { generateSecureToken, hashToken } from "../../utils/otp.js";
import { notifySecurityEvent } from "./security-alert.service.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";

export const getUserSupabaseClient = (userToken: string) => {
  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    },
  });
};

export const normalizeRecoveryCode = (code: string): string => {
  return code.toUpperCase().replace(/[\s-]/g, "");
};

export const hashRecoveryCode = (code: string): string => {
  const normalized = normalizeRecoveryCode(code);
  return crypto.createHash("sha256").update(normalized).digest("hex");
};

export const verifyRecoveryCodeFormat = (code: string): boolean => {
  const normalized = normalizeRecoveryCode(code);
  return /^[A-Z0-9]{8}$/.test(normalized);
};

export const generateRecoveryCodes = (count: number = 8): { plainCodes: string[]; hashedCodes: string[] } => {
  const charset = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Base32 unambiguous charset
  const plainCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    let part1 = "";
    let part2 = "";
    const bytes1 = crypto.randomBytes(4);
    const bytes2 = crypto.randomBytes(4);
    for (let j = 0; j < 4; j++) {
      part1 += charset[bytes1[j] % charset.length];
      part2 += charset[bytes2[j] % charset.length];
    }
    const code = `${part1}-${part2}`;
    plainCodes.push(code);
    hashedCodes.push(hashRecoveryCode(code));
  }

  return { plainCodes, hashedCodes };
};

// Reads the aal claim of an access token already validated via supabase.auth.getUser.
const getTokenAal = (token: string): string | null => {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] || "", "base64url").toString("utf8"));
    return typeof payload.aal === "string" ? payload.aal : null;
  } catch {
    return null;
  }
};

export const enrollMfa = async (userToken: string, issuer: string = "MEGS Recruitment", changing = false) => {
  const userClient = getUserSupabaseClient(userToken);

  const { data: userData, error: userError } = await supabase.auth.getUser(userToken);
  const userId = userData?.user?.id;
  if (userError || !userId) {
    throw new Error("Invalid or expired session token");
  }

  // Fail closed: if the factor list cannot be read, do not enroll or delete anything.
  const { data: factorsData, error: listError } = await supabase.auth.admin.mfa.listFactors({ userId });
  if (listError || !factorsData) {
    throw new Error("Unable to verify existing multi-factor authentication");
  }
  const factors = factorsData.factors || [];

  // An already-protected account needs a verified AAL2 session to add another factor.
  if (factors.some((f) => f.status === "verified")) {
    if (!changing) throw new Error("Two-step verification is already set up. Use Settings to change your authenticator app.");
    if (getTokenAal(userToken) !== "aal2") throw new Error("Sign in with your current authenticator code, then try again.");
  }

  // A stale unverified-factor list cannot safely authorize deletion: a factor may be verified in the meantime.

  const { data, error } = await userClient.auth.mfa.enroll({
    factorType: "totp",
    issuer,
    friendlyName: `Authenticator ${crypto.randomUUID()}`,
  });

  if (error || !data) {
    throw new Error(error?.message || "Failed to enroll in MFA");
  }

  return {
    factorId: data.id,
    type: data.type,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
};



export const verifyMfaEnrollment = async (
  userToken: string,
  userId: string,
  factorId: string,
  code: string
) => {
  const { data: factors, error: listError } = await supabase.auth.admin.mfa.listFactors({ userId });
  if (listError || !factors) throw new Error("Unable to verify existing multi-factor authentication");
  if (factors.factors.some((factor) => factor.status === "verified")) {
    throw new Error("Two-step verification is already set up. Use Settings to change your authenticator app.");
  }
  const userClient = getUserSupabaseClient(userToken);

  // 1. Create a challenge
  const { data: challengeData, error: challengeError } = await userClient.auth.mfa.challenge({
    factorId,
  });

  if (challengeError || !challengeData) {
    throw new Error(challengeError?.message || "Failed to create MFA challenge");
  }

  // 2. Verify challenge with user supplied 6-digit TOTP code
  const { data: verifyData, error: verifyError } = await userClient.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code: code.trim(),
  });

  if (verifyError || !verifyData) {
    throw new Error(verifyError?.message || "Invalid verification code");
  }

  const plainCodes = await rotateRecoveryCodes(userId);

  logAudit(userId, "MFA_ENROLLED", "User", userId, { factorId });

  return {
    message: "MFA enrolled and verified successfully",
    recoveryCodes: plainCodes,
    session: {
      access_token: verifyData.access_token,
      refresh_token: verifyData.refresh_token,
      expires_in: verifyData.expires_in,
      user: verifyData.user,
    },
  };
};

const rotateRecoveryCodes = async (userId: string) => {
  const { plainCodes, hashedCodes } = generateRecoveryCodes(8);
  await prisma.$transaction(async (tx) => {
    await tx.userMfaRecoveryCode.deleteMany({ where: { userId } });
    await tx.userMfaRecoveryCode.createMany({ data: hashedCodes.map((codeHash) => ({ userId, codeHash, isUsed: false })) });
  });
  return plainCodes;
};

// shortcut: An AAL2 token holder can manage factors directly through GoTrue; blocking that requires an MFA hook.
// Factor IDs must never be reused. Grant IDs increase, and factor verification is restricted to
// first-time enrollment, already verified login factors, or an atomically claimed change grant.
// Each change records verified factors before its grant is inserted and deletes only those IDs
// after its own factor is verified. A later successful change cannot be in an earlier old set,
// so at least one verified factor remains in the absence of an explicit reset.
export const createMfaChangeGrant = async (userId: string, email: string) => {
  const { data, error } = await supabase.auth.admin.mfa.listFactors({ userId });
  if (error || !data) throw new Error("Something went wrong. Start again.");
  const old = data.factors.filter((factor) => factor.status === "verified");
  if (!old.length) throw new Error("Set up two-step verification at sign-in first.");
  const grant = generateSecureToken();
  const expiresAt = new Date(Date.now() + 600000);
  await prisma.$transaction(async (tx) => {
    await tx.authOtp.updateMany({ where: { email, purpose: "MFA_CHANGE_GRANT", isUsed: false }, data: { isUsed: true } });
    await tx.authOtp.create({ data: { email, purpose: "MFA_CHANGE_GRANT", otpHash: hashToken(grant), expiresAt } });
    await tx.authOtp.createMany({ data: old.map((factor) => ({ email, purpose: "MFA_CHANGE_OLD", otpHash: hashToken(`${grant}:old:${factor.id}`), expiresAt })) });
  });
  return { grant, expiresAt };
};

const getChangeGrant = async (email: string, hash: string) => {
  const row = await prisma.authOtp.findFirst({ where: { email, purpose: "MFA_CHANGE_GRANT", otpHash: hash, isUsed: false, expiresAt: { gt: new Date() } } });
  if (!row || row.attempts >= row.maxAttempts) throw new Error("This step timed out. Start again.");
  return row;
};

export const enrollMfaChange = async (token: string, userId: string, email: string, grant: string) => {
  const row = await getChangeGrant(email, hashToken(grant));
  if (getTokenAal(token) !== "aal2") throw new Error("Sign in with your current authenticator code, then try again.");
  const { data: factors, error: listError } = await supabase.auth.admin.mfa.listFactors({ userId });
  if (listError || !factors) throw new Error("Something went wrong. Start again.");
  if (!factors.factors.some((factor) => factor.status === "verified")) throw new Error("Set up two-step verification at sign-in first.");
  if (factors.factors.filter((factor) => factor.status === "unverified").length >= 5) throw new Error("Too many unfinished setups. Ask an administrator to reset two-step verification.");
  const { data, error } = await getUserSupabaseClient(token).auth.mfa.enroll({ factorType: "totp", issuer: "MEGS Recruitment", friendlyName: `Authenticator ${crypto.randomUUID()}` });
  if (error || !data) throw new Error("Something went wrong. Start again.");
  try {
    const bound = await prisma.authOtp.updateMany({ where: { id: row.id, otpHash: hashToken(grant), isUsed: false, expiresAt: { gt: new Date() } }, data: { otpHash: hashToken(`${grant}:${data.id}`) } });
    if (bound.count !== 1) throw new Error("This step timed out. Start again.");
  } catch (error) {
    await supabase.auth.admin.mfa.deleteFactor({ userId, id: data.id });
    throw error;
  }
  return { factorId: data.id, type: data.type, qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri };
};

export const isDefiniteRejection = (error: unknown): boolean => {
  const candidate = error as { status?: number; code?: string } | null;
  return (candidate?.status === 400 || candidate?.status === 422) && candidate.code === "mfa_verification_failed";
};

export const replaceMfaFactor = async (token: string, userId: string, email: string, grant: string, factorId: string, code: string) => {
  const row = await getChangeGrant(email, hashToken(`${grant}:${factorId}`));
  const claim = await prisma.authOtp.updateMany({ where: { id: row.id, isUsed: false, expiresAt: { gt: new Date() }, attempts: { lt: row.maxAttempts } }, data: { isUsed: true, attempts: { increment: 1 } } });
  if (claim.count !== 1) throw new Error("This step timed out. Start again.");
  const { data, error } = await supabase.auth.admin.mfa.listFactors({ userId });
  if (error || !data || !data.factors.some((f) => f.id === factorId && f.status === "unverified")) throw new Error("Authenticator setup is no longer available. Start again.");
  const client = getUserSupabaseClient(token);
  const challenge = await client.auth.mfa.challenge({ factorId });
  if (challenge.error || !challenge.data) throw new Error("Something went wrong. Start again.");
  const verified = await client.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
  if (!verified.data || verified.error) {
    if (isDefiniteRejection(verified.error)) {
      if (row.attempts + 1 < row.maxAttempts) await prisma.authOtp.updateMany({ where: { id: row.id, isUsed: true, attempts: row.attempts + 1, expiresAt: { gt: new Date() } }, data: { isUsed: false } });
      else await supabase.auth.admin.mfa.deleteFactor({ id: factorId, userId });
      throw new Error("Invalid authentication code");
    }
    throw new Error("Something went wrong. Start again.");
  }
  let oldRemoved = true;
  try {
    const fresh = await supabase.auth.admin.mfa.listFactors({ userId });
    if (fresh.error || !fresh.data) throw new Error("Unable to list factors");
    for (const factor of fresh.data.factors) {
      if (factor.id === factorId) continue;
      const old = await prisma.authOtp.findFirst({ where: { email, purpose: "MFA_CHANGE_OLD", otpHash: hashToken(`${grant}:old:${factor.id}`) } });
      if (!old) continue;
      const removed = await supabase.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
      if (removed.error) throw removed.error;
    }
  } catch { oldRemoved = false; }
  logAudit(userId, oldRemoved ? "MFA_CHANGED" : "MFA_CHANGE_INCOMPLETE", "User", userId, { factorId });
  void notifySecurityEvent({ userId }, "MFA_CHANGED").catch(console.error);
  return { oldRemoved, session: verified.data };
};

export const createMfaChallenge = async (userToken: string, factorId: string) => {
  const userClient = getUserSupabaseClient(userToken);
  const { data, error } = await userClient.auth.mfa.challenge({ factorId });

  if (error || !data) {
    throw new Error(error?.message || "Failed to create MFA challenge");
  }

  return {
    challengeId: data.id,
    expiresAt: data.expires_at,
  };
};

export const verifyMfaLogin = async (
  userToken: string,
  factorId: string,
  challengeId: string,
  code: string,
  userId: string
) => {
  const factors = await supabase.auth.admin.mfa.listFactors({ userId });
  if (factors.error || !factors.data?.factors.some((f) => f.id === factorId && f.status === "verified")) {
    logAudit(userId, "FAILED_MFA_ATTEMPT", "User", userId, { factorId, reason: "unverified_factor" });
    throw new Error("Invalid authentication code");
  }
  const userClient = getUserSupabaseClient(userToken);
  const { data, error } = await userClient.auth.mfa.verify({
    factorId,
    challengeId,
    code: code.trim(),
  });

  if (error || !data) {
    logAudit(userId, "FAILED_MFA_ATTEMPT", "User", userId, { factorId, reason: error?.message });
    throw new Error(error?.message || "Invalid authentication code");
  }

  logAudit(userId, "MFA_VERIFIED", "User", userId, { factorId });

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    user: data.user,
  };
};

export const verifyRecoveryCode = async (userId: string, plainRecoveryCode: string) => {
  const cleanCode = plainRecoveryCode.trim();
  if (!verifyRecoveryCodeFormat(cleanCode)) {
    throw new Error("Invalid recovery code format");
  }

  const targetHash = hashRecoveryCode(cleanCode);

  const matchedCode = await prisma.userMfaRecoveryCode.findFirst({
    where: {
      userId,
      codeHash: targetHash,
      isUsed: false,
    },
  });

  if (!matchedCode) {
    logAudit(userId, "FAILED_MFA_RECOVERY_ATTEMPT", "User", userId, {});
    void notifySecurityEvent({ userId }, "MFA_RECOVERY_FAILED").catch(console.error);
    throw new Error("Invalid or already used recovery code");
  }

  // Claim the code atomically so concurrent requests cannot reuse it.
  const consumed = await prisma.userMfaRecoveryCode.updateMany({
    where: { id: matchedCode.id, isUsed: false },
    data: {
      isUsed: true,
      usedAt: new Date(),
    },
  });

  if (consumed.count !== 1) {
    throw new Error("Invalid or already used recovery code");
  }

  const remainingCodes = await prisma.userMfaRecoveryCode.count({
    where: {
      userId,
      isUsed: false,
    },
  });

  logAudit(userId, "MFA_RECOVERY_CODE_USED", "User", userId, { remainingCodes });
  void notifySecurityEvent({ userId }, "MFA_RECOVERY_CODE_USED", { remainingCodes }).catch(console.error);

  return {
    valid: true,
    remainingCodes,
  };
};

export const resetMfaAfterRecovery = async (userId: string): Promise<void> => {
  const { data: factorsData, error } = await supabase.auth.admin.mfa.listFactors({ userId });
  if (error) throw new Error("Unable to reset multi-factor authentication");

  for (const factor of factorsData?.factors || []) {
    const { error: deleteError } = await supabase.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId,
    });
    if (deleteError) throw new Error("Unable to reset multi-factor authentication");
  }

  await prisma.userMfaRecoveryCode.deleteMany({ where: { userId } });
  logAudit(userId, "MFA_RECOVERY_REENROLLMENT_REQUIRED", "User", userId, {});
};

export const resetUserMfa = async (targetUserId: string, adminId: string) => {
  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) {
    throw new Error("Target user not found");
  }

  // Unenroll all factors via Supabase Admin
  const { data: factorsData, error: listError } = await supabase.auth.admin.mfa.listFactors({
    userId: targetUserId,
  });

  if (!listError && factorsData?.factors) {
    for (const factor of factorsData.factors) {
      await supabase.auth.admin.mfa.deleteFactor({
        id: factor.id,
        userId: targetUserId,
      });
    }
  }

  // Delete all recovery codes
  await prisma.userMfaRecoveryCode.deleteMany({
    where: { userId: targetUserId },
  });

  logAudit(adminId, "MFA_RESET_BY_ADMIN", "User", targetUserId, {
    targetEmail: targetUser.email,
  });
  void notifySecurityEvent({ userId: targetUserId }, "MFA_RESET_BY_ADMIN").catch(console.error);

  return {
    message: `Multi-Factor Authentication has been reset for ${targetUser.email}`,
  };
};

export const getUserMfaFactors = async (userToken: string) => {
  const userClient = getUserSupabaseClient(userToken);
  const { data, error } = await userClient.auth.mfa.listFactors();
  if (error) {
    return { isEnrolled: false, factors: [] };
  }

  const factors = (data.totp || (data as any).all || []) as any[];
  const verifiedTotp = factors.filter((f: any) => f.status === "verified");
  return {
    isEnrolled: verifiedTotp.length > 0,
    verifiedFactor: verifiedTotp[0] || null,
    allFactors: factors,
  };
};


