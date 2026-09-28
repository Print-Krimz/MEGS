import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../utils/prisma.js";
import { updateTAApplicationStatus, getTAApplication } from "../services/ta/ta.applications.service.js";
import { scheduleNewInterview, updateInterviewResult } from "../services/ta/ta.interviews.service.js";
import { recordClientEndorsement } from "../services/ta/ta.endorsement.service.js";

describe("TA Applications Pipeline Gating & Bypass Prevention", () => {
  let testUser: any;
  let testTA: any;
  let testClient: any;
  let testMrf: any;
  let testJob: any;
  let testApp: any;

  beforeAll(async () => {
    const ts = Date.now();
    testUser = await prisma.user.create({
      data: {
        id: `cand-gating-${ts}`,
        email: `candidate-gating-${ts}@test.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Gabriel",
            lastName: "Reyes",
            mobileNumber: "09171234567",
          },
        },
      },
    });

    testTA = await prisma.user.create({
      data: {
        id: `ta-gating-${ts}`,
        email: `ta-gating-${ts}@test.com`,
        role: "TALENT_ACQUISITION",
      },
    });

    testClient = await prisma.client.create({
      data: {
        name: `Acme Global Corp ${ts}`,
        industry: "Information Technology",
      },
    });

    testMrf = await prisma.manpowerRequest.create({
      data: {
        clientId: testClient.id,
        title: "Senior Backend Developer",
        createdById: testTA.id,
        status: "OPEN",
      },
    });

    testJob = await prisma.jobPosting.create({
      data: {
        postedById: testTA.id,
        mrfId: testMrf.id,
        title: "Senior Backend Developer Requisition",
        description: "Node.js and TypeScript expertise",
        requirements: "Node.js, PostgreSQL",
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
  }, 25000);

  afterAll(async () => {
    try {
      if (testApp?.id) {
        await prisma.deploymentStatusHistory.deleteMany({ where: { deployment: { applicationId: testApp.id } } });
        await prisma.deployment.deleteMany({ where: { applicationId: testApp.id } });
        await prisma.employmentEvent.deleteMany({ where: { employee: { userId: testUser.id } } });
        await prisma.employee.deleteMany({ where: { userId: testUser.id } });
        await prisma.complianceRequirement.deleteMany({ where: { applicationId: testApp.id } });
        await prisma.clientEndorsement.deleteMany({ where: { applicationId: testApp.id } });
        await prisma.recruiterDecision.deleteMany({ where: { applicationId: testApp.id } });
        await prisma.interview.deleteMany({ where: { applicationId: testApp.id } });
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
  }, 25000);

  it("1. getTAApplication automatically includes Application -> Job -> MRF -> Client relationship", async () => {
    const app = await getTAApplication(testApp.id);
    expect(app.id).toBe(testApp.id);
    expect(app.jobPosting).toBeDefined();
    expect(app.jobPosting.mrf).toBeDefined();
    expect(app.jobPosting.mrf?.clientId).toBe(testClient.id);
    expect(app.jobPosting.mrf?.client?.name).toBe(testClient.name);
  }, 15000);

  it("2. Rejects scheduling FINAL_INTERVIEW when in INITIAL_SCREENING", async () => {
    await expect(
      scheduleNewInterview(testApp.id, "FINAL_INTERVIEW", new Date().toISOString(), "Premature final")
    ).rejects.toThrow(/Candidate must first complete and pass INITIAL_SCREENING/);
  }, 15000);

  it("3. Rejects recording Client Endorsement before initial screening interview is passed", async () => {
    await expect(
      recordClientEndorsement(testApp.id, testClient.id, "PENDING", testTA.id)
    ).rejects.toThrow(/A passed INITIAL_SCREENING interview is required/);
  }, 15000);

  it("4. Rejects illegal jump to COMPLIANCE when in INITIAL_SCREENING", async () => {
    await expect(
      updateTAApplicationStatus(testApp.id, "COMPLIANCE", testTA.id, "Illegal direct jump")
    ).rejects.toThrow(/Cannot move from INITIAL_SCREENING to COMPLIANCE/);
  }, 15000);

  it("5. Allows scheduling and passing INITIAL_SCREENING interview", async () => {
    const interview = await scheduleNewInterview(
      testApp.id,
      "INITIAL_SCREENING",
      new Date().toISOString(),
      "Technical screening call"
    );
    expect(interview.type).toBe("INITIAL_SCREENING");
    expect(interview.result).toBe("PENDING");

    const { updatedInterview } = await updateInterviewResult(testApp.id, interview.id, "PASS");
    expect(updatedInterview.result).toBe("PASS");
  }, 15000);

  it("6. Auto-resolves clientId from MRF when recording Client Endorsement without explicit clientId", async () => {
    // Note: clientId argument is omitted (undefined)
    const endorsement = await recordClientEndorsement(
      testApp.id,
      undefined,
      "PENDING",
      testTA.id,
      "Candidate submitted to client"
    );

    expect(endorsement).toBeDefined();
    expect(endorsement.clientId).toBe(testClient.id);
    expect(endorsement.client?.name).toBe(testClient.name);
    expect(endorsement.outcome).toBe("PENDING");

    // Application is now automatically in CLIENT_ENDORSEMENT stage
    const updatedApp = await prisma.application.findUnique({ where: { id: testApp.id } });
    expect(updatedApp?.status).toBe("CLIENT_ENDORSEMENT");
  }, 15000);

  it("7. Allows transitioning CLIENT_ENDORSEMENT -> FINAL_INTERVIEW after positive endorsement", async () => {
    await prisma.clientEndorsement.updateMany({
      where: { applicationId: testApp.id },
      data: { outcome: "APPROVED" },
    });
    const updated = await updateTAApplicationStatus(testApp.id, "FINAL_INTERVIEW", testTA.id);
    expect(updated.status).toBe("FINAL_INTERVIEW");
  }, 15000);

  it("8. Rejects scheduling INITIAL_SCREENING when in FINAL_INTERVIEW stage", async () => {
    await expect(
      scheduleNewInterview(testApp.id, "INITIAL_SCREENING", new Date().toISOString(), "Outdated screening")
    ).rejects.toThrow(/Cannot schedule INITIAL_SCREENING interview for application currently in FINAL_INTERVIEW stage/);
  }, 15000);

  it("9. Rejects moving to COMPLIANCE before passing FINAL_INTERVIEW", async () => {
    await expect(
      updateTAApplicationStatus(testApp.id, "COMPLIANCE", testTA.id, "Premature compliance without interview")
    ).rejects.toThrow(/Client final evaluation result must be PASS/);
  }, 15000);

  it("10. Allows scheduling and passing FINAL_INTERVIEW and advances to COMPLIANCE", async () => {
    const finalInt = await scheduleNewInterview(
      testApp.id,
      "FINAL_INTERVIEW",
      new Date().toISOString(),
      "Final interview with client VP"
    );
    expect(finalInt.type).toBe("FINAL_INTERVIEW");

    await updateInterviewResult(testApp.id, finalInt.id, "PASS");

    // Advance to COMPLIANCE (auto-provisions employee)
    const application = await updateTAApplicationStatus(
      testApp.id,
      "COMPLIANCE",
      testTA.id,
      "Candidate successfully passed final interview"
    );

    expect(application.status).toBe("COMPLIANCE");
    const employee = await prisma.employee.findUnique({ where: { userId: testUser.id } });
    expect(employee?.status).toBe("ACTIVE");
    expect(employee?.employeeNumber).toBeDefined();
  }, 20000);

  it("11. Rejects scheduling any interview when in COMPLIANCE stage", async () => {
    await expect(
      scheduleNewInterview(testApp.id, "INITIAL_SCREENING", new Date().toISOString())
    ).rejects.toThrow(/Cannot schedule interview for application in COMPLIANCE stage/);

    await expect(
      scheduleNewInterview(testApp.id, "FINAL_INTERVIEW", new Date().toISOString())
    ).rejects.toThrow(/Cannot schedule interview for application in COMPLIANCE stage/);
  }, 15000);

  it("12. Rejects recording Client Endorsement when in COMPLIANCE stage", async () => {
    await expect(
      recordClientEndorsement(testApp.id, testClient.id, "PENDING", testTA.id)
    ).rejects.toThrow(/Cannot record client endorsement for application in COMPLIANCE stage/);
  }, 15000);

  it("13. Handles direct progression from INITIAL_SCREENING to FINAL_INTERVIEW skipping endorsement", async () => {
    const ts13 = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const candidate13 = await prisma.user.create({
      data: {
        id: `cand-skip-${ts13}`,
        email: `candidate-skip-${ts13}@test.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Marco",
            lastName: "Diaz",
            mobileNumber: "09170003344",
          },
        },
      },
    });

    const freshApp = await prisma.application.create({
      data: {
        userId: candidate13.id,
        jobPostingId: testJob.id,
        status: "INITIAL_SCREENING",
      },
    });

    try {
      // 1. Direct jump from INITIAL_SCREENING to COMPLIANCE is still strictly rejected
      await expect(
        updateTAApplicationStatus(freshApp.id, "COMPLIANCE", testTA.id)
      ).rejects.toThrow(/Cannot move from INITIAL_SCREENING to COMPLIANCE/);

      // 2. Transition from INITIAL_SCREENING to FINAL_INTERVIEW without passed screening interview is rejected
      await expect(
        updateTAApplicationStatus(freshApp.id, "FINAL_INTERVIEW", testTA.id)
      ).rejects.toThrow(/Cannot move to FINAL_INTERVIEW. A passed INITIAL_SCREENING interview is required/);

      // 3. Schedule and pass initial screening interview
      const screening = await scheduleNewInterview(
        freshApp.id,
        "INITIAL_SCREENING",
        new Date().toISOString(),
        "Direct track initial screening"
      );
      await updateInterviewResult(freshApp.id, screening.id, "PASS");

      // Verify no ClientEndorsement exists
      const endorsementsBefore = await prisma.clientEndorsement.findMany({
        where: { applicationId: freshApp.id },
      });
      expect(endorsementsBefore.length).toBe(0);

      // 4. Candidate CAN transition directly to FINAL_INTERVIEW without recording a ClientEndorsement
      const advanced = await updateTAApplicationStatus(freshApp.id, "FINAL_INTERVIEW", testTA.id);
      expect(advanced.status).toBe("FINAL_INTERVIEW");

      // Verify still no ClientEndorsement exists
      const endorsementsAfter = await prisma.clientEndorsement.findMany({
        where: { applicationId: freshApp.id },
      });
      expect(endorsementsAfter.length).toBe(0);
    } finally {
      try {
        await prisma.interview.deleteMany({ where: { applicationId: freshApp.id } });
        await prisma.recruiterDecision.deleteMany({ where: { applicationId: freshApp.id } });
        await prisma.application.deleteMany({ where: { id: freshApp.id } });
        await prisma.notification.deleteMany({ where: { userId: candidate13.id } });
        await prisma.applicantProfile.deleteMany({ where: { userId: candidate13.id } });
        await prisma.user.deleteMany({ where: { id: candidate13.id } });
      } catch {
        // Best-effort cleanup
      }
    }
  }, 20000);

  it("14. Allows recording direct client final evaluation and advances to COMPLIANCE", async () => {
    const ts14 = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const candidate14 = await prisma.user.create({
      data: {
        id: `cand-direct-${ts14}`,
        email: `candidate-direct-${ts14}@test.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Carla",
            lastName: "Santos",
            mobileNumber: "09170001122",
          },
        },
      },
    });

    const clientApp = await prisma.application.create({
      data: {
        userId: candidate14.id,
        jobPostingId: testJob.id,
        status: "FINAL_INTERVIEW",
      },
    });

    try {
      // Record direct client evaluation result PASS without prior scheduled interview
      const { recordDirectInterviewResult } = await import("../services/ta/ta.interviews.service.js");
      const { updatedInterview } = await recordDirectInterviewResult(
        clientApp.id,
        "FINAL_INTERVIEW",
        "PASS",
        new Date().toISOString(),
        "Client accepted candidate via offline evaluation",
        testTA.id
      );

      expect(updatedInterview.result).toBe("PASS");
      expect(updatedInterview.type).toBe("FINAL_INTERVIEW");

      // Advance directly to COMPLIANCE
      const complianceApp = await updateTAApplicationStatus(clientApp.id, "COMPLIANCE", testTA.id, "Client accepted candidate");
      expect(complianceApp.status).toBe("COMPLIANCE");
    } finally {
      // Cleanup
      try {
        await prisma.deploymentStatusHistory.deleteMany({ where: { deployment: { applicationId: clientApp.id } } });
        await prisma.deployment.deleteMany({ where: { applicationId: clientApp.id } });
        await prisma.employmentEvent.deleteMany({ where: { employee: { userId: candidate14.id } } });
        await prisma.employee.deleteMany({ where: { userId: candidate14.id } });
        await prisma.complianceRequirement.deleteMany({ where: { applicationId: clientApp.id } });
        await prisma.interview.deleteMany({ where: { applicationId: clientApp.id } });
        await prisma.recruiterDecision.deleteMany({ where: { applicationId: clientApp.id } });
        await prisma.application.deleteMany({ where: { id: clientApp.id } });
        await prisma.notification.deleteMany({ where: { userId: candidate14.id } });
        await prisma.applicantProfile.deleteMany({ where: { userId: candidate14.id } });
        await prisma.user.deleteMany({ where: { id: candidate14.id } });
      } catch {
        // Best-effort cleanup
      }
    }
  }, 15000);

  it("15. Allows scheduling FINAL_INTERVIEW directly from INITIAL_SCREENING when passed, but rejects if endorsement was declined", async () => {
    const ts15 = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const candidate15 = await prisma.user.create({
      data: {
        id: `cand-direct-sched-${ts15}`,
        email: `candidate-direct-sched-${ts15}@test.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Sofia",
            lastName: "Cruz",
            mobileNumber: "09170005566",
          },
        },
      },
    });

    const directApp = await prisma.application.create({
      data: {
        userId: candidate15.id,
        jobPostingId: testJob.id,
        status: "INITIAL_SCREENING",
      },
    });

    try {
      // 1. Pass initial screening
      const screening = await scheduleNewInterview(
        directApp.id,
        "INITIAL_SCREENING",
        new Date().toISOString(),
        "Initial screening for direct final interview"
      );
      await updateInterviewResult(directApp.id, screening.id, "PASS");

      // App is still in INITIAL_SCREENING
      const currentApp = await prisma.application.findUnique({ where: { id: directApp.id } });
      expect(currentApp?.status).toBe("INITIAL_SCREENING");

      // 2. Schedule FINAL_INTERVIEW directly from INITIAL_SCREENING (skipping client endorsement)
      const finalInterview = await scheduleNewInterview(
        directApp.id,
        "FINAL_INTERVIEW",
        new Date().toISOString(),
        "Direct final interview scheduled"
      );
      expect(finalInterview.type).toBe("FINAL_INTERVIEW");
      expect(finalInterview.result).toBe("PENDING");

      // Status automatically advanced to FINAL_INTERVIEW
      const advancedApp = await prisma.application.findUnique({ where: { id: directApp.id } });
      expect(advancedApp?.status).toBe("FINAL_INTERVIEW");

      // 3. Test declined endorsement gating on a second application
      const candidate15b = await prisma.user.create({
        data: {
          id: `cand-declined-${ts15}`,
          email: `candidate-declined-${ts15}@test.com`,
          role: "APPLICANT",
          applicantProfile: {
            create: {
              firstName: "Mateo",
              lastName: "Reyes",
              mobileNumber: "09170007788",
            },
          },
        },
      });

      const declinedApp = await prisma.application.create({
        data: {
          userId: candidate15b.id,
          jobPostingId: testJob.id,
          status: "INITIAL_SCREENING",
        },
      });

      const screening2 = await scheduleNewInterview(
        declinedApp.id,
        "INITIAL_SCREENING",
        new Date().toISOString(),
        "Initial screening for declined test"
      );
      await updateInterviewResult(declinedApp.id, screening2.id, "PASS");

      // Record a DECLINED endorsement
      await prisma.clientEndorsement.create({
        data: {
          applicationId: declinedApp.id,
          clientId: testClient.id,
          outcome: "DECLINED",
          endorsedById: testTA.id,
        },
      });

      await expect(
        scheduleNewInterview(declinedApp.id, "FINAL_INTERVIEW", new Date().toISOString())
      ).rejects.toThrow(/Cannot schedule FINAL_INTERVIEW. Client endorsement was declined/);

      await prisma.clientEndorsement.deleteMany({ where: { applicationId: declinedApp.id } });
      await prisma.interview.deleteMany({ where: { applicationId: declinedApp.id } });
      await prisma.application.deleteMany({ where: { id: declinedApp.id } });
      await prisma.notification.deleteMany({ where: { userId: candidate15b.id } });
      await prisma.applicantProfile.deleteMany({ where: { userId: candidate15b.id } });
      await prisma.user.deleteMany({ where: { id: candidate15b.id } });
    } finally {
      try {
        await prisma.clientEndorsement.deleteMany({ where: { applicationId: directApp.id } });
        await prisma.interview.deleteMany({ where: { applicationId: directApp.id } });
        await prisma.recruiterDecision.deleteMany({ where: { applicationId: directApp.id } });
        await prisma.application.deleteMany({ where: { id: directApp.id } });
        await prisma.notification.deleteMany({ where: { userId: candidate15.id } });
        await prisma.applicantProfile.deleteMany({ where: { userId: candidate15.id } });
        await prisma.user.deleteMany({ where: { id: candidate15.id } });
      } catch {
        // Best-effort cleanup
      }
    }
  }, 25000);
});
