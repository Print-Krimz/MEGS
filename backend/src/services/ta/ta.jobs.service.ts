import prisma from '../../utils/prisma.js';
import { JobStatus } from "@prisma/client";
import { revalidateJobScoring } from "../scoring/scoring-configuration.service.js";
import { logAudit } from "../../utils/audit.js";
import { discoverTalentPoolForJob } from "../scoring/talent-pool-knn.service.js";
import { sendNotification } from "../../utils/notification.js";

export interface ListTAJobsOptions {
  status?: string;
  search?: string;
  clientId?: number;
  mineOnly?: boolean;
  currentUserId?: string;
  postedById?: string;
}

export const listTAJobs = async (statusOrOptions?: string | ListTAJobsOptions) => {
  const options: ListTAJobsOptions = typeof statusOrOptions === "string" ? { status: statusOrOptions } : statusOrOptions || {};
  const { status, search, clientId, mineOnly, currentUserId, postedById } = options;

  const andConditions: any[] = [];

  if (status) {
    andConditions.push({ status: status as JobStatus });
  }

  if (clientId !== undefined && clientId !== null) {
    const parsedClientId = Number(clientId);
    if (!isNaN(parsedClientId)) {
      andConditions.push({ mrf: { clientId: parsedClientId } });
    }
  }

  if (postedById || (mineOnly && currentUserId)) {
    andConditions.push({ postedById: postedById || currentUserId });
  }

  if (search && search.trim()) {
    const q = search.trim();
    andConditions.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { location: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { requirements: { contains: q, mode: "insensitive" } },
        { mrf: { client: { name: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }

  const where = andConditions.length > 0 ? { AND: andConditions } : undefined;

  return await prisma.jobPosting.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      location: true,
      imageUrl: true,
      status: true,
      isEvergreen: true,
      createdAt: true,
      updatedAt: true,
      mrfId: true,
      mrf: {
        select: {
          id: true,
          title: true,
          clientId: true,
          client: { select: { id: true, name: true } },
          salaryRangeMin: true,
          salaryRangeMax: true,
          employmentType: true,
          workArrangement: true,
        },
      },
      postedBy: { select: { id: true, email: true } },
      _count: { select: { applications: true } },
    },
  });
};

export const triggerTalentPoolAutoDiscovery = async (jobId: number, postedById: string) => {
  try {
    const job = await prisma.jobPosting.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, status: true, postedById: true },
    });
    if (!job || job.status !== "OPEN") return;

    const targetRecruiterId = postedById || job.postedById;
    const discovery = await discoverTalentPoolForJob(jobId, { k: 10 });
    const qualifiedMatches = discovery.items.filter(
      (item: any) => item.similarity >= 0.75 && item.candidate.availability === "AVAILABLE"
    );

    if (qualifiedMatches.length > 0) {
      const topMatch = Math.round(qualifiedMatches[0].similarity * 100);
      const count = qualifiedMatches.length;

      await sendNotification(
        targetRecruiterId,
        "Talent Pool Candidates Matched",
        `Found ${count} pre-screened candidate${count > 1 ? "s" : ""} in the Talent Pool matching "${job.title}" (${topMatch}% top match).`,
        "INFO",
        `/ta/jobs/${job.id}?tab=talentPool`
      );
    }
  } catch (error) {
    console.error(`[TalentPool Auto-Discovery] Discovery run failed for Job #${jobId}:`, error);
  }
};

export const createTAJob = async (postedById: string, data: any) => {
  const { title, description, requirements, location, imageUrl, mrfId, status, isEvergreen } = data;

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
      isEvergreen: Boolean(isEvergreen),
    },
  });

  void logAudit(postedById, "JOB_POSTING_CREATED", "JobPosting", job.id, {
    jobId: job.id,
    title: job.title,
    location: job.location,
    status: job.status,
    isEvergreen: job.isEvergreen,
  });

  if (job.status === "OPEN") {
    void triggerTalentPoolAutoDiscovery(job.id, postedById);
  }

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
          salaryRangeMin: true,
          salaryRangeMax: true,
          employmentType: true,
          workArrangement: true,
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
          candidateScores: {
            orderBy: { calculatedAt: "desc" },
            take: 1,
            select: { finalFitScore: true, calculatedAt: true },
          },
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

  return {
    ...job,
    applications: job.applications.map((app) => ({
      ...app,
      candidateFitScore: app.candidateScores?.[0] ? Number(app.candidateScores[0].finalFitScore) : null,
    })),
  };
};

export const updateTAJob = async (jobId: number, data: any) => {
  const existing = await prisma.jobPosting.findUnique({ where: { id: jobId } });
  if (!existing) throw new Error("Job posting not found");

  if (existing.status === "CLOSED") {
    throw new Error("Cannot edit a closed job posting. Re-open it first.");
  }

  const { title, description, requirements, location, imageUrl, mrfId, isEvergreen } = data;

  const updated = await prisma.jobPosting.update({
    where: { id: jobId },
    data: {
      ...(title && { title: title.trim() }),
      ...(description && { description: description.trim() }),
      ...(requirements && { requirements: requirements.trim() }),
      ...(location !== undefined && { location: location?.trim() ?? null }),
      ...(imageUrl !== undefined && { imageUrl: imageUrl?.trim() ?? null }),
      ...(mrfId !== undefined && { mrfId: mrfId ? Number(mrfId) : null }),
      ...(isEvergreen !== undefined && { isEvergreen: Boolean(isEvergreen) }),
    },
  });
  void revalidateJobScoring(updated.id).catch((error) => console.error("[Scoring] failed to synchronously revalidate job scoring", error));

  void logAudit(existing.postedById, "JOB_POSTING_UPDATED", "JobPosting", jobId, {
    jobId,
    title: updated.title,
    location: updated.location,
    status: updated.status,
    isEvergreen: updated.isEvergreen,
  });

  if (existing.status !== "OPEN" && updated.status === "OPEN") {
    void triggerTalentPoolAutoDiscovery(updated.id, existing.postedById);
  }

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

  if (existing.status !== "OPEN" && updated.status === "OPEN") {
    void triggerTalentPoolAutoDiscovery(updated.id, existing.postedById);
  }

  return updated;
};


