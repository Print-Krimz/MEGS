import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_KNN_SETTINGS } from "./scoring-configuration.service.js";

const mocks = vi.hoisted(() => ({
  prisma: {
    application: { findMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    jobPosting: { findUniqueOrThrow: vi.fn() },
    candidateScoringConfiguration: { findFirst: vi.fn().mockResolvedValue({ id: 1, version: 1, knnSettings: { defaultK: 20, maximumK: 100, minimumSimilarity: 0.5, includeArchived: true, excludeRejected: true, excludeCurrentlyHired: true }, weights: [] }), findFirstOrThrow: vi.fn() },
    applicantProfile: { findUniqueOrThrow: vi.fn() },
    candidateFeatureProfile: { upsert: vi.fn() },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  },
  calculate: vi.fn(),
  configuration: vi.fn(),
  generateEmbedding: vi.fn().mockResolvedValue(new Array(384).fill(0.1)),
}));

vi.mock("../../utils/prisma.js", () => ({ default: mocks.prisma }));
vi.mock("./candidate-scoring.service.js", () => ({ calculateAndPersistCandidateScore: mocks.calculate }));
vi.mock("./embedding.service.js", () => ({
  generateEmbedding: mocks.generateEmbedding,
  EMBEDDING_DIMENSION: 384,
  EMBEDDING_MODEL: "Xenova/all-MiniLM-L6-v2",
}));
vi.mock("./scoring-configuration.service.js", () => ({
  getActiveScoringConfiguration: mocks.configuration,
  DEFAULT_KNN_SETTINGS: { defaultK: 20, maximumK: 100, minimumSimilarity: 0.5, includeArchived: true, excludeRejected: true, excludeCurrentlyHired: true },
}));

import { discoverTalentPoolForJob, InvalidKnnRequestError, searchTalentPoolByText } from "./talent-pool-knn.service.js";

const feature = (skills: string[]) => ({
  rawFeatures: {
    skills,
    roleExperience: [],
    yearsExperience: null,
    city: null,
    province: null,
    preferredAreas: [],
    education: [],
    certifications: [],
    complianceDocuments: [],
  },
});

const application = (id: number, skills: string[]) => ({
  id,
  status: "MATCHED",
  user: {
    id: `user-${id}`,
    email: `candidate-${id}@example.com`,
    applicantProfile: {
      id: id * 10,
      firstName: "Candidate",
      lastName: String(id),
      city: "Makati",
      province: "Metro Manila",
      gender: "not-for-output",
      candidateFeatureProfile: feature(skills),
    },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configuration.mockResolvedValue({ id: 1, knnSettings: { ...DEFAULT_KNN_SETTINGS, minimumSimilarity: 0 } });
  mocks.prisma.jobPosting.findUniqueOrThrow.mockResolvedValue({ id: 8, title: "TypeScript developer", requirements: "React TypeScript" });
});

describe("talent-pool pgvector KNN retrieval", () => {
  it("enforces the active configuration maximumK rather than only the global API maximum", async () => {
    mocks.configuration.mockResolvedValueOnce({ id: 1, knnSettings: { ...DEFAULT_KNN_SETTINGS, maximumK: 5 } });

    await expect(discoverTalentPoolForJob(8, { k: 6 })).rejects.toBeInstanceOf(InvalidKnnRequestError);
    expect(mocks.prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("queries pgvector and returns candidate fields with similarity separate from fit score", async () => {
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ applicationId: 7, similarity: 0.89 }]);
    mocks.prisma.application.findUniqueOrThrow.mockResolvedValueOnce(application(7, ["TypeScript", "React"]));
    mocks.calculate.mockResolvedValueOnce({ finalFitScore: 82, breakdown: { skills: 100 } });

    const result = await discoverTalentPoolForJob(8);

    expect(mocks.generateEmbedding).toHaveBeenCalledWith("TypeScript developer React TypeScript");
    expect(mocks.prisma.$queryRaw).toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      candidate: {
        id: "user-7",
        applicationId: 7,
        email: "candidate-7@example.com",
        firstName: "Candidate",
        lastName: "7",
        city: "Makati",
        province: "Metro Manila",
      },
      knnRank: 1,
      similarity: 0.89,
      score: { finalFitScore: 82 },
    });
    expect(result.items[0].candidate).not.toHaveProperty("gender");
  });
});
