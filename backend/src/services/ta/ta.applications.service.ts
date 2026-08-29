import prisma from '../../utils/prisma.js';
import { ApplicationStatus } from "@prisma/client";
import { sendNotification } from '../../utils/notification.js';
import { scoringFlags } from '../../utils/scoring-flags.js';
import { getActiveScoringConfiguration } from "../scoring/scoring-configuration.service.js";
import { isFullyCompliant, generateComplianceRequirementsFromMRF } from "./ta.compliance.service.js";
import { logAudit } from '../../utils/audit.js';

// Authoritative State Machine governing valid applicant pipeline stage transitions
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED:          ["PARSING", "REVIEW", "MATCHED", "INITIAL_SCREENING", "NEEDS_ATTENTION", "BACKOUT", "ARCHIVED"],
  PARSING:            ["REVIEW", "MATCHED", "INITIAL_SCREENING", "NEEDS_ATTENTION", "ARCHIVED"],
  REVIEW:             ["INITIAL_SCREENING", "MATCHED", "TALENT_POOL", "BACKOUT", "ARCHIVED"],
  NEEDS_ATTENTION:    ["PARSING", "REVIEW", "MATCHED", "INITIAL_SCREENING", "TALENT_POOL", "BACKOUT", "ARCHIVED"],
  MATCHED:            ["INITIAL_SCREENING", "REVIEW", "TALENT_POOL", "ARCHIVED"],
  TALENT_POOL:        ["ARCHIVED"],
  INITIAL_SCREENING:  ["CLIENT_ENDORSEMENT", "TALENT_POOL", "BACKOUT", "ARCHIVED"],
  CLIENT_ENDORSEMENT: ["FINAL_INTERVIEW", "TALENT_POOL", "BACKOUT", "ARCHIVED"],
  FINAL_INTERVIEW:    ["COMPLIANCE", "TALENT_POOL", "BACKOUT", "ARCHIVED"],
  COMPLIANCE:         ["DEPLOYED", "BACKOUT", "ARCHIVED"],
  DEPLOYED:           ["ARCHIVED"],
  BACKOUT:            [],
  ARCHIVED:           [],
};

export interface ListTAApplicationsOptions {
  status?: string;
  jobPostingId?: string;
  search?: string;
  isArchived?: boolean;
  page?: number;
  limit?: number;
}

export const listTAApplications = async (
  statusOrOptions?: string | ListTAApplicationsOptions,
  legacyJobPostingId?: string
) => {
  const options: ListTAApplicationsOptions =
    typeof statusOrOptions === "object" && statusOrOptions !== null
      ? statusOrOptions
      : {
          status: statusOrOptions,
          jobPostingId: legacyJobPostingId,
        };

  const { status, jobPostingId, search, isArchived, page, limit } = options;
  const dynamicScoring = scoringFlags.dynamicCandidateScoringEnabled();
  const configuration = dynamicScoring ? await getActiveScoringConfiguration() : null;

  const where: any = {};
  if (status) {
    where.status = status as ApplicationStatus;
  }
  if (jobPostingId) {
    where.jobPostingId = parseInt(jobPostingId, 10);
  }
  if (isArchived !== undefined) {
    where.isArchived = Boolean(isArchived);
  } else if (!status) {
    where.isArchived = false;
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { user: { email: { contains: q, mode: "insensitive" } } },
      { user: { applicantProfile: { firstName: { contains: q, mode: "insensitive" } } } },
      { user: { applicantProfile: { lastName: { contains: q, mode: "insensitive" } } } },
      { jobPosting: { title: { contains: q, mode: "insensitive" } } },
    ];
  }

  const take = limit ? Math.max(1, limit) : undefined;
  const skip = page && limit ? Math.max(0, (page - 1) * limit) : undefined;

  const [total, applications] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      ...(take ? { take } : {}),
      ...(skip ? { skip } : {}),
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
    }),
  ]);

  const formatted = configuration
    ? applications
        .map((application) => {
          const score = application.candidateScores?.find((candidateScore) => candidateScore.jobPostingId === application.jobPosting.id) ?? null;
          const { candidateScores, ...rest } = application;
          return { ...rest, candidateFitScore: score ? Number(score.finalFitScore) : null, candidateFitScoreCalculatedAt: score?.calculatedAt ?? null, candidateScoringConfigurationVersion: configuration.version };
        })
        .sort((left, right) => (right.candidateFitScore ?? -1) - (left.candidateFitScore ?? -1) || right.createdAt.getTime() - left.createdAt.getTime())
    : applications;

  return {
    data: formatted,
    total,
    page: page || 1,
    limit: limit || total,
    totalPages: limit ? Math.max(1, Math.ceil(total / limit)) : 1,
  };
};

