import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_KNN_SETTINGS } from "./scoring-configuration.service.js";

const mocks = vi.hoisted(() => ({
  prisma: {
    application: {
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    jobPosting: {
      findUniqueOrThrow: vi.fn(),
    },
    candidateScoringConfiguration: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
    },
    applicantProfile: {
      findUniqueOrThrow: vi.fn(),
    },
    candidateFeatureProfile: {
      upsert: vi.fn(),
    },
    talentPoolMembership: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    talentPoolContact: {
      create: vi.fn(),
    },
    recruiterDecision: {
      create: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $transaction: vi.fn((callback: any) => callback(mocks.prisma)),
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

import {
  discoverTalentPoolForJob,
  InvalidKnnRequestError,
  searchTalentPoolByText,
  considerTalentPoolCandidateForJob,
  recordTalentPoolContact,
  addToTalentPool,
} from "./talent-pool-knn.service.js";

const profile = (id: number, skills: string[], options: any = {}) => ({
  id,
  userId: `user-${id}`,
  firstName: "Candidate",
  lastName: String(id),
  city: "Makati",
  province: "Metro Manila",
  hasConsentedToAi: options.hasConsentedToAi ?? true,
  isActive: options.isActive ?? true,
  resumeUrl: `https://example.com/resumes/${id}.pdf`,
  user: {
    id: `user-${id}`,
    email: `candidate-${id}@example.com`,
    isActive: true,
    applications: options.applications ?? [],
  },
  skills: skills.map((name) => ({ skill: { name } })),
  workExperiences: [{ roleTitle: "Fullstack Developer", startDate: new Date("2020-01-01"), endDate: null, isCurrent: true }],
  talentPoolMembership: options.membership ?? {
    id: id * 100,
    status: "ACTIVE",
    availability: "AVAILABLE",
    lastContactedAt: null,
    notes: null,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configuration.mockResolvedValue({ id: 1, knnSettings: { ...DEFAULT_KNN_SETTINGS, minimumSimilarity: 0 } });
  mocks.prisma.jobPosting.findUniqueOrThrow.mockResolvedValue({
    id: 8,
    title: "TypeScript developer",
    description: "Build robust backend services",
    requirements: "React TypeScript Node.js",
    mrf: {
      requiredSkills: "TypeScript, PostgreSQL",
      requiredExperience: "3+ years",
    },
    status: "OPEN",
  });
});

describe("Talent Pool Redesign - KNN Retrieval & Eligibility", () => {
  it("enforces the active configuration maximumK", async () => {
    mocks.configuration.mockResolvedValueOnce({ id: 1, knnSettings: { ...DEFAULT_KNN_SETTINGS, maximumK: 5 } });

    await expect(discoverTalentPoolForJob(8, { k: 6 })).rejects.toBeInstanceOf(InvalidKnnRequestError);
    expect(mocks.prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("queries pgvector for eligible candidates and returns candidate details with advisory similarity", async () => {
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ applicantProfileId: 10, similarity: 0.92 }]);
    mocks.prisma.applicantProfile.findUniqueOrThrow.mockResolvedValueOnce(
      profile(10, ["TypeScript", "Node.js", "React"])
    );

    const result = await discoverTalentPoolForJob(8);

    expect(mocks.generateEmbedding).toHaveBeenCalledWith(
      expect.stringContaining("TypeScript developer")
    );
    expect(mocks.generateEmbedding).toHaveBeenCalledWith(
      expect.stringContaining("PostgreSQL")
    );
    expect(mocks.prisma.$queryRaw).toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      candidate: {
        id: "user-10",
        applicantProfileId: 10,
        email: "candidate-10@example.com",
        firstName: "Candidate",
        lastName: "10",
        city: "Makati",
        province: "Metro Manila",
        currentRole: "Fullstack Developer",
        skills: ["TypeScript", "Node.js", "React"],
        availability: "AVAILABLE",
        talentPoolStatus: "ACTIVE",
      },
      knnRank: 1,
      similarity: 0.92,
    });
  });

  it("text search returns eligible pool candidates with advisory rank", async () => {
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ applicantProfileId: 10, similarity: 0.88 }]);
    mocks.prisma.applicantProfile.findUniqueOrThrow.mockResolvedValueOnce(
      profile(10, ["TypeScript", "Node.js"])
    );

    const result = await searchTalentPoolByText("Senior Node.js developer");

    expect(result.retrievalOnly).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].similarity).toBe(0.88);
  });
});

