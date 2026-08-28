import supabase from '../../utils/supabase.js';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import {
  sendMail,
  sendRegistrationOtpEmail,
  sendPasswordResetOtpEmail,
} from '../../utils/mailer.js';
import {
  generateNumericOtp,
  hashOtp,
  verifyOtpHash,
  generateSecureToken,
  hashToken,
} from '../../utils/otp.js';
import {
  getUserMfaFactors,
  createMfaChallenge,
} from './mfa.service.js';
import { maskEmail } from '../../utils/mask.js';
import { ensureApplicantProfile } from '../applicant/applicant.service.js';

export const registerUser = async (email: string, password: string) => {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const emailLower = email.toLowerCase().trim();

  const existingUser = await prisma.user.findUnique({ where: { email: emailLower } });
  if (existingUser && existingUser.accountStatus !== "PENDING_VERIFICATION") {
    throw new Error("An account with this email already exists");
  }

  let dbUserId: string;

  if (existingUser && existingUser.accountStatus === "PENDING_VERIFICATION") {
    // Update existing unverified user password in Supabase
    const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password,
    });
    if (updateError) {
      throw new Error(updateError.message || "Failed to update registration");
    }
    dbUserId = existingUser.id;
  } else {
    // Create new Supabase and Prisma User records
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: emailLower,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message ?? "Failed to create account");
    }

    const dbUser = await prisma.user.create({
      data: {
        id: authData.user.id,
        email: authData.user.email!,
        role: "APPLICANT",
        accountStatus: "PENDING_VERIFICATION",
        mustChangePassword: false,
      },
    });
    dbUserId = dbUser.id;
  }

  // Invalidate any older unused registration OTPs for this email
  await prisma.authOtp.updateMany({
    where: { email: emailLower, purpose: "REGISTRATION", isUsed: false },
    data: { isUsed: true },
  });

  // Generate 6-digit OTP and store hashed
  const plainOtp = generateNumericOtp();
  const otpHash = hashOtp(plainOtp);

  await prisma.authOtp.create({
    data: {
      email: emailLower,
      otpHash,
      purpose: "REGISTRATION",
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      isUsed: false,
    },
  });

  if (process.env.DISABLE_OTP === "true" || process.env.NODE_ENV === "development") {
    console.log(`🔑 [DEV OTP] REGISTRATION code for ${emailLower}: ${plainOtp} (or use master code: 000000)`);
  }

  await sendRegistrationOtpEmail(emailLower, plainOtp);

  logAudit(dbUserId, "USER_REGISTERED", "User", dbUserId, {
    email: emailLower,
    role: "APPLICANT",
    accountStatus: "PENDING_VERIFICATION",
  });

  return {
    id: dbUserId,
    email: emailLower,
    role: "APPLICANT",
    accountStatus: "PENDING_VERIFICATION",
    message: "A 6-digit verification code has been sent to your email.",
  };
};

