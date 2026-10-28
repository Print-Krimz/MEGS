import prisma from '../../utils/prisma.js';
import { JobStatus } from "@prisma/client";
import { getActiveScoringConfiguration, revalidateJobScoring } from "../scoring/scoring-configuration.service.js";
import { logAudit } from "../../utils/audit.js";
import { discoverTalentPoolForJob } from "../scoring/talent-pool-knn.service.js";
import { jobRequirementClarity } from "../scoring/match-score.js";
import { notifyJobOwner } from "../../utils/notification.js";
import { assertOwns, JOB_OWNER_SELECT, ownedWhere, type Actor } from "./ownership.js";

export interface ListTAJobsOptions {
  status?: string;
  search?: string;
  clientId?: number;
  mineOnly?: boolean;
  currentUserId?: string;
  postedById?: string;
  actor?: Actor;
  page?: number;
  limit?: number;
}

export const listTAJobs = async (statusOrOptions?: string | ListTAJobsOptions) => {
  const options: ListTAJobsOptions = typeof statusOrOptions === "string" ? { status: statusOrOptions } : statusOrOptions || {};
  const { status, search, clientId, mineOnly, currentUserId, postedById, actor, page, limit } = options;

  const andConditions: any[] = [];
  if (actor) andConditions.push(ownedWhere.job(actor));

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

  const paginationRequested = page !== undefined || limit !== undefined;
  const resolvedPage = page ?? 1;
  const resolvedLimit = limit ?? 25;
  const [jobs, total] = await Promise.all([
    prisma.jobPosting.findMany({
    where,
    orderBy: { createdAt: "desc" },
    ...(paginationRequested ? { skip: (resolvedPage - 1) * resolvedLimit, take: resolvedLimit } : {}),
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
    }),
    paginationRequested ? prisma.jobPosting.count({ where }) : Promise.resolve(0),
  ]);

  if (!paginationRequested) return jobs;
  return { items: jobs, total, page: resolvedPage, pageSize: resolvedLimit, totalPages: Math.ceil(total / resolvedLimit) };
};

// Tells the TA who owns the job (Admins when it is unassigned) about strong Talent Pool matches.
export const triggerTalentPoolAutoDiscovery = async (jobId: number) => {
  try {
    const job = await prisma.jobPosting.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, status: true, ...JOB_OWNER_SELECT },
    });
    if (!job || job.status !== "OPEN") return;

    // Same bar as screening's "Match found": the admin-set match threshold on the match score.
    const [discovery, configuration] = await Promise.all([
      discoverTalentPoolForJob(jobId, { k: 10 }),
      getActiveScoringConfiguration(),
    ]);
    const threshold = Number(configuration.matchThreshold);
    const qualifiedMatches = discovery.items.filter(
      (item) => item.matchScore !== null && item.matchScore >= threshold && item.candidate.availability === "AVAILABLE"
    );

    if (qualifiedMatches.length > 0) {
      const count = qualifiedMatches.length;

      await notifyJobOwner(
        job,
        "Talent Pool Candidates Matched",
        `Found ${count} Talent Pool candidate${count > 1 ? "s" : ""} for "${job.title}" with a match score of ${threshold} or more.`,
        "INFO",
        `/ta/jobs/${job.id}?tab=talentPool`
      );
    }
  } catch (error) {
    console.error(`[TalentPool Auto-Discovery] Discovery run failed for Job #${jobId}:`, error);
  }
};

// A job can't be created or opened under a manpower request that was cancelled or filled.
const CLOSED_REQUEST_STATUSES = ["CANCELLED", "FILLED"];
const assertRequestAcceptsJobs = async (mrfId: number) => {
  const mrf = await prisma.manpowerRequest.findUnique({ where: { id: mrfId }, select: { status: true } });
  if (mrf && CLOSED_REQUEST_STATUSES.includes(mrf.status)) {
    throw new Error("This request is closed, so jobs can't be opened under it.");
  }
};

export const createTAJob = async (postedById: string, data: any, actor?: Actor) => {
  const { title, requirements, location, imageUrl, mrfId, status, isEvergreen } = data;

  // Client -> MRF -> job posting: a TA posts openings only under a requisition they own.
  if (actor) {
    if (!mrfId) throw new Error("Select a manpower request for this job posting");
    await assertOwns("mrf", Number(mrfId), actor);
  }

  if (mrfId) await assertRequestAcceptsJobs(Number(mrfId));

  // The description comes from the manpower request. Only a request that predates the required field
  // (or a posting without one) falls back to the text sent with the form.
  let description: string | undefined = data.description;
  if (mrfId) {
    const mrf = await prisma.manpowerRequest.findUnique({ where: { id: Number(mrfId) }, select: { description: true } });
    if (mrf?.description?.trim()) description = mrf.description;
  }

  if (!title || !description?.trim() || !requirements) {
    throw new Error("Add the job description to the manpower request first, then enter the job title and requirements.");
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
    void triggerTalentPoolAutoDiscovery(job.id);
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
          location: true,
          requiredSkills: true,
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
    requirementClarity: jobRequirementClarity(job, job.mrf),
    applications: job.applications.map((app) => ({
      ...app,
      candidateFitScore: app.candidateScores?.[0] ? Number(app.candidateScores[0].finalFitScore) : null,
    })),
  };
};

export const updateTAJob = async (jobId: number, data: any, actor?: Actor) => {
  const existing = await prisma.jobPosting.findUnique({ where: { id: jobId } });
  if (!existing) throw new Error("Job posting not found");

  if (existing.status === "CLOSED") {
    throw new Error("Cannot edit a closed job posting. Re-open it first.");
  }

  // The description is not edited here: it mirrors the manpower request.
  const { title, requirements, location, imageUrl, mrfId, isEvergreen } = data;
  if (actor && mrfId !== undefined) {
    if (!mrfId) throw new Error("A job posting must stay linked to a manpower request");
    await assertOwns("mrf", Number(mrfId), actor);
  }
  if (mrfId && Number(mrfId) !== existing.mrfId) await assertRequestAcceptsJobs(Number(mrfId));

  const updated = await prisma.jobPosting.update({
    where: { id: jobId },
    data: {
      ...(title && { title: title.trim() }),
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
    void triggerTalentPoolAutoDiscovery(updated.id);
  }

  return updated;
};

export const updateTAJobStatus = async (jobId: number, status: any) => {
  const validStatuses = ["DRAFT", "OPEN", "CLOSED"];
  if (!status || !validStatuses.includes(status)) {
    throw new Error("Choose a valid job status.");
  }

  const existing = await prisma.jobPosting.findUnique({ where: { id: jobId } });
  if (!existing) throw new Error("Job posting not found");

  if (existing.status === "DRAFT" && status === "CLOSED") {
    throw new Error("A draft job posting must be published before it can be closed.");
  }
  if (status === "DRAFT" && existing.status !== "DRAFT") {
    const applicantTotal = await prisma.application.count({ where: { jobPostingId: jobId } });
    if (applicantTotal > 0) {
      throw new Error("Openings with applicants can't go back to draft. Close the opening instead.");
    }
  }
  if (status === "OPEN" && existing.status !== "OPEN" && existing.mrfId) {
    await assertRequestAcceptsJobs(existing.mrfId);
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
    void triggerTalentPoolAutoDiscovery(updated.id);
  }

  return updated;
};


