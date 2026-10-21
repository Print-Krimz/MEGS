import prisma from "../../utils/prisma.js";
import { buildLocationMatcher, buildSalaryMrfFilter } from "../../utils/job-filters.js";

export interface ApplicantJobFilters {
  search?: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
}

/** The worksite shown to applicants: the posting's own location, else the requisition's. */
const worksiteOf = (job: { location: string | null; mrf: { location: string | null } | null }) =>
  job.location?.trim() || job.mrf?.location?.trim() || null;

/**
 * Prisma `where` fragments for the location and salary filters. Location is matched in
 * code (see utils/job-filters) against the open postings' worksite text, then applied as an id list.
 */
export const buildApplicantJobWhere = async (filters?: ApplicantJobFilters) => {
  const where: Record<string, unknown> = {};

  const matcher = buildLocationMatcher(filters?.location);
  if (matcher) {
    const open = await prisma.jobPosting.findMany({
      where: { status: "OPEN" },
      select: { id: true, location: true, mrf: { select: { location: true } } },
    });
    where.id = { in: open.filter((job) => matcher(worksiteOf(job))).map((job) => job.id) };
  }

  const mrf = buildSalaryMrfFilter(filters?.salaryMin, filters?.salaryMax);
  if (mrf) where.mrf = mrf;

  return where;
};
