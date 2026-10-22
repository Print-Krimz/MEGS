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
import {
  isPhilippinePhone,
  normalizeToE164,
  toSyntheticEmail,
  isSyntheticEmail,
  isPhoneSyntheticEmail,
  fromSyntheticEmail,
  sendSmsViaTextBee,
  maskPhoneNumber,
} from '../../utils/sms.js';
import { ensureApplicantProfile } from '../applicant/applicant.service.js';
import { isActiveAccount, isMfaEnforced } from '../../security/auth-policy.js';
import { getSecurityControls } from '../../security/security-controls.js';
import { safeLogError } from '../../security/errors.js';

interface ResolvedAuthIdentifier {
  raw: string;
  isPhone: boolean;
  phoneE164: string | null;
  syntheticEmail: string | null;
  email: string;
}

const resolveAuthIdentifier = (identifier: string): ResolvedAuthIdentifier => {
  const clean = identifier.trim();
  if (isPhilippinePhone(clean)) {
    const phoneE164 = normalizeToE164(clean);
    const syntheticEmail = toSyntheticEmail(phoneE164);
    return {
      raw: clean,
      isPhone: true,
      phoneE164,
      syntheticEmail,
      email: syntheticEmail,
    };
  }

  if (isPhoneSyntheticEmail(clean)) {
    const phoneE164 = fromSyntheticEmail(clean);
    return {
      raw: clean,
      isPhone: true,
      phoneE164,
      syntheticEmail: clean.toLowerCase(),
      email: clean.toLowerCase(),
    };
  }

  return {
    raw: clean,
    isPhone: false,
    phoneE164: null,
    syntheticEmail: null,
    email: clean.toLowerCase(),
  };
};

const findUserByIdentifier = async (resolved: ResolvedAuthIdentifier) => {
  if (resolved.isPhone && resolved.phoneE164) {
    const userByPhone = await prisma.user.findUnique({
      where: { phoneNumber: resolved.phoneE164 },
    });
    if (userByPhone) return userByPhone;
  }
  return prisma.user.findUnique({
    where: { email: resolved.email },
  });
};

/** A walk-in profile already owns this phone: the applicant should claim it instead of registering. */
export class ClaimableAccountError extends Error {
  readonly code = "ACCOUNT_CLAIMABLE";
  constructor() {
    super("An account was already set up for this mobile number at a MEGS office. Claim it to sign in.");
    this.name = "ClaimableAccountError";
  }
}

/** Claim-flow failure carrying the HTTP status the controller should answer with. */
export class ClaimError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ClaimError";
  }
}

const isOtpTestBypassEnabled = async (): Promise<boolean> =>
  (await getSecurityControls()).otpDisabled;