export const verifyOtp = async (
  email: string,
  otp: string,
  purpose: "REGISTRATION" | "PASSWORD_RESET"
) => {
  const emailLower = email.toLowerCase().trim();
  const cleanOtp = otp.trim();

  if (!/^\d{6}$/.test(cleanOtp)) {
    throw new Error("Verification code must be exactly 6 numeric digits");
  }

  if (purpose !== "REGISTRATION" && purpose !== "PASSWORD_RESET") {
    throw new Error("Invalid verification purpose");
  }

  const activeOtp = await prisma.authOtp.findFirst({
    where: {
      email: emailLower,
      purpose,
      isUsed: false,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!activeOtp) {
    throw new Error("Invalid or expired verification code. Please request a new one.");
  }

  if (new Date(activeOtp.expiresAt).getTime() < Date.now()) {
    await prisma.authOtp.update({
      where: { id: activeOtp.id },
      data: { isUsed: true },
    });
    throw new Error("Verification code has expired. Please request a new one.");
  }

  if (activeOtp.attempts >= activeOtp.maxAttempts) {
    await prisma.authOtp.update({
      where: { id: activeOtp.id },
      data: { isUsed: true },
    });
    throw new Error("Maximum verification attempts exceeded. Please request a new code.");
  }

  // Increment attempts counter
  const updatedOtp = await prisma.authOtp.update({
    where: { id: activeOtp.id },
    data: { attempts: { increment: 1 } },
  });

  const isDevMasterOtp =
    (process.env.DISABLE_OTP === "true" || (process.env.NODE_ENV === "development" && !process.env.VITEST)) &&
    cleanOtp === "000000";

  const isMatch = isDevMasterOtp || verifyOtpHash(cleanOtp, activeOtp.otpHash);
  if (!isMatch) {
    const remaining = activeOtp.maxAttempts - updatedOtp.attempts;
    if (remaining <= 0) {
      await prisma.authOtp.update({
        where: { id: activeOtp.id },
        data: { isUsed: true },
      });
      throw new Error("Maximum verification attempts exceeded. Please request a new code.");
    }
    throw new Error(`Invalid verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`);
  }

  // Mark OTP as used (one-time use)
  await prisma.authOtp.update({
    where: { id: activeOtp.id },
    data: { isUsed: true },
  });

  if (purpose === "REGISTRATION") {
    const dbUser = await prisma.user.findUnique({ where: { email: emailLower } });
    if (!dbUser) {
      throw new Error("User account not found");
    }

    await prisma.user.update({
      where: { id: dbUser.id },
      data: { accountStatus: "ACTIVE" },
    });

    logAudit(dbUser.id, "USER_VERIFIED", "User", dbUser.id, { email: emailLower });

    return {
      message: "Email verified successfully. You can now log in to your account.",
    };
  }

  // Purpose: PASSWORD_RESET
  const dbUser = await prisma.user.findUnique({ where: { email: emailLower } });
  if (!dbUser || !dbUser.isActive || dbUser.accountStatus === "DEACTIVATED") {
    throw new Error("User account is invalid or deactivated.");
  }

  // Invalidate any previous unused reset sessions for this user
  await prisma.passwordResetSession.updateMany({
    where: { userId: dbUser.id, isUsed: false },
    data: { isUsed: true },
  });

  const rawResetToken = generateSecureToken();
  const tokenHash = hashToken(rawResetToken);

  await prisma.passwordResetSession.create({
    data: {
      userId: dbUser.id,
      email: dbUser.email,
      tokenHash,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      isUsed: false,
    },
  });

  logAudit(dbUser.id, "PASSWORD_RESET_OTP_VERIFIED", "User", dbUser.id, { email: emailLower });

  return {
    message: "Verification successful.",
    resetToken: rawResetToken,
  };
};

export const resendOtp = async (
  email: string,
  purpose: "REGISTRATION" | "PASSWORD_RESET"
) => {
  const emailLower = email.toLowerCase().trim();

  if (purpose !== "REGISTRATION" && purpose !== "PASSWORD_RESET") {
    throw new Error("Invalid verification purpose");
  }

  // Check 60-second cooldown from most recent OTP of this purpose
  const latestOtp = await prisma.authOtp.findFirst({
    where: { email: emailLower, purpose },
    orderBy: { createdAt: "desc" },
  });

  if (latestOtp) {
    const elapsed = Date.now() - new Date(latestOtp.createdAt).getTime();
    if (elapsed < 60000) {
      const remainingSeconds = Math.ceil((60000 - elapsed) / 1000);
      throw new Error(`Please wait ${remainingSeconds} seconds before requesting another code.`);
    }
  }

  if (purpose === "REGISTRATION") {
    const dbUser = await prisma.user.findUnique({ where: { email: emailLower } });
    if (!dbUser || dbUser.accountStatus !== "PENDING_VERIFICATION") {
      throw new Error("No pending registration found for this email address.");
    }
  } else {
    // Password reset anti-enumeration check
    const dbUser = await prisma.user.findUnique({ where: { email: emailLower } });
    if (!dbUser || !dbUser.isActive || dbUser.accountStatus === "DEACTIVATED") {
      return {
        message: "If an account exists for this email, a new verification code has been sent.",
      };
    }
  }

  // Invalidate older unused OTPs for this email and purpose
  await prisma.authOtp.updateMany({
    where: { email: emailLower, purpose, isUsed: false },
    data: { isUsed: true },
  });

  const plainOtp = generateNumericOtp();
  const otpHash = hashOtp(plainOtp);

  await prisma.authOtp.create({
    data: {
      email: emailLower,
      otpHash,
      purpose,
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      isUsed: false,
    },
  });

  if (process.env.DISABLE_OTP === "true" || process.env.NODE_ENV === "development") {
    console.log(`🔑 [DEV OTP] RESEND (${purpose}) code for ${emailLower}: ${plainOtp} (or use master code: 000000)`);
  }

  if (purpose === "REGISTRATION") {
    await sendRegistrationOtpEmail(emailLower, plainOtp);
  } else {
    await sendPasswordResetOtpEmail(emailLower, plainOtp);
  }

  return {
    message: "A new verification code has been sent to your email.",
  };
};

export const loginUser = async (email: string, password: string, ip?: string) => {
  const emailLower = email.toLowerCase().trim();
  const { data, error } = await supabase.auth.signInWithPassword({ email: emailLower, password });

  if (error || !data.session || !data.user) {
    logAudit(null, "FAILED_LOGIN_ATTEMPT", "User", null, {
      attemptedEmail: emailLower,
      reason: error?.message || "Invalid email or password",
      ip,
    });
    throw new Error("Invalid email or password");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: data.user.id },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      accountStatus: true,
      mustChangePassword: true,
    },
  });

  if (!dbUser) {
    logAudit(data.user.id, "FAILED_LOGIN_ATTEMPT", "User", data.user.id, {
      attemptedEmail: emailLower,
      reason: "User account not found in database",
      ip,
    });
    throw new Error("User account not found in database");
  }

  if (dbUser.accountStatus === "PENDING_VERIFICATION") {
    logAudit(dbUser.id, "FAILED_LOGIN_ATTEMPT", "User", dbUser.id, {
      attemptedEmail: emailLower,
      reason: "Account pending email verification",
      ip,
    });
    throw new Error("Please verify your email address with the 6-digit code sent to your inbox before signing in.");
  }

  if (!dbUser.isActive || dbUser.accountStatus === "DEACTIVATED") {
    logAudit(dbUser.id, "FAILED_LOGIN_ATTEMPT", "User", dbUser.id, {
      attemptedEmail: emailLower,
      reason: "Account has been deactivated",
      ip,
    });
    throw new Error("Account has been deactivated");
  }

  if (dbUser.accountStatus === "PENDING" || dbUser.accountStatus === "INVITED") {
    logAudit(dbUser.id, "FAILED_LOGIN_ATTEMPT", "User", dbUser.id, {
      attemptedEmail: emailLower,
      reason: "Account setup not completed",
      ip,
    });
    throw new Error("Your account setup is not yet complete. Please check your invitation email to finish setting up your account.");
  }

  // Staff MFA Enforcement (ADMINISTRATOR and TALENT_ACQUISITION)
  const isMfaDisabled = process.env.DISABLE_MFA === "true";
  if (!isMfaDisabled && (dbUser.role === "ADMINISTRATOR" || dbUser.role === "TALENT_ACQUISITION")) {
    const { isEnrolled, verifiedFactor } = await getUserMfaFactors(data.session.access_token);

    if (!isEnrolled || !verifiedFactor) {
      logAudit(dbUser.id, "MFA_SETUP_REQUIRED", "User", dbUser.id, { email: dbUser.email, role: dbUser.role });
      return {
        mfaSetupRequired: true,
        tempToken: data.session.access_token,
        user: {
          id: dbUser.id,
          email: dbUser.email,
          role: dbUser.role,
          accountStatus: dbUser.accountStatus,
          mustChangePassword: dbUser.mustChangePassword,
        },
      };
    }

    const challenge = await createMfaChallenge(data.session.access_token, verifiedFactor.id);
    logAudit(dbUser.id, "MFA_CHALLENGE_ISSUED", "User", dbUser.id, { email: dbUser.email, factorId: verifiedFactor.id });

    return {
      mfaRequired: true,
      factorId: verifiedFactor.id,
      challengeId: challenge.challengeId,
      tempToken: data.session.access_token,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        accountStatus: dbUser.accountStatus,
        mustChangePassword: dbUser.mustChangePassword,
      },
    };
  }

  if (dbUser.role === "APPLICANT") {
    try {
      await ensureApplicantProfile(dbUser.id);
    } catch {
      // advisory
    }
  }

  logAudit(dbUser.id, "USER_LOGGED_IN", "User", dbUser.id, { ip, email: dbUser.email, role: dbUser.role });

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
    user: {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      accountStatus: dbUser.accountStatus,
      mustChangePassword: dbUser.mustChangePassword,
    },
  };
};