export const getTAApplication = async (id: number) => {
  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      jobPosting: {
        select: {
          id: true,
          title: true,
          requirements: true,
          location: true,
          status: true,
          mrfId: true,
          mrf: {
            select: {
              id: true,
              title: true,
              clientId: true,
              client: {
                select: {
                  id: true,
                  name: true,
                  industry: true,
                  contactName: true,
                  contactEmail: true,
                },
              },
            },
          },
        },
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
      candidateScores: {
        orderBy: { calculatedAt: "desc" },
        take: 1,
      },
      deployments: {
        include: { client: true },
        orderBy: { createdAt: "desc" },
      },
      hiredEmployee: {
        select: {
          id: true,
          employeeNumber: true,
          status: true,
          department: true,
          position: true,
          hireDate: true,
        },
      },
    },
  });

  if (!application) throw new Error("Application not found");

  // Compute fallback 7-day SLA deadline in-memory for any legacy requirements lacking one
  if (application.complianceRequirements?.length) {
    for (const req of application.complianceRequirements) {
      if (!req.deadline) {
        req.deadline = new Date(req.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
    }
  }

  const candidateScores = application.candidateScores?.map((score) => ({
    id: score.id,
    applicationId: score.applicationId,
    jobPostingId: score.jobPostingId,
    configurationId: score.configurationId,
    status: score.status,
    calculatedAt: score.calculatedAt,
    skillsScore: Number(score.skillsScore),
    experienceScore: Number(score.experienceScore),
    locationScore: Number(score.locationScore),
    complianceScore: Number(score.complianceScore),
    educationCertificationScore: Number(score.educationCertificationScore),
    finalFitScore: Number(score.finalFitScore),
    knnSimilarity: score.knnSimilarity !== null ? Number(score.knnSimilarity) : null,
    explanation: score.explanation,
  }));

  return {
    ...application,
    candidateFitScore: candidateScores?.[0] ? candidateScores[0].finalFitScore : null,
    candidateScores,
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

  // Pre-transition rule: CLIENT_ENDORSEMENT -> FINAL_INTERVIEW requires APPROVED client endorsement
  if (status === "FINAL_INTERVIEW") {
    const endorsement = await prisma.clientEndorsement.findFirst({
      where: {
        applicationId: id,
        outcome: { in: ["APPROVED", "ENDORSED"] },
      },
    });
    if (!endorsement) {
      throw new Error("Cannot move to FINAL_INTERVIEW. Client endorsement approval (outcome: APPROVED) is required.");
    }
  }

  // Pre-transition rule: FINAL_INTERVIEW -> COMPLIANCE requires PASS from client final evaluation
  if (status === "COMPLIANCE") {
    if (currentStatus === "FINAL_INTERVIEW") {
      const passedClientEval = await prisma.interview.findFirst({
        where: {
          applicationId: id,
          type: "FINAL_INTERVIEW",
          result: { in: ["PASS", "PASSED"] },
          isActive: true,
        },
      });
      if (!passedClientEval) {
        throw new Error("Cannot move to COMPLIANCE. Client final evaluation result must be PASS.");
      }
    } else if (currentStatus === "CLIENT_ENDORSEMENT") {
      const endorsement = await prisma.clientEndorsement.findFirst({
        where: {
          applicationId: id,
          outcome: { in: ["APPROVED", "ENDORSED"] },
        },
      });
      const passedClientEval = await prisma.interview.findFirst({
        where: {
          applicationId: id,
          type: "FINAL_INTERVIEW",
          result: { in: ["PASS", "PASSED"] },
          isActive: true,
        },
      });
      if (!endorsement && !passedClientEval) {
        throw new Error("Cannot move to COMPLIANCE. Client acceptance or passed evaluation is required.");
      }
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
    data: {
      status,
      ...(status === "ARCHIVED" ? { isArchived: true, archivedAt: new Date() } : {}),
    },
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

  void prisma.application
    .findUnique({
      where: { id },
      include: {
        jobPosting: { select: { title: true } },
        user: {
          select: {
            email: true,
            applicantProfile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    })
    .then((appInfo) => {
      const applicantName = appInfo?.user?.applicantProfile
        ? `${appInfo.user.applicantProfile.firstName || ""} ${appInfo.user.applicantProfile.lastName || ""}`.trim()
        : appInfo?.user?.email;
      void logAudit(resolvedActorId, "APPLICATION_STATUS_UPDATED", "Application", id, {
        fromStatus: currentStatus,
        toStatus: status,
        reason: reason || null,
        jobTitle: appInfo?.jobPosting?.title,
        applicantName,
        applicantEmail: appInfo?.user?.email,
      });
    })
    .catch(() => {});

  // Post-transition hook: Generate compliance requirements when entering COMPLIANCE
  if (status === "COMPLIANCE") {
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
  } else if (status === "COMPLIANCE" || status === "DEPLOYED") {
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

    // Ensure Candidate (User) is provisioned into the Digital 201 Employee roster
    let emp = await prisma.employee.findUnique({
      where: { userId: application.userId },
    });

    if (!emp) {
      const appDetails = await prisma.application.findUnique({
        where: { id },
        include: { jobPosting: { select: { title: true, location: true } } },
      });
      const generatedEmployeeNumber = `EMP-${new Date().getFullYear()}-${String(id).padStart(4, "0")}`;
      emp = await prisma.employee.create({
        data: {
          userId: application.userId,
          employeeNumber: generatedEmployeeNumber,
          department: "Operations",
          position: appDetails?.jobPosting?.title || "Specialist",
          hireDate: new Date(),
          originatingApplicationId: id,
          notes: reason || "Hired via TA recruitment pipeline",
          status: "ACTIVE",
        },
      });

      await prisma.employmentEvent.create({
        data: {
          employeeId: emp.id,
          eventType: "HIRED",
          description: reason || `Hired for position ${appDetails?.jobPosting?.title || "Specialist"}`,
          effectiveDate: new Date(),
          actorId: resolvedActorId,
          metadata: {
            applicationId: id,
            position: appDetails?.jobPosting?.title || "Specialist",
            employeeNumber: emp.employeeNumber,
          },
        },
      });
    }

    // If entering DEPLOYED, ensure active or scheduled Deployment record exists
    if (status === "DEPLOYED") {
      const existingDeployment = await prisma.deployment.findFirst({
        where: {
          employeeId: emp.id,
          status: { notIn: ["ENDED", "CANCELLED"] },
        },
      });

      if (!existingDeployment) {
        const appWithJob = await prisma.application.findUnique({
          where: { id },
          include: {
            jobPosting: {
              select: {
                location: true,
                mrfId: true,
                mrf: { select: { clientId: true } },
              },
            },
          },
        });

        let clientId = appWithJob?.jobPosting?.mrf?.clientId;
        if (!clientId) {
          const firstClient = await prisma.client.findFirst({ select: { id: true } });
          clientId = firstClient?.id || 1;
        }

        const deployment = await prisma.deployment.create({
          data: {
            employeeId: emp.id,
            applicationId: id,
            clientId,
            mrfId: appWithJob?.jobPosting?.mrfId || null,
            createdById: resolvedActorId,
            site: appWithJob?.jobPosting?.location || "Main Client Site",
            contractStart: new Date(),
            notes: reason || "Deployed via TA recruitment pipeline",
            status: "READY_FOR_DEPLOYMENT",
          },
        });

        await prisma.deploymentStatusHistory.create({
          data: {
            deploymentId: deployment.id,
            toStatus: "READY_FOR_DEPLOYMENT",
            changedById: resolvedActorId,
            reason: reason || "Auto-created on DEPLOYED stage transition",
          },
        });

        await prisma.employmentEvent.create({
          data: {
            employeeId: emp.id,
            eventType: "DEPLOYED",
            description: `Deployed to site (${appWithJob?.jobPosting?.location || "Main Client Site"})`,
            effectiveDate: new Date(),
            actorId: resolvedActorId,
            metadata: {
              deploymentId: deployment.id,
              clientId,
              site: appWithJob?.jobPosting?.location || "Main Client Site",
            },
          },
        });
      }
    }
  }

  const getCandidateStatusMessage = (statusStr: string) => {
    switch (statusStr) {
      case "TALENT_POOL":
        return "You were not selected for this position, but your profile may be considered for future job opportunities that match your qualifications.";
      case "REVIEW":
        return "Your application is currently under review.";
      case "INITIAL_SCREENING":
        return "Your application has advanced to Initial Screening.";
      case "CLIENT_ENDORSEMENT":
        return "Your application has been endorsed for client review.";
      case "FINAL_INTERVIEW":
        return "Your application has advanced to Final Interview.";
      case "COMPLIANCE":
        return "Employment documents (201) are needed. Please submit the requested documents.";
      case "DEPLOYED":
        return "You have been placed at your work site. Your employee record is ready.";
      case "ARCHIVED":
        return "Your application consideration has concluded.";
      default:
        return `Your application has been updated to ${statusStr.toLowerCase().replace(/_/g, " ")}.`;
    }
  };

  const notificationMessage = getCandidateStatusMessage(status);

  await sendNotification(
    application.userId,
    "Application Update",
    notificationMessage,
    "INFO",
    `/app/applications/${application.id}`
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

  void logAudit(actorId || application.userId, "APPLICATION_STATUS_UPDATED", "Application", id, {
    fromStatus,
    toStatus: "ARCHIVED",
    reason: reason || "Application archived",
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

  void logAudit(actorId || application.userId, "APPLICATION_STATUS_UPDATED", "Application", id, {
    fromStatus: "ARCHIVED",
    toStatus: "SUBMITTED",
    reason: reason || "Application restored to SUBMITTED",
  });

  return updated;
};

/**
 * Automatically categorizes a candidate based on their AI score if they are in the pre-screening phase.
 * Prevents downward progression if the candidate has already advanced to an interview or beyond.
 */
export const applyScoreCategorization = async (applicationId: number, score: number, customThreshold?: number) => {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, status: true }
  });

  if (!application) return;

  const preScreeningStatuses = ["SUBMITTED", "PARSING", "NEEDS_ATTENTION", "REVIEW", "MATCHED"];
  
  if (!preScreeningStatuses.includes(application.status)) {
    return; // Do not overwrite advanced statuses
  }

  let threshold: number = typeof customThreshold === "number" ? customThreshold : 60;
  if (customThreshold === undefined) {
    try {
      const activeConfig = await getActiveScoringConfiguration();
      if (typeof activeConfig?.matchThreshold === "number") {
        threshold = activeConfig.matchThreshold;
      }
    } catch {
      threshold = 60;
    }
  }

  const nextStatus = score >= threshold ? "MATCHED" : "REVIEW";

  if (application.status !== nextStatus) {
    await updateTAApplicationStatus(
      applicationId, 
      nextStatus, 
      undefined, 
      `AI Score (${score}) resulted in categorization: ${nextStatus}`
    );
  }
};
