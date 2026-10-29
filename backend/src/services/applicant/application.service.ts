import crypto from 'node:crypto';
import { assertRequirementStage } from "../ta/pipeline-rules.js";
import prisma from '../../utils/prisma.js';
import { uploadFileToSupabaseWithInfo } from '../../middleware/upload.middleware.js';
import { logAudit } from '../../utils/audit.js';
import { assertOwns, JOB_OWNER_SELECT } from '../ta/ownership.js';
import { notifyJobOwner, sendNotification } from '../../utils/notification.js';
import { enqueueResumeAnalysis, enqueueResumeSideTask, trackFitRevalidation } from '../../workers/resume.worker.js';
import { revalidateApplication } from "../scoring/scoring-configuration.service.js";
import {
  ensureApplicantProfile,
  updateProfileResumeService,
} from './applicant.service.js';
import { fillBlanksFromParse, parseResumeToProposal } from './resume-merge.service.js';
import { buildApplicantJobWhere, type ApplicantJobFilters } from './job-filter.service.js';

export const fetchOpenJobs = async (filters?: ApplicantJobFilters & { page?: number; limit?: number }) => {
  const where: any = { status: "OPEN", ...(await buildApplicantJobWhere(filters)) };

  if (filters?.search && filters.search.trim()) {
    const term = filters.search.trim();
    where.OR = [
      { title: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
      { requirements: { contains: term, mode: "insensitive" } },
      { location: { contains: term, mode: "insensitive" } },
      // The landing page's "Hiring now" chips search by company, so the client's names must match too.
      { mrf: { client: { name: { contains: term, mode: "insensitive" } } } },
      { mrf: { client: { tradeName: { contains: term, mode: "insensitive" } } } },
    ];
  }

  const paginationRequested = filters?.page !== undefined || filters?.limit !== undefined;
  const page = filters?.page ?? 1;
  const limit = filters?.limit ?? 25;
  const [jobs, total] = await Promise.all([
    prisma.jobPosting.findMany({
    where,
    orderBy: { createdAt: "desc" },
    ...(paginationRequested ? { skip: (page - 1) * limit, take: limit } : {}),
    select: {
      id: true,
      title: true,
      description: true,
      requirements: true,
      location: true,
      imageUrl: true,
      status: true,
      createdAt: true,
      _count: { select: { applications: true } },
      mrf: {
        select: {
          location: true,
          client: {
            select: {
              id: true,
              name: true,
              tradeName: true,
              industry: true,
              city: true,
              province: true,
            },
          },
          employmentType: true,
          workArrangement: true,
          salaryRangeMin: true,
          salaryRangeMax: true,
        },
      },
    },
    }),
    paginationRequested ? prisma.jobPosting.count({ where }) : Promise.resolve(0),
  ]);

  if (!paginationRequested) return jobs;
  return { items: jobs, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) };
};

export const fetchOpenEmployerSummary = async () => {
  const employers = await prisma.$queryRaw<Array<{ name: string; industry: string | null; jobCount: number }>>`
    WITH ranked_open_jobs AS (
      SELECT
        client."name",
        client."industry",
        job."createdAt",
        COUNT(job."id") OVER (PARTITION BY client."name")::int AS "jobCount",
        MAX(job."createdAt") OVER (PARTITION BY client."name") AS "newestJobAt",
        ROW_NUMBER() OVER (
          PARTITION BY client."name"
          ORDER BY job."createdAt" DESC, job."id" DESC
        ) AS newest_for_employer
      FROM "JobPosting" AS job
      JOIN "ManpowerRequest" AS mrf ON mrf."id" = job."mrfId"
      JOIN "Client" AS client ON client."id" = mrf."clientId"
      WHERE job."status" = 'OPEN'
    )
    SELECT "name", "industry", "jobCount"
    FROM ranked_open_jobs
    WHERE newest_for_employer = 1
    ORDER BY "newestJobAt" DESC, "name" ASC
  `;
  return { employers };
};

