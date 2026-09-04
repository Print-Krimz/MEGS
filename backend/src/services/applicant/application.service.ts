import prisma from '../../utils/prisma.js';
import { uploadFileToSupabase } from '../../middleware/upload.middleware.js';
import { logAudit } from '../../utils/audit.js';
import { sendNotification, sendRoleNotification } from '../../utils/notification.js';
import { enqueueResumeAnalysis } from '../../workers/resume.worker.js';
import { revalidateApplication } from "../scoring/scoring-configuration.service.js";
import { ensureApplicantProfile, updateProfileResumeService } from './applicant.service.js';

export const fetchOpenJobs = async (filters?: { search?: string; location?: string }) => {
  const where: any = { status: "OPEN" };

  if (filters?.location && filters.location.trim()) {
    where.location = { contains: filters.location.trim(), mode: "insensitive" };
  }

  if (filters?.search && filters.search.trim()) {
    const term = filters.search.trim();
    where.OR = [
      { title: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
      { requirements: { contains: term, mode: "insensitive" } },
      { location: { contains: term, mode: "insensitive" } },
    ];
  }

  return await prisma.jobPosting.findMany({
    where,
    orderBy: { createdAt: "desc" },
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
    },
  });
};

export const fetchJobDetails = async (jobId: number, userId?: string) => {
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

  const existingApplication = userId
    ? await prisma.application.findFirst({
        where: { userId, jobPostingId: jobId },
      })
    : null;

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
  };
};

// Submits job application using uploaded resume or falls back to profile default resume
export const submitApplicationService = async (jobId: number, userId: string, file?: Express.Multer.File) => {
  const job = await prisma.jobPosting.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");
  if (job.status !== "OPEN") throw new Error("This job is no longer accepting applications");

  const existingApplication = await prisma.application.findFirst({
    where: { userId, jobPostingId: jobId },
  });
  if (existingApplication) throw new Error("You have already applied for this job");

  let resolvedResumeUrl: string | null = null;

  if (file) {
    await ensureApplicantProfile(userId);
    try {
      resolvedResumeUrl = await uploadFileToSupabase("applicant-assets", userId, file);
      await updateProfileResumeService(userId, resolvedResumeUrl);
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

  const application = await prisma.application.create({
    data: {
      userId,
      jobPostingId: jobId,
      resumeUrl: resolvedResumeUrl,
      status: "SUBMITTED",
    },
  });

  enqueueResumeAnalysis(application.id);
  void revalidateApplication(application.id, jobId).catch((error) => console.error("[Scoring] failed to queue application revalidation", error));

  logAudit(userId, "APPLICATION_SUBMITTED", "Application", application.id, {
    jobPostingId: jobId,
    resumeUsed: file ? "custom" : "default",
  });

  sendNotification(
    userId,
    "Application Received",
    `Your application for "${job.title}" has been submitted successfully.`,
    "SUCCESS",
    `/app/applications/${application.id}`
  );

  if (job.postedById) {
    void sendNotification(
      job.postedById,
      "New Candidate Application",
      `New application received for "${job.title}".`,
      "INFO",
      `/ta/applications/${application.id}`
    );
  } else {
    void sendRoleNotification(
      "TALENT_ACQUISITION",
      "New Candidate Application",
      `New application received for "${job.title}".`,
      "INFO",
      `/ta/applications/${application.id}`,
      userId
    );
  }

  return {
    id: application.id,
    jobPostingId: application.jobPostingId,
    status: application.status,
    resumeUsed: file ? "custom (uploaded with application)" : "default (from profile)",
    resumeUrl: application.resumeUrl,
    submittedAt: application.createdAt,
  };
};

export const fetchMyApplications = async (userId: string) => {
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
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
};

export const fetchApplicationDetails = async (applicationId: number, userId: string) => {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
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
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!application) {
    throw new Error("Application not found");
  }

  return application;
};

import { uploadAndStoreDocument } from '../document/document.service.js';

export const uploadApplicantComplianceDocument = async (
  userId: string,
  requirementId: number,
  file: Express.Multer.File
) => {
  const requirement = await prisma.complianceRequirement.findUnique({
    where: { id: requirementId },
    include: {
      application: {
        select: {
          id: true,
          userId: true,
          jobPosting: { select: { postedById: true } },
        },
      },
    },
  });

  if (!requirement) {
    throw new Error("Compliance requirement not found");
  }

  if (requirement.application.userId !== userId) {
    throw new Error("Unauthorized to upload document for this compliance requirement");
  }

  if (!file) {
    throw new Error("Document file is required");
  }

  // Upload to secure documents bucket with category VAULT_201
  await uploadAndStoreDocument(
    userId,
    "VAULT_201",
    file,
    requirement.applicationId
  );

  // Retrieve newly created StoredDocument ID
  const latestDoc = await prisma.storedDocument.findFirst({
    where: { ownerId: userId, applicationId: requirement.applicationId },
    orderBy: { uploadedAt: "desc" },
  });

  const updated = await prisma.complianceRequirement.update({
    where: { id: requirementId },
    data: {
      documentId: latestDoc?.id || null,
      reviewStatus: "SUBMITTED",
    },
  });

  sendNotification(
    userId,
    "Compliance Document Uploaded",
    `Your document for "${requirement.documentLabel}" has been submitted for verification.`,
    "INFO",
    `/app/applications/${requirement.applicationId}`
  );

  const jobOwnerId = requirement.application?.jobPosting?.postedById;
  if (jobOwnerId) {
    void sendNotification(
      jobOwnerId,
      "Compliance Document Submitted",
      `A compliance document for "${requirement.documentLabel}" was uploaded and is ready for verification.`,
      "INFO",
      `/ta/compliance`
    );
  } else {
    void sendRoleNotification(
      "TALENT_ACQUISITION",
      "Compliance Document Submitted",
      `A compliance document for "${requirement.documentLabel}" was uploaded and is ready for verification.`,
      "INFO",
      `/ta/compliance`,
      userId
    );
  }

  return updated;
};

