import prisma from "../../utils/prisma.js";

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

  // Upsert or find existing to ensure idempotency
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

/**
 * List full saved job postings with relations for the applicant.
 */
export const listSavedJobsService = async (userId: string) => {
  const saved = await prisma.savedJob.findMany({
    where: { userId },
    include: {
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
    },
    orderBy: { createdAt: "desc" },
  });

  return saved.map((s) => ({
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
    where: { userId },
    select: { jobPostingId: true },
  });

  return saved.map((s) => s.jobPostingId);
};
