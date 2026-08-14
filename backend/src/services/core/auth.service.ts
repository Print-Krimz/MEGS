import supabase from '../../utils/supabase.js';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import { sendMail } from '../../utils/mailer.js';

export const registerUser = async (email: string, password: string) => {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error("An account with this email already exists");
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
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
      accountStatus: "ACTIVE",
      mustChangePassword: false,
    },
  });

  logAudit(dbUser.id, "USER_REGISTERED", "User", dbUser.id, { email: dbUser.email, role: dbUser.role });

  return { id: dbUser.id, email: dbUser.email, role: dbUser.role };
};

export const loginUser = async (email: string, password: string, ip?: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session || !data.user) {
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
    throw new Error("User account not found in database");
  }

  if (!dbUser.isActive || dbUser.accountStatus === "DEACTIVATED") {
    throw new Error("Account has been deactivated");
  }

  if (dbUser.accountStatus === "INVITED") {
    throw new Error("Account setup has not been completed. Please use the activation link sent to your email.");
  }

  logAudit(dbUser.id, "USER_LOGGED_IN", "User", dbUser.id, { ip });

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

export const logoutUser = async (token?: string) => {
  if (token) {
    await supabase.auth.admin.signOut(token);
  }
};

export const requestPasswordReset = async (email: string) => {
  const GENERIC_RESPONSE = {
    message: "If an account exists for this email, a password reset link has been sent.",
  };

  try {
    const dbUser = await prisma.user.findUnique({ where: { email } });
    if (!dbUser || !dbUser.isActive) {
      return GENERIC_RESPONSE;
    }

    // Generate link server-side without sending via Supabase's rate-limited mailer
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    if (error || !data?.properties?.action_link) {
      console.error("[Auth] Failed to generate recovery link:", error);
      return GENERIC_RESPONSE;
    }

    const resetLink = data.properties.action_link;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #1e3a8a;">MEGS Recruitment Management System</h2>
        <p>Hello,</p>
        <p>We received a request to reset your password. Click the link below to set a new password:</p>
        <p style="margin: 24px 0;">
          <a href="${resetLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
        </p>
        <p style="color: #6b7280; font-size: 13px;">This password reset link will expire shortly and can only be used once.</p>
        <p style="color: #6b7280; font-size: 13px;">If you did not request a password reset, please ignore this email.</p>
      </div>
    `;

    const textBody = `MEGS Password Reset:\n\nPlease use the following link to reset your password:\n${resetLink}\n\nThis link is single-use and will expire shortly.`;

    await sendMail(email, "Password Reset Request - MEGS", textBody, htmlBody);
    logAudit(dbUser.id, "PASSWORD_RESET_REQUESTED", "User", dbUser.id, { email });

    return {
      ...GENERIC_RESPONSE,
      ...(process.env.NODE_ENV !== "production" ? { debugResetLink: resetLink } : {}),
    };
  } catch (err: any) {
    console.error("[Auth] Error in requestPasswordReset:", err);
    return GENERIC_RESPONSE;
  }
};

export const resetUserPassword = async (token: string, newPassword: string) => {
  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new Error("Invalid or expired password reset token");
  }

  const userId = data.user.id;

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

  logAudit(userId, "PASSWORD_RESET_COMPLETED", "User", userId, {});

  return { message: "Password has been reset successfully" };
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

export const setupAccount = async (token: string, newPassword: string) => {
  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new Error("Invalid or expired setup token");
  }

  const userId = data.user.id;
  const dbUser = await prisma.user.findUnique({ where: { id: userId } });

  if (!dbUser) {
    throw new Error("User account not found");
  }

  if (dbUser.accountStatus !== "INVITED") {
    throw new Error("Account has already been activated or is not in INVITED status");
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateError) {
    throw new Error(updateError.message || "Failed to set password");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
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

  logAudit(userId, "ACCOUNT_ACTIVATED", "User", userId, { role: updatedUser.role });

  return {
    message: "Account setup completed successfully. You can now log in.",
    user: updatedUser,
  };
};