describe("Talent Pool Redesign - Consider for Job Workflow", () => {
  it("reactivates candidate from Talent Pool into a NEW job application without mutating past history", async () => {
    const historicalApp = {
      id: 101,
      jobPostingId: 1,
      status: "TALENT_POOL",
      deployments: [],
    };

    mocks.prisma.applicantProfile.findUniqueOrThrow.mockResolvedValueOnce(
      profile(10, ["TypeScript", "Node.js"], {
        applications: [historicalApp],
      })
    );

    const createdApp = {
      id: 245,
      userId: "user-10",
      jobPostingId: 8,
      status: "SUBMITTED",
      resumeUrl: "https://example.com/resumes/10.pdf",
    };
    mocks.prisma.application.create.mockResolvedValueOnce(createdApp);
    mocks.calculate.mockResolvedValueOnce({ finalFitScore: 91 });

    const response = await considerTalentPoolCandidateForJob({
      applicantProfileId: 10,
      targetJobId: 8,
      recruiterId: "recruiter-uuid-1",
      notes: "Candidate is interested and available for immediate hire",
      contactOutcome: "INTERESTED",
    });

    expect(response.success).toBe(true);
    expect(response.application.id).toBe(245);
    expect(response.application.jobPostingId).toBe(8);

    // Verify a NEW application was created
    expect(mocks.prisma.application.create).toHaveBeenCalledWith({
      data: {
        userId: "user-10",
        jobPostingId: 8,
        status: "SUBMITTED",
        resumeUrl: "https://example.com/resumes/10.pdf",
      },
    });

    // Verify score was calculated against the NEW application and target job (no cross-job corruption)
    expect(mocks.calculate).toHaveBeenCalledWith(245, 8);

    // Verify contact history was logged
    expect(mocks.prisma.talentPoolContact.create).toHaveBeenCalledWith({
      data: {
        membershipId: 1000,
        jobPostingId: 8,
        recruiterId: "recruiter-uuid-1",
        outcome: "INTERESTED",
        notes: "Candidate is interested and available for immediate hire",
      },
    });

    // Verify membership lastContactedAt updated
    expect(mocks.prisma.talentPoolMembership.update).toHaveBeenCalledWith({
      where: { id: 1000 },
      data: { lastContactedAt: expect.any(Date) },
    });
  });

  it("rejects reactivation if candidate already has an active application for target job", async () => {
    mocks.prisma.applicantProfile.findUniqueOrThrow.mockResolvedValueOnce(
      profile(10, ["TypeScript"], {
        applications: [{ id: 150, jobPostingId: 8, status: "INITIAL_SCREENING", deployments: [] }],
      })
    );

    await expect(
      considerTalentPoolCandidateForJob({
        applicantProfileId: 10,
        targetJobId: 8,
        recruiterId: "recruiter-1",
      })
    ).rejects.toThrow(/already has an active application/i);
  });

  it("rejects reactivation if candidate is actively deployed", async () => {
    mocks.prisma.applicantProfile.findUniqueOrThrow.mockResolvedValueOnce(
      profile(10, ["TypeScript"], {
        applications: [
          {
            id: 101,
            jobPostingId: 1,
            status: "DEPLOYED",
            deployments: [{ id: 5, status: "ACTIVE" }],
          },
        ],
      })
    );

    await expect(
      considerTalentPoolCandidateForJob({
        applicantProfileId: 10,
        targetJobId: 8,
        recruiterId: "recruiter-1",
      })
    ).rejects.toThrow(/actively deployed/i);
  });

  it("rejects reactivation if candidate is marked UNAVAILABLE", async () => {
    mocks.prisma.applicantProfile.findUniqueOrThrow.mockResolvedValueOnce(
      profile(10, ["TypeScript"], {
        membership: {
          id: 1000,
          status: "ACTIVE",
          availability: "UNAVAILABLE",
        },
      })
    );

    await expect(
      considerTalentPoolCandidateForJob({
        applicantProfileId: 10,
        targetJobId: 8,
        recruiterId: "recruiter-1",
      })
    ).rejects.toThrow(/UNAVAILABLE/i);
  });
});

describe("Talent Pool Redesign - Recruiter Contact & Pool Management", () => {
  it("records recruiter contact and updates availability to UNAVAILABLE when outcome is UNAVAILABLE", async () => {
    mocks.prisma.talentPoolContact.create.mockResolvedValueOnce({
      id: 1,
      membershipId: 100,
      jobPostingId: 8,
      recruiterId: "recruiter-1",
      outcome: "UNAVAILABLE",
    });

    await recordTalentPoolContact({
      membershipId: 100,
      jobPostingId: 8,
      recruiterId: "recruiter-1",
      outcome: "UNAVAILABLE",
      notes: "Candidate accepted another offer elsewhere",
    });

    expect(mocks.prisma.talentPoolContact.create).toHaveBeenCalledWith({
      data: {
        membershipId: 100,
        jobPostingId: 8,
        recruiterId: "recruiter-1",
        outcome: "UNAVAILABLE",
        notes: "Candidate accepted another offer elsewhere",
      },
    });

    expect(mocks.prisma.talentPoolMembership.update).toHaveBeenCalledWith({
      where: { id: 100 },
      data: {
        lastContactedAt: expect.any(Date),
        availability: "UNAVAILABLE",
      },
    });
  });

  it("adds candidate to talent pool", async () => {
    mocks.prisma.applicantProfile.findUniqueOrThrow.mockResolvedValueOnce({ id: 10 });
    mocks.prisma.talentPoolMembership.upsert.mockResolvedValueOnce({
      id: 100,
      applicantProfileId: 10,
      status: "ACTIVE",
      availability: "AVAILABLE",
    });

    const result = await addToTalentPool({
      applicantProfileId: 10,
      addedById: "recruiter-1",
      sourceApplicationId: 55,
      notes: "Strong candidate for future backend roles",
    });

    expect(result.status).toBe("ACTIVE");
    expect(mocks.prisma.talentPoolMembership.upsert).toHaveBeenCalledWith({
      where: { applicantProfileId: 10 },
      create: {
        applicantProfileId: 10,
        sourceApplicationId: 55,
        status: "ACTIVE",
        availability: "AVAILABLE",
        addedById: "recruiter-1",
        notes: "Strong candidate for future backend roles",
      },
      update: {
        sourceApplicationId: 55,
        status: "ACTIVE",
        availability: "AVAILABLE",
        addedById: "recruiter-1",
        notes: "Strong candidate for future backend roles",
      },
      include: expect.any(Object),
    });
  });
});