export const logoutUser = async (token?: string, userId?: string) => {
  if (token) {
    try {
      const { data } = await supabase.auth.getUser(token);
      const effectiveUserId = userId || data?.user?.id;
      if (effectiveUserId) {
        logAudit(effectiveUserId, "USER_LOGGED_OUT", "User", effectiveUserId, {
          email: data?.user?.email,
        });
      }
      await supabase.auth.admin.signOut(token);
    } catch {
      if (userId) {
        logAudit(userId, "USER_LOGGED_OUT", "User", userId, {});
      }
    }
  } else if (userId) {
    logAudit(userId, "USER_LOGGED_OUT", "User", userId, {});
  }
};

export const requestPasswordReset = async (email: string) => {
  const GENERIC_RESPONSE = {
    message: "If an account exists for this email, a 6-digit verification code has been sent.",
  };

  const emailLower = email.toLowerCase().trim();

  try {
    const dbUser = await prisma.user.findUnique({ where: { email: emailLower } });
    if (!dbUser || !dbUser.isActive || dbUser.accountStatus === "DEACTIVATED") {
      return GENERIC_RESPONSE;
    }

    // Check 60s cooldown from last PASSWORD_RESET OTP
    const latestOtp = await prisma.authOtp.findFirst({
      where: { email: emailLower, purpose: "PASSWORD_RESET" },
      orderBy: { createdAt: "desc" },
    });

    if (latestOtp) {
      const elapsed = Date.now() - new Date(latestOtp.createdAt).getTime();
      if (elapsed < 60000) {
        const remainingSeconds = Math.ceil((60000 - elapsed) / 1000);
        throw new Error(`Please wait ${remainingSeconds} seconds before requesting another code.`);
      }
    }

    // Invalidate previous PASSWORD_RESET OTPs for this email
    await prisma.authOtp.updateMany({
      where: { email: emailLower, purpose: "PASSWORD_RESET", isUsed: false },
      data: { isUsed: true },
    });

    const plainOtp = generateNumericOtp();
    const otpHash = hashOtp(plainOtp);

    await prisma.authOtp.create({
      data: {
        email: emailLower,
        otpHash,
        purpose: "PASSWORD_RESET",
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        isUsed: false,
      },
    });

    if (process.env.DISABLE_OTP === "true" || process.env.NODE_ENV === "development") {
      console.log(`🔑 [DEV OTP] PASSWORD_RESET code for ${emailLower}: ${plainOtp} (or use master code: 000000)`);
    }

    try {
      await sendPasswordResetOtpEmail(emailLower, plainOtp);
      logAudit(dbUser.id, "PASSWORD_RESET_REQUESTED", "User", dbUser.id, { email: emailLower });
    } catch (mailError) {
      console.error("[Auth] Failed to send password reset OTP email:", mailError);
      throw new Error("Failed to deliver the verification email. Please try again later.");
    }

    return GENERIC_RESPONSE;
  } catch (err: any) {
    if (err.message.includes("Please wait") || err.message.includes("Failed to deliver")) {
      throw err;
    }
    console.error("[Auth] Error in requestPasswordReset:", err);
    return GENERIC_RESPONSE;
  }
};

