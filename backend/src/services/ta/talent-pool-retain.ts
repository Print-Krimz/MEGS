import prisma from "../../utils/prisma.js";
import { rebuildCandidateFeatureProfile } from "../scoring/talent-pool-knn.service.js";

/** True when the candidate can never be added to the talent pool (they have a no-show on record). */
export async function hasNoShowHistory(userId: string): Promise<boolean> {
  const profile = await prisma.applicantProfile.findUnique({
    where: { userId },
    select: { hasNoShowHistory: true },
  });
  return Boolean(profile?.hasNoShowHistory);
}

/**
 * Keeps the candidate findable for other openings. Skips candidates with no-show history or without a profile.
 * Shared by the backout and reject flows so both put people in the pool the same way.
 */
export async function retainInTalentPool(args: {
  userId: string;
  applicationId: number;
  actorId: string;
  notes: string;
}): Promise<void> {
  const { userId, applicationId, actorId, notes } = args;
  const profile = await prisma.applicantProfile.findUnique({
    where: { userId },
    select: { id: true, hasNoShowHistory: true },
  });
  if (!profile || profile.hasNoShowHistory) return;
  await prisma.talentPoolMembership.upsert({
    where: { applicantProfileId: profile.id },
    create: {
      applicantProfileId: profile.id,
      sourceApplicationId: applicationId,
      status: "ACTIVE",
      availability: "AVAILABLE",
      addedById: actorId,
      notes,
    },
    update: { sourceApplicationId: applicationId, status: "ACTIVE", availability: "AVAILABLE", notes },
  });
  await rebuildCandidateFeatureProfile(profile.id).catch(() => {});
}
