import { describe, expect, it, vi } from "vitest";

vi.mock("../../utils/prisma.js", () => ({
  default: {
    candidateScoringConfiguration: {
      findUniqueOrThrow: vi.fn(),
    },
    candidateScore: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    application: {
      findUniqueOrThrow: vi.fn(),
    },
    jobPosting: {
      findUniqueOrThrow: vi.fn(),
    },
  },
}));

import prisma from "../../utils/prisma.js";
import { calculateAndPersistCandidateScore } from "./candidate-scoring.service.js";

describe("Candidate Scoring Serialization & Dimension Fields", () => {
  it("serializes candidate score with flat dimension scores for frontend compatibility", async () => {
    (prisma.candidateScoringConfiguration.findUniqueOrThrow as any).mockResolvedValueOnce({
      id: 1,
      version: 1,
      weights: [
        { dimension: "SKILLS", weight: 30 },
        { dimension: "EXPERIENCE", weight: 30 },
        { dimension: "LOCATION", weight: 15 },
        { dimension: "COMPLIANCE", weight: 15 },
        { dimension: "EDUCATION_CERTIFICATIONS", weight: 10 },
      ],
    });

    (prisma.candidateScore.findFirst as any).mockResolvedValueOnce({
      id: 42,
      applicationId: 10,
      jobPostingId: 5,
      configurationId: 1,
      status: "CALCULATED",
      skillsScore: 85,
      experienceScore: 90,
      locationScore: 100,
      complianceScore: 75,
      educationCertificationScore: 80,
      finalFitScore: 86.5,
      knnSimilarity: 0.92,
      explanation: { test: true },
      calculatedAt: new Date("2026-08-15T00:00:00Z"),
      configuration: { version: 1 },
    });

    const result = await calculateAndPersistCandidateScore(10, 5, undefined, { configurationId: 1 });

    expect(result).toMatchObject({
      id: 42,
      applicationId: 10,
      jobPostingId: 5,
      skillsScore: 85,
      experienceScore: 90,
      locationScore: 100,
      complianceScore: 75,
      educationCertificationScore: 80,
      finalFitScore: 86.5,
      knnSimilarity: 0.92,
      breakdown: {
        skills: 85,
        experience: 90,
        location: 100,
        compliance: 75,
        educationCertifications: 80,
      },
    });
  });
});
