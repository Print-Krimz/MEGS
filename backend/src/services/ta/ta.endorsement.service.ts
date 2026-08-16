import prisma from "../../utils/prisma.js";
import { sendNotification } from "../../utils/notification.js";

export const recordClientEndorsement = async (
  applicationId: number,
  clientId: number,
  outcome: "PENDING" | "ENDORSED" | "DECLINED",
  endorsedById?: string,
  notes?: string
) => {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, status: true, userId: true, isArchived: true },
  });
  if (!application) throw new Error("Application not found");
  if (application.isArchived) throw new Error("Cannot endorse an archived application");

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error("Client not found");

  // 1. Create client endorsement record
  const endorsement = await prisma.clientEndorsement.create({
    data: {
      applicationId,
      clientId,
      outcome,
      endorsedById: endorsedById || null,
      notes: notes || null,
    },
    include: {
      client: { select: { id: true, name: true } },
      endorsedBy: { select: { id: true, email: true } },
    },
  });

  // 2. Advance application pipeline status to CLIENT_ENDORSEMENT if in an earlier stage
  const STAGES_BEFORE_ENDORSEMENT = [
    "SUBMITTED",
    "PARSING",
    "REVIEW",
    "NEEDS_ATTENTION",
    "MATCHED",
    "INITIAL_SCREENING",
  ];

  if (STAGES_BEFORE_ENDORSEMENT.includes(application.status)) {
    await prisma.application.update({
      where: { id: applicationId },
      data: { status: "CLIENT_ENDORSEMENT" },
    });

    const resolvedActorId = endorsedById || application.userId;
    await prisma.recruiterDecision.create({
      data: {
        applicationId,
        actorId: resolvedActorId,
        fromStatus: application.status,
        toStatus: "CLIENT_ENDORSEMENT",
        reason: notes || `Endorsed to client: ${client.name}`,
      },
    });
  }

  // 3. Send persistent and real-time SSE notification to the candidate
  let notifTitle = "Client Endorsement";
  let notifMessage = `Your application has been endorsed to ${client.name} for evaluation.`;
  let notifType: "INFO" | "SUCCESS" | "WARNING" = "INFO";

  if (outcome === "ENDORSED") {
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
    notifType
  );

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
  outcome: "PENDING" | "ENDORSED" | "DECLINED",
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

    if (outcome === "ENDORSED") {
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
      notifType
    );
  }

  return updated;
};
