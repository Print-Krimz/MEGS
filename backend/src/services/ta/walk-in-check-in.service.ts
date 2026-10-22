// Self check-in (Phase 2): the applicant queues from a QR poster, any TA confirms at the desk and runs the normal walk-in intake.
import type { Prisma } from "@prisma/client";
import prisma from "../../utils/prisma.js";
import { logAudit } from "../../utils/audit.js";
import { safeLogError } from "../../security/errors.js";
import { sendNotification } from "../../utils/notification.js";
import { isPhilippinePhone, normalizeToE164, normalizeToLocal } from "../../utils/sms.js";
import { manilaDateString } from "../../schemas/field-limits.js";
import type { Actor } from "./ownership.js";
import {
  WalkInConflictError,
  createWalkIn,
  generateTrackingToken,
  getTrackingByApplicationId,
  normalizeName,
  tokenMatches,
  type CreateWalkInInput,
  type WalkInSlip,
} from "./walk-in.service.js";

/** A problem the applicant can fix on the check-in form (answered with 400). */
export class CheckInInputError extends Error {}

const EXPIRY_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_QUEUE_ATTEMPTS = 5;

const queueNumber = (seq: number): string => `A-${String(seq).padStart(3, "0")}`;
/** `@db.Date` columns round-trip through UTC midnight, so write and read them that way. */
const toDbDate = (value: string): Date => new Date(`${value}T00:00:00Z`);
const fromDbDate = (value: Date): string => value.toISOString().slice(0, 10);
const todayQueueDate = (): Date => toDbDate(manilaDateString());

