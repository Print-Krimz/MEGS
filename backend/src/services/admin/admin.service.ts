import prisma from '../../utils/prisma.js';
import supabase from '../../utils/supabase.js';
import { logAudit } from '../../utils/audit.js';
import { sendMail } from '../../utils/mailer.js';
import crypto from "crypto";

export const inviteTA = async (
  adminId: string,
  email: string,
  firstName?: string,
  lastName?: string
) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("A user with this email already exists");
  }

  const tempPassword = `Temp_${crypto.randomBytes(8).toString("hex")}!Aa1`;

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    throw new Error(authError?.message || "Failed to create authentication credentials");
  }

  const userId = authData.user.id;

  const dbUser = await prisma.user.create({
    data: {
      id: userId,
      email: authData.user.email!,
      role: "TALENT_ACQUISITION",
      accountStatus: "INVITED",
      mustChangePassword: true,
      invitedAt: new Date(),
      invitedBy: adminId,
    },
    select: {
      id: true,
      email: true,
      role: true,
      accountStatus: true,
      mustChangePassword: true,
      invitedAt: true,
    },
  });

  const { data: linkData } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  const setupLink = linkData?.properties?.action_link || "";

  const nameGreeting = firstName ? `Hello ${firstName},` : "Hello,";

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #1e3a8a;">MEGS Recruitment Management System</h2>
      <p>${nameGreeting}</p>
      <p>You have been invited to join MEGS as a <strong>Talent Acquisition Specialist</strong>.</p>
      <p>Please click the button below to set up your password and activate your account:</p>
      <p style="margin: 24px 0;">
        <a href="${setupLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Activate TA Account</a>
      </p>
      <p style="color: #6b7280; font-size: 13px;">This invitation link is single-use and will expire shortly.</p>
    </div>
  `;

  const textBody = `MEGS TA Invitation:\n\n${nameGreeting}\nYou have been invited to join MEGS as a Talent Acquisition Specialist.\n\nPlease activate your account and set your password using this link:\n${setupLink}\n\nThis link is single-use.`;

  await sendMail(email, "Invitation: Join MEGS as Talent Acquisition Specialist", textBody, htmlBody);

  logAudit(adminId, "INVITED_TA", "User", dbUser.id, {
    email: dbUser.email,
    firstName,
    lastName,
  });

  return {
    message: "Talent Acquisition invitation sent successfully",
    user: dbUser,
    ...(process.env.NODE_ENV !== "production" ? { debugSetupLink: setupLink } : {}),
  };
};

export const fetchAuditLogs = async (filters: { action?: string; userId?: string; entity?: string; limit?: number }) => {
  const { action, userId, entity, limit = 50 } = filters;

  const where: any = {};
  if (action) where.action = String(action);
  if (userId) where.userId = String(userId);
  if (entity) where.entity = String(entity);

  return await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { email: true, role: true } },
    },
  });
};

export const fetchAllUsers = async () => {
  return await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      accountStatus: true,
      createdAt: true,
      applicantProfile: {
        select: { firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const changeUserRole = async (targetUserId: string, adminId: string, role: any) => {
  if (!role || !["APPLICANT", "TALENT_ACQUISITION", "ADMINISTRATOR"].includes(role)) {
    throw new Error("Invalid role provided. Must be APPLICANT, TALENT_ACQUISITION, or ADMINISTRATOR");
  }

  if (targetUserId === adminId) {
    throw new Error("Security constraint: You cannot change your own role. Ask another Administrator.");
  }

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) throw new Error("User not found");

  return await prisma.user.update({
    where: { id: targetUserId },
    data: { role },
    select: { id: true, email: true, role: true },
  });
};

export const changeUserStatus = async (targetUserId: string, adminId: string, isActive: boolean) => {
  if (typeof isActive !== "boolean") {
    throw new Error("isActive must be a boolean");
  }

  if (targetUserId === adminId && !isActive) {
    throw new Error("Security constraint: You cannot deactivate your own account.");
  }

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) throw new Error("User not found");

  const accountStatus = isActive ? "ACTIVE" : "DEACTIVATED";

  return await prisma.user.update({
    where: { id: targetUserId },
    data: { isActive, accountStatus },
    select: { id: true, email: true, isActive: true, accountStatus: true },
  });
};

