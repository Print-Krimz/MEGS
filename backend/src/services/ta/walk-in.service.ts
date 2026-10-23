// Staff-encoded applicants (walk-in, job fair, referral): duplicate check, intake, slip reprint and the public QR tracker.
import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import prisma from "../../utils/prisma.js";
import supabase from "../../utils/supabase.js";
import { uploadFileToSupabaseWithInfo } from "../../middleware/upload.middleware.js";
import { logAudit } from "../../utils/audit.js";
import { safeLogError } from "../../security/errors.js";
import { enqueueResumeAnalysis, trackFitRevalidation } from "../../workers/resume.worker.js";
import { revalidateApplication } from "../scoring/scoring-configuration.service.js";
import { isPhilippinePhone, maskPhoneNumber, normalizeToE164, normalizeToLocal, toSyntheticEmail } from "../../utils/sms.js";
import { parseManilaDateOnly } from "../../schemas/field-limits.js";
import { assertOwns, type Actor } from "./ownership.js";
import { assertCanApply, resolveInitialStatus } from "../applicant/application.service.js";

export type { WalkInSource } from "./walk-in-tokens.js";
import type { WalkInSource } from "./walk-in-tokens.js";
import { buildTrackingCode, generateTrackingToken, hashToken, tokenMatches } from "./walk-in-tokens.js";

export interface WalkInSlip {
  applicationId: number;
  trackingCode: string;
  trackingToken: string;
  trackPath: string;
  applicantName: string;
  jobTitle: string;
  clientName: string | null;
  location: string | null;
  createdAt: string;
}

/** Thrown for a request that is understood but cannot be applied (maps to 409). */
export class WalkInConflictError extends Error {}

// ---------- helpers ----------

export { buildTrackingCode, generateTrackingToken, hashToken, tokenMatches } from "./walk-in-tokens.js";

export const buildSyntheticWalkInEmail = (phoneE164: string | null): string =>
  phoneE164 ? toSyntheticEmail(phoneE164) : `walkin_${crypto.randomUUID()}@megs.internal`;

/** Lowercase, accents removed, extra spaces collapsed. */
export const normalizeName = (value: string | null | undefined): string =>
  (value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const phoneVariants = (phone: string): string[] => {
  const e164 = normalizeToE164(phone);
  return [...new Set([e164, normalizeToLocal(e164), e164.replace(/^\+/, "")])];
};

const fullName = (p: { firstName: string; middleName?: string | null; lastName: string } | null | undefined): string =>
  p ? [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ") : "";

const toSlip = (
  application: {
    id: number;
    trackingCode: string | null;
    createdAt: Date;
    jobPosting: { title: string; location: string | null; mrf: { client: { name: string } | null } | null };
    user: { applicantProfile: { firstName: string; middleName: string | null; lastName: string } | null };
  },
  token: string,
): WalkInSlip => ({
  applicationId: application.id,
  trackingCode: application.trackingCode!,
  trackingToken: token,
  trackPath: `/t/${application.trackingCode}?token=${token}`,
  applicantName: fullName(application.user.applicantProfile),
  jobTitle: application.jobPosting.title,
  clientName: application.jobPosting.mrf?.client?.name ?? null,
  location: application.jobPosting.location ?? null,
  createdAt: application.createdAt.toISOString(),
});

const slipInclude = {
  jobPosting: { select: { title: true, location: true, mrf: { select: { client: { select: { name: true } } } } } },
  user: { select: { applicantProfile: { select: { firstName: true, middleName: true, lastName: true } } } },
} as const;

// ---------- duplicate check ----------

export interface DuplicateQuery {
  phone?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
}

export const findWalkInDuplicates = async (query: DuplicateQuery) => {
  const phone = query.phone?.trim() && isPhilippinePhone(query.phone) ? normalizeToE164(query.phone) : null;
  const first = normalizeName(query.firstName);
  const last = normalizeName(query.lastName);
  const birthDate = query.birthDate?.trim() ? parseManilaDateOnly(query.birthDate.trim()) : null;

  const or: any[] = [];
  if (phone) {
    const variants = phoneVariants(phone);
    or.push({ phoneNumber: { in: variants } }, { applicantProfile: { is: { mobileNumber: { in: variants } } } });
  }
  if (first && last) {
    const raw = (value: string | undefined) => (value ?? "").trim();
    or.push({
      applicantProfile: {
        is: {
          firstName: { in: [raw(query.firstName), first], mode: "insensitive" },
          lastName: { in: [raw(query.lastName), last], mode: "insensitive" },
        },
      },
    });
  }
  if (or.length === 0) return { matches: [] };

  const users = await prisma.user.findMany({
    where: { role: "APPLICANT", OR: or },
    take: 25,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      phoneNumber: true,
      accountStatus: true,
      applicantProfile: { select: { firstName: true, middleName: true, lastName: true, mobileNumber: true, dateOfBirth: true } },
      applications: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { status: true, jobPosting: { select: { title: true } } },
      },
    },
  });

  const sameDay = (a: Date | null | undefined, b: Date) => !!a && a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
  const matches = users
    .filter((user) => {
      const profile = user.applicantProfile;
      const phoneHit =
        !!phone &&
        [user.phoneNumber, profile?.mobileNumber].some((value) => !!value && normalizeToE164(value) === phone);
      if (phoneHit) return true;
      const nameHit = !!profile && !!first && !!last && normalizeName(profile.firstName) === first && normalizeName(profile.lastName) === last;
      if (!nameHit) return false;
      return birthDate ? sameDay(profile?.dateOfBirth, birthDate) : true;
    })
    .slice(0, 5)
    .map((user) => {
      const mobile = user.phoneNumber ?? user.applicantProfile?.mobileNumber ?? null;
      const latest = user.applications[0];
      return {
        userId: user.id,
        fullName: fullName(user.applicantProfile),
        maskedPhone: mobile ? maskPhoneNumber(mobile) : null,
        hasPortalAccess: user.accountStatus === "ACTIVE",
        isWalkIn: user.accountStatus === "WALK_IN",
        latestApplication: latest ? { jobTitle: latest.jobPosting.title, status: latest.status } : null,
      };
    });
  return { matches };
};

