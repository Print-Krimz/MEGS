import prisma from '../../utils/prisma.js';
import { uploadFileToSupabase } from '../../middleware/upload.middleware.js';
import { logAudit } from '../../utils/audit.js';
import { sendNotification } from '../../utils/notification.js';
import { enqueueResumeAnalysis } from '../../workers/resume.worker.js';
import { revalidateApplication } from "../scoring/scoring-configuration.service.js";

export const fetchOpenJobs = async () => {
  return await prisma.jobPosting.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      location: true,
      status: true,
      createdAt: true,
      _count: { select: { applications: true } },
    },
  });
};

export const fetchJobDetails = async (jobId: number, userId: string) => {
  const job = await prisma.jobPosting.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      description: true,
      requirements: true,
      location: true,
      status: true,
      createdAt: true,
    },
  });

  if (!job) throw new Error("Job not found");
  if (job.status !== "OPEN") throw new Error("This job posting is no longer accepting applications");

  const existingApplication = await prisma.application.findFirst({
    where: { userId, jobPostingId: jobId },
  });

  return { ...job, alreadyApplied: !!existingApplication };
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
    const profile = await prisma.applicantProfile.findUnique({ where: { userId } });
    if (!profile) throw new Error("Please create your profile before applying");
    try {
      resolvedResumeUrl = await uploadFileToSupabase("applicant-assets", profile.id.toString(), file);
    } catch (err: any) {
      throw new Error(`File upload failed: ${err.message}`);
    }
  } else {
    const profile = await prisma.applicantProfile.findUnique({
      where: { userId },
      select: { resumeUrl: true },
    });
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

  sendNotification(userId, "Application Received", `Your application for job #${jobId} has been submitted successfully.`, "SUCCESS");

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
    include: { application: { select: { id: true, userId: true } } },
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
    "INFO"
  );

  return updated;
};

