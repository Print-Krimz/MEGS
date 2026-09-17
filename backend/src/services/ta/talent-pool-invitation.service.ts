import prisma from "../../utils/prisma.js";
import { sendNotification } from "../../utils/notification.js";
import { logAudit } from "../../utils/audit.js";
import { calculateAndPersistCandidateScore } from "../scoring/candidate-scoring.service.js";
import { InvalidKnnRequestError } from "../scoring/talent-pool-knn.service.js";

export interface SendInvitationInput {
  applicantProfileId: number;
  targetJobId: number;
  recruiterId: string;
  message?: string;
  expiresInDays?: number;
}

export interface BatchSendInvitationsInput {
  applicantProfileIds: number[];
  targetJobId: number;
  recruiterId: string;
  message?: string;
  expiresInDays?: number;
}

export interface RespondInvitationInput {
  userId: string;
  invitationId: number;
  decision: "ACCEPT" | "DECLINE";
  declineReason?: "SALARY_MISMATCH" | "UNAVAILABLE_EMPLOYED" | "LOCATION_COMMUTE" | "NOT_INTERESTED" | "OTHER";
  notes?: string;
}

export interface ListInvitationsQuery {
  status?: string;
  jobPostingId?: number;
  page?: number;
  limit?: number;
  recruiterId?: string;
}

export const sendTalentPoolJobInvitation = async (input: SendInvitationInput) => {
  const { applicantProfileId, targetJobId, recruiterId, message, expiresInDays = 7 } = input;

  const profile = await prisma.applicantProfile.findUnique({
    where: { id: applicantProfileId },
    include: {
      user: {
        include: {
          applications: {
            where: { isArchived: false },
          },
        },
      },
      talentPoolMembership: true,
    },
  });

  if (!profile) {
    throw new InvalidKnnRequestError("Candidate profile not found");
  }

  if (!profile.talentPoolMembership || profile.talentPoolMembership.status !== "ACTIVE") {
    throw new InvalidKnnRequestError("Candidate is not an active member of the Talent Pool.");
  }

  if (profile.talentPoolMembership.availability === "UNAVAILABLE") {
    throw new InvalidKnnRequestError("Candidate availability is currently marked as UNAVAILABLE.");
  }

  const job = await prisma.jobPosting.findUnique({
    where: { id: targetJobId },
  });

  if (!job) {
    throw new InvalidKnnRequestError("Target job requisition not found");
  }

  if (job.status === "CLOSED") {
    throw new InvalidKnnRequestError("Target job requisition is closed.");
  }

  const existingApp = profile.user.applications.find((app) => app.jobPostingId === targetJobId);
  if (existingApp) {
    throw new InvalidKnnRequestError(`Candidate already has an active application (#${existingApp.id}) for this job.`);
  }

  const existingPending = await prisma.talentPoolInvitation.findFirst({
    where: {
      membershipId: profile.talentPoolMembership.id,
      jobPostingId: targetJobId,
      status: "PENDING",
    },
  });

  if (existingPending) {
    throw new InvalidKnnRequestError("An active pending invitation for this requisition already exists for this candidate.");
  }

  const previousInvitationCount = await prisma.talentPoolInvitation.count({
    where: {
      membershipId: profile.talentPoolMembership.id,
      jobPostingId: targetJobId,
    },
  });

  if (previousInvitationCount >= 2) {
    throw new InvalidKnnRequestError("This applicant has already been invited twice for this job.");
  }

  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  const invitation = await prisma.$transaction(async (tx) => {
    const inv = await tx.talentPoolInvitation.create({
      data: {
        membershipId: profile.talentPoolMembership!.id,
        jobPostingId: targetJobId,
        invitedById: recruiterId,
        status: "PENDING",
        message: message || null,
        expiresAt,
      },
    });

    await tx.talentPoolContact.create({
      data: {
        membershipId: profile.talentPoolMembership!.id,
        jobPostingId: targetJobId,
        recruiterId,
        outcome: "INTERESTED",
        notes: message ? `Job invitation sent for ${job.title}: ${message}` : `Job invitation sent for ${job.title}`,
      },
    });

    await tx.talentPoolMembership.update({
      where: { id: profile.talentPoolMembership!.id },
      data: { lastContactedAt: new Date() },
    });

    return inv;
  });

  // Notify applicant in real-time
  void sendNotification(
    profile.userId,
    "Job Invitation Received",
    `You've been invited to apply for ${job.title}! Review requirements and respond.`,
    "INFO",
    "/app/invitations"
  );

  void logAudit(recruiterId, "TALENT_POOL_INVITATION_SENT", "JobPosting", targetJobId, {
    invitationId: invitation.id,
    applicantProfileId,
    targetJobId,
    expiresAt,
  });

  return invitation;
};

