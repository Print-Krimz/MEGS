import prisma from "../../utils/prisma.js";
import supabase from "../../utils/supabase.js";
import { displayEmail } from "../../utils/display-email.js";
import { logAudit } from "../../utils/audit.js";
import { isMfaEnforced, STAFF_ROLES } from "../../security/auth-policy.js";

export class SettingsAccessError extends Error {}

export const getSettings = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, role: true, displayName: true, email: true, phoneNumber: true,
      applicantProfile: { select: { firstName: true, lastName: true } },
    },
  });
  if (!user) throw new SettingsAccessError("Account not found");

  const profileName = [user.applicantProfile?.firstName?.trim(), user.applicantProfile?.lastName?.trim()]
    .filter(Boolean).join(" ");
  const name = (user.role !== "APPLICANT" && user.displayName?.trim()) || profileName || null;
  let mfa: { required: boolean; enrolled: boolean | null } | null = null;
  if (STAFF_ROLES.has(user.role)) {
    const required = await isMfaEnforced();
    let enrolled: boolean | null = null;
    try {
      const { data, error } = await supabase.auth.admin.mfa.listFactors({ userId: id });
      if (!error && data) enrolled = data.factors.some((factor) => factor.status === "verified");
    } catch {
      // Account details remain available during provider outages.
    }
    mfa = { required, enrolled };
  }
  return {
    account: { id: user.id, role: user.role, name, email: displayEmail(user.email), phoneNumber: user.phoneNumber },
    mfa,
  };
};

export const updateProfile = async (id: string, displayName: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, isActive: true, accountStatus: true, displayName: true },
  });
  if (!user || !STAFF_ROLES.has(user.role) || !user.isActive || user.accountStatus !== "ACTIVE") {
    throw new SettingsAccessError("Account is not authorized");
  }
  if (user.displayName === displayName) return { displayName };

  const updated = await prisma.user.updateMany({
    where: {
      id,
      role: { in: ["ADMINISTRATOR", "TALENT_ACQUISITION"] },
      isActive: true,
      accountStatus: "ACTIVE",
      displayName: user.displayName,
    },
    data: { displayName },
  });
  if (updated.count !== 1) throw new SettingsAccessError("Account changed. Please try again.");
  await logAudit(id, "STAFF_DISPLAY_NAME_UPDATED", "User", id, { before: user.displayName, after: displayName });
  return { displayName };
};
