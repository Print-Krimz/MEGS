import prisma from "../../utils/prisma.js";
import { notifyJobOwner, sendNotification } from "../../utils/notification.js";
import { logAudit } from "../../utils/audit.js";
import { rebuildCandidateFeatureProfile } from "../scoring/talent-pool-knn.service.js";
import { ClientReviewNotRequiredError, PIPELINE_STAGE_ORDER } from "./pipeline-rules.js";
import { JOB_OWNER_SELECT } from "./ownership.js";

// Client decisions can't be recorded or changed once the candidate is backed out, rejected, archived, or past FINAL_INTERVIEW.
// FINAL_INTERVIEW stays allowed: an approval moves the candidate there and updateClientEndorsement handles that stage.
const CLIENT_DECISION_CLOSED_STATUSES = ["BACKOUT", "REJECTED", "ARCHIVED"];
const assertAtClientEndorsementStage = (status: string) => {
  const order = PIPELINE_STAGE_ORDER as readonly string[];
  const pastEndorsement = order.indexOf(status) > order.indexOf("FINAL_INTERVIEW");
  if (pastEndorsement || CLIENT_DECISION_CLOSED_STATUSES.includes(status)) {
    throw new Error("This application is no longer at the client endorsement stage.");
  }
};

export const recordClientEndorsement = async (
  applicationId: number,
  clientId?: number,
  outcome: "PENDING" | "APPROVED" | "DECLINED" | "ENDORSED" = "PENDING",
  endorsedById?: string,
  notes?: string
) => {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      jobPosting: {
        include: {
          mrf: {
            include: {
              client: true,
            },
          },
        },
      },
    },
  });

  if (!application) throw new Error("Application not found");
  if (application.isArchived) throw new Error("Cannot endorse an archived application");
  if (application.jobPosting?.mrf?.requiresClientReview === false) throw new ClientReviewNotRequiredError();

  const invalidStages = ["COMPLIANCE", "DEPLOYED", "ARCHIVED", "BACKOUT", "REJECTED"];
  if (invalidStages.includes(application.status)) {
    throw new Error("Client endorsement can't be recorded at this application's current stage.");
  }
  assertAtClientEndorsementStage(application.status);

  // Candidate must have passed Initial Screening
  const screening = await prisma.interview.findFirst({
    where: {
      applicationId,
      type: "INITIAL_SCREENING",
      result: { in: ["PASS", "PASSED"] },
      isActive: true,
    },
  });
  if (!screening) {
    throw new Error("Cannot record client endorsement. A passed Initial Screening interview is required.");
  }

  const resolvedClientId =
    application.jobPosting?.mrf?.clientId ||
    application.jobPosting?.mrf?.client?.id ||
    clientId;

  if (!resolvedClientId) {
    throw new Error("Cannot endorse this candidate. The application is missing a linked job posting, manpower request, or client.");
  }

  const client = await prisma.client.findUnique({ where: { id: resolvedClientId } });
  if (!client) throw new Error("Client not found");

  // 1. Create client endorsement record
  const endorsement = await prisma.clientEndorsement.create({
    data: {
      applicationId,
      clientId: resolvedClientId,
      outcome,
      endorsedById: endorsedById || null,
      // A decision recorded with the client's answer keeps its text in decisionNotes, like updateClientEndorsement.
      ...(outcome === "PENDING" ? { notes: notes || null } : { decisionNotes: notes || null }),
    },
    include: {
      client: { select: { id: true, name: true } },
      endorsedBy: { select: { id: true, email: true } },
    },
  });

  // 2. Advance application pipeline status to CLIENT_ENDORSEMENT if in INITIAL_SCREENING or pre-screening stages
  const { updateTAApplicationStatus } = await import("./ta.applications.service.js");
  if (["INITIAL_SCREENING", "SUBMITTED", "REVIEW", "MATCHED", "NEEDS_ATTENTION", "PARSING"].includes(application.status)) {
    if (application.status !== "INITIAL_SCREENING") {
      await updateTAApplicationStatus(
        applicationId,
        "INITIAL_SCREENING",
        endorsedById,
        "Auto-transition to INITIAL_SCREENING prior to client endorsement",
        undefined,
        { notifyApplicant: false }
      );
    }
    await updateTAApplicationStatus(
      applicationId,
      "CLIENT_ENDORSEMENT",
      endorsedById,
      `Sent to client for review: ${client.name}`,
      undefined,
      { notifyApplicant: false }
    );
  }

  if (outcome === "APPROVED" || outcome === "ENDORSED") {
    await updateTAApplicationStatus(
      applicationId,
      "FINAL_INTERVIEW",
      endorsedById,
      "Client approved - advancing to Final Interview",
      undefined,
      { notifyApplicant: false }
    );
  }

  // 3. Send exactly one applicant notification for this step (the status updates above are silent)
  const notifTitle = "Application Update";
  let notifMessage = "Initial screening completed.";
  let notifType: "INFO" | "SUCCESS" | "WARNING" = "INFO";

  if (outcome === "APPROVED" || outcome === "ENDORSED") {
    notifMessage = "Client review completed.";
    notifType = "SUCCESS";
  } else if (outcome === "DECLINED") {
    notifMessage = "You were not selected for this role by the client.";
    notifType = "WARNING";
  }

  await sendNotification(
    application.userId,
    notifTitle,
    notifMessage,
    notifType,
    `/app/applications/${applicationId}`
  );

  void logAudit(endorsedById || null, "CLIENT_ENDORSEMENT_RECORDED", "Application", applicationId, {
    endorsementId: endorsement.id,
    clientId: resolvedClientId,
    clientName: client.name,
    outcome,
    notes,
  });

  // Auto-retain candidate in Talent Pool following client rejection
  if ((outcome as string) === "DECLINED" || (outcome as string) === "REJECTED") {
    const profile = await prisma.applicantProfile.findUnique({
      where: { userId: application.userId },
      select: { id: true, hasNoShowHistory: true },
    });
    if (profile && !profile.hasNoShowHistory) {
      await prisma.talentPoolMembership.upsert({
        where: { applicantProfileId: profile.id },
        create: {
          applicantProfileId: profile.id,
          sourceApplicationId: applicationId,
          status: "ACTIVE",
          availability: "AVAILABLE",
          addedById: endorsedById || application.userId,
          notes: notes || `Auto-retained in talent pool following client rejection (${client.name || "Client"})`,
        },
        update: {
          status: "ACTIVE",
          availability: "AVAILABLE",
          notes: notes || `Auto-retained in talent pool following client rejection (${client.name || "Client"})`,
        },
      });
      await rebuildCandidateFeatureProfile(profile.id).catch(() => {});
    }
  }

  return endorsement;
};