// ---------- intake ----------

export interface CreateWalkInInput {
  jobPostingId: number;
  source: WalkInSource;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  mobileNumber?: string | null;
  birthDate?: string | null;
  existingUserId?: string | null;
}

/** Removes a just-created person that never got an application. Auth user is deleted last, whatever else fails. */
const rollbackNewUser = async (userId: string) => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.storedDocument.deleteMany({ where: { ownerId: userId } });
      await tx.applicantProfile.deleteMany({ where: { userId } });
      await tx.user.deleteMany({ where: { id: userId } });
    });
  } catch (error) {
    console.error("[WalkIn] rollback of new applicant failed", error);
  }
  await Promise.resolve(supabase.auth.admin.deleteUser(userId)).catch(() => undefined);
};

/**
 * Reads the paper bio-data into the applicant's profile. Never rejects: a failure only means the profile stays
 * as the TA typed it. A new person gets blanks filled; an existing person's proposal waits for TA review.
 */
const extractWalkInProfile = async (
  userId: string,
  file: Express.Multer.File,
  stored: { documentId: number; sha256: string },
  isNewPerson: boolean,
  taUserId: string,
): Promise<void> => {
  try {
    const { parseResumeToProposal, fillBlanksFromParse } = await import("../applicant/resume-merge.service.js");
    const profile = await prisma.applicantProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) return;
    const proposal = await parseResumeToProposal({
      profileId: profile.id,
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
      documentId: stored.documentId,
      sha256: stored.sha256,
      source: "WALK_IN",
    });
    if (isNewPerson && proposal?.id) await fillBlanksFromParse(proposal.id, taUserId);
  } catch (error) {
    safeLogError("Walk-in profile extraction", error);
  }
};

export interface CreateWalkInOptions {
  /** Only for a confirmed self check-in: any TA may encode it, the application belongs to the job's owner. */
  skipOwnership?: boolean;
  selfEncoded?: boolean;
}

