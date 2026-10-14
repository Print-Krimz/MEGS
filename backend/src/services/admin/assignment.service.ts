import prisma from "../../utils/prisma.js";
import { logAudit } from "../../utils/audit.js";

// Admin-controlled ownership. A requisition's job postings, applicants and deployments follow its owner,
// so moving the requisition moves all of them.

const requireActiveTa = async (id: string) => {
  const ta = await prisma.user.findFirst({
    where: { id, role: "TALENT_ACQUISITION", isActive: true },
    select: { id: true, email: true },
  });
  if (!ta) throw new Error("Choose an active Talent Acquisition user");
  return ta;
};

export const assignMrf = async (mrfId: number, assignedTaId: string | null, actorId: string) => {
  const mrf = await prisma.manpowerRequest.findUnique({ where: { id: mrfId }, select: { id: true, assignedTaId: true } });
  if (!mrf) throw new Error("Manpower Request not found");
  if (assignedTaId) await requireActiveTa(assignedTaId);

  const updated = await prisma.manpowerRequest.update({
    where: { id: mrfId },
    data: { assignedTaId },
    select: { id: true, assignedTaId: true },
  });
  void logAudit(actorId, "MRF_REASSIGNED", "ManpowerRequest", mrfId, { from: mrf.assignedTaId, to: assignedTaId });
  return updated;
};

export const assignClient = async (clientId: number, assignedTaId: string | null, actorId: string) => {
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, assignedTaId: true } });
  if (!client) throw new Error("Client not found");
  if (assignedTaId) await requireActiveTa(assignedTaId);

  const updated = await prisma.client.update({
    where: { id: clientId },
    data: { assignedTaId },
    select: { id: true, assignedTaId: true },
  });
  void logAudit(actorId, "CLIENT_REASSIGNED", "Client", clientId, { from: client.assignedTaId, to: assignedTaId });
  return updated;
};

/** Hands everything a TA owns to another TA. Used when a TA leaves. History fields (createdBy, actors) stay as they were. */
export const reassignTaRecords = async (fromTaId: string, toTaId: string, actorId: string) => {
  if (fromTaId === toTaId) throw new Error("Choose a different Talent Acquisition user");
  const from = await prisma.user.findUnique({ where: { id: fromTaId }, select: { id: true, role: true } });
  if (!from || from.role !== "TALENT_ACQUISITION") throw new Error("User not found");
  await requireActiveTa(toTaId);

  const [mrfs, clients, standaloneJobs, followUps] = await prisma.$transaction([
    prisma.manpowerRequest.updateMany({ where: { assignedTaId: fromTaId }, data: { assignedTaId: toTaId } }),
    prisma.client.updateMany({ where: { assignedTaId: fromTaId }, data: { assignedTaId: toTaId } }),
    prisma.jobPosting.updateMany({ where: { mrfId: null, postedById: fromTaId }, data: { postedById: toTaId } }),
    prisma.employee.updateMany({ where: { redeploymentOwnerId: fromTaId }, data: { redeploymentOwnerId: toTaId } }),
  ]);

  const moved = {
    manpowerRequests: mrfs.count,
    clients: clients.count,
    standaloneJobs: standaloneJobs.count,
    redeploymentFollowUps: followUps.count,
  };
  void logAudit(actorId, "TA_RECORDS_REASSIGNED", "User", null, { fromTaId, toTaId, ...moved });
  return moved;
};