export const registerUser = async (emailOrPhone: string, password: string) => {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const resolved = resolveAuthIdentifier(emailOrPhone);

  const existingUser = await findUserByIdentifier(resolved);

  if (existingUser?.accountStatus === "WALK_IN") {
    throw new ClaimableAccountError();
  }

  if (existingUser && existingUser.accountStatus !== "PENDING_VERIFICATION") {
    throw new Error(
      resolved.isPhone
        ? "An account with this mobile number already exists"
        : "An account with this email already exists"
    );
  }

  let dbUserId: string;

  if (existingUser && existingUser.accountStatus === "PENDING_VERIFICATION") {
    // A pending registration keeps its original password and profile. Re-registering only resends the code,
    // under the same 60-second cooldown that resendOtp applies.
    const latestOtp = await prisma.authOtp.findFirst({
      where: { email: resolved.email, purpose: "REGISTRATION" },
      orderBy: { createdAt: "desc" },
    });
    if (latestOtp && !(await getSecurityControls()).rateLimitDisabled) {
      const elapsed = Date.now() - new Date(latestOtp.createdAt).getTime();
      if (elapsed < 60000) {
        const remainingSeconds = Math.ceil((60000 - elapsed) / 1000);
        throw new Error(`Please wait ${remainingSeconds} seconds before requesting another code.`);
      }
    }
    dbUserId = existingUser.id;
  } else {
    // Create new Supabase and Prisma User records
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: resolved.email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      throw new Error("Failed to create account. Please try again later.");
    }

    const dbUser = await prisma.user.create({
      data: {
        id: authData.user.id,
        email: authData.user.email!,
        phoneNumber: resolved.phoneE164,
        role: "APPLICANT",
        accountStatus: "PENDING_VERIFICATION",
        mustChangePassword: false,
      },
    });
    dbUserId = dbUser.id;

    if (resolved.isPhone && resolved.phoneE164) {
      await prisma.applicantProfile.upsert({
        where: { userId: dbUserId },
        create: {
          userId: dbUserId,
          firstName: "",
          lastName: "",
          mobileNumber: resolved.phoneE164,
        },
        update: {
          mobileNumber: resolved.phoneE164,
        },
      });
    }
  }

  // Invalidate any older unused registration OTPs for this identifier
  await prisma.authOtp.updateMany({
    where: { email: resolved.email, purpose: "REGISTRATION", isUsed: false },
    data: { isUsed: true },
  });

  // Generate 6-digit OTP and store hashed
  const plainOtp = generateNumericOtp();
  const otpHash = hashOtp(plainOtp);

  await prisma.authOtp.create({
    data: {
      email: resolved.email,
      otpHash,
      purpose: "REGISTRATION",
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      isUsed: false,
    },
  });

  if (resolved.isPhone && resolved.phoneE164) {
    if (await isOtpTestBypassEnabled() || process.env.NODE_ENV === "development") {
      console.log(`📱 [DEV OTP] REGISTRATION SMS code generated for ${maskPhoneNumber(resolved.phoneE164)}: ${plainOtp}`);
    }
    const smsMessage = `Your MEGS verification code is ${plainOtp}. Valid for 10 minutes.`;
    await sendSmsViaTextBee(resolved.phoneE164, smsMessage);
  } else {
    if (await isOtpTestBypassEnabled() || process.env.NODE_ENV === "development") {
      console.log(`🔑 [DEV OTP] REGISTRATION code generated for ${maskEmail(resolved.email)}.`);
    }
    await sendRegistrationOtpEmail(resolved.email, plainOtp);
  }

  logAudit(dbUserId, "USER_REGISTERED", "User", dbUserId, {
    email: resolved.email,
    phoneNumber: resolved.phoneE164,
    role: "APPLICANT",
    accountStatus: "PENDING_VERIFICATION",
  });

  return {
    id: dbUserId,
    email: resolved.email,
    role: "APPLICANT",
    accountStatus: "PENDING_VERIFICATION",
    message: resolved.isPhone
      ? "A 6-digit verification code has been sent to your mobile number via SMS."
      : "A 6-digit verification code has been sent to your email.",
  };
};

