import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import prisma from "../utils/prisma.js";
import * as mailer from "../utils/mailer.js";
import {
  checkReviewSLABreaches,
  startReviewSLAWorker,
  stopReviewSLAWorker,
} from "../workers/review-sla.worker.js";
import { getTAPendingActions } from "../services/analytics/analytics.service.js";

describe("Per-Client Review SLA Monitoring & Recruiter Alerts (Task 10)", { timeout: 35000 }, () => {
  const ts = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  let recruiterUser: any;
  let secondaryRecruiter: any;
  let applicantUserA: any;
  let applicantUserB: any;
  let applicantUserC: any;

  let clientDefault5Days: any;
  let clientCustom2Days: any;
  let clientCustom10Days: any;

  let mrfDefault: any;
  let mrfCustom2: any;
  let mrfCustom10: any;

  let jobDefault: any;
  let jobCustom2: any;
  let jobCustom10: any;

  let appWithinSLA: any;
  let appBreached: any;
  let appCustom2Breached: any;
  let appCustom10Safe: any;
  let appPriorityFallback: any;

  let endoWithinSLA: any;
  let endoBreached: any;
  let endoCustom2Breached: any;
  let endoCustom10Safe: any;
  let endoPriorityFallback: any;

  beforeAll(async () => {
    // Mock mailer so no external network/SMTP calls occur
    vi.spyOn(mailer, "sendMail").mockResolvedValue(true as any);

    // 1. Create Recruiters & Applicants
    recruiterUser = await prisma.user.create({
      data: {
        id: `ta-sla-recruiter-${ts}`,
        email: `ta-recruiter-${ts}@megs.ph`,
        role: "TALENT_ACQUISITION",
      },
    });

    secondaryRecruiter = await prisma.user.create({
      data: {
        id: `ta-sla-secondary-${ts}`,
        email: `ta-secondary-${ts}@megs.ph`,
        role: "TALENT_ACQUISITION",
      },
    });

    applicantUserA = await prisma.user.create({
      data: {
        id: `applicant-sla-a-${ts}`,
        email: `applicant-a-${ts}@example.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Juan",
            lastName: "Dela Cruz",
          },
        },
      },
      include: { applicantProfile: true },
    });

    applicantUserB = await prisma.user.create({
      data: {
        id: `applicant-sla-b-${ts}`,
        email: `applicant-b-${ts}@example.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Maria",
            lastName: "Clara",
          },
        },
      },
      include: { applicantProfile: true },
    });

    applicantUserC = await prisma.user.create({
      data: {
        id: `applicant-sla-c-${ts}`,
        email: `applicant-c-${ts}@example.com`,
        role: "APPLICANT",
        applicantProfile: {
          create: {
            firstName: "Andres",
            lastName: "Bonifacio",
          },
        },
      },
      include: { applicantProfile: true },
    });

    // 2. Create Clients with different reviewThresholdDays
    clientDefault5Days = await prisma.client.create({
      data: {
        name: `Acme Standard Corp ${ts}`,
        reviewThresholdDays: 5,
      },
    });

    clientCustom2Days = await prisma.client.create({
      data: {
        name: `Express Fast Track Inc ${ts}`,
        reviewThresholdDays: 2,
      },
    });

    clientCustom10Days = await prisma.client.create({
      data: {
        name: `Patience Enterprise Ltd ${ts}`,
        reviewThresholdDays: 10,
      },
    });

    // 3. Create MRFs
    mrfDefault = await prisma.manpowerRequest.create({
      data: {
        title: `MRF Standard ${ts}`,
        clientId: clientDefault5Days.id,
        createdById: recruiterUser.id,
      },
    });

    mrfCustom2 = await prisma.manpowerRequest.create({
      data: {
        title: `MRF Fast ${ts}`,
        clientId: clientCustom2Days.id,
        createdById: recruiterUser.id,
      },
    });

    mrfCustom10 = await prisma.manpowerRequest.create({
      data: {
        title: `MRF Slow ${ts}`,
        clientId: clientCustom10Days.id,
        createdById: recruiterUser.id,
      },
    });

    // 4. Create Job Postings
    jobDefault = await prisma.jobPosting.create({
      data: {
        title: `Senior Tech Specialist ${ts}`,
        description: "Test description",
        requirements: "Test requirements",
        postedById: recruiterUser.id,
        mrfId: mrfDefault.id,
      },
    });

    jobCustom2 = await prisma.jobPosting.create({
      data: {
        title: `Fast Lane Analyst ${ts}`,
        description: "Test description",
        requirements: "Test requirements",
        postedById: recruiterUser.id,
        mrfId: mrfCustom2.id,
      },
    });

    jobCustom10 = await prisma.jobPosting.create({
      data: {
        title: `Slow Track Officer ${ts}`,
        description: "Test description",
        requirements: "Test requirements",
        postedById: recruiterUser.id,
        mrfId: mrfCustom10.id,
      },
    });

    // 5. Create Applications
    appWithinSLA = await prisma.application.create({
      data: {
        userId: applicantUserA.id,
        jobPostingId: jobDefault.id,
        status: "INITIAL_SCREENING",
      },
    });

    appBreached = await prisma.application.create({
      data: {
        userId: applicantUserB.id,
        jobPostingId: jobDefault.id,
        status: "INITIAL_SCREENING",
      },
    });

    appCustom2Breached = await prisma.application.create({
      data: {
        userId: applicantUserC.id,
        jobPostingId: jobCustom2.id,
        status: "INITIAL_SCREENING",
      },
    });

    appCustom10Safe = await prisma.application.create({
      data: {
        userId: applicantUserA.id,
        jobPostingId: jobCustom10.id,
        status: "INITIAL_SCREENING",
      },
    });

    appPriorityFallback = await prisma.application.create({
      data: {
        userId: applicantUserB.id,
        jobPostingId: jobCustom2.id,
        status: "INITIAL_SCREENING",
      },
    });

    // 6. Create Endorsements relative to current time
    const baseNow = Date.now();

    // endoWithinSLA: 2 days old (threshold is 5) -> Safe
    endoWithinSLA = await prisma.clientEndorsement.create({
      data: {
        applicationId: appWithinSLA.id,
        clientId: clientDefault5Days.id,
        outcome: "PENDING",
        endorsedById: recruiterUser.id,
        createdAt: new Date(baseNow - 2 * dayMs),
      },
    });

    // endoBreached: 6 days old (threshold is 5) -> Breached
    endoBreached = await prisma.clientEndorsement.create({
      data: {
        applicationId: appBreached.id,
        clientId: clientDefault5Days.id,
        outcome: "PENDING",
        endorsedById: recruiterUser.id,
        createdAt: new Date(baseNow - 6 * dayMs),
      },
    });

    // endoCustom2Breached: 4 days old (threshold is 2) -> Breached
    endoCustom2Breached = await prisma.clientEndorsement.create({
      data: {
        applicationId: appCustom2Breached.id,
        clientId: clientCustom2Days.id,
        outcome: "PENDING",
        endorsedById: recruiterUser.id,
        createdAt: new Date(baseNow - 4 * dayMs),
      },
    });

    // endoCustom10Safe: 4 days old (threshold is 10) -> Safe
    endoCustom10Safe = await prisma.clientEndorsement.create({
      data: {
        applicationId: appCustom10Safe.id,
        clientId: clientCustom10Days.id,
        outcome: "PENDING",
        endorsedById: recruiterUser.id,
        createdAt: new Date(baseNow - 4 * dayMs),
      },
    });

    // endoPriorityFallback: 4 days old (threshold is 2), endorsedById is null -> should fallback to postedById (recruiterUser)
    endoPriorityFallback = await prisma.clientEndorsement.create({
      data: {
        applicationId: appPriorityFallback.id,
        clientId: clientCustom2Days.id,
        outcome: "PENDING",
        endorsedById: null,
        createdAt: new Date(baseNow - 4 * dayMs),
      },
    });
  });

  afterAll(async () => {
    await stopReviewSLAWorker();
    try {
      const allTestUserIds = [
        recruiterUser?.id,
        secondaryRecruiter?.id,
        applicantUserA?.id,
        applicantUserB?.id,
        applicantUserC?.id,
      ].filter(Boolean);

      // Clean up outbox and notifications
      await prisma.notificationOutbox.deleteMany({
        where: { recipientId: { in: allTestUserIds } },
      });
      await prisma.notification.deleteMany({
        where: { userId: { in: allTestUserIds } },
      });
      await prisma.clientEndorsement.deleteMany({
        where: {
          id: {
            in: [
              endoWithinSLA?.id,
              endoBreached?.id,
              endoCustom2Breached?.id,
              endoCustom10Safe?.id,
              endoPriorityFallback?.id,
            ].filter(Boolean),
          },
        },
      });
      await prisma.application.deleteMany({
        where: {
          id: {
            in: [
              appWithinSLA?.id,
              appBreached?.id,
              appCustom2Breached?.id,
              appCustom10Safe?.id,
              appPriorityFallback?.id,
            ].filter(Boolean),
          },
        },
      });
      await prisma.jobPosting.deleteMany({
        where: {
          id: { in: [jobDefault?.id, jobCustom2?.id, jobCustom10?.id].filter(Boolean) },
        },
      });
      await prisma.manpowerRequest.deleteMany({
        where: {
          id: { in: [mrfDefault?.id, mrfCustom2?.id, mrfCustom10?.id].filter(Boolean) },
        },
      });
      await prisma.client.deleteMany({
        where: {
          id: {
            in: [
              clientDefault5Days?.id,
              clientCustom2Days?.id,
              clientCustom10Days?.id,
            ].filter(Boolean),
          },
        },
      });
      await prisma.applicantProfile.deleteMany({
        where: {
          userId: {
            in: [applicantUserA?.id, applicantUserB?.id, applicantUserC?.id].filter(Boolean),
          },
        },
      });
      await prisma.user.deleteMany({
        where: {
          id: {
            in: [
              recruiterUser?.id,
              secondaryRecruiter?.id,
              applicantUserA?.id,
              applicantUserB?.id,
              applicantUserC?.id,
            ].filter(Boolean),
          },
        },
      });
    } catch (cleanupError) {
      console.warn("Cleanup warning:", cleanupError);
    }
  });

  it("(a) Endorsement within SLA (< threshold days) does not trigger breach or notification", async () => {
    const result = await checkReviewSLABreaches();

    expect(result.scannedCount).toBeGreaterThanOrEqual(1);

    // endoWithinSLA is 2 days old, threshold is 5 days -> NOT breached
    const safeDetail = result.details.find((d) => d.endorsementId === endoWithinSLA.id);
    expect(safeDetail).toBeUndefined();

    // Verify no notification exists for appWithinSLA
    const notif = await prisma.notification.findFirst({
      where: {
        userId: recruiterUser.id,
        link: `/ta/applications/${appWithinSLA.id}`,
      },
    });
    expect(notif).toBeNull();
  });

  it("(b) Endorsement exceeding SLA (>= threshold days) triggers 'WARNING' notification to recruiter and records alert", async () => {
    // Clean any prior test notifications for this application
    await prisma.notification.deleteMany({
      where: { link: `/ta/applications/${appBreached.id}` },
    });

    const result = await checkReviewSLABreaches();

    const breachDetail = result.details.find((d) => d.endorsementId === endoBreached.id);
    expect(breachDetail).toBeDefined();
    expect(breachDetail?.elapsedDays).toBeGreaterThanOrEqual(5);
    expect(breachDetail?.thresholdDays).toBe(5);
    expect(breachDetail?.recruiterId).toBe(recruiterUser.id);
    expect(breachDetail?.notified).toBe(true);

    // Verify DB notification record
    const notif = await prisma.notification.findFirst({
      where: {
        userId: recruiterUser.id,
        link: `/ta/applications/${appBreached.id}`,
        type: "WARNING",
      },
    });

    expect(notif).not.toBeNull();
    expect(notif?.title).toBe(`Client Review SLA Overdue: ${clientDefault5Days.name}`);
    expect(notif?.message).toContain("has exceeded");
    expect(notif?.message).toContain("of 5 days");
    expect(notif?.message).toContain("Please follow up with the client.");
  });

  it("(c) Candidate status and endorsement outcome remain strictly PENDING (NO auto-rejection)", async () => {
    // Run SLA checker
    await checkReviewSLABreaches();

    // Assert application status is still unchanged
    const appInDb = await prisma.application.findUnique({
      where: { id: appBreached.id },
    });
    expect(appInDb?.status).toBe("INITIAL_SCREENING");
    expect(appInDb?.isArchived).toBe(false);

    // Assert endorsement outcome is still PENDING
    const endoInDb = await prisma.clientEndorsement.findUnique({
      where: { id: endoBreached.id },
    });
    expect(endoInDb?.outcome).toBe("PENDING");
  });

  it("(d) Deduplication prevents re-notifying within 24 hours", async () => {
    // Verify 1 notification already exists from test (b)
    const initialCount = await prisma.notification.count({
      where: {
        userId: recruiterUser.id,
        link: `/ta/applications/${appBreached.id}`,
        type: "WARNING",
      },
    });
    expect(initialCount).toBe(1);

    // Run again immediately (within 24 hours window)
    const resultDuplicate = await checkReviewSLABreaches();

    const breachDetail = resultDuplicate.details.find(
      (d) => d.endorsementId === endoBreached.id
    );
    expect(breachDetail).toBeDefined();
    expect(breachDetail?.notified).toBe(false);
    expect(resultDuplicate.skippedDuplicateCount).toBeGreaterThanOrEqual(1);

    // Notification count should NOT have increased
    const afterCount = await prisma.notification.count({
      where: {
        userId: recruiterUser.id,
        link: `/ta/applications/${appBreached.id}`,
        type: "WARNING",
      },
    });
    expect(afterCount).toBe(1);

    // Simulate 25 hours elapsed by backdating the existing notification
    await prisma.notification.updateMany({
      where: {
        userId: recruiterUser.id,
        link: `/ta/applications/${appBreached.id}`,
      },
      data: {
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      },
    });

    // Run SLA checker now that previous notification is older than 24 hours
    const resultAfterWindow = await checkReviewSLABreaches();

    const detailAfterWindow = resultAfterWindow.details.find(
      (d) => d.endorsementId === endoBreached.id
    );
    expect(detailAfterWindow?.notified).toBe(true);

    const finalCount = await prisma.notification.count({
      where: {
        userId: recruiterUser.id,
        link: `/ta/applications/${appBreached.id}`,
        type: "WARNING",
      },
    });
    expect(finalCount).toBe(2);
  });

  it("(e) Custom client reviewThresholdDays (2 days vs 10 days) correctly evaluated per-client", async () => {
    // Clear notifications for these apps
    await prisma.notification.deleteMany({
      where: {
        link: {
          in: [
            `/ta/applications/${appCustom2Breached.id}`,
            `/ta/applications/${appCustom10Safe.id}`,
          ],
        },
      },
    });

    const result = await checkReviewSLABreaches();

    // appCustom2Breached: 4 days old, threshold is 2 days -> BREACHED (4 >= 2)
    const custom2Detail = result.details.find(
      (d) => d.endorsementId === endoCustom2Breached.id
    );
    expect(custom2Detail).toBeDefined();
    expect(custom2Detail?.thresholdDays).toBe(2);
    expect(custom2Detail?.elapsedDays).toBeGreaterThanOrEqual(3);
    expect(custom2Detail?.notified).toBe(true);

    // appCustom10Safe: 4 days old, threshold is 10 days -> SAFE (4 < 10)
    const custom10Detail = result.details.find(
      (d) => d.endorsementId === endoCustom10Safe.id
    );
    expect(custom10Detail).toBeUndefined();
  });

  it("(e.2) Priority resolution: falls back to jobPosting.postedById when endorsedById is null", async () => {
    const result = await checkReviewSLABreaches();

    const fallbackDetail = result.details.find(
      (d) => d.endorsementId === endoPriorityFallback.id
    );
    expect(fallbackDetail).toBeDefined();
    // Falls back to jobCustom2.postedById = recruiterUser.id
    expect(fallbackDetail?.recruiterId).toBe(recruiterUser.id);
  });

  it("(f) getTAPendingActions returns elevated urgency ('HIGH') and SLA overdue indicator", async () => {
    const actions = await getTAPendingActions(recruiterUser.id, {
      mineOnly: false,
    });

    // Check safe action
    const safeAction = actions.find((a) => a.id === `endorsement-${endoWithinSLA.id}`);
    expect(safeAction).toBeDefined();
    expect(safeAction?.urgency).toBe("NORMAL");
    expect(safeAction?.title).toBe(`Awaiting Client Decision (${clientDefault5Days.name})`);

    // Check overdue action
    const overdueAction = actions.find((a) => a.id === `endorsement-${endoBreached.id}`);
    expect(overdueAction).toBeDefined();
    expect(overdueAction?.urgency).toBe("HIGH");
    expect(overdueAction?.title).toContain("Client Review Overdue");
    expect(overdueAction?.title).toContain(clientDefault5Days.name);
    expect(overdueAction?.deadline).toBeDefined();

    // Check custom threshold overdue action
    const custom2Action = actions.find(
      (a) => a.id === `endorsement-${endoCustom2Breached.id}`
    );
    expect(custom2Action).toBeDefined();
    expect(custom2Action?.urgency).toBe("HIGH");
    expect(custom2Action?.title).toContain("Client Review Overdue");
    expect(custom2Action?.title).toContain("2d SLA");
  });

  it("Worker lifecycle: starts and stops without error", async () => {
    expect(() => startReviewSLAWorker(10000)).not.toThrow();
    await expect(stopReviewSLAWorker()).resolves.not.toThrow();
  });
});