export const createWalkIn = async (
  actor: Actor,
  input: CreateWalkInInput,
  file: Express.Multer.File,
  options: CreateWalkInOptions = {},
): Promise<WalkInSlip> => {
  if (!options.skipOwnership) await assertOwns("job", input.jobPostingId, actor);

  const mobile = input.mobileNumber?.trim() || null;
  if (mobile && !isPhilippinePhone(mobile)) throw new Error("Enter a valid Philippine mobile number");
  const phoneE164 = mobile ? normalizeToE164(mobile) : null;
  const birthDate = input.birthDate?.trim() ? parseManilaDateOnly(input.birthDate.trim()) : null;

  let userId: string;
  let createdNewUser = false;
  let reusedExistingUser = false;

  if (input.existingUserId) {
    const existing = await prisma.user.findUnique({
      where: { id: input.existingUserId },
      select: { id: true, role: true, phoneNumber: true, applicantProfile: true },
    });
    if (!existing || existing.role !== "APPLICANT") throw new Error("Applicant not found");
    await assertCanApply(existing.id, input.jobPostingId);
    userId = existing.id;
    reusedExistingUser = true;

    // Staff data never overwrites applicant data: fill blanks only.
    const profile = existing.applicantProfile;
    if (!profile) {
      await prisma.applicantProfile.create({
        data: {
          userId,
          firstName: input.firstName,
          middleName: input.middleName || null,
          lastName: input.lastName,
          mobileNumber: mobile ? normalizeToLocal(mobile) : null,
          dateOfBirth: birthDate,
        },
      });
    } else {
      const fill: Record<string, unknown> = {};
      if (!profile.middleName && input.middleName) fill.middleName = input.middleName;
      if (!profile.mobileNumber && mobile) fill.mobileNumber = normalizeToLocal(mobile);
      if (!profile.dateOfBirth && birthDate) fill.dateOfBirth = birthDate;
      if (Object.keys(fill).length) await prisma.applicantProfile.update({ where: { userId }, data: fill });
    }
    if (!existing.phoneNumber && phoneE164) {
      const taken = await prisma.user.findFirst({ where: { phoneNumber: phoneE164, id: { not: userId } }, select: { id: true } });
      if (!taken) await prisma.user.update({ where: { id: userId }, data: { phoneNumber: phoneE164 } });
    }
  } else {
    // Fail before creating anything when the job is closed.
    const job = await prisma.jobPosting.findUnique({ where: { id: input.jobPostingId }, select: { status: true } });
    if (!job) throw new Error("Job not found");
    if (job.status !== "OPEN") throw new Error("This job is no longer accepting applications");
    if (phoneE164) {
      const variants = phoneVariants(phoneE164);
      const taken = await prisma.user.findFirst({
        where: { OR: [{ phoneNumber: { in: variants } }, { email: toSyntheticEmail(phoneE164) }] },
        select: { id: true },
      });
      if (taken) throw new WalkInConflictError("This mobile number already belongs to an applicant. Use the duplicate check and pick that person.");
    }

    const email = buildSyntheticWalkInEmail(phoneE164);
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: `Walk_${crypto.randomBytes(16).toString("hex")}!Aa1`,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(error?.message || "Failed to create the applicant record");
    userId = data.user.id;
    createdNewUser = true;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id: userId,
            email,
            role: "APPLICANT",
            accountStatus: "WALK_IN",
            invitedAt: new Date(),
            invitedBy: actor.id,
            phoneNumber: phoneE164,
          },
        });
        await tx.applicantProfile.create({
          data: {
            userId,
            firstName: input.firstName,
            middleName: input.middleName || null,
            lastName: input.lastName,
            mobileNumber: mobile ? normalizeToLocal(mobile) : null,
            dateOfBirth: birthDate,
          },
        });
      });
    } catch (dbError) {
      await Promise.resolve(supabase.auth.admin.deleteUser(userId)).catch(() => undefined);
      throw dbError;
    }
  }

  // Once the application row is committed the person is real; only earlier failures undo the new user.
  let applicationCommitted = false;
  try {
    const job = await assertCanApply(userId, input.jobPostingId);
    const { url: resumeUrl, documentId, sha256 } = await uploadFileToSupabaseWithInfo("applicant-assets", userId, file);
    await prisma.applicantProfile.updateMany({ where: { userId, resumeUrl: null }, data: { resumeUrl } });

    const initial = await resolveInitialStatus(userId, job);
    const { token, hash } = generateTrackingToken();
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.application.create({
        data: {
          userId,
          jobPostingId: input.jobPostingId,
          attemptNumber: initial.attemptNumber,
          resumeUrl,
          status: initial.status,
          source: input.source,
          selfEncoded: options.selfEncoded ?? false,
        },
      });
      return tx.application.update({
        where: { id: row.id },
        data: { trackingCode: buildTrackingCode(input.source, row.id, new Date().getFullYear()), trackingTokenHash: hash },
        include: slipInclude,
      });
    });

    applicationCommitted = true;

    // The application is committed: nothing below may throw, or a caller would retry and encode the person twice.
    try {
      if (initial.sameClientDeployment) {
        const { generateComplianceRequirementsFromMRF, reuseValidSameClientDocuments } = await import("./ta.compliance.service.js");
        await generateComplianceRequirementsFromMRF(created.id);
        const priorIds = [...new Set(initial.sameClientDeployments.map((d) => d.applicationId).filter((id): id is number => id !== null))];
        await reuseValidSameClientDocuments(created.id, priorIds);
      } else {
        try {
          await enqueueResumeAnalysis(created.id);
        } catch {
          await prisma.application.update({
            where: { id: created.id },
            data: { status: "NEEDS_ATTENTION", aiSummary: "Automatic analysis is busy. The saved application requires manual review or a later staff retry." },
          });
        }
      }
      // Scoring waits for the profile fill so the first score sees gender, address, work and skills. A failed fill still scores.
      const profileReady = extractWalkInProfile(userId, file, { documentId, sha256 }, createdNewUser, actor.id);
      const revalidation = profileReady.then(() => revalidateApplication(created.id, input.jobPostingId));
      trackFitRevalidation(created.id, revalidation);
      void revalidation.catch((error) => safeLogError("Scoring revalidation queue", error));
    } catch (postCommitError) {
      safeLogError(`Walk-in post-commit step for application ${created.id}`, postCommitError);
    }

    void logAudit(actor.id, "WALK_IN_ENCODED", "Application", created.id, { source: input.source, reusedExistingUser });
    return toSlip(created, token);
  } catch (error) {
    if (createdNewUser && !applicationCommitted) await rollbackNewUser(userId);
    throw error;
  }
};

