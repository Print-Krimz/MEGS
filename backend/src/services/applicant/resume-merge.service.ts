// Smart Merge for resume uploads: a parsed resume is only a proposal.
// Nothing reaches the profile until the applicant (or the owning TA) accepts items from it.
// Verified profile values win: an applicant cannot overwrite them.
import prisma from "../../utils/prisma.js";
import { logAudit } from "../../utils/audit.js";
import { modelThatExtracted, type ExtractedProfileData } from "../../utils/gemini.js";
import {
  normalizeCivilStatus,
  normalizeGender,
  normalizeMobileNumber,
  normalizePostalCode,
  parseHeightCm,
  parseLooseDate,
  parseWeightKg,
} from "../../utils/profile-normalizers.js";
import { resumeDedupe } from "../../utils/resume-dedupe.js";
import {
  applyExtractedProfileService,
  processResumeExtractionService,
  type ApplyExtractedProfileDto,
  type ResumeChangeSummary,
} from "./applicant.service.js";

export type ResumeParseSource = "PROFILE_UPLOAD" | "APPLICATION_SUBMIT" | "WALK_IN" | "TA_REPARSE";
export type PersonalStatus = "suggested" | "conflict" | "same";
export type ItemStatus = "new" | "duplicate" | "needs_date";

export class ResumeMergeError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export const PERSONAL_FIELDS = [
  "firstName",
  "middleName",
  "lastName",
  "mobileNumber",
  "gender",
  "dateOfBirth",
  "birthPlace",
  "nationality",
  "civilStatus",
  "religion",
  "height",
  "weight",
  "province",
  "city",
  "barangay",
  "postalCode",
  "address",
  "preferredWorkLocations",
  "professionalSummary",
] as const;

export interface PersonalProposal {
  field: string;
  status: PersonalStatus;
  current: string | number | null;
  proposed: string | number;
  /** A verified profile value: only a TA may overwrite it. */
  locked: boolean;
}

export interface ItemProposal<T> {
  /** Position in the parsed list; send it back in accept. */
  index: number;
  status: ItemStatus;
  item: T;
}

type Extracted = NonNullable<ExtractedProfileData>;

export interface MergeProposal {
  verified: boolean;
  personal: PersonalProposal[];
  workExperiences: Array<ItemProposal<NonNullable<Extracted["workExperiences"]>[number]>>;
  educations: Array<ItemProposal<NonNullable<Extracted["educations"]>[number]>>;
  skills: Array<{ name: string; status: "new" | "duplicate" }>;
  trainings: Array<ItemProposal<NonNullable<Extracted["trainings"]>[number]>>;
  references: Array<ItemProposal<NonNullable<Extracted["characterReferences"]>[number]>>;
}

export interface MergeAccept {
  personal: string[];
  overwrite: string[];
  workExperiences: number[];
  educations: number[];
  skills: string[];
  trainings: number[];
  references: number[];
}

export interface MergeActor {
  userId: string;
  role: string;
}

const text = (value: unknown) => (value === undefined || value === null ? "" : String(value).trim());
const same = (a: string, b: string) => a.replace(/\s+/g, " ").toLowerCase() === b.replace(/\s+/g, " ").toLowerCase();

// Value the apply step would store, so "same" means "applying it would change nothing".
const comparable = (field: string, value: unknown): string => {
  switch (field) {
    case "gender": return normalizeGender(value) ?? text(value);
    case "civilStatus": return normalizeCivilStatus(value) ?? text(value);
    case "mobileNumber": return normalizeMobileNumber(value) ?? text(value);
    case "postalCode": return normalizePostalCode(value) ?? text(value);
    case "height": return String(parseHeightCm(value) ?? "");
    case "weight": return String(parseWeightKg(value) ?? "");
    case "dateOfBirth": {
      if (value instanceof Date) return isNaN(value.getTime()) ? "" : value.toISOString().substring(0, 10);
      return parseLooseDate(value) ?? "";
    }
    default: return text(value);
  }
};

const profileRelations = {
  workExperiences: true,
  educations: true,
  skills: { include: { skill: true } },
  trainings: true,
  characterReferences: true,
} as const;

const loadProfile = (profileId: number) =>
  prisma.applicantProfile.findUnique({ where: { id: profileId }, include: profileRelations });

type ProfileForMerge = NonNullable<Awaited<ReturnType<typeof loadProfile>>>;

