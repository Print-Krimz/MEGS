import { createHash, randomBytes, timingSafeEqual } from "crypto";
import prisma from "../../utils/prisma.js";
import { displayEmail } from "../../utils/display-email.js";
import { maskPhoneNumber, sendSmsViaTextBee } from "../../utils/sms.js";
import { assertOwns, JOB_OWNER_SELECT, type JobOwnerFields } from "./ownership.js";
import { buildTrackingCode, generateTrackingToken } from "./walk-in-tokens.js";
import { sendNotification } from "../../utils/notification.js";
import { logAudit } from "../../utils/audit.js";
import { calculateAndPersistCandidateScore } from "../scoring/candidate-scoring.service.js";
import { InvalidKnnRequestError } from "../scoring/talent-pool-knn.service.js";
import { publicErrorMessage } from "../../security/errors.js";

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

export type InvitationActor =
  | { kind: "APPLICANT"; userId: string }
  | { kind: "ASSISTED"; taId: string; channel: "ASSISTED_PHONE" | "IN_PERSON" }
  | { kind: "MAGIC_LINK" };

export type DeclineReason = "SALARY_MISMATCH" | "UNAVAILABLE_EMPLOYED" | "LOCATION_COMMUTE" | "NOT_INTERESTED" | "OTHER";

/** Carries an HTTP status so controllers can answer 404, 409 or 502 without string matching. */
export class InvitationActionError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "InvitationActionError";
  }
}

