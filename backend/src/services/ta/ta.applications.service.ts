import prisma from '../../utils/prisma.js';
import { Prisma } from '@prisma/client';
import { ApplicationStatus } from "@prisma/client";
import { sendNotification, sendRoleNotification } from '../../utils/notification.js';
import { scoringFlags } from '../../utils/scoring-flags.js';
import { getActiveScoringConfiguration } from "../scoring/scoring-configuration.service.js";
import { isFullyCompliant, generateComplianceRequirementsFromMRF } from "./ta.compliance.service.js";
import { logAudit } from '../../utils/audit.js';
import { resolveDocumentSignedUrl, resolveDocumentSignedUrls, uploadAndStoreDocument } from '../document/document.service.js';
import { buildContractPdfBuffer } from './contract-pdf-builder.js';
import { rebuildCandidateFeatureProfile } from "../scoring/talent-pool-knn.service.js";
import { isValidDateOnly, manilaDateString, parseManilaDateOnly, toManilaDateOnly } from "../../schemas/field-limits.js";
import { ownedWhere, type Actor } from "./ownership.js";
import { syncMRFFulfillmentStatus } from "./ta.mrf.service.js";

import { ALLOWED_TRANSITIONS, SKIPPABLE_STAGES, stagesBetween, type TransitionType } from "./pipeline-rules.js";
export { ALLOWED_TRANSITIONS };

export interface ListTAApplicationsOptions {
  status?: string;
  jobPostingId?: string;
  clientId?: number | string;
  search?: string;
  isArchived?: boolean;
  page?: number;
  limit?: number;
  mineOnly?: boolean;
  returningOnly?: boolean;
  actor?: Actor;
  currentUserId?: string;
  postedById?: string;
  summary?: boolean;
}

export interface ReturningWorkerInfo {
  /** True when the worker was previously placed at the same client as this job opening. */
  sameClient: boolean;
  clientName: string;
  priorPlacements: number;
}

// A placement counts as "prior" only if it actually started, matching the same-client
// routing rule used when the application was submitted.
const startedPlacementWhere = {
  status: { in: ["ACTIVE", "ENDED"] as ("ACTIVE" | "ENDED")[] },
  OR: [
    { actualStart: { not: null } },
    { statusHistory: { some: { toStatus: "ACTIVE" as const } } },
    { status: "ENDED" as const, contractStart: { not: null } },
  ],
};

const attachReturningInfo = async <
  T extends {
    id: number;
    createdAt: Date;
    user?: { id: string } | null;
    jobPosting?: { mrf?: { clientId?: number | null } | null } | null;
  },
>(applications: T[]): Promise<(T & { returning: ReturningWorkerInfo | null })[]> => {
  const userIds = [...new Set(applications.map((a) => a.user?.id).filter((id): id is string => Boolean(id)))];
  const placements = userIds.length === 0
    ? []
    : await prisma.deployment.findMany({
        where: { employee: { userId: { in: userIds } }, ...startedPlacementWhere },
        select: {
          applicationId: true,
          clientId: true,
          createdAt: true,
          client: { select: { name: true } },
          employee: { select: { userId: true } },
        },
        orderBy: { createdAt: "desc" },
      });

  return applications.map((application) => {
    const jobClientId = application.jobPosting?.mrf?.clientId ?? null;
    const prior = placements.filter(
      (p) =>
        p.employee.userId === application.user?.id &&
        p.applicationId !== application.id &&
        p.createdAt < application.createdAt
    );
    if (prior.length === 0) return { ...application, returning: null };
    const sameClient = jobClientId !== null ? prior.filter((p) => p.clientId === jobClientId) : [];
    const reference = sameClient[0] ?? prior[0];
    return {
      ...application,
      returning: {
        sameClient: sameClient.length > 0,
        clientName: reference.client.name,
        priorPlacements: prior.length,
      },
    };
  });
};

