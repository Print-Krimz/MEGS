import { Prisma } from "@prisma/client";
import prisma from "../../utils/prisma.js";
import { safeLogError } from "../../security/errors.js";
import { stripProtectedTerms } from "../../security/protected-terms.js";
import { calculateAndPersistCandidateScore } from "./candidate-scoring.service.js";
import { getActiveScoringConfiguration } from "./scoring-configuration.service.js";
import { CandidateFeatureInput, ScoringWeights } from "./scoring.types.js";
import { isTraitItem, normalizeComplianceDocumentType } from "./scoring.dimensions.js";
import { generateEmbedding, generateJobEmbedding } from "./embedding.service.js";
import { buildJobEmbeddingText, buildJobFeatureInput, computeMatchScore, jobRequirementClarity } from "./match-score.js";

// v2: protected terms removed from work summaries; notes and compliance documents left out
// of the embedding text. Profiles on an older version are rebuilt before they are searched.
export const FEATURE_SCHEMA_VERSION = "candidate-feature-v2";
const VOCABULARY_VERSION = "gemini-embedding-001-v1";
export const EXTRACTION_VERSION = "deterministic-v1";

const normalizeLocation = (value: string | null | undefined) =>
  value?.toLocaleLowerCase("en-US").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim() || null;

const splitAreas = (value: string | null | undefined) =>
  (value ?? "").split(/[,;/|]/).map(normalizeLocation).filter((entry): entry is string => Boolean(entry));