export const listClientEndorsements = async (applicationId: number) => {
  return await prisma.clientEndorsement.findMany({
    where: { applicationId },
    include: {
      client: { select: { id: true, name: true } },
      endorsedBy: { select: { id: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const getLatestClientEndorsement = async (applicationId: number) => {
  return await prisma.clientEndorsement.findFirst({
    where: { applicationId },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      endorsedBy: { select: { id: true, email: true } },
    },
  });
};

export const updateClientEndorsement = async (
  applicationId: number,
  endorsementId: number,
  outcome: "PENDING" | "APPROVED" | "DECLINED" | "ENDORSED",
  actorId?: string,
  notes?: string
) => {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      userId: true,
      isArchived: true,
      jobPosting: {
        select: {
          title: true,
          ...JOB_OWNER_SELECT,
        },
      },
    },
  });
  if (!application) throw new Error("Application not found");
  if (application.isArchived) throw new Error("Cannot update endorsement on an archived application");
  assertAtClientEndorsementStage(application.status);

  const existing = await prisma.clientEndorsement.findFirst({
    where: { id: endorsementId, applicationId },
    include: { client: { select: { id: true, name: true } } },
  });
  if (!existing) throw new Error("Client endorsement record not found");

  const updated = await prisma.clientEndorsement.update({
    where: { id: endorsementId },
    data: {
      outcome,
      ...(notes !== undefined ? { decisionNotes: notes || null } : {}),
      ...(actorId ? { endorsedById: actorId } : {}),
    },
    include: {
      client: { select: { id: true, name: true } },
      endorsedBy: { select: { id: true, email: true } },
    },
  });

  // Record audit decision if outcome changed
  if (existing.outcome !== outcome) {
    const resolvedActorId = actorId || application.userId;
    await prisma.recruiterDecision.create({
      data: {
        applicationId,
        actorId: resolvedActorId,
        fromStatus: `${application.status} [ENDORSEMENT:${existing.outcome}]`,
        toStatus: `${application.status} [ENDORSEMENT:${outcome}]`,
        reason: `Client endorsement decision updated to ${outcome} for ${existing.client?.name || "Client"}`,
      },
    });

    // Notify candidate
    const notifTitle = "Application Update";
    let notifMessage = "Client review is still pending.";
    let notifType: "INFO" | "SUCCESS" | "WARNING" = "INFO";

    if (outcome === "APPROVED" || outcome === "ENDORSED") {
      notifMessage = "Client review completed.";
      notifType = "SUCCESS";
    } else if (outcome === "DECLINED") {
      notifMessage = "You were not selected for this role by the client.";
      notifType = "WARNING";
    }

    await sendNotification(
      application.userId,
      notifTitle,
      notifMessage,
      notifType,
      `/app/applications/${applicationId}`
    );

    // If recorded by another team member/coordinator, notify requisition owner
    const jobTitle = application.jobPosting?.title || "Requisition";
    await notifyJobOwner(
      application.jobPosting,
      "Client Endorsement Decision Recorded",
      `Client decision for candidate on "${jobTitle}" was recorded as ${outcome}.`,
      outcome === "APPROVED" ? "SUCCESS" : "WARNING",
      `/ta/applications/${applicationId}`,
      { excludeUserId: actorId }
    );
  }

  void logAudit(actorId || null, "CLIENT_ENDORSEMENT_UPDATED", "Application", applicationId, {
    endorsementId,
    clientName: existing.client?.name,
    previousOutcome: existing.outcome,
    outcome,
    notes,
  });

  // Advance application status to FINAL_INTERVIEW when client approves
  if (outcome === "APPROVED" || outcome === "ENDORSED") {
    const { updateTAApplicationStatus } = await import("./ta.applications.service.js");
    const currentApp = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { status: true },
    });
    if (
      currentApp &&
      ["CLIENT_ENDORSEMENT", "INITIAL_SCREENING", "SUBMITTED", "REVIEW", "MATCHED", "NEEDS_ATTENTION", "PARSING"].includes(
        currentApp.status
      )
    ) {
      if (currentApp.status !== "CLIENT_ENDORSEMENT" && currentApp.status !== "FINAL_INTERVIEW") {
        await updateTAApplicationStatus(
          applicationId,
          "CLIENT_ENDORSEMENT",
          actorId,
          "Transition to CLIENT_ENDORSEMENT prior to client approval",
          undefined,
          { notifyApplicant: false }
        );
      }
      if (currentApp.status !== "FINAL_INTERVIEW") {
        await updateTAApplicationStatus(
          applicationId,
          "FINAL_INTERVIEW",
          actorId,
          `Client approved - advancing to Final Interview`,
          undefined,
          { notifyApplicant: false }
        );
      }
    }
  }

  // Auto-retain candidate in Talent Pool following client rejection
  if ((outcome as string) === "DECLINED" || (outcome as string) === "REJECTED") {
    const profile = await prisma.applicantProfile.findUnique({
      where: { userId: application.userId },
      select: { id: true, hasNoShowHistory: true },
    });
    if (profile && !profile.hasNoShowHistory) {
      await prisma.talentPoolMembership.upsert({
        where: { applicantProfileId: profile.id },
        create: {
          applicantProfileId: profile.id,
          sourceApplicationId: applicationId,
          status: "ACTIVE",
          availability: "AVAILABLE",
          addedById: actorId || application.userId,
          notes: notes || `Auto-retained in talent pool following client rejection (${existing.client?.name || "Client"})`,
        },
        update: {
          status: "ACTIVE",
          availability: "AVAILABLE",
          notes: notes || `Auto-retained in talent pool following client rejection (${existing.client?.name || "Client"})`,
        },
      });
      await rebuildCandidateFeatureProfile(profile.id).catch(() => {});
    }
  }

  return updated;
};

export const updateEndorsementDecision = updateClientEndorsement;