// The placement must predate the application (d.createdAt < a.createdAt), a cross-row comparison a Prisma
// relation filter cannot express, so the IDs still come from SQL. Narrow it to the TA's own applications
// (same rule as ownedWhere.application) and the requested job so a TA never scans other TAs' rows.
const findReturningApplicationIds = async (actor?: Actor, jobPostingId?: number): Promise<number[]> => {
  const jobFilter = jobPostingId !== undefined ? Prisma.sql`AND a."jobPostingId" = ${jobPostingId}` : Prisma.empty;
  const ownerFilter = actor?.role === "TALENT_ACQUISITION"
    ? Prisma.sql`AND EXISTS (
        SELECT 1 FROM "JobPosting" jp
        LEFT JOIN "ManpowerRequest" m ON m."id" = jp."mrfId"
        WHERE jp."id" = a."jobPostingId"
          AND (m."assignedTaId" = ${actor.id} OR (jp."mrfId" IS NULL AND jp."postedById" = ${actor.id})))`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT a."id"
    FROM "Application" a
    WHERE EXISTS (
      SELECT 1
      FROM "Employee" e
      JOIN "Deployment" d ON d."employeeId" = e."id"
      WHERE e."userId" = a."userId"
        AND d."status" IN ('ACTIVE', 'ENDED')
        AND (d."actualStart" IS NOT NULL
          OR (d."status" = 'ENDED' AND d."contractStart" IS NOT NULL)
          OR EXISTS (SELECT 1 FROM "DeploymentStatusHistory" h WHERE h."deploymentId" = d."id" AND h."toStatus" = 'ACTIVE'))
        AND (d."applicationId" IS NULL OR d."applicationId" <> a."id")
        AND d."createdAt" < a."createdAt")
    ${jobFilter}
    ${ownerFilter}
  `;
  return rows.map((row) => row.id);
};

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

  const { status, jobPostingId, clientId, search, isArchived, page, limit, mineOnly, returningOnly, currentUserId, postedById, summary, actor } = options;
  const dynamicScoring = scoringFlags.dynamicCandidateScoringEnabled();
  const configuration = dynamicScoring ? await getActiveScoringConfiguration() : null;

  const andConditions: any[] = [];
  if (actor) andConditions.push(ownedWhere.application(actor));

  if (postedById || (mineOnly && currentUserId)) {
    andConditions.push({ jobPosting: { postedById: postedById || currentUserId } });
  }

  if (status) {
    andConditions.push({ status: status as ApplicationStatus });
  }

  if (jobPostingId) {
    const parsedJobId = parseInt(String(jobPostingId), 10);
    if (!isNaN(parsedJobId)) {
      andConditions.push({ jobPostingId: parsedJobId });
    }
  }

  if (clientId !== undefined && clientId !== null && clientId !== "") {
    const parsedClientId = typeof clientId === "string" ? parseInt(clientId, 10) : clientId;
    if (!isNaN(parsedClientId)) {
      andConditions.push({
        OR: [
          { jobPosting: { mrf: { clientId: parsedClientId } } },
          { clientEndorsements: { some: { clientId: parsedClientId } } },
          { deployments: { some: { clientId: parsedClientId } } },
        ],
      });
    }
  }

  if (returningOnly) {
    const parsedJobId = jobPostingId ? parseInt(String(jobPostingId), 10) : NaN;
    andConditions.push({ id: { in: await findReturningApplicationIds(actor, isNaN(parsedJobId) ? undefined : parsedJobId) } });
  }

  if (isArchived !== undefined) {
    andConditions.push({ isArchived: Boolean(isArchived) });
  } else if (!status) {
    andConditions.push({ isArchived: false });
  }

  if (search && search.trim()) {
    const q = search.trim();
    const tokens = q.split(/\s+/).filter(Boolean);

    if (tokens.length > 1) {
      const tokenConditions = tokens.map((token) => ({
        OR: [
          { user: { email: { contains: token, mode: "insensitive" } } },
          { user: { applicantProfile: { firstName: { contains: token, mode: "insensitive" } } } },
          { user: { applicantProfile: { lastName: { contains: token, mode: "insensitive" } } } },
          { user: { applicantProfile: { mobileNumber: { contains: token, mode: "insensitive" } } } },
          { jobPosting: { title: { contains: token, mode: "insensitive" } } },
          { jobPosting: { location: { contains: token, mode: "insensitive" } } },
          { jobPosting: { mrf: { client: { name: { contains: token, mode: "insensitive" } } } } },
        ],
      }));
      andConditions.push({ AND: tokenConditions });
    } else {
      andConditions.push({
        OR: [
          { user: { email: { contains: q, mode: "insensitive" } } },
          { user: { applicantProfile: { firstName: { contains: q, mode: "insensitive" } } } },
          { user: { applicantProfile: { lastName: { contains: q, mode: "insensitive" } } } },
          { user: { applicantProfile: { mobileNumber: { contains: q, mode: "insensitive" } } } },
          { jobPosting: { title: { contains: q, mode: "insensitive" } } },
          { jobPosting: { location: { contains: q, mode: "insensitive" } } },
          { jobPosting: { mrf: { client: { name: { contains: q, mode: "insensitive" } } } } },
        ],
      });
    }
  }

  const where: any = andConditions.length > 0 ? { AND: andConditions } : {};

  if (summary) {
    const resolvedPage = page ?? 1;
    const resolvedLimit = limit ?? 25;
    const [total, applications] = await Promise.all([
      prisma.application.count({ where }),
      prisma.application.findMany({
        where,
        skip: (resolvedPage - 1) * resolvedLimit,
        take: resolvedLimit,
        orderBy: dynamicScoring ? { createdAt: "desc" } : [
          { aiScore: { sort: "desc", nulls: "last" } },
          { createdAt: "desc" },
        ],
        select: {
          id: true,
          status: true,
          aiScore: true,
          isArchived: true,
          createdAt: true,
          jobPosting: {
            select: {
              id: true,
              title: true,
              location: true,
              mrf: { select: { id: true, title: true, clientId: true, client: { select: { id: true, name: true } } } },
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              applicantProfile: { select: { firstName: true, lastName: true, mobileNumber: true } },
            },
          },
          _count: { select: { interviews: true, recruiterDecisions: true, complianceRequirements: true } },
        },
      }),
    ]);


    const scoreRows = applications.length === 0
      ? []
      : await prisma.$queryRaw<Array<{ applicationId: number; finalFitScore: number; calculatedAt: Date }>>`
          SELECT DISTINCT ON (score."applicationId") score."applicationId", score."finalFitScore", score."calculatedAt"
          FROM "CandidateScore" AS score
          JOIN "Application" AS application ON application."id" = score."applicationId"
          WHERE application."id" IN (${Prisma.join(applications.map((application) => application.id))})
            AND score."jobPostingId" = application."jobPostingId"
          ORDER BY score."applicationId",
            CASE WHEN score."configurationId" = ${configuration?.id ?? -1} AND score."status" = 'CALCULATED' THEN 0 ELSE 1 END,
            score."calculatedAt" DESC, score."id" DESC
        `;
    const scoresByApplication = new Map(scoreRows.map((row) => [row.applicationId, row]));

    const items = (await attachReturningInfo(applications)).map((application) => {
        const score = scoresByApplication.get(application.id);
        const { _count, ...row } = application;
        return {
          ...row,
          candidateFitScore: score ? Number(score.finalFitScore) : null,
          candidateFitScoreCalculatedAt: score?.calculatedAt ?? null,
          candidateScoringConfigurationVersion: configuration?.version ?? null,
          interviewCount: _count.interviews,
          recruiterDecisionCount: _count.recruiterDecisions,
        };
      }).sort((left, right) => {
        if (dynamicScoring) {
          return (right.candidateFitScore ?? -1) - (left.candidateFitScore ?? -1)
            || right.createdAt.getTime() - left.createdAt.getTime();
        }
        return (right.candidateFitScore ?? right.aiScore ?? -1) - (left.candidateFitScore ?? left.aiScore ?? -1)
          || right.createdAt.getTime() - left.createdAt.getTime();
      });

    return {
      items,
      total,
      page: resolvedPage,
      pageSize: resolvedLimit,
      totalPages: Math.ceil(total / resolvedLimit),
    };
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
        jobPosting: {
          select: {
            id: true,
            title: true,
            location: true,
            mrfId: true,
            mrf: {
              select: {
                id: true,
                title: true,
                clientId: true,
                client: { select: { id: true, name: true } },
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            applicantProfile: {
              select: { firstName: true, lastName: true, mobileNumber: true, city: true, province: true, photoUrl: true },
            },
          },
        },
        candidateScores: {
          orderBy: { calculatedAt: "desc" },
          take: 1,
          select: { id: true, jobPostingId: true, configurationId: true, status: true, finalFitScore: true, calculatedAt: true },
        },
        complianceRequirements: {
          select: {
            id: true,
            documentLabel: true,
            reviewStatus: true,
            isRequired: true,
            updatedAt: true,
            deadline: true,
            documentId: true,
            toFollowExpectedAt: true,
            reviewNotes: true,
            expiresAt: true,
          },
        },
      },
    }),
  ]);


  const formatted = (await attachReturningInfo(applications))
    .map((application) => {
      const activeScore = configuration
        ? application.candidateScores?.find((cs) => cs.jobPostingId === application.jobPosting.id && cs.configurationId === configuration.id && cs.status === "CALCULATED")
        : null;
      const latestScore = activeScore ?? application.candidateScores?.[0] ?? null;
      const candidateFitScore = latestScore ? Number(latestScore.finalFitScore) : null;
      const candidateFitScoreCalculatedAt = latestScore?.calculatedAt ?? null;
      const { candidateScores, ...rest } = application;
      return {
        ...rest,
        candidateFitScore,
        candidateFitScoreCalculatedAt,
        candidateScoringConfigurationVersion: configuration?.version ?? null,
        candidateScores: latestScore ? [{ finalFitScore: candidateFitScore, calculatedAt: candidateFitScoreCalculatedAt }] : [],
      };
    })
    .sort((left, right) => {
      if (dynamicScoring) {
        return (right.candidateFitScore ?? -1) - (left.candidateFitScore ?? -1) || right.createdAt.getTime() - left.createdAt.getTime();
      }
      return (right.candidateFitScore ?? right.aiScore ?? -1) - (left.candidateFitScore ?? left.aiScore ?? -1) || right.createdAt.getTime() - left.createdAt.getTime();
    });

  const photoUrls = await resolveDocumentSignedUrls(
    formatted.map((application) => ({
      ref: application.user ? application.user.applicantProfile?.photoUrl : null,
      requesterId: application.user?.id ?? "",
      requesterRole: "TALENT_ACQUISITION",
    }))
  );
  const resolvedData = formatted.map((application, index) => {
    if (!application.user?.applicantProfile?.photoUrl) return application;
    return {
      ...application,
      user: {
        ...application.user,
        applicantProfile: { ...application.user.applicantProfile, photoUrl: photoUrls[index] },
      },
    };
  });

  return {
    data: resolvedData,
    total,
    page: page || 1,
    limit: limit || total,
    totalPages: limit ? Math.max(1, Math.ceil(total / limit)) : 1,
  };
};

export const getTAApplication = async (id: number, options: { generateRequirements?: boolean } = {}) => {
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
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              status: true,
              deployments: {
                select: {
                  id: true,
                  status: true,
                  clientId: true,
                },
              },
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
      backout: true,
      closures: { where: { reopenedAt: null }, orderBy: { createdAt: "desc" }, take: 1 },
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

  // Opening an application normally fills in its requirements checklist. Read-only callers (Admin) skip that write.
  if (
    options.generateRequirements !== false &&
    application.status === "COMPLIANCE" &&
    (!application.complianceRequirements || application.complianceRequirements.length === 0)
  ) {
    try {
      const generated = await generateComplianceRequirementsFromMRF(application.id);
      if (generated?.length) {
        application.complianceRequirements = generated as any;
      }
    } catch {
      // Safe fallback
    }
  }

  // Compute fallback 7-day SLA deadline in-memory for any legacy requirements lacking one
  if (application.complianceRequirements?.length) {
    for (const req of application.complianceRequirements) {
      if (!req.deadline) {
        req.deadline = new Date((req.createdAt instanceof Date ? req.createdAt.getTime() : (req.createdAt ? new Date(req.createdAt).getTime() : Date.now())) + 7 * 24 * 60 * 60 * 1000);
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

  let photoUrl = application.user?.applicantProfile?.photoUrl ?? null;
  if (photoUrl && application.user) {
    try {
      const resolved = await resolveDocumentSignedUrl(
        photoUrl,
        application.user.id,
        "TALENT_ACQUISITION"
      );
      if (resolved) photoUrl = resolved;
    } catch {
      photoUrl = null;
    }
  }

  let resolvedAppResumeUrl = application.resumeUrl;
  if (resolvedAppResumeUrl && application.user) {
    try {
      const resolved = await resolveDocumentSignedUrl(
        resolvedAppResumeUrl,
        application.user.id,
        "TALENT_ACQUISITION"
      );
      if (resolved) resolvedAppResumeUrl = resolved;
    } catch {
      resolvedAppResumeUrl = null;
    }
  }

  let resolvedProfileResumeUrl = application.user?.applicantProfile?.resumeUrl ?? null;
  if (resolvedProfileResumeUrl && application.user) {
    try {
      const resolved = await resolveDocumentSignedUrl(
        resolvedProfileResumeUrl,
        application.user.id,
        "TALENT_ACQUISITION"
      );
      if (resolved) resolvedProfileResumeUrl = resolved;
    } catch {
      resolvedProfileResumeUrl = null;
    }
  }

  const isRedeploymentEligible = Boolean(
    application.user?.employee &&
      (application.user.employee.status === "AVAILABLE_FOR_REDEPLOYMENT" ||
        (application.user.employee.deployments && application.user.employee.deployments.length > 0))
  );

  return {
    ...application,
    isRedeploymentEligible,
    resumeUrl: resolvedAppResumeUrl,
    candidateFitScore: candidateScores?.[0] ? candidateScores[0].finalFitScore : null,
    candidateScores,
    user: {
      ...application.user,
      applicantProfile: application.user.applicantProfile
        ? {
            ...application.user.applicantProfile,
            photoUrl,
            resumeUrl: resolvedProfileResumeUrl,
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
  reason?: string,
  reasonCode?: string
) => {
  const application = await prisma.application.findUnique({
    where: { id },
    select: { id: true, status: true, isArchived: true, userId: true },
  });

  if (!application) throw new Error("Application not found");
  if (status === "BACKOUT" || status === "REJECTED") {
    throw new Error("Use Reject Applicant or Mark as Backed Out so the stage, reason and disposition are recorded.");
  }
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
  // Or direct progression: INITIAL_SCREENING -> FINAL_INTERVIEW requires passed INITIAL_SCREENING interview
  if (status === "FINAL_INTERVIEW") {
    if (currentStatus === "CLIENT_ENDORSEMENT") {
      const endorsement = await prisma.clientEndorsement.findFirst({
        where: {
          applicationId: id,
          outcome: { in: ["APPROVED", "ENDORSED"] },
        },
      });
      if (!endorsement) {
        throw new Error("Cannot move to FINAL_INTERVIEW. Client endorsement approval (outcome: APPROVED) is required.");
      }
    } else if (currentStatus === "INITIAL_SCREENING") {
      const screening = await prisma.interview.findFirst({
        where: {
          applicationId: id,
          type: "INITIAL_SCREENING",
          result: { in: ["PASS", "PASSED"] },
          isActive: true,
        },
      });
      if (!screening) {
        throw new Error("Cannot move to FINAL_INTERVIEW. A passed INITIAL_SCREENING interview is required.");
      }
    }
  }

  // Authorised skip detection: stages bypassed on the main pipeline (Client review / Final interview only).
  let transitionType: TransitionType = "NORMAL";
  let skippedStages: string[] = stagesBetween(currentStatus, status);

  // Pre-transition rule: FINAL_INTERVIEW -> COMPLIANCE requires a PASS from the client final evaluation.
  // (Redeployed / same-client candidates reach Requirements through Fast Track, which is recorded separately.)
  if (status === "COMPLIANCE") {
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
  }

  if (skippedStages.length > 0) {
    const illegal = skippedStages.filter((stage) => !SKIPPABLE_STAGES.includes(stage));
    if (illegal.length > 0) {
      throw new Error(`Stage(s) cannot be skipped: ${illegal.join(", ")}.`);
    }
    if (!reason || !reason.trim()) {
      throw new Error(
        `A reason is required to skip ${skippedStages.join(" and ")}. Provide the client instruction or recruitment rule that justifies the skip.`
      );
    }
    transitionType = "SKIP";
  }

  // Pre-transition rule: COMPLIANCE -> CONTRACT_SIGNING requires all mandatory requirements APPROVED & valid
  if (status === "CONTRACT_SIGNING") {
    const compliant = await isFullyCompliant(id);
    if (!compliant) {
      throw new Error("Cannot move to Contract Signing. All mandatory compliance documents must be APPROVED and valid.");
    }
  }

  // Pre-transition rule: CONTRACT_SIGNING -> DEPLOYED requires:
  // 1. All mandatory compliance APPROVED
  // 2. The signed contract scan uploaded and recorded
  if (status === "DEPLOYED") {
    const compliant = await isFullyCompliant(id);
    if (!compliant) {
      throw new Error("Cannot deploy candidate. All required compliance documents must be APPROVED and valid.");
    }
    const appRecord = await prisma.application.findUnique({
      where: { id },
      select: { contractSigned: true, contractDocumentId: true },
    });
    if (!appRecord?.contractSigned || !appRecord.contractDocumentId) {
      throw new Error("Cannot deploy candidate. Upload the signed employment contract first.");
    }
  }

  // Execute status update
  const resolvedActorId = actorId || application.userId;
  const updated = await prisma.application.update({
    where: { id },
    data: {
      status,
      ...(status === "ARCHIVED" ? { isArchived: true, archivedAt: new Date() } : {}),
    },
    select: { id: true, status: true, updatedAt: true },
  });

  // Record audit decision (including authorised skips)
  await prisma.recruiterDecision.create({
    data: {
      applicationId: id,
      actorId: resolvedActorId,
      fromStatus: currentStatus,
      toStatus: status,
      reason: reason?.trim() || null,
      reasonCode: reasonCode ?? null,
      transitionType,
      skippedStages,
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
        transitionType,
        skippedStages,
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
  if (
    status === "TALENT_POOL" ||
    (status === "ARCHIVED" && ["CLIENT_ENDORSEMENT", "FINAL_INTERVIEW"].includes(currentStatus))
  ) {
    const appWithProfile = await prisma.application.findUnique({
      where: { id },
      include: { user: { select: { applicantProfile: { select: { id: true, hasNoShowHistory: true } } } } },
    });
    if (appWithProfile?.user?.applicantProfile) {
      const applicantProfileId = appWithProfile.user.applicantProfile.id;
      if (!appWithProfile.user.applicantProfile.hasNoShowHistory) {
        const poolNotes = reason || (status === "ARCHIVED" ? "Auto-retained in talent pool following rejection after client review" : null);
        await prisma.talentPoolMembership.upsert({
          where: { applicantProfileId },
          create: {
            applicantProfileId,
            sourceApplicationId: id,
            status: "ACTIVE",
            availability: "AVAILABLE",
            addedById: resolvedActorId,
            notes: poolNotes,
          },
          update: {
            sourceApplicationId: id,
            status: "ACTIVE",
            availability: "AVAILABLE",
            addedById: resolvedActorId,
            notes: poolNotes,
          },
        });
        await rebuildCandidateFeatureProfile(applicantProfileId).catch(() => {});
      }
    }
  } else if (status === "COMPLIANCE" || status === "CONTRACT_SIGNING" || status === "DEPLOYED") {
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
            contractStart: appWithJob?.contractStartDate ?? new Date(),
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

        // Keep the requisition's FILLED / OPEN status in step with the seat this deployment takes.
        if (deployment.mrfId) await syncMRFFulfillmentStatus(deployment.mrfId, resolvedActorId).catch(() => {});

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
      case "CONTRACT_SIGNING":
        return "Your application has advanced to Contract Signing. Your TA will contact you to sign your employment contract.";
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
    `/app/applications/${application.id}`,
    {
      sendEmail: true,
      ctaText: "View Application",
    }
  );




  return updated;
};

const CONTRACT_SCAN_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const parseContractStartDate = (value: string | undefined) => {
  const startDate = value ? toManilaDateOnly(value) : undefined;
  if (!startDate || !isValidDateOnly(startDate)) throw new Error("A valid start date is required.");
  return parseManilaDateOnly(startDate);
};

// Optional printable copy: name, position and start date prefilled; the daily rate is written by hand.
export const getContractPdf = async (applicationId: number, startDateInput?: string) => {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      contractStartDate: true,
      jobPosting: { select: { title: true } },
      user: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } },
    },
  });
  if (!application) throw new Error("Application not found");

  const startDate = startDateInput
    ? parseContractStartDate(startDateInput)
    : application.contractStartDate ?? parseManilaDateOnly(manilaDateString());

  const profile = application.user?.applicantProfile;
  const employeeName =
    `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim() || application.user?.email || "";
  const buffer = await buildContractPdfBuffer({
    employeeName,
    issueDate: new Date(),
    startDate,
    position: application.jobPosting?.title || "",
  });
  return { buffer, fileName: `MEGS-Contract-${applicationId}.pdf` };
};

