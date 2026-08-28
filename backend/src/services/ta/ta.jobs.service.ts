import prisma from '../../utils/prisma.js';
import { JobStatus } from "@prisma/client";
import { revalidateJobScoring } from "../scoring/scoring-configuration.service.js";
import { logAudit } from "../../utils/audit.js";

export const listTAJobs = async (status?: string) => {
  return await prisma.jobPosting.findMany({
    where: status ? { status: status as JobStatus } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      location: true,
      imageUrl: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      mrfId: true,
      postedBy: { select: { id: true, email: true } },
      _count: { select: { applications: true } },
    },
  });
};

export const createTAJob = async (postedById: string, data: any) => {
  const { title, description, requirements, location, imageUrl, mrfId, status } = data;

  if (!title || !description || !requirements) {
    throw new Error("title, description, and requirements are required");
  }

  const allowedStatuses = ["DRAFT", "OPEN"];
  const resolvedStatus = status && allowedStatuses.includes(status) ? status : "DRAFT";

  const job = await prisma.jobPosting.create({
    data: {
      postedById,
      title: title.trim(),
      description: description.trim(),
      requirements: requirements.trim(),
      location: location?.trim() ?? null,
      imageUrl: imageUrl?.trim() ?? null,
      mrfId: mrfId ? Number(mrfId) : null,
      status: resolvedStatus,
    },
  });

  void logAudit(postedById, "JOB_POSTING_CREATED", "JobPosting", job.id, {
    jobId: job.id,
    title: job.title,
    location: job.location,
    status: job.status,
  });

  return job;
};

export const getTAJob = async (jobId: number) => {
  const job = await prisma.jobPosting.findUnique({
    where: { id: jobId },
    include: {
      postedBy: { select: { id: true, email: true } },
      mrf: {
        select: {
          id: true,
          title: true,
          clientId: true,
          client: { select: { id: true, name: true, tradeName: true } },
        },
      },
      applications: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          aiScore: true,
          isArchived: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              applicantProfile: {
                select: {
                  firstName: true,
                  lastName: true,
                  mobileNumber: true,
                  city: true,
                  province: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!job) throw new Error("Job posting not found");
  return job;
};

export const updateTAJob = async (jobId: number, data: any) => {
  const existing = await prisma.jobPosting.findUnique({ where: { id: jobId } });
  if (!existing) throw new Error("Job posting not found");

  if (existing.status === "CLOSED") {
    throw new Error("Cannot edit a closed job posting. Re-open it first.");
  }

  const { title, description, requirements, location, imageUrl, mrfId } = data;

  const updated = await prisma.jobPosting.update({
    where: { id: jobId },
    data: {
      ...(title && { title: title.trim() }),
      ...(description && { description: description.trim() }),
      ...(requirements && { requirements: requirements.trim() }),
      ...(location !== undefined && { location: location?.trim() ?? null }),
      ...(imageUrl !== undefined && { imageUrl: imageUrl?.trim() ?? null }),
      ...(mrfId !== undefined && { mrfId: mrfId ? Number(mrfId) : null }),
    },
  });
  void revalidateJobScoring(updated.id).catch((error) => console.error("[Scoring] failed to synchronously revalidate job scoring", error));

  void logAudit(existing.postedById, "JOB_POSTING_UPDATED", "JobPosting", jobId, {
    jobId,
    title: updated.title,
    location: updated.location,
    status: updated.status,
  });

  return updated;
};

export const updateTAJobStatus = async (jobId: number, status: any) => {
  const validStatuses = ["DRAFT", "OPEN", "CLOSED"];
  if (!status || !validStatuses.includes(status)) {
    throw new Error(`status must be one of: ${validStatuses.join(", ")}`);
  }

  const existing = await prisma.jobPosting.findUnique({ where: { id: jobId } });
  if (!existing) throw new Error("Job posting not found");

  if (existing.status === "DRAFT" && status === "CLOSED") {
    throw new Error("A DRAFT job must be published (OPEN) before it can be CLOSED.");
  }

  const updated = await prisma.jobPosting.update({
    where: { id: jobId },
    data: { status },
  });

  void logAudit(existing.postedById, "JOB_POSTING_UPDATED", "JobPosting", jobId, {
    jobId,
    title: updated.title,
    previousStatus: existing.status,
    status: updated.status,
  });

  return updated;
};


