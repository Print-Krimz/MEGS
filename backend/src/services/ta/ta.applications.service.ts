import prisma from '../../utils/prisma.js';
import { ApplicationStatus } from "@prisma/client";
import { sendNotification } from '../../utils/notification.js';
import { scoringFlags } from '../../utils/scoring-flags.js';
import { getActiveScoringConfiguration } from "../scoring/scoring-configuration.service.js";
import { isFullyCompliant, generateComplianceRequirementsFromMRF } from "./ta.compliance.service.js";

// Authoritative State Machine governing valid applicant pipeline stage transitions
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED:          ["PARSING", "REVIEW", "NEEDS_ATTENTION", "BACKOUT", "ARCHIVED"],
  PARSING:            ["REVIEW", "NEEDS_ATTENTION", "ARCHIVED"],
  REVIEW:             ["INITIAL_SCREENING", "MATCHED", "TALENT_POOL", "BACKOUT", "ARCHIVED"],
  NEEDS_ATTENTION:    ["PARSING", "REVIEW", "TALENT_POOL", "BACKOUT", "ARCHIVED"],
  MATCHED:            ["INITIAL_SCREENING", "TALENT_POOL", "ARCHIVED"],
  TALENT_POOL:        ["INITIAL_SCREENING", "ARCHIVED"],
  INITIAL_SCREENING:  ["CLIENT_ENDORSEMENT", "TALENT_POOL", "BACKOUT", "ARCHIVED"],
  CLIENT_ENDORSEMENT: ["FINAL_INTERVIEW", "TALENT_POOL", "BACKOUT", "ARCHIVED"],
  FINAL_INTERVIEW:    ["HIRED", "TALENT_POOL", "BACKOUT", "ARCHIVED"],
  HIRED:              ["COMPLIANCE", "ONBOARDING", "BACKOUT"],
  ONBOARDING:         ["COMPLIANCE", "DEPLOYED", "BACKOUT"],
  COMPLIANCE:         ["DEPLOYED", "BACKOUT"],
  DEPLOYED:           ["ARCHIVED"],
  BACKOUT:            [],
  ARCHIVED:           [],
};

export const listTAApplications = async (status?: string, jobPostingId?: string) => {
  const dynamicScoring = scoringFlags.dynamicCandidateScoringEnabled();
  const configuration = dynamicScoring ? await getActiveScoringConfiguration() : null;
  const applications = await prisma.application.findMany({
    where: {
      ...(status ? { status: status as ApplicationStatus } : {}),
      ...(jobPostingId ? { jobPostingId: parseInt(jobPostingId, 10) } : {}),
      ...(status ? {} : { isArchived: false }),
    },
    orderBy: dynamicScoring ? { createdAt: "desc" } : [
      { aiScore: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    select: {
      id: true,
      status: true,
      aiScore: true,
      aiSummary: true,
      isArchived: true,
      createdAt: true,
      jobPosting: { select: { id: true, title: true, location: true } },
      user: {
        select: {
          id: true,
          email: true,
          applicantProfile: {
            select: { firstName: true, lastName: true, mobileNumber: true, city: true, province: true, photoUrl: true },
          },
        },
      },
      ...(configuration ? {
        candidateScores: {
          where: { configurationId: configuration.id, status: "CALCULATED" },
          orderBy: { calculatedAt: "desc" },
          select: { jobPostingId: true, finalFitScore: true, calculatedAt: true },
        },
      } : {}),
    },
  });
  if (!configuration) return applications;
  return applications
    .map((application) => {
      const score = application.candidateScores.find((candidateScore) => candidateScore.jobPostingId === application.jobPosting.id) ?? null;
      const { candidateScores, ...rest } = application;
      return { ...rest, candidateFitScore: score ? Number(score.finalFitScore) : null, candidateFitScoreCalculatedAt: score?.calculatedAt ?? null, candidateScoringConfigurationVersion: configuration.version };
    })
    .sort((left, right) => (right.candidateFitScore ?? -1) - (left.candidateFitScore ?? -1) || right.createdAt.getTime() - left.createdAt.getTime());
};

export const getTAApplication = async (id: number) => {
  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      jobPosting: {
        select: { id: true, title: true, requirements: true, location: true, status: true, mrfId: true },
      },
      user: {
        select: {
          id: true,
          email: true,
          applicantProfile: {
            include: {
              workExperiences: { orderBy: { startDate: "desc" } },
              educations: { orderBy: { startDate: "desc" } },
              skills: { include: { skill: true } },
              trainings: true,
              assets: true,
              characterReferences: true,
            },
          },
        },
      },
      interviews: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      },
      clientEndorsements: {
        orderBy: { createdAt: "desc" },
        include: { client: true, endorsedBy: { select: { id: true, email: true } } },
      },
      complianceRequirements: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!application) throw new Error("Application not found");

  return {
    ...application,
    user: {
      ...application.user,
      applicantProfile: application.user.applicantProfile
        ? {
            ...application.user.applicantProfile,
            skills: application.user.applicantProfile.skills.map((s) => s.skill.name),
          }
        : null,
    },
  };
};

