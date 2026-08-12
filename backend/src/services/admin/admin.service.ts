import prisma from '../../utils/prisma.js';
import { invalidatePolicyCache } from '../../utils/policy.js';

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

export const fetchPolicies = async () => {
  return await prisma.policy.findMany({
    orderBy: { key: "asc" },
  });
};

export const createNewPolicy = async (key: string, value: any, description?: string) => {
  if (!key || typeof key !== "string") throw new Error("Valid key is required");
  if (value === undefined) throw new Error("value is required");

  const existing = await prisma.policy.findUnique({ where: { key } });
  if (existing) throw new Error("A policy with this key already exists");

  const policy = await prisma.policy.create({
    data: { key, value: String(value), description },
  });

  invalidatePolicyCache();
  return policy;
};

export const updateExistingPolicy = async (key: string, value?: any, description?: string) => {
  const existing = await prisma.policy.findUnique({ where: { key } });
  if (!existing) throw new Error("Policy not found");

  const updateData: any = {};
  if (value !== undefined) updateData.value = String(value);
  if (description !== undefined) updateData.description = description;

  const policy = await prisma.policy.update({
    where: { key },
    data: updateData,
  });

  invalidatePolicyCache();
  return policy;
};

export const deleteExistingPolicy = async (key: string) => {
  const existing = await prisma.policy.findUnique({ where: { key } });
  if (!existing) throw new Error("Policy not found");

  await prisma.policy.delete({ where: { key } });
  invalidatePolicyCache();
};

export const fetchAllUsers = async () => {
  return await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
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

  return await prisma.user.update({
    where: { id: targetUserId },
    data: { isActive },
    select: { id: true, email: true, isActive: true },
  });
};