const fullName = (p: { firstName: string; middleName?: string | null; lastName: string }): string =>
  [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ");

export interface CheckInSubmission {
  jobPostingId: number;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  mobileNumber?: string | null;
  birthDate: string;
}

export interface CheckInConfirmInput {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  mobileNumber?: string | null;
  birthDate: string;
  existingUserId?: string | null;
}

const isUniqueViolation = (error: unknown): boolean => (error as { code?: string } | null)?.code === "P2002";

const statusPathFor = (publicId: string, token: string) => `/check-in/${publicId}?token=${token}`;

// ---------- public ----------

export const listCheckInJobs = async (q?: string) => {
  const term = q?.trim();
  const where: Prisma.JobPostingWhereInput = { status: "OPEN" };
  if (term) {
    where.OR = [
      { title: { contains: term, mode: "insensitive" } },
      { location: { contains: term, mode: "insensitive" } },
      { mrf: { is: { client: { is: { name: { contains: term, mode: "insensitive" } } } } } },
    ];
  }
  const jobs = await prisma.jobPosting.findMany({
    where,
    take: 50,
    orderBy: { title: "asc" },
    select: { id: true, title: true, location: true, mrf: { select: { client: { select: { name: true } } } } },
  });
  return {
    jobs: jobs.map((job) => ({
      id: job.id,
      title: job.title,
      clientName: job.mrf?.client?.name ?? null,
      location: job.location ?? null,
    })),
  };
};

export const createCheckIn = async (input: CheckInSubmission) => {
  const job = await prisma.jobPosting.findUnique({ where: { id: input.jobPostingId }, select: { status: true } });
  if (!job) throw new CheckInInputError("Choose a job that is still open");
  if (job.status !== "OPEN") throw new CheckInInputError("This job is no longer accepting applications");

  const mobile = input.mobileNumber?.trim() || null;
  if (mobile && !isPhilippinePhone(mobile)) throw new CheckInInputError("Enter a valid Philippine mobile number");
  const mobileE164 = mobile ? normalizeToE164(mobile) : null;

  const queueDate = todayQueueDate();
  const birthDate = toDbDate(input.birthDate);
  const { token, hash } = generateTrackingToken();

  // Same person, same job, still waiting today: say so, but never reissue the link (it would let a stranger take over the view).
  const waiting = await prisma.walkInCheckIn.findMany({
    where: { queueDate, jobPostingId: input.jobPostingId, birthDate, status: "PENDING", expiresAt: { gt: new Date() } },
    select: { id: true, publicId: true, queueSeq: true, firstName: true, lastName: true },
  });
  const first = normalizeName(input.firstName);
  const last = normalizeName(input.lastName);
  const duplicate = waiting.find((row) => normalizeName(row.firstName) === first && normalizeName(row.lastName) === last);
  if (duplicate) {
    return { alreadyCheckedIn: true as const, queueNumber: queueNumber(duplicate.queueSeq) };
  }

  for (let attempt = 0; attempt < MAX_QUEUE_ATTEMPTS; attempt++) {
    const latest = await prisma.walkInCheckIn.aggregate({ where: { queueDate }, _max: { queueSeq: true } });
    const queueSeq = (latest._max.queueSeq ?? 0) + 1;
    try {
      const created = await prisma.walkInCheckIn.create({
        data: {
          queueDate,
          queueSeq,
          jobPostingId: input.jobPostingId,
          firstName: input.firstName,
          middleName: input.middleName || null,
          lastName: input.lastName,
          mobileNumber: mobileE164,
          birthDate,
          viewTokenHash: hash,
          expiresAt: new Date(Date.now() + EXPIRY_MS),
        },
        select: { publicId: true, queueSeq: true },
      });
      return {
        alreadyCheckedIn: false as const,
        publicId: created.publicId,
        viewToken: token,
        queueNumber: queueNumber(created.queueSeq),
        statusPath: statusPathFor(created.publicId, token),
      };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new CheckInInputError("The queue is busy. Please try again.");
};

/** Returns null for any mismatch so the controller can answer a uniform 404. */
export const getCheckInStatus = async (publicId: string, token: string) => {
  if (!publicId || !token || publicId.length > 64 || token.length > 100) return null;
  const row = await prisma.walkInCheckIn.findUnique({
    where: { publicId },
    select: {
      queueSeq: true,
      status: true,
      firstName: true,
      createdAt: true,
      expiresAt: true,
      viewTokenHash: true,
      applicationId: true,
      jobPosting: { select: { title: true } },
    },
  });
  if (!row || !tokenMatches(token, row.viewTokenHash)) return null;
  if (row.status === "PENDING" && row.expiresAt.getTime() <= Date.now()) return null;

  const tracking = row.status === "CONFIRMED" && row.applicationId ? await getTrackingByApplicationId(row.applicationId) : null;
  return {
    queueNumber: queueNumber(row.queueSeq),
    status: row.status,
    firstName: row.firstName,
    jobTitle: row.jobPosting.title,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    tracking,
  };
};

// ---------- TA ----------

const listSelect = {
  id: true,
  queueSeq: true,
  firstName: true,
  middleName: true,
  lastName: true,
  jobPostingId: true,
  createdAt: true,
  jobPosting: { select: { title: true, mrf: { select: { client: { select: { name: true } } } } } },
} as const;

type ListRow = Prisma.WalkInCheckInGetPayload<{ select: typeof listSelect }>;

const toListItem = (row: ListRow) => ({
  id: row.id,
  queueNumber: queueNumber(row.queueSeq),
  firstName: row.firstName,
  middleName: row.middleName,
  lastName: row.lastName,
  jobPostingId: row.jobPostingId,
  jobTitle: row.jobPosting.title,
  clientName: row.jobPosting.mrf?.client?.name ?? null,
  createdAt: row.createdAt.toISOString(),
});

export const listPendingCheckIns = async () => {
  const rows = await prisma.walkInCheckIn.findMany({
    where: { status: "PENDING", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "asc" },
    select: listSelect,
  });
  return { items: rows.map(toListItem) };
};

/** Same rule as ownership.ts: a job follows its requisition (none when unassigned); legacy jobs with no requisition follow the poster. */
const ownerOf = (job: { postedById: string; mrfId: number | null; mrf: { assignedTaId: string | null } | null }): string | null =>
  job.mrf ? job.mrf.assignedTaId : job.mrfId === null ? job.postedById : null;

/** Recruiters are named like the analytics pages: profile name when there is one, else null. */
const ownerDisplayName = (user: { applicantProfile: { firstName: string; lastName: string } | null } | null): string | null => {
  const full = `${user?.applicantProfile?.firstName ?? ""} ${user?.applicantProfile?.lastName ?? ""}`.trim();
  return full || null;
};

export const getPendingCheckIn = async (id: number) => {
  const row = await prisma.walkInCheckIn.findFirst({
    where: { id, status: "PENDING", expiresAt: { gt: new Date() } },
    select: {
      ...listSelect,
      mobileNumber: true,
      birthDate: true,
      jobPosting: {
        select: { title: true, postedById: true, mrfId: true, mrf: { select: { assignedTaId: true, client: { select: { name: true } } } } },
      },
    },
  });
  if (!row) throw new Error("Check-in not found");

  const ownerId = ownerOf(row.jobPosting);
  const owner = ownerId
    ? await prisma.user.findUnique({ where: { id: ownerId }, select: { applicantProfile: { select: { firstName: true, lastName: true } } } })
    : null;
  return {
    ...toListItem(row),
    mobileNumber: row.mobileNumber ? normalizeToLocal(row.mobileNumber) : null,
    birthDate: fromDbDate(row.birthDate),
    jobOwnerId: ownerId,
    jobOwnerName: ownerDisplayName(owner),
  };
};

export const confirmCheckIn = async (
  actor: Actor,
  id: number,
  input: CheckInConfirmInput,
  file: Express.Multer.File,
): Promise<WalkInSlip> => {
  const checkIn = await prisma.walkInCheckIn.findUnique({
    where: { id },
    select: { jobPostingId: true, queueSeq: true, jobPosting: { select: { title: true, postedById: true, mrfId: true, mrf: { select: { assignedTaId: true } } } } },
  });
  if (!checkIn) throw new Error("Check-in not found");

  // Atomic claim: a second confirm (or an expired row) matches nothing.
  const claimed = await prisma.walkInCheckIn.updateMany({
    where: { id, status: "PENDING", expiresAt: { gt: new Date() } },
    data: { status: "CONFIRMED", confirmedById: actor.id },
  });
  if (claimed.count === 0) throw new WalkInConflictError("This check-in was already handled or has expired");

  let slip: WalkInSlip;
  try {
    const walkInInput: CreateWalkInInput = {
      jobPostingId: checkIn.jobPostingId,
      source: "WALK_IN",
      firstName: input.firstName,
      middleName: input.middleName || null,
      lastName: input.lastName,
      mobileNumber: input.mobileNumber || null,
      birthDate: input.birthDate,
      existingUserId: input.existingUserId || null,
    };
    slip = await createWalkIn(actor, walkInInput, file, { skipOwnership: true, selfEncoded: true });
  } catch (error) {
    await prisma.walkInCheckIn
      .updateMany({ where: { id, status: "CONFIRMED", applicationId: null }, data: { status: "PENDING", confirmedById: null } })
      .catch((revertError) => safeLogError("Check-in revert", revertError));
    throw error;
  }

  // The application exists now, so the check-in is never reverted. Link it, retrying once.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await prisma.walkInCheckIn.update({ where: { id }, data: { applicationId: slip.applicationId } });
      break;
    } catch (linkError) {
      if (attempt === 1) safeLogError(`Check-in ${id} link to application ${slip.applicationId}`, linkError);
    }
  }

  const ownerId = ownerOf(checkIn.jobPosting);
  if (ownerId && ownerId !== actor.id) {
    void sendNotification(
      ownerId,
      "Self check-in confirmed",
      `${slip.applicantName} (${queueNumber(checkIn.queueSeq)}) was checked in for ${slip.jobTitle} by another recruiter and is now in your applications.`,
      "INFO",
      `/ta/applications/${slip.applicationId}`,
    );
  }
  void logAudit(actor.id, "WALK_IN_CHECK_IN_CONFIRMED", "WalkInCheckIn", id, {
    applicationId: slip.applicationId,
    jobOwnerId: ownerId,
  });
  return slip;
};

export const dismissCheckIn = async (actor: Actor, id: number, reason: string) => {
  const exists = await prisma.walkInCheckIn.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new Error("Check-in not found");
  const result = await prisma.walkInCheckIn.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "DISMISSED", dismissedById: actor.id, dismissReason: reason.trim() },
  });
  if (result.count === 0) throw new WalkInConflictError("This check-in was already handled");
  void logAudit(actor.id, "WALK_IN_CHECK_IN_DISMISSED", "WalkInCheckIn", id, { reason: reason.trim() });
  return { id, status: "DISMISSED" as const };
};