export const batchSendTalentPoolJobInvitations = async (input: BatchSendInvitationsInput) => {
  const { applicantProfileIds, targetJobId, recruiterId, message, expiresInDays = 7 } = input;
  const results: Array<{ applicantProfileId: number; success: boolean; invitationId?: number; error?: string }> = [];

  for (const applicantProfileId of applicantProfileIds) {
    try {
      const inv = await sendTalentPoolJobInvitation({
        applicantProfileId,
        targetJobId,
        recruiterId,
        message,
        expiresInDays,
      });
      results.push({ applicantProfileId, success: true, invitationId: inv.id });
    } catch (err: any) {
      results.push({ applicantProfileId, success: false, error: err.message });
    }
  }

  const sentCount = results.filter((r) => r.success).length;
  const failedCount = results.length - sentCount;

  return {
    sentCount,
    failedCount,
    results,
  };
};

export const listOutgoingInvitations = async (options: ListInvitationsQuery = {}) => {
  const { status = "ALL", jobPostingId, page = 1, limit = 10, recruiterId } = options;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status && status !== "ALL") {
    where.status = status;
  }
  if (jobPostingId) {
    where.jobPostingId = jobPostingId;
  }
  if (recruiterId) {
    where.invitedById = recruiterId;
  }

  const [items, total] = await Promise.all([
    prisma.talentPoolInvitation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        jobPosting: {
          select: { id: true, title: true, location: true, status: true },
        },
        membership: {
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
        },
        invitedBy: {
          select: { id: true, email: true },
        },
      },
    }),
    prisma.talentPoolInvitation.count({ where }),
  ]);

  return {
    items: items.map((inv) => ({
      id: inv.id,
      membershipId: inv.membershipId,
      jobPostingId: inv.jobPostingId,
      jobPostingTitle: inv.jobPosting?.title || "Untitled Job",
      jobPostingLocation: inv.jobPosting?.location || null,
      jobPostingStatus: inv.jobPosting?.status || "OPEN",
      candidateId: inv.membership?.applicantProfile?.user?.id || "",
      applicantProfileId: inv.membership?.applicantProfile?.id || 0,
      candidateName: inv.membership?.applicantProfile
        ? `${inv.membership.applicantProfile.firstName || ""} ${inv.membership.applicantProfile.lastName || ""}`.trim() || "Candidate"
        : "Candidate",
      candidateEmail: inv.membership?.applicantProfile?.user?.email || "No email",
      status: inv.status,
      message: inv.message,
      declineReason: inv.declineReason,
      responseNotes: inv.responseNotes,
      expiresAt: inv.expiresAt,
      respondedAt: inv.respondedAt,
      createdAt: inv.createdAt,
      invitedBy: inv.invitedBy?.email || "Recruiter",
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
};

export const cancelTalentPoolInvitation = async (invitationId: number, recruiterId: string) => {
  const invitation = await prisma.talentPoolInvitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation) {
    throw new InvalidKnnRequestError("Invitation not found");
  }

  if (invitation.status !== "PENDING") {
    throw new InvalidKnnRequestError(`Cannot cancel an invitation with status ${invitation.status}`);
  }

  const updated = await prisma.talentPoolInvitation.update({
    where: { id: invitationId },
    data: { status: "CANCELLED" },
  });

  void logAudit(recruiterId, "TALENT_POOL_INVITATION_CANCELLED", "JobPosting", invitation.jobPostingId, {
    invitationId,
  });

  return updated;
};

export const getMyJobInvitations = async (userId: string) => {
  const profile = await prisma.applicantProfile.findUnique({
    where: { userId },
    include: { talentPoolMembership: true },
  });

  if (!profile || !profile.talentPoolMembership) {
    return [];
  }

  const invitations = await prisma.talentPoolInvitation.findMany({
    where: {
      membershipId: profile.talentPoolMembership.id,
    },
    orderBy: { createdAt: "desc" },
    include: {
      jobPosting: {
        select: {
          id: true,
          title: true,
          location: true,
          description: true,
          requirements: true,
          imageUrl: true,
          status: true,
        },
      },
      invitedBy: {
        select: { id: true, email: true },
      },
    },
  });

  return invitations.map((inv) => ({
    id: inv.id,
    jobPostingId: inv.jobPostingId,
    title: inv.jobPosting?.title || "Untitled Job",
    location: inv.jobPosting?.location || null,
    description: inv.jobPosting?.description || "",
    requirements: inv.jobPosting?.requirements || "",
    imageUrl: inv.jobPosting?.imageUrl || null,
    jobStatus: inv.jobPosting?.status || "OPEN",
    status: inv.status,
    message: inv.message,
    declineReason: inv.declineReason,
    expiresAt: inv.expiresAt,
    respondedAt: inv.respondedAt,
    createdAt: inv.createdAt,
    invitedBy: inv.invitedBy?.email || "Talent Acquisition",
  }));
};

export const respondToJobInvitation = async (input: RespondInvitationInput) => {
  const { userId, invitationId, decision, declineReason, notes } = input;

  const invitation = await prisma.talentPoolInvitation.findUnique({
    where: { id: invitationId },
    include: {
      membership: {
        include: {
          applicantProfile: {
            select: { id: true, userId: true, firstName: true, lastName: true, resumeUrl: true },
          },
        },
      },
      jobPosting: { select: { id: true, title: true } },
    },
  });

  if (!invitation) {
    throw new InvalidKnnRequestError("Invitation not found");
  }

  if (invitation.membership.applicantProfile.userId !== userId) {
    throw new InvalidKnnRequestError("Unauthorized to respond to this invitation.");
  }

  if (invitation.status !== "PENDING") {
    throw new InvalidKnnRequestError(`Invitation is no longer pending (current status: ${invitation.status}).`);
  }

  if (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now()) {
    await prisma.talentPoolInvitation.update({
      where: { id: invitationId },
      data: { status: "EXPIRED" },
    });
    throw new InvalidKnnRequestError("This job invitation has expired.");
  }

  const candidateName = `${invitation.membership.applicantProfile.firstName} ${invitation.membership.applicantProfile.lastName}`;

  if (decision === "ACCEPT") {
    const result = await prisma.$transaction(async (tx) => {
      const updatedInv = await tx.talentPoolInvitation.update({
        where: { id: invitationId },
        data: {
          status: "ACCEPTED",
          responseNotes: notes || null,
          respondedAt: new Date(),
        },
      });

      const newApplication = await tx.application.create({
        data: {
          userId,
          jobPostingId: invitation.jobPostingId,
          status: "SUBMITTED",
          resumeUrl: invitation.membership.applicantProfile.resumeUrl,
        },
      });

      await tx.recruiterDecision.create({
        data: {
          applicationId: newApplication.id,
          actorId: invitation.invitedById,
          fromStatus: "TALENT_POOL",
          toStatus: "SUBMITTED",
          reason: `Candidate accepted talent pool job invitation #${invitationId}`,
        },
      });

      await tx.talentPoolContact.create({
        data: {
          membershipId: invitation.membershipId,
          jobPostingId: invitation.jobPostingId,
          recruiterId: invitation.invitedById,
          outcome: "INTERESTED",
          notes: notes ? `Invitation accepted: ${notes}` : "Candidate accepted invitation and applied",
        },
      });

      return { invitation: updatedInv, application: newApplication };
    });

    try {
      await calculateAndPersistCandidateScore(result.application.id, invitation.jobPostingId);
    } catch {
      // Non-blocking scoring calculation
    }

    void sendNotification(
      invitation.invitedById,
      "Job Invitation Accepted",
      `${candidateName} accepted your invitation for ${invitation.jobPosting.title}! Application #${result.application.id} created.`,
      "SUCCESS",
      `/ta/applications/${result.application.id}`
    );

    void logAudit(userId, "TALENT_POOL_INVITATION_ACCEPTED", "Application", result.application.id, {
      invitationId,
      jobPostingId: invitation.jobPostingId,
    });

    return {
      success: true,
      message: "Job invitation accepted successfully. Application submitted!",
      application: result.application,
      invitation: result.invitation,
    };
  } else {
    // Decline
    const updatedInv = await prisma.$transaction(async (tx) => {
      const inv = await tx.talentPoolInvitation.update({
        where: { id: invitationId },
        data: {
          status: "DECLINED",
          declineReason: declineReason || "NOT_INTERESTED",
          responseNotes: notes || null,
          respondedAt: new Date(),
        },
      });

      if (declineReason === "UNAVAILABLE_EMPLOYED") {
        await tx.talentPoolMembership.update({
          where: { id: invitation.membershipId },
          data: { availability: "UNAVAILABLE" },
        });
      }

      await tx.talentPoolContact.create({
        data: {
          membershipId: invitation.membershipId,
          jobPostingId: invitation.jobPostingId,
          recruiterId: invitation.invitedById,
          outcome: declineReason === "UNAVAILABLE_EMPLOYED" ? "UNAVAILABLE" : "NOT_INTERESTED",
          notes: notes ? `Invitation declined (${declineReason}): ${notes}` : `Invitation declined (${declineReason})`,
        },
      });

      return inv;
    });

    void sendNotification(
      invitation.invitedById,
      "Job Invitation Declined",
      `${candidateName} declined invitation for ${invitation.jobPosting.title} (${declineReason || "Not Interested"}).`,
      "WARNING",
      `/ta/jobs/${invitation.jobPostingId}`
    );

    void logAudit(userId, "TALENT_POOL_INVITATION_DECLINED", "JobPosting", invitation.jobPostingId, {
      invitationId,
      declineReason,
      notes,
    });

    return {
      success: true,
      message: "Job invitation declined.",
      invitation: updatedInv,
    };
  }
};

export const expirePendingInvitationsWorker = async () => {
  const now = new Date();
  const overdue = await prisma.talentPoolInvitation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
    select: { id: true, membershipId: true },
  });

  if (overdue.length === 0) {
    return { expiredCount: 0 };
  }

  const { count } = await prisma.talentPoolInvitation.updateMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });

  // Check affected memberships for inactive pruning (e.g. >= 2 expired in last 60 days)
  const uniqueMembershipIds = Array.from(new Set(overdue.map((o) => o.membershipId)));
  for (const membershipId of uniqueMembershipIds) {
    const expiredCount = await prisma.talentPoolInvitation.count({
      where: {
        membershipId,
        status: "EXPIRED",
        createdAt: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
      },
    });

    if (expiredCount >= 2) {
      await prisma.talentPoolMembership.update({
        where: { id: membershipId },
        data: { availability: "UNKNOWN" },
      });
    }
  }

  return { expiredCount: count };
};