export const verifyOtp = async (
  emailOrPhone: string,
  otp: string,
  purpose: "REGISTRATION" | "PASSWORD_RESET"
) => {
  const resolved = resolveAuthIdentifier(emailOrPhone);
  const cleanOtp = otp.trim();

  if (!/^\d{6}$/.test(cleanOtp)) {
    throw new Error("Verification code must be exactly 6 numeric digits");
  }

  if (purpose !== "REGISTRATION" && purpose !== "PASSWORD_RESET") {
    throw new Error("Invalid verification purpose");
  }

  const dbUser = await findUserByIdentifier(resolved);

  const canonicalEmail = dbUser?.email || resolved.email;

  const activeOtp = await prisma.authOtp.findFirst({
    where: {
      email: canonicalEmail,
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

  // DISABLE_OTP skips code comparison only for registration, and never in production.
  const isDevMasterOtp = purpose === "REGISTRATION" &&
    process.env.NODE_ENV !== "production" &&
    (await isOtpTestBypassEnabled());
  if (!isDevMasterOtp && activeOtp.attempts >= activeOtp.maxAttempts) {
    await prisma.authOtp.update({
      where: { id: activeOtp.id },
      data: { isUsed: true },
    });
    throw new Error("Maximum verification attempts exceeded. Please request a new code.");
  }

  // Reserve an attempt atomically; simultaneous requests cannot exceed the budget.
  const attempt = isDevMasterOtp ? { count: 1 } : await prisma.authOtp.updateMany({
    where: {
      id: activeOtp.id,
      isUsed: false,
      expiresAt: { gt: new Date() },
      attempts: { lt: activeOtp.maxAttempts },
    },
    data: { attempts: { increment: 1 } },
  });
  if (attempt.count !== 1) {
    throw new Error("Invalid or expired verification code. Please request a new one.");
  }

  const isMatch = isDevMasterOtp || verifyOtpHash(cleanOtp, activeOtp.otpHash);
  if (!isMatch) {
    const updatedOtp = await prisma.authOtp.findUnique({ where: { id: activeOtp.id } });
    const remaining = Math.max(0, activeOtp.maxAttempts - (updatedOtp?.attempts ?? (activeOtp.attempts + 1)));
    if (remaining <= 0) {
      await prisma.authOtp.update({
        where: { id: activeOtp.id },
        data: { isUsed: true },
      });
      throw new Error("Maximum verification attempts exceeded. Please request a new code.");
    }
    throw new Error(`Invalid verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`);
  }

  if (!dbUser || !dbUser.isActive ||
      (purpose === "REGISTRATION" ? dbUser.accountStatus !== "PENDING_VERIFICATION" :
        !isActiveAccount(dbUser.isActive, dbUser.accountStatus))) {
    throw new Error("User account is invalid or deactivated.");
  }

  // Claim before activating an account or issuing a password reset session.
  const consumed = await prisma.authOtp.updateMany({
    where: { id: activeOtp.id, isUsed: false, expiresAt: { gt: new Date() } },
    data: { isUsed: true },
  });
  if (consumed.count !== 1) {
    throw new Error("Invalid or expired verification code. Please request a new one.");
  }

  if (purpose === "REGISTRATION") {
    const activated = await prisma.user.updateMany({
      where: { id: dbUser.id, isActive: true, accountStatus: "PENDING_VERIFICATION" },
      data: { accountStatus: "ACTIVE" },
    });
    if (activated.count !== 1) throw new Error("User account is invalid or deactivated.");

    if (resolved.isPhone && (dbUser.phoneNumber || resolved.phoneE164)) {
      const phoneToSave = dbUser.phoneNumber || resolved.phoneE164!;
      await prisma.applicantProfile.upsert({
        where: { userId: dbUser.id },
        create: {
          userId: dbUser.id,
          firstName: "",
          lastName: "",
          mobileNumber: phoneToSave,
        },
        update: {
          mobileNumber: phoneToSave,
        },
      });
    }

    logAudit(dbUser.id, "USER_VERIFIED", "User", dbUser.id, { email: canonicalEmail });

    return {
      message: resolved.isPhone
        ? "Mobile number verified successfully. You can now log in to your account."
        : "Email verified successfully. You can now log in to your account.",
    };
  }

  // Purpose: PASSWORD_RESET
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

  logAudit(dbUser.id, "PASSWORD_RESET_OTP_VERIFIED", "User", dbUser.id, { email: canonicalEmail });

  return {
    message: "Verification successful.",
    resetToken: rawResetToken,
  };
};

export const resendOtp = async (
  emailOrPhone: string,
  purpose: "REGISTRATION" | "PASSWORD_RESET"
) => {
  const resolved = resolveAuthIdentifier(emailOrPhone);

  if (purpose !== "REGISTRATION" && purpose !== "PASSWORD_RESET") {
    throw new Error("Invalid verification purpose");
  }

  const dbUser = await findUserByIdentifier(resolved);

  const canonicalEmail = dbUser?.email || resolved.email;

  // Check 60-second cooldown from most recent OTP of this purpose
  const latestOtp = await prisma.authOtp.findFirst({
    where: { email: canonicalEmail, purpose },
    orderBy: { createdAt: "desc" },
  });

  if (latestOtp && !(await getSecurityControls()).rateLimitDisabled) {
    const elapsed = Date.now() - new Date(latestOtp.createdAt).getTime();
    if (elapsed < 60000) {
      const remainingSeconds = Math.ceil((60000 - elapsed) / 1000);
      throw new Error(`Please wait ${remainingSeconds} seconds before requesting another code.`);
    }
  }

  if (purpose === "REGISTRATION") {
    if (!dbUser || dbUser.accountStatus !== "PENDING_VERIFICATION") {
      throw new Error(
        resolved.isPhone
          ? "No pending registration found for this mobile number."
          : "No pending registration found for this email address."
      );
    }
  } else {
    // Password reset anti-enumeration check
    if (!dbUser || !isActiveAccount(dbUser.isActive, dbUser.accountStatus)) {
      return {
        message: resolved.isPhone
          ? "If an account exists for this mobile number, a new verification code has been sent via SMS."
          : "If an account exists for this email, a new verification code has been sent.",
      };
    }
  }

  // Invalidate older unused OTPs for this email and purpose
  await prisma.authOtp.updateMany({
    where: { email: canonicalEmail, purpose, isUsed: false },
    data: { isUsed: true },
  });

  const plainOtp = generateNumericOtp();
  const otpHash = hashOtp(plainOtp);

  await prisma.authOtp.create({
    data: {
      email: canonicalEmail,
      otpHash,
      purpose,
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      isUsed: false,
    },
  });

  if (resolved.isPhone && (dbUser?.phoneNumber || resolved.phoneE164)) {
    const phoneToSend = dbUser?.phoneNumber || resolved.phoneE164!;
    if (await isOtpTestBypassEnabled() || process.env.NODE_ENV === "development") {
      console.log(`📱 [DEV OTP] RESEND (${purpose}) SMS code generated for ${maskPhoneNumber(phoneToSend)}: ${plainOtp}`);
    }
    const prefix = purpose === "REGISTRATION" ? "verification" : "password reset";
    await sendSmsViaTextBee(phoneToSend, `Your MEGS ${prefix} code is ${plainOtp}. Valid for 10 minutes.`);
  } else {
    if (await isOtpTestBypassEnabled() || process.env.NODE_ENV === "development") {
      console.log(`🔑 [DEV OTP] RESEND (${purpose}) code generated for ${maskEmail(canonicalEmail)}.`);
    }
    if (purpose === "REGISTRATION") {
      await sendRegistrationOtpEmail(canonicalEmail, plainOtp);
    } else {
      await sendPasswordResetOtpEmail(canonicalEmail, plainOtp);
    }
  }

  return {
    message: resolved.isPhone
      ? "A new verification code has been sent to your mobile number via SMS."
      : "A new verification code has been sent to your email.",
  };
};

export const loginUser = async (emailOrPhone: string, password: string, ip?: string) => {
  const resolved = resolveAuthIdentifier(emailOrPhone);
  let targetEmail = resolved.email;

  if (resolved.isPhone && resolved.phoneE164) {
    const userByPhone = await findUserByIdentifier(resolved);
    if (userByPhone) {
      targetEmail = userByPhone.email;
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email: targetEmail, password });

  if (error || !data.session || !data.user) {
    logAudit(null, "FAILED_LOGIN_ATTEMPT", "User", null, {
      attemptedEmail: targetEmail,
      reason: "Invalid email or password",
      ip,
    });
    throw new Error("Invalid email or password");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: data.user.id },
    select: {
      id: true,
      email: true,
      phoneNumber: true,
      role: true,
      isActive: true,
      accountStatus: true,
      mustChangePassword: true,
    },
  });

  if (!dbUser) {
    logAudit(data.user.id, "FAILED_LOGIN_ATTEMPT", "User", data.user.id, {
      attemptedEmail: targetEmail,
      reason: "User account not found in database",
      ip,
    });
    throw new Error("User account not found in database");
  }

  if (dbUser.accountStatus === "PENDING_VERIFICATION") {
    logAudit(dbUser.id, "FAILED_LOGIN_ATTEMPT", "User", dbUser.id, {
      attemptedEmail: targetEmail,
      reason: "Account pending verification",
      ip,
    });
    throw new Error(
      resolved.isPhone
        ? "Please verify your mobile number with the 6-digit code sent via SMS before signing in."
        : "Please verify your email address with the 6-digit code sent to your inbox before signing in."
    );
  }

  if (!dbUser.isActive || dbUser.accountStatus === "DEACTIVATED") {
    logAudit(dbUser.id, "FAILED_LOGIN_ATTEMPT", "User", dbUser.id, {
      attemptedEmail: targetEmail,
      reason: "Account has been deactivated",
      ip,
    });
    throw new Error("Account has been deactivated");
  }

  if (dbUser.accountStatus === "PENDING" || dbUser.accountStatus === "INVITED") {
    logAudit(dbUser.id, "FAILED_LOGIN_ATTEMPT", "User", dbUser.id, {
      attemptedEmail: targetEmail,
      reason: "Account setup not completed",
      ip,
    });
    throw new Error("Your account setup is not yet complete. Please check your invitation email to finish setting up your account.");
  }

  // Staff MFA Enforcement (ADMINISTRATOR and TALENT_ACQUISITION)
  if ((dbUser.role === "ADMINISTRATOR" || dbUser.role === "TALENT_ACQUISITION") && await isMfaEnforced()) {
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
      phoneNumber: dbUser.phoneNumber,
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

export const requestPasswordReset = async (emailOrPhone: string) => {
  const resolved = resolveAuthIdentifier(emailOrPhone);
  const GENERIC_RESPONSE = {
    message: resolved.isPhone
      ? "If an account exists for this mobile number, a 6-digit verification code has been sent via SMS."
      : "If an account exists for this email, a 6-digit verification code has been sent.",
  };

  try {
    const dbUser = await findUserByIdentifier(resolved);

    if (!dbUser || !isActiveAccount(dbUser.isActive, dbUser.accountStatus)) {
      return GENERIC_RESPONSE;
    }

    const canonicalEmail = dbUser.email;

    // Check 60s cooldown from last PASSWORD_RESET OTP
    const latestOtp = await prisma.authOtp.findFirst({
      where: { email: canonicalEmail, purpose: "PASSWORD_RESET" },
      orderBy: { createdAt: "desc" },
    });

    if (latestOtp && !(await getSecurityControls()).rateLimitDisabled) {
      const elapsed = Date.now() - new Date(latestOtp.createdAt).getTime();
      if (elapsed < 60000) {
        const remainingSeconds = Math.ceil((60000 - elapsed) / 1000);
        throw new Error(`Please wait ${remainingSeconds} seconds before requesting another code.`);
      }
    }

    // Invalidate previous PASSWORD_RESET OTPs for this email
    await prisma.authOtp.updateMany({
      where: { email: canonicalEmail, purpose: "PASSWORD_RESET", isUsed: false },
      data: { isUsed: true },
    });

    const plainOtp = generateNumericOtp();
    const otpHash = hashOtp(plainOtp);

    await prisma.authOtp.create({
      data: {
        email: canonicalEmail,
        otpHash,
        purpose: "PASSWORD_RESET",
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        isUsed: false,
      },
    });

    if (resolved.isPhone && (dbUser.phoneNumber || resolved.phoneE164)) {
      const phoneToSend = dbUser.phoneNumber || resolved.phoneE164!;
      if (await isOtpTestBypassEnabled() || process.env.NODE_ENV === "development") {
        console.log(`📱 [DEV OTP] PASSWORD_RESET SMS code generated for ${maskPhoneNumber(phoneToSend)}: ${plainOtp}`);
      }
      await sendSmsViaTextBee(phoneToSend, `Your MEGS password reset code is ${plainOtp}. Valid for 10 minutes.`);
      logAudit(dbUser.id, "PASSWORD_RESET_REQUESTED", "User", dbUser.id, { phone: phoneToSend });
    } else {
      if (await isOtpTestBypassEnabled() || process.env.NODE_ENV === "development") {
        console.log(`🔑 [DEV OTP] PASSWORD_RESET code generated for ${maskEmail(canonicalEmail)}.`);
      }
      try {
        await sendPasswordResetOtpEmail(canonicalEmail, plainOtp);
        logAudit(dbUser.id, "PASSWORD_RESET_REQUESTED", "User", dbUser.id, { email: canonicalEmail });
      } catch (mailError: any) {
        safeLogError("Auth password reset email", mailError);
        throw new Error("Failed to deliver the verification email. Please try again later.");
      }
    }

    return GENERIC_RESPONSE;
  } catch (err: any) {
    if (typeof err?.message === "string" &&
        (/^Please wait \d+ seconds before requesting another code\.$/.test(err.message) ||
          err.message === "Failed to deliver the verification email. Please try again later.")) {
      throw err;
    }
    safeLogError("Auth password reset request", err);
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

  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
    throw new Error("Invalid or expired password reset session");
  }

  const userId = session.userId;
  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!dbUser || !isActiveAccount(dbUser.isActive, dbUser.accountStatus)) {
    throw new Error("User account is invalid or deactivated.");
  }

  const consumed = await prisma.passwordResetSession.updateMany({
    where: { id: session.id, tokenHash, isUsed: false, expiresAt: { gt: new Date() } },
    data: { isUsed: true },
  });
  if (consumed.count !== 1) throw new Error("Invalid or expired password reset session");

  // Never reopen this session: a failed response can still mean the provider changed
  // the password. Recovery after a provider/local failure requires a new OTP/session.
  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateError) {
    throw new Error("Failed to update password. Please request a new reset code.");
  }

  const updated = await prisma.user.updateMany({
    where: { id: userId, isActive: true, accountStatus: "ACTIVE" },
    data: {
      mustChangePassword: false,
    },
  });
  if (updated.count !== 1) throw new Error("User account is invalid or deactivated.");

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
    throw new Error("Failed to update password. Please try again later.");
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

  if (!invitation.user.isActive || (invitation.user.accountStatus !== "PENDING" && invitation.user.accountStatus !== "INVITED")) {
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

  if (!dbUser.isActive || (dbUser.accountStatus !== "PENDING" && dbUser.accountStatus !== "INVITED")) {
    throw new Error("Account has already been activated or is not in a pending invitation status");
  }

  const consumed = await prisma.userInvitation.updateMany({
    where: {
      id: invitation.id,
      tokenHash,
      isUsed: false,
      expiresAt: { gt: new Date() },
      user: { isActive: true, accountStatus: { in: ["PENDING", "INVITED"] } },
    },
    data: { isUsed: true, usedAt: new Date() },
  });
  if (consumed.count !== 1) throw new Error("Invalid or expired setup token");

  const { error: updateError } = await supabase.auth.admin.updateUserById(dbUser.id, {
    password: newPassword,
    email_confirm: true,
  });

  if (updateError) {
    throw new Error("Failed to set password. Please ask your administrator for a new invitation.");
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const activated = await tx.user.updateMany({
      where: { id: dbUser.id, isActive: true, accountStatus: { in: ["PENDING", "INVITED"] } },
      data: {
        accountStatus: "ACTIVE",
        mustChangePassword: false,
      },
    });
    if (activated.count !== 1) throw new Error("User account is invalid or deactivated.");
    return await tx.user.findUniqueOrThrow({
      where: { id: dbUser.id },
      select: {
        id: true,
        email: true,
        role: true,
        accountStatus: true,
      },
    });
  });

  const effectiveUser = updatedUser || { ...dbUser, accountStatus: "ACTIVE" };

  logAudit(dbUser.id, "TA_ACCOUNT_ACTIVATED", "User", dbUser.id, {
    email: dbUser.email,
    role: effectiveUser.role,
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
    user: effectiveUser,
    tempToken,
  };
};





// ---------------------------------------------------------------------------
// Claim a walk-in account: SMS code -> claim token (15 min) -> optional email code -> password.
// ---------------------------------------------------------------------------

const CLAIM_SESSION_MS = 15 * 60 * 1000;
const CLAIM_COOLDOWN_MS = 60 * 1000;
const CLAIM_GENERIC_START_MESSAGE =
  "If a walk-in profile exists for this mobile number, a verification code has been sent by SMS.";
const CLAIM_BAD_CODE = "Invalid or expired verification code. Please request a new one.";
const CLAIM_BAD_SESSION = "This claim session has expired. Please start again.";

const findClaimableUser = async (phoneE164: string) => {
  const user = await prisma.user.findUnique({ where: { phoneNumber: phoneE164 } });
  return user && user.isActive && user.role === "APPLICANT" && user.accountStatus === "WALK_IN" ? user : null;
};

const issueClaimOtp = async (key: string, purpose: string): Promise<string | null> => {
  const latest = await prisma.authOtp.findFirst({ where: { email: key, purpose }, orderBy: { createdAt: "desc" } });
  if (latest && !(await getSecurityControls()).rateLimitDisabled &&
      Date.now() - new Date(latest.createdAt).getTime() < CLAIM_COOLDOWN_MS) {
    return null;
  }
  await prisma.authOtp.updateMany({ where: { email: key, purpose, isUsed: false }, data: { isUsed: true } });
  const plain = generateNumericOtp();
  await prisma.authOtp.create({
    data: {
      email: key,
      otpHash: hashOtp(plain),
      purpose,
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      isUsed: false,
    },
  });
  return plain;
};

/** Checks a 6-digit code against the newest unused row and uses it up. Every failure reads the same. */
const consumeClaimOtp = async (key: string, purpose: string, code: string): Promise<void> => {
  const clean = code.trim();
  if (!/^\d{6}$/.test(clean)) throw new ClaimError(CLAIM_BAD_CODE, 400);
  const otp = await prisma.authOtp.findFirst({
    where: { email: key, purpose, isUsed: false },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.expiresAt.getTime() < Date.now()) throw new ClaimError(CLAIM_BAD_CODE, 400);
  const reserved = await prisma.authOtp.updateMany({
    where: { id: otp.id, isUsed: false, expiresAt: { gt: new Date() }, attempts: { lt: otp.maxAttempts } },
    data: { attempts: { increment: 1 } },
  });
  if (reserved.count !== 1 || !verifyOtpHash(clean, otp.otpHash)) throw new ClaimError(CLAIM_BAD_CODE, 400);
  const used = await prisma.authOtp.updateMany({ where: { id: otp.id, isUsed: false }, data: { isUsed: true } });
  if (used.count !== 1) throw new ClaimError(CLAIM_BAD_CODE, 400);
};

const findClaimSession = async (claimToken: string) => {
  const row = await prisma.authOtp.findFirst({
    where: { otpHash: hashToken(claimToken), purpose: "ACCOUNT_CLAIM_SESSION", isUsed: false, expiresAt: { gt: new Date() } },
  });
  if (!row) throw new ClaimError(CLAIM_BAD_SESSION, 400);
  const user = await prisma.user.findUnique({ where: { email: row.email } });
  if (!user || !user.isActive || user.accountStatus !== "WALK_IN") throw new ClaimError(CLAIM_BAD_SESSION, 400);
  return { row, user };
};

/** Step 1. Always answers the same way so nobody can probe which numbers have a walk-in profile. */
export const startAccountClaim = async (phone: string) => {
  const phoneE164 = normalizeToE164(phone);
  const user = await findClaimableUser(phoneE164);
  if (user) {
    const code = await issueClaimOtp(user.email, "ACCOUNT_CLAIM");
    if (code) {
      if (await isOtpTestBypassEnabled() || process.env.NODE_ENV === "development") {
        console.log(`[DEV OTP] ACCOUNT_CLAIM SMS code generated for ${maskPhoneNumber(phoneE164)}: ${code}`);
      }
      await sendSmsViaTextBee(phoneE164, `Your MEGS verification code is ${code}. Valid for 10 minutes.`);
    }
  }
  return { message: CLAIM_GENERIC_START_MESSAGE };
};

/** Step 2. Trades the SMS code for a claim token that lasts 15 minutes. */
export const verifyAccountClaim = async (phone: string, otp: string) => {
  const user = await findClaimableUser(normalizeToE164(phone));
  if (!user) throw new ClaimError(CLAIM_BAD_CODE, 400);
  await consumeClaimOtp(user.email, "ACCOUNT_CLAIM", otp);

  await prisma.authOtp.updateMany({
    where: { email: user.email, purpose: "ACCOUNT_CLAIM_SESSION", isUsed: false },
    data: { isUsed: true },
  });
  const claimToken = generateSecureToken();
  await prisma.authOtp.create({
    data: {
      email: user.email,
      otpHash: hashToken(claimToken),
      purpose: "ACCOUNT_CLAIM_SESSION",
      attempts: 0,
      maxAttempts: 1,
      expiresAt: new Date(Date.now() + CLAIM_SESSION_MS),
      isUsed: false,
    },
  });
  return { claimToken };
};

/** Optional step 3. Emails a code to the address the applicant wants on the account. */
export const sendAccountClaimEmailCode = async (claimToken: string, email: string) => {
  const { user } = await findClaimSession(claimToken);
  const address = email.trim().toLowerCase();
  if (isSyntheticEmail(address)) throw new ClaimError("Enter a real email address.", 400);
  const taken = await prisma.user.findUnique({ where: { email: address }, select: { id: true } });
  if (taken && taken.id !== user.id) {
    throw new ClaimError("This email is already used by another account.", 409);
  }
  const code = await issueClaimOtp(address, "ACCOUNT_CLAIM_EMAIL");
  if (!code) throw new ClaimError("Please wait a minute before requesting another code.", 429);
  if (await isOtpTestBypassEnabled() || process.env.NODE_ENV === "development") {
    console.log(`[DEV OTP] ACCOUNT_CLAIM_EMAIL code generated for ${maskEmail(address)}.`);
  }
  await sendRegistrationOtpEmail(address, code);
  return { message: "A 6-digit code has been sent to your email." };
};

/** Step 4. Sets the password (and the email, once its code checks out) and activates the account. */
export const completeAccountClaim = async (input: {
  claimToken: string;
  password: string;
  email?: string;
  emailOtp?: string;
}) => {
  if (input.password.length < 8) throw new ClaimError("Password must be at least 8 characters", 400);
  const { row, user } = await findClaimSession(input.claimToken);

  const email = input.email?.trim().toLowerCase();
  if (email) {
    if (!input.emailOtp) throw new ClaimError("Enter the code we emailed you.", 400);
    if (isSyntheticEmail(email)) throw new ClaimError("Enter a real email address.", 400);
    const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (taken && taken.id !== user.id) throw new ClaimError("This email is already used by another account.", 409);
    await consumeClaimOtp(email, "ACCOUNT_CLAIM_EMAIL", input.emailOtp);
  }

  // The claim token works once.
  const used = await prisma.authOtp.updateMany({ where: { id: row.id, isUsed: false }, data: { isUsed: true } });
  if (used.count !== 1) throw new ClaimError(CLAIM_BAD_SESSION, 400);

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    password: input.password,
    ...(email ? { email, email_confirm: true } : {}),
  });
  if (error) throw new ClaimError("Could not set up the account. Please try again later.", 500);

  const activated = await prisma.user.updateMany({
    where: { id: user.id, accountStatus: "WALK_IN" },
    data: { accountStatus: "ACTIVE", mustChangePassword: false, ...(email ? { email } : {}) },
  });
  if (activated.count !== 1) throw new ClaimError(CLAIM_BAD_SESSION, 400);

  logAudit(user.id, "WALK_IN_ACCOUNT_CLAIMED", "User", user.id, { emailAdded: Boolean(email) });
  return { message: "Account ready. You can now sign in with your mobile number and password." };
};
