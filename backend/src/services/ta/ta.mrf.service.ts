import prisma from "../../utils/prisma.js";

export const listMRFs = async (clientId?: number, status?: string) => {
  const where: any = {};
  if (clientId) where.clientId = clientId;
  if (status) where.status = status;

  return await prisma.manpowerRequest.findMany({
    where,
    include: {
      client: { select: { id: true, name: true } },
      createdBy: { select: { id: true, email: true } },
      _count: {
        select: {
          jobPostings: true,
          deployments: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const createMRF = async (
  createdById: string,
  data: {
    clientId: number;
    title: string;
    description?: string;
    headcount?: number;
    location?: string;
    targetFillDate?: string | Date;
    priority?: string;
    requiredSkills?: string;
    requiredExperience?: string;
    requiredEducation?: string;
    requiredCertifications?: string;
  }
) => {
  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) throw new Error("Client not found");

  return await prisma.manpowerRequest.create({
    data: {
      clientId: data.clientId,
      createdById,
      title: data.title,
      description: data.description,
      headcount: data.headcount ?? 1,
      location: data.location,
      targetFillDate: data.targetFillDate ? new Date(data.targetFillDate) : null,
      priority: data.priority ?? "NORMAL",
      requiredSkills: data.requiredSkills,
      requiredExperience: data.requiredExperience,
      requiredEducation: data.requiredEducation,
      requiredCertifications: data.requiredCertifications,
    },
    include: {
      client: { select: { id: true, name: true } },
    },
  });
};

export const getMRFDetails = async (id: number) => {
  const mrf = await prisma.manpowerRequest.findUnique({
    where: { id },
    include: {
      client: true,
      createdBy: { select: { id: true, email: true } },
      jobPostings: true,
      deployments: {
        include: {
          application: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  applicantProfile: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!mrf) throw new Error("Manpower Request not found");
  return mrf;
};

export const updateMRF = async (
  id: number,
  data: {
    title?: string;
    description?: string;
    headcount?: number;
    location?: string;
    targetFillDate?: string | Date;
    priority?: string;
    requiredSkills?: string;
    requiredExperience?: string;
    requiredEducation?: string;
    requiredCertifications?: string;
    status?: string;
  }
) => {
  const updateData: any = { ...data };
  if (data.targetFillDate) {
    updateData.targetFillDate = new Date(data.targetFillDate);
  }

  return await prisma.manpowerRequest.update({
    where: { id },
    data: updateData,
    include: {
      client: { select: { id: true, name: true } },
    },
  });
};

export const linkJobToMRF = async (mrfId: number, jobPostingId: number) => {
  const mrf = await prisma.manpowerRequest.findUnique({ where: { id: mrfId } });
  if (!mrf) throw new Error("Manpower Request not found");

  const job = await prisma.jobPosting.findUnique({ where: { id: jobPostingId } });
  if (!job) throw new Error("Job posting not found");

  return await prisma.jobPosting.update({
    where: { id: jobPostingId },
    data: { mrfId },
  });
};
