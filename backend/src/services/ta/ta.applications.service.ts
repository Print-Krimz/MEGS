import prisma from '../../utils/prisma.js';
import { ApplicationStatus } from "@prisma/client";
import { sendNotification } from '../../utils/notification.js';
import { scoringFlags } from '../../utils/scoring-flags.js';
import { getActiveScoringConfiguration } from "../scoring/scoring-configuration.service.js";

// State machine governing valid applicant pipeline stage transitions
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED:         ["PARSING", "BACKOUT", "ARCHIVED"],
  PARSING:           ["MATCHED", "TALENT_POOL", "ARCHIVED"],
  MATCHED:           ["INITIAL_SCREENING", "TALENT_POOL", "ARCHIVED"],
  TALENT_POOL:       ["INITIAL_SCREENING", "ARCHIVED"],
  INITIAL_SCREENING: ["FINAL_INTERVIEW", "BACKOUT", "ARCHIVED"],
  FINAL_INTERVIEW:   ["HIRED", "BACKOUT", "ARCHIVED"],
  HIRED:             ["ONBOARDING", "BACKOUT"],
  ONBOARDING:        ["DEPLOYED", "BACKOUT"],
  DEPLOYED:          ["ARCHIVED"],
  BACKOUT:           [],
  ARCHIVED:          [],
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
        select: { id: true, title: true, requirements: true, location: true, status: true },
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

// Enforces valid stage progression; moving to HIRED requires a passed FINAL_INTERVIEW
export const updateTAApplicationStatus = async (id: number, status: any, actorId?: string, reason?: string) => {
  const application = await prisma.application.findUnique({
    where: { id },
    select: { id: true, status: true, isArchived: true, userId: true },
  });

  if (!application) throw new Error("Application not found");
  if (application.isArchived) throw new Error("Cannot change status of an archived application. Restore it first.");

  const currentStatus = application.status;
  const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];

  if (!allowed.includes(status)) {
    throw new Error(`Cannot move from ${currentStatus} to ${status}. Allowed next steps: ${allowed.length ? allowed.join(", ") : "none (terminal status)"}`);
  }

  if (status === "HIRED") {
    const finalInterview = await prisma.interview.findFirst({
      where: { applicationId: id, type: "FINAL_INTERVIEW", result: { in: ["PASS", "PASSED"] } },
    });
    if (!finalInterview) {
      throw new Error("Cannot move to HIRED. A passed FINAL_INTERVIEW is required.");
    }
  }

  const updated = await prisma.application.update({
    where: { id },
    data: { status },
    select: { id: true, status: true, updatedAt: true },
  });

  if (actorId) {
    await prisma.recruiterDecision.create({
      data: {
        applicationId: id,
        actorId,
        fromStatus: currentStatus,
        toStatus: status,
        reason: reason || null,
      },
    });
  }

  sendNotification(application.userId, "Application Update", `Your application has been moved to ${status.replace("_", " ")}.`, "INFO");

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

export const archiveTAApplication = async (id: number) => {
  const application = await prisma.application.findUnique({ where: { id }, select: { id: true, isArchived: true } });
  if (!application) throw new Error("Application not found");
  if (application.isArchived) throw new Error("Application is already archived");

  const updated = await prisma.application.update({
    where: { id },
    data: { isArchived: true, archivedAt: new Date(), status: "ARCHIVED" },
    select: { id: true, status: true, isArchived: true, archivedAt: true },
  });
  return updated;
};

export const restoreTAApplication = async (id: number) => {
  const application = await prisma.application.findUnique({ where: { id }, select: { id: true, isArchived: true } });
  if (!application) throw new Error("Application not found");
  if (!application.isArchived) throw new Error("Application is not archived");

  const updated = await prisma.application.update({
    where: { id },
    data: { isArchived: false, archivedAt: null, status: "SUBMITTED" },
    select: { id: true, status: true, isArchived: true },
  });
  return updated;
};

