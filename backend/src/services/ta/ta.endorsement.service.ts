import prisma from "../../utils/prisma.js";

export const recordClientEndorsement = async (
  applicationId: number,
  clientId: number,
  outcome: "PENDING" | "ENDORSED" | "DECLINED",
  endorsedById?: string,
  notes?: string
) => {
  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application) throw new Error("Application not found");

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error("Client not found");

  return await prisma.clientEndorsement.create({
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