export interface RespondInvitationInput {
  actor: InvitationActor;
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
          employee: {
            include: { deployments: true },
          },
        },
      },
      talentPoolMembership: true,
    },
  });

  if (!profile) {
    throw new InvalidKnnRequestError("Candidate profile not found");
  }

  const isTalentPoolMember = profile.talentPoolMembership?.status === "ACTIVE";
  const isRedeploymentEligible = Boolean(
    profile.user.employee &&
    (profile.user.employee.status === "AVAILABLE_FOR_REDEPLOYMENT" ||
     profile.user.employee.deployments.length > 0)
  );

  if (!isTalentPoolMember && !isRedeploymentEligible) {
    throw new InvalidKnnRequestError("Candidate is neither an active member of the Talent Pool nor eligible for redeployment.");
  }

  if (isTalentPoolMember && profile.talentPoolMembership?.availability === "UNAVAILABLE") {
    throw new InvalidKnnRequestError("Candidate availability is currently marked as UNAVAILABLE.");
  }

  // For non-redeployment candidates, verify no active deployment.
  // Redeployment candidates may be offered upcoming placements.
  if (!isRedeploymentEligible && prisma.deployment) {
    const activeDeployment = await prisma.deployment.findFirst({
      where: { employee: { userId: profile.userId }, status: { notIn: ["ENDED", "CANCELLED"] } },
      select: { id: true },
    });
    if (activeDeployment) throw new InvalidKnnRequestError("This candidate already has a scheduled or active client assignment.");
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
  if (existingApp && !["BACKOUT", "ARCHIVED", "REJECTED", "DEPLOYED"].includes(existingApp.status)) {
    throw new InvalidKnnRequestError(`Candidate already has an active application (#${existingApp.id}) for this job.`);
  }

  const existingPending = await prisma.talentPoolInvitation.findFirst({
    where: {
      applicantProfileId: profile.id,
      jobPostingId: targetJobId,
      status: "PENDING",
    },
  });

  if (existingPending) {
    throw new InvalidKnnRequestError("An active pending invitation for this requisition already exists for this candidate.");
  }

  const previousInvitationCount = await prisma.talentPoolInvitation.count({
    where: {
      applicantProfileId: profile.id,
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
        applicantProfileId: profile.id,
        membershipId: profile.talentPoolMembership?.id ?? null,
        jobPostingId: targetJobId,
        invitedById: recruiterId,
        status: "PENDING",
        message: message || null,
        expiresAt,
      },
    });

    if (profile.talentPoolMembership) {
      await tx.talentPoolContact.create({
        data: {
          membershipId: profile.talentPoolMembership.id,
          jobPostingId: targetJobId,
          recruiterId,
          outcome: "INTERESTED",
          notes: message ? `Job invitation sent for ${job.title}: ${message}` : `Job invitation sent for ${job.title}`,
        },
      });

      await tx.talentPoolMembership.update({
        where: { id: profile.talentPoolMembership.id },
        data: { lastContactedAt: new Date() },
      });
    }

    return inv;
  });

  // Notify applicant in real-time
  void sendNotification(
    profile.userId,
    "Job Invitation Received",
    `You've been invited to apply for ${job.title}! Review requirements and respond.`,
    "INFO",
    "/app/invitations",
    {
      sendEmail: true,
      ctaText: "View Job Opportunity",
      sms: { text: `You have a new job invitation for ${job.title || "a role"}. Log in to MEGS to reply.` },
    }
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
      results.push({ applicantProfileId, success: false, error: publicErrorMessage(err.message, 400) });
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
        applicantProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mobileNumber: true,
            user: { select: { id: true, email: true, accountStatus: true, phoneNumber: true } },
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
      candidateId: inv.applicantProfile?.user?.id || "",
      applicantProfileId: inv.applicantProfileId,
      candidateName: inv.applicantProfile
        ? `${inv.applicantProfile.firstName || ""} ${inv.applicantProfile.lastName || ""}`.trim() || "Candidate"
        : "Candidate",
      candidateEmail: displayEmail(inv.applicantProfile?.user?.email) || "No email",
      hasPortalAccess: inv.applicantProfile?.user?.accountStatus === "ACTIVE",
      hasMobile: Boolean(inv.applicantProfile?.user?.phoneNumber || inv.applicantProfile?.mobileNumber),
      responseChannel: inv.responseChannel,
      maskedMobile: (() => {
        const mobile = inv.applicantProfile?.user?.phoneNumber || inv.applicantProfile?.mobileNumber;
        return mobile ? maskPhoneNumber(mobile) : null;
      })(),
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

  if (!invitation || invitation.invitedById !== recruiterId) {
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
  });

  if (!profile) {
    return [];
  }

  const invitations = await prisma.talentPoolInvitation.findMany({
    where: {
      applicantProfileId: profile.id,
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
  const { actor, invitationId, decision, declineReason, notes } = input;

  const invitation = await prisma.talentPoolInvitation.findUnique({
    where: { id: invitationId },
    include: {
      applicantProfile: {
        select: { id: true, userId: true, firstName: true, lastName: true, resumeUrl: true, user: { select: { accountStatus: true } } },
      },
      jobPosting: { include: { mrf: { select: { clientId: true } } } },
    },
  });

  if (!invitation) {
    throw new InvalidKnnRequestError("Invitation not found");
  }

  const applicantProfile = invitation.applicantProfile ?? (invitation as any).membership?.applicantProfile;
  if (!applicantProfile) {
    throw new InvalidKnnRequestError("Invitation not found");
  }
  // Only the applicant's own login is checked against the profile; staff and link replies were authorised upstream.
  if (actor.kind === "APPLICANT" && applicantProfile.userId !== actor.userId) {
    throw new InvalidKnnRequestError("Unauthorized to respond to this invitation.");
  }
  const userId = applicantProfile.userId;
  const channel = actor.kind === "APPLICANT" ? "PORTAL" : actor.kind === "ASSISTED" ? actor.channel : "SMS_MAGIC_LINK";
  const channelData = {
    responseChannel: channel,
    assistedById: actor.kind === "ASSISTED" ? actor.taId : null,
    responseTokenHash: null,
  } as const;
  const auditActorId = actor.kind === "ASSISTED" ? actor.taId : userId;

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

  const candidateName = `${applicantProfile.firstName || ""} ${applicantProfile.lastName || ""}`.trim() || "Candidate";

  if (decision === "ACCEPT") {
    if (invitation.membershipId && prisma.deployment) {
      const activeDeployment = await prisma.deployment.findFirst({
        where: { employee: { userId }, status: { notIn: ["ENDED", "CANCELLED"] } },
        select: { id: true },
      });
      if (activeDeployment) throw new InvalidKnnRequestError("This worker is still assigned to a scheduled or active client placement.");
    }

    const attemptAggregate = prisma.application?.aggregate
      ? await prisma.application.aggregate({
          where: { userId, jobPostingId: invitation.jobPostingId },
          _max: { attemptNumber: true },
        })
      : { _max: { attemptNumber: 0 } };
    const attemptNumber = (attemptAggregate._max.attemptNumber ?? 0) + 1;
    const priorSameClientDeployments = invitation.jobPosting.mrf?.clientId && prisma.deployment
      ? await prisma.deployment.findMany({
          where: {
            employee: { userId },
            clientId: invitation.jobPosting.mrf.clientId,
            status: { in: ["ACTIVE", "ENDED"] },
            OR: [
              { actualStart: { not: null } },
              { statusHistory: { some: { toStatus: "ACTIVE" } } },
              { status: "ENDED", contractStart: { not: null } },
            ],
          },
          select: { id: true, applicationId: true },
          orderBy: { createdAt: "desc" },
        })
      : [];
    const priorSameClientDeployment = priorSameClientDeployments.length > 0;
    const applicationStatus = priorSameClientDeployment ? "COMPLIANCE" : "SUBMITTED";

    const result = await prisma.$transaction(async (tx) => {
      // Claim the pending invitation first so overlapping taps cannot both create an application.
      const claimed = await tx.talentPoolInvitation.updateMany({
        where: { id: invitationId, status: "PENDING" },
        data: {
          status: "ACCEPTED",
          responseNotes: notes || null,
          respondedAt: new Date(),
          ...channelData,
        },
      });
      if (claimed.count !== 1) throw new InvalidKnnRequestError("Invitation is no longer pending.");
      const updatedInv = (await tx.talentPoolInvitation.findUnique({ where: { id: invitationId } }))!;

      // A walk-in who accepts keeps a walk-in application so the TA can print a tracking slip.
      const isWalkIn = (applicantProfile as any).user?.accountStatus === "WALK_IN";
      let newApplication = await tx.application.create({
        data: {
          userId,
          jobPostingId: invitation.jobPostingId,
          attemptNumber,
          status: applicationStatus,
          resumeUrl: applicantProfile.resumeUrl,
          ...(isWalkIn ? { source: "WALK_IN" as const } : {}),
        },
      });
      if (isWalkIn) {
        newApplication = await tx.application.update({
          where: { id: newApplication.id },
          data: {
            trackingCode: buildTrackingCode("WALK_IN", newApplication.id, new Date().getFullYear()),
            trackingTokenHash: generateTrackingToken().hash,
          },
        });
      }

      await tx.recruiterDecision.create({
        data: {
          applicationId: newApplication.id,
          actorId: invitation.invitedById,
          fromStatus: invitation.membershipId ? "TALENT_POOL" : "REDEPLOYMENT",
          toStatus: applicationStatus,
          reason: `Candidate accepted ${invitation.membershipId ? "talent pool" : "redeployment"} job invitation #${invitationId}${priorSameClientDeployment ? "; routed to Requirements based on prior placement with this client" : ""}`,
        },
      });

      if (invitation.membershipId) {
        await tx.talentPoolContact.create({
          data: {
            membershipId: invitation.membershipId,
            jobPostingId: invitation.jobPostingId,
            recruiterId: invitation.invitedById,
            outcome: "INTERESTED",
            notes: notes ? `Invitation accepted: ${notes}` : "Candidate accepted invitation and applied",
          },
        });
      }

      return { invitation: updatedInv, application: newApplication };
    });

    if (priorSameClientDeployment) {
      const { generateComplianceRequirementsFromMRF, reuseValidSameClientDocuments } = await import("./ta.compliance.service.js");
      await generateComplianceRequirementsFromMRF(result.application.id);
      const priorApplicationIds = [...new Set(priorSameClientDeployments.map((deployment) => deployment.applicationId).filter((id): id is number => id !== null))];
      await reuseValidSameClientDocuments(result.application.id, priorApplicationIds);
    }

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

    void logAudit(auditActorId, "TALENT_POOL_INVITATION_ACCEPTED", "Application", result.application.id, {
      invitationId,
      jobPostingId: invitation.jobPostingId,
      channel,
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
      const claimed = await tx.talentPoolInvitation.updateMany({
        where: { id: invitationId, status: "PENDING" },
        data: {
          status: "DECLINED",
          declineReason: declineReason || "NOT_INTERESTED",
          responseNotes: notes || null,
          respondedAt: new Date(),
          ...channelData,
        },
      });
      if (claimed.count !== 1) throw new InvalidKnnRequestError("Invitation is no longer pending.");
      const inv = (await tx.talentPoolInvitation.findUnique({ where: { id: invitationId } }))!;

      if (invitation.membershipId && declineReason === "UNAVAILABLE_EMPLOYED") {
        await tx.talentPoolMembership.update({
          where: { id: invitation.membershipId },
          data: { availability: "UNAVAILABLE" },
        });
      }

      if (invitation.membershipId) {
        await tx.talentPoolContact.create({
          data: {
            membershipId: invitation.membershipId,
            jobPostingId: invitation.jobPostingId,
            recruiterId: invitation.invitedById,
            outcome: declineReason === "UNAVAILABLE_EMPLOYED" ? "UNAVAILABLE" : "NOT_INTERESTED",
            notes: notes ? `Invitation declined (${declineReason}): ${notes}` : `Invitation declined (${declineReason})`,
          },
        });
      }

      return inv;
    });

    void sendNotification(
      invitation.invitedById,
      "Job Invitation Declined",
      `${candidateName} declined invitation for ${invitation.jobPosting.title} (${declineReason || "Not Interested"}).`,
      "WARNING",
      `/ta/jobs/${invitation.jobPostingId}`
    );

    void logAudit(auditActorId, "TALENT_POOL_INVITATION_DECLINED", "JobPosting", invitation.jobPostingId, {
      invitationId,
      declineReason,
      notes,
      channel,
    });

    return {
      success: true,
      message: "Job invitation declined.",
      invitation: updatedInv,
    };
  }
};

export interface ExpiredInvitation {
  id: number;
  jobTitle: string | null;
  job: JobOwnerFields | null;
}

export const expirePendingInvitationsWorker = async (): Promise<{ expiredCount: number; expired: ExpiredInvitation[] }> => {
  const now = new Date();
  const overdue = await prisma.talentPoolInvitation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
    select: { id: true, membershipId: true, jobPosting: { select: { title: true, ...JOB_OWNER_SELECT } } },
  });

  if (overdue.length === 0) {
    return { expiredCount: 0, expired: [] };
  }

  const { count } = await prisma.talentPoolInvitation.updateMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });

  // Check affected memberships for inactive pruning (e.g. >= 2 expired in last 60 days)
  const uniqueMembershipIds = Array.from(
    new Set(overdue.map((o) => o.membershipId).filter((id): id is number => id !== null))
  );
  for (const membershipId of uniqueMembershipIds) {
    const expiredCount = await prisma.talentPoolInvitation.count({
      where: {
        membershipId,
        status: "EXPIRED",
        createdAt: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
      },
    });

    if (expiredCount >= 2) {
      // A candidate who said they are unavailable stays unavailable.
      try {
        await prisma.talentPoolMembership.update({
          where: { id: membershipId, availability: { not: "UNAVAILABLE" } },
          data: { availability: "UNKNOWN" },
        });
      } catch (error) {
        // P2025: the membership is UNAVAILABLE, so there is nothing to change.
        if ((error as { code?: string } | null)?.code !== "P2025") throw error;
      }
    }
  }

  return {
    expiredCount: count,
    expired: overdue.map((o) => ({
      id: o.id,
      jobTitle: o.jobPosting?.title ?? null,
      job: o.jobPosting
        ? { postedById: o.jobPosting.postedById, mrfId: o.jobPosting.mrfId, mrf: o.jobPosting.mrf }
        : null,
    })),
  };
};

