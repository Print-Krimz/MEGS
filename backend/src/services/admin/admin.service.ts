import prisma from '../../utils/prisma.js';
import supabase from '../../utils/supabase.js';
import { logAudit } from '../../utils/audit.js';
import { sendMail, sendTAInvitationEmail } from '../../utils/mailer.js';
import { generateSecureToken, hashToken } from '../../utils/otp.js';
import { parseManilaDateOnly } from "../../schemas/field-limits.js";
import crypto from "crypto";

export const inviteTA = async (
  adminId: string,
  email: string,
  firstName?: string,
  lastName?: string
) => {
  const emailLower = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: emailLower } });
  if (
    existing &&
    (existing.accountStatus === "ACTIVE" ||
      existing.accountStatus === "DEACTIVATED" ||
      existing.role !== "TALENT_ACQUISITION")
  ) {
    throw new Error("A user with this email already exists");
  }

  let userId: string;
  let dbUser: any;

  if (existing && (existing.accountStatus === "PENDING" || existing.accountStatus === "INVITED")) {
    userId = existing.id;
    dbUser = await prisma.user.update({
      where: { id: existing.id },
      data: {
        accountStatus: "PENDING",
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
  } else {
    // Generate secure random entropy for initial unactivated Supabase user
    const placeholderPassword = `Init_${crypto.randomBytes(16).toString("hex")}!Aa1`;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: emailLower,
      password: placeholderPassword,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || "Failed to create authentication credentials");
    }

    userId = authData.user.id;

    dbUser = await prisma.user.create({
      data: {
        id: userId,
        email: authData.user.email!,
        role: "TALENT_ACQUISITION",
        accountStatus: "PENDING",
        mustChangePassword: false,
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
  }

  // Invalidate any older unused invitations for this user
  await prisma.userInvitation.updateMany({
    where: { userId, isUsed: false },
    data: { isUsed: true },
  });

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours validity

  await prisma.userInvitation.create({
    data: {
      userId,
      email: emailLower,
      tokenHash,
      expiresAt,
      createdByAdminId: adminId,
      isUsed: false,
    },
  });

  const appBaseUrl = process.env.APP_URL || process.env.FRONTEND_URL || "http://localhost:5173";
  const setupLink = `${appBaseUrl}/setup-account/${rawToken}`;

  await sendTAInvitationEmail(emailLower, setupLink, firstName);

  logAudit(adminId, "TA_INVITED", "User", dbUser.id, {
    email: dbUser.email,
    firstName,
    lastName,
  });

  return {
    message: "Talent Acquisition invitation sent successfully",
    user: dbUser,
  };
};

export const resendTAInvitation = async (adminId: string, targetUserId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: {
      applicantProfile: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  if (!user) {
    throw new Error("User account not found");
  }

  if (user.role !== "TALENT_ACQUISITION") {
    throw new Error("Can only resend invitations for Talent Acquisition accounts");
  }

  if (user.accountStatus !== "PENDING" && user.accountStatus !== "INVITED") {
    throw new Error("Cannot resend invitation: Account is already active or deactivated");
  }

  // Invalidate any older unused invitations for this user
  await prisma.userInvitation.updateMany({
    where: { userId: user.id, isUsed: false },
    data: { isUsed: true },
  });

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

  await prisma.userInvitation.create({
    data: {
      userId: user.id,
      email: user.email,
      tokenHash,
      expiresAt,
      createdByAdminId: adminId,
      isUsed: false,
    },
  });

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      accountStatus: "PENDING",
      invitedAt: new Date(),
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

  const appBaseUrl = process.env.APP_URL || process.env.FRONTEND_URL || "http://localhost:5173";
  const setupLink = `${appBaseUrl}/setup-account/${rawToken}`;
  const firstName = user.applicantProfile?.firstName;

  await sendTAInvitationEmail(user.email, setupLink, firstName);

  logAudit(adminId, "TA_INVITATION_RESENT", "User", user.id, {
    email: user.email,
  });

  return {
    message: "Invitation resent successfully",
    user: updatedUser,
  };
};

export const cancelTAInvitation = async (adminId: string, targetUserId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!user) {
    throw new Error("User account not found");
  }

  if (user.accountStatus !== "PENDING" && user.accountStatus !== "INVITED") {
    throw new Error("Cannot cancel invitation for an active user");
  }

  // Invalidate active invitations
  await prisma.userInvitation.updateMany({
    where: { userId: user.id, isUsed: false },
    data: { isUsed: true },
  });

  // Delete pending user record from database
  await prisma.user.delete({
    where: { id: user.id },
  });

  // Clean up Supabase Auth user
  try {
    await supabase.auth.admin.deleteUser(user.id);
  } catch {
    // Non-blocking cleanup
  }

  logAudit(adminId, "TA_INVITATION_CANCELLED", "User", user.id, {
    email: user.email,
  });

  return {
    message: "Invitation cancelled successfully",
  };
};

const AUDIT_CATEGORY_ACTIONS: Record<string, string[]> = {
  AUTHENTICATION: [
    "USER_LOGGED_IN",
    "USER_LOGGED_OUT",
    "FAILED_LOGIN_ATTEMPT",
    "PASSWORD_RESET_REQUESTED",
    "PASSWORD_RESET_COMPLETED",
    "PASSWORD_CHANGED",
    "ACCOUNT_ACTIVATED",
    "TA_ACCOUNT_ACTIVATED",
    "USER_REGISTERED",
  ],
  USER_MANAGEMENT: [
    "TA_INVITED",
    "TA_INVITATION_RESENT",
    "TA_INVITATION_CANCELLED",
    "INVITED_TA",
    "USER_INVITED",
    "USER_ROLE_UPDATED",
    "USER_ACTIVATED",
    "USER_DEACTIVATED",
    "USER_STATUS_UPDATED",
  ],
  RECRUITMENT: [
    "APPLICATION_SUBMITTED",
    "APPLICATION_STATUS_UPDATED",
    "INTERVIEW_SCHEDULED",
    "INTERVIEW_RESULT_RECORDED",
    "CLIENT_ENDORSEMENT_RECORDED",
    "CLIENT_ENDORSEMENT_UPDATED",
    "CANDIDATE_HIRED",
    "MRF_CREATED",
    "MRF_UPDATED",
    "JOB_POSTING_CREATED",
    "JOB_POSTING_UPDATED",
  ],
  TALENT_POOL: [
    "KNN_TALENT_POOL_SEARCH",
    "TALENT_POOL_SEARCH",
    "KNN_TALENT_POOL_QUERY",
    "KNN_SIMILAR_CANDIDATES_QUERY",
    "TALENT_POOL_MEMBER_ADDED",
    "TALENT_POOL_CONTACT_LOGGED",
    "TALENT_POOL_REACTIVATION",
  ],
  CONFIGURATION: [
    "CANDIDATE_SCORING_CONFIGURATION_ACTIVATED",
    "SCORING_CONFIG_ACTIVATED",
    "SCORING_DEFAULTS_RESTORED",
  ],
  COMPLIANCE: [
    "COMPLIANCE_REQUIREMENT_CREATED",
    "COMPLIANCE_REQUIREMENT_REVIEWED",
  ],
  DEPLOYMENT: [
    "DEPLOYMENT_CREATED",
    "EMPLOYEE_DEPLOYED",
    "DEPLOYMENT_STATUS_UPDATED",
    "EMPLOYEE_STATUS_UPDATED",
    "DEPLOYMENT_ENDED",
  ],
  SECURITY: [
    "USER_ROLE_UPDATED",
    "FAILED_LOGIN_ATTEMPT",
    "PASSWORD_RESET_REQUESTED",
    "USER_DEACTIVATED",
  ],
};

export const fetchAuditLogs = async (filters: {
  action?: string;
  userId?: string;
  entity?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
}) => {
  const { action, userId, entity, category, startDate, endDate, search, limit = 100 } = filters;

  const where: any = {};
  if (action) where.action = String(action);
  if (userId) where.userId = String(userId);
  if (entity) where.entity = String(entity);

  if (category) {
    const upperCat = category.toUpperCase().replace(/\s+/g, "_");
    const actionsInCat = AUDIT_CATEGORY_ACTIONS[upperCat];
    if (actionsInCat && actionsInCat.length > 0) {
      where.action = { in: actionsInCat };
    }
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      const parsedStart = parseManilaDateOnly(startDate);
      if (!isNaN(parsedStart.getTime())) {
        where.createdAt.gte = parsedStart;
      }
    }
    if (endDate) {
      const parsedEnd = parseManilaDateOnly(endDate);
      if (!isNaN(parsedEnd.getTime())) {
        parsedEnd.setTime(parsedEnd.getTime() + 86_400_000 - 1);
        where.createdAt.lte = parsedEnd;
      }
    }
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { action: { contains: q, mode: "insensitive" } },
      { entity: { contains: q, mode: "insensitive" } },
      { details: { contains: q, mode: "insensitive" } },
      { user: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  return await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          applicantProfile: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
  });
};

export const buildAdminUserSearchFilter = (search: string) => {
  const searchTerms: any[] = [
    { email: { contains: search, mode: "insensitive" } },
    { applicantProfile: { firstName: { contains: search, mode: "insensitive" } } },
    { applicantProfile: { lastName: { contains: search, mode: "insensitive" } } },
  ];

  // The existing Users page searched the rendered "firstName lastName" string.
  // Match substrings that cross that single field boundary without broadening to token-AND semantics.
  let splitAt = search.indexOf(" ");
  while (splitAt >= 0) {
    const firstNameSuffix = search.slice(0, splitAt);
    const lastNamePrefix = search.slice(splitAt + 1);
    if (firstNameSuffix && lastNamePrefix) {
      searchTerms.push({
        AND: [
          { applicantProfile: { firstName: { endsWith: firstNameSuffix, mode: "insensitive" } } },
          { applicantProfile: { lastName: { startsWith: lastNamePrefix, mode: "insensitive" } } },
        ],
      });
    }
    splitAt = search.indexOf(" ", splitAt + 1);
  }

  return { OR: searchTerms };
};

export const fetchAllUsers = async (filters: {
  page?: number;
  limit?: number;
  search?: string;
  role?: "APPLICANT" | "TALENT_ACQUISITION" | "ADMINISTRATOR";
} = {}) => {
  const paginated = filters.page !== undefined || filters.limit !== undefined || Boolean(filters.search) || Boolean(filters.role);
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const search = filters.search?.trim();
  const where: any = {
    ...(filters.role ? { role: filters.role } : {}),
    ...(search ? buildAdminUserSearchFilter(search) : {}),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
    where: paginated ? where : undefined,
    ...(paginated ? { skip: (page - 1) * limit, take: limit } : {}),
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      accountStatus: true,
      invitedAt: true,
      invitedBy: true,
      createdAt: true,
      applicantProfile: {
        select: { firstName: true, lastName: true },
      },
      invitations: {
        select: {
          id: true,
          expiresAt: true,
          isUsed: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    }),
    paginated ? prisma.user.count({ where }) : Promise.resolve(0),
  ]);

  const rows = users.map((u: any) => {
    const latestInvite = u.invitations?.[0];
    let computedStatus = u.accountStatus;
    if (u.accountStatus === "PENDING" || u.accountStatus === "INVITED") {
      if (latestInvite && new Date(latestInvite.expiresAt).getTime() < Date.now() && !latestInvite.isUsed) {
        computedStatus = "EXPIRED";
      } else {
        computedStatus = "PENDING";
      }
    }

    return {
      id: u.id,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      accountStatus: u.accountStatus,
      invitationStatus: computedStatus,
      invitationExpiresAt: latestInvite?.expiresAt || null,
      invitedAt: u.invitedAt,
      invitedBy: u.invitedBy,
      createdAt: u.createdAt,
      applicantProfile: u.applicantProfile,
    };
  });
  if (!paginated) return rows;
  return { items: rows, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
};

export const getAdminUserSummary = async () => {
  const counts = await prisma.user.groupBy({ by: ["role"], _count: { _all: true } });
  const countsByRole = new Map(counts.map((row) => [row.role, row._count._all]));
  return {
    totalUsers: counts.reduce((sum, row) => sum + row._count._all, 0),
    recruiters: countsByRole.get("TALENT_ACQUISITION") ?? 0,
    administrators: countsByRole.get("ADMINISTRATOR") ?? 0,
  };
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

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { role },
    select: { id: true, email: true, role: true },
  });

  logAudit(adminId, "USER_ROLE_UPDATED", "User", targetUserId, {
    targetUserId,
    targetEmail: targetUser.email,
    previousRole: targetUser.role,
    newRole: role,
  });

  return updatedUser;
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

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { isActive, accountStatus },
    select: { id: true, email: true, isActive: true, accountStatus: true },
  });

  const action = isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED";
  logAudit(adminId, action, "User", targetUserId, {
    targetUserId,
    targetEmail: targetUser.email,
    isActive,
    accountStatus,
  });

  return updatedUser;
};