/**
 * Authoritative Application State Transition Engine.
 * Enforces valid stage progression, pre-transition validation gates, and post-transition side effects.
 */
export const updateTAApplicationStatus = async (
  id: number,
  status: any,
  actorId?: string,
  reason?: string
) => {
  const application = await prisma.application.findUnique({
    where: { id },
    select: { id: true, status: true, isArchived: true, userId: true },
  });

  if (!application) throw new Error("Application not found");
  if (application.isArchived && status !== "SUBMITTED" && status !== "ARCHIVED") {
    throw new Error("Cannot change status of an archived application. Restore it first.");
  }

  const currentStatus = application.status;
  const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];

  if (!allowed.includes(status)) {
    throw new Error(
      `Cannot move from ${currentStatus} to ${status}. Allowed next steps: ${
        allowed.length ? allowed.join(", ") : "none (terminal status)"
      }`
    );
  }

  // Pre-transition rule: INITIAL_SCREENING -> CLIENT_ENDORSEMENT requires PASS screening interview
  if (status === "CLIENT_ENDORSEMENT") {
    const screening = await prisma.interview.findFirst({
      where: {
        applicationId: id,
        type: "INITIAL_SCREENING",
        result: { in: ["PASS", "PASSED"] },
        isActive: true,
      },
    });
    if (!screening) {
      throw new Error("Cannot move to CLIENT_ENDORSEMENT. A passed INITIAL_SCREENING interview is required.");
    }
  }

  // Pre-transition rule: CLIENT_ENDORSEMENT -> FINAL_INTERVIEW requires ENDORSED client endorsement
  if (status === "FINAL_INTERVIEW") {
    const endorsement = await prisma.clientEndorsement.findFirst({
      where: {
        applicationId: id,
        outcome: "ENDORSED",
      },
    });
    if (!endorsement) {
      throw new Error("Cannot move to FINAL_INTERVIEW. Client endorsement (outcome: ENDORSED) is required.");
    }
  }

  // Pre-transition rule: FINAL_INTERVIEW -> HIRED requires PASS final interview
  if (status === "HIRED") {
    const finalInterview = await prisma.interview.findFirst({
      where: {
        applicationId: id,
        type: "FINAL_INTERVIEW",
        result: { in: ["PASS", "PASSED"] },
        isActive: true,
      },
    });
    if (!finalInterview) {
      throw new Error("Cannot move to HIRED. A passed FINAL_INTERVIEW is required.");
    }
  }

  // Pre-transition rule: COMPLIANCE -> DEPLOYED requires all mandatory requirements APPROVED & valid
  if (status === "DEPLOYED") {
    const compliant = await isFullyCompliant(id);
    if (!compliant) {
      throw new Error("Cannot deploy candidate. All required compliance documents must be APPROVED and valid.");
    }
  }

  // Execute status update
  const updated = await prisma.application.update({
    where: { id },
    data: { status },
    select: { id: true, status: true, updatedAt: true },
  });

  // Record audit decision
  const resolvedActorId = actorId || application.userId;
  await prisma.recruiterDecision.create({
    data: {
      applicationId: id,
      actorId: resolvedActorId,
      fromStatus: currentStatus,
      toStatus: status,
      reason: reason || null,
    },
  });

  // Post-transition hook: Generate compliance requirements when entering COMPLIANCE or HIRED
  if (status === "COMPLIANCE" || status === "HIRED") {
    try {
      await generateComplianceRequirementsFromMRF(id);
    } catch (err: any) {
      console.error("[Workflow] Failed to auto-generate compliance requirements:", err.message);
    }
  }

  // Post-transition hook: Sync Talent Pool Membership
  if (status === "TALENT_POOL") {
    const appWithProfile = await prisma.application.findUnique({
      where: { id },
      include: { user: { select: { applicantProfile: { select: { id: true } } } } },
    });
    if (appWithProfile?.user?.applicantProfile) {
      const applicantProfileId = appWithProfile.user.applicantProfile.id;
      await prisma.talentPoolMembership.upsert({
        where: { applicantProfileId },
        create: {
          applicantProfileId,
          sourceApplicationId: id,
          status: "ACTIVE",
          availability: "AVAILABLE",
          addedById: resolvedActorId,
          notes: reason || null,
        },
        update: {
          sourceApplicationId: id,
          status: "ACTIVE",
          availability: "AVAILABLE",
          addedById: resolvedActorId,
          notes: reason || null,
        },
      });
    }
  } else if (status === "HIRED" || status === "DEPLOYED") {
    const appWithProfile = await prisma.application.findUnique({
      where: { id },
      include: { user: { select: { applicantProfile: { select: { id: true } } } } },
    });
    if (appWithProfile?.user?.applicantProfile) {
      await prisma.talentPoolMembership.updateMany({
        where: { applicantProfileId: appWithProfile.user.applicantProfile.id },
        data: {
          status: "PLACED",
          availability: "UNAVAILABLE",
        },
      });
    }
  }

  sendNotification(
    application.userId,
    "Application Update",
    `Your application has been moved to ${status.replace("_", " ")}.`,
    "INFO"
  );

  return updated;
};

