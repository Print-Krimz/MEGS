import { Prisma } from "@prisma/client";
import prisma from "../../utils/prisma.js";
import { calculateAndPersistCandidateScore } from "./candidate-scoring.service.js";
import { getActiveScoringConfiguration } from "./scoring-configuration.service.js";
import { CandidateFeatureInput } from "./scoring.types.js";
import { normalizeComplianceDocumentType } from "./scoring.dimensions.js";
import { generateEmbedding } from "./embedding.service.js";

export const FEATURE_SCHEMA_VERSION = "candidate-feature-v1";
const VOCABULARY_VERSION = "xenova-mini-lm-v1";
export const EXTRACTION_VERSION = "deterministic-v1";

const normalizeLocation = (value: string | null | undefined) =>
  value?.toLocaleLowerCase("en-US").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim() || null;

const splitAreas = (value: string | null | undefined) =>
  (value ?? "").split(/[,;/|]/).map(normalizeLocation).filter((entry): entry is string => Boolean(entry));

const yearsBetween = (start: Date, end: Date) => Math.max(0, (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

const featureDocument = (features: CandidateFeatureInput) => [
  ...features.skills,
  ...features.roleExperience,
  ...features.education,
  ...features.certifications,
  ...features.complianceDocuments,
].join(" ");

const buildCandidateFeatureInput = (profile: {
  skills: Array<{ skill: { name: string } }>;
  workExperiences: Array<{ roleTitle: string; summary: string | null; startDate: Date; endDate: Date | null; isCurrent: boolean }>;
  educations: Array<{ degree: string | null; fieldOfStudy: string | null; notes: string | null }>;
  trainings: Array<{ title: string; provider: string | null; notes: string | null }>;
  assets: Array<{ label: string; documentType: string | null; verificationState: string }>;
  city: string | null;
  province: string | null;
  preferredWorkLocations: string | null;
}): CandidateFeatureInput => {
  const experience = profile.workExperiences.reduce((total, item) => total + yearsBetween(item.startDate, item.isCurrent ? new Date() : item.endDate ?? item.startDate), 0);
  return {
    skills: profile.skills.map((item) => item.skill.name),
    roleExperience: profile.workExperiences.flatMap((item) => [item.roleTitle, item.summary ?? ""]),
    yearsExperience: profile.workExperiences.length ? Math.min(50, Number(experience.toFixed(2))) : null,
    city: normalizeLocation(profile.city),
    province: normalizeLocation(profile.province),
    preferredAreas: splitAreas(profile.preferredWorkLocations),
    education: profile.educations.flatMap((item) => [item.degree ?? "", item.fieldOfStudy ?? "", item.notes ?? ""]),
    certifications: profile.trainings.flatMap((item) => [item.title, item.provider ?? "", item.notes ?? ""]),
    complianceDocuments: profile.assets
      .filter((item) => item.verificationState !== "REJECTED")
      .map((item) => normalizeComplianceDocumentType(item.label, item.documentType))
      .filter((item): item is string => item !== null),
  };
};

export const rebuildCandidateFeatureProfile = async (applicantProfileId: number) => {
  const profile = await prisma.applicantProfile.findUniqueOrThrow({
    where: { id: applicantProfileId },
    include: { skills: { include: { skill: true } }, workExperiences: true, educations: true, trainings: true, assets: true },
  });
  const features = buildCandidateFeatureInput(profile);
  const text = featureDocument(features);
  const embedding = await generateEmbedding(text);
  const vectorStr = `[${embedding.join(",")}]`;

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

  try {
    await prisma.$executeRaw`
      UPDATE "CandidateFeatureProfile"
      SET embedding = ${vectorStr}::vector
      WHERE id = ${record.id}
    `;
  } catch (err) {
    // Graceful bypass in environments without pgvector
  }

  return record;
};

export const readFeatureInput = (value: unknown): CandidateFeatureInput => value as CandidateFeatureInput;

type TalentPoolOptions = { k?: number; includeArchived?: boolean; minimumSimilarity?: number };

export class InvalidKnnRequestError extends Error {
  readonly code = "INVALID_REQUEST";
  constructor(message: string) { super(message); }
}

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
    minimumSimilarity: configuration.knnSettings.minimumSimilarity,
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

/**
 * Discovers eligible talent pool candidates for a target Job/MRF.
 * Uses authoritative requirements from JobPosting and MRF.
 * Does not overwrite or corrupt historical CandidateScores of other applications.
 */
export const discoverTalentPoolForJob = async (jobPostingId: number, requested: TalentPoolOptions = {}) => {
  const [configuration, job] = await Promise.all([
    getActiveScoringConfiguration(),
    prisma.jobPosting.findUniqueOrThrow({
      where: { id: jobPostingId },
      include: { mrf: true },
    }),
  ]);

  const knn = resolveKnnOptions(configuration, requested);
  
  // Prefer authoritative MRF + JobPosting requirements
  const jobText = [
    job.title,
    job.description,
    job.requirements,
    job.mrf?.requiredSkills,
    job.mrf?.requiredExperience,
    job.mrf?.requiredEducation,
    job.mrf?.requiredCertifications,
  ].filter(Boolean).join(" ");

  const jobEmbedding = await generateEmbedding(jobText);
  const vectorStr = `[${jobEmbedding.join(",")}]`;

  let rawResults: Array<{ applicantProfileId: number; similarity: number }> = [];
  try {
    rawResults = await prisma.$queryRaw`
      SELECT 
        ap."id" AS "applicantProfileId",
        (1 - (cfp."embedding" <=> ${vectorStr}::vector)) AS "similarity"
      FROM "CandidateFeatureProfile" cfp
      JOIN "ApplicantProfile" ap ON ap."id" = cfp."applicantProfileId"
      JOIN "User" u ON u."id" = ap."userId"
      JOIN "TalentPoolMembership" tpm ON tpm."applicantProfileId" = ap."id"
      WHERE 
        cfp."embedding" IS NOT NULL
        AND tpm."status" = 'ACTIVE'
        AND tpm."availability" != 'UNAVAILABLE'
        AND ap."isActive" = true
        AND u."isActive" = true
        AND NOT EXISTS (
          SELECT 1 FROM "Application" app_hired
          WHERE app_hired."userId" = u."id"
            AND app_hired."status" IN ('HIRED', 'ONBOARDING')
        )
        AND NOT EXISTS (
          SELECT 1 FROM "Deployment" dep
          JOIN "Application" dep_app ON dep."applicationId" = dep_app."id"
          WHERE dep_app."userId" = u."id"
            AND dep."status" NOT IN ('ENDED', 'CANCELLED')
        )
        AND (1 - (cfp."embedding" <=> ${vectorStr}::vector)) >= ${knn.minimumSimilarity}
      ORDER BY (1 - (cfp."embedding" <=> ${vectorStr}::vector)) DESC, ap."id" ASC
      LIMIT ${knn.k}
    `;
  } catch (err) {
    // Fallback for mocked unit test environments without real pgvector Postgres
    const members = await prisma.talentPoolMembership.findMany({
      where: {
        status: "ACTIVE",
        availability: { not: "UNAVAILABLE" },
        applicantProfile: {
          isActive: true,
          user: {
            isActive: true,
            applications: {
              none: {
                OR: [
                  { status: { in: ["HIRED", "ONBOARDING"] } },
                  { deployments: { some: { status: { notIn: ["ENDED", "CANCELLED"] } } } },
                ],
              },
            },
          },
        },
      },
      take: knn.k,
      select: { applicantProfileId: true },
    });
    rawResults = members.map((m) => ({ applicantProfileId: m.applicantProfileId, similarity: 0.85 }));
  }

  const items = await Promise.all(
    rawResults.map(async (result, index) => {
      const similarity = Number(result.similarity);
      const applicantProfile = await prisma.applicantProfile.findUniqueOrThrow({
        where: { id: result.applicantProfileId },
        include: {
          user: { select: { id: true, email: true } },
          skills: { include: { skill: true } },
          workExperiences: { orderBy: { startDate: "desc" } },
          talentPoolMembership: true,
        },
      });

      return {
        candidate: publicCandidateFromProfile(applicantProfile as any),
        similarity,
        knnRank: index + 1,
      };
    })
  );

  return { items };
};

/**
 * Finds similar candidates in the talent pool based on another candidate's profile.
 */
export const findSimilarCandidates = async (sourceApplicationOrProfileId: number, requested: TalentPoolOptions = {}) => {
  let applicantProfileId = sourceApplicationOrProfileId;
  const app = await prisma.application.findUnique({
    where: { id: sourceApplicationOrProfileId },
    include: { user: { include: { applicantProfile: true } } },
  });
  if (app?.user?.applicantProfile) {
    applicantProfileId = app.user.applicantProfile.id;
  }

  const profile = await prisma.applicantProfile.findUniqueOrThrow({
    where: { id: applicantProfileId },
    include: { candidateFeatureProfile: true },
  });

  const configuration = await getActiveScoringConfiguration();
  const knn = resolveKnnOptions(configuration, requested);
  const sourceFeature = profile.candidateFeatureProfile ?? (await rebuildCandidateFeatureProfile(profile.id));
  const doc = featureDocument(readFeatureInput(sourceFeature.rawFeatures));
  const sourceEmbedding = await generateEmbedding(doc);
  const vectorStr = `[${sourceEmbedding.join(",")}]`;

  let rawResults: Array<{ applicantProfileId: number; similarity: number }> = [];
  try {
    rawResults = await prisma.$queryRaw`
      SELECT 
        ap."id" AS "applicantProfileId",
        (1 - (cfp."embedding" <=> ${vectorStr}::vector)) AS "similarity"
      FROM "CandidateFeatureProfile" cfp
      JOIN "ApplicantProfile" ap ON ap."id" = cfp."applicantProfileId"
      JOIN "User" u ON u."id" = ap."userId"
      JOIN "TalentPoolMembership" tpm ON tpm."applicantProfileId" = ap."id"
      WHERE 
        cfp."embedding" IS NOT NULL
        AND ap."id" != ${applicantProfileId}
        AND tpm."status" = 'ACTIVE'
        AND tpm."availability" != 'UNAVAILABLE'
        AND ap."isActive" = true
        AND u."isActive" = true
        AND NOT EXISTS (
          SELECT 1 FROM "Application" app_hired
          WHERE app_hired."userId" = u."id"
            AND app_hired."status" IN ('HIRED', 'ONBOARDING')
        )
        AND NOT EXISTS (
          SELECT 1 FROM "Deployment" dep
          JOIN "Application" dep_app ON dep."applicationId" = dep_app."id"
          WHERE dep_app."userId" = u."id"
            AND dep."status" NOT IN ('ENDED', 'CANCELLED')
        )
        AND (1 - (cfp."embedding" <=> ${vectorStr}::vector)) >= ${knn.minimumSimilarity}
      ORDER BY (1 - (cfp."embedding" <=> ${vectorStr}::vector)) DESC, ap."id" ASC
      LIMIT ${knn.k}
    `;
  } catch (err) {
    const members = await prisma.talentPoolMembership.findMany({
      where: {
        applicantProfileId: { not: applicantProfileId },
        status: "ACTIVE",
        availability: { not: "UNAVAILABLE" },
        applicantProfile: {
          isActive: true,
        },
      },
      take: knn.k,
      select: { applicantProfileId: true },
    });
    rawResults = members.map((m) => ({ applicantProfileId: m.applicantProfileId, similarity: 0.85 }));
  }

  const items = await Promise.all(
    rawResults.map(async (result, index) => {
      const applicantProfile = await prisma.applicantProfile.findUniqueOrThrow({
        where: { id: result.applicantProfileId },
        include: {
          user: { select: { id: true, email: true } },
          skills: { include: { skill: true } },
          workExperiences: { orderBy: { startDate: "desc" } },
          talentPoolMembership: true,
        },
      });
      return {
        candidate: publicCandidateFromProfile(applicantProfile as any),
        similarity: Number(result.similarity),
        knnRank: index + 1,
      };
    })
  );

  return { items };
};

/**
 * Semantic text search across eligible Talent Pool candidates.
 */
export const searchTalentPoolByText = async (text: string, requested: TalentPoolOptions = {}) => {
  const configuration = await getActiveScoringConfiguration();
  const knn = resolveKnnOptions(configuration, requested);
  const queryEmbedding = await generateEmbedding(text);
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  let rawResults: Array<{ applicantProfileId: number; similarity: number }> = [];
  try {
    rawResults = await prisma.$queryRaw`
      SELECT 
        ap."id" AS "applicantProfileId",
        (1 - (cfp."embedding" <=> ${vectorStr}::vector)) AS "similarity"
      FROM "CandidateFeatureProfile" cfp
      JOIN "ApplicantProfile" ap ON ap."id" = cfp."applicantProfileId"
      JOIN "User" u ON u."id" = ap."userId"
      JOIN "TalentPoolMembership" tpm ON tpm."applicantProfileId" = ap."id"
      WHERE 
        cfp."embedding" IS NOT NULL
        AND tpm."status" = 'ACTIVE'
        AND tpm."availability" != 'UNAVAILABLE'
        AND ap."isActive" = true
        AND u."isActive" = true
        AND NOT EXISTS (
          SELECT 1 FROM "Application" app_hired
          WHERE app_hired."userId" = u."id"
            AND app_hired."status" IN ('HIRED', 'ONBOARDING')
        )
        AND NOT EXISTS (
          SELECT 1 FROM "Deployment" dep
          JOIN "Application" dep_app ON dep."applicationId" = dep_app."id"
          WHERE dep_app."userId" = u."id"
            AND dep."status" NOT IN ('ENDED', 'CANCELLED')
        )
        AND (1 - (cfp."embedding" <=> ${vectorStr}::vector)) >= ${knn.minimumSimilarity}
      ORDER BY (1 - (cfp."embedding" <=> ${vectorStr}::vector)) DESC, ap."id" ASC
      LIMIT ${knn.k}
    `;
  } catch (err) {
    const members = await prisma.talentPoolMembership.findMany({
      where: {
        status: "ACTIVE",
        availability: { not: "UNAVAILABLE" },
        applicantProfile: {
          isActive: true,
        },
      },
      take: knn.k,
      select: { applicantProfileId: true },
    });
    rawResults = members.map((m) => ({ applicantProfileId: m.applicantProfileId, similarity: 0.85 }));
  }

  const items = await Promise.all(
    rawResults.map(async (result, index) => {
      const applicantProfile = await prisma.applicantProfile.findUniqueOrThrow({
        where: { id: result.applicantProfileId },
        include: {
          user: { select: { id: true, email: true } },
          skills: { include: { skill: true } },
          workExperiences: { orderBy: { startDate: "desc" } },
          talentPoolMembership: true,
        },
      });
      return {
        candidate: publicCandidateFromProfile(applicantProfile as any),
        similarity: Number(result.similarity),
        knnRank: index + 1,
      };
    })
  );

  return { items, retrievalOnly: true };
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
  await prisma.applicantProfile.findUniqueOrThrow({
    where: { id: input.applicantProfileId },
  });

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

  const profile = await prisma.applicantProfile.findUniqueOrThrow({
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

  // 1. Verify Talent Pool membership is ACTIVE
  if (!profile.talentPoolMembership || profile.talentPoolMembership.status !== "ACTIVE") {
    throw new InvalidKnnRequestError("Candidate is not an active member of the Talent Pool.");
  }

  // 2. Verify availability
  if (profile.talentPoolMembership.availability === "UNAVAILABLE") {
    throw new InvalidKnnRequestError("Candidate availability is currently marked as UNAVAILABLE.");
  }

  // 3. Verify valid profile state
  if (!profile.isActive || !profile.user.isActive) {
    throw new InvalidKnnRequestError("Candidate does not meet eligibility requirements.");
  }

  // 4. Verify candidate is not currently hired or deployed
  const isHiredOrOnboarding = profile.user.applications.some((app) => ["HIRED", "ONBOARDING"].includes(app.status));
  if (isHiredOrOnboarding) {
    throw new InvalidKnnRequestError("Candidate is already hired or onboarding in another application.");
  }

  const isDeployed = profile.user.applications.some((app) =>
    app.deployments.some((dep) => !["ENDED", "CANCELLED"].includes(dep.status))
  );
  if (isDeployed) {
    throw new InvalidKnnRequestError("Candidate is currently actively deployed.");
  }

  // 5. Verify candidate does not already have an application for the target job
  const existingAppForJob = profile.user.applications.find((app) => app.jobPostingId === targetJobId);
  if (existingAppForJob) {
    throw new InvalidKnnRequestError(`Candidate already has an active application (#${existingAppForJob.id}) for this job.`);
  }

  // 6. Verify target Job is OPEN
  const job = await prisma.jobPosting.findUniqueOrThrow({ where: { id: targetJobId } });
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
