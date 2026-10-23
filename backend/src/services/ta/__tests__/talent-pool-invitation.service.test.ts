import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    applicantProfile: {
      findUnique: vi.fn(),
    },
    jobPosting: {
      findUnique: vi.fn(),
    },
    talentPoolInvitation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    talentPoolMembership: {
      update: vi.fn(),
    },
    talentPoolContact: {
      create: vi.fn(),
    },
    application: {
      create: vi.fn(),
    },
    recruiterDecision: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(mocks.prisma)),
  },
  sendNotification: vi.fn(),
  logAudit: vi.fn(),
  calculateAndPersistCandidateScore: vi.fn(),
}));

vi.mock("../../../utils/prisma.js", () => ({ default: mocks.prisma }));
vi.mock("../../../utils/notification.js", () => ({
  sendNotification: mocks.sendNotification,
}));
vi.mock("../../../utils/audit.js", () => ({
  logAudit: mocks.logAudit,
}));
vi.mock("../../scoring/candidate-scoring.service.js", () => ({
  calculateAndPersistCandidateScore: mocks.calculateAndPersistCandidateScore,
}));

import {
  sendTalentPoolJobInvitation,
  respondToJobInvitation,
  expirePendingInvitationsWorker,
} from "../talent-pool-invitation.service.js";

