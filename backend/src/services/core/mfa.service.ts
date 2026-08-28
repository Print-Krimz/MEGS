import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import prisma from "../../utils/prisma.js";
import supabase from "../../utils/supabase.js";
import { logAudit } from "../../utils/audit.js";

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

export const enrollMfa = async (userToken: string, issuer: string = "MEGS Recruitment") => {
  const userClient = getUserSupabaseClient(userToken);

  // Clean up any unverified or conflicting factors using admin client
  const { data: userData } = await supabase.auth.getUser(userToken);
  if (userData?.user?.id) {
    const userId = userData.user.id;
    try {
      const { data: factorsData } = await supabase.auth.admin.mfa.listFactors({ userId });
      if (factorsData?.factors) {
        for (const factor of factorsData.factors) {
          if (factor.status === "unverified") {
            await supabase.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
          }
        }
      }
    } catch {
      // Non-blocking cleanup
    }
  }

  let { data, error } = await userClient.auth.mfa.enroll({
    factorType: "totp",
    issuer,
  });

  // If factor still conflicts, wipe unverified/stale factors and retry once
  if (error && userData?.user?.id) {
    const userId = userData.user.id;
    try {
      const { data: factorsData } = await supabase.auth.admin.mfa.listFactors({ userId });
      if (factorsData?.factors) {
        for (const factor of factorsData.factors) {
          await supabase.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
        }
      }
      const retry = await userClient.auth.mfa.enroll({
        factorType: "totp",
        issuer,
      });
      data = retry.data;
      error = retry.error;
    } catch {
      // Retain original error if retry fails
    }
  }

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

  // 3. Generate and store 8 emergency single-use backup recovery codes
  const { plainCodes, hashedCodes } = generateRecoveryCodes(8);

  // Delete previous recovery codes for this user
  await prisma.userMfaRecoveryCode.deleteMany({
    where: { userId },
  });

  // Insert newly generated recovery codes
  await prisma.userMfaRecoveryCode.createMany({
    data: hashedCodes.map((codeHash) => ({
      userId,
      codeHash,
      isUsed: false,
    })),
  });

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
    throw new Error("Invalid or already used recovery code");
  }

  // Mark code as used
  await prisma.userMfaRecoveryCode.update({
    where: { id: matchedCode.id },
    data: {
      isUsed: true,
      usedAt: new Date(),
    },
  });

  const remainingCodes = await prisma.userMfaRecoveryCode.count({
    where: {
      userId,
      isUsed: false,
    },
  });

  logAudit(userId, "MFA_RECOVERY_CODE_USED", "User", userId, { remainingCodes });

  return {
    valid: true,
    remainingCodes,
  };
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


