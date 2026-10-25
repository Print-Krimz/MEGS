// Self check-in (Phase 2): the applicant queues from a QR poster, any TA confirms at the desk and runs the normal walk-in intake.
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import prisma from "../../utils/prisma.js";
import supabase from "../../utils/supabase.js";
import { ensureBucketExists } from "../../middleware/upload.middleware.js";
import { validateDocumentBytes, sanitizeUploadFileName } from "../../security/file-validation.js";
import { CHECK_IN_BIODATA_MESSAGE, CHECK_IN_BIODATA_UNAVAILABLE_MESSAGE } from "../../security/public-messages.js";
import { logAudit } from "../../utils/audit.js";
import { safeLogError } from "../../security/errors.js";
import { notifyOwner } from "../../utils/notification.js";
import { isPhilippinePhone, normalizeToE164, normalizeToLocal } from "../../utils/sms.js";
import { manilaDateString } from "../../schemas/field-limits.js";
import { jobOwnerTaId, type Actor } from "./ownership.js";
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
  gender?: string | null;
  existingUserId?: string | null;
}

const isUniqueViolation = (error: unknown): boolean => (error as { code?: string } | null)?.code === "P2002";

// ---------- held biodata (no StoredDocument: the applicant has no User yet) ----------

const BIODATA_BUCKET = "applicant-assets";
const EXPIRED_PURGE_AFTER_MS = 24 * 60 * 60 * 1000;
const EXPIRED_PURGE_BATCH = 20;

/** Best effort: a leftover object is private; rows that still point at it are swept later. Failures are logged, never thrown. */
const removeHeldObjects = async (paths: string[]): Promise<boolean> => {
  if (paths.length === 0) return true;
  try {
    const { error } = await supabase.storage.from(BIODATA_BUCKET).remove(paths);
    if (error) throw error;
    return true;
  } catch (error) {
    safeLogError("Check-in biodata removal", error);
    return false;
  }
};