export const resetUserPassword = async (token: string, newPassword: string) => {
  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }

  const tokenHash = hashToken(token);

  const session = await prisma.passwordResetSession.findFirst({
    where: {
      tokenHash,
      isUsed: false,
    },
  });

  if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
    if (session) {
      await prisma.passwordResetSession.update({
        where: { id: session.id },
        data: { isUsed: true },
      });
    }
    throw new Error("Invalid or expired password reset session");
  }

  const userId = session.userId;

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateError) {
    throw new Error(updateError.message || "Failed to update password");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      mustChangePassword: false,
      accountStatus: "ACTIVE",
    },
  });

  // Mark reset session as used (single use)
  await prisma.passwordResetSession.update({
    where: { id: session.id },
    data: { isUsed: true },
  });

  logAudit(userId, "PASSWORD_RESET_COMPLETED", "User", userId, {});

  return { message: "Password has been reset successfully. You can now log in." };
};

export const changeUserPassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
) => {
  if (newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters long");
  }

  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!dbUser) {
    throw new Error("User account not found");
  }

  // Verify current password with Supabase
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: dbUser.email,
    password: currentPassword,
  });

  if (signInError) {
    throw new Error("Current password is incorrect");
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateError) {
    throw new Error(updateError.message || "Failed to update password");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { mustChangePassword: false },
  });

  logAudit(userId, "PASSWORD_CHANGED", "User", userId, {});

  return { message: "Password changed successfully" };
};