// ---------------------------------------------------------------------------
// Offer replies without the portal: TA-recorded replies and one-time SMS links.
// ---------------------------------------------------------------------------

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const tokenMatches = (token: string, storedHash: string | null | undefined): boolean => {
  if (!storedHash || typeof token !== "string" || !token) return false;
  const a = Buffer.from(sha256(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};

const offerLinkBaseUrl = () => (process.env.APP_URL || process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

const loadOwnedInvitation = async (invitationId: number, taId: string) => {
  const invitation = await prisma.talentPoolInvitation.findUnique({
    where: { id: invitationId },
    include: {
      jobPosting: { select: { id: true, title: true } },
      applicantProfile: { select: { mobileNumber: true, user: { select: { phoneNumber: true } } } },
    },
  });
  if (!invitation) throw new InvitationActionError("Invitation not found", 404);
  try {
    await assertOwns("job", invitation.jobPostingId, { id: taId, role: "TALENT_ACQUISITION" });
  } catch {
    throw new InvitationActionError("Invitation not found", 404);
  }
  return invitation;
};

export interface AssistedResponseInput {
  invitationId: number;
  taId: string;
  decision: "ACCEPT" | "DECLINE";
  channel: "ASSISTED_PHONE" | "IN_PERSON";
  declineReason?: DeclineReason;
  notes?: string;
}

/** A TA records an answer the applicant gave by phone or in person. */
export const recordAssistedResponse = async (input: AssistedResponseInput) => {
  const { invitationId, taId, decision, channel, declineReason, notes } = input;
  await loadOwnedInvitation(invitationId, taId);
  const result = await respondToJobInvitation({
    actor: { kind: "ASSISTED", taId, channel },
    invitationId,
    decision,
    declineReason,
    notes,
  });
  return {
    status: result.invitation.status as "ACCEPTED" | "DECLINED",
    ...("application" in result && result.application ? { applicationId: result.application.id } : {}),
  };
};

/** Texts the applicant a one-time Accept/Decline link. */
export const sendOfferSmsLink = async (input: { invitationId: number; taId: string }) => {
  const { invitationId, taId } = input;
  const invitation = await loadOwnedInvitation(invitationId, taId);
  if (invitation.status !== "PENDING") {
    throw new InvitationActionError(`Invitation is no longer pending (current status: ${invitation.status}).`, 409);
  }
  const mobile = invitation.applicantProfile?.user?.phoneNumber || invitation.applicantProfile?.mobileNumber;
  if (!mobile) throw new InvitationActionError("This applicant has no mobile number on file.", 409);

  const token = randomBytes(16).toString("base64url");

  const url = `${offerLinkBaseUrl()}/offer/${invitationId}?token=${token}`;
  const sent = await sendSmsViaTextBee(
    mobile,
    `MEGS: You have a job offer for ${invitation.jobPosting.title}. Open ${url} to accept or decline.`
  );
  if (!sent.success) {
    // The previous link, if any, stays valid.
    throw new InvitationActionError("The text message could not be sent. Try again.", 502);
  }
  await prisma.talentPoolInvitation.update({
    where: { id: invitationId },
    data: { responseTokenHash: sha256(token) },
  });

  void logAudit(taId, "TALENT_POOL_OFFER_LINK_SENT", "JobPosting", invitation.jobPostingId, { invitationId });

  return { sentTo: maskPhoneNumber(mobile), expiresAt: invitation.expiresAt ? invitation.expiresAt.toISOString() : null };
};

const notFound = () => new InvitationActionError("Not found", 404);

const loadInvitationForLink = async (invitationId: number, token: string) => {
  const invitation = await prisma.talentPoolInvitation.findUnique({
    where: { id: invitationId },
    include: {
      applicantProfile: { select: { firstName: true } },
      jobPosting: { select: { title: true, location: true, mrf: { select: { client: { select: { name: true } } } } } },
    },
  });
  if (!invitation || !tokenMatches(token, invitation.responseTokenHash)) throw notFound();
  if (invitation.status !== "PENDING") throw notFound();
  if (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now()) throw notFound();
  return invitation;
};

/** Public offer details for a valid, unused link. Every failure is the same not-found error. */
export const getOfferByToken = async (invitationId: number, token: string) => {
  const inv = await loadInvitationForLink(invitationId, token);
  return {
    invitationId: inv.id,
    status: inv.status,
    applicantFirstName: inv.applicantProfile?.firstName || "",
    jobTitle: inv.jobPosting.title,
    clientName: inv.jobPosting.mrf?.client?.name ?? null,
    location: inv.jobPosting.location ?? null,
    message: inv.message,
    expiresAt: inv.expiresAt ? inv.expiresAt.toISOString() : null,
  };
};

/** Accept or decline through the link. The token works once; any failure is a not-found error. */
export const respondViaOfferLink = async (
  invitationId: number,
  token: string,
  decision: "ACCEPT" | "DECLINE",
  declineReason?: DeclineReason
) => {
  await loadInvitationForLink(invitationId, token);
  try {
    const result = await respondToJobInvitation({ actor: { kind: "MAGIC_LINK" }, invitationId, decision, declineReason });
    return {
      status: result.invitation.status as "ACCEPTED" | "DECLINED",
      ...("application" in result && result.application ? { applicationId: result.application.id } : {}),
    };
  } catch {
    throw notFound();
  }
};