export const buildMergeProposal = (profile: ProfileForMerge | any, extracted: ExtractedProfileData): MergeProposal => {
  // Nothing sets VERIFIED anymore; rows verified before that change stay protected.
  const verified = profile.verificationStatus === "VERIFIED";

  const personal: PersonalProposal[] = [];
  for (const field of PERSONAL_FIELDS) {
    const incoming = (extracted as any)[field];
    const incomingKey = comparable(field, incoming);
    if (!incomingKey) continue;
    const saved = profile[field];
    const savedKey = comparable(field, saved);
    const proposed = typeof incoming === "number" ? incoming : text(incoming);
    const current = saved === undefined || saved === null || text(saved) === "" ? null : saved instanceof Date ? saved.toISOString().substring(0, 10) : saved;
    if (!savedKey) {
      personal.push({ field, status: "suggested", current: null, proposed, locked: false });
    } else if (same(savedKey, incomingKey)) {
      personal.push({ field, status: "same", current, proposed, locked: false });
    } else {
      personal.push({ field, status: "conflict", current, proposed, locked: verified });
    }
  }

  const workKeys = new Set<string>((profile.workExperiences ?? []).map((e: any) => resumeDedupe.workKey(e.company, e.roleTitle)));
  const workExperiences = (extracted.workExperiences ?? []).map((item, index) => {
    const duplicate = workKeys.has(resumeDedupe.workKey(item.company, item.roleTitle));
    const status: ItemStatus = duplicate ? "duplicate" : parseLooseDate(item.startDate) ? "new" : "needs_date";
    return { index, status, item };
  });

  const eduKeys = new Set<string>((profile.educations ?? []).map((e: any) => resumeDedupe.educationKey(e.school, e.degree)));
  const educations = (extracted.educations ?? []).map((item, index) => ({
    index,
    status: (eduKeys.has(resumeDedupe.educationKey(item.school, item.degree)) ? "duplicate" : "new") as ItemStatus,
    item,
  }));

  const skillKeys = new Set<string>((profile.skills ?? []).map((s: any) => resumeDedupe.skillKey(s.skill.name)));
  const seen = new Set<string>();
  const skills: MergeProposal["skills"] = [];
  for (const raw of extracted.skills ?? []) {
    const name = text(raw);
    const key = resumeDedupe.skillKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    skills.push({ name, status: skillKeys.has(key) ? "duplicate" : "new" });
  }

  const trainingKeys = new Set<string>((profile.trainings ?? []).map((t: any) => resumeDedupe.trainingKey(t.title)));
  const trainings = (extracted.trainings ?? []).map((item, index) => ({
    index,
    status: (trainingKeys.has(resumeDedupe.trainingKey(item.title)) ? "duplicate" : "new") as ItemStatus,
    item,
  }));

  const savedRefs: any[] = profile.characterReferences ?? [];
  const references = (extracted.characterReferences ?? []).map((item, index) => ({
    index,
    status: (savedRefs.some((r) => resumeDedupe.referenceMatches(item, r)) ? "duplicate" : "new") as ItemStatus,
    item,
  }));

  return { verified, personal, workExperiences, educations, skills, trainings, references };
};

// Reads (or reuses) the parse for a file. An identical file already parsed for this profile reuses its
// extracted JSON, so the AI is never called twice for the same bytes.
export const parseResumeToProposal = async (input: {
  profileId: number;
  buffer: Buffer;
  mimeType?: string;
  originalName?: string;
  documentId?: number | null;
  sha256?: string | null;
  source: ResumeParseSource;
}) => {
  const { profileId, documentId = null, sha256 = null, source } = input;

  if (sha256) {
    const cached = await prisma.resumeParseResult.findFirst({
      where: { applicantProfileId: profileId, sha256, status: "PARSED", extracted: { not: null as any } },
      orderBy: { createdAt: "desc" },
    });
    if (cached?.extracted) {
      return prisma.resumeParseResult.create({
        data: {
          applicantProfileId: profileId,
          documentId,
          sha256,
          source,
          status: "PARSED",
          model: cached.model,
          latencyMs: 0,
          extracted: cached.extracted as any,
        },
      });
    }
  }

  const startedAt = Date.now();
  const { extractedData } = await processResumeExtractionService(input.buffer, input.mimeType, input.originalName);
  const latencyMs = Date.now() - startedAt;
  return prisma.resumeParseResult.create({
    data: {
      applicantProfileId: profileId,
      documentId,
      sha256,
      source,
      status: extractedData ? "PARSED" : "FAILED",
      model: modelThatExtracted(extractedData) ?? (process.env.GEMINI_MODEL?.trim() || null),
      latencyMs,
      extracted: (extractedData ?? undefined) as any,
      errorCategory: extractedData ? null : "UNAVAILABLE",
    },
  });
};

