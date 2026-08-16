import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../utils/prisma.js";
import {
  recordClientEndorsement,
  listClientEndorsements,
  getLatestClientEndorsement,
} from "../services/ta/ta.endorsement.service.js";

describe("TA Client Endorsement Service", () => {
  let testUser: any;
  let testTA: any;
  let testClient: any;
  let testJob: any;
  let testApp: any;

  beforeAll(async () => {
    // Setup test users, client, job, and application
    testUser = await prisma.user.create({
      data: {
        id: `cand-endorse-${Date.now()}`,
        email: `endorse-applicant-${Date.now()}@test.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Nathaniel",
            lastName: "Cruz",
            mobileNumber: "09694173025",
            gender: "MALE",
            province: "Metro Manila",
            city: "Taguig",
            dateOfBirth: new Date("1996-05-12"),
            birthPlace: "Manila",
            nationality: "Filipino",
            civilStatus: "SINGLE",
            address: "Sample Address 123",
          },
        },
      },
    });

    testTA = await prisma.user.create({
      data: {
        id: `ta-endorse-${Date.now()}`,
        email: `endorse-ta-${Date.now()}@test.com`,
        role: "TALENT_ACQUISITION",
      },
    });

    testClient = await prisma.client.create({
      data: {
        name: `Acme Corp ${Date.now()}`,
        industry: "Manufacturing",
      },
    });

    testJob = await prisma.jobPosting.create({
      data: {
        postedById: testTA.id,
        title: "Test Operations Lead",
        description: "Test description",
        requirements: "Operations, Management",
        status: "OPEN",
      },
    });

    testApp = await prisma.application.create({
      data: {
        userId: testUser.id,
        jobPostingId: testJob.id,
        status: "INITIAL_SCREENING",
      },
    });
  });

  afterAll(async () => {
    // Clean up
    if (testApp?.id) {
      await prisma.notification.deleteMany({ where: { userId: testUser.id } });
      await prisma.recruiterDecision.deleteMany({ where: { applicationId: testApp.id } });
      await prisma.clientEndorsement.deleteMany({ where: { applicationId: testApp.id } });
      await prisma.application.delete({ where: { id: testApp.id } }).catch(() => {});
    }
    if (testJob?.id) {
      await prisma.jobPosting.delete({ where: { id: testJob.id } }).catch(() => {});
    }
    if (testClient?.id) {
      await prisma.client.delete({ where: { id: testClient.id } }).catch(() => {});
    }
    if (testUser?.id) {
      await prisma.applicantProfile.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    if (testTA?.id) {
      await prisma.user.delete({ where: { id: testTA.id } }).catch(() => {});
    }
  });

  it("advances application status from INITIAL_SCREENING to CLIENT_ENDORSEMENT and notifies the applicant", async () => {
    expect(testApp.status).toBe("INITIAL_SCREENING");

    const endorsement = await recordClientEndorsement(
      testApp.id,
      testClient.id,
      "PENDING",
      testTA.id,
      "Endorsed to Acme Corp hiring team"
    );

    expect(endorsement).toBeDefined();
    expect(endorsement.applicationId).toBe(testApp.id);
    expect(endorsement.clientId).toBe(testClient.id);
    expect(endorsement.outcome).toBe("PENDING");

    // Verify application status was updated
    const updatedApp = await prisma.application.findUnique({
      where: { id: testApp.id },
    });
    expect(updatedApp?.status).toBe("CLIENT_ENDORSEMENT");

    // Verify RecruiterDecision audit log was created
    const decision = await prisma.recruiterDecision.findFirst({
      where: { applicationId: testApp.id, toStatus: "CLIENT_ENDORSEMENT" },
      orderBy: { createdAt: "desc" },
    });
    expect(decision).toBeDefined();
    expect(decision?.fromStatus).toBe("INITIAL_SCREENING");
    expect(decision?.toStatus).toBe("CLIENT_ENDORSEMENT");
    expect(decision?.actorId).toBe(testTA.id);

    // Verify Notification was created
    const notification = await prisma.notification.findFirst({
      where: { userId: testUser.id },
      orderBy: { createdAt: "desc" },
    });
    expect(notification).toBeDefined();
    expect(notification?.title).toBe("Client Endorsement");
    expect(notification?.message).toContain(testClient.name);
  });

  it("records approved endorsement outcome and notifies user with SUCCESS type", async () => {
    const approvedEndorsement = await recordClientEndorsement(
      testApp.id,
      testClient.id,
      "ENDORSED",
      testTA.id,
      "Client accepted candidate profile"
    );

    expect(approvedEndorsement.outcome).toBe("ENDORSED");

    // Verify notification
    const notification = await prisma.notification.findFirst({
      where: { userId: testUser.id, type: "SUCCESS" },
      orderBy: { createdAt: "desc" },
    });
    expect(notification).toBeDefined();
    expect(notification?.title).toBe("Client Endorsement Approved");
    expect(notification?.message).toContain("approved");
  });

  it("lists all endorsements in descending order", async () => {
    const endorsements = await listClientEndorsements(testApp.id);
    expect(endorsements.length).toBe(2);
    expect(endorsements[0].outcome).toBe("ENDORSED");
    expect(endorsements[1].outcome).toBe("PENDING");
  });

  it("retrieves latest client endorsement", async () => {
    const latest = await getLatestClientEndorsement(testApp.id);
    expect(latest).toBeDefined();
    expect(latest?.outcome).toBe("ENDORSED");
  });
});