export interface ActiveDeploymentStatus {
  isCurrentlyDeployed: boolean;
  clientName?: string;
  positionTitle?: string;
  deploymentId?: number;
}

export const getActiveDeploymentStatus = async (userId: string): Promise<ActiveDeploymentStatus> => {
  const deployment = await prisma.deployment.findFirst({
    where: { employee: { userId }, status: { notIn: ["ENDED", "CANCELLED"] } },
    include: { client: { select: { name: true } }, application: { select: { jobPosting: { select: { title: true } } } }, mrf: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (!deployment) return { isCurrentlyDeployed: false };
  return {
    isCurrentlyDeployed: true,
    clientName: deployment.client.name,
    positionTitle: deployment.application?.jobPosting.title || deployment.mrf?.title,
    deploymentId: deployment.id,
  };
};
export const fetchJobDetails = async (jobId: number, userId: string) => {
  const job = await prisma.jobPosting.findUnique({
    where: { id: jobId },
    include: {
      mrf: {
        include: {
          client: {
            select: {
              id: true,
              name: true,
              tradeName: true,
              industry: true,
              address: true,
            },
          },
        },
      },
    },
  });

  if (!job) throw new Error("Job not found");
  if (job.status !== "OPEN") throw new Error("This job posting is no longer accepting applications");

  const existingApplication = await prisma.application.findFirst({
    where: {
      userId, jobPostingId: jobId, isArchived: false,
      OR: [
        { status: { notIn: ["BACKOUT", "ARCHIVED", "REJECTED", "DEPLOYED"] } },
        { deployments: { some: { status: { notIn: ["ENDED", "CANCELLED"] } } } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  const activeDeployment = await getActiveDeploymentStatus(userId);

  return {
    ...job,
    client: job.mrf?.client
      ? {
          id: job.mrf.client.id,
          name: job.mrf.client.name,
          companyName: job.mrf.client.name,
          tradeName: job.mrf.client.tradeName,
          industry: job.mrf.client.industry,
          address: job.mrf.client.address,
        }
      : null,
    alreadyApplied: !!existingApplication,
    applicationId: existingApplication?.id,
    activeDeployment,
  };
};

/** Job must exist and be OPEN, with no unfinished attempt and no active deployment for the applicant. */
export const assertCanApply = async (userId: string, jobPostingId: number) => {
  const job = await prisma.jobPosting.findUnique({ where: { id: jobPostingId }, include: { mrf: { select: { clientId: true, assignedTaId: true } } } });
  if (!job) throw new Error("Job not found");
  if (job.status !== "OPEN") throw new Error("This job is no longer accepting applications");

  const priorApplications = await prisma.application.findMany({
    where: { userId, jobPostingId },
    select: { id: true, attemptNumber: true, status: true, isArchived: true },
    orderBy: { attemptNumber: "desc" },
  });
  const unfinishedApplication = priorApplications.find((previous) =>
    !previous.isArchived && !["BACKOUT", "ARCHIVED", "REJECTED", "DEPLOYED"].includes(previous.status)
  );
  if (unfinishedApplication) throw new Error("You already have an active application for this job");

  const deployment = await getActiveDeploymentStatus(userId);
  if (deployment.isCurrentlyDeployed) {
    throw new Error(
      `You are currently deployed on an active assignment with ${deployment.clientName || "your client"}. Applications for new positions are restricted until your assignment concludes or you are cleared for redeployment.`
    );
  }
  return job;
};

/** COMPLIANCE for a prior same-client placement, else SUBMITTED, plus the next attempt number. */
export const resolveInitialStatus = async (userId: string, job: { id: number; mrf?: { clientId: number | null } | null }) => {
  const last = await prisma.application.findFirst({
    where: { userId, jobPostingId: job.id },
    select: { attemptNumber: true },
    orderBy: { attemptNumber: "desc" },
  });
  const sameClientDeployments = job.mrf?.clientId
    ? await prisma.deployment.findMany({
        where: {
          clientId: job.mrf.clientId,
          employee: { userId },
          status: { in: ["ACTIVE", "ENDED"] },
          OR: [
            { actualStart: { not: null } },
            { statusHistory: { some: { toStatus: "ACTIVE" } } },
            { status: "ENDED", contractStart: { not: null } },
          ],
        },
        select: { id: true, applicationId: true },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const sameClientDeployment = sameClientDeployments.length > 0;
  return {
    status: (sameClientDeployment ? "COMPLIANCE" : "SUBMITTED") as "COMPLIANCE" | "SUBMITTED",
    attemptNumber: (last?.attemptNumber ?? 0) + 1,
    sameClientDeployment,
    sameClientDeployments,
  };
};

// Submits job application using uploaded resume or falls back to profile default resume
export const submitApplicationService = async (jobId: number, userId: string, file?: Express.Multer.File) => {
  const job = await assertCanApply(userId, jobId);

  let resolvedResumeUrl: string | null = null;
  // Set when a file was uploaded: reads the resume into the profile before the application is scored.
  let optionalReadAndScore: (() => Promise<void>) | undefined;

  if (file) {
    const profile = await ensureApplicantProfile(userId);
    let uploaded: Awaited<ReturnType<typeof uploadFileToSupabaseWithInfo>>;
    try {
      uploaded = await uploadFileToSupabaseWithInfo("applicant-assets", userId, file);
    } catch (err: any) {
      throw new Error(`File upload failed: ${err.message}`);
    }
    resolvedResumeUrl = uploaded.url;

    // Reading the resume into the profile is optional, so it runs after the application is saved.
    optionalReadAndScore = async () => {
      // Only the profile's first-ever parse fills blanks; later ones wait as a proposal for the applicant to review.
      try {
        // A failed earlier read left nothing to fill, so it does not count as a parse.
        const isFirstParse = (await prisma.resumeParseResult.count({ where: { applicantProfileId: profile.id, status: "PARSED" } })) === 0;
        const parse = await parseResumeToProposal({
          profileId: profile.id,
          buffer: file.buffer,
          mimeType: file.mimetype,
          originalName: file.originalname,
          documentId: uploaded.documentId,
          sha256: uploaded.sha256,
          source: "APPLICATION_SUBMIT",
        });
        if (parse.status === "PARSED" && isFirstParse) await fillBlanksFromParse(parse.id);
      } catch (extractErr: any) {
        console.warn("[Application Submission] Profile extraction/auto-fill non-blocking failure:", extractErr.message);
      }
    };

    try {
      await updateProfileResumeService(userId, uploaded.url);
    } catch (err: any) {
      throw new Error(`File upload failed: ${err.message}`);
    }
  } else {
    const profile = await ensureApplicantProfile(userId);
    if (!profile?.resumeUrl) {
      throw new Error("No resume found. Please upload a default resume to your profile first, or attach one to this application.");
    }
    resolvedResumeUrl = profile.resumeUrl;
  }

  const { status: initialStatus, attemptNumber, sameClientDeployment, sameClientDeployments } = await resolveInitialStatus(userId, job);
  let application = await prisma.application.create({
    data: {
      userId,
      jobPostingId: jobId,
      attemptNumber,
      resumeUrl: resolvedResumeUrl,
      status: initialStatus,
    },
  });

  const queueScoring = () => {
    const revalidation = revalidateApplication(application.id, jobId);
    trackFitRevalidation(application.id, revalidation);
    void revalidation.catch((error) => console.error("[Scoring] failed to queue application revalidation", error));
  };
  // Runs in the bounded worker slot after the application is saved, so a slow provider never delays submission.
  // Scoring starts only after the optional read, so it sees any blanks that read filled.
  const readThenScore = optionalReadAndScore && (async () => { await optionalReadAndScore!(); queueScoring(); });

  if (sameClientDeployment) {
    const { generateComplianceRequirementsFromMRF, reuseValidSameClientDocuments } = await import("../ta/ta.compliance.service.js");
    await generateComplianceRequirementsFromMRF(application.id);
    const priorApplicationIds = [...new Set(sameClientDeployments.map((item) => item.applicationId).filter((id): id is number => id !== null))];
    await reuseValidSameClientDocuments(application.id, priorApplicationIds);
    if (readThenScore) {
      // The read is optional; the saved application stays valid if it cannot be queued.
      try { await enqueueResumeSideTask(`application #${application.id} resume read`, readThenScore); }
      catch { queueScoring(); }
    } else queueScoring();
  } else {
    let queueRefused = false;
    try { await (readThenScore ? enqueueResumeAnalysis(application.id, readThenScore) : enqueueResumeAnalysis(application.id)); }
    catch {
      queueRefused = true;
      // Submission is already saved. Preserve it for staff review rather than
      // falsely reporting failure and encouraging a duplicate application.
      application = await prisma.application.update({ where: { id: application.id }, data: {
        status: "NEEDS_ATTENTION", aiSummary: "Automatic analysis is busy. The saved application requires manual review or a later staff retry.",
      } });
    }
    // With an optional read, scoring follows it inside the queue; if the queue refused the work, score now.
    if (!readThenScore || queueRefused) queueScoring();
  }

  logAudit(userId, "APPLICATION_SUBMITTED", "Application", application.id, {
    jobPostingId: jobId,
    resumeUsed: file ? "custom" : "default",
  });

  sendNotification(
    userId,
    "Application Received",
    `Your application for "${job.title}" has been submitted successfully.`,
    "SUCCESS",
    `/app/applications/${application.id}`,
    { sms: { text: `We received your application for ${job.title || "a role"}. Log in to MEGS for details.` } }
  );

  void notifyJobOwner(
    job,
    "New Candidate Application",
    `New application received for "${job.title}".`,
    "INFO",
    `/ta/applications/${application.id}`
  );

  return {
    id: application.id,
    jobPostingId: application.jobPostingId,
    status: application.status,
    resumeUsed: file ? "custom (uploaded with application)" : "default (from profile)",
    resumeUrl: application.resumeUrl,
    submittedAt: application.createdAt,
  };
};

export const fetchMyApplications = async (
  userId: string,
  options: { summary?: boolean; page?: number; limit?: number } = {},
) => {
  if (options.summary) {
    const where = { userId };
    const page = options.page ?? 1;
    const limit = options.limit ?? 25;
    const paginationRequested = options.page !== undefined || options.limit !== undefined;
    const [applications, total, statuses] = await Promise.all([
      prisma.application.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...(paginationRequested ? { skip: (page - 1) * limit, take: limit } : {}),
        select: {
          id: true,
          status: true,
          createdAt: true,
          jobPostingId: true,
          isArchived: true,
          aiScore: true,
          candidateScores: {
            orderBy: { calculatedAt: "desc" },
            take: 1,
            select: { id: true },
          },
          jobPosting: { select: { id: true, title: true, location: true } },
          // A scheduled or running placement marks the worker's current assignment, so it is not filed as history.
          deployments: {
            where: { status: { in: ["READY_FOR_DEPLOYMENT", "ACTIVE"] } },
            select: { id: true, status: true },
          },
        },
      }),
      prisma.application.count({ where }),
      prisma.application.groupBy({ by: ["status"], where, _count: { _all: true } }),
    ]);
    const statusTotals = Object.fromEntries(statuses.map((row) => [row.status, row._count._all]));
    const items = applications.map(({ aiScore, candidateScores, ...application }) => ({
      ...application,
      resumeAnalysisPending: application.status === "PARSING" || (
        application.status === "SUBMITTED" && aiScore == null && candidateScores.length === 0
      ),
    }));
    return {
      items,
      total,
      statusTotals,
      ...(paginationRequested ? { page, pageSize: limit, totalPages: Math.ceil(total / limit) } : {}),
    };
  }

  return await prisma.application.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      jobPosting: {
        select: {
          id: true,
          title: true,
          location: true,
          description: true,
          requirements: true,
          status: true,
          createdAt: true,
        },
      },
      interviews: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          scheduledAt: true,
          conductedAt: true,
          result: true,
          location: true,
          notes: true,
          complianceDeadline: true,
          isCompliant: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      complianceRequirements: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          documentLabel: true,
          isRequired: true,
          documentId: true,
          reviewStatus: true,
          deadline: true,
          reviewNotes: true,
          reviewedAt: true,
          expiresAt: true,
          issuedAt: true,
          validityStatus: true,
          updateRequestedAt: true,
          updateRequestReason: true,
          updateRequestDeadline: true,
          updateRequestCompletedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
};

// The contract is a TA-only record: applicants must not see its terms, rate or scan reference.
const APPLICANT_HIDDEN_CONTRACT_FIELDS = {
  contractSigned: true,
  contractSignedAt: true,
  contractNotes: true,
  contractStartDate: true,
  contractSignedById: true,
} as const;

export const fetchApplicationDetails = async (applicationId: number, userId: string) => {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    omit: APPLICANT_HIDDEN_CONTRACT_FIELDS,
    include: {
      jobPosting: {
        select: {
          id: true,
          title: true,
          location: true,
          description: true,
          requirements: true,
          status: true,
          createdAt: true,
        },
      },
      interviews: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          scheduledAt: true,
          conductedAt: true,
          result: true,
          location: true,
          notes: true,
          complianceDeadline: true,
          isCompliant: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      complianceRequirements: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          documentLabel: true,
          isRequired: true,
          documentId: true,
          reviewStatus: true,
          deadline: true,
          reviewNotes: true,
          reviewedAt: true,
          expiresAt: true,
          issuedAt: true,
          validityStatus: true,
          updateRequestedAt: true,
          updateRequestReason: true,
          updateRequestDeadline: true,
          updateRequestCompletedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      rescheduleRequests: {
        where: { requestedById: userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          activity: true,
          interviewId: true,
          status: true,
          reason: true,
          previousScheduledAt: true,
          newScheduledAt: true,
          decisionNote: true,
          createdAt: true,
          decidedAt: true,
        },
      },
    },
  });

  if (!application) {
    throw new Error("Application not found");
  }

  return application;
};

export const fetchMyDocuments = async (userId: string) => {
  const requirements = await prisma.complianceRequirement.findMany({
    where: { application: { userId } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, applicationId: true, documentLabel: true, documentId: true, reviewStatus: true,
      deadline: true, reviewNotes: true, issuedAt: true, expiresAt: true, validityStatus: true,
      updateRequestedAt: true, updateRequestReason: true, updateRequestDeadline: true, updateRequestCompletedAt: true,
      application: { select: { jobPosting: { select: { title: true, mrf: { select: { client: { select: { name: true } } } } } } } },
      documentVersions: { orderBy: { uploadedAt: "desc" }, select: { id: true, documentId: true, reviewStatus: true, issuedAt: true, expiresAt: true, validityStatus: true, uploadedAt: true, isCurrent: true } },
    },
  });
  return requirements.map(({ application, ...requirement }) => ({ ...requirement, jobTitle: application.jobPosting.title, clientName: application.jobPosting.mrf?.client.name ?? null }));
};

import { uploadAndStoreDocument } from '../document/document.service.js';

// Closed applications (withdrawn, backed out, rejected or archived) no longer accept compliance documents.
const CLOSED_APPLICATION_STATUSES: string[] = ["BACKOUT", "ARCHIVED", "REJECTED"];

/**
 * Makes `documentId` the current submission for a requirement (status SUBMITTED, validity reset so TA
 * reviews it explicitly). Older versions are kept in the version history.
 */
const linkDocumentToRequirement = async (requirementId: number, documentId: number) =>
  prisma.$transaction(async (tx) => {
    const current = await tx.complianceRequirement.findUnique({ where: { id: requirementId } });
    if (!current) throw new Error("Compliance requirement not found");
    if (current.documentId && current.documentId !== documentId) {
      const existingVersion = await tx.complianceDocumentVersion.findUnique({
        where: { requirementId_documentId: { requirementId, documentId: current.documentId } },
      });
      if (!existingVersion) {
        await tx.complianceDocumentVersion.create({
          data: {
            requirementId,
            documentId: current.documentId,
            issuedAt: current.issuedAt,
            expiresAt: current.expiresAt,
            validityStatus: current.validityStatus,
            reviewStatus: current.reviewStatus,
            reviewNotes: current.reviewNotes,
            reviewedById: current.reviewedById,
            reviewedAt: current.reviewedAt,
            isCurrent: false,
          },
        });
      }
    }
    await tx.complianceDocumentVersion.updateMany({ where: { requirementId, isCurrent: true }, data: { isCurrent: false } });
    await tx.complianceDocumentVersion.upsert({
      where: { requirementId_documentId: { requirementId, documentId } },
      create: { requirementId, documentId, validityStatus: "UNKNOWN", reviewStatus: "SUBMITTED", isCurrent: true },
      update: { validityStatus: "UNKNOWN", reviewStatus: "SUBMITTED", issuedAt: null, expiresAt: null, reviewNotes: null, reviewedById: null, reviewedAt: null, isCurrent: true, uploadedAt: new Date() },
    });
    return tx.complianceRequirement.update({
      where: { id: requirementId },
      data: { documentId, reviewStatus: "SUBMITTED", issuedAt: null, expiresAt: null, validityStatus: "UNKNOWN" },
    });
  });

const normalizeDocumentLabel = (label: string) => label.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Reusable document library: the latest copy of each document type the applicant has submitted
 * across all of their applications, with its verification status and expiry.
 */
export const fetchMyDocumentLibrary = async (userId: string) => {
  const requirements = await prisma.complianceRequirement.findMany({
    where: { application: { userId }, documentId: { not: null } },
    select: {
      id: true, applicationId: true, documentLabel: true, documentId: true, reviewStatus: true,
      issuedAt: true, expiresAt: true, validityStatus: true, updatedAt: true,
      application: { select: { jobPosting: { select: { title: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const documentIds = [...new Set(requirements.map((r) => r.documentId as number))];
  const documents = documentIds.length
    ? await prisma.storedDocument.findMany({
        where: { id: { in: documentIds }, ownerId: userId, deletedAt: null },
        select: { id: true, originalName: true, mimeType: true, uploadedAt: true },
      })
    : [];
  const byId = new Map(documents.map((d) => [d.id, d]));
  const now = Date.now();
  const soon = now + 30 * 24 * 60 * 60 * 1000;

  const latestByType = new Map<string, any>();
  for (const req of requirements) {
    const doc = byId.get(req.documentId as number);
    if (!doc) continue;
    const key = normalizeDocumentLabel(req.documentLabel);
    if (latestByType.has(key)) continue; // requirements are ordered newest first
    const expiresMs = req.expiresAt ? new Date(req.expiresAt).getTime() : null;
    latestByType.set(key, {
      label: req.documentLabel,
      documentId: doc.id,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      uploadedAt: doc.uploadedAt,
      requirementId: req.id,
      applicationId: req.applicationId,
      jobTitle: req.application.jobPosting.title,
      reviewStatus: req.reviewStatus,
      validityStatus: req.validityStatus,
      issuedAt: req.issuedAt,
      expiresAt: req.expiresAt,
      isExpired: expiresMs !== null && expiresMs < now,
      isExpiringSoon: expiresMs !== null && expiresMs >= now && expiresMs <= soon,
    });
  }
  return [...latestByType.values()];
};

/**
 * Attaches a document the applicant already stored to another requirement. The file is not copied,
 * and the requirement goes back to SUBMITTED so TA still reviews it explicitly.
 */
export const reuseDocumentForRequirement = async (userId: string, requirementId: number, documentId: number) => {
  const requirement = await prisma.complianceRequirement.findUnique({
    where: { id: requirementId },
    include: { application: { select: { userId: true, status: true, isArchived: true, jobPosting: { select: { ...JOB_OWNER_SELECT, title: true } } } } },
  });
  if (!requirement) throw new Error("Compliance requirement not found");
  if (requirement.application.userId !== userId) {
    throw new Error("Unauthorized to submit a document for this compliance requirement");
  }
  if (CLOSED_APPLICATION_STATUSES.includes(requirement.application.status) || requirement.application.isArchived) {
    throw new Error("This application is closed, so documents can no longer be uploaded.");
  }
  if (requirement.reviewStatus === "APPROVED" && !(requirement.updateRequestedAt && !requirement.updateRequestCompletedAt)) {
    throw new Error("This requirement is already approved. Ask your recruiter if it needs to be replaced.");
  }
  if (requirement.documentId === documentId && requirement.reviewStatus === "SUBMITTED") {
    throw new Error("This document is already submitted for this requirement.");
  }

  const document = await prisma.storedDocument.findUnique({ where: { id: documentId } });
  if (!document || document.deletedAt) throw new Error("Document not found");
  if (document.ownerId !== userId) {
    throw new Error("Unauthorized to use this document");
  }

  const source = await prisma.complianceRequirement.findFirst({
    where: { documentId, application: { userId } },
    orderBy: { updatedAt: "desc" },
    select: { expiresAt: true, reviewStatus: true },
  });
  if (source?.expiresAt && new Date(source.expiresAt).getTime() < Date.now()) {
    throw new Error("This document has expired. Upload a current copy instead.");
  }
  if (source?.reviewStatus === "REJECTED") {
    throw new Error("This document was rejected by a recruiter. Upload a corrected copy instead.");
  }

  const updated = await linkDocumentToRequirement(requirementId, documentId);

  void logAudit(userId, "COMPLIANCE_DOCUMENT_REUSED", "Application", requirement.applicationId, {
    requirementId,
    documentLabel: requirement.documentLabel,
    documentId,
  });
  const message = `An applicant re-used an existing document for '${requirement.documentLabel}' on "${requirement.application.jobPosting?.title ?? "Requisition"}".`;
  void notifyJobOwner(requirement.application.jobPosting, "Compliance Document Submitted", message, "INFO", `/ta/applications/${requirement.applicationId}`);
  return updated;
};

const loadRequirementForUpload = (requirementId: number) =>
  prisma.complianceRequirement.findUnique({
    where: { id: requirementId },
    include: {
      application: {
        select: {
          id: true,
          userId: true,
          status: true,
          isArchived: true,
          user: {
            select: {
              email: true,
              accountStatus: true,
              applicantProfile: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          jobPosting: { select: { ...JOB_OWNER_SELECT, title: true } },
        },
      },
    },
  });

type UploadRequirement = NonNullable<Awaited<ReturnType<typeof loadRequirementForUpload>>>;

/** Checks shared by the applicant and staff upload paths, then stores the file under the applicant and links it. */
const storeAndLinkComplianceDocument = async (
  requirement: UploadRequirement,
  requirementId: number,
  file: Express.Multer.File
) => {
  const applicantUserId = requirement.application.userId;

  if (CLOSED_APPLICATION_STATUSES.includes(requirement.application.status) || requirement.application.isArchived) {
    throw new Error("This application is closed, so documents can no longer be uploaded.");
  }
  if (requirement.reviewStatus === "APPROVED" && !(requirement.updateRequestedAt && !requirement.updateRequestCompletedAt)) {
    throw new Error("This document has already been approved and can't be replaced.");
  }

  if (!file) {
    throw new Error("Document file is required");
  }

  // Re-use an identical file the applicant already stored instead of uploading it again.
  const sha256 = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const existingDocument = await prisma.storedDocument.findFirst({
    where: { ownerId: applicantUserId, category: "VAULT_201", sha256, deletedAt: null },
    orderBy: { uploadedAt: "desc" },
  });

  // Otherwise upload to the secure documents bucket with category VAULT_201. The applicant owns it either way.
  const storedDocument =
    existingDocument ??
    (await uploadAndStoreDocument(applicantUserId, "VAULT_201", file, requirement.applicationId));

  return linkDocumentToRequirement(requirementId, storedDocument.id);
};

export const uploadApplicantComplianceDocument = async (
  userId: string,
  requirementId: number,
  file: Express.Multer.File
) => {
  const requirement = await loadRequirementForUpload(requirementId);

  if (!requirement) {
    throw new Error("Compliance requirement not found");
  }

  if (requirement.application.userId !== userId) {
    throw new Error("Unauthorized to upload document for this compliance requirement");
  }

  const wasRejected = requirement.reviewStatus === "REJECTED";
  const updated = await storeAndLinkComplianceDocument(requirement, requirementId, file);

  sendNotification(
    userId,
    "Compliance Document Uploaded",
    `Your document for "${requirement.documentLabel}" has been submitted for verification.`,
    "INFO",
    `/app/applications/${requirement.applicationId}`
  );

  const candProfile = requirement.application?.user?.applicantProfile;
  const candidateName = (candProfile?.firstName || candProfile?.lastName)
    ? `${candProfile.firstName || ""} ${candProfile.lastName || ""}`.trim()
    : requirement.application?.user?.email || "Candidate";
  const jobTitle = requirement.application?.jobPosting?.title || "Requisition";
  const jobPosting = requirement.application?.jobPosting;

  const taNotifTitle = wasRejected ? "Compliance Document Re-Submitted" : "Compliance Document Uploaded";
  const taNotifMsg = wasRejected
    ? `${candidateName} re-uploaded '${requirement.documentLabel}' for "${jobTitle}".`
    : `${candidateName} uploaded '${requirement.documentLabel}' for "${jobTitle}".`;
  const directLink = `/ta/applications/${requirement.applicationId}`;

  void notifyJobOwner(jobPosting, taNotifTitle, taNotifMsg, "INFO", directLink);

  // Milestone check: verify if all mandatory requirements now have documents submitted
  const mandatoryReqs = await prisma.complianceRequirement.findMany({
    where: {
      applicationId: requirement.applicationId,
      isRequired: true,
    },
    select: { id: true, documentId: true },
  });

  const allMandatorySubmitted = mandatoryReqs.length > 0 && mandatoryReqs.every((r) => r.documentId !== null);
  if (allMandatorySubmitted) {
    const milestoneTitle = "All Compliance Documents Submitted";
    const milestoneMsg = `All mandatory compliance documents for ${candidateName} on "${jobTitle}" have been submitted and are ready for verification.`;
    const milestoneType = "SUCCESS";

    void notifyJobOwner(jobPosting, milestoneTitle, milestoneMsg, milestoneType, directLink);
  }

  return updated;
};


/** A recruiter uploads the paper document an applicant brought in. Storage stays under the applicant. */
export const uploadComplianceDocumentForApplicant = async ({
  actor,
  requirementId,
  file,
}: {
  actor: { id: string; role: string };
  requirementId: number;
  file: Express.Multer.File;
}) => {
  await assertOwns("requirement", requirementId, actor);

  const requirement = await loadRequirementForUpload(requirementId);
  if (!requirement) {
    throw new Error("Compliance requirement not found");
  }

  assertRequirementStage(requirement.application.status);

  const applicantUserId = requirement.application.userId;
  const updated = await storeAndLinkComplianceDocument(requirement, requirementId, file);

  // Walk-in applicants have no login, so only an active account gets an in-app notice.
  if (requirement.application.user?.accountStatus === "ACTIVE") {
    void sendNotification(
      applicantUserId,
      "Compliance Document Uploaded",
      `A recruiter uploaded your document for "${requirement.documentLabel}" for verification.`,
      "INFO",
      `/app/applications/${requirement.applicationId}`
    );
  }

  void logAudit(actor.id, "COMPLIANCE_DOCUMENT_UPLOADED_BY_STAFF", "ComplianceRequirement", requirementId, {
    applicationId: requirement.applicationId,
    documentLabel: requirement.documentLabel,
    applicantUserId,
  });

  return updated;
};

export const submitComplianceRequirementService = uploadApplicantComplianceDocument;