describe("Talent Pool Invitation Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends an invitation and notifies candidate", async () => {
    mocks.prisma.applicantProfile.findUnique.mockResolvedValueOnce({
      id: 10,
      userId: "cand-user-1",
      firstName: "Maria",
      lastName: "Santos",
      isActive: true,
      resumeUrl: "https://bucket/resume.pdf",
      user: {
        id: "cand-user-1",
        email: "maria@example.com",
        isActive: true,
        applications: [],
      },
      talentPoolMembership: {
        id: 5,
        status: "ACTIVE",
        availability: "AVAILABLE",
        invitations: [],
      },
    });

    mocks.prisma.jobPosting.findUnique.mockResolvedValueOnce({
      id: 3,
      title: "Quality Inspector",
      status: "OPEN",
    });

    mocks.prisma.talentPoolInvitation.findFirst.mockResolvedValueOnce(null);
    mocks.prisma.talentPoolInvitation.count.mockResolvedValueOnce(0);

    mocks.prisma.talentPoolInvitation.create.mockResolvedValueOnce({
      id: 101,
      membershipId: 5,
      jobPostingId: 3,
      invitedById: "recruiter-1",
      status: "PENDING",
      message: "We'd love for you to apply!",
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });

    const res = await sendTalentPoolJobInvitation({
      applicantProfileId: 10,
      targetJobId: 3,
      recruiterId: "recruiter-1",
      message: "We'd love for you to apply!",
      expiresInDays: 7,
    });

    expect(res.id).toBe(101);
    expect(mocks.prisma.talentPoolContact.create).toHaveBeenCalled();
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      "cand-user-1",
      "Job Invitation Received",
      expect.stringContaining("Quality Inspector"),
      "INFO",
      "/app/invitations",
      expect.objectContaining({
        sendEmail: true,
        ctaText: "View Job Opportunity",
      })
    );
  });

  it("blocks invitation if candidate has already been invited twice for the same job", async () => {
    mocks.prisma.applicantProfile.findUnique.mockResolvedValueOnce({
      id: 10,
      userId: "cand-user-1",
      firstName: "Maria",
      lastName: "Santos",
      isActive: true,
      resumeUrl: "https://bucket/resume.pdf",
      user: {
        id: "cand-user-1",
        email: "maria@example.com",
        isActive: true,
        applications: [],
      },
      talentPoolMembership: {
        id: 5,
        status: "ACTIVE",
        availability: "AVAILABLE",
        invitations: [],
      },
    });

    mocks.prisma.jobPosting.findUnique.mockResolvedValueOnce({
      id: 3,
      title: "Quality Inspector",
      status: "OPEN",
    });

    mocks.prisma.talentPoolInvitation.findFirst.mockResolvedValueOnce(null);
    mocks.prisma.talentPoolInvitation.count.mockResolvedValueOnce(2);

    await expect(
      sendTalentPoolJobInvitation({
        applicantProfileId: 10,
        targetJobId: 3,
        recruiterId: "recruiter-1",
      })
    ).rejects.toThrow("This applicant has already been invited twice for this job.");
  });

  it("handles ACCEPT decision by creating Application in SUBMITTED state and notifying recruiter", async () => {
    mocks.prisma.talentPoolInvitation.findUnique.mockResolvedValueOnce({
      id: 101,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 86400000),
      invitedById: "recruiter-1",
      jobPostingId: 3,
      membership: {
        id: 5,
        applicantProfile: {
          id: 10,
          userId: "cand-user-1",
          firstName: "Maria",
          lastName: "Santos",
          resumeUrl: "https://bucket/resume.pdf",
        },
      },
      jobPosting: {
        id: 3,
        title: "Quality Inspector",
      },
    });

    mocks.prisma.application.create.mockResolvedValueOnce({
      id: 50,
      jobPostingId: 3,
      userId: "cand-user-1",
      status: "SUBMITTED",
    });

    mocks.prisma.talentPoolInvitation.updateMany.mockResolvedValueOnce({ count: 1 });
    const res = await respondToJobInvitation({
      actor: { kind: "APPLICANT", userId: "cand-user-1" },
      invitationId: 101,
      decision: "ACCEPT",
      notes: "Ready to start immediately",
    });

    expect(res.success).toBe(true);
    expect(mocks.prisma.application.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jobPostingId: 3,
        userId: "cand-user-1",
        status: "SUBMITTED",
      }),
    });
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      "recruiter-1",
      "Job Invitation Accepted",
      expect.stringContaining("Maria Santos accepted your invitation for Quality Inspector"),
      "SUCCESS",
      "/ta/applications/50"
    );
  });

  it("handles DECLINE decision and updates candidate availability if unavailable/employed", async () => {
    mocks.prisma.talentPoolInvitation.findUnique.mockResolvedValueOnce({
      id: 102,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 86400000),
      invitedById: "recruiter-1",
      jobPostingId: 3,
      membershipId: 5,
      membership: {
        id: 5,
        applicantProfile: {
          id: 10,
          userId: "cand-user-1",
          firstName: "Maria",
          lastName: "Santos",
        },
      },
      jobPosting: {
        id: 3,
        title: "Quality Inspector",
      },
    });

    mocks.prisma.talentPoolInvitation.updateMany.mockResolvedValueOnce({ count: 1 });
    const res = await respondToJobInvitation({
      actor: { kind: "APPLICANT", userId: "cand-user-1" },
      invitationId: 102,
      decision: "DECLINE",
      declineReason: "UNAVAILABLE_EMPLOYED",
      notes: "Accepted another role",
    });

    expect(res.success).toBe(true);
    expect(mocks.prisma.talentPoolMembership.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { availability: "UNAVAILABLE" },
    });
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      "recruiter-1",
      "Job Invitation Declined",
      expect.stringContaining("Maria Santos declined invitation for Quality Inspector"),
      "WARNING",
      "/ta/jobs/3"
    );
  });

  it("expires overdue pending invitations in background worker", async () => {
    mocks.prisma.talentPoolInvitation.findMany.mockResolvedValueOnce([
      { id: 201, membershipId: 10 },
      { id: 202, membershipId: 11 },
    ]);

    mocks.prisma.talentPoolInvitation.updateMany.mockResolvedValueOnce({ count: 2 });
    mocks.prisma.talentPoolInvitation.count.mockResolvedValue(2); // 2 expired invitations

    const result = await expirePendingInvitationsWorker();

    expect(result.expiredCount).toBe(2);
    expect(mocks.prisma.talentPoolInvitation.updateMany).toHaveBeenCalledWith({
      where: {
        status: "PENDING",
        expiresAt: { lt: expect.any(Date) },
      },
      data: { status: "EXPIRED" },
    });
  });
});