export const getInvitationDetails = async (rawToken: string) => {
  if (!rawToken || typeof rawToken !== "string" || !rawToken.trim()) {
    throw new Error("Invalid, used, or expired invitation token");
  }

  const tokenHash = hashToken(rawToken.trim());

  const invitation = await prisma.userInvitation.findFirst({
    where: {
      tokenHash,
      isUsed: false,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          accountStatus: true,
          isActive: true,
        },
      },
    },
  });

  if (!invitation || !invitation.user) {
    throw new Error("Invalid, used, or expired invitation token");
  }

  if (new Date(invitation.expiresAt).getTime() < Date.now()) {
    // Mark as used/expired
    await prisma.userInvitation.update({
      where: { id: invitation.id },
      data: { isUsed: true },
    });
    throw new Error("This invitation has expired. Please ask your administrator to resend an invitation.");
  }

  if (invitation.user.accountStatus !== "PENDING" && invitation.user.accountStatus !== "INVITED") {
    throw new Error("This account has already completed setup or is not in a pending invitation state.");
  }

  return {
    valid: true,
    email: invitation.email,
    maskedEmail: maskEmail(invitation.email),
    role: invitation.user.role,
    expiresAt: invitation.expiresAt,
  };
};

export const setupAccount = async (token: string, newPassword: string) => {
  if (!token || typeof token !== "string" || !token.trim()) {
    throw new Error("Invalid or expired setup token");
  }

  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }

  const tokenHash = hashToken(token.trim());

  const invitation = await prisma.userInvitation.findFirst({
    where: {
      tokenHash,
      isUsed: false,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          accountStatus: true,
          isActive: true,
        },
      },
    },
  });

  if (!invitation || !invitation.user) {
    throw new Error("Invalid or expired setup token");
  }

  if (new Date(invitation.expiresAt).getTime() < Date.now()) {
    await prisma.userInvitation.update({
      where: { id: invitation.id },
      data: { isUsed: true },
    });
    throw new Error("This invitation has expired. Please ask your administrator to resend an invitation.");
  }

  const dbUser = invitation.user;

  if (dbUser.accountStatus !== "PENDING" && dbUser.accountStatus !== "INVITED") {
    throw new Error("Account has already been activated or is not in a pending invitation status");
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(dbUser.id, {
    password: newPassword,
    email_confirm: true,
  });

  if (updateError) {
    throw new Error(updateError.message || "Failed to set password");
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    await tx.userInvitation.update({
      where: { id: invitation.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

    return await tx.user.update({
      where: { id: dbUser.id },
      data: {
        accountStatus: "ACTIVE",
        mustChangePassword: false,
      },
      select: {
        id: true,
        email: true,
        role: true,
        accountStatus: true,
      },
    });
  });

  logAudit(dbUser.id, "TA_ACCOUNT_ACTIVATED", "User", dbUser.id, {
    email: dbUser.email,
    role: updatedUser.role,
  });

  let tempToken: string | null = null;
  try {
    const signInRes = await supabase.auth.signInWithPassword({
      email: dbUser.email,
      password: newPassword,
    });
    tempToken = signInRes?.data?.session?.access_token || null;
  } catch {
    tempToken = null;
  }

  return {
    message: "Account setup completed successfully.",
    user: updatedUser,
    tempToken,
  };
};




