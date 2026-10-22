import prisma from "../../utils/prisma.js";
import { buildApplicantJobWhere } from "./job-filter.service.js";

export const MAX_SAVED_JOBS = 10;

export class SavedJobLimitError extends Error {
  constructor() {
    super(`You can save up to ${MAX_SAVED_JOBS} jobs. Remove one to save another.`);
    this.name = "SavedJobLimitError";
  }
}

/**
 * Save / bookmark a job posting for an applicant.
 * Idempotent: If already saved, returns the existing record without error.
 */
export const saveJobService = async (userId: string, jobPostingId: number) => {
  // Check if job exists
  const job = await prisma.jobPosting.findUnique({
    where: { id: jobPostingId },
  });

  if (!job) {
    throw new Error(`Job posting #${jobPostingId} not found.`);
  }

  const existing = await prisma.savedJob.findUnique({
    where: { userId_jobPostingId: { userId, jobPostingId } },
  });
  if (existing) return existing;

  // Only open postings count: closed ones drop out of the saved list, so they must not hold a slot.
  if ((await prisma.savedJob.count({ where: { userId, jobPosting: { status: "OPEN" } } })) >= MAX_SAVED_JOBS) {
    throw new SavedJobLimitError();
  }

  // Upsert covers a concurrent duplicate save
  return await prisma.savedJob.upsert({
    where: {
      userId_jobPostingId: {
        userId,
        jobPostingId,
      },
    },
    create: {
      userId,
      jobPostingId,
    },
    update: {},
  });
};

/**
 * Remove / unsave a job bookmark for an applicant.
 * Idempotent: If not found, returns success without error.
 */
export const unsaveJobService = async (userId: string, jobPostingId: number) => {
  await prisma.savedJob.deleteMany({
    where: {
      userId,
      jobPostingId,
    },
  });

  return { success: true };
};

/** Remove every saved job for the applicant. */
export const clearSavedJobsService = async (userId: string) => {
  const { count } = await prisma.savedJob.deleteMany({ where: { userId } });
  return { success: true, removed: count };
};

export interface ListSavedJobsFilters {
  search?: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  department?: string;
  page?: number;
  limit?: number;
}

/**
 * List full saved job postings with relations for the applicant.
 * Supports server-side search, location filtering, and pagination.
 */
export const listSavedJobsService = async (
  userId: string,
  filters?: ListSavedJobsFilters
) => {
  const jobPostingWhere: any = {
    status: "OPEN",
  };

  if (filters?.search?.trim()) {
    const term = filters.search.trim();
    jobPostingWhere.OR = [
      { title: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ];
  }

  Object.assign(jobPostingWhere, await buildApplicantJobWhere(filters));

  const where: any = {
    userId,
    jobPosting: jobPostingWhere,
  };

  const isPaginated = filters?.page !== undefined || filters?.limit !== undefined;

  const includeRelations = {
    jobPosting: {
      include: {
        mrf: {
          include: {
            client: true,
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    },
  };

  if (isPaginated) {
    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.max(1, filters?.limit ?? 25);
    const skip = (page - 1) * limit;

    const [saved, total] = await Promise.all([
      prisma.savedJob.findMany({
        where,
        include: includeRelations,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.savedJob.count({ where }),
    ]);

    const items = saved.map((s: any) => ({
      ...s.jobPosting,
      savedAt: s.createdAt,
      savedJobId: s.id,
    }));

    return {
      items,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  const saved = await prisma.savedJob.findMany({
    where,
    include: includeRelations,
    orderBy: { createdAt: "desc" },
  });

  return saved.map((s: any) => ({
    ...s.jobPosting,
    savedAt: s.createdAt,
    savedJobId: s.id,
  }));
};

/**
 * Get array of saved jobPostingIds for fast UI bookmark lookup.
 */
export const getSavedJobIdsService = async (userId: string): Promise<number[]> => {
  const saved = await prisma.savedJob.findMany({
    where: { userId, jobPosting: { status: "OPEN" } },
    select: { jobPostingId: true },
  });

  return saved.map((s) => s.jobPostingId);
};
