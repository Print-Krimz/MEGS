import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../utils/prisma.js";
import { scheduleNewInterview, updateInterviewResult, recordDirectInterviewResult } from "../services/ta/ta.interviews.service.js";
import { recordClientEndorsement } from "../services/ta/ta.endorsement.service.js";
import { updateTAApplicationStatus, getTAApplication } from "../services/ta/ta.applications.service.js";

describe("Initial Screening Interview & PASS Workflow Integration", { timeout: 20000 }, () => {
  let taUser: any;
  let applicantUser: any;
  let client: any;
  let mrf: any;
  let jobPosting: any;
  let testApp: any;

  beforeAll(async () => {
    const ts = Date.now();
    taUser = await prisma.user.create({
      data: {
        id: `ta-screen-${ts}`,
        email: `ta-screen-${ts}@example.com`,
        role: "TALENT_ACQUISITION",
      },
    });

    applicantUser = await prisma.user.create({
      data: {
        id: `cand-screen-${ts}`,
        email: `cand-screen-${ts}@example.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Nathaniel",
            lastName: "Cruz",
            mobileNumber: "09694173025",
            gender: "MALE",
            province: "Metro Manila",
            city: "Muntinlupa",
          },
        },
      },
    });

    client = await prisma.client.create({
      data: {
        name: `1 Star Alabang ${ts}`,
        industry: "Logistics",
      },
    });

    mrf = await prisma.manpowerRequest.create({
      data: {
        clientId: client.id,
        createdById: taUser.id,
        title: "Delivery Driver Requisition",
        headcount: 5,
      },
    });

    jobPosting = await prisma.jobPosting.create({
      data: {
        postedById: taUser.id,
        mrfId: mrf.id,
        title: "Delivery Driver",
        description: "Delivery operations in Alabang area",
        requirements: "Professional Driver License, Clean Record",
        status: "OPEN",
      },
    });
  });

  afterAll(async () => {
    try {
      if (testApp?.id) {
        await prisma.recruiterDecision.deleteMany({ where: { applicationId: testApp.id } });
        await prisma.clientEndorsement.deleteMany({ where: { applicationId: testApp.id } });
        await prisma.interview.deleteMany({ where: { applicationId: testApp.id } });
        await prisma.application.deleteMany({ where: { id: testApp.id } });
      }
      if (jobPosting?.id) await prisma.jobPosting.delete({ where: { id: jobPosting.id } });
      if (mrf?.id) await prisma.manpowerRequest.delete({ where: { id: mrf.id } });
      if (client?.id) await prisma.client.delete({ where: { id: client.id } });
      if (applicantUser?.id) {
        await prisma.notification.deleteMany({ where: { userId: applicantUser.id } });
        await prisma.applicantProfile.deleteMany({ where: { userId: applicantUser.id } });
        await prisma.user.delete({ where: { id: applicantUser.id } });
      }
      if (taUser?.id) {
        await prisma.notification.deleteMany({ where: { userId: taUser.id } });
        await prisma.user.delete({ where: { id: taUser.id } });
      }
    } catch {
      // Best-effort cleanup
    } finally {
      await prisma.$disconnect();
    }
  });

  it("1. Scheduling Initial Screening advances application from SUBMITTED to INITIAL_SCREENING", async () => {
    testApp = await prisma.application.create({
      data: {
        userId: applicantUser.id,
        jobPostingId: jobPosting.id,
        status: "SUBMITTED",
      },
    });
    expect(testApp.status).toBe("SUBMITTED");

    // Schedule interview
    const interview = await scheduleNewInterview(
      testApp.id,
      "INITIAL_SCREENING",
      new Date().toISOString(),
      "Scheduled screening call",
      taUser.id
    );
    expect(interview.type).toBe("INITIAL_SCREENING");
    expect(interview.result).toBe("PENDING");

    // Verify application status is now INITIAL_SCREENING
    const appAfterSchedule = await prisma.application.findUnique({
      where: { id: testApp.id },
    });
    expect(appAfterSchedule?.status).toBe("INITIAL_SCREENING");
  });

  it("2. Marking scheduled Initial Screening as PASS keeps status synchronized and permits Client Endorsement", async () => {
    const pendingInt = await prisma.interview.findFirst({
      where: { applicationId: testApp.id, type: "INITIAL_SCREENING", result: "PENDING" },
    });
    expect(pendingInt).toBeDefined();

    const { updatedInterview } = await updateInterviewResult(
      testApp.id,
      pendingInt!.id,
      "PASS",
      new Date().toISOString(),
      "Candidate passed screening with flying colors",
      taUser.id
    );
    expect(updatedInterview.result).toBe("PASS");

    // Status is INITIAL_SCREENING
    const appAfterPass = await prisma.application.findUnique({
      where: { id: testApp.id },
    });
    expect(appAfterPass?.status).toBe("INITIAL_SCREENING");

    // Endorse to Client now succeeds and moves to CLIENT_ENDORSEMENT
    const endorsement = await recordClientEndorsement(
      testApp.id,
      client.id,
      "PENDING",
      taUser.id,
      "Endorsing candidate to 1 Star Alabang"
    );
    expect(endorsement.outcome).toBe("PENDING");

    const appAfterEndorse = await prisma.application.findUnique({
      where: { id: testApp.id },
    });
    expect(appAfterEndorse?.status).toBe("CLIENT_ENDORSEMENT");
  });

  it("3. Direct record of Initial Screening PASS on SUBMITTED/REVIEW application transitions status to INITIAL_SCREENING", async () => {
    const ts3 = `${Date.now()}-3`;
    const cand3 = await prisma.user.create({
      data: {
        id: `cand-screen-${ts3}`,
        email: `cand-screen-${ts3}@example.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Direct",
            lastName: "Candidate",
            mobileNumber: "09694173026",
          },
        },
      },
    });

    const directApp = await prisma.application.create({
      data: {
        userId: cand3.id,
        jobPostingId: jobPosting.id,
        status: "REVIEW",
      },
    });

    try {
      const { updatedInterview } = await recordDirectInterviewResult(
        directApp.id,
        "INITIAL_SCREENING",
        "PASS",
        new Date().toISOString(),
        "Direct offline screening passed",
        taUser.id
      );
      expect(updatedInterview.result).toBe("PASS");

      const directAppAfter = await prisma.application.findUnique({
        where: { id: directApp.id },
      });
      expect(directAppAfter?.status).toBe("INITIAL_SCREENING");

      // Endorsing with ENDORSED/APPROVED auto-advances to FINAL_INTERVIEW
      await recordClientEndorsement(
        directApp.id,
        client.id,
        "ENDORSED",
        taUser.id,
        "Endorsed after direct screening"
      );

      const directAppEndorsed = await prisma.application.findUnique({
        where: { id: directApp.id },
      });
      expect(directAppEndorsed?.status).toBe("FINAL_INTERVIEW");
    } finally {
      await prisma.recruiterDecision.deleteMany({ where: { applicationId: directApp.id } });
      await prisma.clientEndorsement.deleteMany({ where: { applicationId: directApp.id } });
      await prisma.interview.deleteMany({ where: { applicationId: directApp.id } });
      await prisma.application.deleteMany({ where: { id: directApp.id } });
      await prisma.applicantProfile.deleteMany({ where: { userId: cand3.id } });
      await prisma.notification.deleteMany({ where: { userId: cand3.id } });
      await prisma.user.deleteMany({ where: { id: cand3.id } });
    }
  });

  it("4. Rejects Client Endorsement when Initial Screening was marked as FAIL", async () => {
    const ts4 = `${Date.now()}-4`;
    const cand4 = await prisma.user.create({
      data: {
        id: `cand-screen-${ts4}`,
        email: `cand-screen-${ts4}@example.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Fail",
            lastName: "Candidate",
            mobileNumber: "09694173027",
          },
        },
      },
    });

    const failApp = await prisma.application.create({
      data: {
        userId: cand4.id,
        jobPostingId: jobPosting.id,
        status: "SUBMITTED",
      },
    });

    try {
      await recordDirectInterviewResult(
        failApp.id,
        "INITIAL_SCREENING",
        "FAIL",
        new Date().toISOString(),
        "Did not meet driver qualifications",
        taUser.id
      );

      // Attempting to endorse should fail
      await expect(
        recordClientEndorsement(failApp.id, client.id, "PENDING", taUser.id)
      ).rejects.toThrow(/A passed INITIAL_SCREENING interview is required/);
    } finally {
      await prisma.recruiterDecision.deleteMany({ where: { applicationId: failApp.id } });
      await prisma.interview.deleteMany({ where: { applicationId: failApp.id } });
      await prisma.application.deleteMany({ where: { id: failApp.id } });
      await prisma.applicantProfile.deleteMany({ where: { userId: cand4.id } });
      await prisma.notification.deleteMany({ where: { userId: cand4.id } });
      await prisma.user.deleteMany({ where: { id: cand4.id } });
    }
  });

  it("5. NO_SHOW result auto-archives application and logs decision", async () => {
    const ts5 = `${Date.now()}-5`;
    const cand5 = await prisma.user.create({
      data: {
        id: `cand-screen-${ts5}`,
        email: `cand-screen-${ts5}@example.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "NoShow",
            lastName: "Candidate",
            mobileNumber: "09694173028",
          },
        },
      },
    });

    const noShowApp = await prisma.application.create({
      data: {
        userId: cand5.id,
        jobPostingId: jobPosting.id,
        status: "INITIAL_SCREENING",
      },
    });

    try {
      const interview = await prisma.interview.create({
        data: {
          applicationId: noShowApp.id,
          type: "INITIAL_SCREENING",
          result: "PENDING",
          scheduledAt: new Date(),
        },
      });

      await updateInterviewResult(
        noShowApp.id,
        interview.id,
        "NO_SHOW",
        new Date().toISOString(),
        "Candidate did not attend scheduled call",
        taUser.id
      );

      const archivedApp = await prisma.application.findUnique({
        where: { id: noShowApp.id },
      });
      expect(archivedApp?.status).toBe("ARCHIVED");
      expect(archivedApp?.isArchived).toBe(true);
    } finally {
      await prisma.recruiterDecision.deleteMany({ where: { applicationId: noShowApp.id } });
      await prisma.interview.deleteMany({ where: { applicationId: noShowApp.id } });
      await prisma.application.deleteMany({ where: { id: noShowApp.id } });
      await prisma.applicantProfile.deleteMany({ where: { userId: cand5.id } });
      await prisma.notification.deleteMany({ where: { userId: cand5.id } });
      await prisma.user.deleteMany({ where: { id: cand5.id } });
    }
  });
});
