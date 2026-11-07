// One-off cleanup: merges duplicate applicant accounts (same mobile AND same name) into one.
// Used by scripts/merge-duplicate-applicants.ts, which is a dry run unless given --apply.
import type { Prisma } from "@prisma/client";
import prisma from "../../utils/prisma.js";

export interface MergeMember {
  userId: string;
  profileId: number;
  accountStatus: string;
  syntheticEmail: boolean;
  verified: boolean;
  applications: number;
  hasEmployee: boolean;
  createdAt: Date;
  firstName: string;
  lastName: string;
  mobile10: string;
}

export interface DuplicateGroup {
  mobile10: string;
  members: MergeMember[];
}

export interface DuplicateReport {
  /** Same mobile and same name: safe to merge. */
  merge: DuplicateGroup[];
  /** Same mobile, different names: listed for a human, never merged. */
  review: DuplicateGroup[];
}

export class MergeSkipped extends Error {}

// Same rule as walk-in.service.ts; copied so this one-off tool does not load the Supabase client.
const normalizeName = (value: string | null | undefined): string =>
  (value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const last10 = (value: string | null | undefined): string => (value ?? "").replace(/\D/g, "").slice(-10);

/** Real-email active account first, then most applications, then oldest. */
export const pickSurvivor = (members: MergeMember[]): { survivor: MergeMember; losers: MergeMember[] } => {
  const rank = (m: MergeMember) => [
    m.accountStatus === "ACTIVE" && !m.syntheticEmail ? 0 : 1,
    -m.applications,
    m.createdAt.getTime(),
  ];
  const sorted = [...members].sort((a, b) => {
    const [x, y] = [rank(a), rank(b)];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  });
  return { survivor: sorted[0], losers: sorted.slice(1) };
};

/** Why a loser cannot be merged automatically, or null when it can. Mirrors the checks in mergeApplicantAccounts. */
export const skipReason = (survivor: MergeMember, loser: MergeMember): string | null => {
  if (!loser.syntheticEmail) return "has its own real-email login; merging would lock that person out";
  if (survivor.hasEmployee && loser.hasEmployee) return "both accounts have an employee record";
  return null;
};

export const findDuplicateApplicantGroups = async (): Promise<DuplicateReport> => {
  const users = await prisma.user.findMany({
    where: { role: "APPLICANT", applicantProfile: { isNot: null } },
    select: {
      id: true,
      email: true,
      phoneNumber: true,
      accountStatus: true,
      createdAt: true,
      applicantProfile: {
        select: { id: true, firstName: true, lastName: true, mobileNumber: true, verificationStatus: true },
      },
      employee: { select: { id: true } },
      _count: { select: { applications: true } },
    },
  });

  const byMobile = new Map<string, MergeMember[]>();
  for (const u of users) {
    const p = u.applicantProfile!;
    const mobile10 = last10(p.mobileNumber) || last10(u.phoneNumber);
    if (mobile10.length < 10) continue;
    const member: MergeMember = {
      userId: u.id,
      profileId: p.id,
      accountStatus: u.accountStatus,
      syntheticEmail: u.email.endsWith("@applicant.megs.local") || u.email.endsWith("@megs.internal"),
      verified: p.verificationStatus === "VERIFIED",
      applications: u._count.applications,
      hasEmployee: !!u.employee,
      createdAt: u.createdAt,
      firstName: p.firstName,
      lastName: p.lastName,
      mobile10,
    };
    byMobile.set(mobile10, [...(byMobile.get(mobile10) ?? []), member]);
  }

  const report: DuplicateReport = { merge: [], review: [] };
  for (const [mobile10, members] of byMobile) {
    if (members.length < 2) continue;
    const byName = new Map<string, MergeMember[]>();
    for (const m of members) {
      const key = `${normalizeName(m.firstName)}|${normalizeName(m.lastName)}`;
      byName.set(key, [...(byName.get(key) ?? []), m]);
    }
    for (const same of byName.values()) if (same.length > 1) report.merge.push({ mobile10, members: same });
    if (byName.size > 1) report.review.push({ mobile10, members });
  }
  return report;
};

type Tx = Prisma.TransactionClient;

const norm = (v: string | null | undefined) => normalizeName(v);

const FILL_FIELDS = [
  "middleName", "mobileNumber", "gender", "province", "city", "barangay", "postalCode", "dateOfBirth", "birthPlace",
  "nationality", "civilStatus", "height", "weight", "religion", "address", "preferredWorkLocations", "pagibig",
  "philhealth", "sss", "tin", "photoUrl", "resumeUrl", "professionalSummary", "emergencyContactName",
  "emergencyContactRelationship", "emergencyContactPhone", "emergencyContactAddress", "additionalNotes", "tattooStatus",
] as const;

export interface MergeCounts {
  applications: number;
  documents: number;
  notifications: number;
  profileRows: number;
  filledFields: number;
}

/**
 * Moves everything the loser owns onto the survivor, then deletes the loser's User and profile.
 * One transaction: a foreign key the code did not expect makes the delete fail and nothing changes.
 * Throws MergeSkipped when both accounts own a record that cannot be combined.
 * The caller deletes the loser's Supabase Auth user after this commits.
 */
export const mergeApplicantAccounts = async (survivorId: string, loserId: string): Promise<MergeCounts> => {
  return prisma.$transaction(async (tx: Tx) => {
    const [sUser, lUser] = await Promise.all(
      [survivorId, loserId].map((id) =>
        tx.user.findUniqueOrThrow({
          where: { id },
          include: {
            applicantProfile: {
              include: { workExperiences: true, educations: true, skills: true, trainings: true, characterReferences: true, talentPoolMembership: true },
            },
            employee: { select: { id: true } },
          },
        }),
      ),
    );
    const sp = sUser.applicantProfile;
    const lp = lUser.applicantProfile;
    if (!sp || !lp) throw new MergeSkipped("an account has no profile");
    if (sUser.role !== "APPLICANT" || lUser.role !== "APPLICANT") throw new MergeSkipped("not an applicant account");
    if (!lUser.email.endsWith("@applicant.megs.local") && !lUser.email.endsWith("@megs.internal")) {
      throw new MergeSkipped("the account to remove has its own real-email login");
    }
    if (sUser.employee && lUser.employee) throw new MergeSkipped("both accounts have an employee record");
    if (sp.talentPoolMembership && lp.talentPoolMembership) throw new MergeSkipped("both accounts are in the talent pool");

    const counts: MergeCounts = { applications: 0, documents: 0, notifications: 0, profileRows: 0, filledFields: 0 };

    // Applications: keep every attempt; renumber only when (user, job, attempt) would collide.
    const mine = await tx.application.findMany({ where: { userId: survivorId }, select: { jobPostingId: true, attemptNumber: true } });
    const maxAttempt = new Map<number, number>();
    for (const a of mine) maxAttempt.set(a.jobPostingId, Math.max(maxAttempt.get(a.jobPostingId) ?? 0, a.attemptNumber));
    const theirs = await tx.application.findMany({
      where: { userId: loserId },
      select: { id: true, jobPostingId: true, attemptNumber: true },
      orderBy: [{ jobPostingId: "asc" }, { attemptNumber: "asc" }],
    });
    for (const a of theirs) {
      const top = maxAttempt.get(a.jobPostingId);
      const attemptNumber = top === undefined ? a.attemptNumber : top + 1;
      maxAttempt.set(a.jobPostingId, Math.max(top ?? 0, attemptNumber));
      await tx.application.update({ where: { id: a.id }, data: { userId: survivorId, attemptNumber } });
    }
    counts.applications = theirs.length;

    // Saved jobs: the survivor's copy wins on a clash.
    const savedKeys = new Set((await tx.savedJob.findMany({ where: { userId: survivorId }, select: { jobPostingId: true } })).map((s) => s.jobPostingId));
    const theirSaved = await tx.savedJob.findMany({ where: { userId: loserId }, select: { id: true, jobPostingId: true } });
    for (const s of theirSaved) {
      if (savedKeys.has(s.jobPostingId)) await tx.savedJob.delete({ where: { id: s.id } });
      else await tx.savedJob.update({ where: { id: s.id }, data: { userId: survivorId } });
    }

    // Straight re-points by user.
    counts.documents = (await tx.storedDocument.updateMany({ where: { ownerId: loserId }, data: { ownerId: survivorId } })).count;
    counts.notifications = (await tx.notification.updateMany({ where: { userId: loserId }, data: { userId: survivorId } })).count;
    await tx.notificationOutbox.updateMany({ where: { recipientId: loserId }, data: { recipientId: survivorId } });
    await tx.auditLog.updateMany({ where: { userId: loserId }, data: { userId: survivorId } });
    // Intake and self-service steps record the applicant as the actor.
    await tx.recruiterDecision.updateMany({ where: { actorId: loserId }, data: { actorId: survivorId } });
    await tx.resumeParseResult.updateMany({ where: { reviewedById: loserId }, data: { reviewedById: survivorId } });
    if (lUser.employee) await tx.employee.update({ where: { id: lUser.employee.id }, data: { userId: survivorId } });

    // Profile rows. A row the survivor already has (same key) is dropped with the loser profile.
    const keep = <T>(rows: T[], key: (r: T) => string) => new Set(rows.map(key));
    const wkey = (r: { company: string; roleTitle: string; startDate: Date }) => `${norm(r.company)}|${norm(r.roleTitle)}|${r.startDate.getTime()}`;
    const ekey = (r: { school: string; degree: string | null }) => `${norm(r.school)}|${norm(r.degree)}`;
    const tkey = (r: { title: string }) => norm(r.title);
    const rkey = (r: { name: string }) => norm(r.name);
    const have = {
      work: keep(sp.workExperiences, wkey),
      edu: keep(sp.educations, ekey),
      train: keep(sp.trainings, tkey),
      ref: keep(sp.characterReferences, rkey),
      skill: keep(sp.skills, (r) => String(r.skillId)),
    };
    const move = async (rows: { id: number }[], model: "workExperience" | "education" | "trainingCertification" | "characterReference") => {
      for (const r of rows) {
        await (tx[model] as any).update({ where: { id: r.id }, data: { applicantProfileId: sp.id } });
        counts.profileRows++;
      }
    };
    await move(lp.workExperiences.filter((r) => !have.work.has(wkey(r))), "workExperience");
    await move(lp.educations.filter((r) => !have.edu.has(ekey(r))), "education");
    await move(lp.trainings.filter((r) => !have.train.has(tkey(r))), "trainingCertification");
    await move(lp.characterReferences.filter((r) => !have.ref.has(rkey(r))), "characterReference");
    for (const r of lp.skills.filter((s) => !have.skill.has(String(s.skillId)))) {
      await tx.applicantSkill.updateMany({ where: { applicantProfileId: lp.id, skillId: r.skillId }, data: { applicantProfileId: sp.id } });
      counts.profileRows++;
    }

    await tx.resumeParseResult.updateMany({ where: { applicantProfileId: lp.id }, data: { applicantProfileId: sp.id } });
    await tx.talentPoolInvitation.updateMany({ where: { applicantProfileId: lp.id }, data: { applicantProfileId: sp.id } });
    await tx.asset.updateMany({ where: { applicantProfileId: lp.id }, data: { applicantProfileId: sp.id } });
    if (lp.talentPoolMembership) await tx.talentPoolMembership.update({ where: { id: lp.talentPoolMembership.id }, data: { applicantProfileId: sp.id } });

    // Rows tied to the loser profile that must go before it can be deleted. Fit scores are recomputed for the survivor.
    await tx.scoringRevalidationTask.deleteMany({ where: { applicantProfileId: lp.id } });
    await tx.candidateFeatureProfile.deleteMany({ where: { applicantProfileId: lp.id } });

    // Whatever is left on the loser profile is a copy of something the survivor already has.
    const gone = { applicantProfileId: lp.id };
    await tx.storedDocument.updateMany({ where: { profileId: lp.id }, data: { profileId: sp.id } });
    await tx.workExperience.deleteMany({ where: gone });
    await tx.education.deleteMany({ where: gone });
    await tx.trainingCertification.deleteMany({ where: gone });
    await tx.characterReference.deleteMany({ where: gone });
    await tx.applicantSkill.deleteMany({ where: gone });

    // Delete the loser, then give the survivor the loser's phone (the column is unique).
    await tx.applicantProfile.delete({ where: { id: lp.id } });
    await tx.user.delete({ where: { id: loserId } });
    if (!sUser.phoneNumber && lUser.phoneNumber) await tx.user.update({ where: { id: survivorId }, data: { phoneNumber: lUser.phoneNumber } });

    // A no-show on either account must stay visible to recruiters.
    if (lp.hasNoShowHistory && !sp.hasNoShowHistory) await tx.applicantProfile.update({ where: { id: sp.id }, data: { hasNoShowHistory: true } });

    // Empty fields only, and never on a TA-verified profile.
    if (sp.verificationStatus !== "VERIFIED") {
      const fill: Record<string, unknown> = {};
      for (const f of FILL_FIELDS) {
        const mineVal = (sp as any)[f];
        const theirVal = (lp as any)[f];
        if ((mineVal === null || mineVal === undefined || mineVal === "") && theirVal !== null && theirVal !== undefined && theirVal !== "") fill[f] = theirVal;
      }
      if (Object.keys(fill).length) await tx.applicantProfile.update({ where: { id: sp.id }, data: fill });
      counts.filledFields = Object.keys(fill).length;
    }

    await tx.auditLog.create({
      data: {
        userId: survivorId,
        action: "APPLICANT_ACCOUNTS_MERGED",
        entity: "User",
        details: JSON.stringify({ survivorId, loserId, ...counts }),
      },
    });
    return counts;
  }, { timeout: 60_000 });
};