// ---------- slip reprint ----------

export const reissueSlip = async (actor: Actor, applicationId: number): Promise<WalkInSlip> => {
  await assertOwns("application", applicationId, actor);
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, source: true, trackingCode: true },
  });
  if (!application) throw new Error("Application not found");
  if (application.source === "ONLINE") throw new WalkInConflictError("Online applications do not have a slip");

  const { token, hash } = generateTrackingToken();
  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      trackingTokenHash: hash,
      trackingCode: application.trackingCode ?? buildTrackingCode(application.source as WalkInSource, applicationId, new Date().getFullYear()),
    },
    include: slipInclude,
  });
  void logAudit(actor.id, "WALK_IN_SLIP_REISSUED", "Application", applicationId, { source: application.source });
  return toSlip(updated, token);
};

// ---------- public tracker ----------

const trackingSelect = {
  id: true,
  trackingCode: true,
  trackingTokenHash: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { applicantProfile: { select: { firstName: true, lastName: true } } } },
  jobPosting: { select: { title: true, location: true, mrf: { select: { client: { select: { name: true } } } } } },
} as const;

const nextInterviewSelect = () =>
  ({
    // Only an interview still ahead and not yet decided. A finished one (PASS, FAIL, NO_SHOW) must not show as "next".
    where: {
      isActive: true,
      scheduledAt: { gt: new Date() },
      conductedAt: null,
      OR: [{ result: null }, { result: { in: ["PENDING", "SCHEDULED"] } }],
    },
    orderBy: { scheduledAt: "asc" },
    take: 1,
    select: { type: true, scheduledAt: true },
  }) satisfies Prisma.Application$interviewsArgs;

type TrackingRow = {
  trackingCode: string | null;
  status: any;
  createdAt: Date;
  updatedAt: Date;
  user: { applicantProfile: { firstName: string; lastName: string } | null };
  jobPosting: { title: string; location: string | null; mrf: { client: { name: string } | null } | null };
  interviews: Array<{ type: unknown; scheduledAt: Date | null }>;
};

const buildTrackingPayload = (application: TrackingRow) => {
  const profile = application.user.applicantProfile;
  const initial = profile?.lastName?.trim().charAt(0).toUpperCase();
  const next = application.interviews[0];
  return {
    trackingCode: application.trackingCode!,
    applicantName: profile ? `${profile.firstName.trim()}${initial ? ` ${initial}.` : ""}` : "Applicant",
    jobTitle: application.jobPosting.title,
    clientName: application.jobPosting.mrf?.client?.name ?? null,
    status: application.status,
    appliedAt: application.createdAt.toISOString(),
    nextInterview: next?.scheduledAt ? { type: String(next.type), scheduledAt: next.scheduledAt.toISOString() } : null,
    venue: application.jobPosting.location ?? null,
    updatedAt: application.updatedAt.toISOString(),
  };
};

/** Returns null for any mismatch so the controller can answer a uniform 404. */
export const getPublicTracking = async (code: string, token: string) => {
  if (!code || !token || code.length > 40 || token.length > 100) return null;
  const application = await prisma.application.findUnique({
    where: { trackingCode: code.trim().toUpperCase() },
    select: { ...trackingSelect, interviews: nextInterviewSelect() },
  });
  if (!application || !tokenMatches(token, application.trackingTokenHash)) return null;
  return buildTrackingPayload(application);
};

/** Same payload without a token check. Callers must already have proved access (a valid check-in view token). */
export const getTrackingByApplicationId = async (applicationId: number) => {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { ...trackingSelect, interviews: nextInterviewSelect() },
  });
  if (!application || !application.trackingCode) return null;
  return buildTrackingPayload(application);
};