// A contract start may be back-dated by up to 30 days (a candidate who already began) and set at most 2 years ahead.
const CONTRACT_START_BACKDATE_DAYS = 30;
const CONTRACT_START_MAX_YEARS_AHEAD = 2;
// Calendar-day arithmetic on YYYY-MM-DD dates in the Manila calendar.
const shiftManilaDay = (day: string, shift: { days?: number; years?: number }): string => {
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  return new Date(Date.UTC(year + (shift.years ?? 0), month - 1, dayOfMonth + (shift.days ?? 0))).toISOString().slice(0, 10);
};

// The TA photographs or scans the signed paper contract. Saving it records the start date and deploys the candidate.
export const recordSignedContract = async (
  applicationId: number,
  file: Express.Multer.File,
  data: { startDate: string },
  actorId: string
) => {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      isArchived: true,
      contractSigned: true,
      contractSignedAt: true,
      contractSignedById: true,
      contractStartDate: true,
      contractDocumentId: true,
    },
  });
  if (!application) throw new Error("Application not found");
  if (application.status !== "CONTRACT_SIGNING") {
    throw new Error("The signed contract can only be uploaded while the application is in the Contract Signing stage.");
  }
  if (application.isArchived) {
    throw new Error("Cannot change status of an archived application. Restore it first.");
  }
  if (!CONTRACT_SCAN_MIME_TYPES.includes(file.mimetype)) {
    throw new Error("The signed contract must be a PDF or an image (JPEG, PNG, WEBP).");
  }
  const contractStartDate = parseContractStartDate(data.startDate);
  const startDay = toManilaDateOnly(contractStartDate);
  const today = manilaDateString();
  if (
    startDay < shiftManilaDay(today, { days: -CONTRACT_START_BACKDATE_DAYS }) ||
    startDay > shiftManilaDay(today, { years: CONTRACT_START_MAX_YEARS_AHEAD })
  ) {
    throw new Error("Start date is outside the allowed range.");
  }
  // Deploy prerequisites are checked before anything is stored or written (the DEPLOYED transition enforces the same rules).
  if (!(await isFullyCompliant(applicationId))) {
    throw new Error("Cannot deploy candidate. All required compliance documents must be APPROVED and valid.");
  }

  const stored = await uploadAndStoreDocument(actorId, "CONTRACT", file, applicationId);
  const now = new Date();
  let updated: Awaited<ReturnType<typeof updateTAApplicationStatus>>;
  try {
    await prisma.$transaction(async (tx) => {
      if (application.contractDocumentId) {
        await tx.storedDocument.updateMany({ where: { id: application.contractDocumentId }, data: { deletedAt: now } });
      }
      await tx.application.update({
        where: { id: applicationId },
        data: {
          contractSigned: true,
          contractSignedAt: now,
          contractSignedById: actorId,
          contractDocumentId: stored.id,
          contractStartDate,
        },
      });
    });
    updated = await updateTAApplicationStatus(applicationId, "DEPLOYED", actorId, "Signed employment contract uploaded");
  } catch (error) {
    // The candidate was not deployed: put the previous contract record back and retire the new scan.
    // Skipped once the status has moved on, because the candidate is then deployed with this contract.
    const current = await prisma.application.findUnique({ where: { id: applicationId }, select: { status: true } }).catch(() => null);
    if (current?.status === "CONTRACT_SIGNING") {
      await prisma.$transaction(async (tx) => {
        if (application.contractDocumentId) {
          await tx.storedDocument.updateMany({ where: { id: application.contractDocumentId }, data: { deletedAt: null } });
        }
        await tx.storedDocument.updateMany({ where: { id: stored.id }, data: { deletedAt: now } });
        await tx.application.update({
          where: { id: applicationId },
          data: {
            contractSigned: application.contractSigned,
            contractSignedAt: application.contractSignedAt,
            contractSignedById: application.contractSignedById,
            contractDocumentId: application.contractDocumentId,
            contractStartDate: application.contractStartDate,
          },
        });
      }).catch(() => {});
    }
    throw error;
  }

  void logAudit(actorId, "CONTRACT_SIGNED", "Application", applicationId, {
    applicationId,
    contractSignedAt: now,
    documentId: stored.id,
  });

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
  // BACKOUT has no table transitions, but a Backed Out application with the Archive disposition
  // ends as BACKOUT + isArchived (docs/closure-redesign-plan.md), so archiving it stays allowed.
  const allowed = ALLOWED_TRANSITIONS[application.status] ?? [];
  // REJECTED rows are likewise archived to clear them from the active list.
  if (application.status !== "BACKOUT" && application.status !== "REJECTED" && !allowed.includes("ARCHIVED")) {
    throw new Error(`An application in ${application.status} cannot be archived`);
  }
  const activeDeployment = await prisma.deployment.findFirst({
    where: { applicationId: id, status: "ACTIVE" },
    select: { id: true },
  });
  if (activeDeployment) throw new Error("Applications with an active deployment can't be archived.");

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
  // The closure stays as history; reopening it lets the application be closed again later.
  await prisma.applicationClosure.updateMany({
    where: { applicationId: id, reopenedAt: null },
    data: { reopenedAt: new Date() },
  });

  await prisma.recruiterDecision.create({
    data: {
      applicationId: id,
      actorId: actorId || application.userId,
      fromStatus: application.status,
      toStatus: "SUBMITTED",
      reason: reason || "Application restored to SUBMITTED",
    },
  });

  void logAudit(actorId || application.userId, "APPLICATION_STATUS_UPDATED", "Application", id, {
    fromStatus: application.status,
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
    select: {
      id: true,
      status: true,
      user: {
        select: {
          email: true,
          applicantProfile: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      jobPosting: {
        select: {
          title: true,
          postedById: true,
        },
      },
    },
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

    if (nextStatus === "MATCHED") {
      const candProfile = application.user?.applicantProfile;
      const candidateName = (candProfile?.firstName || candProfile?.lastName)
        ? `${candProfile.firstName || ""} ${candProfile.lastName || ""}`.trim()
        : application.user?.email || "Candidate";
      const jobTitle = application.jobPosting?.title || "Requisition";
      const postedById = application.jobPosting?.postedById;

      const notifTitle = "Candidate Matched by AI";
      const notifMessage = `${candidateName} achieved a match score of ${score}% for "${jobTitle}".`;
      const notifType = "SUCCESS";
      const link = `/ta/applications/${applicationId}`;

      if (postedById) {
        await sendNotification(postedById, notifTitle, notifMessage, notifType, link);
      } else {
        await sendRoleNotification("TALENT_ACQUISITION", notifTitle, notifMessage, notifType, link);
      }
    }
  }
};

// Export aliases for consistency with architectural guidelines
export const listApplicationsService = listTAApplications;
export const listApplicationsPaginatedService = listTAApplications;
export const getApplicationDetailsService = getTAApplication;
