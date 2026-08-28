import prisma from "../../utils/prisma.js";
import { sendNotification } from "../../utils/notification.js";
import { logAudit } from "../../utils/audit.js";

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

  const invalidStages = ["COMPLIANCE", "DEPLOYED", "ARCHIVED", "BACKOUT"];
  if (invalidStages.includes(application.status)) {
    throw new Error(`Cannot record client endorsement for application in ${application.status} stage.`);
  }

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
    throw new Error("Cannot record client endorsement. A passed INITIAL_SCREENING interview is required.");
  }

  const resolvedClientId =
    application.jobPosting?.mrf?.clientId ||
    application.jobPosting?.mrf?.client?.id ||
    clientId;

  if (!resolvedClientId) {
    throw new Error("Cannot endorse candidate: Application requisition is missing a linked Job Posting, MRF, or Client relationship.");
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
      notes: notes || null,
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
        "Auto-transition to INITIAL_SCREENING prior to client endorsement"
      );
    }
    await updateTAApplicationStatus(
      applicationId,
      "CLIENT_ENDORSEMENT",
      endorsedById,
      notes || `Endorsed to client: ${client.name}`
    );
  }

  if (outcome === "APPROVED" || outcome === "ENDORSED") {
    await updateTAApplicationStatus(
      applicationId,
      "FINAL_INTERVIEW",
      endorsedById,
      notes || `Client approved endorsement - advancing to Final Interview`
    );
  }

  // 3. Send persistent and real-time SSE notification to the candidate
  let notifTitle = "Client Endorsement";
  let notifMessage = `Your application has been endorsed to ${client.name} for evaluation and is currently under client review.`;
  let notifType: "INFO" | "SUCCESS" | "WARNING" = "INFO";

  if (outcome === "APPROVED" || outcome === "ENDORSED") {
    notifTitle = "Client Endorsement Approved";
    notifMessage = `Good news! Your endorsement to ${client.name} has been approved by the client.`;
    notifType = "SUCCESS";
  } else if (outcome === "DECLINED") {
    notifTitle = "Client Endorsement Update";
    notifMessage = `Your application endorsement for ${client.name} has been declined.`;
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
    select: { id: true, status: true, userId: true, isArchived: true },
  });
  if (!application) throw new Error("Application not found");
  if (application.isArchived) throw new Error("Cannot update endorsement on an archived application");

  const existing = await prisma.clientEndorsement.findFirst({
    where: { id: endorsementId, applicationId },
    include: { client: { select: { id: true, name: true } } },
  });
  if (!existing) throw new Error("Client endorsement record not found");

  const updated = await prisma.clientEndorsement.update({
    where: { id: endorsementId },
    data: {
      outcome,
      notes: notes !== undefined ? notes : existing.notes,
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
        reason: notes || `Client endorsement decision updated to ${outcome} for ${existing.client?.name || "Client"}`,
      },
    });

    // Notify candidate
    let notifTitle = "Client Endorsement Update";
    let notifMessage = `Your endorsement with ${existing.client?.name || "the client"} status has been updated to ${outcome}.`;
    let notifType: "INFO" | "SUCCESS" | "WARNING" = "INFO";

    if (outcome === "APPROVED" || outcome === "ENDORSED") {
      notifTitle = "Client Endorsement Approved";
      notifMessage = `Great news! ${existing.client?.name || "The client"} has approved your endorsement.`;
      notifType = "SUCCESS";
    } else if (outcome === "DECLINED") {
      notifTitle = "Client Endorsement Declined";
      notifMessage = `${existing.client?.name || "The client"} has declined the endorsement for this role.`;
      notifType = "WARNING";
    }

    await sendNotification(
      application.userId,
      notifTitle,
      notifMessage,
      notifType,
      `/app/applications/${applicationId}`
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
          "Transition to CLIENT_ENDORSEMENT prior to client approval"
        );
      }
      if (currentApp.status !== "FINAL_INTERVIEW") {
        await updateTAApplicationStatus(
          applicationId,
          "FINAL_INTERVIEW",
          actorId,
          notes || `Client acceptance recorded as ${outcome} - advancing to Final Interview`
        );
      }
    }
  }

  return updated;
};