// Latest unreviewed proposal for a profile, recomputed against what the profile holds now.
export const getLatestProposal = async (profileId: number) => {
  const row = await prisma.resumeParseResult.findFirst({
    where: { applicantProfileId: profileId, status: "PARSED", reviewedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!row?.extracted) return null;
  const profile = await loadProfile(profileId);
  if (!profile) return null;
  return {
    parseId: row.id,
    source: row.source,
    documentId: row.documentId,
    createdAt: row.createdAt,
    proposal: buildMergeProposal(profile, row.extracted as ExtractedProfileData),
  };
};

export const proposalForRow = async (row: { applicantProfileId: number; extracted: unknown }) => {
  const profile = await loadProfile(row.applicantProfileId);
  if (!profile || !row.extracted) return null;
  return buildMergeProposal(profile, row.extracted as ExtractedProfileData);
};

const buildPayload = (
  extracted: ExtractedProfileData,
  chosen: {
    personal: string[];
    overwrite: string[];
    workExperiences: number[];
    educations: number[];
    skills: string[];
    trainings: number[];
    references: number[];
  }
): ApplyExtractedProfileDto => {
  const personalDetails: Record<string, unknown> = {};
  for (const field of chosen.personal) personalDetails[field] = (extracted as any)[field];
  const pick = <T>(list: T[] | undefined, indexes: number[]) => (list ?? []).filter((_, i) => indexes.includes(i));
  return {
    personalDetails: personalDetails as ApplyExtractedProfileDto["personalDetails"],
    overwriteFields: chosen.overwrite,
    workExperiences: pick(extracted.workExperiences, chosen.workExperiences),
    educations: pick(extracted.educations, chosen.educations),
    skills: chosen.skills,
    trainings: pick(extracted.trainings, chosen.trainings),
    characterReferences: pick(extracted.characterReferences, chosen.references),
    overwriteExistingPersonal: false,
    replaceStructuredFields: false,
  };
};

const counts = (c: MergeAccept | ReturnType<typeof acceptAll>) => ({
  personal: c.personal.length,
  overwrite: c.overwrite.length,
  workExperiences: c.workExperiences.length,
  educations: c.educations.length,
  skills: c.skills.length,
  trainings: c.trainings.length,
  references: c.references.length,
});

const loadOpenRow = async (parseId: number, profileId: number) => {
  const row = await prisma.resumeParseResult.findUnique({ where: { id: parseId } });
  if (!row || row.applicantProfileId !== profileId) throw new ResumeMergeError("Resume proposal not found", 404);
  if (row.reviewedAt) throw new ResumeMergeError("This resume proposal was already reviewed", 409);
  if (row.status !== "PARSED" || !row.extracted) throw new ResumeMergeError("This resume could not be read", 409);
  return row;
};

// Claims the row before writing so two requests cannot both apply it; released if the write fails.
const claim = async (parseId: number, reviewedById: string | null) => {
  const claimed = await prisma.resumeParseResult.updateMany({
    where: { id: parseId, reviewedAt: null },
    data: { reviewedAt: new Date(), reviewedById },
  });
  if (claimed.count === 0) throw new ResumeMergeError("This resume proposal was already reviewed", 409);
};

const release = (parseId: number) =>
  prisma.resumeParseResult.updateMany({ where: { id: parseId }, data: { reviewedAt: null, reviewedById: null } });

export const applyMergeDecision = async (input: {
  parseId: number;
  profileId: number;
  actor: MergeActor;
  accept: MergeAccept;
}): Promise<{ profile: any; changeSummary: ResumeChangeSummary | null; accepted: ReturnType<typeof counts> }> => {
  const { parseId, profileId, actor, accept } = input;
  const row = await loadOpenRow(parseId, profileId);
  const profile = await loadProfile(profileId);
  if (!profile) throw new ResumeMergeError("Applicant profile not found", 404);

  const extracted = row.extracted as ExtractedProfileData;
  const proposal = buildMergeProposal(profile, extracted);
  const isTa = actor.role === "TALENT_ACQUISITION";

  const byField = new Map(proposal.personal.map((p) => [p.field, p]));
  const overwrite: string[] = [];
  const personal: string[] = [];
  for (const field of new Set(accept.overwrite)) {
    const entry = byField.get(field);
    if (!entry || entry.status !== "conflict") continue;
    if (entry.locked && !isTa) throw new ResumeMergeError("Verified details can only be changed by Talent Acquisition", 403);
    overwrite.push(field);
    personal.push(field);
  }
  for (const field of new Set(accept.personal)) {
    // A conflict is only taken through overwrite; a plain accept of a conflict keeps the saved value.
    if (byField.get(field)?.status === "suggested") personal.push(field);
  }

  const chosen = {
    personal,
    overwrite,
    workExperiences: accept.workExperiences.filter((i) => proposal.workExperiences.some((p) => p.index === i && p.status === "new")),
    educations: accept.educations.filter((i) => proposal.educations.some((p) => p.index === i && p.status === "new")),
    skills: proposal.skills.filter((s) => s.status === "new" && accept.skills.some((n) => resumeDedupe.skillKey(n) === resumeDedupe.skillKey(s.name))).map((s) => s.name),
    trainings: accept.trainings.filter((i) => proposal.trainings.some((p) => p.index === i && p.status === "new")),
    references: accept.references.filter((i) => proposal.references.some((p) => p.index === i && p.status === "new")),
  };
  const acceptedCounts = counts(chosen);
  const hasChanges = Object.entries(acceptedCounts).some(([key, n]) => key !== "overwrite" && n > 0);

  await claim(parseId, actor.userId);
  let changeSummary: ResumeChangeSummary | null = null;
  let updatedProfile: any = null;
  try {
    if (hasChanges) {
      const result = await applyExtractedProfileService(profile.userId, buildPayload(extracted, chosen));
      changeSummary = result.changeSummary;
      updatedProfile = result.profile;
    }
    await prisma.resumeParseResult.update({ where: { id: parseId }, data: { decision: { accepted: acceptedCounts, ...chosen } as any } });
  } catch (error) {
    await release(parseId).catch(() => {});
    throw error;
  }

  await logAudit(
    actor.userId,
    isTa ? "TA_CANDIDATE_PROFILE_VERIFIED" : "RESUME_MERGE_APPLIED",
    "ApplicantProfile",
    profile.id,
    isTa
      ? { source: "resume-merge", parseId, accepted: acceptedCounts, overwrittenFields: overwrite }
      : { parseId, accepted: acceptedCounts, overwrittenFields: overwrite }
  );

  return { profile: updatedProfile, changeSummary, accepted: acceptedCounts };
};

const acceptAll = (proposal: MergeProposal) => ({
  personal: proposal.personal.filter((p) => p.status === "suggested").map((p) => p.field),
  overwrite: [] as string[],
  workExperiences: proposal.workExperiences.filter((p) => p.status === "new").map((p) => p.index),
  educations: proposal.educations.filter((p) => p.status === "new").map((p) => p.index),
  skills: proposal.skills.filter((s) => s.status === "new").map((s) => s.name),
  trainings: proposal.trainings.filter((p) => p.status === "new").map((p) => p.index),
  references: proposal.references.filter((p) => p.status === "new").map((p) => p.index),
});

// Fills blanks and adds new entries only; never overwrites. For a brand-new profile (walk-in) or the
// first parse a profile ever gets. Anything that conflicts or is a duplicate is left alone.
// actorUserId names who caused the fill (the encoding TA for a walk-in); it defaults to the applicant.
export const fillBlanksFromParse = async (parseId: number, actorUserId?: string) => {
  const row = await prisma.resumeParseResult.findUnique({ where: { id: parseId } });
  if (!row) throw new ResumeMergeError("Resume proposal not found", 404);
  const loaded = await loadOpenRow(parseId, row.applicantProfileId);
  const profile = await loadProfile(loaded.applicantProfileId);
  if (!profile) throw new ResumeMergeError("Applicant profile not found", 404);

  const extracted = loaded.extracted as ExtractedProfileData;
  const chosen = acceptAll(buildMergeProposal(profile, extracted));
  const acceptedCounts = counts(chosen);

  await claim(parseId, null);
  let changeSummary: ResumeChangeSummary | null = null;
  try {
    if (Object.values(acceptedCounts).some((n) => n > 0)) {
      changeSummary = (await applyExtractedProfileService(profile.userId, buildPayload(extracted, chosen))).changeSummary;
    }
    await prisma.resumeParseResult.update({ where: { id: parseId }, data: { decision: { mode: "fill-blanks", accepted: acceptedCounts } as any } });
  } catch (error) {
    await release(parseId).catch(() => {});
    throw error;
  }

  await logAudit(actorUserId ?? profile.userId, "RESUME_FILL_BLANKS", "ApplicantProfile", profile.id, { parseId, source: row.source, accepted: acceptedCounts });
  return { changeSummary, accepted: acceptedCounts };
};

// A TA route names the candidate by profile id or by user id (same rule as requireOwned("candidate")).
export const findProfileIdByCandidateId = async (candidateId: string): Promise<number | null> => {
  const where = /^\d+$/.test(candidateId) ? { id: Number(candidateId) } : { userId: candidateId };
  const profile = await prisma.applicantProfile.findFirst({ where, select: { id: true } });
  return profile?.id ?? null;
};