export const getRecruiterDecisionsService = async (applicationId: number) => {
  return await prisma.recruiterDecision.findMany({
    where: { applicationId },
    include: {
      actor: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const archiveTAApplication = async (id: number, actorId?: string, reason?: string) => {
  const application = await prisma.application.findUnique({
    where: { id },
    select: { id: true, status: true, isArchived: true, userId: true },
  });
  if (!application) throw new Error("Application not found");
  if (application.isArchived) throw new Error("Application is already archived");

  const fromStatus = application.status;
  const updated = await prisma.application.update({
    where: { id },
    data: { isArchived: true, archivedAt: new Date(), status: "ARCHIVED" },
    select: { id: true, status: true, isArchived: true, archivedAt: true },
  });

  await prisma.recruiterDecision.create({
    data: {
      applicationId: id,
      actorId: actorId || application.userId,
      fromStatus,
      toStatus: "ARCHIVED",
      reason: reason || "Application archived",
    },
  });

  return updated;
};

export const restoreTAApplication = async (id: number, actorId?: string, reason?: string) => {
  const application = await prisma.application.findUnique({
    where: { id },
    select: { id: true, status: true, isArchived: true, userId: true },
  });
  if (!application) throw new Error("Application not found");
  if (!application.isArchived) throw new Error("Application is not archived");

  const updated = await prisma.application.update({
    where: { id },
    data: { isArchived: false, archivedAt: null, status: "SUBMITTED" },
    select: { id: true, status: true, isArchived: true },
  });

  await prisma.recruiterDecision.create({
    data: {
      applicationId: id,
      actorId: actorId || application.userId,
      fromStatus: "ARCHIVED",
      toStatus: "SUBMITTED",
      reason: reason || "Application restored to SUBMITTED",
    },
  });

  return updated;
};


