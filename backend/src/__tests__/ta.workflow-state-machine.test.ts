import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../utils/prisma.js";
import { updateTAApplicationStatus, ALLOWED_TRANSITIONS } from "../services/ta/ta.applications.service.js";
import {
  updateClientEndorsement,
  recordClientEndorsement,
} from "../services/ta/ta.endorsement.service.js";
import {
  updateInterviewResult,
  recordDirectInterviewResult,
} from "../services/ta/ta.interviews.service.js";
import {
  discoverTalentPoolForJob,
  searchTalentPoolByText,
  addToTalentPool,
  considerTalentPoolCandidateForJob,
  rebuildCandidateFeatureProfile,
} from "../services/scoring/talent-pool-knn.service.js";

describe("Phase 1: Workflow State Machine & Candidate Rejection", () => {
  let testTA: any;
  let testUser: any;
  let testClient: any;
  let testMrf: any;
  let testJob: any;
  let testApp: any;

  beforeAll(async () => {
    testTA = await prisma.user.create({
      data: {
        id: `ta-p1-${Date.now()}`,
        email: `ta-p1-${Date.now()}@example.com`,
        role: "TALENT_ACQUISITION",
      },
    });

    testUser = await prisma.user.create({
      data: {
        id: `cand-p1-${Date.now()}`,
        email: `cand-p1-${Date.now()}@example.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Phase1",
            lastName: "Candidate",
            mobileNumber: "09111111111",
          },
        },
      },
    });

    testClient = await prisma.client.create({
      data: {
        name: `Phase1 Client ${Date.now()}`,
      },
    });

    testMrf = await prisma.manpowerRequest.create({
      data: {
        clientId: testClient.id,
        createdById: testTA.id,
        title: "QA Engineer",
      },
    });

    testJob = await prisma.jobPosting.create({
      data: {
        postedById: testTA.id,
        mrfId: testMrf.id,
        title: "QA Engineer",
        description: "QA description",
        requirements: "Playwright, Vitest",
        status: "OPEN",
      },
    });
  });

  afterAll(async () => {
    try {
      if (testApp?.id) {
        await prisma.recruiterDecision.deleteMany({ where: { applicationId: testApp.id } });
        await prisma.application.deleteMany({ where: { id: testApp.id } });
      }
      if (testJob?.id) await prisma.jobPosting.deleteMany({ where: { id: testJob.id } });
      if (testMrf?.id) await prisma.manpowerRequest.deleteMany({ where: { id: testMrf.id } });
      if (testClient?.id) await prisma.client.deleteMany({ where: { id: testClient.id } });
      if (testUser?.id) {
        await prisma.notification.deleteMany({ where: { userId: testUser.id } });
        await prisma.applicantProfile.deleteMany({ where: { userId: testUser.id } });
        await prisma.user.deleteMany({ where: { id: testUser.id } });
      }
      if (testTA?.id) {
        await prisma.notification.deleteMany({ where: { userId: testTA.id } });
        await prisma.user.deleteMany({ where: { id: testTA.id } });
      }
    } catch {
      // Best-effort cleanup
    }
  });

  it("allows rejecting (ARCHIVED) from active stages with audit reason", async () => {
    testApp = await prisma.application.create({
      data: {
        userId: testUser.id,
        jobPostingId: testJob.id,
        status: "INITIAL_SCREENING",
      },
    });

    const rejected = await updateTAApplicationStatus(
      testApp.id,
      "ARCHIVED",
      testTA.id,
      "Candidate did not meet technical bar during screening"
    );

    expect(rejected.status).toBe("ARCHIVED");

    // Verify audit log
    const decision = await prisma.recruiterDecision.findFirst({
      where: { applicationId: testApp.id, toStatus: "ARCHIVED" },
    });
    expect(decision).toBeDefined();
    expect(decision?.fromStatus).toBe("INITIAL_SCREENING");
    expect(decision?.reason).toContain("Candidate did not meet technical bar");
  });

  it("verifies ALLOWED_TRANSITIONS contains ARCHIVED for all active non-terminal states", () => {
    const activeStates = [
      "SUBMITTED",
      "PARSING",
      "REVIEW",
      "NEEDS_ATTENTION",
      "MATCHED",
      "TALENT_POOL",
      "INITIAL_SCREENING",
      "CLIENT_ENDORSEMENT",
      "FINAL_INTERVIEW",
      "COMPLIANCE",
      "DEPLOYED",
    ];

    for (const state of activeStates) {
      expect(ALLOWED_TRANSITIONS[state]).toContain("ARCHIVED");
    }
  });

  it("ensures ALLOWED_TRANSITIONS for TALENT_POOL only allows ARCHIVED to prevent progression in old application", () => {
    expect(ALLOWED_TRANSITIONS.TALENT_POOL).toEqual(["ARCHIVED"]);
  });

  it("sends candidate-friendly notification without internal HR jargon when moving to TALENT_POOL", async () => {
    const freshUser = await prisma.user.create({
      data: {
        id: `cand-pool-${Date.now()}`,
        email: `cand-pool-${Date.now()}@example.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Pool",
            lastName: "Candidate",
            mobileNumber: "09222222222",
          },
        },
      },
    });

    const freshJob = await prisma.jobPosting.create({
      data: {
        postedById: testTA.id,
        mrfId: testMrf.id,
        title: "Logistics Specialist",
        description: "Logistics",
        requirements: "Logistics",
        status: "OPEN",
      },
    });

    const candidateApp = await prisma.application.create({
      data: {
        userId: freshUser.id,
        jobPostingId: freshJob.id,
        status: "INITIAL_SCREENING",
      },
    });

    const updated = await updateTAApplicationStatus(
      candidateApp.id,
      "TALENT_POOL",
      testTA.id,
      "Candidate profile preserved for future matching"
    );

    expect(updated.status).toBe("TALENT_POOL");

    // Fetch the notification created for the candidate
    const notification = await prisma.notification.findFirst({
      where: {
        userId: freshUser.id,
        title: "Application Update",
      },
      orderBy: { createdAt: "desc" },
    });

    expect(notification).toBeDefined();
    expect(notification?.message).toBe(
      "You were not selected for this position, but your profile may be considered for future job opportunities that match your qualifications."
    );
    expect(notification?.message).not.toContain("Talent Pool");

    // Cleanup
    const profile = await prisma.applicantProfile.findUnique({ where: { userId: freshUser.id } });
    if (profile) {
      await prisma.candidateFeatureProfile.deleteMany({ where: { applicantProfileId: profile.id } });
      await prisma.talentPoolMembership.deleteMany({ where: { applicantProfileId: profile.id } });
    }
    await prisma.recruiterDecision.deleteMany({ where: { applicationId: candidateApp.id } });
    await prisma.application.deleteMany({ where: { id: candidateApp.id } });
    await prisma.notification.deleteMany({ where: { userId: freshUser.id } });
    await prisma.jobPosting.deleteMany({ where: { id: freshJob.id } });
    await prisma.applicantProfile.deleteMany({ where: { userId: freshUser.id } });
    await prisma.user.deleteMany({ where: { id: freshUser.id } });
  });

  describe("Task 3: Client Rejection Talent Pool Retention & No-Show Exclusion", () => {
    it("auto-enrolls and retains candidate in Talent Pool when client endorsement is updated to DECLINED", async () => {
      const declUser = await prisma.user.create({
        data: {
          id: `cand-decl-${Date.now()}`,
          email: `cand-decl-${Date.now()}@example.com`,
          role: "APPLICANT",
          applicantProfile: {
            create: {
              firstName: "Decline",
              lastName: "Candidate",
              mobileNumber: "09333333333",
            },
          },
        },
      });

      const declApp = await prisma.application.create({
        data: {
          userId: declUser.id,
          jobPostingId: testJob.id,
          status: "CLIENT_ENDORSEMENT",
        },
      });

      const endorsement = await prisma.clientEndorsement.create({
        data: {
          applicationId: declApp.id,
          clientId: testClient.id,
          outcome: "PENDING",
        },
      });

      const profile = await prisma.applicantProfile.findUniqueOrThrow({
        where: { userId: declUser.id },
      });

      // Update endorsement to DECLINED
      const updated = await updateClientEndorsement(
        declApp.id,
        endorsement.id,
        "DECLINED",
        testTA.id,
        "Candidate lacks specialized certifications requested by client"
      );

      expect(updated.outcome).toBe("DECLINED");

      // Verify talent pool membership was auto-upserted
      const membership = await prisma.talentPoolMembership.findUnique({
        where: { applicantProfileId: profile.id },
      });

      expect(membership).toBeDefined();
      expect(membership?.status).toBe("ACTIVE");
      expect(membership?.availability).toBe("AVAILABLE");
      expect(membership?.sourceApplicationId).toBe(declApp.id);
      expect(membership?.notes).toContain("Candidate lacks specialized certifications");

      // Also verify rejecting/archiving from CLIENT_ENDORSEMENT keeps membership ACTIVE
      await updateTAApplicationStatus(
        declApp.id,
        "ARCHIVED",
        testTA.id,
        "Application concluded following client decline"
      );

      const membershipAfterArchive = await prisma.talentPoolMembership.findUnique({
        where: { applicantProfileId: profile.id },
      });
      expect(membershipAfterArchive?.status).toBe("ACTIVE");
      expect(membershipAfterArchive?.availability).toBe("AVAILABLE");

      // Cleanup
      await prisma.candidateFeatureProfile.deleteMany({ where: { applicantProfileId: profile.id } });
      await prisma.talentPoolMembership.deleteMany({ where: { applicantProfileId: profile.id } });
      await prisma.recruiterDecision.deleteMany({ where: { applicationId: declApp.id } });
      await prisma.clientEndorsement.deleteMany({ where: { applicationId: declApp.id } });
      await prisma.application.deleteMany({ where: { id: declApp.id } });
      await prisma.notification.deleteMany({ where: { userId: declUser.id } });
      await prisma.applicantProfile.deleteMany({ where: { userId: declUser.id } });
      await prisma.user.deleteMany({ where: { id: declUser.id } });
    });

    it("auto-enrolls candidate in Talent Pool when initial endorsement is recorded as DECLINED", async () => {
      const recDeclUser = await prisma.user.create({
        data: {
          id: `cand-recdecl-${Date.now()}`,
          email: `cand-recdecl-${Date.now()}@example.com`,
          role: "APPLICANT",
          applicantProfile: {
            create: {
              firstName: "RecDecl",
              lastName: "Candidate",
            },
          },
        },
      });

      const recDeclApp = await prisma.application.create({
        data: {
          userId: recDeclUser.id,
          jobPostingId: testJob.id,
          status: "INITIAL_SCREENING",
        },
      });

      // Candidate must have passed screening interview to record endorsement
      await prisma.interview.create({
        data: {
          applicationId: recDeclApp.id,
          type: "INITIAL_SCREENING",
          result: "PASS",
          isActive: true,
        },
      });

      const profile = await prisma.applicantProfile.findUniqueOrThrow({
        where: { userId: recDeclUser.id },
      });

      const endorsement = await recordClientEndorsement(
        recDeclApp.id,
        testClient.id,
        "DECLINED",
        testTA.id,
        "Client pre-declined profile"
      );

      expect(endorsement.outcome).toBe("DECLINED");

      const membership = await prisma.talentPoolMembership.findUnique({
        where: { applicantProfileId: profile.id },
      });
      expect(membership).toBeDefined();
      expect(membership?.status).toBe("ACTIVE");
      expect(membership?.availability).toBe("AVAILABLE");

      // Cleanup
      await prisma.candidateFeatureProfile.deleteMany({ where: { applicantProfileId: profile.id } });
      await prisma.talentPoolMembership.deleteMany({ where: { applicantProfileId: profile.id } });
      await prisma.recruiterDecision.deleteMany({ where: { applicationId: recDeclApp.id } });
      await prisma.clientEndorsement.deleteMany({ where: { applicationId: recDeclApp.id } });
      await prisma.interview.deleteMany({ where: { applicationId: recDeclApp.id } });
      await prisma.application.deleteMany({ where: { id: recDeclApp.id } });
      await prisma.notification.deleteMany({ where: { userId: recDeclUser.id } });
      await prisma.applicantProfile.deleteMany({ where: { userId: recDeclUser.id } });
      await prisma.user.deleteMany({ where: { id: recDeclUser.id } });
    });

    it("permanently flags candidate with hasNoShowHistory and archives talent pool membership when marked NO_SHOW", async () => {
      const noShowUser = await prisma.user.create({
        data: {
          id: `cand-noshow-${Date.now()}`,
          email: `cand-noshow-${Date.now()}@example.com`,
          role: "APPLICANT",
          applicantProfile: {
            create: {
              firstName: "NoShow",
              lastName: "Candidate",
              hasNoShowHistory: false,
            },
          },
        },
      });

      const profile = await prisma.applicantProfile.findUniqueOrThrow({
        where: { userId: noShowUser.id },
      });

      // Pre-seed an active talent pool membership
      await prisma.talentPoolMembership.create({
        data: {
          applicantProfileId: profile.id,
          status: "ACTIVE",
          availability: "AVAILABLE",
          addedById: testTA.id,
        },
      });

      const noShowApp = await prisma.application.create({
        data: {
          userId: noShowUser.id,
          jobPostingId: testJob.id,
          status: "INITIAL_SCREENING",
        },
      });

      const interview = await prisma.interview.create({
        data: {
          applicationId: noShowApp.id,
          type: "INITIAL_SCREENING",
          result: "PENDING",
          isActive: true,
        },
      });

      // Update interview result to NO_SHOW
      await updateInterviewResult(
        noShowApp.id,
        interview.id,
        "NO_SHOW",
        undefined,
        "Candidate did not show up or provide notice",
        testTA.id
      );

      // Verify profile is permanently flagged
      const updatedProfile = await prisma.applicantProfile.findUniqueOrThrow({
        where: { id: profile.id },
      });
      expect(updatedProfile.hasNoShowHistory).toBe(true);

      // Verify TalentPoolMembership is ARCHIVED and UNAVAILABLE
      const updatedMembership = await prisma.talentPoolMembership.findUnique({
        where: { applicantProfileId: profile.id },
      });
      expect(updatedMembership?.status).toBe("ARCHIVED");
      expect(updatedMembership?.availability).toBe("UNAVAILABLE");
      expect(updatedMembership?.notes).toContain("NO_SHOW");

      // Verify application was auto-archived
      const archivedApp = await prisma.application.findUniqueOrThrow({
        where: { id: noShowApp.id },
      });
      expect(archivedApp.status).toBe("ARCHIVED");
      expect(archivedApp.isArchived).toBe(true);

      // Cleanup
      await prisma.candidateFeatureProfile.deleteMany({ where: { applicantProfileId: profile.id } });
      await prisma.talentPoolMembership.deleteMany({ where: { applicantProfileId: profile.id } });
      await prisma.recruiterDecision.deleteMany({ where: { applicationId: noShowApp.id } });
      await prisma.interview.deleteMany({ where: { applicationId: noShowApp.id } });
      await prisma.application.deleteMany({ where: { id: noShowApp.id } });
      await prisma.notification.deleteMany({ where: { userId: noShowUser.id } });
      await prisma.applicantProfile.deleteMany({ where: { userId: noShowUser.id } });
      await prisma.user.deleteMany({ where: { id: noShowUser.id } });
    });

    it("flags profile and archives talent pool membership on recordDirectInterviewResult with NO_SHOW", async () => {
      const directUser = await prisma.user.create({
        data: {
          id: `cand-dirnoshow-${Date.now()}`,
          email: `cand-dirnoshow-${Date.now()}@example.com`,
          role: "APPLICANT",
          applicantProfile: {
            create: {
              firstName: "DirectNoShow",
              lastName: "Candidate",
              hasNoShowHistory: false,
            },
          },
        },
      });

      const profile = await prisma.applicantProfile.findUniqueOrThrow({
        where: { userId: directUser.id },
      });

      const directApp = await prisma.application.create({
        data: {
          userId: directUser.id,
          jobPostingId: testJob.id,
          status: "INITIAL_SCREENING",
        },
      });

      await recordDirectInterviewResult(
        directApp.id,
        "INITIAL_SCREENING",
        "NO_SHOW",
        undefined,
        "Candidate missed scheduled screening call",
        testTA.id
      );

      const updatedProfile = await prisma.applicantProfile.findUniqueOrThrow({
        where: { id: profile.id },
      });
      expect(updatedProfile.hasNoShowHistory).toBe(true);

      const updatedMembership = await prisma.talentPoolMembership.findUnique({
        where: { applicantProfileId: profile.id },
      });
      expect(updatedMembership?.status).toBe("ARCHIVED");
      expect(updatedMembership?.availability).toBe("UNAVAILABLE");

      // Cleanup
      await prisma.candidateFeatureProfile.deleteMany({ where: { applicantProfileId: profile.id } });
      await prisma.talentPoolMembership.deleteMany({ where: { applicantProfileId: profile.id } });
      await prisma.recruiterDecision.deleteMany({ where: { applicationId: directApp.id } });
      await prisma.interview.deleteMany({ where: { applicationId: directApp.id } });
      await prisma.application.deleteMany({ where: { id: directApp.id } });
      await prisma.notification.deleteMany({ where: { userId: directUser.id } });
      await prisma.applicantProfile.deleteMany({ where: { userId: directUser.id } });
      await prisma.user.deleteMany({ where: { id: directUser.id } });
    });

    it("strictly excludes no-show candidates and archived memberships from talent pool discovery and KNN search", async () => {
      // 1. Eligible active candidate
      const activeUser = await prisma.user.create({
        data: {
          id: `cand-knn-act-${Date.now()}`,
          email: `cand-knn-act-${Date.now()}@example.com`,
          role: "APPLICANT",
          applicantProfile: {
            create: {
              firstName: "KnnActive",
              lastName: "Candidate",
              hasNoShowHistory: false,
              isActive: true,
              professionalSummary: "QA Engineer with Playwright and Vitest testing expertise",
              workExperiences: {
                create: {
                  company: "Quality Works",
                  roleTitle: "QA Engineer",
                  startDate: new Date("2021-01-01"),
                  isCurrent: true,
                  summary: "QA Engineer automated testing with Playwright and Vitest",
                },
              },
            },
          },
        },
      });
      const activeProfile = await prisma.applicantProfile.findUniqueOrThrow({ where: { userId: activeUser.id } });
      await prisma.talentPoolMembership.create({
        data: {
          applicantProfileId: activeProfile.id,
          status: "ACTIVE",
          availability: "AVAILABLE",
          addedById: testTA.id,
        },
      });
      await rebuildCandidateFeatureProfile(activeProfile.id);

      // 2. Candidate with hasNoShowHistory = true
      const noShowUser = await prisma.user.create({
        data: {
          id: `cand-knn-ns-${Date.now()}`,
          email: `cand-knn-ns-${Date.now()}@example.com`,
          role: "APPLICANT",
          applicantProfile: {
            create: {
              firstName: "KnnNoShow",
              lastName: "Candidate",
              hasNoShowHistory: true,
              isActive: true,
              professionalSummary: "QA Engineer with Playwright and Vitest testing expertise",
              workExperiences: {
                create: {
                  company: "Quality Works",
                  roleTitle: "QA Engineer",
                  startDate: new Date("2021-01-01"),
                  isCurrent: true,
                  summary: "QA Engineer automated testing with Playwright and Vitest",
                },
              },
            },
          },
        },
      });
      const noShowProfile = await prisma.applicantProfile.findUniqueOrThrow({ where: { userId: noShowUser.id } });
      await prisma.talentPoolMembership.create({
        data: {
          applicantProfileId: noShowProfile.id,
          status: "ACTIVE", // even if status was active, hasNoShowHistory must exclude
          availability: "AVAILABLE",
          addedById: testTA.id,
        },
      });
      await rebuildCandidateFeatureProfile(noShowProfile.id);

      // 3. Candidate with membership status = ARCHIVED
      const archivedUser = await prisma.user.create({
        data: {
          id: `cand-knn-arch-${Date.now()}`,
          email: `cand-knn-arch-${Date.now()}@example.com`,
          role: "APPLICANT",
          applicantProfile: {
            create: {
              firstName: "KnnArchived",
              lastName: "Candidate",
              hasNoShowHistory: false,
              isActive: true,
              professionalSummary: "QA Engineer with Playwright and Vitest testing expertise",
              workExperiences: {
                create: {
                  company: "Quality Works",
                  roleTitle: "QA Engineer",
                  startDate: new Date("2021-01-01"),
                  isCurrent: true,
                  summary: "QA Engineer automated testing with Playwright and Vitest",
                },
              },
            },
          },
        },
      });
      const archivedProfile = await prisma.applicantProfile.findUniqueOrThrow({ where: { userId: archivedUser.id } });
      await prisma.talentPoolMembership.create({
        data: {
          applicantProfileId: archivedProfile.id,
          status: "ARCHIVED",
          availability: "UNAVAILABLE",
          addedById: testTA.id,
        },
      });
      await rebuildCandidateFeatureProfile(archivedProfile.id);

      try {
        // Run searchTalentPoolByText
        const searchResults = await searchTalentPoolByText("QA Engineer", { k: 20, minimumSimilarity: 0.1 });
        const returnedProfileIds = searchResults.items.map((i) => i.candidate.applicantProfileId);

        expect(returnedProfileIds).toContain(activeProfile.id);
        expect(returnedProfileIds).not.toContain(noShowProfile.id);
        expect(returnedProfileIds).not.toContain(archivedProfile.id);

        // Run discoverTalentPoolForJob
        const jobResults = await discoverTalentPoolForJob(testJob.id, { k: 20, minimumSimilarity: 0.1 });
        const jobProfileIds = jobResults.items.map((i) => i.candidate.applicantProfileId);

        expect(jobProfileIds).toContain(activeProfile.id);
        expect(jobProfileIds).not.toContain(noShowProfile.id);
        expect(jobProfileIds).not.toContain(archivedProfile.id);

        // Also verify guard rails: addToTalentPool and considerTalentPoolCandidateForJob reject no-show candidates
        await expect(
          addToTalentPool({
            applicantProfileId: noShowProfile.id,
            addedById: testTA.id,
          })
        ).rejects.toThrow("Candidate has a recorded interview NO_SHOW history");

        await expect(
          considerTalentPoolCandidateForJob({
            applicantProfileId: noShowProfile.id,
            targetJobId: testJob.id,
            recruiterId: testTA.id,
          })
        ).rejects.toThrow("NO_SHOW history");
      } finally {
        // Cleanup all 3 candidates
        for (const p of [activeProfile, noShowProfile, archivedProfile]) {
          await prisma.workExperience.deleteMany({ where: { applicantProfileId: p.id } });
          await prisma.candidateFeatureProfile.deleteMany({ where: { applicantProfileId: p.id } });
          await prisma.talentPoolMembership.deleteMany({ where: { applicantProfileId: p.id } });
        }
        for (const u of [activeUser, noShowUser, archivedUser]) {
          await prisma.applicantProfile.deleteMany({ where: { userId: u.id } });
          await prisma.user.deleteMany({ where: { id: u.id } });
        }
      }
    });
  });
});