/** Checks the bytes and stores the file under check-ins/<publicId>/. Returns the columns to save on the row. */
const holdBiodata = async (publicId: string, file: Express.Multer.File) => {
  let extension: string;
  try {
    const validated = validateDocumentBytes(file.buffer, file.mimetype);
    if (!["pdf", "jpg", "png", "webp"].includes(validated.extension)) throw new Error("not a photo or PDF");
    extension = validated.extension;
  } catch {
    throw new CheckInInputError(CHECK_IN_BIODATA_MESSAGE);
  }
  await ensureBucketExists(BIODATA_BUCKET);
  const path = `check-ins/${publicId}/${randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(BIODATA_BUCKET).upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
  if (error) throw error;
  return {
    biodataStoragePath: path,
    biodataMimeType: file.mimetype,
    biodataFileName: sanitizeUploadFileName(file.originalname),
    biodataSizeBytes: file.size ?? file.buffer.length,
  };
};

const loadHeldBiodata = async (held: { path: string; mimeType: string | null; fileName: string | null }): Promise<Express.Multer.File> => {
  try {
    const { data, error } = await supabase.storage.from(BIODATA_BUCKET).download(held.path);
    if (error || !data) throw error ?? new Error("empty download");
    const buffer = Buffer.from(await data.arrayBuffer());
    return {
      fieldname: "file",
      originalname: held.fileName ?? "biodata",
      encoding: "7bit",
      mimetype: held.mimeType ?? "application/octet-stream",
      size: buffer.length,
      buffer,
    } as Express.Multer.File;
  } catch (error) {
    safeLogError("Check-in biodata download", error);
    throw new Error(CHECK_IN_BIODATA_UNAVAILABLE_MESSAGE);
  }
};

const PURGE_INTERVAL_MS = 10 * 60 * 1000;
let lastPurgeAt = 0;

/** Opportunistic sweep: held files of closed check-ins whose removal failed, and of pending ones expired over a day ago. Bounded, never throws. */
export const purgeExpiredBiodata = async (): Promise<void> => {
  try {
    const stale = await prisma.walkInCheckIn.findMany({
      where: {
        biodataStoragePath: { not: null },
        OR: [
          { status: { in: ["CONFIRMED", "DISMISSED"] } },
          { status: "PENDING", expiresAt: { lt: new Date(Date.now() - EXPIRED_PURGE_AFTER_MS) } },
        ],
      },
      take: EXPIRED_PURGE_BATCH,
      select: { id: true, biodataStoragePath: true },
    });
    if (stale.length === 0) return;
    if (!(await removeHeldObjects(stale.map((row) => row.biodataStoragePath!)))) return;
    await prisma.walkInCheckIn.updateMany({
      where: { id: { in: stale.map((row) => row.id) } },
      data: { biodataStoragePath: null, biodataMimeType: null, biodataFileName: null, biodataSizeBytes: null },
    });
  } catch (error) {
    safeLogError("Check-in biodata purge", error);
  }
};

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

export const createCheckIn = async (input: CheckInSubmission, file?: Express.Multer.File) => {
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

  // The file is checked and held only for a new check-in (a duplicate ignores it). The public id is chosen here so the
  // object path can carry it before the row exists.
  const publicId = randomUUID();
  const biodata = file ? await holdBiodata(publicId, file) : null;

  try {
    for (let attempt = 0; attempt < MAX_QUEUE_ATTEMPTS; attempt++) {
      const latest = await prisma.walkInCheckIn.aggregate({ where: { queueDate }, _max: { queueSeq: true } });
      const queueSeq = (latest._max.queueSeq ?? 0) + 1;
      try {
        const created = await prisma.walkInCheckIn.create({
          data: {
            publicId,
            ...(biodata ?? {}),
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
  } catch (error) {
    if (biodata) await removeHeldObjects([biodata.biodataStoragePath]);
    throw error;
  }
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
  // Runs in the background at most every 10 minutes per server, so the 30-second list refresh stays fast.
  if (Date.now() - lastPurgeAt >= PURGE_INTERVAL_MS) {
    lastPurgeAt = Date.now();
    void purgeExpiredBiodata();
  }
  const rows = await prisma.walkInCheckIn.findMany({
    where: { status: "PENDING", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "asc" },
    select: listSelect,
  });
  return { items: rows.map(toListItem) };
};


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
      biodataStoragePath: true,
      biodataMimeType: true,
      biodataFileName: true,
      biodataSizeBytes: true,
      jobPosting: {
        select: { title: true, postedById: true, mrfId: true, mrf: { select: { assignedTaId: true, client: { select: { name: true } } } } },
      },
    },
  });
  if (!row) throw new Error("Check-in not found");

  const ownerId = jobOwnerTaId(row.jobPosting);
  const owner = ownerId
    ? await prisma.user.findUnique({ where: { id: ownerId }, select: { applicantProfile: { select: { firstName: true, lastName: true } } } })
    : null;
  return {
    ...toListItem(row),
    mobileNumber: row.mobileNumber ? normalizeToLocal(row.mobileNumber) : null,
    birthDate: fromDbDate(row.birthDate),
    jobOwnerId: ownerId,
    jobOwnerName: ownerDisplayName(owner),
    biodata: row.biodataStoragePath
      ? { fileName: row.biodataFileName ?? "biodata", mimeType: row.biodataMimeType ?? "application/octet-stream", sizeBytes: row.biodataSizeBytes ?? 0 }
      : null,
  };
};

/** The file the applicant attached at check-in, for any TA to look at while the check-in is still pending. */
export const getPendingBiodata = async (id: number) => {
  const row = await prisma.walkInCheckIn.findFirst({
    where: { id, status: "PENDING", expiresAt: { gt: new Date() }, biodataStoragePath: { not: null } },
    select: { biodataStoragePath: true, biodataMimeType: true, biodataFileName: true },
  });
  if (!row?.biodataStoragePath) throw new Error("Biodata not found");
  const file = await loadHeldBiodata({ path: row.biodataStoragePath, mimeType: row.biodataMimeType, fileName: row.biodataFileName });
  return { buffer: file.buffer, mimeType: file.mimetype, fileName: file.originalname };
};

export const confirmCheckIn = async (
  actor: Actor,
  id: number,
  input: CheckInConfirmInput,
  attached?: Express.Multer.File,
): Promise<WalkInSlip> => {
  const checkIn = await prisma.walkInCheckIn.findUnique({
    where: { id },
    select: { jobPostingId: true, queueSeq: true, biodataStoragePath: true, biodataMimeType: true, biodataFileName: true, jobPosting: { select: { title: true, postedById: true, mrfId: true, mrf: { select: { assignedTaId: true } } } } },
  });
  if (!checkIn) throw new Error("Check-in not found");
  const heldPath = checkIn.biodataStoragePath;
  // The TA's own file wins; otherwise the one the applicant attached at check-in.
  if (!attached && !heldPath) throw new Error("Attach the biodata photo or PDF");

  // Atomic claim: a second confirm (or an expired row) matches nothing.
  const claimed = await prisma.walkInCheckIn.updateMany({
    where: { id, status: "PENDING", expiresAt: { gt: new Date() } },
    data: { status: "CONFIRMED", confirmedById: actor.id },
  });
  if (claimed.count === 0) throw new WalkInConflictError("This check-in was already handled or has expired");

  let slip: WalkInSlip;
  try {
    const file = attached ?? (await loadHeldBiodata({ path: heldPath!, mimeType: checkIn.biodataMimeType, fileName: checkIn.biodataFileName }));
    const walkInInput: CreateWalkInInput = {
      jobPostingId: checkIn.jobPostingId,
      source: "WALK_IN",
      firstName: input.firstName,
      middleName: input.middleName || null,
      lastName: input.lastName,
      mobileNumber: input.mobileNumber || null,
      birthDate: input.birthDate,
      gender: input.gender || null,
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

  // The held copy is no longer needed: the application has its own document now.
  if (heldPath && (await removeHeldObjects([heldPath]))) {
    await prisma.walkInCheckIn
      .update({ where: { id }, data: { biodataStoragePath: null, biodataMimeType: null, biodataFileName: null, biodataSizeBytes: null } })
      .catch((clearError) => safeLogError(`Check-in ${id} biodata columns`, clearError));
  }

  const ownerId = jobOwnerTaId(checkIn.jobPosting);
  // An unassigned requisition has no TA to tell, so the Admins hear about it instead.
  void notifyOwner(
    ownerId,
    "Self check-in confirmed",
    `${slip.applicantName} (${queueNumber(checkIn.queueSeq)}) was checked in for ${slip.jobTitle} by another recruiter and is now in Applications.`,
    "INFO",
    `/ta/applications/${slip.applicationId}`,
    { excludeUserId: actor.id },
  );
  void logAudit(actor.id, "WALK_IN_CHECK_IN_CONFIRMED", "WalkInCheckIn", id, {
    applicationId: slip.applicationId,
    jobOwnerId: ownerId,
  });
  return slip;
};

export const dismissCheckIn = async (actor: Actor, id: number, reason: string) => {
  const exists = await prisma.walkInCheckIn.findUnique({ where: { id }, select: { id: true, biodataStoragePath: true } });
  if (!exists) throw new Error("Check-in not found");
  const result = await prisma.walkInCheckIn.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "DISMISSED", dismissedById: actor.id, dismissReason: reason.trim() },
  });
  if (result.count === 0) throw new WalkInConflictError("This check-in was already handled");
  if (exists.biodataStoragePath && (await removeHeldObjects([exists.biodataStoragePath]))) {
    await prisma.walkInCheckIn
      .update({ where: { id }, data: { biodataStoragePath: null, biodataMimeType: null, biodataFileName: null, biodataSizeBytes: null } })
      .catch((clearError) => safeLogError(`Check-in ${id} biodata columns`, clearError));
  }
  void logAudit(actor.id, "WALK_IN_CHECK_IN_DISMISSED", "WalkInCheckIn", id, { reason: reason.trim() });
  return { id, status: "DISMISSED" as const };
};