const yearsBetween = (start: Date, end: Date) => Math.max(0, (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

// The text embedded for a candidate. Compliance documents stay in the features (the compliance
// dimension needs them) but are not part of what the profile "is about".
const featureDocument = (features: CandidateFeatureInput) => [
  ...features.skills,
  ...features.roleExperience,
  ...features.education,
  ...features.certifications,
].join(" ");

const buildCandidateFeatureInput = (profile: {
  skills: Array<{ skill: { name: string } }>;
  workExperiences: Array<{ roleTitle: string; summary: string | null; startDate: Date; endDate: Date | null; isCurrent: boolean }>;
  educations: Array<{ degree: string | null; fieldOfStudy: string | null }>;
  trainings: Array<{ title: string; provider: string | null }>;
  assets: Array<{ label: string; documentType: string | null; verificationState: string }>;
  city: string | null;
  province: string | null;
  preferredWorkLocations: string | null;
}): CandidateFeatureInput => {
  // A role with no end date is treated as ongoing; counting it as 0 years hid real experience.
  const experience = profile.workExperiences.reduce((total, item) => total + yearsBetween(item.startDate, item.isCurrent || !item.endDate ? new Date() : item.endDate), 0);
  return {
    skills: profile.skills.map((item) => item.skill.name),
    // Free-text summaries can mention age, civil status or religion; those clauses are dropped.
    // Education and training notes are left out for the same reason.
    roleExperience: profile.workExperiences.flatMap((item) => [item.roleTitle, stripProtectedTerms(item.summary)]),
    yearsExperience: profile.workExperiences.length ? Math.min(50, Number(experience.toFixed(2))) : null,
    city: normalizeLocation(profile.city),
    province: normalizeLocation(profile.province),
    preferredAreas: splitAreas(profile.preferredWorkLocations),
    education: profile.educations.flatMap((item) => [item.degree ?? "", item.fieldOfStudy ?? ""]),
    certifications: profile.trainings.flatMap((item) => [item.title, item.provider ?? ""]),
    complianceDocuments: profile.assets
      .filter((item) => item.verificationState !== "REJECTED")
      .map((item) => normalizeComplianceDocumentType(item.label, item.documentType))
      .filter((item): item is string => item !== null),
  };
};

export const rebuildCandidateFeatureProfile = async (applicantProfileId: number) => {
  const profile = await prisma.applicantProfile.findUnique({
    where: { id: applicantProfileId },
    include: { skills: { include: { skill: true } }, workExperiences: true, educations: true, trainings: true, assets: true },
  });
  if (!profile) return null;
  const features = buildCandidateFeatureInput(profile);
  const text = featureDocument(features);

  let vectorStr: string | null = null;
  try {
    const embedding = await generateEmbedding(text, { taskType: "RETRIEVAL_DOCUMENT" });
    vectorStr = `[${embedding.join(",")}]`;
  } catch (error) {
    // Graceful fallback for mock or offline environments without active Gemini API.
    // Logged so a missing embedding (skills scored on exact words only) is visible.
    safeLogError(`Scoring: embed candidate profile #${applicantProfileId}`, error);
  }

  try {
    const record = await prisma.candidateFeatureProfile.upsert({
      where: { applicantProfileId },
      create: {
        applicantProfileId,
        rawFeatures: features as unknown as Prisma.InputJsonValue,
        normalizedCity: features.city,
        normalizedProvince: features.province,
        normalizedPreferredAreas: features.preferredAreas,
        vocabularyVersion: VOCABULARY_VERSION,
        featureSchemaVersion: FEATURE_SCHEMA_VERSION,
        extractionVersion: EXTRACTION_VERSION,
      },
      update: {
        rawFeatures: features as unknown as Prisma.InputJsonValue,
        normalizedCity: features.city,
        normalizedProvince: features.province,
        normalizedPreferredAreas: features.preferredAreas,
        vocabularyVersion: VOCABULARY_VERSION,
        featureSchemaVersion: FEATURE_SCHEMA_VERSION,
        extractionVersion: EXTRACTION_VERSION,
      },
    });

    // On a failed re-embed the previous vector is kept: a slightly older vector keeps the
    // member searchable, while clearing it would hide them after a temporary Gemini outage.
    // Profiles with no vector at all are picked up by scripts/backfill-embeddings.ts.
    if (vectorStr) {
      try {
        await prisma.$executeRaw`
          UPDATE "CandidateFeatureProfile"
          SET embedding = ${vectorStr}::vector
          WHERE id = ${record.id}
        `;
      } catch {
        // Graceful bypass in environments without pgvector
      }
    }

    return record;
  } catch {
    return null;
  }
};

export const readFeatureInput = (value: unknown): CandidateFeatureInput => value as CandidateFeatureInput;

type TalentPoolOptions = { k?: number; minimumSimilarity?: number };

export class InvalidKnnRequestError extends Error {
  readonly code = "INVALID_REQUEST";
  constructor(message: string) { super(message); }
}

/** Embedding or vector search failed. Callers must not show or notify any match. */
export class MatchingUnavailableError extends Error {
  readonly code = "MATCHING_UNAVAILABLE";
  constructor() { super("Candidate matching is unavailable right now. Try again in a few minutes."); }
}

type RawKnnResult = { applicantProfileId: number; similarity: number };

// Runs the embedding call and vector query; any failure becomes MatchingUnavailableError
// so no caller can fall back to invented similarity values.
const runKnnSearch = async (context: string, search: () => Promise<RawKnnResult[]>): Promise<RawKnnResult[]> => {
  try {
    return await search();
  } catch (error) {
    if (error instanceof InvalidKnnRequestError) throw error;
    safeLogError(`Talent pool: ${context}`, error);
    throw new MatchingUnavailableError();
  }
};

/**
 * Who may be offered from the Talent Pool (aliases: ap = ApplicantProfile, u = User,
 * tpm = TalentPoolMembership). One copy, used by every search and by the unsearchable count.
 * Active deployments are found through the application or the employee record, so a
 * redeployment created without an application still counts.
 */
const ELIGIBLE_MEMBER_SQL = Prisma.sql`
  tpm."status" = 'ACTIVE'
  AND tpm."availability" != 'UNAVAILABLE'
  AND ap."isActive" = true
  AND ap."hasNoShowHistory" = false
  AND u."isActive" = true
  AND NOT EXISTS (
    SELECT 1 FROM "Application" app_hired
    WHERE app_hired."userId" = u."id"
      AND app_hired."status" IN ('HIRED', 'ONBOARDING')
  )
  AND NOT EXISTS (
    SELECT 1 FROM "Deployment" dep
    LEFT JOIN "Application" dep_app ON dep."applicationId" = dep_app."id"
    LEFT JOIN "Employee" dep_emp ON dep."employeeId" = dep_emp."id"
    WHERE (dep_app."userId" = u."id" OR dep_emp."userId" = u."id")
      AND dep."status" NOT IN ('ENDED', 'CANCELLED')
  )
`;

/** Leaves out people who already applied to this job (unless they backed out or were archived). */
const notAppliedToJobSql = (jobPostingId: number | undefined) =>
  jobPostingId === undefined
    ? Prisma.empty
    : Prisma.sql`
      AND NOT EXISTS (
        SELECT 1 FROM "Application" app_active
        WHERE app_active."userId" = u."id"
          AND app_active."jobPostingId" = ${jobPostingId}
          AND app_active."status" NOT IN ('BACKOUT', 'ARCHIVED')
      )`;

// A member is searchable once their features are on the current version and embedded.
const SEARCHABLE_SQL = Prisma.sql`cfp."embedding" IS NOT NULL AND cfp."featureSchemaVersion" = ${FEATURE_SCHEMA_VERSION}`;

/**
 * Eligible pool members that vector search cannot see yet: no embedding, or features on an
 * older version (same eligibility rules as the searches below).
 */
export const countUnsearchablePoolMembers = async (jobPostingId?: number): Promise<number> => {
  try {
    const [row] = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS "count"
      FROM "TalentPoolMembership" tpm
      JOIN "ApplicantProfile" ap ON ap."id" = tpm."applicantProfileId"
      JOIN "User" u ON u."id" = ap."userId"
      LEFT JOIN "CandidateFeatureProfile" cfp ON cfp."applicantProfileId" = ap."id"
      WHERE
        (cfp."id" IS NULL OR NOT (${SEARCHABLE_SQL}))
        AND ${ELIGIBLE_MEMBER_SQL}
        ${notAppliedToJobSql(jobPostingId)}
    `;
    return Number(row?.count ?? 0);
  } catch (error) {
    safeLogError("Talent pool: count unsearchable members", error);
    return 0;
  }
};

/** Nearest eligible members to `queryVector` (a SQL expression for a vector), best first. */
const nearestPoolMembers = (queryVector: Prisma.Sql, extraWhere: Prisma.Sql, minimumSimilarity: number, limit: number) =>
  prisma.$queryRaw<RawKnnResult[]>`
    SELECT
      ap."id" AS "applicantProfileId",
      (1 - (cfp."embedding" <=> ${queryVector})) AS "similarity"
    FROM "CandidateFeatureProfile" cfp
    JOIN "ApplicantProfile" ap ON ap."id" = cfp."applicantProfileId"
    JOIN "User" u ON u."id" = ap."userId"
    JOIN "TalentPoolMembership" tpm ON tpm."applicantProfileId" = ap."id"
    WHERE
      ${SEARCHABLE_SQL}
      AND ${ELIGIBLE_MEMBER_SQL}
      ${extraWhere}
      AND (1 - (cfp."embedding" <=> ${queryVector})) >= ${minimumSimilarity}
    ORDER BY (1 - (cfp."embedding" <=> ${queryVector})) DESC, ap."id" ASC
    LIMIT ${limit}
  `;

const vectorLiteral = (embedding: number[]) => Prisma.sql`${`[${embedding.join(",")}]`}::vector`;

const resolveKnnOptions = (
  configuration: Awaited<ReturnType<typeof getActiveScoringConfiguration>>,
  requested: TalentPoolOptions,
) => {
  const k = requested.k ?? configuration.knnSettings.defaultK;
  if (k > configuration.knnSettings.maximumK) {
    throw new InvalidKnnRequestError(`k must not exceed the active configuration maximum of ${configuration.knnSettings.maximumK}.`);
  }
  return {
    k,
    maximumK: configuration.knnSettings.maximumK as number,
    minimumSimilarity: requested.minimumSimilarity ?? configuration.knnSettings.minimumSimilarity,
  };
};

const publicCandidateFromProfile = (profile: {
  id: number;
  firstName: string;
  lastName: string;
  city: string;
  province: string;
  user: { id: string; email: string };
  skills?: Array<{ skill: { name: string } }>;
  workExperiences?: Array<{ roleTitle: string; startDate: Date; endDate: Date | null; isCurrent: boolean }>;
  talentPoolMembership?: {
    id: number;
    status: string;
    availability: string;
    lastContactedAt: Date | null;
    notes?: string | null;
  } | null;
}) => {
  const currentWork = profile.workExperiences?.find((w) => w.isCurrent) ?? profile.workExperiences?.[0];
  return {
    id: profile.user.id,
    applicantProfileId: profile.id,
    membershipId: profile.talentPoolMembership?.id ?? undefined,
    email: profile.user.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    city: profile.city,
    province: profile.province,
    currentRole: currentWork?.roleTitle ?? null,
    skills: profile.skills?.map((s) => s.skill.name) ?? [],
    availability: profile.talentPoolMembership?.availability ?? "UNKNOWN",
    talentPoolStatus: profile.talentPoolMembership?.status ?? "ACTIVE",
    lastContactedAt: profile.talentPoolMembership?.lastContactedAt ?? null,
  };
};

// Open application stages: the person is being processed for another job right now.
const IN_PROCESS_STATUSES = [
  "SUBMITTED", "PARSING", "REVIEW", "NEEDS_ATTENTION", "MATCHED", "INITIAL_SCREENING",
  "CLIENT_ENDORSEMENT", "FINAL_INTERVIEW", "COMPLIANCE", "CONTRACT_SIGNING",
] as const;

export type InProcessApplication = { applicationId: number; jobId: number; jobTitle: string; status: string };

/** Open applications on other jobs, per user. Shown as a tag; TA decides whether to offer. */
const loadInProcessApplications = async (userIds: string[], excludeJobId?: number) => {
  const byUser = new Map<string, InProcessApplication[]>();
  if (!userIds.length) return byUser;
  const rows = await prisma.application.findMany({
    where: {
      userId: { in: userIds },
      isArchived: false,
      status: { in: [...IN_PROCESS_STATUSES] },
      ...(excludeJobId !== undefined ? { jobPostingId: { not: excludeJobId } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, userId: true, jobPostingId: true, status: true, jobPosting: { select: { title: true } } },
  });
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push({ applicationId: row.id, jobId: row.jobPostingId, jobTitle: row.jobPosting?.title ?? "", status: row.status });
    byUser.set(row.userId, list);
  }
  return byUser;
};

const hydrateRankedCandidates = async (rawResults: RawKnnResult[], excludeJobId?: number) => {
  if (rawResults.length === 0) return [];
  const profileIds = [...new Set(rawResults.map((result) => result.applicantProfileId))];
  const profiles = await prisma.applicantProfile.findMany({
    where: { id: { in: profileIds } },
    include: {
      user: { select: { id: true, email: true } },
      skills: { include: { skill: true } },
      workExperiences: { orderBy: { startDate: "desc" } },
      talentPoolMembership: true,
      candidateFeatureProfile: { select: { rawFeatures: true } },
    },
  });
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const inProcess = await loadInProcessApplications(profiles.map((profile) => profile.user.id), excludeJobId);
  return rawResults.flatMap((result, index) => {
    const profile = profilesById.get(result.applicantProfileId);
    if (!profile) return [];
    return [{
      candidate: publicCandidateFromProfile(profile as any),
      similarity: Number(result.similarity),
      knnRank: index + 1,
      inProcessFor: inProcess.get(profile.user.id) ?? [],
      features: profile.candidateFeatureProfile?.rawFeatures ? readFeatureInput(profile.candidateFeatureProfile.rawFeatures) : null,
    }];
  });
};

const withoutFeatures = <T extends { features: unknown }>({ features: _features, ...item }: T) => item;

/**
 * Discovers eligible Talent Pool candidates for a job. Vector search builds a shortlist; the
 * shortlist is then ranked by the same rule-based match score screening uses, so a candidate
 * holding a required certificate ranks above an otherwise similar one without it.
 * No application or score row is created.
 */
export const discoverTalentPoolForJob = async (jobPostingId: number, requested: TalentPoolOptions = {}) => {
  const [configuration, job] = await Promise.all([
    getActiveScoringConfiguration(),
    prisma.jobPosting.findUniqueOrThrow({
      where: { id: jobPostingId },
      include: { mrf: { include: { complianceTemplates: true } } },
    }),
  ]);

  const knn = resolveKnnOptions(configuration, requested);
  // A wider shortlist than k, so re-ranking can lift a strong candidate whose wording is less similar.
  const shortlistSize = Math.max(knn.k, Math.min(knn.maximumK, knn.k * 3));

  const rawResults = await runKnnSearch("discover candidates for job", async () => {
    const queryVector = vectorLiteral(await generateJobEmbedding(buildJobEmbeddingText(job, job.mrf)));
    return nearestPoolMembers(queryVector, notAppliedToJobSql(jobPostingId), knn.minimumSimilarity, shortlistSize);
  });

  const [hydrated, unsearchableCount] = await Promise.all([
    hydrateRankedCandidates(rawResults, jobPostingId),
    countUnsearchablePoolMembers(jobPostingId),
  ]);

  // Compliance is checked at the Requirements stage, as for any application before it.
  const jobInput = buildJobFeatureInput(job, job.mrf, null);
  const weights = (configuration.weights ?? {}) as Partial<ScoringWeights>;
  const hasSkillItems = Boolean(jobInput.requiredSkills?.some((item) => !isTraitItem(item)));
  const ranked = hydrated.map((item) => {
    if (!item.features) return { ...withoutFeatures(item), matchScore: null, dimensionStatuses: null, missingRequired: [] as string[] };
    const match = computeMatchScore(item.features, jobInput, item.similarity, weights);
    // Only listed skill items count as "missing"; title words used when the job lists none do not.
    const missingRequired = [
      ...(match.dimensionStatuses.SKILLS === "EVALUATED" && hasSkillItems ? match.explanations.SKILLS.missing ?? [] : []),
      ...(match.dimensionStatuses.EDUCATION_CERTIFICATIONS === "EVALUATED" ? match.explanations.EDUCATION_CERTIFICATIONS.missing ?? [] : []),
    ].slice(0, 5);
    return { ...withoutFeatures(item), matchScore: match.finalFitScore, dimensionStatuses: match.dimensionStatuses, missingRequired };
  });

  ranked.sort((a, b) =>
    (b.matchScore ?? -1) - (a.matchScore ?? -1) ||
    b.similarity - a.similarity ||
    a.candidate.applicantProfileId - b.candidate.applicantProfileId,
  );
  const items = ranked.slice(0, knn.k).map((item, index) => ({ ...item, rank: index + 1 }));

  return { items, unsearchableCount, requirementClarity: jobRequirementClarity(job, job.mrf) };
};

/**
 * Finds Talent Pool members whose profile is close to the candidate of an application.
 * Compares stored profile vectors directly (no new embedding call).
 */
export const findSimilarCandidates = async (applicationId: number, requested: TalentPoolOptions = {}) => {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      user: {
        select: {
          applicantProfile: {
            select: { id: true, isActive: true, candidateFeatureProfile: { select: { id: true, featureSchemaVersion: true } } },
          },
        },
      },
    },
  });
  const sourceProfile = application?.user?.applicantProfile;
  if (!sourceProfile || !sourceProfile.isActive) return { items: [] };

  const configuration = await getActiveScoringConfiguration();
  const knn = resolveKnnOptions(configuration, requested);
  let sourceFeatureId = sourceProfile.candidateFeatureProfile?.id;
  if (!sourceFeatureId || sourceProfile.candidateFeatureProfile?.featureSchemaVersion !== FEATURE_SCHEMA_VERSION) {
    sourceFeatureId = (await rebuildCandidateFeatureProfile(sourceProfile.id))?.id;
  }
  if (!sourceFeatureId) return { items: [] };

  const rawResults = await runKnnSearch("find similar candidates", async () => {
    const [source] = await prisma.$queryRaw<Array<{ hasEmbedding: boolean }>>`
      SELECT ("embedding" IS NOT NULL) AS "hasEmbedding" FROM "CandidateFeatureProfile" WHERE id = ${sourceFeatureId}
    `;
    if (!source?.hasEmbedding) throw new Error("Source profile has no embedding");
    const queryVector = Prisma.sql`(SELECT src."embedding" FROM "CandidateFeatureProfile" src WHERE src."id" = ${sourceFeatureId})`;
    return nearestPoolMembers(queryVector, Prisma.sql`AND ap."id" != ${sourceProfile.id}`, knn.minimumSimilarity, knn.k);
  });

  const items = (await hydrateRankedCandidates(rawResults)).map(withoutFeatures);
  return { items };
};

/**
 * Semantic text search across eligible Talent Pool candidates.
 */
export const searchTalentPoolByText = async (text: string, requested: TalentPoolOptions = {}) => {
  const configuration = await getActiveScoringConfiguration();
  const knn = resolveKnnOptions(configuration, requested);
  const rawResults = await runKnnSearch("search by text", async () => {
    const queryVector = vectorLiteral(await generateEmbedding(text, { taskType: "RETRIEVAL_QUERY" }));
    return nearestPoolMembers(queryVector, Prisma.empty, knn.minimumSimilarity, knn.k);
  });

  const [hydrated, unsearchableCount] = await Promise.all([
    hydrateRankedCandidates(rawResults),
    countUnsearchablePoolMembers(),
  ]);

  return { items: hydrated.map(withoutFeatures), retrievalOnly: true, unsearchableCount };
};

/**
 * Recruiter action: Explicitly adds a candidate to the Talent Pool.
 */
export const addToTalentPool = async (input: {
  applicantProfileId: number;
  addedById: string;
  sourceApplicationId?: number;
  availability?: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
  notes?: string;
}) => {
  const profile = await prisma.applicantProfile.findUnique({
    where: { id: input.applicantProfileId },
  });
  if (!profile) {
    throw new InvalidKnnRequestError("Candidate profile not found");
  }
  if (profile.hasNoShowHistory) {
    throw new InvalidKnnRequestError("Candidate has a recorded interview NO_SHOW history and cannot be added to the talent pool.");
  }

  const membership = await prisma.talentPoolMembership.upsert({
    where: { applicantProfileId: input.applicantProfileId },
    create: {
      applicantProfileId: input.applicantProfileId,
      sourceApplicationId: input.sourceApplicationId ?? null,
      status: "ACTIVE",
      availability: input.availability ?? "AVAILABLE",
      addedById: input.addedById,
      notes: input.notes ?? null,
    },
    update: {
      sourceApplicationId: input.sourceApplicationId ?? undefined,
      status: "ACTIVE",
      availability: input.availability ?? "AVAILABLE",
      addedById: input.addedById,
      notes: input.notes ?? undefined,
    },
    include: {
      applicantProfile: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          user: { select: { id: true, email: true } },
        },
      },
    },
  });

  return membership;
};

/**
 * Recruiter action: Logs contact history and updates candidate availability.
 */
export const recordTalentPoolContact = async (input: {
  membershipId: number;
  jobPostingId: number;
  recruiterId: string;
  outcome: "INTERESTED" | "NOT_INTERESTED" | "NO_RESPONSE" | "UNAVAILABLE";
  notes?: string;
}) => {
  const contact = await prisma.$transaction(async (tx) => {
    const rec = await tx.talentPoolContact.create({
      data: {
        membershipId: input.membershipId,
        jobPostingId: input.jobPostingId,
        recruiterId: input.recruiterId,
        outcome: input.outcome,
        notes: input.notes ?? null,
      },
    });

    const updateData: any = { lastContactedAt: new Date() };
    if (input.outcome === "UNAVAILABLE") {
      updateData.availability = "UNAVAILABLE";
    } else if (input.outcome === "INTERESTED") {
      updateData.availability = "AVAILABLE";
    }

    await tx.talentPoolMembership.update({
      where: { id: input.membershipId },
      data: updateData,
    });

    return rec;
  });

  return contact;
};

/**
 * Recruiter action: Reactivates an eligible candidate from Talent Pool into a NEW job application.
 * Preserves past application history intact.
 * Calculates score against the new application and target job.
 */
export const considerTalentPoolCandidateForJob = async (input: {
  applicantProfileId: number;
  targetJobId: number;
  recruiterId: string;
  notes?: string;
  contactOutcome?: "INTERESTED" | "NOT_INTERESTED" | "NO_RESPONSE" | "UNAVAILABLE";
}) => {
  const { applicantProfileId, targetJobId, recruiterId, notes, contactOutcome = "INTERESTED" } = input;

  const profile = await prisma.applicantProfile.findUnique({
    where: { id: applicantProfileId },
    include: {
      user: {
        include: {
          applications: {
            where: { isArchived: false },
            include: { deployments: true },
          },
        },
      },
      talentPoolMembership: true,
    },
  });
  if (!profile) {
    throw new InvalidKnnRequestError("Candidate profile not found");
  }

  // 1. Verify Talent Pool membership is ACTIVE
  if (!profile.talentPoolMembership || profile.talentPoolMembership.status !== "ACTIVE") {
    throw new InvalidKnnRequestError("Candidate is not an active member of the Talent Pool.");
  }

  // 2. Verify availability
  if (profile.talentPoolMembership.availability === "UNAVAILABLE") {
    throw new InvalidKnnRequestError("Candidate availability is currently marked as UNAVAILABLE.");
  }

  // 3. Verify valid profile state
  if (!profile.isActive || !profile.user.isActive || profile.hasNoShowHistory) {
    throw new InvalidKnnRequestError("Candidate does not meet eligibility requirements due to inactive status or interview NO_SHOW history.");
  }

  // 4. Verify candidate is not currently hired or deployed
  const isHiredOrOnboarding = profile.user.applications.some((app) => ["HIRED", "ONBOARDING"].includes(app.status));
  if (isHiredOrOnboarding) {
    throw new InvalidKnnRequestError("Candidate is already hired or onboarding in another application.");
  }

  const isDeployed = profile.user.applications.some((app) =>
    app.deployments.some((dep) => !["ENDED", "CANCELLED"].includes(dep.status))
  );
  // A redeployment can exist without an application; check the employee record too.
  const isDeployedAsEmployee = !isDeployed && (await prisma.deployment.count({
    where: { employee: { userId: profile.userId }, status: { notIn: ["ENDED", "CANCELLED"] } },
  })) > 0;
  if (isDeployed || isDeployedAsEmployee) {
    throw new InvalidKnnRequestError("Candidate is currently actively deployed.");
  }

  // 5. Verify candidate does not already have an application for the target job
  const existingAppForJob = profile.user.applications.find((app) => app.jobPostingId === targetJobId);
  if (existingAppForJob) {
    throw new InvalidKnnRequestError(`Candidate already has an active application (#${existingAppForJob.id}) for this job.`);
  }

  // 6. Verify target Job is OPEN
  const job = await prisma.jobPosting.findUnique({ where: { id: targetJobId } });
  if (!job) {
    throw new InvalidKnnRequestError("Target job posting not found");
  }
  if (job.status === "CLOSED") {
    throw new InvalidKnnRequestError("Target job posting is closed.");
  }

  // 7. Transactional creation of new application & contact recording
  const result = await prisma.$transaction(async (tx) => {
    const newApplication = await tx.application.create({
      data: {
        userId: profile.userId,
        jobPostingId: targetJobId,
        status: "SUBMITTED",
        resumeUrl: profile.resumeUrl,
      },
    });

    const contact = await tx.talentPoolContact.create({
      data: {
        membershipId: profile.talentPoolMembership!.id,
        jobPostingId: targetJobId,
        recruiterId,
        outcome: contactOutcome,
        notes: notes || null,
      },
    });

    await tx.talentPoolMembership.update({
      where: { id: profile.talentPoolMembership!.id },
      data: { lastContactedAt: new Date() },
    });

    await tx.recruiterDecision.create({
      data: {
        applicationId: newApplication.id,
        actorId: recruiterId,
        fromStatus: "TALENT_POOL",
        toStatus: "SUBMITTED",
        reason: notes ? `Reactivated from Talent Pool for Job #${targetJobId}: ${notes}` : `Reactivated from Talent Pool for Job #${targetJobId}`,
      },
    });

    return { application: newApplication, contact };
  });

  // Calculate score for the new application against the new job
  let score = null;
  try {
    score = await calculateAndPersistCandidateScore(result.application.id, targetJobId);
  } catch (err) {
    // Graceful fallback if dynamic scoring is disabled or mocked
  }

  return {
    success: true,
    message: "Candidate reactivated into a new job application successfully",
    application: result.application,
    contact: result.contact,
    score,
  };
};
